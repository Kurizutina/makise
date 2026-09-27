import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { RestaurantMenu } from './McDonaldsMenu';
import { CATALOG_CHANGED_EVENT, catalogImageUrl, getBrandProducts, invalidateCatalogCache } from '../../utils/catalog';

const CatalogBrandMenu = () => {
  const { brandId } = useParams();
  const location = useLocation();
  const highlightProductId = location.state?.highlightProductId ?? null;
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refresh = () => {
      invalidateCatalogCache();
      setRefreshKey((key) => key + 1);
    };
    const refreshFromAnotherTab = (event) => {
      if (event.key === 'otuzan:catalog-changed') refresh();
    };
    window.addEventListener(CATALOG_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refreshFromAnotherTab);
    return () => {
      window.removeEventListener(CATALOG_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refreshFromAnotherTab);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null);
    setError('');
    getBrandProducts(brandId, controller.signal)
      .then((data) => setCatalog(data))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [brandId, refreshKey]);

  // Was recomputed inline on every render, handing RestaurantMenu a new
  // array reference each time even though the data hadn't changed - its
  // internal effects (product sync, category refs, the scroll-tracking
  // added for the category-nav fix) all key off this array's identity, so
  // that churn caused them to keep tearing down and rebuilding. Confirmed
  // live: a category's section ref would end up null mid-rebuild, so
  // clicking its chip silently didn't scroll at all - the same root cause
  // behind the active category lagging behind the real scroll position.
  // Hooks can't sit after the early returns below, so this stays null-safe
  // and runs unconditionally, same as every other hook in this component.
  const products = useMemo(() => {
    if (!catalog) return [];
    const brandLogo = catalogImageUrl(catalog.brand.ImagePath);
    return catalog.products.map((product) => ({
      id: `catalog-${product.ProductID}`,
      productId: product.ProductID,
      name: product.ProductName,
      brandName: catalog.brand.BrandName,
      price: Number(product.ProductPrice),
      image: catalogImageUrl(product.ImagePath),
      fallbackImage: brandLogo,
      category: product.Description || 'Products'
    }));
  }, [catalog]);

  if (error) return <main className="jollibee-page"><p role="alert">{error}</p><a href="/home">Back to Home</a></main>;
  if (!catalog) return <main className="jollibee-page" role="status">Loading products...</main>;

  return <RestaurantMenu
    restaurantName={catalog.brand.BrandName}
    sourceKey={catalog.brand.BrandName}
    serviceType={catalog.brand.service?.ServiceType || 'item'}
    menuItems={products}
    showFoodIcons
    highlightProductId={highlightProductId}
  />;
};

export default CatalogBrandMenu;
