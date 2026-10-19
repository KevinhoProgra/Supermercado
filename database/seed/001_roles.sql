USE SistemaNegocio;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre_rol = N'Administrador')
    INSERT INTO dbo.Roles (nombre_rol) VALUES (N'Administrador');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre_rol = N'Cajero')
    INSERT INTO dbo.Roles (nombre_rol) VALUES (N'Cajero');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre_rol = N'Encargado de compras')
    INSERT INTO dbo.Roles (nombre_rol) VALUES (N'Encargado de compras');
GO
