import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CustomerActivityContext = createContext(null);
const STORAGE_KEY = 'otuzanCustomerActivity';
const PROFILE_KEY = 'otuzanCustomerProfile';

const getCustomerSnapshot = () => {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    return {
      customerName: profile.username || 'Customer',
      customerAddress: profile.address || ''
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

export const CustomerActivityProvider = ({ children }) => {
  const saved = loadActivity();
  const [cart, setCart] = useState(saved.cart || []);
  const [orders, setOrders] = useState(saved.orders || []);
  const [notifications, setNotifications] = useState(saved.notifications || []);

  useEffect(() => {
    const syncActivity = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        setCart(next.cart || []);
        setOrders(next.orders || []);
        setNotifications(next.notifications || []);
      } catch {
        // Ignore malformed browser storage values.
      }
    };
    window.addEventListener('storage', syncActivity);
    return () => window.removeEventListener('storage', syncActivity);
  }, []);

  const persist = (nextCart, nextOrders, nextNotifications) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cart: nextCart,
      orders: nextOrders,
      notifications: nextNotifications
    }));
  };

  const updateAll = (nextCart, nextOrders, nextNotifications) => {
    setCart(nextCart);
    setOrders(nextOrders);
    setNotifications(nextNotifications);
    persist(nextCart, nextOrders, nextNotifications);
  };

  const addToCart = (item) => {
    const cartId = item.cartId || `${item.source || 'Otu-Zan'}-${item.id}`;
    const existing = cart.find((entry) => entry.cartId === cartId);
    const nextCart = existing
      ? cart.map((entry) => entry.cartId === cartId
        ? { ...entry, quantity: entry.quantity + (item.quantity || 1) }
        : entry)
      : [...cart, { ...item, cartId, quantity: item.quantity || 1 }];
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

  const placeOrder = ({ source, label, items = [], details = null, section = 'food' }) => {
    const createdAt = new Date().toISOString();
    const estimatedWaitMinutes = calculateEstimatedWaitMinutes(items);
    const customer = getCustomerSnapshot();
    const order = {
      id: `ORD-${Date.now().toString().slice(-7)}`,
      source: source || 'Otu-Zan',
      label: label || 'Customer order',
      items,
      details,
      section,
      ...customer,
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
    return order;
  };

  const placeCartOrder = (source = null) => {
    const orderItems = source ? cart.filter((item) => item.source === source) : cart;
    if (!orderItems.length) return null;

    const groupedItems = source
      ? [[source, orderItems]]
      : Object.entries(orderItems.reduce((groups, item) => {
        const establishment = item.source || 'Otu-Zan';
        groups[establishment] = [...(groups[establishment] || []), item];
        return groups;
      }, {}));

    const orderTime = Date.now();
    const customer = getCustomerSnapshot();
    const newOrders = groupedItems.map(([establishment, items], index) => ({
      id: `ORD-${(orderTime + index).toString().slice(-7)}`,
      source: establishment,
      label: getCartOrderLabel(items),
      items,
      section: items.every((item) => item.details?.serviceType === 'item') ? 'item' : 'food',
      ...customer,
      estimatedWaitMinutes: calculateEstimatedWaitMinutes(items),
      status: 'pending_rider',
      createdAt: new Date(orderTime + index).toISOString()
    }));
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
    return newOrders[0];
  };

  const markNotificationsRead = () => {
    const nextNotifications = notifications.map((item) => ({ ...item, read: true }));
    updateAll(cart, orders, nextNotifications);
  };

  const updateOrderStatus = (orderId, status) => {
    const currentOrder = orders.find((order) => order.id === orderId);
    if (!currentOrder || currentOrder.status === status) return;

    const statusContent = {
      confirmed: ['Order accepted', `A rider accepted ${currentOrder.label}. Tracking is now available.`],
      cancelled: ['Order cancelled', `${currentOrder.label} was cancelled by the rider.`],
      preparing: ['Order is being prepared', `${currentOrder.label} is now being prepared.`],
      out_for_delivery: ['Order is out for delivery', `${currentOrder.label} is on the way.`],
      delivered: ['Order delivered', `${currentOrder.label} has been delivered.`]
    };
    const content = statusContent[status];
    if (!content) return;

    const updatedAt = new Date().toISOString();
    const estimatedWaitMinutes = currentOrder.estimatedWaitMinutes
      || calculateEstimatedWaitMinutes(currentOrder.items);
    const confirmationTiming = status === 'confirmed' ? {
      confirmedAt: updatedAt,
      estimatedCompletionAt: new Date(
        Date.parse(updatedAt) + (estimatedWaitMinutes * 60 * 1000)
      ).toISOString()
    } : {};
    const nextOrders = orders.map((order) => order.id === orderId
      ? { ...order, status, updatedAt, estimatedWaitMinutes, ...confirmationTiming }
      : order);
    const notification = {
      id: `NOT-${Date.now()}-${Math.random()}`,
      orderId,
      title: content[0],
      message: content[1],
      createdAt: updatedAt,
      read: false,
      type: status === 'cancelled' ? 'cancelled' : 'status'
    };
    updateAll(cart, nextOrders, [notification, ...notifications]);
  };

  const assignOrderToRider = (orderId, rider) => {
    const nextOrders = orders.map((order) => order.id === orderId
      ? { ...order, assignedRider: rider || null }
      : order);
    updateAll(cart, nextOrders, notifications);
  };

  const value = useMemo(() => ({
    cart,
    orders,
    notifications,
    addToCart,
    updateCartQuantity,
    placeOrder,
    placeCartOrder,
    markNotificationsRead,
    updateOrderStatus,
    assignOrderToRider
  // State is intentionally included so consumers always receive current actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cart, orders, notifications]);

  return <CustomerActivityContext.Provider value={value}>{children}</CustomerActivityContext.Provider>;
};

export const useCustomerActivity = () => {
  const context = useContext(CustomerActivityContext);
  if (!context) throw new Error('useCustomerActivity must be used inside CustomerActivityProvider');
  return context;
};
