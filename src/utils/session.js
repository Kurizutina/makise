export const getDashboardPath = (role) => ({
  customer: '/home',
  driver: '/rider/orders',
  admin: '/admin/dashboard'
}[role] || '/login');

export const setSession = (token, user) => {
  // Replace both values together so a previous account can never be mixed
  // with the account that has just signed in.
  sessionStorage.setItem('otuzanAuthenticated', token);
  sessionStorage.setItem('otuzanUser', JSON.stringify(user));
};

export const clearSession = () => {
  sessionStorage.removeItem('otuzanAuthenticated');
  sessionStorage.removeItem('otuzanUser');
};

export const getSessionUser = () => {
  try {
    if (!sessionStorage.getItem('otuzanAuthenticated')) return null;
    return JSON.parse(sessionStorage.getItem('otuzanUser'));
  } catch {
    return null;
  }
};

export const isAssignedTo = (order, user) => Boolean(
  user?.id != null && order.assignedRider?.id != null
  && String(order.assignedRider.id) === String(user.id)
);
