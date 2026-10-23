import { query } from '../database/pool.js';
import { registrarBitacora } from './bitacoraService.js';

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function moneyCents(value) {
  return Math.round(Number(value) * 100);
}

function amount(cents) {
  return Number((cents / 100).toFixed(2));
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw httpError('Agregue al menos un producto.');
  }
  const quantities = new Map();
  for (const item of items) {
    const id = Number(item.id_producto);
    const quantity = Number(item.cantidad);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(quantity) || quantity < 1) {
      throw httpError('Los productos y cantidades deben ser válidos.');
    }
    quantities.set(id, (quantities.get(id) ?? 0) + quantity);
  }
  return [...quantities].map(([id_producto, cantidad]) => ({ id_producto, cantidad }));
}

async function getProducts(items) {
  const parameters = Object.fromEntries(items.map((item, index) => [`product${index}`, item.id_producto]));
  const result = await query(
    `SELECT id_producto, nombre_producto, precio_costo, precio_venta, stock_actual, stock_minimo, aplica_iva
     FROM dbo.Productos
     WHERE id_producto IN (${items.map((_, index) => `@product${index}`).join(', ')})`,
    parameters
  );
  if (result.recordset.length !== items.length) throw httpError('Uno o más productos no existen.', 404);
  return result.recordset;
}

async function getSystemConfig() {
  const result = await query(
    `SELECT TOP (1) porcentaje_iva, tipo_cambio_dolar
     FROM dbo.Configuracion_Sistema
     ORDER BY id_config DESC`
  );
  if (!result.recordset?.[0]) {
    throw httpError('Falta configurar el IVA y el tipo de cambio en el sistema.', 409);
  }
  return result.recordset[0];
}

export async function listProducts() {
  const result = await query(
    `SELECT id_producto, codigo_barras, nombre_producto, precio_costo, precio_venta,
            stock_actual, stock_minimo, aplica_iva
     FROM dbo.Productos
     ORDER BY nombre_producto`
  );
  return result.recordset ?? [];
}

export async function saveProduct(data, idProducto, actor) {
  const values = {
    codigo_barras: data.codigo_barras,
    nombre_producto: data.nombre_producto,
    precio_costo: Number(data.precio_costo),
    precio_venta: Number(data.precio_venta),
    stock_minimo: Number(data.stock_minimo ?? 0),
    aplica_iva: data.aplica_iva === false ? 0 : 1,
  };
  if (
    typeof values.codigo_barras !== 'string' ||
    !values.codigo_barras.trim() ||
    typeof values.nombre_producto !== 'string' ||
    !values.nombre_producto.trim() ||
    !Number.isFinite(values.precio_costo) ||
    values.precio_costo < 0 ||
    !Number.isFinite(values.precio_venta) ||
    values.precio_venta < 0 ||
    !Number.isInteger(values.stock_minimo) ||
    values.stock_minimo < 0
  ) {
    throw httpError('Revise el código, nombre, precios y stock mínimo.');
  }
  if (idProducto) {
    const result = await query(
      `UPDATE dbo.Productos
       SET codigo_barras = @codigo_barras, nombre_producto = @nombre_producto,
           precio_costo = @precio_costo, precio_venta = @precio_venta,
           stock_minimo = @stock_minimo, aplica_iva = @aplica_iva
       WHERE id_producto = @id_producto`,
      { ...values, id_producto: idProducto }
    );
    if (result.rowsAffected[0] === 0) throw httpError('Producto no encontrado.', 404);
  } else {
    await query(
      `INSERT INTO dbo.Productos
       (codigo_barras, nombre_producto, precio_costo, precio_venta, stock_minimo, aplica_iva)
       VALUES (@codigo_barras, @nombre_producto, @precio_costo, @precio_venta, @stock_minimo, @aplica_iva)`,
      values
    );
  }
  await registrarBitacora({
    idUsuario: actor.id,
    accion: idProducto ? 'PRODUCTO_MODIFICADO' : 'PRODUCTO_CREADO',
    detalle: values.nombre_producto,
    resultado: 'Exito',
  });
}

export async function getConfig() {
  return getSystemConfig();
}

