import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/common/Logo/Logo';
import { clearSession, getDashboardPath, getSessionUser } from '../../utils/session';
import '../../components/Auth/Auth.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ChangePassword = () => {
  const navigate = useNavigate();
  const user = getSessionUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) return setMessage({ type: 'error', text: 'Use at least 8 characters for your new password.' });
    if (password !== confirmPassword) return setMessage({ type: 'error', text: 'Passwords do not match.' });
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to change password.');
      navigate(getDashboardPath(user?.role), { replace: true });
    } catch (error) {
      setMessage({ type: 'error', text: error.message === 'Failed to fetch' ? 'Unable to reach the backend.' : error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    clearSession();
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="login-page">
      <div className="auth-simple-card">
        <Logo />
        <div className="auth-simple-header"><h1>Set your password</h1><p>Your administrator gave you a temporary password. Choose a private password before continuing.</p></div>
        {message && <div className={`message ${message.type}`} role="alert">{message.text}</div>}
        <form onSubmit={submit}>
          <div className="form-group"><input className="input-field" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Temporary password" required autoComplete="current-password" /></div>
          <div className="form-group"><input className="input-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" required minLength="8" autoComplete="new-password" /></div>
          <div className="form-group"><input className="input-field" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" required minLength="8" autoComplete="new-password" /></div>
          <button className="action-btn" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save password'}</button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;