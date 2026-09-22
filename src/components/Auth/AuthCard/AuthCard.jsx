import React from 'react';

import Logo from '../../common/Logo/Logo';
import AuthForm from '../AuthForm/AuthForm';

const AuthCard = ({
  mode,
  selectedRole,

  email,
  password,
  confirmPassword,
  accessCode,
  showPassword,

  message,
  roles,

  username,
  name,
  address,
  contactNumber,
  userType,

  onRoleChange,
  onToggleMode,
  onForgotPassword,
  onBrowseAsGuest,

  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onAccessCodeChange,

  onUsernameChange,
  onNameChange,
  onAddressChange,
  onContactNumberChange,
  onUserTypeChange,

  onTogglePassword,
  onSubmit
}) => {

  const currentRoleObj =
    roles[selectedRole.toUpperCase()] ||
    roles.CUSTOMER;

  const welcomeMessage =
    mode === 'register'
      ? 'Start Ordering with us!'
      : 'Welcome Back!';

  return (
    <div className="auth-layout">

      {/* LEFT SIDE */}
      <div className="auth-left">

        <div className="hover-animate logo-section">

          <Logo />

          <div className="welcome-message">

            <h1 className="welcome-title">
              {welcomeMessage}
            </h1>

            <p className="welcome-subtitle">

              {mode === 'register'
                ? 'Join Otu-Zan Delivery and get a fast and reliable service.'
                : 'Sign in to track your orders and manage your account.'}

            </p>

          </div>

          <div className="decorative-elements">

            <div className="decorative-circle circle-1"></div>

            <div className="decorative-circle circle-2"></div>

            <div className="decorative-circle circle-3"></div>

          </div>

        </div>

      </div>


      {/* RIGHT SIDE */}
      <div className="auth-right">

        <div className="hover-animate form-card">

          <div className="auth-header">

            <h2>
              {mode === 'login'
                ? 'Sign in'
                : 'Create Account'}
            </h2>


          </div>


          {/* ACCESS CODE NOTICE */}
          {currentRoleObj.requiresCode && (
            <div
              className="code-notice"
              style={{
                background:
                  `${currentRoleObj.color}15`,

                borderLeft:
                  `4px solid ${currentRoleObj.color}`
              }}
            >

              <i className="fas fa-lock"></i>

              <span>
                {currentRoleObj.label}s require
                an access code
              </span>

            </div>
          )}


          {/* MESSAGE */}
          {message && (
            <div
              className={`message ${message.type}`}
            >

              <i
                className={
                  message.type === 'error'
                    ? 'fas fa-exclamation-circle'
                    : 'fas fa-check-circle'
                }
              ></i>

              {message.text}

            </div>
          )}


          {/* FORM */}
          <AuthForm
            mode={mode}

            email={email}
            password={password}
            confirmPassword={confirmPassword}
            accessCode={accessCode}

            showPassword={showPassword}

            selectedRole={selectedRole}
            roles={roles}

            username={username}
            name={name}
            address={address}
            contactNumber={contactNumber}
            userType={userType}

            onEmailChange={onEmailChange}
            onPasswordChange={onPasswordChange}
            onConfirmPasswordChange={
              onConfirmPasswordChange
            }
            onAccessCodeChange={
              onAccessCodeChange
            }

            onUsernameChange={
              onUsernameChange
            }
            onNameChange={onNameChange}
            onAddressChange={
              onAddressChange
            }
            onContactNumberChange={
              onContactNumberChange
            }
            onUserTypeChange={onUserTypeChange}

            onTogglePassword={
              onTogglePassword
            }

            onSubmit={onSubmit}
          />


          <hr className="divider" />

          {mode === 'login' && (
            <button type="button" className="auth-secondary-link" onClick={onForgotPassword}>
              Forgot password?
            </button>
          )}


          {/* LOGIN / REGISTER TOGGLE */}
          <div className="toggle-mode">

            {mode === 'login' ? (
              <>
                New to Otu-Zan?{' '}

                <span onClick={onToggleMode}>
                  Create account
                </span>
              </>
            ) : (
              <>
                Already have an account?{' '}

                <span onClick={onToggleMode}>
                  Sign in
                </span>
              </>
            )}

          </div>

          {mode === 'login' && (
            <button type="button" className="auth-secondary-link" onClick={onBrowseAsGuest}>
              Browse the menu without an account
            </button>
          )}

        </div>

      </div>

    </div>
  );
};

export default AuthCard;
