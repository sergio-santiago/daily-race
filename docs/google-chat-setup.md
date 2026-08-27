# Setup · Google Chat App para Daily Race

Esta guia describe paso a paso como dejar lista la integracion con Google Chat (modo Chat App con Service Account + scope `chat.bot`). Es un setup organizativo: requiere el admin de Workspace de Secture en algunos pasos.

> **Por que Chat App y no webhook**: los webhooks simples de Google Chat NO permiten editar mensajes. Daily Race edita el mensaje "live" cada 5s mientras dura la daily, asi que necesita la API completa. La Chat App con Service Account expone `spaces.messages.patch` con `updateMask=cardsV2,text`.

## Resumen del flujo

1. Habilitar Google Chat API en el GCP project existente.
2. Configurar el OAuth consent screen como **Internal** (dominio `secture.com`).
3. Configurar la Chat App en el dashboard de Google Chat API.
4. Pedir al admin de Workspace que autorice el scope `chat.bot` para la SA actual (domain-wide delegation).
5. Crear los spaces de Chat para race-day y championship.
6. Anadir la app como miembro de cada space.
7. Setear las env vars del backend y desplegar.

## 1 · Habilitar Google Chat API

En el GCP project que ya tiene Calendar y Meet APIs habilitadas:

```
GCP Console → APIs & Services → Library → "Google Chat API" → Enable
```

No requiere admin: cualquier owner del proyecto lo puede activar.

## 2 · OAuth consent screen Internal

Si ya esta como Internal por las APIs de Calendar/Meet, no toques nada. Si no:

```
GCP Console → APIs & Services → OAuth consent screen
  → User type: Internal (restringe automaticamente al dominio secture.com)
  → App name: "Daily Race"
  → Support email: el admin
  → Authorized domains: secture.com
```

Anyade el scope `https://www.googleapis.com/auth/chat.bot` a la lista de scopes solicitados.

## 3 · Configurar la Chat App

```
GCP Console → APIs & Services → Google Chat API → Configuration
```

Configuracion minima para Daily Race (solo push, sin slash commands):

| Campo | Valor |
|---|---|
| **App name** | Daily Race |
| **Avatar URL** | URL publica al logo F1 (PNG 256x256, e.g. `https://daily-race.secture.com/logo-256.png`) |
| **Description** | Gamificacion F1 de la daily de Secture |
| **Functionality** | Solo "Receive 1:1 messages": **OFF**. "Join spaces and group conversations": **ON** |
| **Connection settings** | Sin endpoint HTTP / Pub/Sub. La app solo envia mensajes, no recibe interacciones. |
| **Visibility** | Specific people and groups (anadir admins de Workspace y dominio secture.com) |

Guarda. La app queda registrada y aparecera al buscarla en cualquier space @-mencionando `@Daily Race`.

## 4 · Autorizacion del admin (domain-wide delegation)

Si Daily Race ya tiene una Service Account funcionando para Calendar/Meet, hay que **anyadir el scope nuevo** a su lista autorizada. Si no, crear una SA nueva.

### 4a · Crear SA (saltar si ya existe)

```
GCP Console → IAM & Admin → Service Accounts → Create
  → Name: "daily-race-bot"
  → Role: ninguno
  → Generate JSON key
```

Guardar el `client_email` y el `private_key` (PEM); van a las env vars `GOOGLE_CLIENT_EMAIL` y `GOOGLE_PRIVATE_KEY`.

### 4b · Pedir al admin que autorice el scope

Asunto del ticket o solicitud al admin:

> Necesito autorizar el scope `https://www.googleapis.com/auth/chat.bot` para la Service Account `<client_email>` en el dominio `secture.com`.
>
> Pasos en el Admin Console:
> 1. Security → Access and data control → API controls → Manage Domain Wide Delegation
> 2. Add new (o editar la entrada existente de esta SA)
> 3. Client ID: `<unique_id de la SA>`
> 4. OAuth scopes: anyadir `https://www.googleapis.com/auth/chat.bot` (manteniendo los anteriores)
> 5. Authorize

Tras la autorizacion, la SA puede llamar a la Chat API en nombre del bot.

## 5 · Crear los spaces

Crea dos spaces en Google Chat (cualquier usuario `@secture.com` puede hacerlo):

- **Daily Race · Race Day** (para resultados de cada carrera)
- **Daily Race · Championship** (para clasificacion general)

