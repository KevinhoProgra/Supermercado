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
