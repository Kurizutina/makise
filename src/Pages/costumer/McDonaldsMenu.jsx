import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaUtensils } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import { calculateDeliveryFee, DELIVERY_LOCATIONS, findDeliveryLocation } from '../../utils/deliveryRates';
import { getSessionUser } from '../../utils/session';
import './JollibeeMenu.css';

const formatPrice = (price) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
}).format(price);

const RestaurantProductCard = ({ product, onAddToCart, showFoodIcons }) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const variant = product.variants?.[variantIndex];
  const selectedProduct = variant ? {
    ...product,
    id: `${product.id}-size-${variantIndex}`,
    name: `${product.name} — ${variant.label}`,
    price: variant.price,
    servingSize: variant.label
  } : product;

  return (
    <article className="jollibee-product-card">
      {product.image && <div className="jollibee-product-image"><img src={product.image} alt={product.name} loading="lazy" /></div>}
      {showFoodIcons && !product.image && (
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

export const RestaurantMenu = ({
  restaurantName,
  sourceKey,
  manifestUrl,
  menuItems,
  serviceType = 'food',
  showFoodIcons = false,
  pageClass = '',
  headerClass = '',
  eyebrowClass = ''
}) => {
  const navigate = useNavigate();
  const {
    cart: sharedCart,
    addToCart: addSharedCartItem,
    updateCartQuantity,
    placeCartOrder
  } = useCustomerActivity();
  const [products, setProducts] = useState(menuItems || []);
  const cart = sharedCart.filter((item) => item.source === sourceKey);
  const [customName, setCustomName] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(!menuItems);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const customerType = getSessionUser()?.userType || 'non_student';

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

  useEffect(() => {
    if (!showCategoryNav) return undefined;
    // Treats a category as "current" once it's scrolled into the band just
    // below the sticky header+chip row, not only once it's fully in view -
    // rootMargin shrinks the observed viewport to roughly that top band.
    const observer = new IntersectionObserver((entries) => {
      const topMost = entries
        .filter((entry) => entry.isIntersecting)
        .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];
      if (topMost) setActiveCategory(topMost.target.dataset.category);
    }, { rootMargin: '-140px 0px -70% 0px' });
    Object.values(categorySectionRefs.current).forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
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
        <nav className="jollibee-category-nav" aria-label={`${restaurantName} menu categories`}>
          {categories.map(({ category }) => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? 'active' : ''}
              onClick={() => scrollToCategory(category)}
            >
              {category}
            </button>
          ))}
        </nav>
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

          {categories.map(({ category, products: categoryProducts }) => (
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
                {categoryProducts.map((product) => (
                  <RestaurantProductCard key={product.id} product={product} onAddToCart={addToCart} showFoodIcons={showFoodIcons} />
                ))}
              </div>
            </section>
          ))}
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
          <label className="restaurant-delivery-location">
            <span>Delivery location</span>
            <select value={deliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)}>
              <option value="">Select your location</option>
              {DELIVERY_LOCATIONS.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
            </select>
          </label>
          <button type="button" className="jollibee-checkout" disabled={!cart.length} onClick={checkoutCart}>Place Order {itemCount > 0 && `(${itemCount})`}</button>
        </aside>
      </div>
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
