.PHONY: install dev stop restart logs \
       test test-watch test-cov lint build shell \
       db-migrate db-migrate-generate db-migrate-revert db-shell \
       clean help

# ── Core ──────────────────────────────────────────────────────

install: ## Construir imagenes e instalar dependencias
	docker compose build

dev: ## Levantar todos los servicios
	docker compose up -d

stop: ## Parar todos los servicios
	docker compose down

restart: ## Reiniciar todos los servicios
	docker compose restart

logs: ## Ver logs de todos los servicios
	docker compose logs -f

# ── Desarrollo ────────────────────────────────────────────────

test: ## Ejecutar tests
	docker compose exec -w /app/packages/backend app npx jest --passWithNoTests --maxWorkers=1

test-watch: ## Ejecutar tests en modo watch
	docker compose exec -w /app/packages/backend app npx jest --watch

test-cov: ## Ejecutar tests con cobertura
	docker compose exec -w /app/packages/backend app npx jest --coverage

lint: ## Ejecutar linter
	docker compose exec app npm run lint --workspace=packages/backend

build: ## Compilar el proyecto
	docker compose exec app npm run build --workspace=packages/backend

shell: ## Abrir shell en el contenedor
	docker compose exec app sh

# ── Base de datos ─────────────────────────────────────────────

db-migrate: ## Ejecutar migraciones pendientes
	docker compose exec -w /app/packages/backend app npx typeorm-ts-node-commonjs migration:run -d src/infrastructure/persistence/typeorm/data-source.ts

db-migrate-generate: ## Generar migracion (uso: make db-migrate-generate NAME=create-drivers)
	docker compose exec -w /app/packages/backend app npx typeorm-ts-node-commonjs migration:generate -d src/infrastructure/persistence/typeorm/data-source.ts src/infrastructure/persistence/typeorm/migrations/$(NAME)

db-migrate-revert: ## Revertir ultima migracion
	docker compose exec -w /app/packages/backend app npx typeorm-ts-node-commonjs migration:revert -d src/infrastructure/persistence/typeorm/data-source.ts

db-shell: ## Abrir consola psql
	docker compose exec db psql -U dailyrace -d dailyrace

# ── CLI (operaciones administrativas) ─────────────────────────

cli-recalculate-points: ## Recalcular puntos de todas las races con la formula actual
	docker compose exec -w /app/packages/backend app npm run cli:recalculate-points

cli-republish-championship: ## Republicar mensaje del championship standings a Discord
	docker compose exec -w /app/packages/backend app npm run cli:republish-championship

# ── Utilidades ────────────────────────────────────────────────

clean: ## Eliminar contenedores, volumenes e imagenes
	docker compose down -v --rmi local

help: ## Mostrar ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-25s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
