import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import {
  temporaryFoodBrands,
  temporaryItemBrands,
  temporaryUtilityCompanies
} from '../../components/home/FoodandItem/data/temporaryData';
import './DeliveryAdminDashboard.css';
import OrderCustomerDetails from '../../components/common/OrderCustomerDetails/OrderCustomerDetails';

const SERVICE_META = {
  food: { label: 'Food Delivery', icon: 'fa-utensils', color: '#f9c12f' },
  item: { label: 'Item Delivery', icon: 'fa-box', color: '#ff9846' },
  bills: { label: 'Pay Bills', icon: 'fa-file-invoice-dollar', color: '#da1c5c' }
};

const RIDERS = [
  { id: 'jayson-deguzman', name: 'Jayson Deguzman', vehicle: 'Motorcycle' }
];

const NAV_ITEMS = [
  { key: 'live', label: 'Live Orders', title: 'Ongoing, Pending & Cancelled', icon: 'fa-list-check' },
  { key: 'history', label: 'History', title: 'Order Transaction History', icon: 'fa-clock-rotate-left' },
  { key: 'revenue', label: 'Revenue', title: 'Revenue Analytics', icon: 'fa-chart-column' },
  { key: 'payments', label: 'Payments', title: 'Pending Payment Requests', icon: 'fa-wallet' },
  { key: 'catalog', label: 'Brands', title: 'Brand & Service Catalog', icon: 'fa-store' }
];

const ACTIVE_STATUSES = ['confirmed', 'preparing', 'out_for_delivery'];

const inferService = (order) => {
  if (order.section && SERVICE_META[order.section]) return order.section;
  if (/bill payment/i.test(order.label || '')) return 'bills';
  return order.details?.serviceType === 'item' ? 'item' : 'food';
};

const getOrderTotal = (order) => (order.items || []).reduce(
  (total, item) => total + ((Number(item.price) || 0) * (Number(item.quantity) || 1)),
  0
);

const getItemSummary = (order) => {
  if (!order.items?.length) return order.details?.billReceiptName || 'Bill payment request';
  return order.items.map((item) => `${item.quantity || 1}× ${item.name || 'Custom item'}`).join(', ');
};

const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2
}).format(amount || 0);

const ServiceBadge = ({ service }) => {
  const meta = SERVICE_META[service];
  return <span className="admin-service-badge" style={{ '--service-color': meta.color }}><i className={`fa-solid ${meta.icon}`} />{meta.label}</span>;
};

const OrderCard = ({ order, onAssign, onStatus }) => {
  const service = inferService(order);
  const meta = SERVICE_META[service];
  const nextAction = {
    confirmed: ['preparing', 'Start preparing'],
    preparing: ['out_for_delivery', 'Out for delivery'],
    out_for_delivery: ['delivered', 'Mark delivered']
  }[order.status];

  return (
    <article className="admin-order-card" style={{ '--service-color': meta.color }}>
      <div className="admin-order-card-heading">
        <div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></div>
        <ServiceBadge service={service} />
      </div>
      <OrderCustomerDetails order={order} />
      <span className="admin-order-source">{order.source}</span>
      <p>{getItemSummary(order)}</p>
      <div className="admin-order-total"><span>Order total</span><strong>{formatCurrency(getOrderTotal(order))}</strong></div>

      {order.status !== 'cancelled' && service !== 'bills' && (
        <label className="admin-rider-select">
          <span>Assigned rider</span>
          <select value={order.assignedRider?.id || ''} onChange={(event) => onAssign(order.id, RIDERS.find((rider) => rider.id === event.target.value) || null)}>
            <option value="">Select a rider</option>
            {RIDERS.map((rider) => <option value={rider.id} key={rider.id}>{rider.name} · {rider.vehicle}</option>)}
          </select>
        </label>
      )}

      <div className="admin-order-actions">
        {order.status === 'pending_rider' && <><button className="primary" type="button" onClick={() => onStatus(order.id, 'confirmed')}>Accept</button><button type="button" onClick={() => onStatus(order.id, 'cancelled')}>Decline</button></>}
        {nextAction && <button className="primary" type="button" onClick={() => onStatus(order.id, nextAction[0])}>{nextAction[1]}</button>}
        {order.status === 'cancelled' && <span className="admin-cancelled-state"><i className="fa-solid fa-circle-xmark" /> Cancelled</span>}
      </div>
    </article>
  );
};

