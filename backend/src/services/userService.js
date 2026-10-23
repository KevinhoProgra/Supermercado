import { query } from '../database/pool.js';
import { hashPassword } from '../utils/password.js';
import { ROLES, USER_STATES } from '../constants/roles.js';
import { registrarBitacora } from './bitacoraService.js';

const MIN_ACTIVE_ADMINS = 2;

export async function findUserByUsername(username) {
  const r = await query(
    `SELECT u.id_usuario, u.nombre, u.username, u.password_hash, u.id_rol, u.estado,
            u.intentos_fallidos, r.nombre_rol
     FROM dbo.Usuarios u
     INNER JOIN dbo.Roles r ON r.id_rol = u.id_rol
     WHERE u.username = @username`,
    { username }
  );
  return r.recordset?.[0] ?? null;
}

export async function findUserById(idUsuario) {
  const r = await query(
    `SELECT u.id_usuario, u.nombre, u.username, u.id_rol, u.estado, u.intentos_fallidos,
            r.nombre_rol
     FROM dbo.Usuarios u
     INNER JOIN dbo.Roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = @id_usuario`,
    { id_usuario: idUsuario }
  );
  return r.recordset?.[0] ?? null;
}

export async function listUsers() {
  const r = await query(
    `SELECT u.id_usuario, u.nombre, u.username, u.id_rol, u.estado, u.intentos_fallidos,
            r.nombre_rol
     FROM dbo.Usuarios u
     INNER JOIN dbo.Roles r ON r.id_rol = u.id_rol
     ORDER BY u.nombre`
  );
  return r.recordset ?? [];
}

async function countActiveAdmins(excludeUserId = null) {
  const r = await query(
    `SELECT COUNT(*) AS total
     FROM dbo.Usuarios u
     INNER JOIN dbo.Roles r ON r.id_rol = u.id_rol
     WHERE r.nombre_rol = @rol AND u.estado = @estado
       AND (@exclude IS NULL OR u.id_usuario <> @exclude)`,
    { rol: ROLES.ADMIN, estado: USER_STATES.ACTIVE, exclude: excludeUserId }
  );
  return Number(r.recordset?.[0]?.total ?? 0);
}

export async function createUser(data, actor) {
  const passwordHash = await hashPassword(data.password);
  const r = await query(
    `INSERT INTO dbo.Usuarios (nombre, username, password_hash, id_rol, estado)
     OUTPUT INSERTED.id_usuario
     VALUES (@nombre, @username, @password_hash, @id_rol, @estado)`,
    {
      nombre: data.nombre,
      username: data.username,
      password_hash: passwordHash,
      id_rol: data.id_rol,
      estado: data.estado || USER_STATES.ACTIVE,
    }
  );
  const id = r.recordset[0].id_usuario;
  await registrarBitacora({
    idUsuario: actor?.id ?? null,
    accion: 'USUARIO_CREADO',
    detalle: `Usuario ${data.username} (id ${id})`,
    resultado: 'Exito',
  });
  return findUserById(id);
}

export async function updateUser(idUsuario, data, actor) {
  const existing = await findUserById(idUsuario);
  if (!existing) {
    const err = new Error('Usuario no encontrado');
    err.statusCode = 404;
    throw err;
  }

  if (existing.nombre_rol === ROLES.ADMIN && data.estado === USER_STATES.INACTIVE) {
    const admins = await countActiveAdmins(idUsuario);
    if (admins < MIN_ACTIVE_ADMINS) {
      const err = new Error('Debe haber al menos dos administradores activos');
      err.statusCode = 400;
      throw err;
    }
  }

  if (existing.nombre_rol === ROLES.ADMIN && data.id_rol && data.id_rol !== existing.id_rol) {
    const admins = await countActiveAdmins(idUsuario);
    if (existing.estado === USER_STATES.ACTIVE && admins < MIN_ACTIVE_ADMINS) {
      const err = new Error('No puede cambiar el rol del último administrador activo requerido');
      err.statusCode = 400;
      throw err;
    }
  }

  const fields = [];
  const params = { id_usuario: idUsuario };

  if (data.nombre !== undefined) {
    fields.push('nombre = @nombre');
    params.nombre = data.nombre;
  }
  if (data.username !== undefined) {
    if (typeof data.username !== 'string' || !data.username.trim() || data.username.trim().length > 50) {
      const err = new Error('El nombre de usuario debe tener entre 1 y 50 caracteres');
      err.statusCode = 400;
      throw err;
    }
    fields.push('username = @username');
    params.username = data.username.trim();
  }
  if (data.id_rol !== undefined) {
    fields.push('id_rol = @id_rol');
    params.id_rol = data.id_rol;
  }
  if (data.estado !== undefined) {
    fields.push('estado = @estado');
    params.estado = data.estado;
  }
  if (data.password) {
    fields.push('password_hash = @password_hash');
    params.password_hash = await hashPassword(data.password);
  }

  if (fields.length === 0) return existing;

  await query(`UPDATE dbo.Usuarios SET ${fields.join(', ')} WHERE id_usuario = @id_usuario`, params);

  await registrarBitacora({
    idUsuario: actor?.id ?? null,
    accion: 'USUARIO_MODIFICADO',
    detalle: `Usuario id ${idUsuario}`,
    resultado: 'Exito',
  });

  return findUserById(idUsuario);
}

export async function unlockUser(idUsuario, actor) {
  const user = await findUserById(idUsuario);
  if (!user) {
    const err = new Error('Usuario no encontrado');
    err.statusCode = 404;
    throw err;
  }
  if (user.estado !== USER_STATES.BLOCKED) {
    const err = new Error('El usuario no está bloqueado');
    err.statusCode = 400;
    throw err;
  }

  await query(
    `UPDATE dbo.Usuarios
     SET estado = @estado, intentos_fallidos = 0
     WHERE id_usuario = @id_usuario`,
    { id_usuario: idUsuario, estado: USER_STATES.ACTIVE }
  );

  await registrarBitacora({
    idUsuario: actor?.id ?? null,
    accion: 'USUARIO_DESBLOQUEADO',
    detalle: `Usuario ${user.username} (id ${idUsuario})`,
    resultado: 'Exito',
  });

  return findUserById(idUsuario);
}

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id_usuario: row.id_usuario,
    nombre: row.nombre,
    username: row.username,
    id_rol: row.id_rol,
    nombre_rol: row.nombre_rol,
    estado: row.estado,
    intentos_fallidos: row.intentos_fallidos,
  };
}
