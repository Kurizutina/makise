import React from 'react';
import './ServiceNavigation.css';

const icons = { food: 'fa-utensils', item: 'fa-box', bills: 'fa-file-invoice-dollar' };

const ServiceNavigation = ({ selectedService, onServiceChange, onHomeClick, isHome, services = [] }) => (
  <div className="service-navigation">
    <button
      type="button"
      className={`service-tab service-home-tab ${isHome ? 'active' : ''}`}
      onClick={onHomeClick}
    >
      <i className="fa-solid fa-house" aria-hidden="true" />
      <span>Home</span>
    </button>
    {services.map((service) => (
      <button
        key={service.ServiceID}
        type="button"
        className={`service-tab ${!isHome && selectedService === service.ServiceID ? 'active' : ''}`}
        onClick={() => onServiceChange(service.ServiceID)}
      >
        <i className={`fa-solid ${icons[service.ServiceType] || icons.item}`} />
        <span>{service.ServiceName}</span>
      </button>
    ))}
  </div>
);

export default ServiceNavigation;
