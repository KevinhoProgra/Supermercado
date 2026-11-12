USE SistemaNegocio;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre_rol = N'Cliente')
    INSERT INTO dbo.Roles (nombre_rol) VALUES (N'Cliente');
GO

IF COL_LENGTH(N'dbo.Productos', N'imagen_url') IS NULL
    ALTER TABLE dbo.Productos ADD imagen_url NVARCHAR(2048) NULL;
GO

IF OBJECT_ID(N'dbo.Pedidos_Online', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Pedidos_Online (
        id_pedido INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario INT NOT NULL,
        fecha_pedido DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        subtotal DECIMAL(12,2) NOT NULL,
        monto_iva DECIMAL(12,2) NOT NULL,
        total DECIMAL(12,2) NOT NULL,
        estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
        CONSTRAINT FK_PedidosOnline_Usuario FOREIGN KEY (id_usuario) REFERENCES dbo.Usuarios(id_usuario),
        CONSTRAINT CK_PedidosOnline_Subtotal CHECK (subtotal >= 0),
        CONSTRAINT CK_PedidosOnline_IVA CHECK (monto_iva >= 0),
        CONSTRAINT CK_PedidosOnline_Total CHECK (total >= 0),
        CONSTRAINT CK_PedidosOnline_Estado
            CHECK (estado IN ('Pendiente', 'Preparando', 'Listo para retiro', 'Entregado', 'Cancelado'))
    );
END
GO

IF OBJECT_ID(N'dbo.Detalle_Pedido_Online', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Detalle_Pedido_Online (
        id_detalle_pedido INT IDENTITY(1,1) PRIMARY KEY,
        id_pedido INT NOT NULL,
        id_producto INT NOT NULL,
        nombre_producto NVARCHAR(150) NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(12,2) NOT NULL,
        subtotal_linea DECIMAL(12,2) NOT NULL,
        iva_linea DECIMAL(12,2) NOT NULL DEFAULT 0,
        CONSTRAINT FK_DetallePedidoOnline_Pedido
            FOREIGN KEY (id_pedido) REFERENCES dbo.Pedidos_Online(id_pedido),
        CONSTRAINT FK_DetallePedidoOnline_Producto
            FOREIGN KEY (id_producto) REFERENCES dbo.Productos(id_producto),
        CONSTRAINT CK_DetallePedidoOnline_Cantidad CHECK (cantidad > 0),
        CONSTRAINT CK_DetallePedidoOnline_Precio CHECK (precio_unitario >= 0),
        CONSTRAINT CK_DetallePedidoOnline_Subtotal CHECK (subtotal_linea >= 0),
        CONSTRAINT CK_DetallePedidoOnline_IVA CHECK (iva_linea >= 0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PedidosOnline_Usuario_Fecha' AND object_id = OBJECT_ID(N'dbo.Pedidos_Online'))
    CREATE INDEX IX_PedidosOnline_Usuario_Fecha
        ON dbo.Pedidos_Online(id_usuario, fecha_pedido DESC);
GO

INSERT INTO dbo.Permisos (clave, descripcion)
SELECT p.clave, p.descripcion
FROM (VALUES
    ('tienda:catalog', 'Consultar productos disponibles en la tienda en línea'),
    ('tienda:orders:create', 'Crear pedidos desde la tienda en línea'),
    ('tienda:orders:read', 'Consultar los propios pedidos en línea')
) AS p(clave, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permisos existing WHERE existing.clave = p.clave);
GO

INSERT INTO dbo.Rol_Permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM dbo.Roles r
CROSS JOIN dbo.Permisos p
WHERE r.nombre_rol = N'Cliente'
  AND p.clave IN ('tienda:catalog', 'tienda:orders:create', 'tienda:orders:read')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.Rol_Permisos rp
      WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );
GO
