import * as business from '../services/businessService.js';
import { registrarBitacora } from '../services/bitacoraService.js';
import { createRole, listRolesWithPermissions, updateRolePermissions } from '../services/accessService.js';
import {
  createUser,
  findUserById,
  listUsers,
  toPublicUser,
  unlockUser,
  updateUser,
} from '../services/userService.js';
import { query } from '../database/pool.js';
import { ROLES, USER_STATES } from '../constants/roles.js';
import { listLoginFormLocks, unlockLoginForm } from '../middleware/loginThrottle.js';

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function csvField(value) {
  let text = String(value ?? '');
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export const listProducts = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { products: await business.listProducts() } });
});

export const listSalesProducts = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { products: await business.listProducts() } });
});

export const saveProduct = asyncHandler(async (req, res) => {
  const idProducto = req.params.id ? Number(req.params.id) : null;
  if (idProducto !== null && (!Number.isInteger(idProducto) || idProducto < 1)) {
    return res.status(400).json({ success: false, error: { message: 'Producto inválido.' } });
  }
  await business.saveProduct(req.body ?? {}, idProducto, req.user);
  res.status(idProducto ? 200 : 201).json({ success: true, data: { products: await business.listProducts() } });
});

export const getConfig = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { config: await business.getConfig() } });
});

export const updateConfig = asyncHandler(async (req, res) => {
  await business.updateConfig(req.body ?? {}, req.user);
  res.json({ success: true, data: { config: await business.getConfig() } });
});

export const createSale = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await business.createSale(req.body ?? {}, req.user) });
});

export const listSuppliers = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { suppliers: await business.listSuppliers() } });
});

export const createSupplier = asyncHandler(async (req, res) => {
  await business.createSupplier(req.body ?? {}, req.user);
  res.status(201).json({ success: true, data: { suppliers: await business.listSuppliers() } });
});

export const listPurchaseSuggestions = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { suggestions: await business.listPurchaseSuggestions() } });
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await business.createPurchaseOrder(req.body ?? {}, req.user) });
});

export const listPurchaseOrders = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { orders: await business.listPurchaseOrders() } });
});

export const approvePurchaseOrder = asyncHandler(async (req, res) => {
  const idPedido = Number(req.params.id);
  if (!Number.isInteger(idPedido) || idPedido < 1) throw Object.assign(new Error('Pedido inválido.'), { statusCode: 400 });
  await business.approvePurchaseOrder(idPedido, req.user);
  res.json({ success: true, data: {} });
});

export const registerPurchase = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await business.registerPurchase(req.body ?? {}, req.user) });
});

export const salesReport = asyncHandler(async (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) throw Object.assign(new Error('Indique una fecha válida (AAAA-MM-DD).'), { statusCode: 400 });
  res.json({ success: true, data: { report: await business.getSalesReport(date) } });
});

export const cashflowReport = asyncHandler(async (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) throw Object.assign(new Error('Indique una fecha válida (AAAA-MM-DD).'), { statusCode: 400 });
  res.json({ success: true, data: { report: await business.getCashflowReport(date) } });
});

export const auditLog = asyncHandler(async (req, res) => {
  const { from, to, user, format } = req.query;
  if ((from && !validDate(from)) || (to && !validDate(to))) {
    throw Object.assign(new Error('Indique un rango de fechas válido (AAAA-MM-DD).'), { statusCode: 400 });
  }
  if (user && (!/^\d+$/.test(user) || Number(user) < 1)) {
    throw Object.assign(new Error('Seleccione un usuario válido.'), { statusCode: 400 });
  }
  const entries = await business.getAuditLog({
    from,
    to,
    idUsuario: user ? Number(user) : null,
  });
  if (format === 'csv') {
    const columns = ['id_bitacora', 'fecha_hora', 'username', 'accion', 'resultado', 'detalle'];
    const csv = [columns.join(','), ...entries.map((entry) =>
      columns.map((column) => csvField(entry[column])).join(',')
    )].join('\r\n');
    res.type('text/csv').set('Content-Disposition', 'attachment; filename="bitacora.csv"').send(csv);
    return;
  }
  res.json({ success: true, data: { entries } });
});

export const adminUsers = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: { users: (await listUsers()).map(toPublicUser), roles: await listRolesWithPermissions() },
  });
});

export const createAdminUser = asyncHandler(async (req, res) => {
  const { nombre, username, password, id_rol } = req.body ?? {};
  const roleId = Number(id_rol);
  if (typeof nombre !== 'string' || !nombre.trim() || typeof username !== 'string' || !username.trim() ||
      typeof password !== 'string' || password.length < 8 || !Number.isInteger(roleId) || roleId < 1) {
    throw Object.assign(new Error('Nombre, usuario, perfil y contraseña (mínimo 8 caracteres) son obligatorios.'), { statusCode: 400 });
  }
  const role = await query('SELECT nombre_rol FROM dbo.Roles WHERE id_rol = @id_rol', { id_rol: roleId });
  if (!role.recordset?.length) throw Object.assign(new Error('Perfil no encontrado.'), { statusCode: 400 });
  const user = await createUser({ nombre: nombre.trim(), username: username.trim(), password, id_rol: roleId }, req.user);
  res.status(201).json({ success: true, data: { user: toPublicUser(user) } });
});

