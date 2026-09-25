import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSessionUser, isAssignedTo } from '../utils/session';
import { CUSTOMER_ACTIVITY_CHANGED } from '../utils/customerProfileSync';
import { broadcastOrderProgressChanged } from '../hooks/useBackendOrders';
import { calculateDeliveryFee, findDeliveryLocation } from '../utils/deliveryRates';

const CustomerActivityContext = createContext(null);
const STORAGE_KEY = 'otuzanCustomerActivity';
const PROFILE_KEY = 'otuzanCustomerProfile';
// Separate key, not folded into STORAGE_KEY: a saved delivery location is a
// per-browser default the customer sets once (like foodpanda/GrabFood's
// header location), not part of the cart/orders/notifications activity log
// those already-established merge/sync mechanisms exist for.
const LOCATION_KEY = 'otuzanDeliveryLocation';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = sessionStorage.getItem('otuzanAuthenticated');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : null;
};

// Patches a single field onto one order in localStorage directly, without
// touching cart/notifications or requiring the calling component to still be
// mounted. Used only for background metadata (backendOrderId) that nothing
// renders - real user-facing order edits go through updateAll instead.
//
// Must bump updatedAt: updateAll's persist()/mergeById() keeps whichever
// copy of an order has the later timestamp, and anything else the customer
// does afterward (open notifications, add to cart, place another order)
// calls updateAll with the React-state copy of this same order, which never
// received this patch (patchStoredOrder writes straight to localStorage,
// bypassing setOrders). Without a newer timestamp on our side, that next
// merge sees a tie and keeps the state copy - silently dropping
// backendOrderId/backendPaymentId and undoing the backend sync this exists
// for. Found live: placing a bill payment then opening the notifications
// panel wiped backendOrderId before the queue-position UI ever saw it.
//
// Also dispatches CUSTOMER_ACTIVITY_CHANGED (the same event
// customerProfileSync.js uses for the identical out-of-band-write problem)
// so the tab that's still mounted picks the patch up immediately instead of
// waiting for some unrelated future updateAll call to happen to merge it in.
const patchStoredOrder = (localOrderId, patch) => {
  const latest = loadActivity();
  const nextOrders = (latest.orders || []).map((order) => order.id === localOrderId
    ? { ...order, ...patch, updatedAt: new Date().toISOString() }
    : order);
  const next = { ...latest, orders: nextOrders };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CUSTOMER_ACTIVITY_CHANGED, { detail: next }));
};

// Best-effort sync to the real backend order API. Catalog-backed orders keep
// their server-verified product/price path; static/custom menu orders send a
// display snapshot so they are still recorded for admin operations and fee
// revenue. Never awaited by callers and never throws: the localStorage write
// already happened and is what the UI actually reflects, so a failure here
// (offline, backend down, brand not yet migrated) changes nothing the
// customer sees. On success, patches the returned backend OrderID onto the
// local order so later status/assignment changes can also be synced.
const syncOrderToBackend = (localOrderId, order, deliveryAddress, serviceFee = 0) => {
  try {
    const items = order?.items || [];
    if (!items.length) return;
    const headers = authHeaders();
    if (!headers || getSessionUser()?.role !== 'customer') return;
    fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(items.every((item) => Number.isInteger(item.productId))
        ? {
          items: items.map((item) => ({ ProductID: item.productId, quantity: item.quantity || 1 })),
          clientOrderId: localOrderId,
          deliveryAddress: deliveryAddress || 'Not provided', serviceFee: Number(serviceFee) || 0
        }
        : {
          customItems: items.map((item) => ({ name: item.name || 'Custom item', quantity: item.quantity || 1, price: Number(item.price) || 0 })),
          source: order.source || 'Otu-Zan', label: order.label || 'Customer order', section: order.section === 'item' ? 'item' : 'food',
          clientOrderId: localOrderId,
          deliveryAddress: deliveryAddress || 'Not provided', serviceFee: Number(serviceFee) || 0
        })
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const backendOrderId = body?.order?.OrderID;
        if (backendOrderId) patchStoredOrder(localOrderId, { backendOrderId });
      })
      .catch(() => {});
  } catch {
    // Swallow anything unexpected - this is a background sync, never the
    // source of truth for what the customer sees.
  }
};

