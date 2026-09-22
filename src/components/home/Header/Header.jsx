import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  return (
    <header className="home-header">
      <div className="header-container">
        {/* The one persistent "take me back" control on every customer page
            (menus, FAQ) - previously nothing in the header linked anywhere,
            so a page like FAQ that also has no back button left guests with
            no way back to browsing at all (reported live, 9/23). */}
        <button type="button" className="header-brand-lockup" onClick={() => navigate('/home')}>
          <div className="header-logo">
            <Logo />
          </div>
          <div className="header-brand-copy">
            <strong>Otu Zan Delivery</strong>
            <span>Let us help with your daily errands.</span>
          </div>
        </button>

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
      {services?.length > 0 && (
        <nav className="header-service-nav" aria-label="Customer services">
          <ServiceNavigation
            selectedService={selectedService}
            onServiceChange={onServiceChange}
            services={services}
          />
        </nav>
      )}
    </header>
  );
};

export default Header;
