.PHONY: install dev stop restart logs logs-backend logs-frontend \
       backend-test backend-test-watch backend-test-cov backend-lint backend-build backend-shell \
       frontend-build frontend-shell \
       db-migrate db-migrate-generate db-migrate-revert db-shell \
       shared-build clean help

# ── Core ──────────────────────────────────────────────────────

install: ## Construir imagenes e instalar dependencias
	docker compose build
	docker compose run --rm backend npm run build --workspace=packages/shared

dev: ## Levantar todos los servicios
	docker compose up -d

stop: ## Parar todos los servicios
	docker compose down

restart: ## Reiniciar todos los servicios
	docker compose restart

logs: ## Ver logs de todos los servicios
	docker compose logs -f

logs-backend: ## Ver logs del backend
	docker compose logs -f backend

logs-frontend: ## Ver logs del frontend
	docker compose logs -f frontend

# ── Backend ───────────────────────────────────────────────────

backend-test: ## Ejecutar tests del backend
	docker compose exec -w /app/packages/backend backend npx jest --passWithNoTests --maxWorkers=1

backend-test-watch: ## Ejecutar tests del backend en modo watch
	docker compose exec -w /app/packages/backend backend npx jest --watch

backend-test-cov: ## Ejecutar tests con cobertura
	docker compose exec -w /app/packages/backend backend npx jest --coverage

backend-lint: ## Ejecutar linter del backend
	docker compose exec backend npm run lint --workspace=packages/backend

backend-build: ## Compilar el backend
	docker compose exec backend npm run build --workspace=packages/backend

backend-shell: ## Abrir shell en el contenedor del backend
	docker compose exec backend sh

# ── Frontend ──────────────────────────────────────────────────

frontend-build: ## Compilar el frontend
	docker compose exec frontend npm run build --workspace=packages/frontend

frontend-shell: ## Abrir shell en el contenedor del frontend
	docker compose exec frontend sh

# ── Base de datos ─────────────────────────────────────────────

db-migrate: ## Ejecutar migraciones pendientes
	docker compose exec -w /app/packages/backend backend npx typeorm-ts-node-commonjs migration:run -d src/infrastructure/persistence/typeorm/data-source.ts

db-migrate-generate: ## Generar migracion (uso: make db-migrate-generate NAME=create-drivers)
	docker compose exec -w /app/packages/backend backend npx typeorm-ts-node-commonjs migration:generate -d src/infrastructure/persistence/typeorm/data-source.ts src/infrastructure/persistence/typeorm/migrations/$(NAME)

db-migrate-revert: ## Revertir ultima migracion
	docker compose exec -w /app/packages/backend backend npx typeorm-ts-node-commonjs migration:revert -d src/infrastructure/persistence/typeorm/data-source.ts

db-shell: ## Abrir consola psql
	docker compose exec db psql -U dailyrace -d dailyrace

# ── Shared ────────────────────────────────────────────────────

shared-build: ## Compilar paquete shared
	docker compose exec backend npm run build --workspace=packages/shared

# ── Utilidades ────────────────────────────────────────────────

clean: ## Eliminar contenedores, volumenes e imagenes
	docker compose down -v --rmi local

help: ## Mostrar ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-25s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