const LiveOrdersTab = ({ orders, onAssign, onStatus }) => {
  const columns = [
    { key: 'ongoing', label: 'Ongoing', color: '#34b875', matches: (order) => ACTIVE_STATUSES.includes(order.status) },
    { key: 'pending', label: 'Pending', color: '#f9c12f', matches: (order) => order.status === 'pending_rider' },
    { key: 'cancelled', label: 'Cancelled', color: '#f15a29', matches: (order) => order.status === 'cancelled' }
  ];

  return <div className="admin-order-columns">{columns.map((column) => {
    const list = orders.filter(column.matches);
    return <section className="admin-order-column" key={column.key}>
      <div className="admin-column-heading"><i style={{ background: column.color }} /><h2>{column.label}</h2><span>{list.length}</span></div>
      <div className="admin-column-list">{list.length
        ? list.map((order) => <OrderCard order={order} onAssign={onAssign} onStatus={onStatus} key={order.id} />)
        : <div className="admin-empty-column">No {column.label.toLowerCase()} orders</div>}
      </div>
    </section>;
  })}</div>;
};

const HistoryTab = ({ orders }) => {
  const [filter, setFilter] = useState('all');
  const rows = orders.filter((order) => ['delivered', 'cancelled'].includes(order.status))
    .filter((order) => filter === 'all' || inferService(order) === filter);
  return <section>
    <div className="admin-filter-row">{['all', 'food', 'item', 'bills'].map((key) => <button className={filter === key ? 'active' : ''} type="button" onClick={() => setFilter(key)} key={key}>{key === 'all' ? 'All services' : SERVICE_META[key].label}</button>)}</div>
    <div className="admin-table-wrap"><table><thead><tr><th>Order ID</th><th>Service</th><th>Customer</th><th>Date</th><th>Total</th><th>Rider</th><th>Status</th></tr></thead><tbody>{rows.map((order) => <tr key={order.id}><td>{order.id}</td><td><ServiceBadge service={inferService(order)} /></td><td><OrderCustomerDetails order={order} /></td><td>{new Date(order.createdAt).toLocaleString()}</td><td>{formatCurrency(getOrderTotal(order))}</td><td>{order.assignedRider?.name || '—'}</td><td><span className={`admin-history-status ${order.status}`}>{order.status}</span></td></tr>)}</tbody></table>{!rows.length && <div className="admin-table-empty">No completed transactions yet.</div>}</div>
  </section>;
};

const RevenueTab = ({ orders }) => {
  const accepted = orders.filter((order) => order.status !== 'cancelled');
  const totals = Object.keys(SERVICE_META).reduce((result, service) => ({
    ...result,
    [service]: accepted.filter((order) => inferService(order) === service).reduce((sum, order) => sum + getOrderTotal(order), 0)
  }), {});
  const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const maximum = Math.max(...Object.values(totals), 1);
  return <section>
    <div className="admin-stat-grid"><div className="admin-stat-card featured"><span>Total recorded revenue</span><strong>{formatCurrency(grandTotal)}</strong></div>{Object.entries(SERVICE_META).map(([key, meta]) => <div className="admin-stat-card" key={key}><span>{meta.label}</span><strong style={{ color: meta.color }}>{formatCurrency(totals[key])}</strong></div>)}</div>
    <div className="admin-analytics-card"><h2>Revenue by service</h2><p>Calculated from priced items in active and completed customer orders.</p><div className="admin-revenue-bars">{Object.entries(SERVICE_META).map(([key, meta]) => <div key={key}><span>{meta.label}</span><div><i style={{ width: `${(totals[key] / maximum) * 100}%`, background: meta.color }} /></div><strong>{formatCurrency(totals[key])}</strong></div>)}</div></div>
  </section>;
};

const PaymentsTab = ({ orders, onStatus }) => {
  const payments = orders.filter((order) => inferService(order) === 'bills');
  return <div className="admin-payment-list">{payments.map((order) => <article className="admin-payment-card" key={order.id}>
    <div><small>{order.id}</small><OrderCustomerDetails order={order} /><span>{order.source}</span></div>
    <div><small>Uploaded bill</small><strong>{order.details?.billReceiptName || 'No receipt uploaded'}</strong><span>{order.details?.transferProofName || 'No transfer proof'}</span></div>
    <span className={`admin-payment-status ${order.status}`}>{order.status.replaceAll('_', ' ')}</span>
    {order.status === 'pending_rider' && <div className="admin-payment-actions"><button className="primary" type="button" onClick={() => onStatus(order.id, 'confirmed')}>Approve</button><button type="button" onClick={() => onStatus(order.id, 'cancelled')}>Reject</button></div>}
  </article>)}{!payments.length && <div className="admin-page-empty"><i className="fa-solid fa-file-invoice" /><h2>No payment requests</h2><p>Customer bill-payment submissions will appear here.</p></div>}</div>;
};

