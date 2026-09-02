import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CustomerActivityContext = createContext(null);
const STORAGE_KEY = 'otuzanCustomerActivity';

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

  const placeOrder = ({ source, label, items = [], details = null }) => {
    const createdAt = new Date().toISOString();
    const order = {
      id: `ORD-${Date.now().toString().slice(-7)}`,
      source: source || 'Otu-Zan',
      label: label || 'Customer order',
      items,
      details,
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
    const order = {
      id: `ORD-${Date.now().toString().slice(-7)}`,
      source: source || 'Multiple establishments',
      label: `${orderItems.reduce((total, item) => total + item.quantity, 0)} cart item(s)`,
      items: orderItems,
      status: 'pending_rider',
      createdAt: new Date().toISOString()
    };
    const notification = {
      id: `NOT-${Date.now()}-${Math.random()}`,
      orderId: order.id,
      title: 'Order request sent',
      message: `Your cart order ${order.id} is waiting for a rider.`,
      createdAt: order.createdAt,
      read: false
    };
    const nextCart = source ? cart.filter((item) => item.source !== source) : [];
    updateAll(nextCart, [order, ...orders], [notification, ...notifications]);
    return order;
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
    const nextOrders = orders.map((order) => order.id === orderId
      ? { ...order, status, updatedAt }
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

  const value = useMemo(() => ({
    cart,
    orders,
    notifications,
    addToCart,
    updateCartQuantity,
    placeOrder,
    placeCartOrder,
    markNotificationsRead,
    updateOrderStatus
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
