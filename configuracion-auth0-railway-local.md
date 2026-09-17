# Configuración: Auth0 + Railway + Ambiente Local — TripMind

Resumen de la configuración implementada para el Paso 8 (memoria de usuario),
que requirió login con Google (Auth0) y bases de datos separadas por
ambiente (Railway).

## 1. Auth0

### 1.1 Estructura elegida

Se usó la opción simple: **un solo tenant**, con 2 Applications y 2 APIs
(una por ambiente), en vez de 2 tenants separados.

| Ambiente | Application (SPA) | API (Resource Server) |
|---|---|---|
| Development | `TripMind Dev` | `TripMind API Dev` — Identifier: `myTripMind-api-dev` |
| Production | `TripMind Prod` | `TripMind API Prod` — Identifier: `myTripMind-api-prod` |

- El `AUTH0_DOMAIN` es el mismo para ambos ambientes (mismo tenant).
- El **Client ID** identifica la Application (frontend). 
- El **Identifier de la API** (audience) identifica el backend — son cosas distintas y no hay que confundirlas.

### 1.2 Pasos de configuración

1. Se creó cada Application como tipo **Single Page Application**.
2. Se creó cada API en Applications → APIs → Create API, con su Identifier propio.
3. Se activó el **social connection de Google**:
   - En Google Cloud Console: proyecto nuevo, pantalla de consentimiento OAuth (Authorized domain: `mytripmind-io.web.app` y `auth0.com`), credenciales OAuth 2.0 tipo
     "Web application".
   - En Auth0 Dashboard: Authentication → Social → Google → se pegaron el  Client ID y Secret generados en Google Cloud. En la sección de Google Auth Platform, en Clients se puede el client id genrado para la aplicación creada
4. **Paso que se pasó por alto la primera vez y rompió el login:** cada Application (SPA) tiene que estar **autorizada explícitamente** para pedir tokens de su API correspondiente. Sin esto, el login termina en `error=invalid_request` / *"Client is not authorized to access resource server"*.

   Cómo autorizarla:
   - Applications → APIs → (la API correspondiente) → pestaña
     **Application Access**.
   - Buscar la Application (ej. "MyTripMind dev") en la columna
     **User-delegated Access** (no "Client Access", que es para
     Machine-to-Machine).
   - Click en **Edit** de esa fila y activar el acceso y guardar los cambios.

### 1.3 Frontend (Vite + React)

- Librería: `@auth0/auth0-react`.
- Variables de entorno (`.env` del frontend, prefijo `VITE_`):
  ```
  VITE_AUTH0_DOMAIN=tu-tenant.auth0.com
  VITE_AUTH0_CLIENT_ID=<Client ID de la Application del ambiente>
  VITE_AUTH0_AUDIENCE=<Identifier de la API del ambiente>
  ```
- `main.tsx` envuelve `<App />` con `<Auth0Provider>`, pasando `domain`, `clientId` y `authorizationParams.audience`. **El `audience` es obligatorio** — sin él, Auth0 devuelve un ID Token en vez de un Access Token, y el backend lo rechaza.
- Componente de login separado (`components/AuthButton.tsx`), usando `useAuth0()` (`loginWithRedirect`, `logout`, `isAuthenticated`, `user`). Se usó `connection: 'google-oauth2'` para saltar directo a Google sin mostrar la pantalla de selección de método de login.
- En el hook que llama al backend (`useItineraryStream.ts`), se obtiene el token con `getAccessTokenSilently()` y se manda en el header `Authorization: Bearer <token>`.

### 1.4 Backend (Node + TypeScript + Express)

- Librería: `express-oauth2-jwt-bearer`.
- Middleware (`middleware/auth.ts`):
  ```typescript
  import dotenv from "dotenv";
  dotenv.config(); // clave: cargar el .env ACÁ, no depender del orden de otros archivos

  import { auth } from "express-oauth2-jwt-bearer";

  export const checkJwt = auth({
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
    audience: process.env.AUTH0_AUDIENCE,
  });
  ```
- Variables de entorno del backend (una por ambiente en Railway):
  ```
  AUTH0_DOMAIN=tu-tenant.auth0.com
  AUTH0_AUDIENCE=<Identifier de la API del ambiente>
  ```
- En la route protegida, se usa `checkJwt` como middleware y se extrae el
  `userId` del token: `req.auth?.payload.sub`.

## 2. Railway

### 2.1 Ambientes

Se crearon 2 ambientes dentro del mismo proyecto: **Development** y **Production**. Cada uno con su propia instancia de Postgres, totalmente aislada (datos y volumen separados), aunque el servicio se llame igual en ambos (`tripmind-db`) — el nombre de servicio es global al proyecto, pero los datos son independientes por ambiente.

### 2.2 Variables de entorno por ambiente

- Backend: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `DATABASE_URL`, y las específicas de cada ambiente (Auth0 Dev vs Auth0 Prod).
- Railway inyecta `DATABASE_URL` automáticamente **solo cuando el backend corre deployado dentro de Railway**. Corriendo local, hay que resolverlo aparte (ver sección 3).

## 3. Conectar el backend local a la base de Railway

Se evaluaron 2 métodos, no se pueden mezclar:

| Método | Cómo | Cuándo usarlo |
|---|---|---|
| **A — `railway run`** | `railway run npm run dev` | Solo sirve si el backend corre *dentro* de la red de Railway. Localmente, inyecta el `DATABASE_URL` **interno** (`tripmind-db.railway.internal`), que **no resuelve** desde una máquina fuera de Railway → error `ENOTFOUND`. |
| **B — `.env` local con URL pública** | `npm run dev` normal, con `DATABASE_URL` en el `.env` apuntando a la URL pública de Postgres | El que funcionó. Requiere activar el **Public Networking** (TCP Proxy) en el servicio Postgres de Railway. |

Pasos del método B (el que se usó):
1. En Railway, servicio `tripmind-db` (ambiente Development) → Settings → Networking → activar acceso público (genera host y puerto públicos).
2. Volver a la pestaña Variables del servicio → copiar `DATABASE_PUBLIC_URL`.
3. Pegar ese valor como `DATABASE_URL` en el `.env` local del backend.
4. Correr `npm run dev` (sin `railway run`).

**Nota de seguridad:** esto expone la base de development a internet (con usuario/contraseña como única protección). Válido para desarrollo, pero no se debe hacer lo mismo con la base de producción salvo estricta necesidad.

## 4. Checklist de variables de entorno

**Backend (`.env` local y Railway, por ambiente):**
```
DATABASE_URL=...              # pública en local, interna en Railway deployado
AUTH0_DOMAIN=...
AUTH0_AUDIENCE=...
GEMINI_API_KEY=...
GEMINI_MODEL=...
```

**Frontend (`.env`, por ambiente):**
```
VITE_API_URL=...
VITE_AUTH0_DOMAIN=...
VITE_AUTH0_CLIENT_ID=...
VITE_AUTH0_AUDIENCE=...
```