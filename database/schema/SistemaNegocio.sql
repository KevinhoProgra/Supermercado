CREATE DATABASE SistemaNegocio;
GO

USE SistemaNegocio;
GO

-- =========================================
-- 1. ROLES
-- =========================================
CREATE TABLE Roles (
    id_rol INT IDENTITY(1,1) PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);
GO

-- =========================================
-- 2. USUARIOS
-- =========================================
CREATE TABLE Usuarios (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_rol INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    intentos_fallidos INT NOT NULL DEFAULT 0,

    CONSTRAINT FK_Usuarios_Roles
        FOREIGN KEY (id_rol) REFERENCES Roles(id_rol),

    CONSTRAINT CK_Usuarios_Estado
        CHECK (estado IN ('Activo', 'Inactivo', 'Bloqueado')),

    CONSTRAINT CK_Usuarios_Intentos
        CHECK (intentos_fallidos >= 0)
);
GO

-- =========================================
-- 3. BITACORA
-- =========================================
CREATE TABLE Bitacora (
    id_bitacora INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NULL,
    fecha_hora DATETIME2 NOT NULL DEFAULT GETDATE(),
    accion VARCHAR(100) NOT NULL,
    detalle VARCHAR(500) NULL,

    CONSTRAINT FK_Bitacora_Usuarios
        FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario)
);
GO

-- =========================================
-- 4. CONFIGURACION DEL SISTEMA
-- =========================================
CREATE TABLE Configuracion_Sistema (
    id_config INT IDENTITY(1,1) PRIMARY KEY,
    porcentaje_iva DECIMAL(5,2) NOT NULL,
    tipo_cambio_dolar DECIMAL(12,2) NOT NULL,
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    id_usuario_modifica INT NOT NULL,

    CONSTRAINT FK_Configuracion_Usuario
        FOREIGN KEY (id_usuario_modifica) REFERENCES Usuarios(id_usuario),

    CONSTRAINT CK_Configuracion_IVA
        CHECK (porcentaje_iva >= 0),

    CONSTRAINT CK_Configuracion_TipoCambio
        CHECK (tipo_cambio_dolar > 0)
);
GO

-- =========================================
-- 5. PRODUCTOS
-- =========================================
CREATE TABLE Productos (
    id_producto INT IDENTITY(1,1) PRIMARY KEY,
    codigo_barras VARCHAR(50) NOT NULL UNIQUE,
    nombre_producto VARCHAR(150) NOT NULL,
    precio_costo DECIMAL(12,2) NOT NULL,
    precio_venta DECIMAL(12,2) NOT NULL,
    stock_actual INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 0,
    aplica_iva BIT NOT NULL DEFAULT 1,

    CONSTRAINT CK_Productos_Costo
        CHECK (precio_costo >= 0),

    CONSTRAINT CK_Productos_Venta
        CHECK (precio_venta >= 0),

    CONSTRAINT CK_Productos_Stock
        CHECK (stock_actual >= 0),

    CONSTRAINT CK_Productos_StockMinimo
        CHECK (stock_minimo >= 0)
);
GO

-- =========================================
-- 6. PROVEEDORES
-- =========================================
CREATE TABLE Proveedores (
    id_proveedor INT IDENTITY(1,1) PRIMARY KEY,
    nombre_empresa VARCHAR(150) NOT NULL,
    contacto VARCHAR(100) NULL,
    telefono VARCHAR(30) NULL
);
GO

-- =========================================
-- 7. COMPRAS
-- =========================================
CREATE TABLE Compras (
    id_compra INT IDENTITY(1,1) PRIMARY KEY,
    id_proveedor INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha_compra DATETIME2 NOT NULL DEFAULT GETDATE(),
    total_compra DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT FK_Compras_Proveedores
        FOREIGN KEY (id_proveedor) REFERENCES Proveedores(id_proveedor),

    CONSTRAINT FK_Compras_Usuarios
        FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario),

    CONSTRAINT CK_Compras_Total
        CHECK (total_compra >= 0)
);
GO

-- =========================================
-- 8. DETALLE DE COMPRA
-- =========================================
CREATE TABLE Detalle_Compra (
    id_detalle_compra INT IDENTITY(1,1) PRIMARY KEY,
    id_compra INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_costo_unitario DECIMAL(12,2) NOT NULL,

    CONSTRAINT FK_DetalleCompra_Compra
        FOREIGN KEY (id_compra) REFERENCES Compras(id_compra),

    CONSTRAINT FK_DetalleCompra_Producto
        FOREIGN KEY (id_producto) REFERENCES Productos(id_producto),

    CONSTRAINT CK_DetalleCompra_Cantidad
        CHECK (cantidad > 0),

    CONSTRAINT CK_DetalleCompra_Precio
        CHECK (precio_costo_unitario >= 0)
);
GO

-- =========================================
-- 9. VENTAS
-- =========================================
CREATE TABLE Ventas (
    id_venta INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NOT NULL,
    fecha_venta DATETIME2 NOT NULL DEFAULT GETDATE(),
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    monto_iva DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_venta DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT FK_Ventas_Usuarios
        FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario),

    CONSTRAINT CK_Ventas_Subtotal
        CHECK (subtotal >= 0),

    CONSTRAINT CK_Ventas_IVA
        CHECK (monto_iva >= 0),

    CONSTRAINT CK_Ventas_Total
        CHECK (total_venta >= 0)
);
GO

-- =========================================
-- 10. DETALLE DE VENTA
-- =========================================
CREATE TABLE Detalle_Venta (
    id_detalle_venta INT IDENTITY(1,1) PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal_linea DECIMAL(12,2) NOT NULL,
    iva_linea DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT FK_DetalleVenta_Venta
        FOREIGN KEY (id_venta) REFERENCES Ventas(id_venta),

    CONSTRAINT FK_DetalleVenta_Producto
        FOREIGN KEY (id_producto) REFERENCES Productos(id_producto),

    CONSTRAINT CK_DetalleVenta_Cantidad
        CHECK (cantidad > 0),

    CONSTRAINT CK_DetalleVenta_Precio
        CHECK (precio_unitario >= 0),

    CONSTRAINT CK_DetalleVenta_Subtotal
        CHECK (subtotal_linea >= 0),

    CONSTRAINT CK_DetalleVenta_IVA
        CHECK (iva_linea >= 0)
);
GO

-- =========================================
-- 11. PAGOS DE VENTA
-- =========================================
CREATE TABLE Pagos_Venta (
    id_pago INT IDENTITY(1,1) PRIMARY KEY,
    id_venta INT NOT NULL,
    metodo_pago VARCHAR(30) NOT NULL,
    monto_recibido_moneda_original DECIMAL(12,2) NOT NULL,
    tipo_cambio_aplicado DECIMAL(12,4) NOT NULL,
    monto_equivalente_colones DECIMAL(12,2) NOT NULL,

    CONSTRAINT FK_PagosVenta_Venta
        FOREIGN KEY (id_venta) REFERENCES Ventas(id_venta),

    CONSTRAINT CK_PagosVenta_Metodo
        CHECK (
            metodo_pago IN (
                'Efectivo Colones',
                'Efectivo Dolares',
                'Tarjeta'
            )
        ),

    CONSTRAINT CK_PagosVenta_Monto
        CHECK (monto_recibido_moneda_original > 0),

    CONSTRAINT CK_PagosVenta_TipoCambio
        CHECK (tipo_cambio_aplicado > 0),

    CONSTRAINT CK_PagosVenta_Equivalente
        CHECK (monto_equivalente_colones > 0)
);
GO