Para obtener el `name` de cada space (formato `spaces/AAAAAAAAA`):

1. Abre el space en la app web de Google Chat.
2. Mira la URL: `https://mail.google.com/chat/u/0/#chat/space/AAAAAAAAA`. La parte despues de `/space/` es el ID corto.
3. El `name` completo es `spaces/AAAAAAAAA`.

Alternativa con `gcloud` o `curl`:

```bash
# Lista los spaces visibles para la SA tras anadir la app a ellos.
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://chat.googleapis.com/v1/spaces"
```

## 6 · Anadir la app como miembro de cada space

En cada space, escribe `@Daily Race` en un mensaje y selecciona la app del autocompletado. Esto la anade como miembro y le da permiso para postear y editar mensajes en ese space.

## 7 · Env vars del backend

```bash
# .env (o GitHub Secrets en produccion)
NOTIFICATION_PROVIDER=google-chat            # o 'dual' durante la transicion

GOOGLE_CHAT_SPACE_RACE_DAY=spaces/AAAAAAAAA
GOOGLE_CHAT_SPACE_CHAMPIONSHIP=spaces/BBBBBBBBB

# Si no estaban ya configuradas:
GOOGLE_CLIENT_EMAIL=daily-race-bot@<project>.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 8 · Validar localmente

```bash
make dev
# Esperar a que arranque el backend
make shell
# Dentro del contenedor:
node -e "
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\\\n/g, '\\n'),
  },
  scopes: ['https://www.googleapis.com/auth/chat.bot'],
});
google.chat({version: 'v1', auth}).spaces.messages.create({
  parent: process.env.GOOGLE_CHAT_SPACE_RACE_DAY,
  requestBody: { text: 'Hola desde la SA de Daily Race' }
}).then(r => console.log('OK', r.data.name)).catch(e => console.error(e.message));
"
```

Si responde `OK spaces/AAA/messages/BBB.BBB`, todo esta correcto. Si error 403 / PERMISSION_DENIED, falta el paso 6 (anadir la app al space) o el paso 4b (scope no autorizado).

## 9 · Activar en produccion

Edita `/srv/www/daily-race/.env` en el servidor:

```
NOTIFICATION_PROVIDER=dual    # primero dual durante 1-2 semanas
GOOGLE_CHAT_SPACE_RACE_DAY=spaces/...
GOOGLE_CHAT_SPACE_CHAMPIONSHIP=spaces/...
```

```
make restart
```

Sin redeploy. El servicio arranca con el nuevo provider activado.

## Troubleshooting

| Sintoma | Causa probable | Solucion |
|---|---|---|
| `403 The caller does not have permission` | La app no esta en el space | Anadir `@Daily Race` al space |
| `403 Request had insufficient authentication scopes` | El admin no autorizo el scope `chat.bot` | Volver al paso 4b |
| `400 Invalid argument: Card ...` | JSON de cards mal formado | Validar contra `https://addons.gsuite.google.com/uikit/builder` |
| `429 Quota exceeded` | >1 req/seg al mismo space | Espaciar mensajes (el adapter ya lo hace en championships con delay 1.1s) |
| El bot postea pero no edita | El admin autorizo solo `chat.messages` (user scope), no `chat.bot` (app scope) | Pedir scope `chat.bot` explicitamente |

## Limites a conocer

- **32 KB** por mensaje completo (incluye text + cardsV2). El formatter mantiene < 25 KB de margen.
- **100 widgets** por card. El formatter usa `collapsible` en parrillas grandes.
- **1 mensaje/seg** por space. El formatter espacia mensajes consecutivos.
- **Custom emojis NO funcionan en cards** — solo Unicode + Material Icons.
- **Render mobile**: NO usar tablas alineadas con espacios en bloques monospace, rompe en Android. Usar `decoratedText` por fila (es lo que hacemos).

## Referencias

- [Google Chat API reference](https://developers.google.com/workspace/chat/api/reference)
- [Cards V2 reference](https://developers.google.com/workspace/chat/api/reference/rest/v1/cards)
- [Format messages (HTML)](https://developers.google.com/workspace/chat/format-messages)
- [Card Builder oficial](https://addons.gsuite.google.com/uikit/builder)
- `docs/ux-design-google.md` · sistema de diseno aplicado a las cards.
