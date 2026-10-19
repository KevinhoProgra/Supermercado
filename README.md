# ERP Supermercado — SistemaNegocio

Sistema administrativo integrado (académico) con **React**, **Node.js/Express** y **Microsoft SQL Server** (`SistemaNegocio`).

## Estado del repositorio

| Área | Estado |
|------|--------|
| Backend API (Express) | Inicial — salud y conexión SQL |
| Frontend (React/Vite) | Pendiente |
| Autenticación / roles | Pendiente |
| Módulos de negocio | Pendiente |

## Arquitectura (objetivo)

```
Supermercado/
├── backend/          # API REST (Express, mssql)
│   ├── src/
│   │   ├── config/       # variables de entorno
│   │   ├── database/     # pool SQL Server
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/     # (próximo) lógica de negocio
│   │   ├── middleware/   # auth, errores
│   │   └── validators/
│   └── test/
├── frontend/         # (próximo) React + Vite
└── database/         # (próximo) scripts SQL / migraciones
```

**Flujo:** React → Axios → API REST → servicios → consultas parametrizadas → `SistemaNegocio`.

## Plan de implementación (prioridad)

1. **Conexión SQL y salud** — pool `mssql`, `GET /api/health/db` ✅
2. **Autenticación, sesiones/JWT, bitácora de login, bloqueos**
3. **Usuarios, roles y permisos (backend + rutas protegidas)**
4. **Productos e inventario (+ migración movimientos si falta)**
5. **Compras, proveedores, recepción**
6. **Facturación POS, pagos mixtos, transacciones**
7. **Configuración IVA/tipo de cambio**
8. **Bitácora (solo lectura), informes, pruebas integrales**
9. **Frontend por módulos alineado con la API**

## Requisitos

- **Node.js 20 o 22 LTS** recomendado (Windows Authentication con `msnodesqlv8` suele fallar en Node 23+ por falta de binarios nativos).
- SQL Server Express con base de datos `SistemaNegocio`

## Backend — instalación

```bash
cd backend
npm install
```

### Autenticación en SQL Server

**Windows (como en SSMS con DESKTOP-T1FGP81\\Kevinho):**

1. Copie `.env.example` a `.env` y deje `DB_AUTH_MODE=windows`.
2. Instale el driver nativo (necesario para Integrated Security desde Node):

   ```bash
   npm install msnodesqlv8
   ```

   Si falla la compilación, instale [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con “Desktop development with C++”, o use autenticación SQL (abajo).

**Autenticación SQL (alternativa):**

1. En SSMS: servidor → Propiedades → Seguridad → “SQL Server and Windows Authentication mode”.
2. Cree un login SQL con acceso a `SistemaNegocio` (permisos mínimos necesarios).
3. En `.env`: `DB_AUTH_MODE=sql`, `DB_USER=...`, `DB_PASSWORD=...`.

### Variables de entorno

Ver `backend/.env.example`. No suba `.env` al repositorio.

| Variable | Descripción |
|----------|-------------|
| `DB_SERVER` | Instancia, p. ej. `DESKTOP-T1FGP81\\SQLEXPRESS` |
| `DB_NAME` | `SistemaNegocio` |
| `DB_AUTH_MODE` | `windows` o `sql` |

### Ejecutar API

```bash
cd backend
npm run dev
```

### Probar conexión

Con la API en ejecución:

```bash
curl http://localhost:3001/api/health/db
```

Sin levantar el servidor:

```bash
cd backend
npm run db:check
```

**Prueba realizada en este entorno (2026-10-19):**

- `sqlcmd` con Windows Authentication → **OK**, base de datos `SistemaNegocio`.
- Backend Node **v26.1.0** + `msnodesqlv8` → **falló** (sin prebuild para Node 26; compilación nativa falló). Solución: usar Node 20/22 LTS o autenticación SQL.

Respuesta esperada si todo está bien:

```json
{
  "success": true,
  "data": {
    "databaseName": "SistemaNegocio",
    "expectedDatabase": "SistemaNegocio",
    "matchesExpected": true,
    "server": "DESKTOP-T1FGP81\\SQLEXPRESS",
    "authMode": "windows"
  }
}
```

## Endpoints actuales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servicio API |
| GET | `/api/health/db` | `SELECT DB_NAME()` — diagnóstico de BD |
