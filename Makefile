SHELL := bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

# ANSI helpers (colorise the help line; degrade gracefully on dumb terminals)
COLOR := \033[36m
RESET := \033[0m

.PHONY: help install dev test typecheck lint format ci deploy clean hooks

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(COLOR)%-10s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies (pnpm)
	pnpm install

dev: ## Run wrangler dev on http://127.0.0.1:8788
	pnpm dev

test: ## Run vitest (unit + contract; contract auto-skips without VAS3K_SERVICE_TOKEN)
	pnpm test

typecheck: ## tsc --noEmit (worker config + test config)
	pnpm typecheck

lint: ## Biome lint + format check
	pnpm lint

format: ## Auto-fix biome (lint + format + import organize)
	pnpm exec biome check --write .

ci: typecheck lint test ## Fast CI subset — what `.githooks/pre-push` runs
	@printf "$(COLOR)✓$(RESET) ci passed\n"

deploy: ci ## Deploy to Cloudflare (gated on `make ci` passing)
	pnpm run deploy

clean: ## Remove build artifacts and caches
	rm -rf node_modules dist .wrangler

hooks: ## One-time: point git at .githooks/ so pre-push runs `make ci`
	git config core.hooksPath .githooks
	@printf "$(COLOR)✓$(RESET) git core.hooksPath = .githooks/\n"
