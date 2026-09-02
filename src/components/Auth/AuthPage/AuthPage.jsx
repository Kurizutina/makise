import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AuthCard from '../AuthCard/AuthCard';

import '../Auth.css';

import { ROLES } from '../../../config/roles';

import {
  validateAccessCode,
  validateAdditionalFields
} from '../../../utils/validation';

const AuthPage = ({ mode }) => {

  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] =
    useState(ROLES.CUSTOMER.key);

  const [email, setEmail] =
    useState('');

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


  /*
   * Reset form-specific fields
   * when mode or role changes.
   */
  useEffect(() => {

    setConfirmPassword('');
    setAccessCode('');

    setUsername('');
    setName('');
    setAddress('');
    setContactNumber('');

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


  const handleSubmit = (e) => {

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


    const roleName =
      ROLES[selectedRole.toUpperCase()]?.label ||
      selectedRole;


    /*
     * Registration
     */
    if (mode === 'register') {

      setMessage({
        type: 'success',

        text:
          `🎉 Welcome to Otu-Zan, ${
            username || name
          }! Your ${roleName} account has been created.`
      });

      return;
    }


    /*
     * Login
     */
    setMessage({
      type: 'success',

      text:
        `✅ Welcome back! Redirecting to your ${roleName} dashboard...`
    });

    sessionStorage.setItem('otuzanAuthenticated', selectedRole);
    navigate(selectedRole === ROLES.RIDER.key ? '/rider/orders' : '/home');

  };


  return (
    <div className={mode === 'login' ? 'login-page' : 'register-page'}>
    <AuthCard
      mode={mode}

      selectedRole={selectedRole}

      email={email}
      password={password}
      confirmPassword={confirmPassword}
      accessCode={accessCode}

      showPassword={showPassword}

      message={message}

      roles={ROLES}

      username={username}
      name={name}
      address={address}
      contactNumber={contactNumber}

      onRoleChange={handleRoleChange}

      onToggleMode={handleToggleMode}

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
