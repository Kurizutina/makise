import { useEffect, useState } from 'react';
import { toUtcIso } from '../utils/backendTime';
import { catalogImageUrl } from '../utils/catalog';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
// Status is work-critical while a delivery is active. Two seconds is quick
// enough to feel live across separate phones without requiring a WebSocket
// server, and the poller below never overlaps requests.
const ACTIVE_ORDER_REFRESH_MS = 2000;

// Fired by CustomerActivityContext right after a status/assignment/payment
// change it made is confirmed by the backend, so every useBackendOrders
// poller on the page can catch up immediately instead of waiting out its
// interval. See ORDERS_CHANGED_EVENT usage below for why this exists -
// applyBackendTruth() overlays this cached snapshot onto local orders
// unconditionally, so without this a customer's own optimistic local
// change (e.g. cancelling their own order) gets visibly clobbered back to
// the stale backend status for up to 30s, until the interval happens to
// fire, which read like "cancel doesn't work until I refresh."
export const ORDERS_CHANGED_EVENT = 'otuzan:orders-changed';
export const ORDER_PROGRESS_CHANGED_STORAGE_KEY = 'otuzan:order-progress-changed';

// Custom browser events do not leave the tab that dispatched them. Mirror a
// confirmed server update through localStorage as well, so a customer and a
// rider signed in through different tabs immediately refresh each other's
// server-backed order view. The regular poll remains the fallback for
// separate devices and for browsers where storage is unavailable.
export const broadcastOrderProgressChanged = () => {
  window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
  try {
    localStorage.setItem(ORDER_PROGRESS_CHANGED_STORAGE_KEY, String(Date.now()));
  } catch {
    // Private/storage-restricted browsers still receive the same-tab event
    // and the scheduled backend refresh.
  }
};

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
    let inFlight = false;
    // A rider can confirm an order while the customer's previous poll is
    // still in flight. Do not discard the explicit refresh in that case:
    // otherwise that old pending_rider response wins and the tracker can
    // remain on "Waiting for rider" until a later interval happens.
    let refreshQueued = false;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      if (inFlight) {
        refreshQueued = true;
        return;
      }
      inFlight = true;
      fetch(`${API_BASE_URL}${endpoint}`, {
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
      .catch(() => {})
      .finally(() => {
        inFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          load();
        }
      });
    };
    load();
    // Status changes are made by riders/admins on separate devices. A short
    // poll keeps customer tracking in sync even though those devices cannot
    // dispatch a shared browser event.
    const poll = window.setInterval(load, ACTIVE_ORDER_REFRESH_MS);
    window.addEventListener(ORDERS_CHANGED_EVENT, load);
    const refreshFromAnotherTab = (event) => {
      if (event.key === ORDER_PROGRESS_CHANGED_STORAGE_KEY) load();
    };
    window.addEventListener('storage', refreshFromAnotherTab);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      controller.abort();
      window.clearInterval(poll);
      window.removeEventListener(ORDERS_CHANGED_EVENT, load);
      window.removeEventListener('storage', refreshFromAnotherTab);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
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
// Exported so any purely backend-driven view (e.g. the admin History tab's
// own paginated fetch) can reuse the exact same shape-conversion instead of
// duplicating it - it only ever needs fields indexAll()/index() already
// eager-load (items.product.brand.service, user, rider, payments) plus
// queuePosition, which both those endpoints attach.
export const toLocalOrderShape = (backend) => {
  const payment = backend.payments?.[0];
  const isBill = Boolean(payment);
  const brand = backend.items?.[0]?.product?.brand;
  const snapshot = backend.OrderSnapshot || {};
  const source = isBill ? (payment.PaymentName || 'Bill payment') : (snapshot.source || brand?.BrandName || 'Otu-Zan');
  const section = isBill ? 'bills' : (snapshot.section || (brand?.service?.ServiceType === 'item' ? 'item' : 'food'));
  let paymentNote = {};
  if (isBill) {
    try { paymentNote = JSON.parse(payment.PaymentNote || '{}'); } catch { paymentNote = {}; }
  }
  return {
    id: `BACKEND-${backend.OrderID}`,
    clientOrderId: snapshot.clientOrderId || null,
    backendOrderId: backend.OrderID,
    backendPaymentId: payment?.PaymentID ?? null,
    source,
    label: isBill ? `${source} bill payment` : (snapshot.label || `${source} order`),
    section,
    items: (backend.items?.length ? backend.items : (snapshot.items || [])).map((item) => ({
      productId: item.ProductID,
      name: item.product?.ProductName || item.name || 'Item',
      price: Number(item.OrderItemPrice ?? item.price) || 0,
      quantity: item.ProductQuantity || 1,
      image: catalogImageUrl(item.product?.ImagePath)
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
    serviceFee: Number(backend.ServiceFee) || 0,
    createdAt: toUtcIso(backend.OrderDate),
    updatedAt: toUtcIso(backend.StatusUpdatedAt || backend.OrderDate)
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
  const backendOrders = Object.values(backendOrdersById);
  const overlaid = orders.map((order) => {
    // backendOrderId is the normal, immediate link. clientOrderId is the
    // durable fallback for the small window where POST /orders succeeds but
    // the browser is interrupted before it can save that server ID.
    let backend = order.backendOrderId
      ? backendOrdersById[order.backendOrderId]
      : backendOrders.find((candidate) => String(candidate.OrderSnapshot?.clientOrderId || '') === String(order.id));
    // Repair cards created before clientOrderId existed as well. This only
    // considers the same customer, store, and a two-minute creation window;
    // it lets an already-confirmed item delivery replace its stranded local
    // pending card without conflating ordinary orders.
    if (!backend && !order.backendOrderId && order.status === 'pending_rider') {
      const localCreatedAt = Date.parse(order.createdAt);
      backend = backendOrders.find((candidate) => {
        const source = candidate.OrderSnapshot?.source || candidate.items?.[0]?.product?.brand?.BrandName || 'Otu-Zan';
        return String(candidate.UserID) === String(order.customerId)
          && source === order.source
          && Number.isFinite(localCreatedAt)
          && Math.abs(Date.parse(candidate.OrderDate) - localCreatedAt) <= 120000;
      });
    }
    if (!backend) return order;
    matchedBackendIds.add(String(backend.OrderID));
    const payment = backend.payments?.[0];
    return {
      ...order,
      status: backend.DeliveryStatus,
      assignedRider: backend.rider ? { id: backend.rider.UserID, name: backend.rider.UserName } : null,
      details: payment ? { ...order.details, paymentStatus: payment.PaymentStatus } : order.details,
      queuePosition: backend.queuePosition ?? null,
      // StatusUpdatedAt is the backend's clock for rider/admin actions.
      // Keeping it on the displayed order makes the progress estimate start
      // from confirmation instead of from a stale local-storage timestamp.
      updatedAt: toUtcIso(backend.StatusUpdatedAt || backend.OrderDate)
    };
  });
  const unmatched = Object.values(backendOrdersById)
    .filter((backend) => !matchedBackendIds.has(String(backend.OrderID)))
    .map(toLocalOrderShape);
  return [...overlaid, ...unmatched];
};
