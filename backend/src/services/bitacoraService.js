import { query } from '../database/pool.js';

/** @type {boolean | undefined} */
let cachedHasResultadoColumn;

async function detectResultadoColumn() {
  if (cachedHasResultadoColumn !== undefined) return cachedHasResultadoColumn;
  const r = await query(`
    SELECT 1 AS ok
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Bitacora') AND name = N'resultado'
  `);
  cachedHasResultadoColumn = (r.recordset?.length ?? 0) > 0;
  return cachedHasResultadoColumn;
}

/**
 * @param {{ idUsuario?: number|null, accion: string, detalle?: string, resultado?: 'Exito'|'Fallo'|'Advertencia' }} entry
 */
export async function registrarBitacora({ idUsuario = null, accion, detalle = null, resultado = null }) {
  const hasResultado = await detectResultadoColumn();

  if (hasResultado) {
    await query(
      `INSERT INTO dbo.Bitacora (id_usuario, accion, detalle, resultado)
       VALUES (@id_usuario, @accion, @detalle, @resultado)`,
      {
        id_usuario: idUsuario,
        accion,
        detalle,
        resultado,
      }
    );
    return;
  }

  let detalleFinal = detalle;
  if (resultado) {
    detalleFinal = detalle ? `[${resultado}] ${detalle}` : `[${resultado}]`;
  }

  await query(
    `INSERT INTO dbo.Bitacora (id_usuario, accion, detalle)
     VALUES (@id_usuario, @accion, @detalle)`,
    {
      id_usuario: idUsuario,
      accion,
      detalle: detalleFinal,
    }
  );
}
