import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RestaurantMenu } from './McDonaldsMenu';
import { API_BASE_URL, catalogImageUrl } from '../../utils/catalog';

const CatalogBrandMenu = () => {
  const { brandId } = useParams();
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null);
    setError('');
    fetch(`${API_BASE_URL}/api/catalog/brands/${brandId}/products`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('This brand is no longer available.');
        return response.json();
      })
      .then((data) => setCatalog(data))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [brandId]);

  if (error) return <main className="jollibee-page"><p role="alert">{error}</p><a href="/home">Back to Home</a></main>;
  if (!catalog) return <main className="jollibee-page" role="status">Loading products...</main>;

  const brandLogo = catalog.brand.BrandName === "Manuela's"
    ? catalogImageUrl(catalog.brand.ImagePath)
    : null;
  const products = catalog.products.map((product) => ({
    id: `catalog-${product.ProductID}`,
    name: product.ProductName,
    price: Number(product.ProductPrice),
    image: catalogImageUrl(product.ImagePath) || brandLogo,
    category: product.Description || 'Products'
  }));
  return <RestaurantMenu
    restaurantName={catalog.brand.BrandName}
    sourceKey={catalog.brand.BrandName}
    serviceType={catalog.brand.service?.ServiceType || 'item'}
    menuItems={products}
    showFoodIcons
  />;
};

export default CatalogBrandMenu;
