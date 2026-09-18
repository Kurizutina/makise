import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../../components/common/Logo/Logo';
import '../../components/Auth/Auth.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to reset password.');
      setMessage({ type: 'success', text: result.message });
      window.setTimeout(() => navigate('/login'), 1200);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message === 'Failed to fetch'
          ? 'Unable to reach the backend. Start the backend server and try again.'
          : error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="auth-simple-card">
        <Logo />
        <div className="auth-simple-header">
          <h1>Set a new password</h1>
          <p>Create a new password for your Otu-Zan account.</p>
        </div>
        {!token || !email ? (
          <div className="message error" role="alert">This password reset link is incomplete.</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {message && <div className={`message ${message.type}`} role="status">{message.text}</div>}
            <div className="form-group">
              <div className="input-icon-wrapper">
                <i className="fas fa-lock input-icon" />
                <input className="input-field with-icon" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" required minLength="6" autoComplete="new-password" />
              </div>
            </div>
            <div className="form-group">
              <div className="input-icon-wrapper">
                <i className="fas fa-lock input-icon" />
                <input className="input-field with-icon" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" required minLength="6" autoComplete="new-password" />
              </div>
            </div>
            <button className="action-btn" type="submit" disabled={isSubmitting}>
              <i className="fas fa-key" /> {isSubmitting ? 'Saving...' : 'Reset password'}
            </button>
          </form>
        )}
        <button type="button" className="auth-secondary-link" onClick={() => navigate('/login')}>
          Back to sign in
        </button>
      </div>
    </div>
  );
};

export default ResetPassword;