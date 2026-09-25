import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  calculateEstimatedWaitMinutes,
  getOrderDisplayLabel,
  useCustomerActivity
} from '../../context/CustomerActivityContext';
import './RiderDashboard.css';
import OrderCustomerDetails from '../../components/common/OrderCustomerDetails/OrderCustomerDetails';
import { clearSession, getSessionUser, isAssignedTo } from '../../utils/session';
import { applyBackendTruth, useBackendOrders } from '../../hooks/useBackendOrders';
import { apiAssetUrl } from '../../utils/catalog';
import { remainsVisibleToday } from '../../utils/backendTime';
import OrderChat from '../../components/common/OrderChat/OrderChat';

const sections = [
  { key: 'food', label: 'Food Delivery', icon: 'fa-utensils' },
  { key: 'item', label: 'Item Delivery', icon: 'fa-box' },
  { key: 'bills', label: 'Pay Bills', icon: 'fa-file-invoice-dollar' }
];

const nextStatuses = {
  confirmed: ['preparing', 'Start Preparing'],
  preparing: ['out_for_delivery', 'Mark Out for Delivery'],
  out_for_delivery: ['delivered', 'Mark Delivered']
};

const statusLabels = {
  pending_rider: 'Awaiting response', confirmed: 'Confirmed', preparing: 'Preparing',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled'
};

const PaymentDocument = ({ url, name, type, label, onZoom }) => {
  if (!url) return null;
  const documentUrl = apiAssetUrl(url);
  const isPdf = type === 'application/pdf' || /\.pdf(?:$|\?)/i.test(documentUrl);
  const alt = `Uploaded ${label}: ${name || 'document'}`;
  // A PDF can't be zoomed as an image - that case still opens in a new tab
  // (browsers render PDFs natively there). An image now zooms in place
  // instead, so reviewing it doesn't navigate the rider away from the order.
  if (isPdf) {
    return <a className="rider-payment-image" href={documentUrl} target="_blank" rel="noreferrer"><span className="rider-payment-file"><i className="fa-solid fa-file-pdf" /></span><span>{label}: {name || 'View document'}<small>Open to view</small></span></a>;
  }
  return <button type="button" className="rider-payment-image" onClick={() => onZoom({ url: documentUrl, alt })}><img src={documentUrl} alt={alt} /><span>{label}: {name || 'View document'}<small>Tap to zoom</small></span></button>;
};

const formatEstimatedWait = (order, now) => {
  const estimatedMinutes = order.estimatedWaitMinutes
    || calculateEstimatedWaitMinutes(order.items);
  if (order.status === 'pending_rider') {
    if (Number.isInteger(order.queuePosition)) {
      const ahead = order.queuePosition - 1;
      return ahead > 0 ? `${ahead} ahead in queue • ~${estimatedMinutes} min after confirmation` : `Next in queue • ~${estimatedMinutes} min after confirmation`;
    }
    return `${estimatedMinutes} min after confirmation`;
  }
  if (order.status === 'cancelled') return 'Cancelled';
  if (order.status === 'delivered') return 'Completed';

  const startedAt = Date.parse(order.confirmedAt || order.updatedAt || order.createdAt);
  const completionAt = Date.parse(order.estimatedCompletionAt)
    || (startedAt + (estimatedMinutes * 60 * 1000));
  const remainingSeconds = Math.max(0, Math.ceil((completionAt - now) / 1000));
  if (!remainingSeconds) return 'Due now';
  return `${Math.floor(remainingSeconds / 60)}m ${String(remainingSeconds % 60).padStart(2, '0')}s`;
};

const inferSection = (order) => {
  if (order.section) return order.section;
  if (order.details?.serviceType) return order.details.serviceType;
  if (/bill payment/i.test(order.label) || ['NEECO 1', 'PrimeWater Muñoz'].includes(order.source)) return 'bills';
  if (['Pandayan', 'Watsons', 'Mr. DIY', 'Friendship', 'Public Market'].includes(order.source)) return 'item';
  return 'food';
};

