SHELL := bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

# ANSI helpers (colorise the help line; degrade gracefully on dumb terminals)
COLOR := \033[36m
RESET := \033[0m

.PHONY: help install dev test typecheck lint format ci deploy clean hooks images

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

images: ## Re-encode source exports into ./public/img/. Each line no-ops if its source isn't present.
	@command -v cwebp >/dev/null || { echo "cwebp not found — brew install webp"; exit 1; }
	@command -v python3 >/dev/null || { echo "python3 not found"; exit 1; }
	@mkdir -p public/img
	[ ! -f hero-v5.png ]         || cwebp -quiet -q 90 -resize 1024 0 hero-v5.png         -o public/img/hero.webp
	[ ! -f readme-hero-v1.jpeg ] || cwebp -quiet -q 92 -resize 1280 0 readme-hero-v1.jpeg -o public/img/readme-hero.webp
	# OG: composite the hero tag onto a 1200x630 cover-cropped frame, then encode WebP + PNG.
	[ ! -f readme-hero-v1.jpeg ] || python3 ci/og-overlay.py readme-hero-v1.jpeg /tmp/vas3k-og.png
	[ ! -f /tmp/vas3k-og.png ]   || cwebp -quiet -q 92 /tmp/vas3k-og.png -o public/img/og.webp
	[ ! -f /tmp/vas3k-og.png ]   || cp /tmp/vas3k-og.png public/img/og.png
	@du -h public/img/*
