USE SistemaNegocio;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Bitacora') AND name = N'resultado'
)
BEGIN
    ALTER TABLE dbo.Bitacora
    ADD resultado VARCHAR(20) NULL;

    ALTER TABLE dbo.Bitacora
    ADD CONSTRAINT CK_Bitacora_Resultado
        CHECK (resultado IS NULL OR resultado IN ('Exito', 'Fallo', 'Advertencia'));
END
GO