export async function updateConfig(data, actor) {
  const iva = Number(data.porcentaje_iva);
  const exchangeRate = Number(data.tipo_cambio_dolar);
  if (!Number.isFinite(iva) || iva < 0 || iva > 100 || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw httpError('El IVA debe estar entre 0 y 100 y el tipo de cambio debe ser mayor que cero.');
  }
  await query(
    `INSERT INTO dbo.Configuracion_Sistema (porcentaje_iva, tipo_cambio_dolar, id_usuario_modifica)
     VALUES (@iva, @tipo_cambio, @id_usuario)`,
    { iva, tipo_cambio: exchangeRate, id_usuario: actor.id }
  );
  await registrarBitacora({
    idUsuario: actor.id,
    accion: 'CONFIGURACION_MODIFICADA',
    detalle: `IVA ${iva}%, tipo de cambio ${exchangeRate}`,
    resultado: 'Exito',
  });
}

export async function createSale(data, actor) {
  const items = normalizeItems(data.items);
  const products = await getProducts(items);
  const productById = new Map(products.map((product) => [product.id_producto, product]));
  const config = await getSystemConfig();
  const ivaPercent = Number(config.porcentaje_iva);
  let subtotalCents = 0;
  let ivaCents = 0;
  const lines = items.map((item) => {
    const product = productById.get(item.id_producto);
    if (product.stock_actual < item.cantidad) {
      throw httpError(`Existencia insuficiente para ${product.nombre_producto}. Stock: ${product.stock_actual}.`, 409);
    }
    const lineSubtotal = moneyCents(product.precio_venta) * item.cantidad;
    const lineTax = product.aplica_iva ? Math.round((lineSubtotal * ivaPercent) / 100) : 0;
    subtotalCents += lineSubtotal;
    ivaCents += lineTax;
    return { ...item, product, lineSubtotal, lineTax };
  });
  const totalCents = subtotalCents + ivaCents;
  if (!Array.isArray(data.pagos) || data.pagos.length === 0) throw httpError('Agregue al menos un medio de pago.');
  const validMethods = ['Efectivo Colones', 'Efectivo Dolares', 'Tarjeta'];
  const payments = data.pagos.map((payment) => {
    const method = payment.metodo_pago;
    const originalCents = moneyCents(payment.monto_recibido_moneda_original);
    if (!validMethods.includes(method) || !Number.isInteger(originalCents) || originalCents <= 0) {
      throw httpError('Revise los métodos y montos de pago.');
    }
    const exchangeRate = method === 'Efectivo Dolares' ? Number(config.tipo_cambio_dolar) : 1;
    const equivalentCents = Math.round((originalCents / 100) * exchangeRate * 100);
    return {
      metodo_pago: method,
      original: amount(originalCents),
      tipo_cambio: exchangeRate,
      equivalente: amount(equivalentCents),
      equivalentCents,
    };
  });
  const paidCents = payments.reduce((sum, payment) => sum + payment.equivalentCents, 0);
  if (paidCents < totalCents) {
    throw httpError(`Faltan ₡${amount(totalCents - paidCents).toFixed(2)} para completar el pago.`);
  }
  const changeCents = paidCents - totalCents;
  const cashCents = payments
    .filter((payment) => payment.metodo_pago !== 'Tarjeta')
    .reduce((sum, payment) => sum + payment.equivalentCents, 0);
  if (changeCents > cashCents) throw httpError('El exceso debe pagarse en efectivo; no se da vuelto en tarjeta.');

  const inputs = {
    id_usuario: actor.id,
    subtotal: amount(subtotalCents),
    iva: amount(ivaCents),
    total: amount(totalCents),
  };
  const statements = [
    'SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;',
    `INSERT INTO dbo.Ventas (id_usuario, subtotal, monto_iva, total_venta)
     VALUES (@id_usuario, @subtotal, @iva, @total);
     DECLARE @id_venta INT = SCOPE_IDENTITY();`,
  ];
  lines.forEach((line, index) => {
    inputs[`product${index}`] = line.id_producto;
    inputs[`quantity${index}`] = line.cantidad;
    inputs[`price${index}`] = Number(line.product.precio_venta);
    inputs[`lineSubtotal${index}`] = amount(line.lineSubtotal);
    inputs[`lineTax${index}`] = amount(line.lineTax);
    statements.push(
      `UPDATE dbo.Productos
       SET stock_actual = stock_actual - @quantity${index}
       WHERE id_producto = @product${index} AND stock_actual >= @quantity${index};
       IF @@ROWCOUNT = 0 THROW 50001, 'Existencia insuficiente al registrar la venta.', 1;
       INSERT INTO dbo.Detalle_Venta
       (id_venta, id_producto, cantidad, precio_unitario, subtotal_linea, iva_linea)
       VALUES (@id_venta, @product${index}, @quantity${index}, @price${index},
               @lineSubtotal${index}, @lineTax${index});`
    );
  });
  payments.forEach((payment, index) => {
    inputs[`method${index}`] = payment.metodo_pago;
    inputs[`received${index}`] = payment.original;
    inputs[`rate${index}`] = payment.tipo_cambio;
    inputs[`equivalent${index}`] = payment.equivalente;
    statements.push(
      `INSERT INTO dbo.Pagos_Venta
       (id_venta, metodo_pago, monto_recibido_moneda_original, tipo_cambio_aplicado, monto_equivalente_colones)
       VALUES (@id_venta, @method${index}, @received${index}, @rate${index}, @equivalent${index});`
    );
  });
  statements.push(
    'COMMIT TRANSACTION; SELECT @id_venta AS id_venta;',
    'END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION; THROW; END CATCH;'
  );
  const result = await query(statements.join('\n'), inputs);
  const idVenta = result.recordset?.[0]?.id_venta;
  await registrarBitacora({
    idUsuario: actor.id,
    accion: 'VENTA_REGISTRADA',
    detalle: `Venta ${idVenta}, total ₡${amount(totalCents).toFixed(2)}`,
    resultado: 'Exito',
  });
  return {
    id_venta: idVenta,
    subtotal: amount(subtotalCents),
    monto_iva: amount(ivaCents),
    total_venta: amount(totalCents),
    vuelto_colones: amount(changeCents),
  };
}

