# Repo Structure

## Overview

WLAO is laid out to keep the wearable app, backend functions, and optional video infrastructure easy to reason about independently.

## Top-Level Map

- [`../lens/`](../lens/)
  Lens Studio project files and app-side assets.
- [`../backend/`](../backend/)
  Supabase Edge Functions and SQL setup.
- [`../workers/`](../workers/)
  Deployable non-Supabase services such as the FFmpeg worker.
- [`../docs/`](../docs/)
  Human-facing architecture and deployment guides.

## Lens Area

- [`../lens/WLAO.esproj`](../lens/WLAO.esproj)
  Main Lens Studio project file.
- [`../lens/Assets/`](../lens/Assets/)
  Scene assets, scripts, materials, and UI resources.
- [`../lens/Packages/`](../lens/Packages/)
  Lens Studio packages used by the project.
- [`../lens/Support/`](../lens/Support/)
  Local project support files used by Lens Studio.
- [`../lens/Workspaces/`](../lens/Workspaces/)
  Lens Studio workspace state for contributors who track it.

## Backend Area

- [`../backend/supabase/functions/world-labs-assist/index.ts`](../backend/supabase/functions/world-labs-assist/index.ts)
  Current still-image orchestration function.
- [`../backend/supabase/functions/world-labs-video/index.ts`](../backend/supabase/functions/world-labs-video/index.ts)
  Video-job orchestration scaffold.
- [`../backend/supabase/sql/worldlabs_video_jobs.sql`](../backend/supabase/sql/worldlabs_video_jobs.sql)
  SQL for tracking video jobs.

## Worker Area

- [`../workers/video-worker/app/main.py`](../workers/video-worker/app/main.py)
  FastAPI entrypoint and health route.
- [`../workers/video-worker/app/worker.py`](../workers/video-worker/app/worker.py)
  Video job processing flow.
- [`../workers/video-worker/app/storage.py`](../workers/video-worker/app/storage.py)
  Supabase DB and Storage helpers.
- [`../workers/video-worker/app/worldlabs.py`](../workers/video-worker/app/worldlabs.py)
  World Labs upload and generation helpers.
- [`../workers/video-worker/Dockerfile`](../workers/video-worker/Dockerfile)
  Deployable container definition.

## Documentation Area

- [`../README.md`](../README.md)
  Best starting point for understanding the project.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
  Contribution expectations and workflow notes.
- [`../SECURITY.md`](../SECURITY.md)
  Secret-handling and vulnerability guidance.
- [`../SUPPORT.md`](../SUPPORT.md)
  Troubleshooting and where to look first.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
  Runtime and systems overview.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md)
  Backend deployment paths.

## Things That Must Stay Local

Never commit:
- `.supabaseProject`
- `.supabaseProject.meta`
- `.env` files
- service-role keys
- raw API keys

The repo `.gitignore` is already set up to block these, but contributors should still verify staged files manually.
