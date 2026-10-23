import { query } from '../database/pool.js';

export async function roleHasPermission(roleName, permission) {
  const result = await query(
    `SELECT 1 AS permitido
     FROM dbo.Roles r
     INNER JOIN dbo.Rol_Permisos rp ON rp.id_rol = r.id_rol
     INNER JOIN dbo.Permisos p ON p.id_permiso = rp.id_permiso
     WHERE r.nombre_rol = @rol
       AND (p.clave = @permiso OR p.clave = @comodin OR p.clave = '*')`,
    {
      rol: roleName,
      permiso: permission,
      comodin: `${permission.split(':')[0]}:*`,
    }
  );
  return (result.recordset?.length ?? 0) > 0;
}

export async function listPermissionsForRole(roleName) {
  const result = await query(
    `SELECT p.clave
     FROM dbo.Roles r
     INNER JOIN dbo.Rol_Permisos rp ON rp.id_rol = r.id_rol
     INNER JOIN dbo.Permisos p ON p.id_permiso = rp.id_permiso
     WHERE r.nombre_rol = @rol
     ORDER BY p.clave`,
    { rol: roleName }
  );
  return (result.recordset ?? []).map((row) => row.clave);
}

export async function listRolesWithPermissions() {
  const result = await query(
    `SELECT r.id_rol, r.nombre_rol, p.clave
     FROM dbo.Roles r
     LEFT JOIN dbo.Rol_Permisos rp ON rp.id_rol = r.id_rol
     LEFT JOIN dbo.Permisos p ON p.id_permiso = rp.id_permiso
     ORDER BY r.nombre_rol, p.clave`
  );
  const roles = new Map();
  for (const row of result.recordset ?? []) {
    if (!roles.has(row.id_rol)) {
      roles.set(row.id_rol, {
        id_rol: row.id_rol,
        nombre_rol: row.nombre_rol,
        permisos: [],
      });
    }
    if (row.clave) roles.get(row.id_rol).permisos.push(row.clave);
  }
  return [...roles.values()];
}

export async function updateRolePermissions(idRol, permissions) {
  const names = await query(
    'SELECT nombre_rol FROM dbo.Roles WHERE id_rol = @id_rol',
    { id_rol: idRol }
  );
  const role = names.recordset?.[0];
  if (!role) {
    const error = new Error('Perfil no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const valid = await query(
    `SELECT clave FROM dbo.Permisos
     WHERE clave IN (${permissions.map((_, index) => `@p${index}`).join(', ') || 'NULL'})`,
    Object.fromEntries(permissions.map((permission, index) => [`p${index}`, permission]))
  );
  if ((valid.recordset?.length ?? 0) !== new Set(permissions).size) {
    const error = new Error('La lista incluye permisos no válidos.');
    error.statusCode = 400;
    throw error;
  }

  const statements = [
    'DELETE FROM dbo.Rol_Permisos WHERE id_rol = @id_rol;',
    ...permissions.map(
      (_, index) =>
        `INSERT INTO dbo.Rol_Permisos (id_rol, id_permiso)
         SELECT @id_rol, id_permiso FROM dbo.Permisos WHERE clave = @p${index};`
    ),
  ];
  await query(statements.join('\n'), {
    id_rol: idRol,
    ...Object.fromEntries(permissions.map((permission, index) => [`p${index}`, permission])),
  });
}

export async function createRole(nombre, permissions) {
  const existing = await query('SELECT 1 AS existe FROM dbo.Roles WHERE nombre_rol = @nombre', { nombre });
  if (existing.recordset?.length) {
    const error = new Error('Ya existe un perfil con ese nombre.');
    error.statusCode = 409;
    throw error;
  }
  const result = await query(
    `INSERT INTO dbo.Roles (nombre_rol)
     OUTPUT INSERTED.id_rol
     VALUES (@nombre)`,
    { nombre }
  );
  const idRol = result.recordset?.[0]?.id_rol;
  try {
    await updateRolePermissions(idRol, permissions);
  } catch (error) {
    await query('DELETE FROM dbo.Roles WHERE id_rol = @id_rol', { id_rol: idRol });
    throw error;
  }
  return idRol;
}
