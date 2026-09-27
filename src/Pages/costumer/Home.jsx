import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/home/Header/Header';
import AnnouncementBar from '../../components/home/Announcements/AnnouncementBar';
import HomeHero from '../../components/home/HomeHero/HomeHero';
import Footer from '../../components/home/Footer/Footer';
import FoodandItemsSection from '../../components/home/FoodandItem/FoodandItemsSection/FoodandItemsSection';
import BestSellersSection from '../../components/home/BestSellers/BestSellersSection';
import OthersOrderForm from '../../components/home/OthersOrderForm/OthersOrderForm';
import PayBillsForm from '../../components/home/PayBillsForm/PayBillsForm';
import { FAQSection } from './FAQ';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import { CATALOG_CHANGED_EVENT, catalogImageUrl, getCatalog, getBestSellers, invalidateCatalogCache } from '../../utils/catalog';
import { getSessionUser } from '../../utils/session';


const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, placeOrder } = useCustomerActivity();
  // Set once, from Footer's "Food/Item/Pay Bills" links (navigate('/home',
  // { state: { selectedServiceType } })) - cleared after it's applied once
  // so it doesn't keep overriding a manual tab switch on later catalog
  // refetches (e.g. the visibilitychange reload below).
  const requestedServiceType = useRef(location.state?.selectedServiceType ?? null);

  // Currently selected service - also restored from sessionStorage (see
  // isHome below) so back-navigation lands on the same service grid the
  // customer was actually browsing, not just whichever service loads first.
  const [selectedService, setSelectedService] = useState(() => {
    try {
      const saved = sessionStorage.getItem('otuzanHomeSelectedService');
      return saved ? Number(saved) : null;
    } catch { return null; }
  });
  const [services, setServices] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [reloadCatalog, setReloadCatalog] = useState(0);
  const [search, setSearch] = useState('');
  const [customOrderBrand, setCustomOrderBrand] = useState(null);
  const [paymentBrand, setPaymentBrand] = useState(null);
  const [bestSellers, setBestSellers] = useState([]);
  // Persisted per-browser, not just component state - Home fully unmounts
  // and remounts on any route change (e.g. going to a brand's menu), which
  // used to reset this straight back to the hero/Best-Sellers view no
  // matter what the customer was browsing. Reported live (9/25): pressing
  // the browser back button from a brand's menu didn't return to that
  // brand's service grid the way "back" should - it dropped back to the
  // hero every time, which on a shorter remounted page could put the
  // restored scroll position past the grid entirely and into FAQ futher
  // down. Restoring the last view here (rather than hardcoding `true`)
  // fixes back-navigation without needing a browser-history workaround.
  const [isHome, setIsHome] = useState(() => {
    try { return sessionStorage.getItem('otuzanHomeIsHome') !== 'false'; } catch { return true; }
  });
  useEffect(() => {
    try { sessionStorage.setItem('otuzanHomeIsHome', String(isHome)); } catch { /* ignore */ }
  }, [isHome]);
  useEffect(() => {
    if (selectedService == null) return;
    try { sessionStorage.setItem('otuzanHomeSelectedService', String(selectedService)); } catch { /* ignore */ }
  }, [selectedService]);

  useEffect(() => {
    let active = true;
    const refreshBestSellers = () => getBestSellers().then((products) => {
      if (active) setBestSellers(products);
    }).catch(() => {});
    refreshBestSellers();
    const refreshTimer = window.setInterval(refreshBestSellers, 30000);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refreshBestSellers(); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setCatalogLoading(true);
      try {
        const data = await getCatalog();
        if (!active) return;
        setServices(data.services);
        // Mutating requestedServiceType.current from inside the
        // setSelectedService updater used to work locally but broke under
        // React 18 StrictMode, which intentionally invokes a state updater
        // twice in dev to catch exactly this kind of impurity - the first
        // call's side effect (clearing the ref) made the second call see it
        // already cleared, so the requested service was found but then
        // silently discarded in favor of the default. The ref mutation now
        // happens once, as a plain statement, outside any updater.
        let requestedServiceId = null;
        if (requestedServiceType.current) {
          const requested = data.services.find((service) => service.ServiceType === requestedServiceType.current);
          requestedServiceType.current = null;
          requestedServiceId = requested?.ServiceID ?? null;
        }
        setSelectedService((current) => {
          if (requestedServiceId) return requestedServiceId;
          return data.services.some((service) => service.ServiceID === current)
            ? current : (data.services[0]?.ServiceID ?? null);
        });
        setCatalogError('');
      } catch (error) { if (active) setCatalogError(error.message); }
      finally { if (active) setCatalogLoading(false); }
    };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const refreshAfterCatalogChange = () => {
      invalidateCatalogCache();
      load();
    };
    const refreshFromAnotherTab = (event) => {
      if (event.key === 'otuzan:catalog-changed') refreshAfterCatalogChange();
    };
    // A customer on another device has no shared browser event, so refresh
    // the small catalog payload periodically as a fallback.
    const refreshTimer = window.setInterval(refreshAfterCatalogChange, 15000);
    window.addEventListener(CATALOG_CHANGED_EVENT, refreshAfterCatalogChange);
    window.addEventListener('storage', refreshFromAnotherTab);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener(CATALOG_CHANGED_EVENT, refreshAfterCatalogChange);
      window.removeEventListener('storage', refreshFromAnotherTab);
    };
  }, [reloadCatalog]);

  useEffect(() => {
    if (!location.state?.scrollToFaq) return;
    setIsHome(true);
    const timer = window.setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100);
    return () => window.clearTimeout(timer);
  }, [location.state]);

  // Footer links can point back to /home while this component is already
  // mounted. In that case Home does not remount, so the initial-load ref
  // above cannot see the new router state. React to it here and apply the
  // requested service (or restore the home view) immediately.
  useEffect(() => {
    const requestedType = location.state?.selectedServiceType;
    if (requestedType) {
      const requested = services.find((service) => service.ServiceType === requestedType);
      if (!requested) return;
      setSelectedService(requested.ServiceID);
      setIsHome(false);
      const timer = window.setTimeout(() => document.getElementById('home-brands')?.scrollIntoView({ behavior: 'smooth' }), 0);
      return () => window.clearTimeout(timer);
    }
    if (location.state?.showHome) {
      setIsHome(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return undefined;
  }, [location.state, services]);

  const currentService = services.find((service) => service.ServiceID === selectedService);
  const searchTerm = search.trim().toLocaleLowerCase();
  const toBrandCard = (brand, service) => ({
      id: brand.BrandID,
      name: brand.BrandName.startsWith('Others (') ? 'Others' : brand.BrandName,
      image: catalogImageUrl(brand.ImagePath),
      type: service.ServiceType,
      productsCount: brand.products_count
    });
  const sortBrands = (brands) => brands
    .sort((first, second) => {
      if (first.name === 'Hongdae Chicken') return -1;
      if (second.name === 'Hongdae Chicken') return 1;
      return Number(first.name === 'Others') - Number(second.name === 'Others');
    });
  const getCurrentBrands = () => sortBrands((currentService?.brands || [])
    .map((brand) => toBrandCard(brand, currentService)));
  const getSearchResults = () => sortBrands(services.flatMap((service) => (service.brands || [])
    .filter((brand) => brand.BrandName.toLocaleLowerCase().includes(searchTerm))
    .map((brand) => toBrandCard(brand, service))));
  const showingSearchResults = searchTerm.length > 0;
  const displayedBrands = showingSearchResults ? getSearchResults() : getCurrentBrands();


  // Change section title depending on service
  const getSectionTitle = () => {

    return currentService?.ServiceName || 'Services';
  };


  return (
    <div className="home-page" id="home">

      {/* Header */}
      <Header
        selectedService={selectedService}
        onServiceChange={(serviceId) => { setSelectedService(serviceId); setIsHome(false); }}
        onHomeClick={() => { setIsHome(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        isHome={isHome}
        services={services}
        onSearch={(value) => {
          setSearch(value);
          if (value.trim()) setIsHome(false);
        }}
      />

      {!isHome && <AnnouncementBar />}

      {isHome && (
        <HomeHero
          brandCount={services.reduce((total, service) => total + (service.brands?.length || 0), 0)}
          onBrowseBrands={() => {
            setIsHome(false);
            window.setTimeout(() => document.getElementById('home-brands')?.scrollIntoView({ behavior: 'smooth' }), 0);
          }}
        />
      )}

      {catalogLoading && <p role="status" className="home-catalog-error">Loading catalog...</p>}
      {catalogError && <p role="alert" className="home-catalog-error">{catalogError} <button type="button" onClick={() => setReloadCatalog((count) => count + 1)}>Retry</button></p>}

      {isHome && <BestSellersSection
        products={bestSellers}
        onProductSelect={(product) => navigate(`/catalog/brands/${product.BrandID}`, {
          state: { highlightProductId: product.ProductID }
        })}
      />}

      {!isHome && <FoodandItemsSection
        id="home-brands"
        title={showingSearchResults ? `Search results for “${search.trim()}”` : getSectionTitle()}
        brands={displayedBrands}
        emptyMessage={showingSearchResults ? 'No brands match your search. Try another name.' : undefined}
        onBrandSelect={(brand) => {
          if (brand.type !== 'bills' && brand.productsCount > 0) {
            navigate(`/catalog/brands/${brand.id}`);
            return;
          }
          // Bill payments and custom "Others" orders skip the cart entirely
          // and start talking to authenticated-only endpoints immediately
          // (PayBillsForm uploads receipts as soon as a file is picked) - so
          // guests are sent to log in here, before investing effort filling
          // out a form they'd be blocked from submitting anyway.
          if (!getSessionUser()) {
            navigate('/login');
            return;
          }
          if (brand.type === 'bills') {
            setPaymentBrand(brand);
          } else {
            setCustomOrderBrand(brand);
          }
        }}
      />}

      {isHome && <FAQSection home />}

      {customOrderBrand && (
        <OthersOrderForm
          serviceType={customOrderBrand.type}
          establishmentName={customOrderBrand.name === 'Others' ? '' : customOrderBrand.name}
          canEditEstablishment={customOrderBrand.name === 'Others'}
          allowPickup={customOrderBrand.type === 'item' && customOrderBrand.name === 'Others'}
          onCancel={() => setCustomOrderBrand(null)}
          onAddToCart={(order) => {
            const establishment = order.establishment || customOrderBrand.name;
            addToCart({
              id: `custom-${Date.now()}`,
              source: establishment,
              name: `Custom order (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
              quantity: 1,
              details: order
            });
            setCustomOrderBrand(null);
          }}
          onSubmit={(order) => {
            const establishment = order.establishment || customOrderBrand.name;
            placeOrder({
              source: establishment,
              label: `${establishment} custom order`,
              items: order.items,
              details: order,
              section: customOrderBrand.type,
              deliveryLocation: order.deliveryLocation,
              customerType: order.customerType
            });
            setCustomOrderBrand(null);
          }}
        />
      )}

      {paymentBrand && (
        <PayBillsForm
          establishmentName={paymentBrand.name === 'Others' ? '' : paymentBrand.name}
          canEditEstablishment={paymentBrand.name === 'Others'}
          onCancel={() => setPaymentBrand(null)}
          onSubmit={(payment) => {
            placeOrder({
              source: paymentBrand.name,
              label: `${paymentBrand.name} bill payment`,
              section: 'bills',
              deliveryLocation: payment.deliveryLocation,
              customerType: payment.customerType,
              details: {
                establishment: payment.establishment,
                billReceiptName: payment.billReceipt?.name,
                billReceiptUrl: payment.billReceiptUrl,
                billReceiptType: payment.billReceipt?.type,
                transferProofName: payment.transferProof?.name,
                transferProofUrl: payment.transferProofUrl,
                transferProofType: payment.transferProof?.type,
                paymentStatus: 'pending'
              }
            });
            setPaymentBrand(null);
          }}
        />
      )}

      <Footer />
    </div>
  );
};

export default Home;
