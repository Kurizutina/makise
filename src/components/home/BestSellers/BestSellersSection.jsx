import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { catalogImageUrl } from '../../../utils/catalog';
import './BestSellersSection.css';

const cardsForViewport = () => window.innerWidth < 560 ? 1 : window.innerWidth < 860 ? 2 : 3;
const formatPrice = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount) || 0);
const TRANSITION_MS = 420;

const Card = ({ product, width, onSelect }) => {
  const productImage = catalogImageUrl(product.ImagePath);
  const brandLogo = catalogImageUrl(product.BrandImagePath);
  const image = productImage || brandLogo;
  return <button type="button" className="best-seller-card" style={{ width }} onClick={() => onSelect(product)}>
    <div className={`best-seller-image${!productImage && brandLogo ? ' brand-logo' : ''}`}>{image ? <img src={image} alt={productImage ? product.ProductName : `${product.BrandName} logo`} /> : <span>{product.BrandName?.[0] || '?'}</span>}</div>
    <div className="best-seller-body"><h3>{product.ProductName}</h3><p>{product.BrandName}</p><strong className="best-seller-price">{formatPrice(product.ProductPrice)}</strong><span className="best-seller-action"><i className="fa-solid fa-utensils" aria-hidden="true" /> View menu</span></div>
  </button>;
};

// A true sliding-strip carousel (not a page-swap): the DOM never
// remounts on step - only `transform: translateX()` animates, so there's
// nothing to flash or fade. One extra card is kept mounted just off-screen
// on each side (a "buffer") so a step only ever has to slide the strip by
// exactly one card's width; once the transition finishes, the strip snaps
// back to its resting position with transitions off (imperceptible, since
// the settled frame and the reset frame are pixel-identical) and `page`
// advances - ready for the next step.
const BestSellersSection = ({ products, onProductSelect }) => {
  const [cards, setCards] = useState(cardsForViewport);
  const [page, setPage] = useState(0);
  const [step, setStep] = useState(0); // 0 = resting, 1/-1 = mid-transition
  const [transitioning, setTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [colWidth, setColWidth] = useState(0);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const timeoutRef = useRef(null);

  const count = products?.length || 0;
  // Needs at least one spare product on each side of the visible window
  // (see the buffer comment below) - below that, fall back to a static
  // display rather than risk two buffer slots resolving to the same
  // product (duplicate React keys).
  const loop = count > cards + 1;

  useEffect(() => {
    const resize = () => setCards(cardsForViewport());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => setPage((current) => count ? current % count : 0), [count]);

  useLayoutEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      if (!viewport || !cards) return;
      const gap = parseFloat(getComputedStyle(trackRef.current).columnGap || '0') || 0;
      setColWidth((viewport.clientWidth - gap * (cards - 1)) / cards);
    };
    measure();
    // JSDOM (react-scripts test) has no ResizeObserver - the [cards] resize
    // listener above already re-measures at each breakpoint, so this is a
    // finer-grained enhancement for real browsers, not required for
    // correctness.
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
    // `count` matters, not just `cards`: `products` arrives asynchronously,
    // so the viewport <div> doesn't exist on the first render (the early
    // `!count` return skips it) - without `count` here, the effect never
    // re-runs once the DOM actually mounts, and colWidth stays 0 forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, count]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const advance = (amount) => {
    if (transitioning || !loop) return;
    setTransitioning(true);
    setStep(amount);
    timeoutRef.current = window.setTimeout(() => {
      setPage((current) => (current + amount + count) % count);
      setStep(0);
      setTransitioning(false);
    }, TRANSITION_MS);
  };

  useEffect(() => {
    if (!loop || isPaused) return undefined;
    const timer = window.setInterval(() => advance(1), 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, loop, transitioning, page]);

  if (!count) return null;

  // Buffer window: one extra card before and after the visible set so a
  // step never has to reveal more than one card at a time. Falls back to
  // a plain, static slice when there's nothing to loop through.
  const gap = trackRef.current ? parseFloat(getComputedStyle(trackRef.current).columnGap || '0') || 0 : 0;
  const visible = loop
    ? Array.from({ length: cards + 2 }, (_, index) => products[(page - 1 + index + count * 2) % count])
    : products.slice(0, cards);
  const restingOffset = loop ? -(colWidth + gap) : 0;
  const trackOffset = restingOffset - (step * (colWidth + gap));

  return <section className="best-sellers-section" aria-labelledby="best-sellers-title">
    <header className="best-sellers-heading">
      <h2 id="best-sellers-title">Our Best Sellers</h2>
      <p>Customer favorites, made easy to order.</p>
    </header>
    <div className="best-sellers-carousel" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} onFocus={() => setIsPaused(true)} onBlur={() => setIsPaused(false)}>
      <button className="best-sellers-arrow" type="button" onClick={() => advance(-1)} aria-label="Show previous best sellers" disabled={!loop}><i className="fa-solid fa-arrow-left" aria-hidden="true" /></button>
      <div className="best-sellers-viewport" ref={viewportRef}>
        <div
          className="best-sellers-track"
          aria-live="polite"
          ref={trackRef}
          style={{
            transform: colWidth ? `translateX(${trackOffset}px)` : undefined,
            transition: transitioning ? `transform ${TRANSITION_MS}ms ease` : 'none'
          }}
        >
          {visible.map((product) => (
            <Card key={product.ProductID} product={product} width={colWidth ? `${colWidth}px` : undefined} onSelect={onProductSelect} />
          ))}
        </div>
      </div>
      <button className="best-sellers-arrow" type="button" onClick={() => advance(1)} aria-label="Show next best sellers" disabled={!loop}><i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
    </div>
    {loop && <div className="best-sellers-pagination" aria-label="Best seller pages">
      {Array.from({ length: count }, (_, index) => <button key={index} className={index === page ? 'active' : ''} type="button" onClick={() => !transitioning && setPage(index)} aria-label={`Show best seller page ${index + 1}`} aria-current={index === page ? 'true' : undefined} />)}
    </div>}
  </section>;
};

export default BestSellersSection;
