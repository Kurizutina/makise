import { useEffect, useState } from 'react';
import { toUtcIso } from '../utils/backendTime';

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
    // 30s, not 15s: this now also runs on every customer-facing page (added
    // in step 1f, for real queue positions), on top of the admin and rider
    // dashboards that already polled. The local dev backend (php artisan
    // serve) has very limited request concurrency - confirmed directly, 8
    // concurrent requests queue up to ~2.5s for the last one - so with 3
    // independent pollers now instead of 2, halving the request rate here
    // measurably reduces how often a real click gets stuck behind polling
    // traffic. 30s of staleness on order status is an acceptable tradeoff;
    // a stuck button on every click is not.
    const poll = window.setInterval(load, 30000);
    return () => { controller.abort(); window.clearInterval(poll); };
  }, [endpoint]);

  return backendOrdersById;
};

// Builds a full local-shaped order straight from a raw backend order - for
// when the backend knows about an order this browser's own localStorage
// never saw at all (it was placed from a different device/browser). Without
// this, admin/rider dashboards only ever show orders that happen to already
// exist locally, which on separate real devices (the actual deployment:
// admin at the counter, riders and customers each on their own phone) means
// staff would see nothing a customer placed from their own device, despite
// the backend having the real data all along.
//
// serviceFee is a known gap, not an oversight: the delivery/service fee is
// computed entirely client-side (utils/deliveryRates.js) and never sent to
// or stored by the backend - Orders.TotalPrice is just the product total.
// A synthesized order has no way to recover it, so revenue totals that
// include cross-device orders will undercount until the backend persists
// it too (tracked in TODO.md).
const toLocalOrderShape = (backend) => {
  const payment = backend.payments?.[0];
  const isBill = Boolean(payment);
  const brand = backend.items?.[0]?.product?.brand;
  const source = isBill ? (payment.PaymentName || 'Bill payment') : (brand?.BrandName || 'Otu-Zan');
  const section = isBill ? 'bills' : (brand?.service?.ServiceType === 'item' ? 'item' : 'food');
  let paymentNote = {};
  if (isBill) {
    try { paymentNote = JSON.parse(payment.PaymentNote || '{}'); } catch { paymentNote = {}; }
  }
  return {
    id: `BACKEND-${backend.OrderID}`,
    backendOrderId: backend.OrderID,
    backendPaymentId: payment?.PaymentID ?? null,
    source,
    label: isBill ? `${source} bill payment` : `${source} order`,
    section,
    items: (backend.items || []).map((item) => ({
      productId: item.ProductID,
      name: item.product?.ProductName || 'Item',
      price: Number(item.OrderItemPrice) || 0,
      quantity: item.ProductQuantity || 1
    })),
    details: isBill ? {
      establishment: source,
      paymentStatus: payment.PaymentStatus,
      billReceiptUrl: paymentNote.billReceiptUrl || null,
      billReceiptName: paymentNote.billReceiptName || null,
      transferProofUrl: paymentNote.transferProofUrl || null,
      transferProofName: paymentNote.transferProofName || null
    } : null,
    customerId: backend.UserID ?? null,
    customerName: backend.user?.UserName || '',
    customerContact: backend.user?.Contact || '',
    customerAddress: backend.DeliveryAddress || backend.user?.Address || '',
    customerEmail: backend.user?.Email || '',
    status: backend.DeliveryStatus,
    assignedRider: backend.rider ? { id: backend.rider.UserID, name: backend.rider.UserName } : null,
    queuePosition: backend.queuePosition ?? null,
    serviceFee: 0,
    createdAt: toUtcIso(backend.OrderDate),
    updatedAt: toUtcIso(backend.OrderDate)
  };
};

// Overrides status/assignedRider/paymentStatus/queuePosition with the
// backend's version wherever a local order has a matching backendOrderId
// (i.e. was created through the catalog-backed or Pay Bills sync in
// CustomerActivityContext) - this is what stops a customer from spoofing an
// order as delivered/reassigned/paid by editing their own browser's
// localStorage. queuePosition is the order's real, live rank among every
// currently-waiting order backend-wide (null once it's been
// confirmed/declined) - replaces the old flat per-order formula that had no
// idea how busy the queue actually was.
//
// Also unions in every backend order that ISN'T already in localOrders -
// see toLocalOrderShape above for why that matters. Orders with no backend
// counterpart at all (static-menu brands, custom items - never synced,
// same as before this existed) pass through untouched.
export const applyBackendTruth = (orders, backendOrdersById) => {
  const matchedBackendIds = new Set();
  const overlaid = orders.map((order) => {
    const backend = order.backendOrderId ? backendOrdersById[order.backendOrderId] : null;
    if (!backend) return order;
    matchedBackendIds.add(String(backend.OrderID));
    const payment = backend.payments?.[0];
    return {
      ...order,
      status: backend.DeliveryStatus,
      assignedRider: backend.rider ? { id: backend.rider.UserID, name: backend.rider.UserName } : null,
      details: payment ? { ...order.details, paymentStatus: payment.PaymentStatus } : order.details,
      queuePosition: backend.queuePosition ?? null
    };
  });
  const unmatched = Object.values(backendOrdersById)
    .filter((backend) => !matchedBackendIds.has(String(backend.OrderID)))
    .map(toLocalOrderShape);
  return [...overlaid, ...unmatched];
};
