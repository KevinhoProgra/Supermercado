import { query } from '../database/pool.js';
import { USER_STATES } from '../constants/roles.js';

export async function incrementFailedLogin(idUsuario, maxAttempts) {
  const result = await query(
    `UPDATE dbo.Usuarios
     SET intentos_fallidos = intentos_fallidos + 1,
         estado = CASE
           WHEN intentos_fallidos + 1 >= @max_attempts THEN @blocked
           ELSE estado
         END
     OUTPUT INSERTED.estado AS estado, INSERTED.intentos_fallidos AS intentos_fallidos
     WHERE id_usuario = @id_usuario AND estado = @active`,
    {
      id_usuario: idUsuario,
      max_attempts: maxAttempts,
      active: USER_STATES.ACTIVE,
      blocked: USER_STATES.BLOCKED,
    }
  );
  return result.recordset?.[0] ?? null;
}

export async function resetFailedLogins(idUsuario) {
  const result = await query(
    `UPDATE dbo.Usuarios
     SET intentos_fallidos = 0
     OUTPUT INSERTED.id_usuario AS id_usuario
     WHERE id_usuario = @id_usuario AND estado = @active`,
    { id_usuario: idUsuario, active: USER_STATES.ACTIVE }
  );
  return result.recordset?.[0] ?? null;
}
