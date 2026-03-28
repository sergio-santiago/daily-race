# Daily Race

Sistema de gamificacion de la daily standup de Secture con tematica de carreras/F1.

Tras cada daily, el sistema obtiene los timestamps de entrada de cada participante via Google Meet API, calcula puntos usando una formula de decaimiento exponencial, y publica el ranking en Discord.

## Terminologia

El codigo usa terminologia de carreras/F1 para mantener coherencia con la tematica:

| Concepto             | Termino en codigo | Emoji | Descripcion                          |
|----------------------|-------------------|-------|--------------------------------------|
| Daily                | Race              | \u{1F3C1}    | Cada daily es una carrera            |
| Participante         | Driver            | \u{1F3CE}\u{FE0F}    | Cada persona es un piloto            |
| Hora programada      | GreenLight        | \u{1F6A5}    | La luz verde / segundo 0             |
| Ranking de entrada   | StartingGrid      | \u{1F7E2}    | Parrilla de salida                   |
| Entrar antes de hora | FalseStart        | \u{26D4}    | Salida en falso                      |
| Ganador (P1)         | PolePosition      | \u{1F3C6}    | Primera posicion en la parrilla      |
| Ultimo en entrar     | LastOnGrid        | \u{1F451}    | Rey/Reina de la ruina                |
| Entrar tarde (+60s)  | Rezagado          | \u{1F422}    | Entrada con retraso notable          |
| Ranking acumulado    | Championship      | \u{1F3C6}    | Clasificacion general                |

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

## Funcionamiento automatico

El backend incluye un **scheduler (cron)** que automatiza el procesamiento de la daily sin intervencion manual:

- Se ejecuta **cada 10 segundos, de lunes a viernes, de 8:00 a 14:00** (Europe/Madrid)
- En cada ejecucion consulta la Google Meet API para comprobar si la daily ha terminado
- Si detecta que la reunion ha finalizado (la sala se ha vaciado), procesa los resultados automaticamente:
  1. Obtiene los timestamps de entrada de cada participante
  2. Calcula los puntos segun el sistema de puntuacion
  3. Persiste los datos en PostgreSQL (drivers, race, starting grid)
  4. Publica el ranking en **#race-day** (Discord)
  5. Publica la clasificacion general actualizada en **#championship** (Discord)
- Solo procesa reuniones que terminaron **despues** de la hora programada (si alguien entra y sale antes del green light, se ignora)
- Si la daily ya fue procesada, no la reprocesa (idempotente)

**Para que funcione en automatico, el backend debe estar corriendo continuamente** (en un servidor, VPS, o Cloud Run). En desarrollo local con `make dev`, el scheduler tambien esta activo.

## API

### Operaciones (uso interno / administracion)

| Endpoint                         | Metodo | Descripcion                                                    |
|----------------------------------|--------|----------------------------------------------------------------|
| `/health`                        | GET    | Health check del sistema (estado de DB y autenticacion Google) |
| `/races/process`                 | POST   | Trigger manual: procesa la daily de hoy                        |
| `/races/process?date=2026-03-27` | POST   | Carga historica: procesa la daily de una fecha concreta        |

El endpoint `/races/process` es util para:
- **Trigger manual**: forzar el procesamiento sin esperar al cron
- **Carga historica**: procesar dailies pasadas (la Meet API retiene datos 30 dias)
- **Testing**: probar el sistema sin esperar a que haya una daily real

### Datos para frontend (no consumidos aun)

Estos endpoints estan preparados para cuando se implemente el frontend web:

| Endpoint              | Metodo | Descripcion                                                                  |
|-----------------------|--------|------------------------------------------------------------------------------|
| `/races/championship` | GET    | Clasificacion general acumulada (todos los drivers con puntos, races, media) |

### Autenticacion OAuth

Necesarios para el flujo de autenticacion con Google (modo `oauth`):

| Endpoint                | Metodo | Descripcion                                        |
|-------------------------|--------|----------------------------------------------------|
| `/auth/google`          | GET    | Redirige a Google para iniciar el login OAuth      |
| `/auth/google/callback` | GET    | Callback automatico donde Google devuelve el token |
| `/auth/google/status`   | GET    | Comprueba si hay tokens validos guardados          |

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

- **`oauth`** (desarrollo): OAuth 2.0 con cuenta personal. Requiere login manual via `/auth/google`. Solo ve reuniones del usuario autenticado. Limitacion: la API solo devuelve datos de reuniones en las que el usuario autenticado participo.
- **`service-account`** (produccion): Service account con domain-wide delegation. Ve todas las reuniones de la organizacion sin depender de un usuario concreto. Requiere que un admin de Google Workspace autorice la delegacion.

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

| Parametro                | Valor | Descripcion                                       |
|--------------------------|-------|---------------------------------------------------|
| `DECAY_FACTOR`           | 30    | Velocidad de decaimiento (menor = cae mas rapido) |
| `FALSE_START_MULTIPLIER` | 20    | Severidad de la salida en falso                   |
| `WINDOW_SECONDS`         | 300   | Ventana de puntuacion (5 minutos)                 |
| `MIN_POINTS`             | 1     | Minimo por asistir                                |
| `MAX_POINTS`             | 100   | Maximo (entrar en el ms 0)                        |

### Base de datos

PostgreSQL con 4 tablas (terminologia F1):

- **drivers**: id, google_id, display_name, email, created_at, updated_at
- **races**: id, conference_record_name, meeting_code, green_light, end_time, status, processed_at, created_at
- **starting_grid_entries**: id, race_id, driver_id, position, start_time, green_light, points, is_false_start, is_last_on_grid
- **transcript_entries**: id, race_id, speaker_name, text, start_time, end_time, created_at

### Discord

Dos canales separados con webhooks independientes:

- **#race-day**: ranking de cada daily (parrilla de salida con posiciones, puntos y tiempos)
- **#championship**: clasificacion general acumulada (top 20 con puntos totales, carreras y media)

Ambos mensajes se publican automaticamente tras cada race procesada.

## Stack

- **Backend**: NestJS 11 + TypeScript
- **Frontend**: Next.js (placeholder)
- **Base de datos**: PostgreSQL 16
- **APIs**: Google Meet REST API v2, Google Calendar API v3
- **Notificaciones**: Discord webhooks
- **Contenedores**: Docker + Docker Compose
- **Testing**: Jest (62 tests unitarios)

## Documentacion adicional

- [Transcripciones](docs/transcripts.md) — persistencia y uso futuro de transcripts de reuniones