export async function listSuppliers() {
  const result = await query(
    'SELECT id_proveedor, nombre_empresa, contacto, telefono FROM dbo.Proveedores ORDER BY nombre_empresa'
  );
  return result.recordset ?? [];
}

export async function createSupplier(data, actor) {
  if (typeof data.nombre_empresa !== 'string' || !data.nombre_empresa.trim()) {
    throw httpError('El nombre de la empresa es obligatorio.');
  }
  await query(
    `INSERT INTO dbo.Proveedores (nombre_empresa, contacto, telefono)
     VALUES (@nombre_empresa, @contacto, @telefono)`,
    {
      nombre_empresa: data.nombre_empresa.trim(),
      contacto: data.contacto || null,
      telefono: data.telefono || null,
    }
  );
  await registrarBitacora({
    idUsuario: actor.id,
    accion: 'PROVEEDOR_CREADO',
    detalle: data.nombre_empresa.trim(),
    resultado: 'Exito',
  });
}

export async function listPurchaseSuggestions() {
  const result = await query(
    `SELECT p.id_producto, p.nombre_producto, p.stock_actual, p.stock_minimo,
            p.stock_minimo - p.stock_actual AS cantidad_sugerida
     FROM dbo.Productos p
     WHERE p.stock_actual < p.stock_minimo
     ORDER BY p.nombre_producto`
  );
  return result.recordset ?? [];
}

export async function createPurchaseOrder(data, actor) {
  const items = normalizeItems(data.items);
  if (!Number.isInteger(Number(data.id_proveedor)) || Number(data.id_proveedor) < 1) {
    throw httpError('Seleccione un proveedor.');
  }
  const products = await getProducts(items);
  const productById = new Map(products.map((product) => [product.id_producto, product]));
  for (const item of items) {
    if (item.cantidad > productById.get(item.id_producto).stock_minimo - productById.get(item.id_producto).stock_actual) {
      throw httpError('Las cantidades del pedido no pueden exceder la sugerencia por stock crítico.');
    }
  }
  const inputs = { proveedor: Number(data.id_proveedor), usuario: actor.id };
  const statements = [
    'SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;',
    `INSERT INTO dbo.Pedidos_Compra (id_proveedor, id_usuario_solicita)
     VALUES (@proveedor, @usuario);
     DECLARE @id_pedido INT = SCOPE_IDENTITY();`,
  ];
  items.forEach((item, index) => {
    inputs[`product${index}`] = item.id_producto;
    inputs[`quantity${index}`] = item.cantidad;
    inputs[`cost${index}`] = Number(productById.get(item.id_producto).precio_costo);
    statements.push(
      `INSERT INTO dbo.Detalle_Pedido_Compra (id_pedido, id_producto, cantidad, precio_costo_estimado)
       VALUES (@id_pedido, @product${index}, @quantity${index}, @cost${index});`
    );
  });
  statements.push(
    'COMMIT TRANSACTION; SELECT @id_pedido AS id_pedido;',
    'END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION; THROW; END CATCH;'
  );
  const result = await query(statements.join('\n'), inputs);
  await registrarBitacora({
    idUsuario: actor.id,
    accion: 'PEDIDO_COMPRA_SOLICITADO',
    detalle: `Pedido ${result.recordset?.[0]?.id_pedido}`,
    resultado: 'Exito',
  });
  return { id_pedido: result.recordset?.[0]?.id_pedido };
}