export const updateAdminUser = asyncHandler(async (req, res) => {
  const idUsuario = Number(req.params.id);
  if (!Number.isInteger(idUsuario) || idUsuario < 1) throw Object.assign(new Error('Usuario inválido.'), { statusCode: 400 });
  const data = { ...req.body };
  if (data.username !== undefined &&
      (typeof data.username !== 'string' || !data.username.trim() || data.username.trim().length > 50)) {
    throw Object.assign(new Error('El nombre de usuario debe tener entre 1 y 50 caracteres.'), { statusCode: 400 });
  }
  if (data.nombre !== undefined &&
      (typeof data.nombre !== 'string' || !data.nombre.trim() || data.nombre.trim().length > 100)) {
    throw Object.assign(new Error('El nombre debe tener entre 1 y 100 caracteres.'), { statusCode: 400 });
  }
  if (data.password && (typeof data.password !== 'string' || data.password.length < 8)) {
    throw Object.assign(new Error('La contraseña debe tener al menos 8 caracteres.'), { statusCode: 400 });
  }
  if (idUsuario === req.user.id &&
      ((data.id_rol !== undefined && Number(data.id_rol) !== req.user.id_rol) ||
       (data.estado !== undefined && data.estado !== USER_STATES.ACTIVE))) {
    throw Object.assign(new Error('No puede cambiar su propio perfil o inhabilitar su cuenta.'), { statusCode: 400 });
  }
  if (data.estado && !Object.values(USER_STATES).includes(data.estado)) {
    throw Object.assign(new Error('Estado de usuario inválido.'), { statusCode: 400 });
  }
  if (data.id_rol !== undefined) {
    data.id_rol = Number(data.id_rol);
    const role = await query('SELECT id_rol FROM dbo.Roles WHERE id_rol = @id_rol', { id_rol: data.id_rol });
    if (!role.recordset?.length) throw Object.assign(new Error('Perfil no encontrado.'), { statusCode: 400 });
  }
  const user = await updateUser(idUsuario, data, req.user);
  res.json({ success: true, data: { user: toPublicUser(user) } });
});

export const deactivateAdminUser = asyncHandler(async (req, res) => {
  const idUsuario = Number(req.params.id);
  if (!Number.isInteger(idUsuario) || idUsuario < 1) throw Object.assign(new Error('Usuario inválido.'), { statusCode: 400 });
  const user = await findUserById(idUsuario);
  if (!user) throw Object.assign(new Error('Usuario no encontrado.'), { statusCode: 404 });
  if (user.id_usuario === req.user.id) throw Object.assign(new Error('No puede inhabilitar su propia cuenta.'), { statusCode: 400 });
  await updateUser(idUsuario, { estado: USER_STATES.INACTIVE }, req.user);
  res.json({ success: true, data: {} });
});

export const unlockAdminUser = asyncHandler(async (req, res) => {
  const idUsuario = Number(req.params.id);
  if (!Number.isInteger(idUsuario) || idUsuario < 1) throw Object.assign(new Error('Usuario inválido.'), { statusCode: 400 });
  res.json({ success: true, data: { user: toPublicUser(await unlockUser(idUsuario, req.user)) } });
});

export const loginFormLocks = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { locks: await listLoginFormLocks() } });
});

export const unlockAdminLoginForm = asyncHandler(async (req, res) => {
  const clientKey = req.body?.client_key;
  if (typeof clientKey !== 'string' || !clientKey || clientKey.length > 128) {
    throw Object.assign(new Error('Bloqueo de formulario inválido.'), { statusCode: 400 });
  }
  const unlocked = await unlockLoginForm(clientKey, req.user.id);
  if (!unlocked) throw Object.assign(new Error('El formulario no está bloqueado.'), { statusCode: 404 });
  await registrarBitacora({
    idUsuario: req.user.id,
    accion: 'LOGIN_FORMULARIO_DESBLOQUEADO',
    detalle: `Formulario desbloqueado para ${clientKey}`,
    resultado: 'Exito',
  });
  res.json({ success: true, data: {} });
});

export const adminRoles = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { roles: await listRolesWithPermissions() } });
});

export const createAdminRole = asyncHandler(async (req, res) => {
  const { nombre_rol: name, permisos: permissions } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 50 ||
      !Array.isArray(permissions) || !permissions.every((permission) => typeof permission === 'string')) {
    throw Object.assign(new Error('Nombre de perfil y permisos válidos son obligatorios.'), { statusCode: 400 });
  }
  const idRol = await createRole(name.trim(), [...new Set(permissions)]);
  await registrarBitacora({
    idUsuario: req.user.id,
    accion: 'PERFIL_CREADO',
    detalle: `Perfil ${name.trim()}`,
    resultado: 'Exito',
  });
  res.status(201).json({ success: true, data: { id_rol: idRol, roles: await listRolesWithPermissions() } });
});

export const updateAdminRole = asyncHandler(async (req, res) => {
  const idRol = Number(req.params.id);
  const permissions = req.body?.permisos;
  if (!Number.isInteger(idRol) || idRol < 1 || !Array.isArray(permissions) ||
      !permissions.every((permission) => typeof permission === 'string')) {
    throw Object.assign(new Error('Perfil o lista de permisos inválidos.'), { statusCode: 400 });
  }
  const roles = await listRolesWithPermissions();
  const role = roles.find((item) => item.id_rol === idRol);
  if (role?.nombre_rol === ROLES.ADMIN) throw Object.assign(new Error('Los permisos del administrador no se pueden restringir.'), { statusCode: 400 });
  await updateRolePermissions(idRol, [...new Set(permissions)]);
  await registrarBitacora({
    idUsuario: req.user.id,
    accion: 'PERFIL_MODIFICADO',
    detalle: `Perfil ${role?.nombre_rol ?? idRol}`,
    resultado: 'Exito',
  });
  res.json({ success: true, data: { roles: await listRolesWithPermissions() } });
});