// Same best-effort philosophy: only fires when the order already has a
// backendOrderId (i.e. syncOrderToBackend succeeded for it earlier). Orders
// without one - static-menu brands, custom items, bills - are unaffected.
// applyBackendTruth() overlays the cached poll snapshot onto local orders
// unconditionally (see useBackendOrders.js), so without this, the status
// change we just made locally would render correctly for a moment, then get
// clobbered back to the pre-change backend status until the next 30s poll -
// found live as "cancel doesn't work until I refresh."
const syncStatusToBackend = (backendOrderId, status) => {
  const headers = authHeaders();
  if (!backendOrderId || !headers) return Promise.resolve(false);
  return fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/status`, {
    method: 'PATCH', headers, body: JSON.stringify({ status })
  })
    .then((response) => {
      if (response.ok) broadcastOrderProgressChanged();
      return response.ok;
    })
    .catch(() => false);
};

const syncAssignmentToBackend = (backendOrderId, riderId) => {
  const headers = authHeaders();
  if (!backendOrderId || !headers) return;
  fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/assign`, {
    method: 'PATCH', headers, body: JSON.stringify({ riderId: riderId || null })
  })
    .then((response) => { if (response.ok) broadcastOrderProgressChanged(); })
    .catch(() => {});
};

// Same best-effort philosophy as syncOrderToBackend, but for Pay Bills -
// those orders have no catalog items so they go through POST /api/payments
// instead of POST /api/orders. On success, patches both the backend
// OrderID (so status/assignment sync/override still work like any other
// order) and the PaymentID (so payment verify/reject can be synced too)
// onto the local order.
const syncPaymentToBackend = (localOrderId, details, serviceFee = 0) => {
  try {
    const headers = authHeaders();
    if (!headers || getSessionUser()?.role !== 'customer' || !details) return;
    fetch(`${API_BASE_URL}/api/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        establishment: details.establishment || '',
        billReceiptUrl: details.billReceiptUrl || null,
        billReceiptName: details.billReceiptName || null,
        transferProofUrl: details.transferProofUrl || null,
        transferProofName: details.transferProofName || null,
        serviceFee: Number(serviceFee) || 0
      })
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.orderId) patchStoredOrder(localOrderId, { backendOrderId: body.orderId, backendPaymentId: body.payment?.PaymentID });
      })
      .catch(() => {});
  } catch {
    // Same as syncOrderToBackend - never the source of truth, safe to swallow.
  }
};

const syncPaymentStatusToBackend = (backendPaymentId, status) => {
  const headers = authHeaders();
  if (!backendPaymentId || !headers) return;
  fetch(`${API_BASE_URL}/api/payments/${backendPaymentId}/status`, {
    method: 'PATCH', headers, body: JSON.stringify({ status })
  })
    .then((response) => { if (response.ok) broadcastOrderProgressChanged(); })
    .catch(() => {});
};

const syncNotificationsReadToBackend = () => {
  const headers = authHeaders();
  if (!headers || getSessionUser()?.role !== 'customer') return;
  fetch(`${API_BASE_URL}/api/notifications/read`, { method: 'PATCH', headers }).catch(() => {});
};

const getCustomerSnapshot = () => {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    const user = getSessionUser();
    const customer = user?.role === 'customer'
      ? { ...user, ...(String(profile.id) === String(user.id) || profile.email === user.email ? profile : {}) }
      : profile;
    return {
      customerId: user?.role === 'customer' ? user.id : null,
      customerEmail: customer.email || '',
      customerName: customer.username || 'Customer',
      customerAddress: customer.address || '',
      customerContact: customer.contact || '',
      customerType: customer.userType || 'non_student'
    };
  } catch {
    return { customerName: 'Customer', customerAddress: '' };
  }
};

export const getOrderItemCount = (items = []) => Math.max(
  1,
  items.reduce((total, item) => total + (Number(item.quantity) || 1), 0)
);

export const calculateEstimatedWaitMinutes = (items = []) => (
  Math.min(50, 40 + ((getOrderItemCount(items) - 1) * 2))
);

const getCartOrderLabel = (items) => {
  if (items.length === 1) {
    const quantity = Number(items[0].quantity) || 1;
    const itemName = items[0].name || 'Custom item';
    return quantity > 1 ? `${quantity}pc ${itemName}` : itemName;
  }

  const totalItems = getOrderItemCount(items);
  return `${totalItems} items: ${items[0].name || 'Custom item'} + ${items.length - 1} more`;
};

export const getOrderDisplayLabel = (order) => (
  /cart item/i.test(order.label || '') && order.items?.length
    ? getCartOrderLabel(order.items)
    : order.label
);

const loadActivity = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

// Orders are server-backed, but carts intentionally remain browser-local
// until checkout. The activity blob is shared by every account that uses
// this browser, so cart lines must carry an owner; otherwise a customer who
// signs in after someone else inherits their basket. Old untagged lines are
// treated as a guest cart rather than being assigned to the next account.
const activeCartOwner = () => {
  const user = getSessionUser();
  return user?.role === 'customer' && user.id != null ? `customer:${user.id}` : 'guest';
};

const cartOwner = (item) => item.cartOwner || 'guest';
const cartForActiveOwner = (items = []) => items.filter((item) => cartOwner(item) === activeCartOwner());
const tagCartForActiveOwner = (items = []) => items.map((item) => ({ ...item, cartOwner: activeCartOwner() }));

export const CustomerActivityProvider = ({ children }) => {
  const saved = useMemo(() => loadActivity(), []);
  const [cart, setCart] = useState(() => cartForActiveOwner(saved.cart));
  const [orders, setOrders] = useState((saved.orders || []).filter((order) => {
    const riderName = String(order.assignedRider?.name || '').trim().toLowerCase();
    return riderName !== 'jayson deguzman';
  }));
  const [notifications, setNotifications] = useState(saved.notifications || []);
  const [deliveryLocation, setDeliveryLocationState] = useState(
    () => localStorage.getItem(LOCATION_KEY) || ''
  );
  const setDeliveryLocation = (locationId) => {
    setDeliveryLocationState(locationId);
    if (locationId) localStorage.setItem(LOCATION_KEY, locationId);
    else localStorage.removeItem(LOCATION_KEY);
  };
  // Guards placeOrder/placeCartOrder against rapid repeat clicks. A ref, not
  // state: state updates aren't visible until the next render, so several
  // click handlers firing back-to-back in the same tick (a fast double-tap,
  // or an automated/scripted double-click) would all read the same stale
  // value and all pass a state-based check. Found live during QA: three
  // rapid clicks on "Place Order" created three separate, fully duplicate
  // backend orders. A ref updates immediately, so the second and third call
  // see the lock synchronously, no matter how close together they land.
  const isPlacingOrderRef = useRef(false);
  const guardOrderPlacement = (run) => {
    // Guests can browse and build a cart freely (see CustomerBrowseRoute),
    // but placing an order with no session would create a local-only order
    // that can never reach the backend (syncOrderToBackend/syncPaymentToBackend
    // both require an auth token) - invisible to admin/rider despite looking
    // like a success to the guest. UI call sites already redirect to /login
    // before reaching this point; this is the backstop in case one doesn't.
    if (!getSessionUser()) return null;
    if (isPlacingOrderRef.current) return null;
    isPlacingOrderRef.current = true;
    try {
      return run();
    } finally {
      window.setTimeout(() => { isPlacingOrderRef.current = false; }, 1200);
    }
  };

  useEffect(() => {
    const cleanedOrders = (saved.orders || []).filter((order) => String(order.assignedRider?.name || '').trim().toLowerCase() !== 'jayson deguzman');
    if (cleanedOrders.length !== (saved.orders || []).length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart: saved.cart || [], orders: cleanedOrders, notifications: saved.notifications || [] }));
    }
  }, [saved]);

  useEffect(() => {
    const syncActivity = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        setCart(cartForActiveOwner(next.cart));
        setOrders((next.orders || []).filter((order) => String(order.assignedRider?.name || '').trim().toLowerCase() !== 'jayson deguzman'));
        setNotifications(next.notifications || []);
      } catch {
        // Ignore malformed browser storage values.
      }
    };
    window.addEventListener('storage', syncActivity);
    const syncProfileOrders = (event) => {
      setCart(cartForActiveOwner(event.detail.cart));
      setOrders((event.detail.orders || []).filter((order) => String(order.assignedRider?.name || '').trim().toLowerCase() !== 'jayson deguzman'));
      setNotifications(event.detail.notifications || []);
    };
    window.addEventListener(CUSTOMER_ACTIVITY_CHANGED, syncProfileOrders);
    return () => {
      window.removeEventListener('storage', syncActivity);
      window.removeEventListener(CUSTOMER_ACTIVITY_CHANGED, syncProfileOrders);
    };
  }, []);

  // Merges by id instead of blindly overwriting, so a write from this tab can't
  // erase an order/notification another tab wrote to localStorage in the meantime.
  const mergeById = (ours = [], latest = []) => {
    const getTime = (entry) => Date.parse(entry.updatedAt || entry.createdAt || 0) || 0;
    const byId = new Map(ours.map((entry) => [entry.id, entry]));
    latest.forEach((entry) => {
      const existing = byId.get(entry.id);
      if (!existing || getTime(entry) > getTime(existing)) byId.set(entry.id, entry);
    });
    return Array.from(byId.values()).sort((a, b) => getTime(b) - getTime(a));
  };

  const persist = (nextCart, nextOrders, nextNotifications) => {
    const latest = loadActivity();
    // Preserve cart lines belonging to other signed-in customers (or the
    // guest basket) while replacing only this account's visible basket.
    // This also makes concurrent tabs for the same customer stay in sync.
    const storedCart = [
      ...(latest.cart || []).filter((item) => cartOwner(item) !== activeCartOwner()),
      ...tagCartForActiveOwner(nextCart)
    ];
    const mergedOrders = mergeById(nextOrders, latest.orders || []);
    const mergedNotifications = mergeById(nextNotifications, latest.notifications || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cart: storedCart,
      orders: mergedOrders,
      notifications: mergedNotifications
    }));
    return { orders: mergedOrders, notifications: mergedNotifications };
  };

  const updateAll = (nextCart, nextOrders, nextNotifications) => {
    const merged = persist(nextCart, nextOrders, nextNotifications);
    setCart(nextCart);
    setOrders(merged.orders);
    setNotifications(merged.notifications);
  };

  const addToCart = (item) => {
    const cartId = item.cartId || `${item.source || 'Otu-Zan'}-${item.id}`;
    const existing = cart.find((entry) => entry.cartId === cartId);
    const nextCart = existing
      ? cart.map((entry) => entry.cartId === cartId
        ? { ...entry, quantity: entry.quantity + (item.quantity || 1) }
        : entry)
      : [...cart, { ...item, cartId, quantity: item.quantity || 1, cartOwner: activeCartOwner() }];
    updateAll(nextCart, orders, notifications);
  };

  const updateCartQuantity = (cartId, amount) => {
    const nextCart = cart
      .map((item) => item.cartId === cartId
        ? { ...item, quantity: item.quantity + amount }
        : item)
      .filter((item) => item.quantity > 0);
    updateAll(nextCart, orders, notifications);
  };

  const placeOrder = ({ source, label, items = [], details = null, section = 'food', deliveryLocation = '', customerType = '', orderTime = null }) => guardOrderPlacement(() => {
    customerType = customerType || getCustomerSnapshot().customerType;
    const createdAt = orderTime || new Date().toISOString();
    const estimatedWaitMinutes = calculateEstimatedWaitMinutes(items);
    const customer = getCustomerSnapshot();
    const location = findDeliveryLocation(deliveryLocation || details?.deliveryLocation, customer.customerAddress);
    const fee = calculateDeliveryFee(location, customerType || details?.customerType, createdAt);
    const order = {
      id: `ORD-${Date.now().toString().slice(-7)}`,
      source: source || 'Otu-Zan',
      label: label || 'Customer order',
      items,
      details,
      section,
      ...customer,
      deliveryLocation: location?.id || '',
      deliveryLocationName: location?.name || '',
      customerType: fee.customerType,
      baseDeliveryFee: fee.baseFee,
      nightDeliverySurcharge: fee.surcharge,
      serviceFee: fee.serviceFee,
      surchargeApplied: fee.surchargeApplied,
      estimatedWaitMinutes,
      status: 'pending_rider',
      createdAt
    };
    const notification = {
      id: `NOT-${Date.now()}-${Math.random()}`,
      orderId: order.id,
      title: 'Order request sent',
      message: `${order.label} is waiting for a rider to accept it.`,
      createdAt,
      read: false
    };
    updateAll(cart, [order, ...orders], [notification, ...notifications]);
    if (section === 'bills') {
      syncPaymentToBackend(order.id, details, order.serviceFee);
    } else {
      syncOrderToBackend(order.id, order, customer.customerAddress, order.serviceFee);
    }
    return order;
  });

  const placeCartOrder = (source = null, deliveryLocation = '', customerType = '', orderTime = null) => guardOrderPlacement(() => {
    customerType = customerType || getCustomerSnapshot().customerType;
    const orderItems = source ? cart.filter((item) => item.source === source) : cart;
    if (!orderItems.length) return null;

    const groupedItems = source
      ? [[source, orderItems]]
      : Object.entries(orderItems.reduce((groups, item) => {
        const establishment = item.source || 'Otu-Zan';
        groups[establishment] = [...(groups[establishment] || []), item];
        return groups;
      }, {}));

    const orderTimestamp = orderTime ? Date.parse(orderTime) : Date.now();
    const customer = getCustomerSnapshot();
    const newOrders = groupedItems.map(([establishment, items], index) => {
      const location = findDeliveryLocation(deliveryLocation || items[0]?.details?.deliveryLocation, customer.customerAddress);
      const createdAt = new Date(orderTimestamp + index).toISOString();
      const fee = calculateDeliveryFee(location, customerType || items[0]?.details?.customerType, createdAt);
      return {
      id: `ORD-${(orderTimestamp + index).toString().slice(-7)}`,
      source: establishment,
      label: getCartOrderLabel(items),
      items,
      section: items.every((item) => item.details?.serviceType === 'item') ? 'item' : 'food',
      ...customer,
      deliveryLocation: location?.id || '',
      deliveryLocationName: location?.name || '',
      customerType: fee.customerType,
      baseDeliveryFee: fee.baseFee,
      nightDeliverySurcharge: fee.surcharge,
      serviceFee: fee.serviceFee,
      surchargeApplied: fee.surchargeApplied,
      estimatedWaitMinutes: calculateEstimatedWaitMinutes(items),
      status: 'pending_rider',
        createdAt
      };
    });
    const newNotifications = newOrders.map((order) => ({
      id: `NOT-${order.id}-${Math.random()}`,
      orderId: order.id,
      title: 'Order request sent',
      message: `Your ${order.source} order ${order.id} is waiting for a rider.`,
      createdAt: order.createdAt,
      read: false
    }));
    const nextCart = source ? cart.filter((item) => item.source !== source) : [];
    updateAll(nextCart, [...newOrders, ...orders], [...newNotifications, ...notifications]);
    newOrders.forEach((order) => syncOrderToBackend(order.id, order, customer.customerAddress, order.serviceFee));
    return newOrders[0];
  });

  const markNotificationsRead = () => {
    const nextNotifications = notifications.map((item) => ({ ...item, read: true }));
    updateAll(cart, orders, nextNotifications);
    syncNotificationsReadToBackend();
  };

  // orderRef is usually just an id, but callers may pass the full (possibly
  // backend-synthesized) order object instead - see the fallback branch
  // below for why that matters.
  const updateOrderStatus = (orderRef, status) => {
    const orderId = orderRef?.id ?? orderRef;
    const latest = loadActivity();
    const currentOrders = latest.orders || orders;
    const currentOrder = currentOrders.find((order) => order.id === orderId);
    // No local copy exists for this order - it's one useBackendOrders
    // synthesized straight from the backend because it was placed on a
    // different device (see useBackendOrders.js). There's nothing in
    // localStorage to update, but the order is real, so go straight to the
    // backend using the id it already carries; the next poll picks up the
    // new status. Server-side role/terminal-state checks
    // (OrderController::updateStatus) still apply regardless.
    if (!currentOrder) {
      const backendOrderId = orderRef?.backendOrderId;
      const user = getSessionUser();
      // Owning customer cancelling their own still-unconfirmed order works
      // here too - same cross-device reasoning as admin/rider actions above:
      // orderRef is a synthesized order (see toLocalOrderShape), so it
      // carries the real backend customerId/status even with no local copy.
      const isOwningCustomerCancelling = user?.role === 'customer' && status === 'cancelled'
        && String(orderRef?.customerId) === String(user?.id) && orderRef?.status === 'pending_rider';
      if (!backendOrderId || !(user?.role === 'admin' || user?.role === 'driver' || isOwningCustomerCancelling)) return Promise.resolve(false);
      return syncStatusToBackend(backendOrderId, status);
    }
    if (currentOrder.status === status) return Promise.resolve(true);
    const user = getSessionUser();
    // A customer may cancel their own order while it's still pending_rider -
    // same server-side rule as OrderController::updateStatus. Anything past
    // that point (confirmed onward) is out of their hands.
    const isOwningCustomerCancelling = user?.role === 'customer' && status === 'cancelled'
      && String(currentOrder.customerId) === String(user?.id) && currentOrder.status === 'pending_rider';
    if (user?.role !== 'admin' && !(user?.role === 'driver' && isAssignedTo(currentOrder, user)) && !isOwningCustomerCancelling) return Promise.resolve(false);
    if (['delivered', 'cancelled'].includes(currentOrder.status)) return Promise.resolve(false);

    const statusContent = {
      confirmed: ['Order accepted', `${currentOrder.label} was accepted. Tracking is now available.`],
      cancelled: ['Order cancelled', `${currentOrder.label} was cancelled.`],
      preparing: ['Order is being prepared', `${currentOrder.label} is now being prepared.`],
      out_for_delivery: ['Order is out for delivery', `${currentOrder.label} is on the way.`],
      delivered: ['Order delivered', `${currentOrder.label} has been delivered.`]
    };
    const content = statusContent[status];
    if (!content) return Promise.resolve(false);

    const updatedAt = new Date().toISOString();
    const estimatedWaitMinutes = currentOrder.estimatedWaitMinutes
      || calculateEstimatedWaitMinutes(currentOrder.items);
    const confirmationTiming = status === 'confirmed' ? {
      confirmedAt: updatedAt,
      estimatedCompletionAt: new Date(
        Date.parse(updatedAt) + (estimatedWaitMinutes * 60 * 1000)
      ).toISOString()
    } : {};
    const nextOrders = currentOrders.map((order) => order.id === orderId
      ? { ...order, status, updatedAt, estimatedWaitMinutes, ...confirmationTiming }
      : order);
    // Backend-linked orders get their notification from the server now
    // (OrderController::notifyStatusChange, step 1g) - the customer's own
    // poll picks it up regardless of which device they're on. Creating one
    // here too would double it up for anyone testing admin/customer in the
    // same browser. Orders with no backend link (legacy local-only types)
    // still need this - there's no server-side equivalent for those.
    const nextNotifications = currentOrder.backendOrderId
      ? (latest.notifications || notifications)
      : [{
        id: `NOT-${Date.now()}-${Math.random()}`,
        orderId,
        title: content[0],
        message: content[1],
        createdAt: updatedAt,
        read: false,
        type: status === 'cancelled' ? 'cancelled' : 'status'
      }, ...(latest.notifications || notifications)];
    updateAll(latest.cart || cart, nextOrders, nextNotifications);
    // Local-only legacy orders have no server request to wait for. Backend
    // orders return a success flag so callers can keep an optimistic status
    // visible while a stale poll is still in flight, then roll it back if
    // the server rejects the transition.
    return currentOrder.backendOrderId
      ? syncStatusToBackend(currentOrder.backendOrderId, status)
      : Promise.resolve(true);
  };

  const assignOrderToRider = (orderRef, rider) => {
    if (getSessionUser()?.role !== 'admin') return;
    const orderId = orderRef?.id ?? orderRef;
    const latest = loadActivity();
    const currentOrder = (latest.orders || orders).find((order) => order.id === orderId);
    // Same backend-only fallback as updateOrderStatus above.
    if (!currentOrder) {
      const backendOrderId = orderRef?.backendOrderId;
      if (!backendOrderId) return;
      syncAssignmentToBackend(backendOrderId, rider?.id);
      return;
    }
    const nextOrders = (latest.orders || orders).map((order) => order.id === orderId
      ? { ...order, assignedRider: rider || null, updatedAt: new Date().toISOString() }
      : order);
    updateAll(latest.cart || cart, nextOrders, latest.notifications || notifications);
    syncAssignmentToBackend(currentOrder?.backendOrderId, rider?.id);
  };

  const updatePaymentStatus = (orderRef, paymentStatus) => {
    if (getSessionUser()?.role !== 'admin' || !['verified', 'rejected'].includes(paymentStatus)) return;
    const orderId = orderRef?.id ?? orderRef;
    const latest = loadActivity();
    const currentOrder = (latest.orders || orders).find((order) => order.id === orderId);
    // Same backend-only fallback as updateOrderStatus above - but keyed by
    // PaymentID (not OrderID), which only the passed-in order object has;
    // there's no way to derive it from the id string alone.
    if (!currentOrder) {
      const backendPaymentId = orderRef?.backendPaymentId;
      if (!backendPaymentId) return;
      syncPaymentStatusToBackend(backendPaymentId, paymentStatus);
      return;
    }
    if (currentOrder.section !== 'bills') return;
    const nextOrders = (latest.orders || orders).map((order) => order.id === orderId
      ? { ...order, details: { ...order.details, paymentStatus }, updatedAt: new Date().toISOString() }
      : order);
    // Same reasoning as updateOrderStatus above - a backend-linked payment
    // gets its notification from PaymentController::updateStatus instead.
    const nextNotifications = currentOrder.backendPaymentId
      ? (latest.notifications || notifications)
      : [{ id: `NOT-${Date.now()}-${Math.random()}`, orderId, title: `Payment ${paymentStatus}`, message: `Your payment for ${currentOrder.source} was ${paymentStatus}.`, createdAt: new Date().toISOString(), read: false, type: paymentStatus === 'rejected' ? 'cancelled' : 'status' }, ...(latest.notifications || notifications)];
    updateAll(latest.cart || cart, nextOrders, nextNotifications);
    syncPaymentStatusToBackend(currentOrder.backendPaymentId, paymentStatus);
  };

  const value = useMemo(() => ({
    cart,
    orders,
    notifications,
    deliveryLocation,
    setDeliveryLocation,
    addToCart,
    updateCartQuantity,
    placeOrder,
    placeCartOrder,
    markNotificationsRead,
    updateOrderStatus,
    assignOrderToRider,
    updatePaymentStatus
  // State is intentionally included so consumers always receive current actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cart, orders, notifications, deliveryLocation]);

  return <CustomerActivityContext.Provider value={value}>{children}</CustomerActivityContext.Provider>;
};

export const useCustomerActivity = () => {
  const context = useContext(CustomerActivityContext);
  if (!context) throw new Error('useCustomerActivity must be used inside CustomerActivityProvider');
  const user = getSessionUser();
  if (user?.role === 'customer') {
    const orders = context.orders.filter((order) => String(order.customerId) === String(user.id));
    const orderIds = new Set(orders.map((order) => order.id));
    return {
      ...context,
      orders,
      notifications: context.notifications.filter((notification) => orderIds.has(notification.orderId))
    };
  }
  if (user?.role === 'driver') {
    const orders = context.orders.filter((order) => isAssignedTo(order, user));
    const orderIds = new Set(orders.map((order) => order.id));
    return {
      ...context,
      cart: [],
      orders,
      notifications: context.notifications.filter((notification) => orderIds.has(notification.orderId))
    };
  }
  // Admin intentionally sees every order/notification unfiltered - that's
  // the whole point of the admin dashboard, not a gap.
  if (user?.role === 'admin') return context;
  // No session: a guest browsing, or a customer who just logged out (or
  // closed the tab last time without logging out - sessionStorage clears on
  // its own then too). otuzanCustomerActivity isn't scoped per account, so
  // without this branch a guest fell through to the same unfiltered
  // `context` as admin and saw whichever customer's orders/notifications
  // were last synced to this browser (found live, 9/23 - a real cross-user
  // data exposure, not just stale UI). Cart is left untouched: guest
  // browsing intentionally lets a guest build a cart before being asked to
  // log in at checkout, and that's not customer-identifying data.
  return { ...context, orders: [], notifications: [] };
};
