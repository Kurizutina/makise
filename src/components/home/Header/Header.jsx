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
  onServiceChange
}) => {

  return (
    <header className="home-header">
      <div className="header-container">
        <div className="header-logo">
          <Logo />
        </div>

        <div className="header-main">
          <ServiceNavigation
            selectedService={selectedService}
            onServiceChange={onServiceChange}
          />

          <div className="header-tools">
            <div className="header-search">
              <SearchBar />
            </div>

            <div className="header-actions">
              <CustomerActivity />

              <CustomerMenu icon={<MenuIcon />} />
            </div>
          </div>
        </div>
      </div>

    </header>
  );
};

export default Header;
