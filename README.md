# ERP Supermercado — SistemaNegocio

Sistema administrativo integrado (académico) con **React**, **Node.js/Express** y **Microsoft SQL Server** (`SistemaNegocio`).

## Estado del repositorio

| Área | Estado |
|------|--------|
| Backend API (Express) | Salud, conexión SQL y autenticación |
| Frontend (React/Vite) | Login y dashboard |
| Autenticación / roles | JWT, bitácora de acceso y bloqueo tras dos fallos |
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
│   │   ├── services/     # servicios de usuarios, autenticación y bitácora
│   │   ├── middleware/   # auth, errores
│   │   └── validators/
│   └── test/
├── frontend/         # React + Vite
└── database/         # esquema SQL / migraciones
```

**Flujo:** React → Fetch API → Express → servicios → consultas parametrizadas → `SistemaNegocio`.

## Plan de implementación (prioridad)

1. **Conexión SQL y salud** — pool `mssql`, `GET /api/health/db` ✅
2. **Autenticación, sesiones/JWT, bitácora de login, bloqueos** ✅
3. **Usuarios, roles y permisos (backend + rutas protegidas)**
4. **Productos e inventario (+ migración movimientos si falta)**
5. **Compras, proveedores, recepción**
6. **Facturación POS, pagos mixtos, transacciones**
7. **Configuración IVA/tipo de cambio**
8. **Bitácora (solo lectura), informes, pruebas integrales**
9. **Frontend por módulos alineado con la API**

## Requisitos

- **Node.js y npm** (los comandos del backend ejecutan Node 22 LTS para compatibilidad con `msnodesqlv8`).
- SQL Server Express con base de datos `SistemaNegocio`
- ODBC Driver 17 for SQL Server

## Backend — instalación

```bash
cd backend
npx --yes --package=node@22 --call "npm install"
```

### Autenticación en SQL Server

**Autenticación de Windows (recomendada para desarrollo local):**

1. Copie `.env.example` a `.env` y deje `DB_AUTH_MODE=windows`.
2. Ejecute el backend con una cuenta de Windows que tenga acceso a `SistemaNegocio`.
3. La instalación del backend incluye `msnodesqlv8`; la conexión usa el ODBC
   Driver 17 y la cuenta de Windows que ejecuta Node. Los comandos `npm run`
   del backend usan Node 22 automáticamente.

**Autenticación SQL (alternativa):**

En SSMS, habilite el modo “SQL Server and Windows Authentication mode” y cree
un login SQL con acceso a `SistemaNegocio`. Después configure
`DB_AUTH_MODE=sql`, `DB_USER` y `DB_PASSWORD` en `.env`.

### Variables de entorno

Ver `backend/.env.example`. No suba `.env` al repositorio.
Configure `JWT_SECRET` con un valor aleatorio de al menos 32 caracteres antes
de iniciar la API. Genere uno con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Descripción |
|----------|-------------|
| `DB_SERVER` | Instancia, p. ej. `DESKTOP-T1FGP81\\SQLEXPRESS` |
| `DB_NAME` | `SistemaNegocio` |
| `DB_AUTH_MODE` | `windows` o `sql` |
| `JWT_SECRET` | Secreto aleatorio (mínimo 32 caracteres recomendado) |

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

**Verificado en desarrollo local (2026-10-19):**

- La cuenta de Windows actual conecta a `SistemaNegocio` mediante ODBC Driver 17.
- `npm run db:check` → **OK**, `databaseName: SistemaNegocio`.
- El login de `admin1` y la validación de sesión (`/api/auth/me`) → **OK**.

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
| POST | `/api/auth/login` | Valida credenciales, registra la bitácora y devuelve un JWT |
| GET | `/api/auth/me` | Devuelve la identidad del JWT (requiere `Authorization: Bearer <token>`) |

Login acepta `{ "username": "...", "password": "..." }`. Las credenciales
incorrectas responden `401`; al segundo fallo la API bloquea la cuenta, registra
ambos eventos en `Bitacora` y responde `423` (`ACCOUNT_BLOCKED`).

## Frontend — ejecutar

```bash
cd frontend
npm install
npm run dev
```

Copie `frontend/.env.example` a `frontend/.env` para cambiar `VITE_API_URL` si la
API no está en `http://localhost:3001`. El login persiste el token y la identidad
en `localStorage`; el dashboard verifica la sesión con `/api/auth/me`. La cuenta
se bloquea al segundo intento de contraseña incorrecta y debe desbloquearla un
administrador.
