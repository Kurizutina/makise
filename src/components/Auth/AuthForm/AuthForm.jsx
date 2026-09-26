import React from 'react';

const AuthForm = ({
  mode,
  email,
  password,
  confirmPassword,
  accessCode,
  showPassword,
  rememberMe,
  onRememberMeChange,
  selectedRole,
  roles,
  username,
  name,
  address,
  contactNumber,
  userType,

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
  const currentRole =
    roles[selectedRole.toUpperCase()] ||
    roles.CUSTOMER;

  const isRegister = mode === 'register';

  const getButtonText = () => {
    if (isRegister) {
      return currentRole.requiresCode
        ? 'Verify & Create Account'
        : 'Create account';
    }

    return currentRole.requiresCode
      ? 'Verify & Log in'
      : 'Log in';
  };

  const renderCustomerFields = () => {
    if (
      selectedRole !== 'customer' ||
      !isRegister
    ) {
      return null;
    }

    return (
      <>
        <div className="form-group">
          <select id="user-type" className="input-field" aria-label="User type" value={userType} onChange={onUserTypeChange} required>
            <option value="">Select user type</option>
            <option value="student">Student</option>
            <option value="non_student">Non-Student</option>
          </select>
        </div>
        <div className="form-group">
          <div className="input-icon-wrapper">
            <i className="fas fa-user-circle input-icon"></i>

            <input
              type="text"
              className="input-field with-icon"
              placeholder="Full name"
              aria-label="Full name"
              autoComplete="name"
              value={username}
              onChange={onUsernameChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <div className="input-icon-wrapper">
            <i className="fas fa-map-marker-alt input-icon"></i>

            <textarea
              className="input-field with-icon textarea-field"
              placeholder="Delivery address"
              value={address}
              onChange={onAddressChange}
              required
              rows="2"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="input-icon-wrapper">
            <i className="fas fa-phone input-icon"></i>

            <input
              type="tel"
              className="input-field with-icon"
              placeholder="Contact number"
              value={contactNumber}
              onChange={onContactNumberChange}
              required
            />
          </div>
        </div>
      </>
    );
  };

  const renderRiderAdminFields = () => {
    if (
      (selectedRole !== 'rider' &&
        selectedRole !== 'admin') ||
      !isRegister
    ) {
      return null;
    }

    return (
      <>
        <div className="form-group">
          <div className="input-icon-wrapper">
            <i className="fas fa-id-card input-icon"></i>

            <input
              type="text"
              className="input-field with-icon"
              placeholder="Full name"
              value={name}
              onChange={onNameChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <div className="input-icon-wrapper">
            <i className="fas fa-phone input-icon"></i>

            <input
              type="tel"
              className="input-field with-icon"
              placeholder="Contact number"
              value={contactNumber}
              onChange={onContactNumberChange}
              required
            />
          </div>
        </div>
      </>
    );
  };

  return (
    <form onSubmit={onSubmit}>

      {isRegister && (
        <div className="role-fields-section">

          <div className="section-label">
            {selectedRole === 'customer'
              ? '📦 Customer Information'
              : '👤 Personal Information'}
          </div>

          {renderCustomerFields()}
          {renderRiderAdminFields()}

        </div>
      )}

      {/* Email */}
      <div className="form-group">
        <div className="input-icon-wrapper">

          <i className="fas fa-envelope input-icon"></i>

          <input
            type="email"
            className="input-field with-icon"
            placeholder="Email address"
            value={email}
            onChange={onEmailChange}
            required
          />

        </div>
      </div>

      {/* Access Code */}
      {currentRole.requiresCode && (
        <div className="form-group">

          <div className="access-code-wrapper">

            <input
              type="password"
              className="input-field access-code-input"
              placeholder={currentRole.codeLabel}
              value={accessCode}
              onChange={onAccessCodeChange}
              required
            />

            <div className="access-code-icon">
              <i className="fas fa-key"></i>
            </div>

          </div>

          {isRegister && (
            <div className="code-hint">

              <i className="fas fa-info-circle"></i>

              <span>
                Demo:{' '}
                {selectedRole === 'rider'
                  ? 'DRIVER2024'
                  : 'ADMIN2024'}
              </span>

            </div>
          )}

        </div>
      )}

      {/* Password */}
      <div className="form-group password-wrapper">

        <div className="input-icon-wrapper">

          <i className="fas fa-lock input-icon"></i>

          <input
            type={
              showPassword
                ? 'text'
                : 'password'
            }
            className="input-field with-icon"
            placeholder="Password"
            value={password}
            onChange={onPasswordChange}
            required
          />

        </div>

        <button
          type="button"
          className="toggle-password"
          onClick={onTogglePassword}
        >
          <i
            className={
              showPassword
                ? 'fas fa-eye-slash'
                : 'fas fa-eye'
            }
          ></i>
        </button>

      </div>

      {/* Remember me - remembers the email only, never the password */}
      {!isRegister && (
        <div className="form-group remember-me-group">
          <label className="remember-me-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={onRememberMeChange}
            />
            Remember my email
          </label>
        </div>
      )}

      {/* Confirm Password */}
      {isRegister && (
        <div className="form-group password-wrapper">

          <div className="input-icon-wrapper">

            <i className="fas fa-lock input-icon"></i>

            <input
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              className="input-field with-icon"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={onConfirmPasswordChange}
              required
            />

          </div>

        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="action-btn"
        style={{
          background: 'linear-gradient(115deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
          boxShadow: '0 8px 18px rgba(218, 28, 92, 0.25)'
        }}
      >

        {currentRole.requiresCode ? (
          <i className="fas fa-shield-check"></i>
        ) : mode === 'login' ? (
          <i className="fas fa-sign-in-alt"></i>
        ) : (
          <i className="fas fa-user-plus"></i>
        )}

        {getButtonText()}

      </button>

    </form>
  );
};

export default AuthForm;
