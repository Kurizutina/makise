import React from 'react';
import { catalogImageUrl } from '../../../utils/catalog';
import './BestSellersSection.css';

const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2
}).format(Number(amount) || 0);

// Guest-visible section on the home page, below the brand grid - the same
// "what's popular right now" pattern foodpanda/GrabFood use, just placed
// after broad category browsing rather than before it (see Home.jsx's own
// comment on that ordering). Backed by GET /api/catalog/best-sellers
// (CatalogController::bestSellers), which ranks products by real units sold
// in the last 30 days, not an editorial pick. Renders nothing if there's no
// order history yet (a fresh install) rather than showing an empty section.
//
// The "X sold this month" chip below uses the endpoint's real `unitsSold`
// count - deliberately not a star rating or a discount badge (the pizzarosix
// reference's "35% Off"/4.9-star treatment) since this system has no rating
// or promotion data to back either one; a real sold-count is the honest
// equivalent of that social-proof signal.
const BestSellersSection = ({ products, onProductSelect }) => {
  if (!products?.length) return null;

  return (
    <section className="best-sellers-section">
      <div className="food-items-header">
        <h2>Best sellers this month</h2>
      </div>
      <div className="best-sellers-grid">
        {products.map((product) => (
          <button
            type="button"
            className="best-seller-card"
            key={product.ProductID}
            onClick={() => onProductSelect(product)}
          >
            <div className="best-seller-image">
              {product.unitsSold > 0 && (
                <span className="best-seller-sold-badge">{product.unitsSold} sold</span>
              )}
              {catalogImageUrl(product.ImagePath)
                ? <img src={catalogImageUrl(product.ImagePath)} alt={product.ProductName} loading="lazy" />
                : <span className="best-seller-image-placeholder">{product.BrandName?.[0] || '?'}</span>}
            </div>
            <div className="best-seller-body">
              <span className="best-seller-brand">{product.BrandName}</span>
              <strong className="best-seller-name">{product.ProductName}</strong>
              <span className="best-seller-price">{formatCurrency(product.ProductPrice)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default BestSellersSection;
