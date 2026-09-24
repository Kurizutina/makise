import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/home/Header/Header';
import HomeHero from '../../components/home/HomeHero/HomeHero';
import Footer from '../../components/home/Footer/Footer';
import FoodandItemsSection from '../../components/home/FoodandItem/FoodandItemsSection/FoodandItemsSection';
import BestSellersSection from '../../components/home/BestSellers/BestSellersSection';
import OthersOrderForm from '../../components/home/OthersOrderForm/OthersOrderForm';
import PayBillsForm from '../../components/home/PayBillsForm/PayBillsForm';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import { catalogImageUrl, getCatalog, getBestSellers } from '../../utils/catalog';
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

  // Currently selected service
  const [selectedService, setSelectedService] = useState(null);
  const [services, setServices] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [reloadCatalog, setReloadCatalog] = useState(0);
  const [search, setSearch] = useState('');
  const [customOrderBrand, setCustomOrderBrand] = useState(null);
  const [paymentBrand, setPaymentBrand] = useState(null);
  const [bestSellers, setBestSellers] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    getBestSellers(controller.signal).then(setBestSellers).catch(() => {});
    return () => controller.abort();
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
    return () => { active = false; document.removeEventListener('visibilitychange', refreshWhenVisible); };
  }, [reloadCatalog]);

  const currentService = services.find((service) => service.ServiceID === selectedService);
  const getCurrentBrands = () => (currentService?.brands || [])
    .filter((brand) => brand.BrandName.toLowerCase().includes(search.trim().toLowerCase()))
    .map((brand) => ({
      id: brand.BrandID,
      name: brand.BrandName.startsWith('Others (') ? 'Others' : brand.BrandName,
      image: catalogImageUrl(brand.ImagePath),
      type: currentService.ServiceType,
      productsCount: brand.products_count
    }))
    .sort((first, second) => {
      if (first.name === 'Hongdae Chicken') return -1;
      if (second.name === 'Hongdae Chicken') return 1;
      return Number(first.name === 'Others') - Number(second.name === 'Others');
    });


  // Change section title depending on service
  const getSectionTitle = () => {

    return currentService?.ServiceName || 'Services';
  };


  return (
    <div className="home-page" id="home">

      {/* Header */}
      <Header
        selectedService={selectedService}
        onServiceChange={setSelectedService}
        services={services}
        onSearch={setSearch}
      />

      <HomeHero brandCount={services.reduce((total, service) => total + (service.brands?.length || 0), 0)} />

      {catalogLoading && <p role="status" className="home-catalog-error">Loading catalog...</p>}
      {catalogError && <p role="alert" className="home-catalog-error">{catalogError} <button type="button" onClick={() => setReloadCatalog((count) => count + 1)}>Retry</button></p>}

      {/* Brand Cards - id is the HomeHero CTA's scroll target */}
      <FoodandItemsSection
        id="home-brands"
        title={getSectionTitle()}
        brands={getCurrentBrands()}
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
      />

      {/* Below the brand grid, not above it - foodpanda and GrabFood both
          lead with broad category/cuisine navigation first and put curated
          picks (foodpanda's "daily deals") after it, not before (checked
          live, 9/23). Leading with specific products before the customer's
          picked a kind of food read as backwards next to those. */}
      <BestSellersSection
        products={bestSellers}
        onProductSelect={(product) => navigate(`/catalog/brands/${product.BrandID}`, {
          state: { highlightProductId: product.ProductID }
        })}
      />

      {customOrderBrand && (
        <OthersOrderForm
          serviceType={customOrderBrand.type}
          establishmentName={customOrderBrand.name === 'Others' ? '' : customOrderBrand.name}
          canEditEstablishment={customOrderBrand.name === 'Others'}
          allowPickup={customOrderBrand.type === 'item' && customOrderBrand.name === 'Others'}
          onCancel={() => setCustomOrderBrand(null)}
          onAddToCart={(order) => {
            addToCart({
              id: `custom-${Date.now()}`,
              source: customOrderBrand.name,
              name: `Custom order (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
              quantity: 1,
              details: order
            });
            setCustomOrderBrand(null);
          }}
          onSubmit={(order) => {
            placeOrder({
              source: customOrderBrand.name,
              label: `${customOrderBrand.name} custom order`,
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
