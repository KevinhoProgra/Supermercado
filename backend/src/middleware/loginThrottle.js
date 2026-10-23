import { query } from '../database/pool.js';
import { registrarBitacora } from '../services/bitacoraService.js';

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export async function checkLoginThrottle(req, res, next) {
  try {
    const result = await query(
      `SELECT 1 AS bloqueado
       FROM dbo.Bloqueos_Formulario
       WHERE client_key = @client_key AND bloqueado = 1`,
      { client_key: clientKey(req) }
    );
    if (result.recordset?.length) {
      await registrarBitacora({
        accion: 'LOGIN_FORMULARIO_BLOQUEADO',
        detalle: 'Intento de acceso desde un formulario bloqueado.',
        resultado: 'Advertencia',
      });
      return res.status(423).json({
        success: false,
        error: {
          message: 'El formulario de acceso está bloqueado. Contacte a un administrador.',
          code: 'LOGIN_FORM_LOCKED',
        },
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function applyUnknownUserLock(req) {
  await query(
    `SET XACT_ABORT ON;
     BEGIN TRY
       BEGIN TRANSACTION;
       IF EXISTS (
         SELECT 1 FROM dbo.Bloqueos_Formulario WITH (UPDLOCK, HOLDLOCK)
         WHERE client_key = @client_key
       )
         UPDATE dbo.Bloqueos_Formulario
         SET bloqueado = 1, fecha_bloqueo = GETDATE(),
             fecha_desbloqueo = NULL, id_usuario_desbloquea = NULL
         WHERE client_key = @client_key;
       ELSE
         INSERT INTO dbo.Bloqueos_Formulario (client_key) VALUES (@client_key);
       COMMIT TRANSACTION;
     END TRY
     BEGIN CATCH
       IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
       THROW;
     END CATCH;`,
    { client_key: clientKey(req) }
  );
}

export async function listLoginFormLocks() {
  const result = await query(
    `SELECT client_key, fecha_bloqueo
     FROM dbo.Bloqueos_Formulario
     WHERE bloqueado = 1
     ORDER BY fecha_bloqueo DESC`
  );
  return result.recordset ?? [];
}

export async function unlockLoginForm(clientKeyValue, adminUserId) {
  const result = await query(
    `UPDATE dbo.Bloqueos_Formulario
     SET bloqueado = 0, fecha_desbloqueo = GETDATE(),
         id_usuario_desbloquea = @id_usuario
     OUTPUT INSERTED.client_key
     WHERE client_key = @client_key AND bloqueado = 1`,
    { client_key: clientKeyValue, id_usuario: adminUserId }
  );
  return result.recordset?.[0] ?? null;
}
