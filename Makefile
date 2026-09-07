SHELL := /bin/bash
COMPOSE := docker compose --env-file .env.example -f compose.yaml
APP_PORT ?= 3000

.PHONY: demo stop clean

demo:
	@set -euo pipefail; \
	sep() { printf '%s\n' '============================================================'; }; \
	stage() { printf '\n'; sep; printf '%s\n' "$$1"; sep; }; \
	capture() { \
		local log status; \
		log=$$(mktemp); \
		set +e; \
		"$$@" >"$$log" 2>&1; \
		status=$$?; \
		set -e; \
		if [ "$$status" -eq 0 ]; then \
			rm -f "$$log"; \
			return 0; \
		fi; \
		cat "$$log"; \
		rm -f "$$log"; \
		return "$$status"; \
	}; \
	run_task() { \
		stage "$$1"; \
		shift; \
		APP_PORT=$(APP_PORT) $(COMPOSE) run --rm --no-deps --quiet app "$$@"; \
	}; \
	stage "BUILDING APPLICATION IMAGE"; \
	capture env APP_PORT=$(APP_PORT) $(COMPOSE) build app; \
	stage "STARTING POSTGRESQL"; \
	capture env APP_PORT=$(APP_PORT) $(COMPOSE) up --detach --wait db; \
	run_task "RUNNING MIGRATIONS" pnpm db:migrate; \
	run_task "RUNNING LINT" pnpm lint; \
	run_task "RUNNING TESTS" pnpm test; \
	run_task "RESETTING AND SEEDING DEMO DATA" pnpm db:seed; \
	printf '%s\n' \
		'============================================================' \
		'                    DEMO READY' \
		'============================================================' \
		'' \
		'URL' \
		'  http://localhost:$(APP_PORT)' \
		'' \
		'REVIEWER' \
		'  Email:    reviewer@takehome.local' \
		'  Password: reviewer-password-123' \
		'' \
		'OWNER' \
		'  Email:    owner@takehome.local' \
		'  Password: owner-password-123' \
		'' \
		'============================================================' \
		'Starting development server — press Ctrl-C to stop' \
		'============================================================'; \
	APP_PORT=$(APP_PORT) $(COMPOSE) up app db

stop:
	@$(COMPOSE) down --remove-orphans

clean:
	@$(COMPOSE) down --volumes --remove-orphans --rmi local