export async function listPurchaseOrders() {
  const result = await query(
    `SELECT pc.id_pedido, pc.estado, pc.fecha_solicitud, pc.fecha_aprobacion,
            pr.nombre_empresa, solicita.username AS solicitado_por, aprueba.username AS aprobado_por,
            (SELECT SUM(total.cantidad * total.precio_costo_estimado)
             FROM dbo.Detalle_Pedido_Compra total
             WHERE total.id_pedido = pc.id_pedido) AS total_estimado,
            d.id_producto, p.nombre_producto, d.cantidad, d.precio_costo_estimado
     FROM dbo.Pedidos_Compra pc
     INNER JOIN dbo.Proveedores pr ON pr.id_proveedor = pc.id_proveedor
     INNER JOIN dbo.Usuarios solicita ON solicita.id_usuario = pc.id_usuario_solicita
     LEFT JOIN dbo.Usuarios aprueba ON aprueba.id_usuario = pc.id_usuario_aprueba
     LEFT JOIN dbo.Detalle_Pedido_Compra d ON d.id_pedido = pc.id_pedido
     LEFT JOIN dbo.Productos p ON p.id_producto = d.id_producto
     ORDER BY pc.fecha_solicitud DESC, pc.id_pedido DESC, d.id_detalle_pedido`
  );
  const orders = new Map();
  for (const row of result.recordset ?? []) {
    if (!orders.has(row.id_pedido)) {
      const { id_producto, nombre_producto, cantidad, precio_costo_estimado, ...order } = row;
      orders.set(row.id_pedido, { ...order, items: [] });
    }
    if (row.id_producto !== null) {
      orders.get(row.id_pedido).items.push({
        id_producto: row.id_producto,
        nombre_producto: row.nombre_producto,
        cantidad: row.cantidad,
        precio_costo_estimado: row.precio_costo_estimado,
      });
    }
  }
  return [...orders.values()];
}

export async function approvePurchaseOrder(idPedido, actor) {
  const result = await query(
    `UPDATE dbo.Pedidos_Compra
     SET estado = 'Aprobado', id_usuario_aprueba = @usuario, fecha_aprobacion = GETDATE()
     WHERE id_pedido = @id_pedido AND estado = 'Pendiente'
     OUTPUT INSERTED.id_pedido`,
    { id_pedido: idPedido, usuario: actor.id }
  );
  if (!result.recordset?.length) throw httpError('El pedido no existe o ya fue revisado.', 409);
  await registrarBitacora({
    idUsuario: actor.id,
    accion: 'PEDIDO_COMPRA_APROBADO',
    detalle: `Pedido ${idPedido}`,
    resultado: 'Exito',
  });
}

