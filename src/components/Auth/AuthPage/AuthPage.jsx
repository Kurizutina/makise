import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AuthCard from '../AuthCard/AuthCard';

import '../Auth.css';

import { ROLES } from '../../../config/roles';
import { syncCustomerOrders } from '../../../utils/customerProfileSync';
import { getDashboardPath, setSession } from '../../../utils/session';

import {
  validateAccessCode,
  validateAdditionalFields
} from '../../../utils/validation';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AuthPage = ({ mode }) => {

  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] =
    useState(ROLES.CUSTOMER.key);

  const REMEMBERED_EMAIL_KEY = 'otuzanRememberedEmail';

  const [email, setEmail] =
    useState(() => (mode === 'login' ? (localStorage.getItem(REMEMBERED_EMAIL_KEY) || '') : ''));

  const [rememberMe, setRememberMe] =
    useState(() => (mode === 'login' && Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY))));

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [accessCode, setAccessCode] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [message, setMessage] =
    useState(null);

  const [username, setUsername] =
    useState('');

  const [name, setName] =
    useState('');

  const [address, setAddress] =
    useState('');

  const [contactNumber, setContactNumber] =
    useState('');

  const [userType, setUserType] = useState('');



  /*
   * Reset form-specific fields
   * when mode or role changes.
   */
  useEffect(() => {

    if (mode === 'register' && selectedRole === 'rider') {
      setSelectedRole(ROLES.CUSTOMER.key);
    }

    setConfirmPassword('');
    setAccessCode('');

    setUsername('');
    setName('');
    setAddress('');
    setContactNumber('');
    setUserType('');

    setMessage(null);

  }, [mode, selectedRole]);


  const handleRoleChange = (roleKey) => {
    setSelectedRole(roleKey);
  };


  const handleToggleMode = () => {

    if (mode === 'login') {
      navigate('/register');
    } else {
      navigate('/login');
    }

  };


  const handleSubmit = async (e) => {

    e.preventDefault();

    setMessage(null);


    /*
     * Basic required fields
     */
    if (
      !email.trim() ||
      !password.trim()
    ) {

      setMessage({
        type: 'error',
        text:
          'Please fill in all required fields.'
      });

      return;
    }


    /*
     * Access code validation
     */
    if (
      !validateAccessCode(
        selectedRole,
        accessCode,
        setMessage
      )
    ) {
      return;
    }


    /*
     * Additional registration fields
     */
    if (
      mode === 'register' &&
      !validateAdditionalFields(
        mode,
        selectedRole,
        {
          username,
          name,
          address,
          contactNumber
        },
        setMessage
      )
    ) {
      return;
    }


    /*
     * Confirm password
     */
    if (
      mode === 'register' &&
      password !== confirmPassword
    ) {

      setMessage({
        type: 'error',
        text:
          'Passwords do not match.'
      });

      return;
    }


    /*
     * Password length
     */
    if (password.length < 6) {

      setMessage({
        type: 'error',
        text:
          'Password must be at least 6 characters.'
      });

      return;
    }


    const roleName = ROLES[selectedRole.toUpperCase()]?.label || selectedRole;
    const requestBody = mode === 'register'
      ? {
          email: email.trim(),
          password,
          role: selectedRole === 'rider' ? 'driver' : selectedRole,
          accessCode: accessCode.trim(),
          username: (username || name).trim(),
          address: address.trim(),
          contact: contactNumber.trim(),
          userType
        }
      : {
          email: email.trim(),
          password,
          role: selectedRole === 'rider' ? 'driver' : selectedRole
        };

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `${roleName} authentication failed`);
      }

      const addressKey = `otuzanCustomerAddress:${result.user.email.toLowerCase()}`;
      let savedAddress = localStorage.getItem(addressKey) || '';
      if (!savedAddress) {
        try {
          const previousProfile = JSON.parse(localStorage.getItem('otuzanCustomerProfile'));
          if (previousProfile?.email?.toLowerCase() === result.user.email.toLowerCase()) {
            savedAddress = previousProfile.address || '';
          }
        } catch {
          // Ignore an invalid saved profile.
        }
      }
      const customerAddress = result.user.address || (mode === 'register' ? address.trim() : savedAddress);
      const sessionUser = result.user.role === 'customer'
        ? { ...result.user, address: customerAddress }
        : result.user;
      setSession(result.token, sessionUser);
      if (mode === 'login') {
        if (rememberMe) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      if (result.user.role === 'customer' && customerAddress) {
        localStorage.setItem(addressKey, customerAddress);
        localStorage.setItem('otuzanCustomerProfile', JSON.stringify({
          id: result.user.id,
          username: result.user.username || result.user.name || '',
          address: customerAddress,
          email: result.user.email,
          contact: result.user.contact,
          role: result.user.role
          , userType: result.user.userType
        }));
      }
      syncCustomerOrders({ ...result.user, address: customerAddress });

      setMessage({
        type: 'success',
        text: mode === 'register'
          ? `Welcome to Otu-Zan, ${username || name}! Your ${roleName} account has been created.`
          : `Welcome back! Redirecting to your ${roleName} dashboard...`
      });
      if (result.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(getDashboardPath(result.user.role), { replace: true });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message === 'Failed to fetch'
          ? 'Unable to reach the backend. Start the backend server and try again.'
          : error.message
      });
    }



  };


  return (
    <div className={mode === 'login' ? 'login-page' : 'register-page'}>
    <AuthCard
      mode={mode}

      selectedRole={selectedRole}

      email={email}
      password={password}
      rememberMe={rememberMe}
      onRememberMeChange={(e) => setRememberMe(e.target.checked)}
      confirmPassword={confirmPassword}
      accessCode={accessCode}

      showPassword={showPassword}

      message={message}

      roles={ROLES}

      username={username}
      name={name}
      address={address}
      contactNumber={contactNumber}
      userType={userType}

      onRoleChange={handleRoleChange}

      onToggleMode={handleToggleMode}

      onForgotPassword={() => navigate('/forgot-password')}
      onBrowseAsGuest={() => navigate('/home')}

      onEmailChange={(e) =>
        setEmail(e.target.value)
      }

      onPasswordChange={(e) =>
        setPassword(e.target.value)
      }

      onConfirmPasswordChange={(e) =>
        setConfirmPassword(e.target.value)
      }

      onAccessCodeChange={(e) =>
        setAccessCode(e.target.value)
      }

      onUsernameChange={(e) =>
        setUsername(e.target.value)
      }

      onNameChange={(e) =>
        setName(e.target.value)
      }

      onAddressChange={(e) =>
        setAddress(e.target.value)
      }

      onContactNumberChange={(e) =>
        setContactNumber(e.target.value)
      }

      onUserTypeChange={(e) =>
        setUserType(e.target.value)
      }


      onTogglePassword={() =>
        setShowPassword(
          !showPassword
        )
      }

      onSubmit={handleSubmit}
    />
    </div>
  );
};

export default AuthPage;
