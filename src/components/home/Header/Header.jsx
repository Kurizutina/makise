import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../common/Logo/Logo';
import './Header.css';
import SearchBar from './SearchBar/SearchBar';
import ServiceNavigation from './ServiceNavigation/ServiceNavigation';
import CustomerMenu from './CustomerMenu/CustomerMenu';
import CustomerActivity from './CustomerActivity/CustomerActivity';
import LocationPicker from './LocationPicker/LocationPicker';
import { getSessionUser } from '../../../utils/session';

const Header = ({ selectedService, onServiceChange, onHomeClick, isHome, services, onSearch }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isGuest = !getSessionUser();
  const chooseHome = () => { onHomeClick?.(); setMenuOpen(false); };
  const chooseService = (serviceId) => { onServiceChange?.(serviceId); setMenuOpen(false); };
  return <header className="home-header">
    <div className="header-top-row">
      <div className="header-brand-cluster">
        <button type="button" className="header-brand-lockup" onClick={() => navigate('/home')}><div className="header-logo"><Logo /></div><div className="header-brand-copy"><strong>Otu-Zan Delivery</strong><span>Allow us to help with your daily errands.</span></div></button>
        {/* Shows the customer's saved delivery location, foodpanda/GrabFood-
            style - was dropped from this header rewrite; restoring it since
            it's an already-shipped, already-verified feature (a native
            <select> here was previously reported live as slow to open). */}
        <LocationPicker variant="header" />
      </div>
      {isGuest ? <div className="header-guest-buttons"><button type="button" onClick={() => navigate('/login')}>Login</button><button type="button" onClick={() => navigate('/register')}>Register</button></div> : <div className="header-member-tools"><CustomerActivity /><CustomerMenu icon={<i className="fa-solid fa-bars" aria-hidden="true" />} /></div>}
    </div>
    <div className="header-bottom-row"><div className="header-bottom-content">
      {services?.length > 0 && <><button className="header-mobile-toggle" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><i className="fa-solid fa-bars" aria-hidden="true" /></button><nav className={`header-service-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Customer services"><ServiceNavigation selectedService={selectedService} onServiceChange={chooseService} onHomeClick={chooseHome} isHome={isHome} services={services} /></nav></>}
      <div className="header-search"><SearchBar onSearch={onSearch} /></div>
    </div>
    </div>
  </header>;
};

export default Header;
