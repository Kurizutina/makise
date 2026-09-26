import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaUtensils } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import { calculateDeliveryFee, findDeliveryLocation } from '../../utils/deliveryRates';
import { getSessionUser } from '../../utils/session';
import LocationPicker from '../../components/home/Header/LocationPicker/LocationPicker';
import './JollibeeMenu.css';

const formatPrice = (price) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
}).format(price);

const CategoryNavigation = ({ activeCategory, categories, onSelect, restaurantName, variant }) => {
  // Desktop-only: the chip row scrolls horizontally (overflow-x: auto), but
  // nothing kept the active chip inside that visible strip as the page
  // scrolled - on a brand with enough categories to overflow it (most of
  // them), the highlighted chip could scroll out of the strip entirely,
  // which reads as "the bar isn't following along." Mobile's row is short
  // enough in practice and wasn't reported broken, so this only runs for
  // the desktop variant to avoid touching mobile's existing behavior.
  const activeButtonRef = useRef(null);
  useEffect(() => {
    if (variant !== 'desktop') return;
    activeButtonRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeCategory, variant]);

  return (
    <nav className={`jollibee-category-nav jollibee-category-nav--${variant}`} aria-label={`${restaurantName} menu categories`}>
      {categories.map(({ category }) => (
        <button
          key={category}
          ref={activeCategory === category ? activeButtonRef : null}
          type="button"
          className={activeCategory === category ? 'active' : ''}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </nav>
  );
};

const RestaurantProductCard = ({ product, onAddToCart, showFoodIcons }) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [imageSrc, setImageSrc] = useState(product.image || product.fallbackImage || null);
  const [usingFallbackImage, setUsingFallbackImage] = useState(!product.image && Boolean(product.fallbackImage));
  useEffect(() => {
    setImageSrc(product.image || product.fallbackImage || null);
    setUsingFallbackImage(!product.image && Boolean(product.fallbackImage));
  }, [product.image, product.fallbackImage]);

  const handleImageError = () => {
    if (product.fallbackImage && imageSrc !== product.fallbackImage) {
      setImageSrc(product.fallbackImage);
      setUsingFallbackImage(true);
      return;
    }
    setImageSrc(null);
  };
  const variant = product.variants?.[variantIndex];
  const selectedProduct = variant ? {
    ...product,
    id: `${product.id}-size-${variantIndex}`,
    name: `${product.name} — ${variant.label}`,
    price: variant.price,
    servingSize: variant.label
  } : product;

  return (
    <article className="jollibee-product-card" id={product.productId ? `product-card-${product.productId}` : undefined}>
      {imageSrc && <div className={`jollibee-product-image${usingFallbackImage ? ' brand-logo' : ''}`}><img src={imageSrc} alt={usingFallbackImage ? `${product.brandName || 'Brand'} logo` : product.name} loading="lazy" onError={handleImageError} /></div>}
      {showFoodIcons && !imageSrc && (
        <div className="restaurant-product-food-icon" aria-hidden="true">
          <FaUtensils />
        </div>
      )}
      <div className="jollibee-product-body">
        <h3>{product.name}</h3>
        {product.description && <p className="jollibee-product-description">{product.description}</p>}
        {product.variants && (
          <label className="restaurant-serving-size">
            <span>Serving size</span>
            <select aria-label={`Serving size for ${product.name}`} value={variantIndex} onChange={(event) => setVariantIndex(Number(event.target.value))}>
              {product.variants.map((option, index) => <option key={option.label} value={index}>{option.label} — {formatPrice(option.price)}</option>)}
            </select>
          </label>
        )}
        <strong className="restaurant-product-price">{formatPrice(selectedProduct.price)}</strong>
        <div className="jollibee-product-actions">
          <button type="button" className="product-cart-button" onClick={() => onAddToCart(selectedProduct)}>
            <i className="fa-solid fa-cart-plus" aria-hidden="true" /> Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
};

const similarBrandCards = [
  { name: 'Jollibee', image: '/images/jollibee_logo.jpg' },
  { name: "McDonald's", image: "/images/mcdonald's_logo.png" },
  { name: 'Mang Inasal', image: '/images/mang_inasal_logo.png' },
  { name: "Manuela's", image: '/images/maluelas_logo.jpg' }
];

// Intentionally presentational: these cards introduce the discovery pattern
// without adding routes, click handlers, or changing the existing menu flow.
const SimilarBrands = ({ sourceKey }) => {
  const brands = similarBrandCards.filter((brand) => brand.name !== sourceKey).slice(0, 3);
  if (!brands.length) return null;

  return (
    <section className="similar-brands" aria-labelledby="similar-brands-heading">
      <div className="similar-brands-heading">
        <div>
          <span>Keep exploring</span>
          <h2 id="similar-brands-heading">More food to discover</h2>
        </div>
        <p>Popular choices available through Otu-Zan.</p>
      </div>
      <div className="similar-brands-grid">
        {brands.map((brand) => (
          <article className="similar-brand-card" key={brand.name}>
            <img src={brand.image} alt="" />
            <strong>{brand.name}</strong>
            <span>Food delivery</span>
          </article>
        ))}
      </div>
    </section>
  );
};

export const RestaurantMenu = ({
  restaurantName,
  sourceKey,
  manifestUrl,
  menuItems,
  serviceType = 'food',
  showFoodIcons = false,
  pageClass = '',
  headerClass = '',
  eyebrowClass = '',
  highlightProductId = null
}) => {
  const navigate = useNavigate();
  const {
    cart: sharedCart,
    addToCart: addSharedCartItem,
    updateCartQuantity,
    placeCartOrder,
    deliveryLocation
  } = useCustomerActivity();
  const [products, setProducts] = useState(menuItems || []);
  const cart = sharedCart.filter((item) => item.source === sourceKey);
  const [customName, setCustomName] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(!menuItems);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const customerType = getSessionUser()?.userType || 'non_student';

  // Menu pages are one long scroll through every category (GrabFood has the
  // same structure and the same usability gap per the research in TODO.md) -
  // this is the only way back up besides manually scrolling.
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (menuItems) {
      setProducts(menuItems);
      setIsLoading(false);
      return;
    }
    fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load the ${restaurantName} menu.`);
        return response.json();
      })
      .then((items) => setProducts(items.map((item, index) => ({
        ...item,
        id: `mcdo-${index}`,
        name: item.name.replace(/\s+/g, ' ').trim(),
        image: encodeURI(item.image)
      }))))
      .catch(() => setNotice('The menu could not be loaded. Please try again.'))
      .finally(() => setIsLoading(false));
  }, [manifestUrl, restaurantName, menuItems]);

  const categories = useMemo(() => products.reduce((groups, product) => {
    const existing = groups.find((group) => group.category === product.category);
    if (existing) existing.products.push(product);
    else groups.push({ category: product.category, products: [product] });
    return groups;
  }, []), [products]);

  // Real brands run well past a hundred products (measured: Jollibee 121,
  // McDonald's 184, Manuela's 185) - mounting every <img> in a category at
  // once left most of them still loading many seconds in, even with
  // loading="lazy" (audit finding, 9/23). Each category starts collapsed to
  // a page and reveals more on demand instead.
  const PRODUCTS_PAGE_SIZE = 12;
  const [visibleCounts, setVisibleCounts] = useState({});
  const showMore = (category) => setVisibleCounts((current) => ({
    ...current,
    [category]: (current[category] ?? PRODUCTS_PAGE_SIZE) + PRODUCTS_PAGE_SIZE
  }));

  // Arriving here from a "Best seller" card on the home page used to just
  // drop the customer at the top of the whole menu - on a 184-product,
  // 13-category page (and worse now that categories paginate) that's not
  // actually "showing them the food," it's making them go find it. Expands
  // whichever category the target product is in past its initial page if
  // needed, then scrolls straight to that card and highlights it briefly.
  const highlightedOnceRef = useRef(false);
  useEffect(() => {
    if (!highlightProductId || highlightedOnceRef.current || !categories.length) return;
    let targetCategory = null;
    let targetIndex = -1;
    categories.forEach((group) => {
      const index = group.products.findIndex((product) => product.productId === highlightProductId);
      if (index !== -1) { targetCategory = group.category; targetIndex = index; }
    });
    if (!targetCategory) return;

    highlightedOnceRef.current = true;
    setVisibleCounts((current) => {
      const needed = targetIndex + 1;
      if ((current[targetCategory] ?? PRODUCTS_PAGE_SIZE) >= needed) return current;
      return { ...current, [targetCategory]: needed };
    });

    let attempts = 0;
    const tryScrollToCard = () => {
      const element = document.getElementById(`product-card-${highlightProductId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('product-card-highlighted');
        window.setTimeout(() => element.classList.remove('product-card-highlighted'), 2500);
      } else if (attempts < 20) {
        attempts += 1;
        window.requestAnimationFrame(tryScrollToCard);
      }
    };
    window.requestAnimationFrame(tryScrollToCard);
  }, [categories, highlightProductId]);

  // Sticky category chips only earn their place once there's actually
  // somewhere meaningful to jump to - skip them for the one/two-category
  // brands (research note in TODO.md).
  const showCategoryNav = categories.length > 2;
  const categorySectionRefs = useRef({});
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    if (categories.length && !categories.some((group) => group.category === activeCategory)) {
      setActiveCategory(categories[0].category);
    }
  }, [categories, activeCategory]);

  // Found live (9/24): the previous IntersectionObserver band (a narrow
  // ~90px slice computed from a guessed, hardcoded rootMargin) left the
  // active chip stuck on a stale category whenever nothing happened to
  // intersect that slice - most visibly at the very top of the page, where
  // the intro/heading content pushes the first category section below the
  // band, so scrolling to the top left whichever category was active
  // *before* stuck highlighted instead of resetting to the first one.
  //
  // Replaced with a direct reference-line check instead: the active
  // category is whichever section's top has scrolled up to (or past) the
  // real, live-measured bottom edge of the sticky header+nav - the last one
  // that's "been reached," which is correct at the very top (nothing's
  // been reached yet, so it stays on the first category), the very bottom
  // (the last category, since its top eventually scrolls past the line
  // too), and everywhere in between. Measuring the sticky elements' actual
  // rendered height (rather than a guessed constant) also means this stays
  // correct if the mobile/desktop nav variants ever end up different
  // heights.
  useEffect(() => {
    if (!showCategoryNav) return undefined;
    let ticking = false;

    const getReferenceY = () => {
      const header = document.querySelector('.jollibee-page-header');
      const visibleNav = [...document.querySelectorAll('.jollibee-category-nav')]
        .find((element) => getComputedStyle(element).display !== 'none');
      return visibleNav?.getBoundingClientRect().bottom
        ?? header?.getBoundingClientRect().bottom
        ?? 0;
    };

    const updateActiveCategory = () => {
      ticking = false;
      // +20px tolerance: browsers' own "sticky-aware" scrollIntoView (used
      // by clicking a chip, below) doesn't land pixel-exact against the
      // sticky elements' measured height - observed landing a handful of
      // pixels short, which without slack flipped the active chip back to
      // the previous category the instant the smooth scroll settled.
      const referenceY = getReferenceY() + 20;
      let current = categories[0]?.category;
      categories.forEach((group) => {
        const element = categorySectionRefs.current[group.category];
        if (element && element.getBoundingClientRect().top <= referenceY) current = group.category;
      });
      setActiveCategory(current);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveCategory);
    };

    updateActiveCategory();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [categories, showCategoryNav]);

  const scrollToCategory = (category) => {
    categorySectionRefs.current[category]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCategory(category);
  };

  const itemCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((total, item) => total + (item.price || 0) * item.quantity, 0),
    [cart]
  );

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const addToCart = (product, quantity = 1) => {
    addSharedCartItem({ ...product, source: sourceKey, quantity, details: { ...product.details, serviceType } });
    showNotice(`${product.name} added to cart.`);
  };

  const updateQuantity = (id, amount) => {
    const item = cart.find((entry) => entry.id === id);
    if (item) updateCartQuantity(item.cartId, amount);
  };

  const addCustomItem = (event) => {
    event.preventDefault();
    const item = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      image: null,
      custom: true
    };
    addToCart(item, customQuantity);
    setCustomName('');
    setCustomQuantity(1);
    setShowCustomItem(false);
  };

  const checkoutCart = () => {
    if (!cart.length) return;
    if (!deliveryLocation) {
      showNotice('Select your delivery location before placing your order.');
      return;
    }
    if (!getSessionUser()) {
      navigate('/login');
      return;
    }
    const order = placeCartOrder(sourceKey, deliveryLocation, customerType);
    if (!order) return;
    showNotice(`Order placed with ${itemCount} item${itemCount === 1 ? '' : 's'}.`);
    setIsCartOpen(false);
  };

  const selectedLocation = findDeliveryLocation(deliveryLocation);
  const deliveryFee = customerType
    ? calculateDeliveryFee(selectedLocation, customerType)
    : { serviceFee: selectedLocation?.fee || 0, surchargeApplied: false };

  return (
    <main className={`jollibee-page ${pageClass}`}>
      <header className={`jollibee-page-header ${headerClass}`}>
        <button type="button" className="jollibee-back" onClick={() => navigate('/home')}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back
        </button>
        <div>
          <span>{serviceType === 'food' ? 'Food Delivery' : 'Item Delivery'}</span>
          <h1>{restaurantName} Menu</h1>
        </div>
        <button type="button" className="jollibee-cart-link" onClick={() => setIsCartOpen(true)}>
          <i className="fa-solid fa-cart-shopping" aria-hidden="true" />
          Cart <strong>{itemCount}</strong>
        </button>
      </header>

      {showCategoryNav && (
        <CategoryNavigation
          activeCategory={activeCategory}
          categories={categories}
          onSelect={scrollToCategory}
          restaurantName={restaurantName}
          variant="mobile"
        />
      )}

      {notice && <div className="jollibee-notice" role="status">{notice}</div>}

      {/* Mobile only (see @media rules in JollibeeMenu.css): the embedded cart
          panel is hidden by default below the phone breakpoint so the menu is
          the first thing a customer sees, matching how Grab/Foodpanda/UberEats
          surface it. This bar is the entry point once there's something to
          check out - the header button above works too, this is just a more
          prominent reminder once the cart isn't empty. */}
      {cart.length > 0 && !isCartOpen && (
        <button type="button" className="jollibee-mobile-cart-bar" onClick={() => setIsCartOpen(true)}>
          <span><i className="fa-solid fa-cart-shopping" aria-hidden="true" /> {itemCount} item{itemCount === 1 ? '' : 's'}</span>
          <span>View Cart · {formatPrice(cartSubtotal)}</span>
        </button>
      )}

      {isCartOpen && <div className="jollibee-cart-backdrop" onClick={() => setIsCartOpen(false)} aria-hidden="true" />}

      <div className="jollibee-layout">
        <div className="jollibee-menu-content">
          {showCategoryNav && (
            <CategoryNavigation
              activeCategory={activeCategory}
              categories={categories}
              onSelect={scrollToCategory}
              restaurantName={restaurantName}
              variant="desktop"
            />
          )}

          <section className="jollibee-intro">
            <div>
              <p className={`jollibee-eyebrow ${eyebrowClass}`}>Choose your favorites</p>
              <h2>What are you craving today?</h2>
              <p>Browse the complete {restaurantName} menu by category or request something not listed.</p>
            </div>
            <button type="button" onClick={() => setShowCustomItem((current) => !current)}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Add an item not on the menu
            </button>
          </section>

          {showCustomItem && (
            <form className="jollibee-custom-item" onSubmit={addCustomItem}>
              <div><h3>Request another item</h3><p>Enter its name and quantity, then add it to your cart.</p></div>
              <label>
                <span>Item name</span>
                <input autoFocus required value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Enter custom item" />
              </label>
              <label className="custom-quantity-field">
                <span>Quantity</span>
                <input required type="number" min="1" max="99" value={customQuantity} onChange={(event) => setCustomQuantity(Math.max(1, Number(event.target.value)))} />
              </label>
              <button type="submit">Add to Cart</button>
            </form>
          )}

          {isLoading && <div className="restaurant-menu-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading menu…</div>}

          {categories.map(({ category, products: categoryProducts }) => {
            const visibleCount = visibleCounts[category] ?? PRODUCTS_PAGE_SIZE;
            const visibleProducts = categoryProducts.slice(0, visibleCount);
            const remaining = categoryProducts.length - visibleProducts.length;
            return (
              <section
                className="jollibee-category"
                key={category}
                id={`category-${sourceKey}-${category}`}
                data-category={category}
                ref={(element) => { categorySectionRefs.current[category] = element; }}
              >
                <div className="jollibee-category-heading">
                  <h2>{category}</h2><span>{categoryProducts.length} items</span>
                </div>
                <div className="jollibee-product-grid">
                  {visibleProducts.map((product) => (
                    <RestaurantProductCard key={product.id} product={product} onAddToCart={addToCart} showFoodIcons={showFoodIcons} />
                  ))}
                </div>
                {remaining > 0 && (
                  <button type="button" className="restaurant-show-more" onClick={() => showMore(category)}>
                    Show {Math.min(remaining, PRODUCTS_PAGE_SIZE)} more of {remaining} remaining
                  </button>
                )}
              </section>
            );
          })}
          {!isLoading && !categories.length && <p className="restaurant-menu-loading">No products available yet. You can request an item above.</p>}
        </div>

        <aside className={`jollibee-cart-panel${isCartOpen ? ' is-open' : ''}`} id="mcdo-cart">
          <div className="jollibee-cart-heading">
            <div><span>Your order</span><h2>Shopping Cart</h2></div>
            <strong>{itemCount}</strong>
            <button type="button" className="jollibee-cart-close" onClick={() => setIsCartOpen(false)} aria-label="Close cart">×</button>
          </div>
          {!cart.length ? (
            <div className="jollibee-empty-cart">
              <i className="fa-solid fa-basket-shopping" aria-hidden="true" />
              <p>Your cart is empty.</p><span>Add something delicious from the menu.</span>
            </div>
          ) : (
            <div className="jollibee-cart-items">
              {cart.map((item) => (
                <div className="jollibee-cart-item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    {item.custom
                      ? <span>Price to be confirmed</span>
                      : <span>{formatPrice(item.price * item.quantity)}</span>}
                  </div>
                  <div className="jollibee-cart-quantity">
                    <button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label={`Decrease ${item.name} quantity`}>−</button>
                    <output>{item.quantity}</output>
                    <button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label={`Increase ${item.name} quantity`}>＋</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {cart.length > 0 && (
            <div className="restaurant-cart-total">
              <span>Menu subtotal</span>
              <strong>{formatPrice(cartSubtotal)}</strong>
            </div>
          )}
          {selectedLocation && <div className="restaurant-cart-service-fee"><span>Service fee{deliveryFee.surchargeApplied ? ' (includes night surcharge)' : ''}</span><strong>{formatPrice(deliveryFee.serviceFee)}</strong></div>}
          <div className="restaurant-delivery-location">
            <span>Delivery location</span>
            <LocationPicker variant="inline" />
          </div>
          <button type="button" className="jollibee-checkout" disabled={!cart.length} onClick={checkoutCart}>Place Order {itemCount > 0 && `(${itemCount})`}</button>
        </aside>
      </div>

      <SimilarBrands sourceKey={sourceKey} />

      {showBackToTop && (
        <button
          type="button"
          className="jollibee-back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          <i className="fa-solid fa-arrow-up" aria-hidden="true" />
        </button>
      )}
    </main>
  );
};

const McDonaldsMenu = () => (
  <RestaurantMenu
    restaurantName="McDonald’s"
    sourceKey="McDonald's"
    manifestUrl="/images/Mcdo%20(Mega%20Meal)/menu-manifest.json"
    pageClass="mcdo-page"
    headerClass="mcdo-page-header"
    eyebrowClass="mcdo-eyebrow"
  />
);

export default McDonaldsMenu;
