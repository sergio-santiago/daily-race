# Daily Race

Sistema de gamificacion de la daily standup de Secture con tematica de carreras/F1.

Tras cada daily, el sistema obtiene los timestamps de entrada de cada participante via Google Meet API, calcula puntos usando una formula de decaimiento exponencial, y publica el ranking en Discord.

## Terminologia

El codigo usa terminologia de carreras/F1 para mantener coherencia con la tematica:

| Concepto | Termino en codigo | Descripcion |
|----------|-------------------|-------------|
| Daily | Race | Cada daily es una carrera |
| Participante | Driver | Cada persona es un piloto |
| Hora programada | GreenLight | La luz verde / segundo 0 |
| Ranking de entrada | StartingGrid | Parrilla de salida |
| Entrar antes de hora | FalseStart | Salida en falso |
| Ultimo en entrar | LastOnGrid | Ultimo en parrilla (cuenta la ruina) |
| Ranking acumulado | Championship | Clasificacion general |

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

# Autenticarse con Google (solo modo OAuth)
# Abrir en navegador: http://localhost:3001/auth/google
```

## Comandos

| Comando                             | Descripcion                                |
|-------------------------------------|--------------------------------------------|
| `make install`                      | Construye imagenes e instala dependencias  |
| `make dev`                          | Levanta todos los servicios                |
| `make stop`                         | Para todos los servicios                   |
| `make logs`                         | Muestra logs de todos los servicios        |
| `make backend-test`                 | Ejecuta tests del backend                  |
| `make backend-lint`                 | Ejecuta linter del backend                 |
| `make db-migrate`                   | Ejecuta migraciones pendientes             |
| `make db-migrate-generate NAME=xxx` | Genera una nueva migracion                 |
| `make db-shell`                     | Abre consola psql                          |
| `make clean`                        | Elimina contenedores, volumenes e imagenes |

## API

| Endpoint                | Metodo | Descripcion                                        |
|-------------------------|--------|----------------------------------------------------|
| `/health`               | GET    | Health check                                       |
| `/races/process?date=`  | POST   | Procesar la daily de hoy (o de una fecha concreta) |
| `/races/championship`   | GET    | Clasificacion general acumulada                    |
| `/auth/google`          | GET    | Iniciar flujo OAuth con Google                     |
| `/auth/google/callback` | GET    | Callback OAuth (automatico)                        |
| `/auth/google/status`   | GET    | Estado de autenticacion                            |

## Arquitectura

Monorepo con npm workspaces:

```
packages/
  backend/     NestJS + TypeScript (arquitectura hexagonal)
  frontend/    Next.js (panel web — placeholder)
  shared/      Tipos y constantes compartidos
```

### Backend (hexagonal)

```
src/
  core/           Dominio: entidades puras + puertos (interfaces)
  application/    Casos de uso (scoring, grid, process race)
  infrastructure/ Adaptadores: Google Meet/Calendar, Discord, PostgreSQL
  api/            Controllers REST
```

- **Core**: entidades inmutables sin dependencias de framework. Puertos definidos como interfaces con Symbol tokens para inyeccion de dependencias.
- **Application**: casos de uso que orquestan la logica de negocio. Sin dependencias de infraestructura.
- **Infrastructure**: adaptadores que implementan los puertos. Google Meet/Calendar (OAuth + Service Account), Discord webhook, TypeORM/PostgreSQL.
- **API**: controllers REST delgados que delegan a los casos de uso.

### Autenticacion con Google

Dos modos configurables via `GOOGLE_AUTH_MODE`:

- **`oauth`** (desarrollo): OAuth 2.0 con cuenta personal. Requiere login manual via `/auth/google`. Solo ve reuniones del usuario autenticado.
- **`service-account`** (produccion): Service account con domain-wide delegation. Ve todas las reuniones de la organizacion.

El cambio entre modos es transparente — el `GoogleModule` inyecta el adaptador correspondiente segun la variable de entorno.

### Sistema de puntuacion

```
diff = tiempo_entrada - hora_programada (segundos)

Antes de hora:  diff * 20 (penalizacion sin limite)
En hora (0-5m): 100 * e^(-diff/30) (decaimiento exponencial)
Tarde (+5m):    1.00 (minimo por asistir)
No asiste:      0.00
```

Parametros ajustables en `packages/shared/src/constants/scoring.constants.ts`:

| Parametro | Valor | Descripcion |
|-----------|-------|-------------|
| `DECAY_FACTOR` | 30 | Velocidad de decaimiento (menor = cae mas rapido) |
| `FALSE_START_MULTIPLIER` | 20 | Severidad de la salida en falso |
| `WINDOW_SECONDS` | 300 | Ventana de puntuacion (5 minutos) |
| `MIN_POINTS` | 1 | Minimo por asistir |
| `MAX_POINTS` | 100 | Maximo (entrar en el ms 0) |

### Base de datos

PostgreSQL con 3 tablas (terminologia F1):

- **drivers**: id, google_id, display_name, email
- **races**: id, conference_record_name, meeting_code, green_light, end_time, status
- **starting_grid_entries**: id, race_id, driver_id, position, start_time, points, is_false_start, is_last_on_grid

### Discord

Dos canales separados:

- **#race-day**: ranking de cada daily
- **#championship**: clasificacion general acumulada (top 20)

## Stack

- **Backend**: NestJS 11 + TypeScript
- **Frontend**: Next.js (placeholder)
- **Base de datos**: PostgreSQL 16
- **APIs**: Google Meet REST API v2, Google Calendar API v3
- **Notificaciones**: Discord webhooks
- **Contenedores**: Docker + Docker Compose
- **Testing**: Jest (40 tests unitarios)
