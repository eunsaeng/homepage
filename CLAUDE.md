# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Local development workspace for the Bankware Global homepage CMS rebuild. Four independently run parts:

- `apps/api` — Kotlin / Spring Boot 4 WebFlux, R2DBC + Flyway on PostgreSQL, JDK 25 (port 8080). Built with Gradle, **not** part of the pnpm workspace.
- `web` — public Next.js 16 site (port 3000).
- `admin` — CMS Next.js 16 app (port 3001). Currently also hosts the local-only **harness dashboard** at `/harness` (API under `src/app/api/harness/**`). It reads `requirements/` and `.harness/` from disk and never writes run state: pins, answers to Spec questions, Spec edits and approvals are queued as files in `.harness/commands/`, and the orchestrator applies them at its checkpoints (`scripts/harness/lib/commands.mjs`). `HARNESS_WORKSPACE_ROOT` points it at another workspace.
- `e2e` — Playwright tests.

The pnpm workspace (`pnpm-workspace.yaml`) contains `web`, `admin` and `e2e`. Shared versions (React 19, TypeScript 7, ESLint 10) come from its `catalog:`.

`web/AGENTS.md` and `admin/AGENTS.md` warn that this Next.js version has breaking changes compared with training data. Read the guides in `<app>/node_modules/next/dist/docs/` before you write Next.js code.

## Commands

Run these from the repo root on Windows/PowerShell. Prerequisites: JDK 25, Node 24, pnpm 12.7 and Podman.

```powershell
# PostgreSQL 18 (only dependency run in a container; infra/local/compose.yaml mirrors it)
podman machine start
podman run --replace --detach --name homepage-postgres -p 5432:5432 -e POSTGRES_DB=homepage -e POSTGRES_USER=homepage -e POSTGRES_PASSWORD=homepage -v homepage-postgres-data:/var/lib/postgresql docker.io/library/postgres:18.6

pnpm dev:web                     # :3000
pnpm dev:admin                   # :3001
.\scripts\gradle-api.ps1 bootRun '--args=--spring.profiles.active=local'
```

Always call Gradle through `scripts/gradle-api.ps1`. The script finds a JDK 25 through `JAVA_HOME` or `%LOCALAPPDATA%\Programs\Temurin\jdk-25*` and runs `apps/api/gradlew.bat` with `-p apps/api`.

Verification (these match the checks the harness runs per repository):

```powershell
pnpm --filter web exec tsc --noEmit
pnpm --filter admin exec tsc --noEmit
pnpm --filter web build
pnpm --filter admin build
.\scripts\gradle-api.ps1 test
pnpm test:e2e                    # starts API (bootRun), web and admin itself, reusing ones already running; E2E_EXTERNAL_SERVERS=true skips starting
pnpm test:harness                # node:test suite for scripts/harness
```

Run a single test:

```powershell
.\scripts\gradle-api.ps1 test --tests "com.bankwareglobal.homepage.api.ApiApplicationTests"
pnpm --filter e2e exec playwright test tests/public-homepage.spec.ts -g "public homepage"
node --test scripts/harness/test/backlog.test.mjs
```

Known issue: `pnpm --filter <app> lint` (ESLint) fails because typescript-eslint does not support TypeScript 7. Use `tsc --noEmit` for static checks until that is resolved.

## API configuration

- `spring.profiles.default` is `local`. Only the `local` profile may enable stub account authentication and the stub DAOU Office account directory. Real DAOU Office sync is for stg and higher environments and is never called locally.
- DB settings come from `DB_R2DBC_URL`, `DB_JDBC_URL`, `DB_USERNAME` and `DB_PASSWORD`. They default to `homepage`/`homepage` on `localhost:5432`. The app reads data through R2DBC, and Flyway migrates the schema through JDBC.

## Target architecture (from `wiki/`)

The `wiki/` docs are in Korean and are the source of truth: `requirements.md` (ACC-/CMS-/WEB- IDs), `architecture.md`, `api-spec.md` and `erd.md`. Key constraints:

- `web` and `admin` both treat the API as the single authority for data and permissions. The API must check roles on every admin request, even when the UI hides the action. There are three roles: permission admin, content editor and publisher.
- Public endpoints are `GET /api/public/pages/{slug}` and `GET /api/public/navigation`. Admin endpoints live under `/api/admin/**`. CORS is limited to `localhost:3000` and `localhost:3001`, with credentials.
- Page content is stored as versioned revisions, and each page has a separate pointer to its published revision. Editing always creates a new draft and never overwrites the published revision. Publishing switches the pointer in one DB transaction.

## Development harness (`scripts/harness`)

This is a Node ESM orchestrator that turns the backlog into code by running a new `claude -p` session for each stage. Model choices per stage are in `lib/config.mjs`, and the main state machine is in `lib/pipeline.mjs`. The full design is in `wiki/development-harness-plan.md`.

```powershell
pnpm harness validate   # parse backlog, check wiki line-range evidence, write .harness/preflight/
pnpm harness validate --fix   # first rewrite citation headings/ranges to match wiki/requirements.md, then validate
pnpm harness status
pnpm harness run        # makes model calls, creates worktrees/commits, writes local MR Markdown under .harness/
pnpm harness resume
```

- **Backlog:** each `requirements/request-*.md` file is one backlog item, with id `BL-<name>`, and produces exactly one Spec. The parser in `lib/backlog.mjs` depends on this exact Markdown format:
  - `- Primary repository: \`apps|web|admin|e2e\``
  - `- Request type: ...`
  - a `## 근거` list whose entries look like ``- `CMS-04` — 「heading」, `wiki/requirements.md` 12-18행``
  - `## 구현 의존성` with `- 선행:` / `- 계약:` links to other request files
  - an optional `## UNRESOLVED` section; any content other than "없음/none" pauses the run

  Run `pnpm harness validate` after you edit request files. Besides parsing, it enforces the generation rules in `lib/request-audit.mjs`:
  - file names are `request-<primary repo>-<title>.md`
  - each citation's heading and range match the requirement's section, from the heading line to the ID line
  - dependencies only point from later repos to earlier ones (apps → admin/web → e2e)
  - every requirement ID is cited, and a feature that spans repositories has both an `apps` request and an `e2e` request

  When `wiki/requirements.md` lines move, run `pnpm harness validate --fix`. It rewrites the citations in `requirements/` and `requirements/deferred/` and leaves unknown IDs for validate to report.
  It writes a per-request trace of IDs, headings, ranges and excerpt hashes to `.harness/preflight/generation-plan.md`.
- **Deferred requests:** `requirements/deferred/` holds the stg-only DAOU Office sync requests (ACC-02). The harness does not read subfolders, so these are excluded until their UNRESOLVED items are settled. `requirements/deferred/README.md` explains how to restore them.
- **Wiki context:** sessions only get the wiki sections that the request cites (`lib/wiki-context.mjs`). Whole wiki files are never passed to a session.
- **Execution:** each issue runs in a git worktree under `.worktrees/`, with at most 3 review iterations. Runs pause as `PAUSED_UNRESOLVED` or `PAUSED_REVIEW_LIMIT`. MRs are local branches plus Markdown only, and nothing is pushed to a remote.
- **Bootstrap:** on the unborn `main` branch, the first `run` makes an initial commit from a manifest of explicitly listed paths. It never runs `git add .`.
- `.harness/` and `.worktrees/` are gitignored runtime state.
