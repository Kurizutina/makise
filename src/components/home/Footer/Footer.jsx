import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaFacebook } from 'react-icons/fa';
import './Footer.css';

// These links used to be `href="#home"` same-page anchors plus a locally-
// passed `onServiceChange` prop - which only ever worked because Footer
// happened to always be rendered on the Home page itself (with a matching
// `id="home"` to jump to). Once Footer started rendering on other pages too
// (the FAQ page), that broke silently: no `id="home"` there to jump to, and
// no real onServiceChange handler, so "Home" just changed the URL's hash and
// did nothing (reported live, 9/23). Real router navigation instead, so
// these work correctly regardless of which page Footer is rendered on.
const Footer = () => {
  const navigate = useNavigate();
  const goToService = (serviceType) => (event) => {
    event.preventDefault();
    navigate('/home', { state: serviceType ? { selectedServiceType: serviceType } : { showHome: true } });
  };

  return (
    <footer className="home-footer">
      <div className="home-footer-content">
        <div className="home-footer-brand">
          <a className="home-footer-name" href="/home" onClick={goToService()}>Otu-Zan Delivery</a>
          <p className="home-footer-established">Established 2021</p>
          <p>Food, everyday essentials, and bill payments. Let us help with your daily errands.</p>
        </div>

        <nav aria-label="Footer quick links">
          <h2>Quick links</h2>
          <ul className="home-footer-links">
            <li><a href="/home" onClick={goToService()}>Home</a></li>
            <li><a href="/home" onClick={goToService('food')}>Food Delivery</a></li>
            <li><a href="/home" onClick={goToService('item')}>Item Delivery</a></li>
            <li><a href="/home" onClick={goToService('bills')}>Pay Bills</a></li>
            {/* Plain "/home" href, not "/home#faq" - the real navigation
                always goes through the onClick below (React Router state,
                not a hash), and a literal #faq href left a genuine
                deep-linkable /home#faq URL in history if it were ever
                actually followed (e.g. a slow click before the handler
                attached) - confirmed live (9/25) that visiting that URL
                directly does jump straight to the FAQ section, which is
                exactly what a customer reported landing on unexpectedly
                after pressing back from a brand's menu. */}
            <li><a href="/home" onClick={(event) => { event.preventDefault(); navigate('/home', { state: { scrollToFaq: true } }); }}>FAQ</a></li>
          </ul>
        </nav>

        <div>
          <h2>Connect with us</h2>
          <p>Follow us for news and updates.</p>
          <a
            className="home-footer-social"
            href="https://www.facebook.com/share/1caA9FYgww/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Otu-Zan Delivery on Facebook (opens in a new tab)"
          >
            <FaFacebook aria-hidden="true" />
            <span>Facebook</span>
          </a>
        </div>
      </div>
      <div className="home-footer-bottom">
        <p>&copy; {new Date().getFullYear()} Otu-Zan Delivery. All rights reserved.</p>
        <a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top &uarr;</a>
      </div>
    </footer>
  );
};

export default Footer;