const initialCatalog = [...temporaryFoodBrands, ...temporaryItemBrands, ...temporaryUtilityCompanies].map((brand, index) => ({ ...brand, catalogId: `${brand.type}-${index}`, active: true }));

const CatalogTab = () => {
  const [brands, setBrands] = useState(initialCatalog);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'food' });
  const editBrand = (brand) => { setEditing(brand.catalogId); setForm({ name: brand.name, type: brand.type }); };
  const saveBrand = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (editing === 'new') setBrands((current) => [...current, { catalogId: `brand-${Date.now()}`, name: form.name.trim(), type: form.type, active: true }]);
    else setBrands((current) => current.map((brand) => brand.catalogId === editing ? { ...brand, name: form.name.trim(), type: form.type } : brand));
    setEditing(null); setForm({ name: '', type: 'food' });
  };
  return <div className="admin-catalog-layout"><div className="admin-table-wrap"><table><thead><tr><th>Brand</th><th>Service</th><th>Status</th><th /></tr></thead><tbody>{brands.map((brand) => <tr key={brand.catalogId}><td>{brand.name}</td><td><ServiceBadge service={brand.type} /></td><td><button className={`admin-catalog-status ${brand.active ? 'active' : ''}`} type="button" onClick={() => setBrands((current) => current.map((item) => item.catalogId === brand.catalogId ? { ...item, active: !item.active } : item))}>{brand.active ? 'Active' : 'Hidden'}</button></td><td><button className="admin-edit-link" type="button" onClick={() => editBrand(brand)}>Edit</button></td></tr>)}</tbody></table></div>
    <form className="admin-catalog-form" onSubmit={saveBrand}><div className="admin-form-heading"><div><span>Catalog editor</span><h2>{editing === 'new' ? 'Add brand' : editing ? 'Edit brand' : 'Brand management'}</h2></div>{!editing && <button type="button" onClick={() => { setEditing('new'); setForm({ name: '', type: 'food' }); }}>+ Add new</button>}</div>{editing ? <><label>Brand name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Service<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="food">Food Delivery</option><option value="item">Item Delivery</option><option value="bills">Pay Bills</option></select></label><div className="admin-form-actions"><button className="primary" type="submit">Save</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div></> : <p>Select Edit to update a brand, or add a new establishment to the local catalog draft.</p>}</form>
  </div>;
};

const DeliveryAdminDashboard = () => {
  const navigate = useNavigate();
  const { orders, updateOrderStatus, assignOrderToRider } = useCustomerActivity();
  const [activeTab, setActiveTab] = useState('live');
  const pendingCount = orders.filter((order) => order.status === 'pending_rider').length;
  const activeNav = useMemo(() => NAV_ITEMS.find((item) => item.key === activeTab), [activeTab]);

  const logout = () => { sessionStorage.removeItem('otuzanAuthenticated'); navigate('/login', { replace: true }); };

  return <main className="admin-dashboard-page">
    <aside className="admin-sidebar">
      <div className="admin-brand"><img src="/images/otu-zan-logo.jpg" alt="Otu-Zan" /><div><strong>Otu-Zan</strong><span>Admin Console</span></div></div>
      <nav>{NAV_ITEMS.map((item) => <button className={activeTab === item.key ? 'active' : ''} type="button" onClick={() => setActiveTab(item.key)} key={item.key}><i className={`fa-solid ${item.icon}`} /><span>{item.label}</span>{item.key === 'live' && pendingCount > 0 && <b>{pendingCount}</b>}</button>)}</nav>
      <div className="admin-account"><span>OA</span><div><strong>Operations Admin</strong><small>Otu-Zan management</small></div></div>
      <button className="admin-logout" type="button" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" /> Log Out</button>
    </aside>

    <section className="admin-main">
      <header className="admin-page-header"><div><span>Otu-Zan Management</span><h1>{activeNav.title}</h1><p>{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>{activeTab === 'live' && <div className="admin-header-services">{Object.keys(SERVICE_META).map((service) => <ServiceBadge service={service} key={service} />)}</div>}</header>
      {activeTab === 'live' && <LiveOrdersTab orders={orders} onAssign={assignOrderToRider} onStatus={updateOrderStatus} />}
      {activeTab === 'history' && <HistoryTab orders={orders} />}
      {activeTab === 'revenue' && <RevenueTab orders={orders} />}
      {activeTab === 'payments' && <PaymentsTab orders={orders} onStatus={updateOrderStatus} />}
      {activeTab === 'catalog' && <CatalogTab />}
    </section>
  </main>;
};

export default DeliveryAdminDashboard;
