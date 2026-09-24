import React, { useEffect, useRef, useState } from 'react';
import { DELIVERY_LOCATIONS } from '../../../../utils/deliveryRates';
import { useCustomerActivity } from '../../../../context/CustomerActivityContext';
import './LocationPicker.css';

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
  </svg>
);

// Custom-styled location picker replacing the native <select> previously
// used at checkout - a native select's own popup rendering was reported live
// as taking a couple of seconds to open, which isn't something app code can
// speed up. This renders its own dropdown list in the DOM instead, matching
// how foodpanda/GrabFood/Jollibee's own apps show and change a delivery
// location. Reads/writes CustomerActivityContext's shared deliveryLocation,
// so picking a location here, in the cart drawer, or in the Others order
// form all stay in sync - it is one saved delivery location per browser, not
// a separate choice per checkout.
const LocationPicker = ({ variant = 'header' }) => {
  const { deliveryLocation, setDeliveryLocation } = useCustomerActivity();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = DELIVERY_LOCATIONS.find((location) => location.id === deliveryLocation);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (locationId) => {
    setDeliveryLocation(locationId);
    setOpen(false);
  };

  return (
    <div className={`location-picker location-picker-${variant}`} ref={rootRef}>
      <button
        type="button"
        className="location-picker-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Delivery location: ${selected ? selected.name : 'not set'}. Change delivery location.`}
      >
        <PinIcon />
        <span aria-hidden="true">{selected ? selected.name : 'Set delivery location'}</span>
      </button>
      {open && (
        <ul className="location-picker-menu" role="listbox">
          {DELIVERY_LOCATIONS.map((location) => (
            <li key={location.id}>
              <button
                type="button"
                role="option"
                aria-selected={location.id === deliveryLocation}
                className={location.id === deliveryLocation ? 'active' : ''}
                onClick={() => choose(location.id)}
              >
                {location.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationPicker;
