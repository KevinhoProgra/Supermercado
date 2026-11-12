export const ROLES = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  COMPRAS: 'Encargado de compras',
  CLIENTE: 'Cliente',
};

export const ALL_ROLES = [ROLES.ADMIN, ROLES.CAJERO, ROLES.COMPRAS, ROLES.CLIENTE];

export const USER_STATES = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  BLOCKED: 'Bloqueado',
};

/** Permisos por rol (validación backend). */
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['*'],
  [ROLES.CAJERO]: [
    'ventas:catalog',
    'ventas:create',
    'reportes:ventas',
    'reportes:caja',
  ],
  [ROLES.COMPRAS]: [
    'compras:read',
    'compras:create',
    'proveedores:read',
    'proveedores:create',
    'productos:read',
  ],
  [ROLES.CLIENTE]: ['tienda:catalog', 'tienda:orders:create', 'tienda:orders:read'],
};

export function roleHasPermission(roleName, permission) {
  const perms = ROLE_PERMISSIONS[roleName];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const [resource] = permission.split(':');
  return perms.includes(`${resource}:*`);
}
