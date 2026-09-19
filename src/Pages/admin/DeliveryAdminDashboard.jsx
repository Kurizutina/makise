import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import './DeliveryAdminDashboard.css';
import OrderCustomerDetails from '../../components/common/OrderCustomerDetails/OrderCustomerDetails';
import { catalogImageUrl } from '../../utils/catalog';
import { clearSession } from '../../utils/session';

const SERVICE_META = {
  food: { label: 'Food Delivery', icon: 'fa-utensils', color: '#f9c12f' },
  item: { label: 'Item Delivery', icon: 'fa-box', color: '#ff9846' },
  bills: { label: 'Pay Bills', icon: 'fa-file-invoice-dollar', color: '#da1c5c' }
};

const STATUS_LABELS = {
  pending_rider: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled',
  pending: 'Pending', to_be_assigned: 'Pending assignment', to_be_assign: 'Pending assignment', unassigned: 'Pending assignment'
};

const NAV_ITEMS = [
  { key: 'live', label: 'Live Orders', title: 'Ongoing, Pending & Cancelled', icon: 'fa-list-check' },
  { key: 'history', label: 'History', title: 'Order Transaction History', icon: 'fa-clock-rotate-left' },
  { key: 'revenue', label: 'Revenue', title: 'Revenue Analytics', icon: 'fa-chart-column' },
  { key: 'payments', label: 'Payments', title: 'Pending Payment Requests', icon: 'fa-wallet' },
  { key: 'catalog', label: 'Brands', title: 'Brand & Service Catalog', icon: 'fa-store' },
  { key: 'riders', label: 'Riders', title: 'Rider Management', icon: 'fa-motorcycle' },
  { key: 'customers', label: 'Customers', title: 'Customer Management', icon: 'fa-users' }
];

const ACTIVE_STATUSES = ['confirmed', 'preparing', 'out_for_delivery'];
const FINAL_STATUSES = ['delivered', 'cancelled'];
const PENDING_ASSIGNMENT_STATUSES = ['pending_rider', 'pending', 'to_be_assigned', 'to_be_assign', 'unassigned'];
const hasAssignedRider = (order) => Boolean(order.assignedRider?.id);
const needsRiderAssignment = (order) => (
  !FINAL_STATUSES.includes(order.status)
  && (PENDING_ASSIGNMENT_STATUSES.includes(order.status) || !hasAssignedRider(order))
);

const inferService = (order) => {
  if (order.section && SERVICE_META[order.section]) return order.section;
  if (/bill payment/i.test(order.label || '')) return 'bills';
  return order.details?.serviceType === 'item' ? 'item' : 'food';
};

const getOrderTotal = (order) => (order.items || []).reduce(
  (total, item) => total + ((Number(item.price) || 0) * (Number(item.quantity) || 1)),
  0
);

const getOrderServiceFee = (order) => Number(order.serviceFee ?? order.details?.serviceFee ?? 0) || 0;

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

const OrderCard = ({ order, onAssign, onStatus, riders }) => {
  const service = inferService(order);
  const meta = SERVICE_META[service];
  const assignedRiderId = String(order.assignedRider?.id || '');
  const [selectedRiderId, setSelectedRiderId] = useState(assignedRiderId);
  useEffect(() => setSelectedRiderId(assignedRiderId), [assignedRiderId]);
  const selectedRider = riders.find((rider) => String(rider.id) === selectedRiderId);
  const canAssign = !['delivered', 'cancelled'].includes(order.status);
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

      {canAssign && (
        <label className="admin-rider-select">
          <span>Assigned rider</span>
          <select value={selectedRiderId} onChange={(event) => setSelectedRiderId(event.target.value)}>
            <option value="">Select a rider</option>
            {order.assignedRider && !riders.some((rider) => String(rider.id) === String(order.assignedRider.id)) && <option value={order.assignedRider.id}>{order.assignedRider.name} (reassign to a registered rider)</option>}
            {riders.map((rider) => <option value={rider.id} key={rider.id}>{rider.name}</option>)}
          </select>
        </label>
      )}

      <p className="admin-order-status">{STATUS_LABELS[order.status] || 'Pending assignment'}</p>
      {canAssign && order.assignedRider && riders.some((rider) => String(rider.id) === assignedRiderId) && <p role="status">Assigned to {order.assignedRider.name}</p>}
      <div className="admin-order-actions">
        {order.status === 'pending_rider' && <button type="button" onClick={() => onStatus(order.id, 'cancelled')}>Decline</button>}
        {canAssign && <button className="primary" type="button" disabled={!selectedRider || selectedRiderId === assignedRiderId} onClick={() => onAssign(order.id, selectedRider)}>Assign</button>}
        {service === 'bills' && nextAction && <button className="primary" type="button" onClick={() => onStatus(order.id, nextAction[0])}>{nextAction[1]}</button>}
        {order.status === 'cancelled' && <span className="admin-cancelled-state"><i className="fa-solid fa-circle-xmark" /> Cancelled</span>}
      </div>
    </article>
  );
};

