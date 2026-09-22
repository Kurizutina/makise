import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook } from 'react-icons/fa';
import './Footer.css';

const Footer = ({ onServiceChange }) => (
  <footer className="home-footer">
    <div className="home-footer-content">
      <div className="home-footer-brand">
        <a className="home-footer-name" href="#home">Otu-Zan Delivery</a>
        <p className="home-footer-established">Established 2021</p>
        <p>Food, everyday essentials, and bill payments. Let us help with your daily errands.</p>
      </div>

      <nav aria-label="Footer quick links">
        <h2>Quick links</h2>
        <ul className="home-footer-links">
          <li><a href="#home">Home</a></li>
          <li><a href="#home" onClick={() => onServiceChange('food')}>Food Delivery</a></li>
          <li><a href="#home" onClick={() => onServiceChange('item')}>Item Delivery</a></li>
          <li><a href="#home" onClick={() => onServiceChange('bills')}>Pay Bills</a></li>
          <li><Link to="/faq">FAQ</Link></li>
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
      <a href="#home">Back to top &uarr;</a>
    </div>
  </footer>
);

export default Footer;
