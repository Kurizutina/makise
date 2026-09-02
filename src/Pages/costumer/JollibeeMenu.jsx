import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jollibeeMenu } from '../../components/home/JollibeeMenu/jollibeeMenuData';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import './JollibeeMenu.css';

const JollibeeMenu = () => {
  const navigate = useNavigate();
  const {
    cart: sharedCart,
    addToCart: addSharedCartItem,
    updateCartQuantity,
    placeOrder,
    placeCartOrder
  } = useCustomerActivity();
  const cart = sharedCart.filter((item) => item.source === 'Jollibee');
  const [customName, setCustomName] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});

  const itemCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const getConfiguredProduct = (product) => {
    if (!product.options) return product;

    const selectedOption = selectedOptions[product.id] || product.options[0];
    return {
      ...product,
      id: `${product.id}-${selectedOption}`,
      selectedOption
    };
  };

  const addToCart = (product, quantity = 1) => {
    const configuredProduct = getConfiguredProduct(product);
    addSharedCartItem({ ...configuredProduct, source: 'Jollibee', quantity });
    showNotice(`${configuredProduct.name}${configuredProduct.selectedOption ? ` (${configuredProduct.selectedOption})` : ''} added to cart.`);
  };

  const updateQuantity = (id, amount) => {
    const item = cart.find((entry) => entry.id === id);
    if (item) updateCartQuantity(item.cartId, amount);
  };

  const placeProductOrder = (product) => {
    const configuredProduct = getConfiguredProduct(product);
    showNotice(`Order placed for ${configuredProduct.name}${configuredProduct.selectedOption ? ` (${configuredProduct.selectedOption})` : ''}.`);
    placeOrder({ source: 'Jollibee', label: configuredProduct.name, items: [{ ...configuredProduct, quantity: 1 }] });
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
    placeCartOrder('Jollibee');
    showNotice(`Order placed with ${itemCount} item${itemCount === 1 ? '' : 's'}.`);
  };

  return (
    <main className="jollibee-page">
      <header className="jollibee-page-header">
        <button type="button" className="jollibee-back" onClick={() => navigate('/home')}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Back
        </button>
        <div>
          <span>Food Delivery</span>
          <h1>Jollibee Menu</h1>
        </div>
        <button type="button" className="jollibee-cart-link" onClick={() => document.getElementById('jollibee-cart')?.scrollIntoView({ behavior: 'smooth' })}>
          <i className="fa-solid fa-cart-shopping" aria-hidden="true" />
          Cart <strong>{itemCount}</strong>
        </button>
      </header>

      {notice && <div className="jollibee-notice" role="status">{notice}</div>}

      <div className="jollibee-layout">
        <div className="jollibee-menu-content">
          <section className="jollibee-intro">
            <div>
              <p className="jollibee-eyebrow">Choose your favorites</p>
              <h2>What are you craving today?</h2>
              <p>Browse the menu by category, add items to your cart, or place an order right away.</p>
            </div>
            <button type="button" onClick={() => setShowCustomItem((current) => !current)}>
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Add an item not on the menu
            </button>
          </section>

          {showCustomItem && (
            <form className="jollibee-custom-item" onSubmit={addCustomItem}>
              <div>
                <h3>Request another item</h3>
                <p>Enter its name and quantity, then add it to your cart.</p>
              </div>
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

          {jollibeeMenu.map(({ category, products }) => (
            <section className="jollibee-category" key={category}>
              <div className="jollibee-category-heading">
                <h2>{category}</h2>
                <span>{products.length} items</span>
              </div>
              <div className="jollibee-product-grid">
                {products.map((product) => (
                  <article className="jollibee-product-card" key={product.id}>
                    <div className="jollibee-product-image">
                      <img src={product.image} alt={product.name} loading="lazy" />
                    </div>
                    <div className="jollibee-product-body">
                      <h3>{product.name}</h3>
                      {product.options && (
                        <label className="jollibee-product-option">
                          <span>{product.name === 'Fries' ? 'Choose size' : 'Choose quantity'}</span>
                          <select
                            value={selectedOptions[product.id] || product.options[0]}
                            onChange={(event) => setSelectedOptions((current) => ({
                              ...current,
                              [product.id]: event.target.value
                            }))}
                          >
                            {product.options.map((option) => <option key={option}>{option}</option>)}
                          </select>
                        </label>
                      )}
                      <div className="jollibee-product-actions">
                        <button type="button" className="product-cart-button" onClick={() => addToCart(product)}>
                          <i className="fa-solid fa-cart-plus" aria-hidden="true" /> Add to Cart
                        </button>
                        <button type="button" className="product-order-button" onClick={() => placeProductOrder(product)}>Place Order</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="jollibee-cart-panel" id="jollibee-cart">
          <div className="jollibee-cart-heading">
            <div>
              <span>Your order</span>
              <h2>Shopping Cart</h2>
            </div>
            <strong>{itemCount}</strong>
          </div>

          {!cart.length ? (
            <div className="jollibee-empty-cart">
              <i className="fa-solid fa-basket-shopping" aria-hidden="true" />
              <p>Your cart is empty.</p>
              <span>Add something delicious from the menu.</span>
            </div>
          ) : (
            <div className="jollibee-cart-items">
              {cart.map((item) => (
                <div className="jollibee-cart-item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    {item.selectedOption && <span>{item.selectedOption}</span>}
                    {item.custom && <span>Custom request</span>}
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

          <button type="button" className="jollibee-checkout" disabled={!cart.length} onClick={checkoutCart}>
            Place Order {itemCount > 0 && `(${itemCount})`}
          </button>
        </aside>
      </div>
    </main>
  );
};

export default JollibeeMenu;
