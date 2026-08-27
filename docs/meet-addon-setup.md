# Setup · Google Meet Add-on para Daily Race

Esta guia cubre todo el proceso de poner el Meet Add-on en produccion: GCP, Marketplace SDK privado, hosting del frontend, y deployment final al dominio `secture.com`.

> Este track es paralelo al de Google Chat. NO bloquea la migracion Discord -> Chat. Empezar el spike en cuanto el dominio este verificado.

## Resumen del flujo

1. Verificar el dominio `secture.com` en Google Search Console (si no lo esta).
2. Crear o reusar un GCP project.
3. Habilitar Marketplace SDK + Workspace Add-ons API.
4. Configurar OAuth consent screen como Internal.
5. Crear el HTTP deployment con el manifest del add-on.
6. Hospedar el frontend (`packages/meet-addon`) en un origen HTTPS publico.
7. Publicar privadamente al dominio.
8. Validar dentro de Meet.

## Arquitectura

```
┌────────────────────────┐
│  Meet desktop (browser)│
│  ┌──────────────────┐  │
│  │  Side Panel      │──┼──> https://daily-race.secture.com/sidepanel/
│  └──────────────────┘  │       │
│  ┌──────────────────┐  │       │ polling 2.5s
│  │  Main Stage      │──┼──> .../mainstage/
│  └──────────────────┘  │       │
└────────────────────────┘       │
                                 ▼
                ┌─────────────────────────────────────┐
                │  Backend Daily Race                  │
                │  GET /api/live-race/current          │
                └─────────────────────────────────────┘
```

El add-on es **frontend puro**. No tiene auth propio en V1 — los datos del live race son publicos a cualquier `@secture.com` con el add-on instalado. En V2 se anyadira Google Identity Services (One Tap) para personalizar el side panel con la posicion del usuario actual.

## 1 · Verificacion de dominio

```
Google Search Console → Add property → secture.com
  → Verificar via DNS TXT record o meta tag
```

Si Workspace ya esta en `secture.com`, suele estar verificado.

## 2 · GCP project

Reutilizar el proyecto existente de Daily Race (mismo donde viven Calendar/Meet/Chat APIs) o crear uno separado para staging/prod del add-on. Las **best practices** oficiales recomiendan separar staging/prod, pero V1 puede ir todo en un proyecto.

## 3 · Habilitar APIs

```
GCP Console → APIs & Services → Library
  → "Google Workspace Marketplace SDK" → Enable
  → "Google Workspace Add-ons API" → Enable
```

## 4 · OAuth consent screen Internal

Si esta como Internal por la integracion con Chat, no toques nada. Si no, mismo procedimiento que `docs/google-chat-setup.md` paso 2.

## 5 · HTTP deployment

```
GCP Console → APIs & Services → Google Workspace Marketplace SDK
  → Tab "HTTP deployments" → Create new deployment
  → Deployment ID: "daily-race-meet" (max 100 chars)
  → JSON manifest: pegar el contenido de packages/meet-addon/manifest.json
```

El manifest declara:
- `addOnOrigins`: orígenes válidos donde se hospeda el frontend.
- `sidePanelUrl`: ruta `/sidepanel/` del frontend.
- `mainStageUrl`: ruta `/mainstage/` del frontend.
- `logoUrl` / `darkModeLogoUrl`: PNG 256x256 sin padding, transparente.

> **IMPORTANTE**: la URL en `sidePanelUrl` debe pertenecer a uno de los `addOnOrigins`. Cualquier mismatch -> el iframe no carga (error `InvalidActivityStartingState`).

## 6 · Hospedar el frontend

El paquete `packages/meet-addon` produce un export estatico (`output: 'export'`). Dos opciones:

### 6a · Vercel (recomendado para velocidad)

```bash
cd packages/meet-addon
vercel --prod
```

Configurar dominio personalizado `daily-race.secture.com`. Vercel emite cert HTTPS automaticamente.

### 6b · Servir junto al backend

Anadir un volumen al docker-compose.production.yml que sirva los archivos estaticos generados. Reverse-proxy via nginx o Caddy.

```nginx
location /meet/ {
    alias /srv/www/daily-race/meet-addon/out/;
    try_files $uri $uri/index.html =404;
}
```

Y ajustar `manifest.json` con `https://daily-race.secture.com/meet/sidepanel/`.

### Variables del frontend en build time

```bash
NEXT_PUBLIC_BACKEND_URL=https://api.daily-race.secture.com
NEXT_PUBLIC_MEET_CLOUD_PROJECT_NUMBER=<project_number>
```

El project number se ve en la home de GCP Console (no es el project ID, es un numero entero).

