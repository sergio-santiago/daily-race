# Daily Race

Sistema de gamificacion de la daily standup de Secture con tematica de carreras de Formula 1.

Cada dia laborable, el sistema monitoriza en tiempo real la reunion de Google Meet de la daily. Cuando detecta que la reunion esta activa, publica un grid en directo en Discord que se actualiza conforme van entrando los participantes. Al terminar la reunion, persiste los resultados, calcula puntos con el sistema de puntuacion F1 y publica la clasificacion general del campeonato.

Todo es automatico — no hay que hacer nada manualmente.

## Como funciona el juego

### La carrera diaria

La daily de Secture esta programada de lunes a viernes. El sistema usa la hora del evento de Google Calendar como **green light** (luz verde). Cada participante que entra a la reunion de Google Meet se convierte en un **driver** (piloto), y su posicion en la **starting grid** (parrilla de salida) se determina por el orden de entrada.

- El primero en entrar (despues del green light) es **P1** y obtiene 25 puntos
- El segundo es **P2** con 18 puntos, y asi sucesivamente siguiendo la tabla F1
- Si entras antes de la hora programada, cuentas como **salida en falso** y recibes una penalizacion

### Sistema de puntuacion F1

| Posicion | Puntos |
|----------|--------|
| P1       | 25     |
| P2       | 18     |
| P3       | 15     |
| P4       | 12     |
| P5       | 10     |
| P6       | 8      |
| P7       | 6      |
| P8       | 4      |
| P9       | 2      |
| P10+     | 1 (asistencia) |
| Salida en falso | -5 (penalizacion) |

### Salidas en falso

Si entras a la reunion **antes de la hora programada** (green light), el sistema lo detecta como salida en falso:

- Recibes **-5 puntos** de penalizacion
- Tu posicion se mueve al **final del grid** — cuanto mas pronto entres, peor posicion
- Ejemplo: si hay 18 participantes y 3 entran antes de hora, estos ocuparan las posiciones 18, 17 y 16 (el mas madrugador en P18)
- Las salidas en falso NO cuentan para victorias ni podios en el championship

### Rey de la Ruina

Cada carrera tiene un **Rey de la Ruina** (marcado con corona en Discord):

- **Si hay salidas en falso**: el que entro mas temprano (el mas alejado del green light) se lleva la corona
- **Si NO hay salidas en falso**: el ultimo en entrar se lleva la corona

### Championship (clasificacion general)

Los puntos se acumulan carrera a carrera en una clasificacion general:

| Columna | Significado |
|---------|-------------|
| **Pos** | Posicion en la clasificacion |
| **Piloto** | Nombre del driver |
| **Pts** | Puntos totales acumulados |
| **GP** | Grandes Premios (carreras disputadas) |
| **W** | Victorias (veces en P1 sin salida en falso) |
| **PD** | Podios (veces en P1-P3 sin salida en falso) |

La clasificacion se ordena por puntos totales de mayor a menor.

### Horario del monitor

El sistema monitoriza la reunion de Google Meet:

- **Cada 5 segundos**
- **De lunes a viernes**
- **De 9:00 a 12:00** (Europe/Madrid)

Solo detecta reuniones que empezaron dentro de **±30 minutos** de la hora programada del evento.

### Canales de Discord

Dos canales con webhooks independientes:

- **#race-day**: grid de cada carrera con posiciones, puntos, tiempos y Rey de la Ruina
- **#championship**: clasificacion general acumulada

Todo se publica automaticamente al finalizar cada carrera.

## Terminologia

El codigo usa terminologia de carreras/F1:

| Concepto             | Termino en codigo | Descripcion                     |
|----------------------|-------------------|---------------------------------|
| Daily                | Race              | Cada daily es una carrera       |
| Participante         | Driver            | Cada persona es un piloto       |
| Hora programada      | GreenLight        | La luz verde / segundo 0        |
| Ranking de entrada   | StartingGrid      | Parrilla de salida              |
| Entrar antes de hora | FalseStart        | Salida en falso                 |
| Ganador (P1)         | PolePosition      | Primera posicion en la parrilla |
| Ultimo en entrar     | LastOnGrid        | Rey/Reina de la ruina           |
| Ranking acumulado    | Championship      | Clasificacion general           |

## Prerrequisitos

