import React from 'react';
import Logo from '../../common/Logo/Logo';
import './Header.css';
import SearchBar from './SearchBar/SearchBar';
import ServiceNavigation from './ServiceNavigation/ServiceNavigation';
import CustomerMenu from './CustomerMenu/CustomerMenu';
import CustomerActivity from './CustomerActivity/CustomerActivity';

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const Header = ({
  selectedService,
  onServiceChange,
  services,
  onSearch
}) => {

  return (
    <header className="home-header">
      <div className="header-container">
        <div className="header-brand-lockup">
          <div className="header-logo">
            <Logo />
          </div>
          <div className="header-brand-copy">
            <strong>Otu Zan Delivery</strong>
            <span>Let us help with your daily errands.</span>
          </div>
        </div>

        <div className="header-tools">
          <div className="header-search">
            <SearchBar onSearch={onSearch} />
          </div>

          <div className="header-actions">
            <CustomerActivity />

            <CustomerMenu icon={<MenuIcon />} />
          </div>
        </div>
      </div>
      <nav className="header-service-nav" aria-label="Customer services">
        <ServiceNavigation
          selectedService={selectedService}
          onServiceChange={onServiceChange}
          services={services}
        />
      </nav>
    </header>
  );
};

export default Header;
