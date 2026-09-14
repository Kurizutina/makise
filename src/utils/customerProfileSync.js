export const CUSTOMER_ACTIVITY_CHANGED = 'otuzan:customer-activity-changed';

// Match stable account IDs, never names or addresses shared by other customers.
export const syncCustomerOrders = (profile) => {
  if (profile?.role !== 'customer' || profile.id == null) return;
  const key = 'otuzanCustomerActivity';
  let activity;
  try { activity = JSON.parse(localStorage.getItem(key)); } catch { return; }
  if (!Array.isArray(activity?.orders)) return;
  let changed = false;
  const orders = activity.orders.map((order) => {
    if (order.customerId == null || String(order.customerId) !== String(profile.id)) return order;
    if (order.customerName === profile.username && order.customerAddress === (profile.address || '') && order.customerEmail === profile.email) return order;
    changed = true;
    return { ...order, customerName: profile.username, customerAddress: profile.address || '', customerEmail: profile.email };
  });
  if (!changed) return;
  const next = { ...activity, orders };
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CUSTOMER_ACTIVITY_CHANGED, { detail: next }));
};
