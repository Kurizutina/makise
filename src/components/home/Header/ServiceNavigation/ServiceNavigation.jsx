import React from 'react';
import './ServiceNavigation.css';

const icons = { food: 'fa-utensils', item: 'fa-box', bills: 'fa-file-invoice-dollar' };

const ServiceNavigation = ({ selectedService, onServiceChange, services = [] }) => (
  <div className="service-navigation">
    {services.map((service) => (
      <button
        key={service.ServiceID}
        type="button"
        className={`service-tab ${selectedService === service.ServiceID ? 'active' : ''}`}
        onClick={() => onServiceChange(service.ServiceID)}
      >
        <i className={`fa-solid ${icons[service.ServiceType] || icons.item}`} />
        <span>{service.ServiceName}</span>
      </button>
    ))}
  </div>
);

export default ServiceNavigation;
