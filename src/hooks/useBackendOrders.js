import { useEffect, useState } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Polls the real backend order API and returns a lookup of backend orders by
// their OrderID. Returns {} (safe no-op) if there's no session or the
// request fails - callers should treat a missing entry as "no backend order
// for this one yet" and fall back to whatever they already had.
export const useBackendOrders = (endpoint) => {
  const [backendOrdersById, setBackendOrdersById] = useState({});

  useEffect(() => {
    const token = sessionStorage.getItem('otuzanAuthenticated');
    if (!token) return undefined;
    const controller = new AbortController();
    const load = () => fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.data) return;
        const byId = {};
        body.data.forEach((order) => { byId[order.OrderID] = order; });
        setBackendOrdersById(byId);
      })
      .catch(() => {});
    load();
    const poll = window.setInterval(load, 15000);
    return () => { controller.abort(); window.clearInterval(poll); };
  }, [endpoint]);

  return backendOrdersById;
};

// Overrides status/assignedRider/paymentStatus with the backend's version
// wherever an order has a matching backendOrderId (i.e. was created through
// the catalog-backed or Pay Bills sync in CustomerActivityContext). This is
// what stops a customer from spoofing an order as delivered/reassigned/paid
// by editing their own browser's localStorage - rider/admin views now show
// what the server actually has for any order the server actually knows
// about. Orders without a backendOrderId (static-menu brands, custom items)
// pass through untouched, same as before this existed.
export const applyBackendTruth = (orders, backendOrdersById) => orders.map((order) => {
  const backend = order.backendOrderId ? backendOrdersById[order.backendOrderId] : null;
  if (!backend) return order;
  const payment = backend.payments?.[0];
  return {
    ...order,
    status: backend.DeliveryStatus,
    assignedRider: backend.rider ? { id: backend.rider.UserID, name: backend.rider.UserName } : null,
    details: payment ? { ...order.details, paymentStatus: payment.PaymentStatus } : order.details
  };
});
