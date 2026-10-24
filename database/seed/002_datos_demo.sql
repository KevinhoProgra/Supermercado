USE SistemaNegocio;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @adminId INT = (
        SELECT TOP (1) id_usuario
        FROM dbo.Usuarios
        WHERE username = 'admin1' AND estado = 'Activo'
    );

    IF @adminId IS NULL
        THROW 52001, 'Ejecute primero el seed del backend para crear el usuario admin1.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema)
    BEGIN
        INSERT INTO dbo.Configuracion_Sistema
            (porcentaje_iva, tipo_cambio_dolar, id_usuario_modifica)
        VALUES (13, 520, @adminId);
    END;

    INSERT INTO dbo.Proveedores (nombre_empresa, contacto, telefono)
    SELECT source.nombre_empresa, source.contacto, source.telefono
    FROM (VALUES
        (N'Distribuidora La Canasta', N'María Vargas', N'2222-1100'),
        (N'Alimentos del Valle', N'José Rojas', N'2444-2200'),
        (N'Lácteos San Miguel', N'Ana Solís', N'2555-3300')
    ) AS source(nombre_empresa, contacto, telefono)
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.Proveedores existing
        WHERE existing.nombre_empresa = source.nombre_empresa
    );

    DECLARE @productos TABLE (
        codigo_barras VARCHAR(50) NOT NULL,
        nombre_producto VARCHAR(150) NOT NULL,
        precio_costo DECIMAL(12,2) NOT NULL,
        precio_venta DECIMAL(12,2) NOT NULL,
        stock_minimo INT NOT NULL,
        aplica_iva BIT NOT NULL
    );

    INSERT INTO @productos
        (codigo_barras, nombre_producto, precio_costo, precio_venta, stock_minimo, aplica_iva)
    VALUES
        ('DEMO-ATUN-001', N'Atún en agua 140 g', 420.00, 550.00, 12, 1),
        ('DEMO-ARROZ-001', N'Arroz 1 kg', 850.00, 1200.00, 10, 1),
        ('DEMO-ACEITE-001', N'Aceite vegetal 900 ml', 1100.00, 1550.00, 8, 1),
        ('DEMO-LECHE-001', N'Leche entera 1 L', 700.00, 950.00, 10, 1),
        ('DEMO-FRIJOL-001', N'Frijoles negros 800 g', 780.00, 1100.00, 8, 1),
        ('DEMO-GALLETA-001', N'Galletas soda 250 g', 500.00, 750.00, 8, 1),
        ('DEMO-CAFE-001', N'Café molido 250 g', 1600.00, 2200.00, 6, 1),
        ('DEMO-AZUCAR-001', N'Azúcar 1 kg', 650.00, 900.00, 8, 1),
        ('DEMO-SAL-001', N'Sal yodada 1 kg', 180.00, 300.00, 10, 1);

    INSERT INTO dbo.Productos
        (codigo_barras, nombre_producto, precio_costo, precio_venta, stock_minimo, aplica_iva)
    SELECT source.codigo_barras, source.nombre_producto, source.precio_costo,
           source.precio_venta, source.stock_minimo, source.aplica_iva
    FROM @productos source
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.Productos existing
        WHERE existing.codigo_barras = source.codigo_barras
    );

    DECLARE @lineasCompra TABLE (
        nombre_proveedor NVARCHAR(150) NOT NULL,
        codigo_barras VARCHAR(50) NOT NULL,
        cantidad INT NOT NULL,
        precio_costo DECIMAL(12,2) NOT NULL
    );

    INSERT INTO @lineasCompra (nombre_proveedor, codigo_barras, cantidad, precio_costo)
    VALUES
        (N'Distribuidora La Canasta', 'DEMO-ATUN-001', 30, 420.00),
        (N'Distribuidora La Canasta', 'DEMO-ARROZ-001', 25, 850.00),
        (N'Distribuidora La Canasta', 'DEMO-ACEITE-001', 18, 1100.00),
        (N'Distribuidora La Canasta', 'DEMO-FRIJOL-001', 20, 780.00),
        (N'Distribuidora La Canasta', 'DEMO-SAL-001', 4, 180.00),
        (N'Alimentos del Valle', 'DEMO-GALLETA-001', 18, 500.00),
        (N'Alimentos del Valle', 'DEMO-CAFE-001', 12, 1600.00),
        (N'Alimentos del Valle', 'DEMO-AZUCAR-001', 20, 650.00),
        (N'Lácteos San Miguel', 'DEMO-LECHE-001', 24, 700.00);

    DECLARE @supplierId INT;
    DECLARE @purchaseId INT;
    DECLARE @purchaseTotal DECIMAL(12,2);
    DECLARE @markerCode VARCHAR(50);

    SELECT @supplierId = id_proveedor
    FROM dbo.Proveedores
    WHERE nombre_empresa = N'Distribuidora La Canasta';

    SET @markerCode = 'DEMO-ATUN-001';
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Compras c
        INNER JOIN dbo.Detalle_Compra dc ON dc.id_compra = c.id_compra
        INNER JOIN dbo.Productos p ON p.id_producto = dc.id_producto
        WHERE c.id_proveedor = @supplierId
          AND p.codigo_barras = @markerCode
          AND dc.precio_costo_unitario = 420.00
    )
    BEGIN
        SELECT @purchaseTotal = SUM(line.cantidad * line.precio_costo)
        FROM @lineasCompra line
        WHERE line.nombre_proveedor = N'Distribuidora La Canasta';

        INSERT INTO dbo.Compras (id_proveedor, id_usuario, total_compra)
        VALUES (@supplierId, @adminId, @purchaseTotal);
        SET @purchaseId = CONVERT(INT, SCOPE_IDENTITY());

        INSERT INTO dbo.Detalle_Compra
            (id_compra, id_producto, cantidad, precio_costo_unitario)
        SELECT @purchaseId, p.id_producto, line.cantidad, line.precio_costo
        FROM @lineasCompra line
        INNER JOIN dbo.Productos p ON p.codigo_barras = line.codigo_barras
        WHERE line.nombre_proveedor = N'Distribuidora La Canasta';

        UPDATE p
        SET p.stock_actual = p.stock_actual + line.cantidad,
            p.precio_costo = line.precio_costo
        FROM dbo.Productos p
        INNER JOIN @lineasCompra line ON line.codigo_barras = p.codigo_barras
        WHERE line.nombre_proveedor = N'Distribuidora La Canasta';
    END;

    SELECT @supplierId = id_proveedor
    FROM dbo.Proveedores
    WHERE nombre_empresa = N'Alimentos del Valle';

    SET @markerCode = 'DEMO-GALLETA-001';
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Compras c
        INNER JOIN dbo.Detalle_Compra dc ON dc.id_compra = c.id_compra
        INNER JOIN dbo.Productos p ON p.id_producto = dc.id_producto
        WHERE c.id_proveedor = @supplierId
          AND p.codigo_barras = @markerCode
          AND dc.precio_costo_unitario = 500.00
    )
    BEGIN
        SELECT @purchaseTotal = SUM(line.cantidad * line.precio_costo)
        FROM @lineasCompra line
        WHERE line.nombre_proveedor = N'Alimentos del Valle';

        INSERT INTO dbo.Compras (id_proveedor, id_usuario, total_compra)
        VALUES (@supplierId, @adminId, @purchaseTotal);
        SET @purchaseId = CONVERT(INT, SCOPE_IDENTITY());

        INSERT INTO dbo.Detalle_Compra
            (id_compra, id_producto, cantidad, precio_costo_unitario)
        SELECT @purchaseId, p.id_producto, line.cantidad, line.precio_costo
        FROM @lineasCompra line
        INNER JOIN dbo.Productos p ON p.codigo_barras = line.codigo_barras
        WHERE line.nombre_proveedor = N'Alimentos del Valle';

        UPDATE p
        SET p.stock_actual = p.stock_actual + line.cantidad,
            p.precio_costo = line.precio_costo
        FROM dbo.Productos p
        INNER JOIN @lineasCompra line ON line.codigo_barras = p.codigo_barras
        WHERE line.nombre_proveedor = N'Alimentos del Valle';
    END;

    SELECT @supplierId = id_proveedor
    FROM dbo.Proveedores
    WHERE nombre_empresa = N'Lácteos San Miguel';

    SET @markerCode = 'DEMO-LECHE-001';
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Compras c
        INNER JOIN dbo.Detalle_Compra dc ON dc.id_compra = c.id_compra
        INNER JOIN dbo.Productos p ON p.id_producto = dc.id_producto
        WHERE c.id_proveedor = @supplierId
          AND p.codigo_barras = @markerCode
          AND dc.precio_costo_unitario = 700.00
    )
    BEGIN
        SELECT @purchaseTotal = SUM(line.cantidad * line.precio_costo)
        FROM @lineasCompra line
        WHERE line.nombre_proveedor = N'Lácteos San Miguel';

        INSERT INTO dbo.Compras (id_proveedor, id_usuario, total_compra)
        VALUES (@supplierId, @adminId, @purchaseTotal);
        SET @purchaseId = CONVERT(INT, SCOPE_IDENTITY());

        INSERT INTO dbo.Detalle_Compra
            (id_compra, id_producto, cantidad, precio_costo_unitario)
        SELECT @purchaseId, p.id_producto, line.cantidad, line.precio_costo
        FROM @lineasCompra line
        INNER JOIN dbo.Productos p ON p.codigo_barras = line.codigo_barras
        WHERE line.nombre_proveedor = N'Lácteos San Miguel';

        UPDATE p
        SET p.stock_actual = p.stock_actual + line.cantidad,
            p.precio_costo = line.precio_costo
        FROM dbo.Productos p
        INNER JOIN @lineasCompra line ON line.codigo_barras = p.codigo_barras
        WHERE line.nombre_proveedor = N'Lácteos San Miguel';
    END;

    DECLARE @purchasingUserId INT = (
        SELECT TOP (1) id_usuario
        FROM dbo.Usuarios
        WHERE username = N'Encargado de compras' AND estado = 'Activo'
    );
    SELECT @supplierId = id_proveedor
    FROM dbo.Proveedores
    WHERE nombre_empresa = N'Distribuidora La Canasta';

    IF @purchasingUserId IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM dbo.Pedidos_Compra pc
           INNER JOIN dbo.Detalle_Pedido_Compra d ON d.id_pedido = pc.id_pedido
           INNER JOIN dbo.Productos p ON p.id_producto = d.id_producto
           WHERE pc.id_proveedor = (
               SELECT id_proveedor FROM dbo.Proveedores
               WHERE nombre_empresa = N'Distribuidora La Canasta'
           )
             AND p.codigo_barras = 'DEMO-SAL-001'
             AND d.cantidad = 6
       )
    BEGIN
        INSERT INTO dbo.Pedidos_Compra (id_proveedor, id_usuario_solicita)
        VALUES (@supplierId, @purchasingUserId);
        SET @purchaseId = CONVERT(INT, SCOPE_IDENTITY());

        INSERT INTO dbo.Detalle_Pedido_Compra
            (id_pedido, id_producto, cantidad, precio_costo_estimado)
        SELECT @purchaseId, id_producto, 6, 180.00
        FROM dbo.Productos
        WHERE codigo_barras = 'DEMO-SAL-001';
    END;

    DECLARE @today DATE = CONVERT(DATE, GETDATE());
    DECLARE @saleId INT;
    DECLARE @subtotal DECIMAL(12,2) = 5400.00;
    DECLARE @taxRate DECIMAL(5,2);
    DECLARE @exchangeRate DECIMAL(12,2);
    DECLARE @tax DECIMAL(12,2);
    DECLARE @saleTotal DECIMAL(12,2);
    DECLARE @dollarsReceived DECIMAL(12,2);
    DECLARE @dollarsEquivalent DECIMAL(12,2);
    DECLARE @cardAmount DECIMAL(12,2);

    SELECT TOP (1)
        @taxRate = porcentaje_iva,
        @exchangeRate = tipo_cambio_dolar
    FROM dbo.Configuracion_Sistema
    ORDER BY id_config DESC;

    SET @tax = ROUND(@subtotal * @taxRate / 100.0, 2);
    SET @saleTotal = @subtotal + @tax;
    SET @dollarsReceived = ROUND((@saleTotal - 1000.00) / @exchangeRate / 2.0, 2);
    SET @dollarsEquivalent = ROUND(@dollarsReceived * @exchangeRate, 2);
    SET @cardAmount = @saleTotal - 1000.00 - @dollarsEquivalent;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Ventas v
        INNER JOIN dbo.Detalle_Venta dv ON dv.id_venta = v.id_venta
        INNER JOIN dbo.Productos p ON p.id_producto = dv.id_producto
        WHERE v.id_usuario = @adminId
          AND v.fecha_venta >= @today
          AND v.fecha_venta < DATEADD(DAY, 1, @today)
          AND p.codigo_barras = 'DEMO-ATUN-001'
          AND dv.cantidad = 2
    )
    BEGIN
        INSERT INTO dbo.Ventas (id_usuario, subtotal, monto_iva, total_venta)
        VALUES (@adminId, @subtotal, @tax, @saleTotal);
        SET @saleId = CONVERT(INT, SCOPE_IDENTITY());

        INSERT INTO dbo.Detalle_Venta
            (id_venta, id_producto, cantidad, precio_unitario, subtotal_linea, iva_linea)
        SELECT
            @saleId,
            p.id_producto,
            sample.cantidad,
            sample.precio_unitario,
            sample.cantidad * sample.precio_unitario,
            ROUND(sample.cantidad * sample.precio_unitario * @taxRate / 100.0, 2)
        FROM (VALUES
            ('DEMO-ATUN-001', 2, 550.00),
            ('DEMO-ARROZ-001', 1, 1200.00),
            ('DEMO-ACEITE-001', 2, 1550.00)
        ) AS sample(codigo_barras, cantidad, precio_unitario)
        INNER JOIN dbo.Productos p ON p.codigo_barras = sample.codigo_barras;

        IF @@ROWCOUNT <> 3
            THROW 52002, 'No se pudieron registrar todos los productos de la factura demo.', 1;

        UPDATE p
        SET p.stock_actual = p.stock_actual - sample.cantidad
        FROM dbo.Productos p
        INNER JOIN (VALUES
            ('DEMO-ATUN-001', 2),
            ('DEMO-ARROZ-001', 1),
            ('DEMO-ACEITE-001', 2)
        ) AS sample(codigo_barras, cantidad)
            ON sample.codigo_barras = p.codigo_barras
        WHERE p.stock_actual >= sample.cantidad;

        IF @@ROWCOUNT <> 3
            THROW 52003, 'Existencia insuficiente para registrar la factura demo.', 1;

        INSERT INTO dbo.Pagos_Venta
            (id_venta, metodo_pago, monto_recibido_moneda_original,
             tipo_cambio_aplicado, monto_equivalente_colones)
        VALUES
            (@saleId, 'Efectivo Colones', 1000.00, 1.0000, 1000.00),
            (@saleId, 'Efectivo Dolares', @dollarsReceived, @exchangeRate, @dollarsEquivalent),
            (@saleId, 'Tarjeta', @cardAmount, 1.0000, @cardAmount);
    END;

    COMMIT TRANSACTION;

    SELECT id_proveedor, nombre_empresa
    FROM dbo.Proveedores
    WHERE nombre_empresa IN (
        N'Distribuidora La Canasta',
        N'Alimentos del Valle',
        N'Lácteos San Miguel'
    )
    ORDER BY nombre_empresa;

    SELECT codigo_barras, nombre_producto, stock_actual, stock_minimo, precio_venta
    FROM dbo.Productos
    WHERE codigo_barras LIKE 'DEMO-%'
    ORDER BY nombre_producto;

    SELECT TOP (5) id_compra, id_proveedor, fecha_compra, total_compra
    FROM dbo.Compras
    WHERE id_usuario = @adminId
    ORDER BY id_compra DESC;

    SELECT TOP (5) id_venta, fecha_venta, subtotal, monto_iva, total_venta
    FROM dbo.Ventas
    WHERE fecha_venta >= @today
      AND fecha_venta < DATEADD(DAY, 1, @today)
    ORDER BY id_venta DESC;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