- [Docker](https://docs.docker.com/get-docker/) y Docker Compose
- [Make](https://www.gnu.org/software/make/)
- Credenciales de Google Cloud (OAuth o Service Account)
- Webhooks de Discord (canales #race-day y #championship)

## Quick start

```bash
cp .env.example .env
# Editar .env con las credenciales reales

make install
make dev

# Autenticarse con Google (solo modo OAuth, solo en desarrollo)
# Abrir en navegador: http://localhost:3001/auth/google
```

## Comandos

| Comando                             | Descripcion                                            |
|-------------------------------------|--------------------------------------------------------|
| `make install`                      | Construye imagenes e instala dependencias              |
| `make dev`                          | Levanta todos los servicios                            |
| `make stop`                         | Para todos los servicios                               |
| `make restart`                      | Reinicia todos los servicios                           |
| `make logs`                         | Muestra logs de todos los servicios                    |
| `make test`                         | Ejecuta tests                                          |
| `make test-watch`                   | Ejecuta tests en modo watch                            |
| `make test-cov`                     | Ejecuta tests con cobertura                            |
| `make lint`                         | Ejecuta linter                                         |
| `make build`                        | Compila el proyecto                                    |
| `make shell`                        | Abre shell en el contenedor                            |
| `make db-migrate`                   | Ejecuta migraciones pendientes                         |
| `make db-migrate-generate NAME=xxx` | Genera una nueva migracion                             |
| `make db-migrate-revert`            | Revierte ultima migracion                              |
| `make db-shell`                     | Abre consola psql                                      |
| `make dev-preview-race RACE_ID=xxx` | Publica race de prueba a Discord (solo dev)            |
| `make dev-preview-championship`     | Publica championship de prueba a Discord (solo dev)    |
| `make clean`                        | Elimina contenedores, volumenes e imagenes             |

Los comandos `dev-preview-*` estan bloqueados en produccion (`NODE_ENV=production`).

## Funcionamiento automatico

El backend incluye un **scheduler (cron)** que monitoriza la daily **en tiempo real**:

- Se ejecuta **cada 5 segundos, de lunes a viernes, de 9:00 a 12:00** (Europe/Madrid)
- **Durante la reunion** (meeting activo en Google Meet):
  1. Detecta el meeting activo y crea un mensaje **en directo** en **#race-day** (Discord)
  2. Cada 5 segundos comprueba si hay nuevos participantes
  3. Si alguien nuevo entra, recalcula la parrilla y **edita el mismo mensaje** con el grid actualizado
  4. El mensaje muestra posiciones, puntos y el Rey de la Ruina en tiempo real
- **Al terminar la reunion** (la sala se vacia):
  1. Persiste los datos en PostgreSQL (drivers, race, starting grid)
  2. Edita el mensaje live al **formato final** (de "EN DIRECTO" a resultado definitivo)
  3. Publica la clasificacion general actualizada en **#championship** (Discord)
- Solo monitoriza reuniones que empezaron cerca de la hora programada del evento (±30 minutos)
- Si la daily ya fue procesada, no la reprocesa (idempotente)

**Para que funcione en automatico, el backend debe estar corriendo continuamente** (en un servidor, VPS, o similar). En desarrollo local con `make dev`, el scheduler tambien esta activo.

## API

No hay endpoints de races expuestos. Todo el procesamiento es automatico via el scheduler.

| Endpoint                | Metodo | Descripcion                                                    |
|-------------------------|--------|----------------------------------------------------------------|
| `/health`               | GET    | Health check del sistema (estado de DB y autenticacion Google) |
| `/auth/google`          | GET    | Redirige a Google para iniciar OAuth (solo desarrollo)         |
| `/auth/google/callback` | GET    | Callback donde Google devuelve el token (solo desarrollo)      |
| `/auth/google/status`   | GET    | Comprueba si hay tokens validos guardados                      |

Los endpoints `/auth/google` y `/auth/google/callback` estan **protegidos en produccion** — devuelven `403 Forbidden` si `NODE_ENV=production`.

## Arquitectura

```
packages/
  backend/     NestJS + TypeScript (arquitectura hexagonal)
```

### Backend (hexagonal)

```
src/
  core/           Dominio: entidades puras, constantes y puertos (interfaces)
  application/    Casos de uso (scoring, grid, monitor live race, championship)
  infrastructure/ Adaptadores: Google Meet/Calendar, Discord, PostgreSQL, scheduler
  api/            Controllers REST
  cli/            CLIs de desarrollo (preview race/championship)
```

- **Core**: entidades inmutables sin dependencias de framework. Puertos definidos como interfaces con Symbol tokens para inyeccion de dependencias. Constantes de negocio (tabla F1, penalizaciones).
- **Application**: casos de uso que orquestan la logica de negocio. Sin dependencias de infraestructura.
- **Infrastructure**: adaptadores que implementan los puertos. Google Meet/Calendar (OAuth + Service Account), Discord webhook, TypeORM/PostgreSQL, scheduler cron.
- **API**: controllers REST delgados que delegan a los casos de uso.

### Autenticacion con Google

Dos modos configurables via `GOOGLE_AUTH_MODE`:

- **`oauth`** (desarrollo): OAuth 2.0 con cuenta personal. Requiere login manual via `/auth/google`. Solo ve reuniones del usuario autenticado.
- **`service-account`** (produccion): Service account con domain-wide delegation. Ve todas las reuniones de la organizacion via impersonacion de usuarios. Requiere que un admin de Google Workspace autorice la delegacion.

El cambio entre modos es transparente — el `GoogleModule` inyecta el adaptador correspondiente segun la variable de entorno.

### Base de datos

PostgreSQL con 4 tablas:

- **drivers**: id, google_id, display_name, email, created_at, updated_at
- **races**: id, conference_record_name, meeting_code, green_light, end_time, status, processed_at, created_at
- **starting_grid_entries**: id, race_id, driver_id, position, start_time, green_light, points, is_false_start, is_last_on_grid
- **transcript_entries**: id, race_id, speaker_name, text, start_time, end_time, created_at

Las migraciones se ejecutan automaticamente al arrancar la aplicacion (`migrationsRun: true`).

### Discord

Los mensajes se formatean como tablas monospace dentro de embeds de Discord:

- **Race**: columnas Pos, Piloto, Pts, Tiempo. Emojis para podio, salidas en falso y Rey de la Ruina
- **Championship**: columnas Pos, Piloto, Pts, GP, W, PD. Leyenda al pie
- **Live**: mismo formato que race pero con color rojo y footer "EN DIRECTO"

### Docker

El Dockerfile usa **multi-stage build**:

- **build**: instala dependencias y compila TypeScript
- **production**: imagen final solo con dependencias de produccion y el JS compilado

En desarrollo, `docker-compose.yml` usa el stage `build` con hot reload via volume mount y `nest start --watch`.

## Variables de entorno

```bash
# ── PostgreSQL ────────────────────────────────────────────────
POSTGRES_HOST=db                    # Host de la DB (default: db)
POSTGRES_PORT=5432                  # Puerto interno de la DB
POSTGRES_USER=dailyrace             # Usuario de la DB
POSTGRES_PASSWORD=dailyrace_dev     # Password de la DB
POSTGRES_DB=dailyrace               # Nombre de la DB
POSTGRES_EXTERNAL_PORT=5433         # Puerto expuesto al host (solo dev)

# ── Backend ──────────────────────────────────────────────────
NODE_ENV=development                # development | production
BACKEND_PORT=3001                   # Puerto del backend

# ── Google Auth ──────────────────────────────────────────────
GOOGLE_AUTH_MODE=oauth              # oauth (dev) | service-account (prod)

# OAuth (solo si GOOGLE_AUTH_MODE=oauth)
GOOGLE_CLIENT_ID=                   # Client ID de Google Cloud Console
GOOGLE_CLIENT_SECRET=               # Client Secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Service Account (solo si GOOGLE_AUTH_MODE=service-account)
GOOGLE_CLIENT_EMAIL=                # Email de la service account
GOOGLE_PRIVATE_KEY=                 # Private key (PEM)
GOOGLE_IMPERSONATE_EMAILS=          # Emails a impersonar (comma-separated)

# ── Google Calendar / Meet ───────────────────────────────────
GOOGLE_CALENDAR_ID=primary          # ID del calendario
DAILY_MEETING_CODE=wye-iwfu-jch     # Codigo de la sala de Google Meet

# ── Discord ──────────────────────────────────────────────────
DISCORD_WEBHOOK_RACE_DAY=           # Webhook para #race-day
DISCORD_WEBHOOK_CHAMPIONSHIP=       # Webhook para #championship

# ── Timezone ─────────────────────────────────────────────────
TZ=Europe/Madrid                    # Zona horaria del scheduler
```

En desarrollo, usar webhooks del canal de testing de Discord. Los webhooks reales solo se inyectan en produccion via GitHub Secrets.

## CI/CD

GitHub Actions con 3 workflows:

- **testing.yml**: lint + type-check + tests (en cada push a ramas, excepto main)
- **security.yml**: npm audit + semgrep + gitleaks (en cada push a ramas, excepto main)
- **deploy.yml**: en push a main — ejecuta security + testing, build de imagen Docker, push a GHCR (`ghcr.io/secture/daily-race`), deploy via SSH con docker compose y healthcheck

El deploy genera un tag semantico automatico desde los mensajes de commit y publica la imagen en GitHub Container Registry.

## Stack

- **Backend**: NestJS 11 + TypeScript 5.7 (strict)
- **Base de datos**: PostgreSQL 16
- **APIs**: Google Meet REST API v2, Google Calendar API v3
- **Notificaciones**: Discord webhooks
- **Contenedores**: Docker (multi-stage) + Docker Compose
- **Testing**: Jest (91 tests)
- **CI/CD**: GitHub Actions + GHCR + SSH deploy

## Documentacion adicional

- [Transcripciones](docs/transcripts.md) — diseño previsto para captura y publicacion de transcripts (pendiente de implementar)