const LiveOrdersTab = ({ orders, onAssign, onStatus, riders }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const columns = [
    { key: 'pending', label: 'Pending', color: '#f9c12f', matches: needsRiderAssignment },
    { key: 'ongoing', label: 'Ongoing', color: '#34b875', matches: (order) => ACTIVE_STATUSES.includes(order.status) && hasAssignedRider(order) },
    { key: 'cancelled', label: 'Cancelled', color: '#f15a29', matches: (order) => order.status === 'cancelled' }
  ];
  const visibleColumns = statusFilter === 'all' ? columns : columns.filter((column) => column.key === statusFilter);

  return <section className="admin-live-orders">
    <div className="admin-live-toolbar">
      <label>
        <span>Filter orders</span>
        <select aria-label="Filter live orders by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All Orders</option>
          <option value="ongoing">Ongoing Orders</option>
          <option value="pending">Pending Orders</option>
          <option value="cancelled">Cancelled Orders</option>
        </select>
      </label>
    </div>
    <div className="admin-order-columns">{visibleColumns.map((column) => {
      const list = orders.filter(column.matches);
      return <section className="admin-order-column" key={column.key}>
        <div className="admin-column-heading"><i style={{ background: column.color }} /><h2>{column.label}</h2><span>{list.length}</span></div>
        <div className="admin-column-list">{list.length
          ? list.map((order) => <OrderCard order={order} onAssign={onAssign} onStatus={onStatus} riders={riders} key={order.id} />)
          : <div className="admin-empty-column">No {column.label.toLowerCase()} orders</div>}
        </div>
      </section>;
    })}</div>
  </section>;
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
    [service]: accepted.filter((order) => inferService(order) === service).reduce((sum, order) => sum + getOrderServiceFee(order), 0)
  }), {});
  const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const maximum = Math.max(...Object.values(totals), 1);
  return <section>
    <div className="admin-stat-grid"><div className="admin-stat-card featured"><span>Total recorded revenue</span><strong>{formatCurrency(grandTotal)}</strong></div>{Object.entries(SERVICE_META).map(([key, meta]) => <div className="admin-stat-card" key={key}><span>{meta.label}</span><strong style={{ color: meta.color }}>{formatCurrency(totals[key])}</strong></div>)}</div>
    <div className="admin-analytics-card"><h2>Revenue by service</h2><p>Calculated only from the delivery or service fee saved with each non-cancelled order.</p><div className="admin-revenue-bars">{Object.entries(SERVICE_META).map(([key, meta]) => <div key={key}><span>{meta.label}</span><div><i style={{ width: `${(totals[key] / maximum) * 100}%`, background: meta.color }} /></div><strong>{formatCurrency(totals[key])}</strong></div>)}</div></div>
  </section>;
};

