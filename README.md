# Bankware Global Homepage

Local development workspace for the CMS rebuild.

## Components

- `apps/api`: Kotlin, Spring Boot WebFlux, R2DBC and PostgreSQL.
- `web`: public Next.js site on `http://localhost:3000`.
- `admin`: CMS Next.js application on `http://localhost:3001`.
- `e2e`: Playwright browser tests.
- `infra/local/compose.yaml`: PostgreSQL for local development, started with Podman.

## Prerequisites

- JDK 25
- Node.js 24 LTS and pnpm 12.7
- Podman with a running Podman Machine on Windows

## Start local dependencies

```powershell
podman machine start
podman run --replace --detach --name homepage-postgres -p 5432:5432 -e POSTGRES_DB=homepage -e POSTGRES_USER=homepage -e POSTGRES_PASSWORD=homepage -v homepage-postgres-data:/var/lib/postgresql docker.io/library/postgres:18.6
```

## Start applications

Run each command in a separate terminal from the workspace root:

```powershell
pnpm dev:web
pnpm dev:admin
.\scripts\gradle-api.ps1 bootRun '--args=--spring.profiles.active=local'
```

The `local` profile uses the local PostgreSQL service and is the only profile intended to enable stub account authentication.

## Verify

```powershell
pnpm --filter web exec tsc --noEmit
pnpm --filter admin exec tsc --noEmit
pnpm test:e2e
.\scripts\gradle-api.ps1 test
```

Stop PostgreSQL without deleting the local volume:

```powershell
podman stop homepage-postgres
```

## Development harness

The harness reads one `requirements/request-*.md` file per Spec and only supplies referenced wiki excerpts to Claude sessions. The Claude Code CLI must be installed and authenticated.

```powershell
pnpm harness validate
pnpm harness status
pnpm harness run
pnpm harness resume
pnpm test:harness
```

`pnpm harness run` is the automation entry point. On this unborn `main` branch it first asks a Sonnet session for an explicit baseline path manifest, verifies that it exactly matches the untracked file inventory, then creates a scoped initial commit. It never runs `git add .`. Any unclear path pauses as `UNRESOLVED`. Run/resume can make model calls, create issue worktrees and commits, and write local MR Markdown under `.harness/`; no remote MR is published.
