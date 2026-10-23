import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api.js';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = (value) => `₡${Number(value || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PERMISSIONS = [
  ['productos:read', 'Consultar inventario y productos'],
  ['ventas:catalog', 'Consultar catálogo para facturación'],
  ['ventas:create', 'Facturar ventas'],
  ['reportes:ventas', 'Informes de ventas'],
  ['reportes:caja', 'Flujo de caja'],
  ['compras:read', 'Consultar pedidos y alertas de stock'],
  ['compras:create', 'Solicitar compras y recibir mercadería'],
  ['proveedores:read', 'Consultar proveedores'],
  ['proveedores:create', 'Registrar proveedores'],
];

function Section({ title, description, children }) {
  return (
    <section className="operation-section">
      <div className="section-heading">
        <div><p className="eyebrow">SISTEMA SUPERMERCADO</p><h1>{title}</h1></div>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Notice({ message }) {
  return message ? <div className="operation-notice" role="status">{message}</div> : null;
}

function ProductsPanel({ token, admin }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    codigo_barras: '', nombre_producto: '', precio_costo: '', precio_venta: '', stock_minimo: 0, aplica_iva: true,
  });
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');

  async function refresh() {
    const data = await apiRequest('/products', { token });
    setProducts(data.products);
  }
  useEffect(() => {
    const load = () => refresh().catch((err) => setMessage(err.message));
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [token]);

  function editProduct(product) {
    setEditing(product.id_producto);
    setForm({
      codigo_barras: product.codigo_barras,
      nombre_producto: product.nombre_producto,
      precio_costo: product.precio_costo,
      precio_venta: product.precio_venta,
      stock_minimo: product.stock_minimo,
      aplica_iva: Boolean(product.aplica_iva),
    });
  }
  async function save(event) {
    event.preventDefault();
    setMessage('');
    try {
      await apiRequest(editing ? `/products/${editing}` : '/products', {
        token,
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setEditing(null);
      setForm({ codigo_barras: '', nombre_producto: '', precio_costo: '', precio_venta: '', stock_minimo: 0, aplica_iva: true });
      await refresh();
      setMessage('Producto guardado.');
    } catch (err) { setMessage(err.message); }
  }

  return (
    <Section title="Inventario" description="Existencias actuales y niveles críticos de todos los productos.">
      <Notice message={message} />
      {admin && (
        <form className="inline-form product-form" onSubmit={save}>
          <h2>{editing ? 'Modificar producto' : 'Agregar producto'}</h2>
          <div className="form-grid">
            <label>Código de barras<input required maxLength={50} value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} /></label>
            <label>Nombre<input required maxLength={150} value={form.nombre_producto} onChange={(e) => setForm({ ...form, nombre_producto: e.target.value })} /></label>
            <label>Precio de costo<input required type="number" min="0" step="0.01" value={form.precio_costo} onChange={(e) => setForm({ ...form, precio_costo: e.target.value })} /></label>
            <label>Precio de venta<input required type="number" min="0" step="0.01" value={form.precio_venta} onChange={(e) => setForm({ ...form, precio_venta: e.target.value })} /></label>
            <label>Stock crítico<input required type="number" min="0" step="1" value={form.stock_minimo} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} /></label>
            <label className="check-field"><input type="checkbox" checked={form.aplica_iva} onChange={(e) => setForm({ ...form, aplica_iva: e.target.checked })} /> Aplica IVA</label>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">{editing ? 'Guardar cambios' : 'Agregar producto'}</button>
            {editing && <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancelar</button>}
          </div>
        </form>
      )}
      <div className="table-wrap"><table><thead><tr>
        <th>Código</th><th>Producto</th><th>Existencia</th><th>Mínimo</th><th>Precio</th><th>IVA</th>{admin && <th>Acción</th>}
      </tr></thead><tbody>{products.map((product) => (
        <tr key={product.id_producto} className={product.stock_actual <= product.stock_minimo ? 'critical-row' : ''}>
          <td>{product.codigo_barras}</td><td>{product.nombre_producto}</td><td>{product.stock_actual}</td>
          <td>{product.stock_minimo}</td><td>{money(product.precio_venta)}</td><td>{product.aplica_iva ? 'Sí' : 'No'}</td>
          {admin && <td><button className="text-button" onClick={() => editProduct(product)}>Editar</button></td>}
        </tr>
      ))}</tbody></table>{products.length === 0 && <p className="empty-state">No hay productos registrados.</p>}</div>
    </Section>
  );
}

function SalesPanel({ token }) {
  const [products, setProducts] = useState([]);
  const [config, setConfig] = useState({ porcentaje_iva: 13, tipo_cambio_dolar: 520 });
  const [cart, setCart] = useState([]);
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [payments, setPayments] = useState({ 'Efectivo Colones': '', 'Efectivo Dolares': '', Tarjeta: '' });
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    let active = true;
    const refreshData = async () => {
      const [productData, configData] = await Promise.all([
        apiRequest('/sales/products', { token }),
        apiRequest('/config', { token }),
      ]);
      if (active) {
        setProducts(productData.products);
        setConfig(configData.config);
      }
    };
    refreshData().catch((err) => setMessage(err.message));
    const timer = window.setInterval(() => refreshData().catch((err) => setMessage(err.message)), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const line of cart) {
      const product = products.find((item) => item.id_producto === Number(line.id_producto));
      if (!product) continue;
      const lineSubtotal = Math.round(Number(product.precio_venta) * 100) * Number(line.cantidad);
      subtotal += lineSubtotal;
      if (product.aplica_iva) tax += Math.round(lineSubtotal * Number(config.porcentaje_iva) / 100);
    }
    const total = subtotal + tax;
    const paid = Object.entries(payments).reduce((sum, [method, value]) => {
      const amount = Math.round(Number(value || 0) * 100);
      return sum + (method === 'Efectivo Dolares'
        ? Math.round(Number(value || 0) * Number(config.tipo_cambio_dolar) * 100)
        : amount);
    }, 0);
    const cash = Math.round(Number(payments['Efectivo Colones'] || 0) * 100) +
      Math.round(Number(payments['Efectivo Dolares'] || 0) * Number(config.tipo_cambio_dolar) * 100);
    return { subtotal, tax, total, paid, cash, due: Math.max(0, total - paid), change: Math.max(0, paid - total) };
  }, [cart, products, config, payments]);

  function addToCart(event) {
    event.preventDefault();
    const id = Number(selected);
    const count = Number(quantity);
    if (!id || !Number.isInteger(count) || count < 1) return;
    setCart((current) => {
      const existing = current.find((item) => item.id_producto === id);
      return existing
        ? current.map((item) => item.id_producto === id ? { ...item, cantidad: item.cantidad + count } : item)
        : [...current, { id_producto: id, cantidad: count }];
    });
    setQuantity(1);
  }

  async function submitSale() {
    setMessage('');
    setReceipt(null);
    const pagos = Object.entries(payments)
      .filter(([, value]) => Number(value) > 0)
      .map(([metodo_pago, monto_recibido_moneda_original]) => ({ metodo_pago, monto_recibido_moneda_original: Number(monto_recibido_moneda_original) }));
    if (!cart.length || !pagos.length || totals.due > 0 || totals.change > totals.cash) {
      setMessage(totals.due > 0 ? `Faltan ${money(totals.due / 100)} para completar la factura.` : 'Revise productos y pagos ingresados.');
      return;
    }
    try {
      const data = await apiRequest('/sales', { token, method: 'POST', body: JSON.stringify({ items: cart, pagos }) });
      setReceipt(data);
      setCart([]);
      setPayments({ 'Efectivo Colones': '', 'Efectivo Dolares': '', Tarjeta: '' });
      setMessage(`Factura #${data.id_venta} registrada correctamente.`);
      const fresh = await apiRequest('/sales/products', { token });
      setProducts(fresh.products);
    } catch (err) { setMessage(err.message); }
  }

  return (
    <Section title="Cajas / Facturación" description="IVA por producto, pagos mixtos y cálculo inmediato del faltante o vuelto.">
      <Notice message={message} />
      <div className="two-column">
        <div className="panel">
          <h2>Productos de la venta</h2>
          <form className="inline-form" onSubmit={addToCart}>
            <label className="grow">Producto<select required value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Seleccione producto</option>{products.filter((item) => item.stock_actual > 0).map((item) => (
                <option key={item.id_producto} value={item.id_producto}>{item.nombre_producto} — {money(item.precio_venta)} (stock {item.stock_actual})</option>
              ))}
            </select></label>
            <label>Cantidad<input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
            <button className="primary-button" type="submit">Agregar</button>
          </form>
          <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th></th></tr></thead>
            <tbody>{cart.map((line) => {
              const product = products.find((item) => item.id_producto === line.id_producto);
              return <tr key={line.id_producto}><td>{product?.nombre_producto}</td><td>{line.cantidad}</td>
                <td>{money(Number(product?.precio_venta || 0) * line.cantidad)}</td>
                <td><button className="text-button danger-text" onClick={() => setCart(cart.filter((item) => item.id_producto !== line.id_producto))}>Quitar</button></td></tr>;
            })}</tbody></table></div>
          <div className="totals-box">
            <span>Subtotal <strong>{money(totals.subtotal / 100)}</strong></span>
            <span>IVA <strong>{money(totals.tax / 100)}</strong></span>
            <span className="grand-total">Total <strong>{money(totals.total / 100)}</strong></span>
          </div>
        </div>
        <div className="panel">
          <h2>Medios de pago</h2>
          <p className="muted">Tipo de cambio actual: ₡{Number(config.tipo_cambio_dolar).toLocaleString('es-CR')} por dólar.</p>
          {Object.entries(payments).map(([method, value]) => (
            <label className="payment-input" key={method}>{method}
              <input type="number" min="0" step="0.01" value={value} onChange={(e) => setPayments({ ...payments, [method]: e.target.value })} placeholder="0.00" />
            </label>
          ))}
          <div className="totals-box payment-summary">
            <span>Pagado equivalente en colones <strong>{money(totals.paid / 100)}</strong></span>
            <span>Falta por cancelar <strong>{money(totals.due / 100)}</strong></span>
            <span>Vuelto en colones <strong>{money(totals.change / 100)}</strong></span>
            <span>Importe equivalente en dólares <strong>${(totals.total / 100 / Number(config.tipo_cambio_dolar || 1)).toFixed(2)}</strong></span>
          </div>
          <button className="primary-button wide-button" disabled={!cart.length || totals.due > 0 || totals.change > totals.cash} onClick={submitSale}>Registrar y cobrar factura</button>
          {receipt && <p className="success-note">Factura #{receipt.id_venta} · Vuelto: {money(receipt.vuelto_colones)}</p>}
        </div>
      </div>
    </Section>
  );
}

