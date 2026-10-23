USE SistemaNegocio;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre_rol = N'Administrador')
    INSERT INTO dbo.Roles (nombre_rol) VALUES (N'Administrador');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre_rol = N'Cajero')
    INSERT INTO dbo.Roles (nombre_rol) VALUES (N'Cajero');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre_rol = N'Encargado de compras')
    INSERT INTO dbo.Roles (nombre_rol) VALUES (N'Encargado de compras');
GO

IF OBJECT_ID(N'dbo.Permisos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Permisos (
        id_permiso INT IDENTITY(1,1) PRIMARY KEY,
        clave VARCHAR(80) NOT NULL UNIQUE,
        descripcion VARCHAR(200) NOT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.Rol_Permisos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Rol_Permisos (
        id_rol INT NOT NULL,
        id_permiso INT NOT NULL,
        CONSTRAINT PK_Rol_Permisos PRIMARY KEY (id_rol, id_permiso),
        CONSTRAINT FK_RolPermisos_Roles FOREIGN KEY (id_rol) REFERENCES dbo.Roles(id_rol),
        CONSTRAINT FK_RolPermisos_Permisos FOREIGN KEY (id_permiso) REFERENCES dbo.Permisos(id_permiso)
    );
END
GO

INSERT INTO dbo.Permisos (clave, descripcion)
SELECT p.clave, p.descripcion
FROM (VALUES
    ('*', 'Acceso completo al sistema'),
    ('productos:read', 'Consultar productos e inventario'),
    ('ventas:catalog', 'Consultar catálogo desde facturación'),
    ('ventas:create', 'Facturar ventas y registrar pagos'),
    ('reportes:ventas', 'Consultar informes de ventas'),
    ('reportes:caja', 'Consultar flujo de caja'),
    ('compras:read', 'Consultar compras, pedidos y niveles críticos'),
    ('compras:create', 'Solicitar pedidos y registrar mercadería'),
    ('proveedores:read', 'Consultar proveedores'),
    ('proveedores:create', 'Registrar proveedores')
) AS p(clave, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permisos existing WHERE existing.clave = p.clave);
GO

INSERT INTO dbo.Rol_Permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM dbo.Roles r
CROSS JOIN dbo.Permisos p
WHERE r.nombre_rol = N'Administrador'
  AND NOT EXISTS (SELECT 1 FROM dbo.Rol_Permisos rp WHERE rp.id_rol = r.id_rol);

INSERT INTO dbo.Rol_Permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM dbo.Roles r
INNER JOIN dbo.Permisos p
    ON p.clave IN ('ventas:catalog', 'ventas:create', 'reportes:ventas', 'reportes:caja')
WHERE r.nombre_rol = N'Cajero'
  AND NOT EXISTS (SELECT 1 FROM dbo.Rol_Permisos rp WHERE rp.id_rol = r.id_rol);

INSERT INTO dbo.Rol_Permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM dbo.Roles r
INNER JOIN dbo.Permisos p
    ON p.clave IN ('compras:read', 'compras:create', 'proveedores:read',
                   'proveedores:create', 'productos:read')
WHERE r.nombre_rol = N'Encargado de compras'
  AND NOT EXISTS (SELECT 1 FROM dbo.Rol_Permisos rp WHERE rp.id_rol = r.id_rol);
GO

IF COL_LENGTH(N'dbo.Compras', N'id_pedido') IS NULL
BEGIN
    ALTER TABLE dbo.Compras ADD id_pedido INT NULL;
END
GO

IF OBJECT_ID(N'dbo.Pedidos_Compra', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Pedidos_Compra (
        id_pedido INT IDENTITY(1,1) PRIMARY KEY,
        id_proveedor INT NOT NULL,
        id_usuario_solicita INT NOT NULL,
        id_usuario_aprueba INT NULL,
        fecha_solicitud DATETIME2 NOT NULL DEFAULT GETDATE(),
        fecha_aprobacion DATETIME2 NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
        CONSTRAINT FK_Pedidos_Proveedor FOREIGN KEY (id_proveedor) REFERENCES dbo.Proveedores(id_proveedor),
        CONSTRAINT FK_Pedidos_Solicita FOREIGN KEY (id_usuario_solicita) REFERENCES dbo.Usuarios(id_usuario),
        CONSTRAINT FK_Pedidos_Aprueba FOREIGN KEY (id_usuario_aprueba) REFERENCES dbo.Usuarios(id_usuario),
        CONSTRAINT CK_Pedidos_Estado CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado', 'Recibido'))
    );
END
GO

IF OBJECT_ID(N'dbo.Detalle_Pedido_Compra', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Detalle_Pedido_Compra (
        id_detalle_pedido INT IDENTITY(1,1) PRIMARY KEY,
        id_pedido INT NOT NULL,
        id_producto INT NOT NULL,
        cantidad INT NOT NULL,
        precio_costo_estimado DECIMAL(12,2) NOT NULL,
        CONSTRAINT FK_DetallePedido_Pedido FOREIGN KEY (id_pedido) REFERENCES dbo.Pedidos_Compra(id_pedido),
        CONSTRAINT FK_DetallePedido_Producto FOREIGN KEY (id_producto) REFERENCES dbo.Productos(id_producto),
        CONSTRAINT CK_DetallePedido_Cantidad CHECK (cantidad > 0),
        CONSTRAINT CK_DetallePedido_Precio CHECK (precio_costo_estimado >= 0)
    );
END
GO

IF OBJECT_ID(N'dbo.Bloqueos_Formulario', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Bloqueos_Formulario (
        client_key VARCHAR(128) NOT NULL PRIMARY KEY,
        bloqueado BIT NOT NULL DEFAULT 1,
        fecha_bloqueo DATETIME2 NOT NULL DEFAULT GETDATE(),
        fecha_desbloqueo DATETIME2 NULL,
        id_usuario_desbloquea INT NULL,
        CONSTRAINT FK_Bloqueos_UsuarioDesbloquea
            FOREIGN KEY (id_usuario_desbloquea) REFERENCES dbo.Usuarios(id_usuario)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Compras_Pedido'
)
BEGIN
    ALTER TABLE dbo.Compras
    ADD CONSTRAINT FK_Compras_Pedido FOREIGN KEY (id_pedido) REFERENCES dbo.Pedidos_Compra(id_pedido);
END
GO

IF OBJECT_ID(N'dbo.TR_Bitacora_Inmutable', N'TR') IS NULL
EXEC(N'
    CREATE TRIGGER dbo.TR_Bitacora_Inmutable
    ON dbo.Bitacora
    AFTER UPDATE, DELETE
    AS
    BEGIN
        SET NOCOUNT ON;
        THROW 51000, ''La bitácora es inmutable; no se permite modificar ni eliminar registros.'', 1;
    END
');
GO