export async function registerPurchase(data, actor) {
  const items = normalizeItems(data.items);
  const supplierId = Number(data.id_proveedor);
  if (!Number.isInteger(supplierId) || supplierId < 1) throw httpError('Seleccione un proveedor.');
  const products = await getProducts(items);
  const productById = new Map(products.map((product) => [product.id_producto, product]));
  const purchaseOrderId = data.id_pedido == null ? null : Number(data.id_pedido);
  if (purchaseOrderId !== null) {
    if (!Number.isInteger(purchaseOrderId) || purchaseOrderId < 1) throw httpError('Pedido inválido.');
    const order = await query(
      `SELECT estado, id_proveedor FROM dbo.Pedidos_Compra WHERE id_pedido = @id_pedido`,
      { id_pedido: purchaseOrderId }
    );
    if (order.recordset?.[0]?.estado !== 'Aprobado' || order.recordset[0].id_proveedor !== supplierId) {
      throw httpError('Solo se puede recibir mercadería de un pedido aprobado para ese proveedor.', 409);
    }
  }
  const lines = items.map((item) => {
    const cost = data.items.find((line) => Number(line.id_producto) === item.id_producto)?.precio_costo_unitario;
    const unitCost = cost === undefined ? Number(productById.get(item.id_producto).precio_costo) : Number(cost);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw httpError('El costo ingresado no es válido.');
    return { ...item, unitCost };
  });
  const total = amount(lines.reduce((sum, line) => sum + moneyCents(line.unitCost) * line.cantidad, 0));
  const inputs = { proveedor: supplierId, usuario: actor.id, total, pedido: purchaseOrderId };
  const statements = [
    'SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;',
    `IF @pedido IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM dbo.Pedidos_Compra WITH (UPDLOCK, HOLDLOCK)
       WHERE id_pedido = @pedido AND estado = 'Aprobado' AND id_proveedor = @proveedor
     ) THROW 50002, 'El pedido ya no está aprobado.', 1;
     INSERT INTO dbo.Compras (id_proveedor, id_usuario, total_compra, id_pedido)
     VALUES (@proveedor, @usuario, @total, @pedido);
     DECLARE @id_compra INT = SCOPE_IDENTITY();`,
  ];
  lines.forEach((line, index) => {
    inputs[`product${index}`] = line.id_producto;
    inputs[`quantity${index}`] = line.cantidad;
    inputs[`cost${index}`] = line.unitCost;
    statements.push(
      `UPDATE dbo.Productos
       SET stock_actual = stock_actual + @quantity${index}, precio_costo = @cost${index}
       WHERE id_producto = @product${index};
       IF @@ROWCOUNT = 0 THROW 50003, 'El producto no existe.', 1;
       INSERT INTO dbo.Detalle_Compra (id_compra, id_producto, cantidad, precio_costo_unitario)
       VALUES (@id_compra, @product${index}, @quantity${index}, @cost${index});`
    );
  });
  statements.push(
    `IF @pedido IS NOT NULL
       UPDATE dbo.Pedidos_Compra SET estado = 'Recibido' WHERE id_pedido = @pedido;
     COMMIT TRANSACTION; SELECT @id_compra AS id_compra;`,
    'END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION; THROW; END CATCH;'
  );
  const result = await query(statements.join('\n'), inputs);
  await registrarBitacora({
    idUsuario: actor.id,
    accion: 'COMPRA_REGISTRADA',
    detalle: `Compra ${result.recordset?.[0]?.id_compra}, total ₡${total.toFixed(2)}`,
    resultado: 'Exito',
  });
  return { id_compra: result.recordset?.[0]?.id_compra, total_compra: total };
}

export async function getSalesReport(date) {
  const result = await query(
    `SELECT COUNT(*) AS cantidad_ventas, COALESCE(SUM(subtotal), 0) AS subtotal,
            COALESCE(SUM(monto_iva), 0) AS monto_iva, COALESCE(SUM(total_venta), 0) AS total_venta
     FROM dbo.Ventas
     WHERE fecha_venta >= @fecha AND fecha_venta < DATEADD(day, 1, @fecha)`,
    { fecha: date }
  );
  return result.recordset?.[0];
}

export async function getCashflowReport(date) {
  const result = await query(
    `SELECT pv.metodo_pago,
            COALESCE(SUM(pv.monto_recibido_moneda_original), 0) AS monto_moneda_original,
            COALESCE(SUM(pv.monto_equivalente_colones), 0) AS monto_equivalente_colones
     FROM dbo.Pagos_Venta pv
     INNER JOIN dbo.Ventas v ON v.id_venta = pv.id_venta
     WHERE v.fecha_venta >= @fecha AND v.fecha_venta < DATEADD(day, 1, @fecha)
     GROUP BY pv.metodo_pago
     ORDER BY pv.metodo_pago`,
    { fecha: date }
  );
  return result.recordset ?? [];
}

export async function getAuditLog({ from, to, idUsuario }) {
  const result = await query(
    `SELECT b.id_bitacora, b.fecha_hora, b.accion, b.detalle, b.resultado,
            b.id_usuario, u.username
     FROM dbo.Bitacora b
     LEFT JOIN dbo.Usuarios u ON u.id_usuario = b.id_usuario
     WHERE (@desde IS NULL OR b.fecha_hora >= @desde)
       AND (@hasta IS NULL OR b.fecha_hora < DATEADD(day, 1, @hasta))
       AND (@id_usuario IS NULL OR b.id_usuario = @id_usuario)
     ORDER BY b.fecha_hora DESC, b.id_bitacora DESC`,
    {
      desde: from || null,
      hasta: to || null,
      id_usuario: idUsuario || null,
    }
  );
  return result.recordset ?? [];
}
