import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CustomerMenu.css';
import { syncCustomerOrders } from '../../../../utils/customerProfileSync';
import { clearSession, getSessionUser } from '../../../../utils/session';

const PROFILE_KEY = 'otuzanCustomerProfile';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const cacheProfile = (user) => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
  localStorage.setItem(`otuzanCustomerAddress:${user.email.toLowerCase()}`, user.address || '');
  sessionStorage.setItem('otuzanUser', JSON.stringify(user));
  syncCustomerOrders(user);
};

const getSavedProfile = () => {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
  } catch {
    return {};
  }
};

const CustomerMenu = ({ icon }) => {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profile, setProfile] = useState(() => ({
    username: '',
    address: '',
    email: '',
    password: '',
    ...getSavedProfile()
  }));

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (isProfileOpen) setIsProfileOpen(false);
      else setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileOpen]);

  useEffect(() => {
    if (!isProfileOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isProfileOpen]);

  useEffect(() => {
    if (!isProfileOpen) return undefined;
    const controller = new AbortController();
    const loadProfile = async () => {
      setIsLoading(true);
      setProfileLoaded(false);
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}`, Accept: 'application/json' },
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Please sign in again.' : result.error || 'Unable to load your profile.');
        if (controller.signal.aborted) return;
        cacheProfile(result.user);
        setProfile({ ...result.user, password: '' });
        setProfileLoaded(true);
      } catch (error) {
        if (!controller.signal.aborted) setErrorMessage(error.message === 'Failed to fetch' ? 'Unable to reach the backend. Please try again.' : error.message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    loadProfile();
    return () => controller.abort();
  }, [isProfileOpen]);

  const updateProfile = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setSavedMessage('');
    setErrorMessage('');
  };

  const openProfile = () => {
    setIsMenuOpen(false);
    setIsProfileOpen(true);
    setSavedMessage('');
    setErrorMessage('');
    setProfileLoaded(false);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (isSaving || !profileLoaded) return;
    setSavedMessage('');
    setErrorMessage('');
    if (!profile.username.trim() || !profile.address.trim()) {
      setErrorMessage('Full name and delivery address are required.');
      return;
    }

    const persistedProfile = {
      username: profile.username.trim(),
      address: profile.address.trim(),
      email: profile.email.trim()
    };
    if (profile.password) persistedProfile.password = profile.password;
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}` },
        body: JSON.stringify(persistedProfile)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Please sign in again.' : result.error || 'Unable to save your profile.');
      cacheProfile(result.user);
      setProfile({ ...result.user, password: '' });
      setSavedMessage('Profile updated successfully.');
    } catch (error) {
      setErrorMessage(error.message === 'Failed to fetch' ? 'Unable to reach the backend. Your changes were not saved.' : error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const logout = () => {
    clearSession();
    setIsMenuOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <div className="customer-menu-wrapper" ref={menuRef}>
      <button
        className="header-menu-button"
        type="button"
        aria-label={getSessionUser() ? 'Open customer menu' : 'Log in'}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        onClick={() => {
          if (!getSessionUser()) {
            navigate('/login');
            return;
          }
          setIsMenuOpen((current) => !current);
        }}
      >
        {icon}
      </button>

      {isMenuOpen && (
        <div className="customer-menu-popover" role="menu">
          <div className="customer-menu-summary">
            <span className="customer-avatar" aria-hidden="true">
              {(profile.username || 'C').charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{profile.username || 'Customer'}</strong>
              <small>{profile.email || 'Manage your account'}</small>
            </div>
          </div>
          <button type="button" role="menuitem" onClick={openProfile}>
            <i className="fa-solid fa-user-pen" aria-hidden="true" />
            Edit Profile
          </button>
          <button className="customer-logout-option" type="button" role="menuitem" onClick={logout}>
            <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
            Log Out
          </button>
        </div>
      )}

      {isProfileOpen && (
        <div className="profile-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsProfileOpen(false);
        }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <div className="profile-modal-header">
              <div>
                <span>Customer Account</span>
                <h2 id="profile-modal-title">Edit profile</h2>
                <p>Keep your account and delivery details up to date.</p>
              </div>
              <button type="button" onClick={() => setIsProfileOpen(false)} aria-label="Close profile editor">×</button>
            </div>

            <form onSubmit={saveProfile}>
              <fieldset className="profile-fields-grid" disabled={isLoading || isSaving || !profileLoaded} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                <label className="profile-field">
                  <span>Full name</span>
                  <div><i className="fa-solid fa-user" aria-hidden="true" /><input required maxLength="100" autoComplete="name" value={profile.username} onChange={(event) => updateProfile('username', event.target.value)} placeholder="Enter full name" /></div>
                </label>

                <label className="profile-field">
                  <span>Email address</span>
                  <div><i className="fa-solid fa-envelope" aria-hidden="true" /><input required type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} placeholder="Enter email address" /></div>
                </label>

                <label className="profile-field profile-address-field">
                  <span>Delivery address</span>
                  <div><i className="fa-solid fa-location-dot" aria-hidden="true" /><textarea required rows="3" value={profile.address} onChange={(event) => updateProfile('address', event.target.value)} placeholder="Enter complete delivery address" /></div>
                </label>

                <label className="profile-field profile-password-field">
                  <span>New password</span>
                  <div>
                    <i className="fa-solid fa-lock" aria-hidden="true" />
                    <input type={showPassword ? 'text' : 'password'} minLength="6" value={profile.password} onChange={(event) => updateProfile('password', event.target.value)} placeholder="Leave blank to keep current password" />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                    </button>
                  </div>
                  <small>Password must contain at least 6 characters.</small>
                </label>
              </fieldset>

              {isLoading && <p role="status">Loading profile...</p>}
              {errorMessage && <p role="alert">{errorMessage}</p>}
              {savedMessage && <div className="profile-save-message" role="status"><i className="fa-solid fa-circle-check" aria-hidden="true" /> {savedMessage}</div>}

              <div className="profile-modal-actions">
                <button className="profile-cancel" type="button" onClick={() => setIsProfileOpen(false)}>Cancel</button>
                <button className="profile-save" type="submit" disabled={isLoading || isSaving || !profileLoaded}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
