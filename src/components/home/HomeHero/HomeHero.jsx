import React from 'react';
import './HomeHero.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Purely presentational - no photography/illustration assets exist for this
// project (flagged separately in TODO.md), so this leans on gradient,
// typography, and real catalog data instead, matching how Grab/foodpanda's
// hero establishes mood before the brand grid rather than dropping straight
// into it.
const HomeHero = ({ brandCount }) => (
  <section className="home-hero">
    <div className="home-hero-copy">
      <span className="home-hero-eyebrow">{getGreeting()}</span>
      <h1>Craving something good?</h1>
      <p>Food, everyday items, and bill payments - delivered fast, tracked in real time from order to doorstep.</p>
    </div>

    <ul className="home-hero-highlights">
      <li>
        <i className="fa-solid fa-list-check" aria-hidden="true" />
        <div><strong>{brandCount > 0 ? `${brandCount}+ brands` : 'Every brand'}</strong><span>Food, items &amp; bills in one place</span></div>
      </li>
      <li>
        <i className="fa-solid fa-location-dot" aria-hidden="true" />
        <div><strong>Real-time tracking</strong><span>Know exactly where your order is</span></div>
      </li>
      <li>
        <i className="fa-solid fa-shield-halved" aria-hidden="true" />
        <div><strong>Verified &amp; secure</strong><span>Every order confirmed by our team</span></div>
      </li>
    </ul>
  </section>
);

export default HomeHero;
