# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-19

### Added

- 12 read-only MCP tools exposed on `/mcp` (feed, posts, comments, rooms, users, search — read-only surface of the vas3k.club API).
- 11 write-capable MCP tools exposed on `/mcp-full` (upvote, bookmark, retract, subscribe/unsubscribe to posts and rooms, mute room, friend management — все требуют upstream-токен).
- Dual-OAuth bridge: MCP client OAuth flow on the worker side, vas3k.club OAuth flow on the upstream side, with upstream tokens encrypted at rest in KV via `@cloudflare/workers-oauth-provider`.
- Russian-language landing page at `/` describing the project, both endpoints, and the full tool inventory.
- Weekly contract-test workflow (`.github/workflows/contract.yml`) that boots the real vas3k.club Django stack (postgres + redis + Django dev server) and runs zod-schema assertions against every documented tool, so upstream API drift is caught before users see it.
- Dependabot configuration for `github-actions` and `npm` ecosystems with weekly schedules; minor + patch npm bumps grouped to keep review noise down.
- Custom production domain at [vas3k-mcp.rmbk.me](https://vas3k-mcp.rmbk.me).

[Unreleased]: https://github.com/uburuntu/vas3k-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/uburuntu/vas3k-mcp/releases/tag/v0.1.0