const PaymentsTab = ({ orders, onPaymentStatus }) => {
  const payments = orders.filter((order) => inferService(order) === 'bills');
  return <div className="admin-payment-list">{payments.map((order) => <article className="admin-payment-card" key={order.id}>
    <div><small>{order.id}</small><OrderCustomerDetails order={order} /><span>{order.source}</span></div>
    <div><small>Uploaded bill</small><strong>{order.details?.billReceiptName || 'No receipt uploaded'}</strong><span>{order.details?.transferProofName || 'No transfer proof'}</span><div className="admin-payment-documents">{order.details?.billReceiptUrl && <a href={order.details.billReceiptUrl} target="_blank" rel="noreferrer"><img src={order.details.billReceiptUrl} alt="Uploaded bill receipt" /><span>View receipt</span></a>}{order.details?.transferProofUrl && <a href={order.details.transferProofUrl} target="_blank" rel="noreferrer"><img src={order.details.transferProofUrl} alt="Uploaded proof of payment" /><span>View proof</span></a>}{order.details?.billReceiptUrl && <a className="admin-payment-download" href={order.details.billReceiptUrl} download={order.details.billReceiptName || true}>Download receipt</a>}{order.details?.transferProofUrl && <a className="admin-payment-download" href={order.details.transferProofUrl} download={order.details.transferProofName || true}>Download proof</a>}</div></div>
    <span className={`admin-payment-status ${order.details?.paymentStatus || 'pending'}`}>{order.details?.paymentStatus || 'pending'}</span>
    {(order.details?.paymentStatus || 'pending') === 'pending' && <div className="admin-payment-actions"><button className="primary" type="button" onClick={() => onPaymentStatus(order.id, 'verified')}>Verify</button><button type="button" onClick={() => onPaymentStatus(order.id, 'rejected')}>Reject</button></div>}
  </article>)}{!payments.length && <div className="admin-page-empty"><i className="fa-solid fa-file-invoice" /><h2>No payment requests</h2><p>Customer bill-payment submissions will appear here.</p></div>}</div>;
};

