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
