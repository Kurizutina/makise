import React, { useEffect, useState } from 'react';
import './AnnouncementBar.css';

const ANNOUNCEMENTS = [
  {
    icon: 'fa-clock',
    label: 'Business hours',
    message: 'We are open daily from 7:00 AM to 9:00 PM.'
  },
  {
    icon: 'fa-tags',
    label: 'Admin notice',
    message: 'Product prices are initial estimates and may vary depending on the establishment.'
  },
  {
    icon: 'fa-truck-fast',
    label: 'Admin notice',
    message: 'Service fees are not fixed and may change based on order timing and current economic conditions.'
  }
];

const AnnouncementBar = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = ANNOUNCEMENTS.length;
  const goTo = (index) => setActive((index + total) % total);

  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % total), 5500);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  return (
    <section className="announcement-bar" aria-label="Business announcements" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="announcement-bar-inner">
        <div className="announcement-viewport" aria-live="polite">
          <div className="announcement-track" style={{ transform: `translateX(-${active * 100}%)` }}>
            {ANNOUNCEMENTS.map((announcement) => (
              <article className="announcement-slide" key={announcement.message} aria-hidden={announcement !== ANNOUNCEMENTS[active]}>
                <i className={`fa-solid ${announcement.icon}`} aria-hidden="true" />
                <div><strong>{announcement.label}</strong><p>{announcement.message}</p></div>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div className="announcement-dots" aria-label="Announcement pages">
        {ANNOUNCEMENTS.map((announcement, index) => <button key={announcement.message} className={index === active ? 'active' : ''} type="button" aria-label={`Show announcement ${index + 1}`} aria-current={index === active ? 'true' : undefined} onClick={() => goTo(index)} />)}
      </div>
    </section>
  );
};

export default AnnouncementBar;
