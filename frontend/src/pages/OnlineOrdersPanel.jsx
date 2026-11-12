import { useEffect, useState } from 'react';
import { apiRequest } from '../api.js';

const money = (value) => `₡${Number(value || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const NEXT_STATES = {
  Pendiente: ['Preparando', 'Cancelado'],
  Preparando: ['Listo para retiro', 'Cancelado'],
  'Listo para retiro': ['Entregado', 'Cancelado'],
};

export default function OnlineOrdersPanel({ token }) {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest('/admin/store-orders', { token })
      .then((data) => { if (active) setOrders(data.orders); })
      .catch((error) => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function changeStatus(order, estado) {
    setMessage('');
    try {
      const data = await apiRequest(`/admin/store-orders/${order.id_pedido}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      setOrders(data.orders);
      setMessage(`Pedido #${order.id_pedido} actualizado.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="operation-section">
      <div className="section-heading">
        <div><p className="eyebrow">SISTEMA SUPERMERCADO</p><h1>Pedidos en línea</h1></div>
        <p className="muted">Prepara y actualiza los pedidos que hicieron los clientes en la tienda.</p>
      </div>
      {message && <div className="operation-notice" role="status">{message}</div>}
      {loading ? <p className="muted">Cargando pedidos...</p> : orders.length === 0 ? (
        <div className="panel empty-state">Todavía no hay pedidos en línea.</div>
      ) : (
        <div className="online-order-list">
          {orders.map((order) => (
            <article className="online-order-card" key={order.id_pedido}>
              <div className="online-order-heading">
                <div>
                  <p className="profile-label">PEDIDO #{order.id_pedido}</p>
                  <h2>{order.nombre_cliente}</h2>
                  <p className="muted">{new Date(order.fecha_pedido).toLocaleString('es-CR')}</p>
                </div>
                <span className={`online-order-status ${order.estado.toLowerCase().replaceAll(' ', '-')}`}>{order.estado}</span>
              </div>
              <ul className="online-order-items">
                {order.items.map((item) => (
                  <li key={`${order.id_pedido}-${item.id_producto}`}>
                    {item.cantidad} × {item.nombre_producto}
                    <strong>{money(item.subtotal_linea + item.iva_linea)}</strong>
                  </li>
                ))}
              </ul>
              <div className="online-order-footer">
                <strong>Total {money(order.total)}</strong>
                {NEXT_STATES[order.estado] && (
                  <label>Actualizar estado
                    <select defaultValue="" onChange={(event) => {
                      if (event.target.value) changeStatus(order, event.target.value);
                      event.target.value = '';
                    }}>
                      <option value="" disabled>Seleccionar</option>
                      {NEXT_STATES[order.estado].map((state) => <option value={state} key={state}>{state}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
