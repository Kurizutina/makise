export const ROLES = {
  CUSTOMER: {
    key: 'customer',
    label: 'Customer',
    icon: 'fa-solid fa-user',
    color: '#F9C12F',
    requiresCode: false,
    fields: ['username', 'address', 'contactNumber']
  },

  RIDER: {
    key: 'rider',
    label: 'Rider',
    icon: 'fa-solid fa-truck-fast',
    color: '#F15A29',
    requiresCode: true,
    codeLabel: 'Rider Access Code',
    fields: ['name', 'contactNumber']
  },

  ADMIN: {
    key: 'admin',
    label: 'Admin',
    icon: 'fa-solid fa-shield-halved',
    color: '#DA1C5C',
    requiresCode: true,
    codeLabel: 'Admin Access Code',
    fields: ['name', 'contactNumber']
  }
};

export const VALID_CODES = {
  rider: 'DRIVER2024',
  admin: 'ADMIN2024'
};
