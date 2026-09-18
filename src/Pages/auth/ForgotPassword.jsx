import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/common/Logo/Logo';
import '../../components/Auth/Auth.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Unable to send reset link.');
      setMessage({ type: 'success', text: result.message });
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
          <h1>Forgot password?</h1>
          <p>Enter your email and we will send you a password reset link.</p>
        </div>
        {message && <div className={`message ${message.type}`} role="status">{message.text}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div className="input-icon-wrapper">
              <i className="fas fa-envelope input-icon" />
              <input className="input-field with-icon" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required autoComplete="email" />
            </div>
          </div>
          <button className="action-btn" type="submit" disabled={isSubmitting}>
            <i className="fas fa-paper-plane" /> {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <button type="button" className="auth-secondary-link" onClick={() => navigate('/login')}>
          Back to sign in
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;