## 7 · Publicar privadamente al dominio

```
GCP Console → APIs & Services → Google Workspace Marketplace SDK
  → Tab "App configuration"
  → Visibility: Private (irrevocable)
  → Installation: Admin Install (o Individual + Admin Install)
  → App integration: marca "Meet add-on" y selecciona el deployment ID "daily-race-meet"
  → Publish
```

> **IMPORTANTE**: la visibilidad **Private** es irrevocable. Para cambiarla habria que crear un nuevo deployment / app config.

Las publicaciones privadas **NO requieren review de Google**. Disponibles inmediatamente.

## 8 · Instalacion para usuarios

Tres opciones:

1. **Admin install** (recomendado para todo el dominio):
   - Admin Console → Apps → Google Workspace Marketplace apps → Add app
   - Buscar "Daily Race" en internal apps
   - Install for everyone in the domain

2. **Individual install**:
   - Cualquier usuario `@secture.com` va a `https://workspace.google.com/marketplace` → Internal apps
   - Click en Daily Race → Install

3. **Desde Meet directamente**:
   - En una llamada de Meet, click en "Activities" -> "Add-ons" -> Daily Race -> Install (si esta como Internal install)

## 9 · Validar dentro de Meet

1. Crea una llamada de Meet de prueba.
2. Click en el icono de Activities (parte inferior derecha).
3. Selecciona "Daily Race" del listado.
4. Se abre el side panel a la derecha. Debe mostrar:
   - Estado **IDLE** si no hay daily activa: "La parrilla esta en boxes".
   - Estado **LIVE** si la daily esta corriendo: parrilla con pilotos, podio, stats.
5. Para probar el main stage, lanza la actividad (boton dentro del side panel — NO disponible en V1, anyadirlo en V2 con startActivity).

## 10 · Dev local

Permite el origen `https://localhost:3002` en el manifest (`addOnOrigins`). Acepta el certificado autofirmado en el browser.

```bash
cd packages/meet-addon
cp .env.example .env.local
# Editar NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
npm run dev
```

Para que Meet cargue tu localhost:
- Crea un deployment de **staging** separado en GCP (deployment ID `daily-race-meet-dev`) con el manifest apuntando a `https://localhost:3002`.
- Instalalo en tu cuenta `@secture.com`.
- Acepta el cert autofirmado en `https://localhost:3002` antes de abrir Meet.

## Troubleshooting

| Sintoma | Causa | Solucion |
|---|---|---|
| El add-on no aparece en Activities | No instalado en tu cuenta o admin no aprobo el push | Marketplace -> internal apps -> Install |
| `InvalidActivityStartingState` | URL fuera de `addOnOrigins` | Anyadir el origin al manifest y volver a deploy |
| Pantalla en blanco en el iframe | CORS o CSP del frontend bloqueando | Quitar `frame-ancestors` o permitir `https://meet.google.com` |
| `AddonSessionAlreadyCreated` | StrictMode de React inicializando dos veces | Ya gestionado en `useAddonSession` con `useRef` guard |
| El polling falla con CORS | `LIVE_RACE_API_ALLOWED_ORIGINS` del backend no incluye el dominio del add-on | Anadir `https://daily-race.secture.com` y reiniciar |
| El bundle no carga `@googleworkspace/meet-addons` | Paquete no instalado o version incompatible | `npm install` en `packages/meet-addon` |

## Limitaciones a conocer

- **Solo desktop web** en V1. Mobile (Android/iOS) tiene SDK separado y mas limitado; el add-on aparece grayed-out en mobile.
- **No identidad del usuario** desde el SDK. Para personalizar (ej. resaltar tu fila en el side panel) necesitamos Google Identity Services (V2).
- **Frame-to-frame messaging** es intra-participante (entre tu side panel y tu main stage), NO sirve para sync entre usuarios.
- **Co-Doing API** (la unica via "no-backend" para shared state entre participantes) esta cerrada a nuevos signups desde sept 2024. Polling al backend es la solucion oficial.
- **Cache HTTP** maximo 24h (best practice). El endpoint del live state usa `Cache-Control: no-store`.

## Referencias

- [Meet Add-ons SDK overview](https://developers.google.com/workspace/meet/add-ons/guides/overview)
- [Best practices](https://developers.google.com/workspace/meet/add-ons/guides/best-practices)
- [Sample oficial Next.js](https://github.com/googleworkspace/meet/tree/main/addons-web-sdk/samples/animation-next-js)
- [Marketplace SDK](https://developers.google.com/workspace/marketplace/enable-configure-sdk)
- `docs/ux-design-google.md` · diseno UX del side panel y main stage.