function PurchasesPanel({ token, admin }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [supplier, setSupplier] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');
  const [items, setItems] = useState([]);
  const [newSupplier, setNewSupplier] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const [p, s, critical, o] = await Promise.all([
      apiRequest('/products', { token }),
      apiRequest('/suppliers', { token }),
      apiRequest('/purchase-suggestions', { token }),
      apiRequest('/purchase-orders', { token }),
    ]);
    setProducts(p.products); setSuppliers(s.suppliers); setSuggestions(critical.suggestions); setOrders(o.orders);
  }
  useEffect(() => {
    const load = () => refresh().catch((err) => setMessage(err.message));
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [token]);

  const approvedOrders = orders.filter((order) => order.estado === 'Aprobado');
  const suggestionsTotal = suggestions.reduce((sum, item) => sum + Number(item.cantidad_sugerida), 0);

  async function saveSupplier(event) {
    event.preventDefault();
    try {
      await apiRequest('/suppliers', { token, method: 'POST', body: JSON.stringify({ nombre_empresa: newSupplier }) });
      setNewSupplier(''); await refresh(); setMessage('Proveedor registrado.');
    } catch (err) { setMessage(err.message); }
  }

  async function createOrder() {
    if (!supplier || suggestions.length === 0) { setMessage('Seleccione proveedor y asegúrese de tener productos bajo el mínimo.'); return; }
    try {
      const data = await apiRequest('/purchase-orders', {
        token, method: 'POST',
        body: JSON.stringify({
          id_proveedor: Number(supplier),
          items: suggestions.map((item) => ({ id_producto: item.id_producto, cantidad: item.cantidad_sugerida })),
        }),
      });
      await refresh(); setMessage(`Solicitud de compra #${data.id_pedido} enviada al administrador.`);
    } catch (err) { setMessage(err.message); }
  }

  function selectOrder(value) {
    const order = approvedOrders.find((item) => item.id_pedido === Number(value));
    setSelectedOrder(value);
    if (order) {
      setSupplier(String(suppliers.find((item) => item.nombre_empresa === order.nombre_empresa)?.id_proveedor || ''));
      setItems(order.items.map((item) => ({
        id_producto: item.id_producto,
        cantidad: item.cantidad,
        precio_costo_unitario: item.precio_costo_estimado,
      })));
    } else {
      setItems([]);
    }
  }

  async function approve(orderId) {
    try {
      await apiRequest(`/purchase-orders/${orderId}/approve`, { token, method: 'POST' });
      await refresh(); setMessage(`Pedido #${orderId} aprobado.`);
    } catch (err) { setMessage(err.message); }
  }

  function addItem() {
    const product = products.find((item) => item.id_producto === Number(document.getElementById('purchase-product')?.value));
    if (!product) return;
    const existing = items.find((item) => item.id_producto === product.id_producto);
    setItems(existing
      ? items.map((item) => item.id_producto === product.id_producto ? { ...item, cantidad: item.cantidad + 1 } : item)
      : [...items, { id_producto: product.id_producto, cantidad: 1, precio_costo_unitario: product.precio_costo }]);
  }

  async function receivePurchase(event) {
    event.preventDefault();
    try {
      const data = await apiRequest('/purchases', {
        token, method: 'POST',
        body: JSON.stringify({
          id_proveedor: Number(supplier),
          id_pedido: selectedOrder ? Number(selectedOrder) : null,
          items,
        }),
      });
      setItems([]); setSelectedOrder(''); await refresh();
      setMessage(`Compra #${data.id_compra} registrada. Inventario actualizado por ${money(data.total_compra)}.`);
    } catch (err) { setMessage(err.message); }
  }

  return (
    <Section title="Compras" description="Solicitudes automáticas por stock crítico, aprobación administrativa y recepción de mercadería.">
      <Notice message={message} />
      <div className="two-column">
        <div className="panel">
          <h2>Stock crítico</h2>
          <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th><th>Sugerido</th></tr></thead>
            <tbody>{suggestions.map((item) => <tr key={item.id_producto}><td>{item.nombre_producto}</td><td>{item.stock_actual}</td><td>{item.stock_minimo}</td><td>{item.cantidad_sugerida}</td></tr>)}</tbody>
          </table>{!suggestions.length && <p className="empty-state">No hay productos en nivel crítico.</p>}</div>
          <label>Proveedor<select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">Seleccione proveedor</option>{suppliers.map((item) => <option value={item.id_proveedor} key={item.id_proveedor}>{item.nombre_empresa}</option>)}
          </select></label>
          <button className="primary-button" disabled={!suggestionsTotal} onClick={createOrder}>Crear pedido sugerido para aprobación</button>
          <form className="inline-form supplier-form" onSubmit={saveSupplier}>
            <label className="grow">Nuevo proveedor<input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} required /></label>
            <button className="secondary-button">Registrar proveedor</button>
          </form>
        </div>
        <div className="panel">
          <h2>Pedidos de compra</h2>
          {orders.map((order) => (
            <article className="order-card" key={order.id_pedido}>
              <div className="order-heading"><strong>Pedido #{order.id_pedido} · {order.nombre_empresa}</strong><span className={`status-chip ${order.estado.toLowerCase()}`}>{order.estado}</span></div>
              <p className="muted">Solicitado por {order.solicitado_por} · Estimado {money(order.total_estimado)}</p>
              <ul>{order.items.map((line) => <li key={line.id_producto}>{line.nombre_producto}: {line.cantidad} uds.</li>)}</ul>
              {admin && order.estado === 'Pendiente' && <button className="secondary-button" onClick={() => approve(order.id_pedido)}>Aprobar pedido</button>}
            </article>
          ))}
          {orders.length === 0 && <p className="empty-state">No hay pedidos registrados.</p>}
        </div>
      </div>
      <form className="panel receive-form" onSubmit={receivePurchase}>
        <h2>Registrar entrada de mercadería</h2>
        <div className="form-grid">
          <label>Pedido aprobado<select value={selectedOrder} onChange={(e) => selectOrder(e.target.value)}>
            <option value="">Entrada sin pedido</option>{approvedOrders.map((order) => <option key={order.id_pedido} value={order.id_pedido}>#{order.id_pedido} — {order.nombre_empresa}</option>)}
          </select></label>
          <label>Proveedor<select required value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">Seleccione proveedor</option>{suppliers.map((item) => <option value={item.id_proveedor} key={item.id_proveedor}>{item.nombre_empresa}</option>)}
          </select></label>
        </div>
        {!selectedOrder && <div className="inline-form">
          <label className="grow">Agregar producto<select id="purchase-product"><option value="">Seleccione producto</option>{products.map((item) => <option key={item.id_producto} value={item.id_producto}>{item.nombre_producto}</option>)}</select></label>
          <button type="button" className="secondary-button" onClick={addItem}>Agregar</button>
        </div>}
        <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo unitario</th><th></th></tr></thead>
          <tbody>{items.map((line) => {
            const product = products.find((item) => item.id_producto === line.id_producto);
            return <tr key={line.id_producto}><td>{product?.nombre_producto}</td>
              <td><input type="number" min="1" step="1" disabled={Boolean(selectedOrder)} value={line.cantidad} onChange={(e) => setItems(items.map((item) => item.id_producto === line.id_producto ? { ...item, cantidad: Number(e.target.value) } : item))} /></td>
              <td><input type="number" min="0" step="0.01" value={line.precio_costo_unitario} onChange={(e) => setItems(items.map((item) => item.id_producto === line.id_producto ? { ...item, precio_costo_unitario: Number(e.target.value) } : item))} /></td>
              <td>{!selectedOrder && <button type="button" className="text-button danger-text" onClick={() => setItems(items.filter((item) => item.id_producto !== line.id_producto))}>Quitar</button>}</td>
            </tr>;
          })}</tbody></table></div>
        <button className="primary-button" disabled={!items.length}>Registrar entrada e incrementar inventario</button>
      </form>
    </Section>
  );
}

function ReportsPanel({ token }) {
  const [date, setDate] = useState(today());
  const [sales, setSales] = useState(null);
  const [cashflow, setCashflow] = useState([]);
  const [message, setMessage] = useState('');
  async function load(event) {
    event?.preventDefault();
    setMessage('');
    try {
      const [salesData, cashData] = await Promise.all([
        apiRequest(`/reports/sales?date=${date}`, { token }),
        apiRequest(`/reports/cashflow?date=${date}`, { token }),
      ]);
      setSales(salesData.report); setCashflow(cashData.report);
    } catch (err) { setMessage(err.message); }
  }
  useEffect(() => { load(); }, [token]);
  return (
    <Section title="Informes" description="Totales diarios de facturación y recaudación por medio de pago.">
      <Notice message={message} />
      <form className="inline-form report-filter" onSubmit={load}>
        <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <button className="primary-button">Consultar día</button>
        <button type="button" className="secondary-button" onClick={() => window.print()}>Imprimir</button>
      </form>
      {sales && <div className="report-cards">
        <article className="report-card"><span>Facturas</span><strong>{sales.cantidad_ventas}</strong></article>
        <article className="report-card"><span>Subtotal</span><strong>{money(sales.subtotal)}</strong></article>
        <article className="report-card"><span>IVA</span><strong>{money(sales.monto_iva)}</strong></article>
        <article className="report-card highlight"><span>Venta total del día</span><strong>{money(sales.total_venta)}</strong></article>
      </div>}
      <div className="panel">
        <h2>Flujo de caja · {date}</h2>
        <div className="table-wrap"><table><thead><tr><th>Medio</th><th>Importe recibido</th><th>Equivalente colones</th></tr></thead>
          <tbody>{cashflow.map((row) => <tr key={row.metodo_pago}><td>{row.metodo_pago}</td><td>{row.metodo_pago === 'Efectivo Dolares' ? `$${Number(row.monto_moneda_original).toFixed(2)}` : money(row.monto_moneda_original)}</td><td>{money(row.monto_equivalente_colones)}</td></tr>)}</tbody></table>
          {!cashflow.length && <p className="empty-state">No hay pagos para la fecha seleccionada.</p>}</div>
      </div>
      <p className="muted small-note">El flujo refleja cobros registrados en el sistema; no incluye retiros ni fondo inicial de caja.</p>
    </Section>
  );
}

function AdminPanel({ token, user }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loginLocks, setLoginLocks] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [config, setConfig] = useState({ porcentaje_iva: '', tipo_cambio_dolar: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [auditUser, setAuditUser] = useState('');
  const [newUser, setNewUser] = useState({ nombre: '', username: '', password: '', id_rol: '' });
  const [newRole, setNewRole] = useState({ nombre_rol: '', permisos: [] });
  const [message, setMessage] = useState('');

  async function refresh() {
    const [adminData, configData, lockData] = await Promise.all([
      apiRequest('/admin/users', { token }),
      apiRequest('/config', { token }),
      apiRequest('/admin/login-locks', { token }),
    ]);
    setUsers(adminData.users); setRoles(adminData.roles); setConfig(configData.config);
    setLoginLocks(lockData.locks);
  }
  useEffect(() => { refresh().catch((err) => setMessage(err.message)); }, [token]);

  async function saveConfig(event) {
    event.preventDefault();
    try {
      const result = await apiRequest('/config', { token, method: 'PUT', body: JSON.stringify(config) });
      setConfig(result.config); setMessage('IVA y tipo de cambio actualizados.');
    } catch (err) { setMessage(err.message); }
  }
  async function addUser(event) {
    event.preventDefault();
    try {
      await apiRequest('/admin/users', { token, method: 'POST', body: JSON.stringify({ ...newUser, id_rol: Number(newUser.id_rol) }) });
      setNewUser({ nombre: '', username: '', password: '', id_rol: '' });
      await refresh(); setMessage('Usuario creado.');
    } catch (err) { setMessage(err.message); }
  }
  async function saveUser(event) {
    event.preventDefault();
    try {
      await apiRequest(`/admin/users/${selectedUser.id_usuario}`, {
        token, method: 'PATCH',
        body: JSON.stringify({ ...selectedUser, id_rol: Number(selectedUser.id_rol), password: selectedUser.password || undefined }),
      });
      setSelectedUser(null); await refresh(); setMessage('Usuario actualizado.');
    } catch (err) { setMessage(err.message); }
  }
  async function deactivate(id) {
    try { await apiRequest(`/admin/users/${id}`, { token, method: 'DELETE' }); await refresh(); setMessage('Usuario inhabilitado.'); }
    catch (err) { setMessage(err.message); }
  }
  async function unlock(id) {
    try { await apiRequest(`/admin/users/${id}/unlock`, { token, method: 'POST' }); await refresh(); setMessage('Usuario desbloqueado.'); }
    catch (err) { setMessage(err.message); }
  }
  async function unlockForm(clientKey) {
    try {
      await apiRequest('/admin/login-locks/unlock', {
        token,
        method: 'POST',
        body: JSON.stringify({ client_key: clientKey }),
      });
      await refresh(); setMessage('Formulario de acceso desbloqueado.');
    } catch (err) { setMessage(err.message); }
  }
  async function updateRole(role, permissions) {
    try {
      const result = await apiRequest(`/admin/roles/${role.id_rol}`, { token, method: 'PUT', body: JSON.stringify({ permisos: permissions }) });
      setRoles(result.roles); setMessage(`Permisos del perfil ${role.nombre_rol} actualizados.`);
    } catch (err) { setMessage(err.message); }
  }
  async function createRole(event) {
    event.preventDefault();
    try {
      const result = await apiRequest('/admin/roles', { token, method: 'POST', body: JSON.stringify(newRole) });
      setRoles(result.roles); setNewRole({ nombre_rol: '', permisos: [] }); setMessage('Perfil creado.');
    } catch (err) { setMessage(err.message); }
  }
  async function searchAudit(event) {
    event?.preventDefault();
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (auditUser) params.set('user', auditUser);
      const data = await apiRequest(`/admin/audit?${params}`, { token });
      setEntries(data.entries); setMessage('');
    } catch (err) { setMessage(err.message); }
  }
  async function downloadAudit() {
    const params = new URLSearchParams({ format: 'csv' });
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (auditUser) params.set('user', auditUser);
    const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    try {
      const response = await fetch(`${apiBase}/api/admin/audit?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('No se pudo descargar la bitácora.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = 'bitacora.csv'; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setMessage(err.message); }
  }
  function togglePermission(list, permission, checked) {
    return checked ? [...new Set([...list, permission])] : list.filter((item) => item !== permission);
  }

  return (
    <Section title="Administración" description="Usuarios, perfiles, configuración y bitácora inmutable del sistema.">
      <Notice message={message} />
      <div className="panel">
        <h2>Configuración protegida</h2>
        <form className="inline-form" onSubmit={saveConfig}>
          <label>Porcentaje IVA<input type="number" min="0" max="100" step="0.01" required value={config.porcentaje_iva} onChange={(e) => setConfig({ ...config, porcentaje_iva: e.target.value })} /></label>
          <label>Tipo de cambio ₡/$<input type="number" min="0.01" step="0.01" required value={config.tipo_cambio_dolar} onChange={(e) => setConfig({ ...config, tipo_cambio_dolar: e.target.value })} /></label>
          <button className="primary-button">Guardar configuración</button>
        </form>
      </div>
      <div className="two-column">
        <div className="panel">
          <h2>Crear usuario</h2>
          <form className="stack-form" onSubmit={addUser}>
            <label>Nombre<input required value={newUser.nombre} onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })} /></label>
            <label>Usuario<input required maxLength={50} value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /></label>
            <label>Contraseña<input required minLength={8} type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></label>
            <label>Perfil<select required value={newUser.id_rol} onChange={(e) => setNewUser({ ...newUser, id_rol: e.target.value })}><option value="">Seleccione</option>{roles.map((role) => <option key={role.id_rol} value={role.id_rol}>{role.nombre_rol}</option>)}</select></label>
            <button className="primary-button">Crear usuario</button>
          </form>
        </div>
        <div className="panel">
          <h2>Usuarios del sistema</h2>
          <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Perfil</th><th>Estado</th><th>Fallos</th><th>Gestión</th></tr></thead>
            <tbody>{users.map((item) => <tr key={item.id_usuario}>
              <td>{item.nombre}<br /><span className="muted">@{item.username}</span></td><td>{item.nombre_rol}</td><td>{item.estado}</td><td>{item.intentos_fallidos}</td>
              <td className="table-actions"><button className="text-button" onClick={() => setSelectedUser({ ...item, password: '' })}>Editar</button>
                {item.estado === 'Bloqueado' && <button className="text-button" onClick={() => unlock(item.id_usuario)}>Desbloquear</button>}
                {item.estado === 'Activo' && item.id_usuario !== user.id && <button className="text-button danger-text" onClick={() => deactivate(item.id_usuario)}>Inhabilitar</button>}
              </td>
            </tr>)}</tbody></table></div>
          {selectedUser && <form className="stack-form editor-form" onSubmit={saveUser}>
            <h3>Modificar @{selectedUser.username}</h3>
            <label>Nombre<input value={selectedUser.nombre} onChange={(e) => setSelectedUser({ ...selectedUser, nombre: e.target.value })} /></label>
            <label>Usuario<input maxLength={50} value={selectedUser.username} onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })} /></label>
            <label>Perfil<select value={selectedUser.id_rol} onChange={(e) => setSelectedUser({ ...selectedUser, id_rol: e.target.value })}>{roles.map((role) => <option key={role.id_rol} value={role.id_rol}>{role.nombre_rol}</option>)}</select></label>
            <label>Estado<select value={selectedUser.estado} onChange={(e) => setSelectedUser({ ...selectedUser, estado: e.target.value })}><option>Activo</option><option>Inactivo</option><option>Bloqueado</option></select></label>
            <label>Nueva contraseña (opcional)<input type="password" minLength={8} value={selectedUser.password} onChange={(e) => setSelectedUser({ ...selectedUser, password: e.target.value })} /></label>
            <div className="button-row"><button className="primary-button">Guardar cambios</button><button type="button" className="secondary-button" onClick={() => setSelectedUser(null)}>Cancelar</button></div>
          </form>}
        </div>
      </div>
      <div className="panel">
        <h2>Perfiles y permisos</h2>
        <p className="muted">Los cambios se aplican inmediatamente en el backend; el perfil administrador conserva acceso completo.</p>
        <div className="role-grid">{roles.map((role) => (
          <RoleEditor key={role.id_rol} role={role} onSave={updateRole} />
        ))}</div>
        <form className="role-create" onSubmit={createRole}>
          <h3>Crear perfil</h3>
          <label>Nombre del perfil<input maxLength={50} required value={newRole.nombre_rol} onChange={(e) => setNewRole({ ...newRole, nombre_rol: e.target.value })} /></label>
          <PermissionChecks selected={newRole.permisos} onChange={(permisos) => setNewRole({ ...newRole, permisos })} />
          <button className="secondary-button">Crear perfil</button>
        </form>
      </div>
      <div className="panel">
        <h2>Formularios de acceso bloqueados</h2>
        <div className="table-wrap"><table><thead><tr><th>Origen</th><th>Fecha / hora</th><th>Acción</th></tr></thead>
          <tbody>{loginLocks.map((lock) => <tr key={lock.client_key}>
            <td>{lock.client_key}</td><td>{new Date(lock.fecha_bloqueo).toLocaleString('es-CR')}</td>
            <td><button className="text-button" onClick={() => unlockForm(lock.client_key)}>Desbloquear formulario</button></td>
          </tr>)}</tbody></table>
          {loginLocks.length === 0 && <p className="empty-state">No hay formularios bloqueados.</p>}</div>
      </div>
      <div className="panel">
        <h2>Bitácora inmutable</h2>
        <form className="inline-form audit-filter" onSubmit={searchAudit}>
          <label>Desde<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label>Hasta<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
          <label>Usuario<select value={auditUser} onChange={(e) => setAuditUser(e.target.value)}><option value="">Todos</option>{users.map((item) => <option key={item.id_usuario} value={item.id_usuario}>{item.username}</option>)}</select></label>
          <button className="primary-button">Filtrar</button>
          <button type="button" className="secondary-button" onClick={downloadAudit}>Descargar CSV</button>
          <button type="button" className="secondary-button" onClick={() => window.print()}>Imprimir</button>
        </form>
        <div className="table-wrap"><table><thead><tr><th>Fecha / hora</th><th>Usuario</th><th>Acción</th><th>Resultado</th><th>Detalle</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id_bitacora}><td>{new Date(entry.fecha_hora).toLocaleString('es-CR')}</td><td>{entry.username || 'No identificado'}</td><td>{entry.accion}</td><td>{entry.resultado}</td><td>{entry.detalle}</td></tr>)}</tbody>
        </table>{entries.length === 0 && <p className="empty-state">Seleccione filtros para consultar la bitácora.</p>}</div>
      </div>
    </Section>
  );
}

function PermissionChecks({ selected, onChange }) {
  return <div className="permission-list">
    {PERMISSIONS.map(([permission, label]) => <label key={permission} className="check-field">
      <input type="checkbox" checked={selected.includes(permission)} onChange={(e) => onChange(e.target.checked ? [...selected, permission] : selected.filter((item) => item !== permission))} />
      {label}
    </label>)}
  </div>;
}

function RoleEditor({ role, onSave }) {
  const [selected, setSelected] = useState(role.permisos);
  useEffect(() => setSelected(role.permisos), [role.permisos]);
  if (role.nombre_rol === 'Administrador') return <article className="role-card"><h3>{role.nombre_rol}</h3><p className="muted">Acceso completo protegido.</p></article>;
  return <article className="role-card">
    <h3>{role.nombre_rol}</h3>
    <PermissionChecks selected={selected} onChange={setSelected} />
    <button className="secondary-button" onClick={() => onSave(role, selected)}>Guardar permisos</button>
  </article>;
}

export default function Operations({ module, token, user }) {
  if (module === 'inventory') return <ProductsPanel token={token} admin={user?.nombre_rol === 'Administrador'} />;
  if (module === 'sales') return <SalesPanel token={token} />;
  if (module === 'purchases') return <PurchasesPanel token={token} admin={user?.nombre_rol === 'Administrador'} />;
  if (module === 'reports') return <ReportsPanel token={token} />;
  if (module === 'admin') return <AdminPanel token={token} user={user} />;
  return null;
}
