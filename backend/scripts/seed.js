/**
 * Datos iniciales: roles, dos administradores y (opcional) la configuración del sistema.
 * Se puede ejecutar varias veces: solo crea lo que falta.
 *
 * Uso (desde la carpeta backend/):  npm run seed
 * Requiere en .env:  SEED_ADMIN_PASSWORD  (mínimo 8 caracteres)
 * Opcional en .env:  SEED_TIPO_CAMBIO y SEED_IVA_PERCENT (para crear Configuracion_Sistema)
 */
import { env } from '../src/config/env.js';
import { query, closePool } from '../src/database/pool.js';
import { hashPassword } from '../src/utils/password.js';
import { ALL_ROLES, ROLES, USER_STATES } from '../src/constants/roles.js';

const MIN_PASSWORD_LENGTH = 8;


async function ensureRoles() {
  for (const nombre of ALL_ROLES) {
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre_rol = @nombre)
         INSERT INTO dbo.Roles (nombre_rol) VALUES (@nombre)`,
      { nombre }
    );
  }
  const r = await query('SELECT id_rol FROM dbo.Roles WHERE nombre_rol = @nombre', {
    nombre: ROLES.ADMIN,
  });
  return r.recordset[0].id_rol;
}

async function ensureAdmin({ username, nombre }, idRol, passwordHash) {
  const existing = await query('SELECT id_usuario FROM dbo.Usuarios WHERE username = @username', {
    username,
  });
  if (existing.recordset.length > 0) {
    return { id: existing.recordset[0].id_usuario, created: false };
  }

  const r = await query(
    `INSERT INTO dbo.Usuarios (nombre, username, password_hash, id_rol, estado)
     OUTPUT INSERTED.id_usuario
     VALUES (@nombre, @username, @password_hash, @id_rol, @estado)`,
    {
      nombre,
      username,
      password_hash: passwordHash,
      id_rol: idRol,
      estado: USER_STATES.ACTIVE,
    }
  );
  return { id: r.recordset[0].id_usuario, created: true };
}

async function roleId(nombre) {
  const result = await query('SELECT id_rol FROM dbo.Roles WHERE nombre_rol = @nombre', { nombre });
  if (!result.recordset?.[0]) throw new Error(`No se pudo encontrar el perfil ${nombre}.`);
  return result.recordset[0].id_rol;
}

async function ensureSeedUser({ username, nombre }, roleName, passwordHash) {
  return ensureAdmin({ username, nombre }, await roleId(roleName), passwordHash);
}

async function ensureConfig(idUsuario) {
  const existing = await query('SELECT COUNT(*) AS total FROM dbo.Configuracion_Sistema');
  if (Number(existing.recordset[0].total) > 0) return 'ya existía';

  const tipoCambio = Number(process.env.SEED_TIPO_CAMBIO);
  const iva = Number(process.env.SEED_IVA_PERCENT) || 13;

  if (!tipoCambio || tipoCambio <= 0) {
    return 'no creada (defina SEED_TIPO_CAMBIO en .env y vuelva a ejecutar el seed)';
  }

  await query(
    `INSERT INTO dbo.Configuracion_Sistema (porcentaje_iva, tipo_cambio_dolar, id_usuario_modifica)
     VALUES (@iva, @tipo_cambio, @id_usuario)`,
    { iva, tipo_cambio: tipoCambio, id_usuario: idUsuario }
  );
  return `creada (IVA ${iva}%, tipo de cambio ${tipoCambio})`;
}

async function main() {
  if (env.seed.adminPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Defina SEED_ADMIN_PASSWORD en backend/.env (mínimo ${MIN_PASSWORD_LENGTH} caracteres).`
    );
  }
  if (env.seed.admin1.username === env.seed.admin2.username) {
    throw new Error('SEED_ADMIN1_USERNAME y SEED_ADMIN2_USERNAME deben ser distintos.');
  }

  const idRolAdmin = await ensureRoles();
  const passwordHash = await hashPassword(env.seed.adminPassword);

  const admin1 = await ensureAdmin(env.seed.admin1, idRolAdmin, passwordHash);
  const admin2 = await ensureAdmin(env.seed.admin2, idRolAdmin, passwordHash);
  const cashier = await ensureSeedUser(env.seed.cashier, ROLES.CAJERO, passwordHash);
  const purchasing = await ensureSeedUser(env.seed.purchasing, ROLES.COMPRAS, passwordHash);
  const config = await ensureConfig(admin1.id);

  console.log('Seed completado:');
  console.log(`  Roles: ${ALL_ROLES.join(', ')}`);
  console.log(`  ${env.seed.admin1.username}: ${admin1.created ? 'creado' : 'ya existía (su contraseña no se modifica)'}`);
  console.log(`  ${env.seed.admin2.username}: ${admin2.created ? 'creado' : 'ya existía (su contraseña no se modifica)'}`);
  console.log(`  ${env.seed.cashier.username}: ${cashier.created ? 'creado' : 'ya existía (su contraseña no se modifica)'}`);
  console.log(`  ${env.seed.purchasing.username}: ${purchasing.created ? 'creado' : 'ya existía (su contraseña no se modifica)'}`);
  console.log(`  Configuración del sistema: ${config}`);
}

main()
  .then(() => closePool())
  .catch(async (err) => {
    console.error('Seed falló:', err.message);
    await closePool().catch(() => {});
    process.exit(1);
  });