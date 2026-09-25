import React, { useEffect, useState } from 'react';
import { catalogImageUrl } from '../../../utils/catalog';
import './BestSellersSection.css';

const cardsForViewport = () => window.innerWidth < 560 ? 1 : window.innerWidth < 860 ? 2 : 3;
const formatPrice = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount) || 0);

const BestSellersSection = ({ products, onProductSelect }) => {
  const [cards, setCards] = useState(cardsForViewport);
  const [page, setPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pages = Math.max(1, Math.ceil((products?.length || 0) / cards));

  useEffect(() => {
    const resize = () => setCards(cardsForViewport());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => setPage((current) => Math.min(current, pages - 1)), [pages]);

  useEffect(() => {
    if (pages < 2 || isPaused) return undefined;
    const timer = window.setInterval(() => setPage((current) => (current + 1) % pages), 2000);
    return () => window.clearInterval(timer);
  }, [isPaused, pages]);

  if (!products?.length) return null;
  const shown = products.slice(page * cards, page * cards + cards);
  const changePage = (amount) => setPage((current) => (current + amount + pages) % pages);

  return <section className="best-sellers-section" aria-labelledby="best-sellers-title">
    <header className="best-sellers-heading">
      <h2 id="best-sellers-title">Our Best Sellers</h2>
      <p>Customer favorites, made easy to order.</p>
    </header>
    <div className="best-sellers-carousel" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} onFocus={() => setIsPaused(true)} onBlur={() => setIsPaused(false)}>
      <button className="best-sellers-arrow" type="button" onClick={() => changePage(-1)} aria-label="Show previous best sellers"><i className="fa-solid fa-arrow-left" aria-hidden="true" /></button>
      <div className="best-sellers-track" aria-live="polite">
        {shown.map((product) => {
          const productImage = catalogImageUrl(product.ImagePath);
          const brandLogo = catalogImageUrl(product.BrandImagePath);
          const image = productImage || brandLogo;
          return <button type="button" className="best-seller-card" key={product.ProductID} onClick={() => onProductSelect(product)}>
          <div className={`best-seller-image${!productImage && brandLogo ? ' brand-logo' : ''}`}>{image ? <img src={image} alt={productImage ? product.ProductName : `${product.BrandName} logo`} /> : <span>{product.BrandName?.[0] || '?'}</span>}</div>
          <div className="best-seller-body"><h3>{product.ProductName}</h3><p>{product.BrandName}</p><strong className="best-seller-price">{formatPrice(product.ProductPrice)}</strong><span className="best-seller-action"><i className="fa-solid fa-utensils" aria-hidden="true" /> View menu</span></div>
        </button>;
        })}
      </div>
      <button className="best-sellers-arrow" type="button" onClick={() => changePage(1)} aria-label="Show next best sellers"><i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
    </div>
    {pages > 1 && <div className="best-sellers-pagination" aria-label="Best seller pages">
      {Array.from({ length: pages }, (_, index) => <button key={index} className={index === page ? 'active' : ''} type="button" onClick={() => setPage(index)} aria-label={`Show best seller page ${index + 1}`} aria-current={index === page ? 'true' : undefined} />)}
    </div>}
  </section>;
};

export default BestSellersSection;
