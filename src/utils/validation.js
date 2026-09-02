import { ROLES, VALID_CODES } from '../config/roles';

export const validateAccessCode = (
  selectedRole,
  accessCode,
  setMessage
) => {
  const currentRole = ROLES[selectedRole.toUpperCase()];

  if (!currentRole.requiresCode) {
    return true;
  }

  if (!accessCode.trim()) {
    setMessage({
      type: 'error',
      text: `Please enter your ${currentRole.codeLabel}`
    });

    return false;
  }

  const validCode = VALID_CODES[selectedRole];

  if (accessCode !== validCode) {
    setMessage({
      type: 'error',
      text: `Invalid ${currentRole.codeLabel}. Please try again.`
    });

    return false;
  }

  return true;
};


export const validateAdditionalFields = (
  mode,
  selectedRole,
  fields,
  setMessage
) => {
  if (mode === 'login') {
    return true;
  }

  const {
    username,
    name,
    address,
    contactNumber
  } = fields;

  if (selectedRole === 'customer') {
    if (!username.trim()) {
      setMessage({
        type: 'error',
        text: 'Username is required for customers'
      });
      return false;
    }

    if (!address.trim()) {
      setMessage({
        type: 'error',
        text: 'Address is required for delivery'
      });
      return false;
    }

    if (!contactNumber.trim()) {
      setMessage({
        type: 'error',
        text: 'Contact number is required'
      });
      return false;
    }
  }

  if (
    selectedRole === 'rider' ||
    selectedRole === 'admin'
  ) {
    if (!name.trim()) {
      setMessage({
        type: 'error',
        text: 'Full name is required'
      });
      return false;
    }

    if (!contactNumber.trim()) {
      setMessage({
        type: 'error',
        text: 'Contact number is required'
      });
      return false;
    }
  }

  return true;
};