const CatalogTab = () => {
  const api = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const [module, setModule] = useState('brands');
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const activeModule = useRef(module);
  const latestCatalogRequest = useRef(0);
  const blank = useCallback(() => module === 'services' ? { ServiceName: '', ServiceType: 'item', Description: '', IsActive: true } : module === 'brands' ? { BrandName: '', ServiceID: '', Description: '', IsActive: true } : { ProductName: '', BrandID: '', ProductPrice: '', Description: '', IsActive: true }, [module]);
  const [form, setForm] = useState(blank());
  const [logoFile, setLogoFile] = useState(null);
  const [productImageFile, setProductImageFile] = useState(null);
  const request = useCallback(async (path, options = {}) => {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(`${api}/api/admin/catalog/${path}`, { ...options, headers: { Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}`, ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || Object.values(body.errors || {}).flat()[0] || 'Unable to save catalog changes.');
    return body;
  }, [api]);
  const loadOptions = useCallback(async () => {
    try {
      const data = await request('options');
      setServices(data.services); setBrands(data.brands);
    } catch (e) { setError(e.message); }
  }, [request]);
  const load = useCallback(async () => {
    const requestedModule = module;
    const requestId = ++latestCatalogRequest.current;
    try {
      setError('');
      const params = new URLSearchParams({ page, per_page: 10 });
      if (search.trim()) params.set('search', search.trim());
      if (filter) params.set(module === 'products' ? 'brand_id' : 'service_id', filter);
      const data = await request(`${module}?${params}`);
      // A request for a previously selected tab may finish after the user has
      // switched tabs. Do not render those records in the current table.
      if (activeModule.current !== requestedModule || requestId !== latestCatalogRequest.current) return;
      setItems(data.data); setMeta(data);
    } catch (e) { if (activeModule.current === requestedModule && requestId === latestCatalogRequest.current) setError(e.message); }
  }, [filter, module, page, request, search]);
  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => {
    if (module !== 'products' || !form.BrandID) { setCategories([]); return undefined; }
    let active = true;
    request(`categories?brand_id=${form.BrandID}`).then((data) => {
      if (active) setCategories(data.categories || []);
    }).catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [form.BrandID, module, request]);
  useEffect(() => { setPage(1); setItems([]); setEditing(null); setLogoFile(null); setProductImageFile(null); setForm(blank()); }, [blank, module]);
  useEffect(() => { load(); }, [load]);
  const key = module === 'services' ? 'ServiceID' : module === 'brands' ? 'BrandID' : 'ProductID';
  const nameKey = module === 'services' ? 'ServiceName' : module === 'brands' ? 'BrandName' : 'ProductName';
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, IsActive: form.IsActive ? 1 : 0, ...(module === 'brands' && !form.ServiceID ? { ServiceID: null } : {}) };
      const hasUpload = module === 'brands' || module === 'products';
      const body = hasUpload ? (() => { const data = new FormData(); const fields = module === 'brands' ? ['BrandName', 'ServiceID', 'Description', 'IsActive'] : ['ProductName', 'BrandID', 'ProductPrice', 'Description', 'IsActive']; fields.forEach((name) => data.append(name, payload[name] ?? '')); if (module === 'brands' && logoFile) data.append('Logo', logoFile); if (module === 'products' && productImageFile) data.append('Image', productImageFile); if (editing?.[key]) data.append('_method', 'PUT'); return data; })() : JSON.stringify(payload);
      await request(editing?.[key] ? `${module}/${editing[key]}` : module, { method: hasUpload ? 'POST' : editing?.[key] ? 'PUT' : 'POST', body });
      setEditing(null); setLogoFile(null); setProductImageFile(null); setForm(blank()); await loadOptions(); if (page !== 1) setPage(1); else await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const remove = async (item) => {
    if (!window.confirm(`Delete ${item[nameKey]}? This cannot be undone.`)) return;
    try { await request(`${module}/${item[key]}`, { method: 'DELETE' }); await loadOptions(); if (page > 1 && items.length === 1) setPage(page - 1); else await load(); } catch (e) { setError(e.message); }
  };
  const beginEdit = (item) => { setEditing(item); setLogoFile(null); setProductImageFile(null); setForm({ ...blank(), ...item, ServiceID: item.ServiceID || '', BrandID: item.BrandID || '' }); };
  const filterOptions = module === 'products' ? brands : services;
  const switchModule = (value) => { activeModule.current = value; latestCatalogRequest.current += 1; setModule(value); setFilter(''); };
  const categoryOptions = [...new Set([...categories, 'Food', 'Beverages', 'Desserts', 'Rice Meals', 'Snacks'])].sort();
  return <section className="admin-catalog-manager"><div className="admin-catalog-tabs">{[['brands', 'Brands'], ['services', 'Services'], ['products', 'Products']].map(([value, label]) => <button type="button" className={module === value ? 'active' : ''} onClick={() => switchModule(value)} key={value}>{label}</button>)}</div>
    <div className="admin-catalog-toolbar"><input aria-label="Search catalog" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${module}...`} />{module !== 'services' && <select aria-label="Filter catalog" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="">All {module === 'products' ? 'brands' : 'services'}</option>{filterOptions.map((item) => <option key={item[module === 'products' ? 'BrandID' : 'ServiceID']} value={item[module === 'products' ? 'BrandID' : 'ServiceID']}>{item[module === 'products' ? 'BrandName' : 'ServiceName']}</option>)}</select>}<button type="button" className="primary" onClick={() => { setEditing({}); setLogoFile(null); setProductImageFile(null); setForm(blank()); }}>+ Add {module.slice(0, -1)}</button></div>
    {error && <p className="admin-catalog-error" role="alert">{error}</p>}
    <div className="admin-catalog-layout"><div className="admin-table-wrap"><table><thead><tr><th>{module === 'products' ? 'Product' : module.slice(0, -1)}</th>{module === 'products' && <><th>Brand</th><th>Price</th></>}{module === 'brands' && <th>Service</th>}<th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item[key]}><td><div className="admin-catalog-name">{module !== 'services' && item.ImagePath && <img src={catalogImageUrl(item.ImagePath)} alt="" loading="lazy" />}<strong>{item[nameKey]}</strong></div>{item.Description && <small className="admin-description">{item.Description}</small>}</td>{module === 'products' && <><td>{item.brand?.BrandName || 'Unassigned legacy item'}</td><td>{formatCurrency(item.ProductPrice)}</td></>}{module === 'brands' && <td>{item.service?.ServiceName || 'No service'}</td>}<td>{item.IsActive ? 'Active' : 'Hidden'}</td><td><button className="admin-edit-link" type="button" onClick={() => beginEdit(item)}>Edit</button><button className="admin-delete-link" type="button" onClick={() => remove(item)}>Delete</button></td></tr>)}</tbody></table>{!items.length && <div className="admin-table-empty">No {module} found.</div>}<div className="admin-pagination"><span>{meta.total} total</span><button disabled={page <= 1} type="button" onClick={() => setPage(page - 1)}>Previous</button><span>Page {meta.current_page} of {meta.last_page}</span><button disabled={page >= meta.last_page} type="button" onClick={() => setPage(page + 1)}>Next</button></div></div>
      <form className="admin-catalog-form" onSubmit={save}><div className="admin-form-heading"><div><span>{module.slice(0, -1)} management</span><h2>{editing ? `${editing[key] ? 'Edit' : 'Add'} ${module.slice(0, -1)}` : 'Catalog editor'}</h2></div></div>{editing ? <><label>Name<input required maxLength="150" value={form[nameKey]} onChange={(e) => setForm({ ...form, [nameKey]: e.target.value })} /></label>{module === 'services' && <label>Service category<select value={form.ServiceType || 'item'} onChange={(e) => setForm({ ...form, ServiceType: e.target.value })}><option value="food">Food delivery</option><option value="item">Item delivery</option><option value="bills">Bill payment</option></select></label>}{module === 'brands' && <><label>Service<select required value={form.ServiceID} onChange={(e) => setForm({ ...form, ServiceID: e.target.value })}><option value="">Choose service</option>{services.map((item) => <option value={item.ServiceID} key={item.ServiceID}>{item.ServiceName}</option>)}</select></label><label>Brand logo<input accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />{logoFile ? <small className="admin-upload-note">Selected: {logoFile.name}</small> : form.ImagePath ? <small className="admin-upload-note">Current logo is kept until you select a replacement.</small> : <small className="admin-upload-note">PNG, JPG, WebP, or GIF — up to 20 MB.</small>}</label></>}{module === 'products' && <><label>Brand<select required value={form.BrandID} onChange={(e) => setForm({ ...form, BrandID: e.target.value })}><option value="">Choose a brand</option>{brands.map((item) => <option value={item.BrandID} key={item.BrandID}>{item.BrandName}</option>)}</select></label><label>Price<input required min="0" step="0.01" type="number" value={form.ProductPrice} onChange={(e) => setForm({ ...form, ProductPrice: e.target.value })} /></label><label>Product image<input accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={(e) => setProductImageFile(e.target.files?.[0] || null)} />{productImageFile ? <small className="admin-upload-note">Selected: {productImageFile.name}</small> : form.ImagePath ? <small className="admin-upload-note">Current image is kept until you select a replacement.</small> : <small className="admin-upload-note">PNG, JPG, WebP, or GIF — up to 20 MB.</small>}</label></>}<label>Description<textarea maxLength="500" value={form.Description || ''} onChange={(e) => setForm({ ...form, Description: e.target.value })} /></label><label className="admin-toggle"><input type="checkbox" checked={Boolean(form.IsActive)} onChange={(e) => setForm({ ...form, IsActive: e.target.checked })} /> Visible to customers</label><div className="admin-form-actions"><button className="primary" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save'}</button><button type="button" onClick={() => { setEditing(null); setLogoFile(null); setProductImageFile(null); }}>Cancel</button></div></> : <p>Create and maintain the services, brands, and products shown in your customer catalog.</p>}</form>
    </div></section>;
};

const AccountManagementTab = ({ role, onAccountsChanged }) => {
  const api = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const label = role === 'driver' ? 'Rider' : 'Customer';
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ UserName: '', Email: '', Contact: '', Address: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const request = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('otuzanAuthenticated');
    if (!token) throw new Error('Your admin session has expired. Sign in again.');
    const requestUrl = `${api}/api/admin/accounts/${path}`;
    const response = await fetch(requestUrl, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const validationError = body?.errors ? Object.values(body.errors).flat()[0] : null;
      if (response.status === 401) throw new Error('Your admin session has expired. Sign in again.');
      const responseText = body ? '' : (await response.text()).slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(body?.error || validationError || `Server returned HTTP ${response.status} for ${requestUrl}.${responseText ? ` Response: ${responseText}` : ''}`);
    }
    return body;
  }, [api]);
  const load = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams({ page, per_page: 10 });
      if (search.trim()) params.set('search', search.trim());
      const data = await request(`${role}?${params}`);
      setItems(data.data); setMeta(data);
    } catch (e) { setError(e.message); }
  }, [page, request, role, search]);
  useEffect(() => { load(); }, [load]);
  const resetForm = () => { setEditing(null); setForm({ UserName: '', Email: '', Contact: '', Address: '', password: '' }); };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form };
      const isEditing = Boolean(editing?.UserID);
      if (isEditing && !payload.password) delete payload.password;
      await request(isEditing ? `${role}/${editing.UserID}` : role, { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      resetForm(); onAccountsChanged?.();
      if (page !== 1) setPage(1); else await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const remove = async (account) => {
    if (!window.confirm(`Delete ${account.UserName}? This cannot be undone.`)) return;
    try {
      await request(`${role}/${account.UserID}`, { method: 'DELETE' }); onAccountsChanged?.();
      if (page > 1 && items.length === 1) setPage(page - 1); else await load();
    } catch (e) { setError(e.message); }
  };
  const beginEdit = (account) => { setEditing(account); setForm({ UserName: account.UserName || '', Email: account.Email || '', Contact: account.Contact || '', Address: account.Address || '', password: '' }); };
  return <section className="admin-catalog-manager">
    <div className="admin-catalog-toolbar"><input aria-label={`Search ${label.toLowerCase()}s`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={`Search ${label.toLowerCase()}s...`} /><button type="button" className="primary" onClick={() => { resetForm(); setEditing({}); }}>+ Add {label}</button></div>
    {error && <p className="admin-catalog-error" role="alert">{error}</p>}
    <div className="admin-catalog-layout"><div className="admin-table-wrap"><table><thead><tr><th>{label}</th><th>Email</th><th>Contact</th><th>Address</th><th>Actions</th></tr></thead><tbody>{items.map((account) => <tr key={account.UserID}><td><strong>{account.UserName}</strong></td><td>{account.Email}</td><td>{account.Contact || '—'}</td><td><small className="admin-description">{account.Address || '—'}</small></td><td><button className="admin-edit-link" type="button" onClick={() => beginEdit(account)}>Edit</button><button className="admin-delete-link" type="button" onClick={() => remove(account)}>Delete</button></td></tr>)}</tbody></table>{!items.length && <div className="admin-table-empty">No {label.toLowerCase()}s found.</div>}<div className="admin-pagination"><span>{meta.total} total</span><button disabled={page <= 1} type="button" onClick={() => setPage(page - 1)}>Previous</button><span>Page {meta.current_page} of {meta.last_page}</span><button disabled={page >= meta.last_page} type="button" onClick={() => setPage(page + 1)}>Next</button></div></div>
      <form className="admin-catalog-form" onSubmit={save}><div className="admin-form-heading"><div><span>{label} management</span><h2>{editing ? `${editing.UserID ? 'Edit' : 'Add'} ${label}` : `${label} accounts`}</h2></div></div>{editing ? <><label>Full name<input required maxLength="100" value={form.UserName} onChange={(e) => setForm({ ...form, UserName: e.target.value })} /></label><label>Email<input required type="email" maxLength="255" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} /></label><label>Contact number<input required maxLength="50" value={form.Contact} onChange={(e) => setForm({ ...form, Contact: e.target.value })} /></label><label>Address<textarea maxLength="2000" value={form.Address} onChange={(e) => setForm({ ...form, Address: e.target.value })} /></label><label>{editing.UserID ? 'New password (optional)' : 'Password'}<input required={!editing.UserID} minLength="6" maxLength="72" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><div className="admin-form-actions"><button className="primary" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save'}</button><button type="button" onClick={resetForm}>Cancel</button></div></> : <p>Create, update, search, and remove {label.toLowerCase()} accounts.</p>}</form>
    </div>
  </section>;
};

const DeliveryAdminDashboard = () => {
  const navigate = useNavigate();
  const { orders, updateOrderStatus, assignOrderToRider, updatePaymentStatus } = useCustomerActivity();
  const [activeTab, setActiveTab] = useState('live');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [riders, setRiders] = useState([]);
  const [riderError, setRiderError] = useState('');
  const [riderRefresh, setRiderRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const loadRiders = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/riders`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}` },
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load riders');
        setRiders(result.riders);
      } catch (error) {
        if (!controller.signal.aborted) setRiderError('Unable to load registered riders. Sign in again or check the backend connection.');
      }
    };
    loadRiders();
    return () => controller.abort();
  }, [riderRefresh]);
  const pendingCount = orders.filter(needsRiderAssignment).length;
  const activeNav = useMemo(() => NAV_ITEMS.find((item) => item.key === activeTab), [activeTab]);

  const logout = () => { clearSession(); navigate('/login', { replace: true }); };
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return <main className="admin-dashboard-page">
    <aside className={`admin-sidebar ${isMobileMenuOpen ? 'menu-open' : ''}`}>
      <div className="admin-brand"><img src="/images/otu-zan-logo.jpg" alt="Otu-Zan" /><div><strong>Otu-Zan</strong><span>Admin Console</span></div></div>
      <button
        className="admin-menu-toggle"
        type="button"
        aria-label={isMobileMenuOpen ? 'Close admin navigation' : 'Open admin navigation'}
        aria-controls="admin-navigation"
        aria-expanded={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen((open) => !open)}
      >
        <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`} />
      </button>
      <div className="admin-sidebar-menu" id="admin-navigation">
        <nav>{NAV_ITEMS.map((item) => <button className={activeTab === item.key ? 'active' : ''} type="button" onClick={() => handleTabChange(item.key)} key={item.key}><i className={`fa-solid ${item.icon}`} /><span>{item.label}</span>{item.key === 'live' && pendingCount > 0 && <b>{pendingCount}</b>}</button>)}</nav>
        <div className="admin-account"><span>OA</span><div><strong>Operations Admin</strong><small>Otu-Zan management</small></div></div>
        <button className="admin-logout" type="button" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" /> Log Out</button>
      </div>
    </aside>

    <section className="admin-main">
      <header className="admin-page-header"><div><span>Otu-Zan Management</span><h1>{activeNav.title}</h1><p>{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>{activeTab === 'live' && <div className="admin-header-services">{Object.keys(SERVICE_META).map((service) => <ServiceBadge service={service} key={service} />)}</div>}</header>
      {riderError && <p role="alert">{riderError}</p>}
      {activeTab === 'live' && <LiveOrdersTab orders={orders} onAssign={assignOrderToRider} onStatus={updateOrderStatus} riders={riders} />}
      {activeTab === 'history' && <HistoryTab orders={orders} />}
      {activeTab === 'revenue' && <RevenueTab orders={orders} />}
      {activeTab === 'payments' && <PaymentsTab orders={orders} onPaymentStatus={updatePaymentStatus} />}
      {activeTab === 'catalog' && <CatalogTab />}
      {activeTab === 'riders' && <AccountManagementTab role="driver" onAccountsChanged={() => setRiderRefresh((count) => count + 1)} />}
      {activeTab === 'customers' && <AccountManagementTab role="customer" />}
    </section>
  </main>;
};

export default DeliveryAdminDashboard;