const RiderDashboard = () => {
  const navigate = useNavigate();
  const { orders: allOrders, updateOrderStatus } = useCustomerActivity();
  const user = getSessionUser();
  const backendOrdersById = useBackendOrders('/api/orders?per_page=50');
  const localOrders = allOrders.filter((order) => user?.role === 'driver' && isAssignedTo(order, user));
  const assignedOrders = useMemo(() => applyBackendTruth(localOrders, backendOrdersById), [localOrders, backendOrdersById]);
  const [activeSection, setActiveSection] = useState('food');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  // A rider can be viewing an order synthesized from the backend, with no
  // localStorage copy to update. Keep their chosen progress state in this
  // screen immediately instead of making the tap appear to do nothing until
  // the next network poll returns.
  const [optimisticStatuses, setOptimisticStatuses] = useState({});
  const [updatingOrderIds, setUpdatingOrderIds] = useState({});
  const [zoomedImage, setZoomedImage] = useState(null);
  const [now, setNow] = useState(Date.now());
  // Keep completed work visible until the Manila business day ends, rather
  // than making a rider's just-finished transaction disappear immediately.
  const orders = useMemo(() => assignedOrders.filter((order) => remainsVisibleToday(order, now)), [assignedOrders, now]);
  const selectedOrder = assignedOrders.find((order) => order.id === selectedOrderId);
  const sectionOrders = useMemo(() => orders.filter((order) => inferSection(order) === activeSection), [activeSection, orders]);
  const pendingCount = orders.filter((order) => order.status === 'pending_rider').length;
  const getCount = (section) => orders.filter((order) => inferSection(order) === section).length;

  const displayedOrder = (order) => {
    const status = optimisticStatuses[order.id];
    return status ? { ...order, status } : order;
  };

  const updateProgress = async (order, status) => {
    if (updatingOrderIds[order.id]) return;
    const previousStatus = order.status;
    setOptimisticStatuses((current) => ({ ...current, [order.id]: status }));
    setUpdatingOrderIds((current) => ({ ...current, [order.id]: true }));
    const saved = await updateOrderStatus(order, status);
    if (!saved) {
      setOptimisticStatuses((current) => ({ ...current, [order.id]: previousStatus }));
    }
    setUpdatingOrderIds((current) => {
      const next = { ...current };
      delete next[order.id];
      return next;
    });
  };

  useEffect(() => {
    const countdown = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(countdown);
  }, []);

  useEffect(() => {
    if (!zoomedImage) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setZoomedImage(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [zoomedImage]);

  const logout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <main className="rider-dashboard-page">
      <header className="rider-dashboard-header">
        <div className="rider-brand"><img src="/images/otu-zan-logo.jpg" alt="Otu-Zan Delivery" /><div><span>Otu-Zan</span><h1>Rider Dashboard</h1></div></div>
        <div className="rider-header-summary"><span><i className="fa-solid fa-bell" /> {pendingCount} pending</span><button type="button" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" /> Log Out</button></div>
      </header>

      <div className="rider-dashboard-content">
        <section className="rider-welcome">
          <div><span>Order management</span><h2>Customer Orders</h2><p>Review orders assigned to you by the administrator.</p></div>
          <div className="rider-stat"><strong>{orders.length}</strong><span>Active orders</span></div>
        </section>

        <nav className="rider-service-tabs" aria-label="Order sections">
          {sections.map((section) => (
            <button className={activeSection === section.key ? 'active' : ''} type="button" key={section.key} onClick={() => setActiveSection(section.key)}>
              <i className={`fa-solid ${section.icon}`} aria-hidden="true" /><span>{section.label}</span><strong>{getCount(section.key)}</strong>
            </button>
          ))}
        </nav>

        <div className="rider-section-heading"><div><h2>{sections.find((section) => section.key === activeSection)?.label}</h2><p>{sectionOrders.length} customer order{sectionOrders.length === 1 ? '' : 's'}</p></div></div>

        {!sectionOrders.length ? (
          <div className="rider-empty-orders"><i className="fa-solid fa-receipt" /><h3>No orders in this section</h3><p>Orders assigned to you will appear here automatically.</p></div>
        ) : (
          <div className="rider-order-grid">
            {sectionOrders.map((rawOrder) => {
              const order = displayedOrder(rawOrder);
              const isUpdating = Boolean(updatingOrderIds[order.id]);
              return (
              <article className={`rider-order-card status-${order.status}`} key={order.id}>
                <div className="rider-order-heading"><div><small>{order.id}</small><h3>{getOrderDisplayLabel(order)}</h3></div><span>{statusLabels[order.status] || 'Confirmed'}</span></div>
                <div className="rider-order-source"><i className="fa-solid fa-store" /><div><strong>{order.source}</strong><span>{new Date(order.createdAt).toLocaleString()}</span></div></div>
                <div className="rider-order-estimate"><i className="fa-regular fa-clock" /><span>Estimated wait</span><strong>{formatEstimatedWait(order, now)}</strong></div>
                <OrderCustomerDetails order={order} />
                <div className="rider-order-preview"><span><i className="fa-solid fa-bag-shopping" /> {order.items?.reduce((total, item) => total + (item.quantity || 1), 0) || 0} item(s)</span><button type="button" onClick={() => setSelectedOrderId(order.id)}>View Order <i className="fa-solid fa-arrow-right" /></button></div>
                {order.status === 'pending_rider' && <div className="rider-decision-buttons"><button type="button" className="rider-cancel" disabled={isUpdating} onClick={() => updateProgress(order, 'cancelled')}>Cancel</button><button type="button" className="rider-accept" disabled={isUpdating} onClick={() => updateProgress(order, 'confirmed')}>{isUpdating ? 'Updating…' : 'Confirm Order'}</button></div>}
              </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedOrder && (() => {
        const order = displayedOrder(selectedOrder);
        const isUpdating = Boolean(updatingOrderIds[order.id]);
        return (
        <div className="rider-order-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrderId(null); }}>
          <section className="rider-order-modal" role="dialog" aria-modal="true" aria-labelledby="rider-order-title">
            <div className="rider-order-modal-header"><div><span>{selectedOrder.id}</span><h2 id="rider-order-title">Order Details</h2></div><button type="button" onClick={() => setSelectedOrderId(null)} aria-label="Close order details">×</button></div>
            <div className="rider-detail-summary"><div><span>Establishment</span><strong>{selectedOrder.source}</strong></div><div><span>Status</span><strong>{statusLabels[selectedOrder.status]}</strong></div><div><span>Estimated wait</span><strong>{formatEstimatedWait(selectedOrder, now)}</strong></div><div><span>Placed</span><strong>{new Date(selectedOrder.createdAt).toLocaleString()}</strong></div></div>

            <OrderCustomerDetails order={selectedOrder} />
            {!!selectedOrder.items?.length ? (
              <div className="rider-detail-items"><h3>Items placed</h3><ul>{selectedOrder.items.map((item, index) => <li key={item.cartId || item.id || index}><span className="order-item-thumb">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <i className="fa-solid fa-utensils" aria-hidden="true" />}</span><div><strong>{item.name || `Item ${index + 1}`}</strong>{item.selectedOption && <span>{item.selectedOption}</span>}</div><b>×{item.quantity || 1}</b></li>)}</ul></div>
            ) : (
              <div className="rider-detail-items"><h3>Payment request</h3><p>Payment status: <strong>{selectedOrder.details?.paymentStatus || 'pending'}</strong>. Review the uploaded documents before proceeding.</p><PaymentDocument url={selectedOrder.details?.billReceiptUrl} name={selectedOrder.details?.billReceiptName} type={selectedOrder.details?.billReceiptType} label="Receipt" onZoom={setZoomedImage} /><PaymentDocument url={selectedOrder.details?.transferProofUrl} name={selectedOrder.details?.transferProofName} type={selectedOrder.details?.transferProofType} label="Proof of payment" onZoom={setZoomedImage} /></div>
            )}

            {selectedOrder.details?.fulfillmentMethod === 'pickup' && <div className="rider-recipient"><h3>Pick Up recipient</h3><p><strong>{selectedOrder.details.recipientName}</strong> · {selectedOrder.details.recipientContact}</p><span>{selectedOrder.details.deliveryAddress}</span></div>}

            <OrderChat order={selectedOrder} />

            <div className="rider-modal-actions">
              {order.status === 'pending_rider' && <><button type="button" className="rider-cancel" disabled={isUpdating} onClick={() => updateProgress(order, 'cancelled')}>Cancel Order</button><button type="button" className="rider-accept" disabled={isUpdating} onClick={() => updateProgress(order, 'confirmed')}>{isUpdating ? 'Updating…' : 'Confirm Order'}</button></>}
              {nextStatuses[order.status] && <button type="button" className="rider-advance" disabled={isUpdating} onClick={() => updateProgress(order, nextStatuses[order.status][0])}>{isUpdating ? 'Updating…' : nextStatuses[order.status][1]}</button>}
              {['delivered', 'cancelled'].includes(order.status) && <button type="button" className="rider-close-order" onClick={() => setSelectedOrderId(null)}>Close</button>}
            </div>
          </section>
        </div>
        );
      })()}

      {zoomedImage && (
        <div className="rider-image-zoom-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setZoomedImage(null); }}>
          <button type="button" className="rider-image-zoom-close" onClick={() => setZoomedImage(null)} aria-label="Close">×</button>
          <img src={zoomedImage.url} alt={zoomedImage.alt} />
        </div>
      )}
    </main>
  );
};

export default RiderDashboard;
