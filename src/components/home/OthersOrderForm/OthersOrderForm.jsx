import React, { useEffect, useState } from 'react';
import './OthersOrderForm.css';
import { getSessionUser } from '../../../utils/session';
import { useCustomerActivity } from '../../../context/CustomerActivityContext';
import LocationPicker from '../Header/LocationPicker/LocationPicker';
import { calculateDeliveryFee, findDeliveryLocation } from '../../../utils/deliveryRates';

const serviceNames = {
  food: 'Food Delivery',
  item: 'Item Delivery',
  bills: 'Pay Bills'
};

const createItem = () => ({ id: Date.now() + Math.random(), name: '', quantity: 1 });

const OthersOrderForm = ({
  serviceType,
  establishmentName = '',
  canEditEstablishment = false,
  allowPickup = false,
  onCancel,
  onAddToCart,
  onSubmit
}) => {
  const [establishment, setEstablishment] = useState(establishmentName);
  const [items, setItems] = useState([createItem()]);
  const [fulfillmentMethod, setFulfillmentMethod] = useState('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const { deliveryLocation } = useCustomerActivity();
  const [locationTouched, setLocationTouched] = useState(false);
  const customerType = getSessionUser()?.userType || 'non_student';
  const selectedLocation = findDeliveryLocation(deliveryLocation);
  const deliveryFee = calculateDeliveryFee(selectedLocation, customerType);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const updateItem = (id, changes) => {
    setItems((current) => current.map((item) => (
      item.id === id ? { ...item, ...changes } : item
    )));
  };

  const changeQuantity = (id, amount) => {
    setItems((current) => current.map((item) => (
      item.id === id
        ? { ...item, quantity: Math.max(1, item.quantity + amount) }
        : item
    )));
  };

  const removeItem = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // LocationPicker is a custom control, not a real form field, so the
    // native `required` a <select> gave this for free has to be replicated
    // by hand - same rule as before: every service except bills needs one.
    if (serviceType !== 'bills' && !deliveryLocation) {
      setLocationTouched(true);
      return;
    }
    const order = {
      serviceType,
      establishment: establishment.trim(),
      items,
      deliveryLocation,
      customerType,
      ...(serviceType === 'item' && {
        fulfillmentMethod,
        ...(fulfillmentMethod === 'pickup' && {
          deliveryAddress: deliveryAddress.trim(),
          recipientName: recipientName.trim(),
          recipientContact: recipientContact.trim()
        })
        })
    };

    if (event.nativeEvent.submitter?.value === 'cart') {
      onAddToCart(order);
      return;
    }

    onSubmit(order);
  };

  return (
    <div className="order-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="custom-order-title">
        <div className="order-modal-header">
          <div>
            <span className="order-modal-eyebrow">{serviceNames[serviceType]}</span>
            <h2 id="custom-order-title">Create a custom order</h2>
          </div>
          <button className="order-modal-close" type="button" onClick={onCancel} aria-label="Close form">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="order-field">
            <span>Establishment</span>
            <input
              autoFocus={canEditEstablishment}
              required
              type="text"
              readOnly={!canEditEstablishment}
              aria-readonly={!canEditEstablishment}
              value={establishment}
              onChange={(event) => setEstablishment(event.target.value)}
              placeholder={canEditEstablishment ? 'Enter the store or vendor name' : ''}
            />
          </label>

          {serviceType !== 'bills' && <div className="order-field">
            <span>Delivery location</span>
            <LocationPicker variant="inline" />
            {locationTouched && !deliveryLocation && (
              <small className="order-field-error">Please select a delivery location.</small>
            )}
            {selectedLocation && (
              <small className="order-field-service-fee">
                Service fee{deliveryFee.surchargeApplied ? ' (includes night surcharge)' : ''}: ₱{deliveryFee.serviceFee}
              </small>
            )}
          </div>}

          {serviceType === 'item' && allowPickup && (
            <>
              <fieldset className="fulfillment-options">
                <legend>How should we handle the item?</legend>
                <div className="fulfillment-options-grid">
                <label className={fulfillmentMethod === 'delivery' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value="delivery"
                    checked={fulfillmentMethod === 'delivery'}
                    onChange={(event) => setFulfillmentMethod(event.target.value)}
                  />
                  <span className="fulfillment-icon"><i className="fa-solid fa-truck" aria-hidden="true" /></span>
                  <span>
                    <strong>Delivery</strong>
                    <small>Bring the item to me</small>
                  </span>
                </label>

                <label className={fulfillmentMethod === 'pickup' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value="pickup"
                    checked={fulfillmentMethod === 'pickup'}
                    onChange={(event) => setFulfillmentMethod(event.target.value)}
                  />
                  <span className="fulfillment-icon"><i className="fa-solid fa-box" aria-hidden="true" /></span>
                  <span>
                    <strong>Pick Up</strong>
                    <small>Pick it up and deliver it</small>
                  </span>
                </label>
                </div>
              </fieldset>

              {fulfillmentMethod === 'pickup' && (
                <div className="pickup-recipient-details">
                  <label className="order-field delivery-address-field">
                    <span>Delivery address</span>
                    <textarea
                      autoFocus
                      required
                      rows="3"
                      value={deliveryAddress}
                      onChange={(event) => setDeliveryAddress(event.target.value)}
                      placeholder="Enter the complete delivery address"
                    />
                  </label>

                  <div className="recipient-fields-row">
                    <label className="order-field">
                      <span>Recipient’s name</span>
                      <input
                        required
                        type="text"
                        value={recipientName}
                        onChange={(event) => setRecipientName(event.target.value)}
                        placeholder="Full name"
                      />
                    </label>

                    <label className="order-field">
                      <span>Recipient’s contact number</span>
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        value={recipientContact}
                        onChange={(event) => setRecipientContact(event.target.value)}
                        placeholder="e.g. 09XX XXX XXXX"
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="order-items-heading">
            <div>
              <h3>Order Items</h3>
              <p>Add each item and set its quantity.</p>
            </div>
            <button className="add-order-item" type="button" onClick={() => setItems((current) => [...current, createItem()])}>
              <span aria-hidden="true">＋</span> Add item
            </button>
          </div>

          <div className="order-items-list">
            {items.map((item, index) => (
              <div className="order-item-row" key={item.id}>
                <label className="order-item-name">
                  <span className="sr-only">Item {index + 1}</span>
                  <input
                    required
                    type="text"
                    value={item.name}
                    onChange={(event) => updateItem(item.id, { name: event.target.value })}
                    placeholder={`Item ${index + 1}`}
                  />
                </label>

                <div className="quantity-control" aria-label={`Quantity for item ${index + 1}`}>
                  <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Decrease quantity">−</button>
                  <output aria-live="polite">{item.quantity}</output>
                  <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Increase quantity">＋</button>
                </div>

                <button
                  className="remove-order-item"
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  aria-label={`Remove item ${index + 1}`}
                >
                  <i className="fa-solid fa-trash" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <div className="order-form-actions">
            <button className="cancel-order-button" type="button" onClick={onCancel}>Cancel</button>
            <button className="add-to-cart-button" type="submit" value="cart">
              <i className="fa-solid fa-cart-plus" aria-hidden="true" />
              Add to Cart
            </button>
            <button className="place-order-button" type="submit">Place Order</button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default OthersOrderForm;
