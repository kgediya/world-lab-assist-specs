# Repo Structure

## Overview

WLAO is laid out to keep the wearable app, backend functions, and optional video infrastructure easy to reason about independently.

## Top-Level Map

- `Assets/`
  Lens Studio scene assets, scripts, UI assets, and project-side resources.
- `docs/`
  Human-facing architecture, deployment, and repo-structure guides.
- `supabase/functions/`
  Edge Functions used by the project.
- `supabase/sql/`
  SQL setup files used by backend features.
- `video-worker/`
  Deployable Python + FFmpeg worker for the video-generation path.
- `Workspaces/`
  Local Lens Studio workspace state. Usually not something contributors should change intentionally.
- `Cache/`
  Local generated editor/cache files. Not a source area.

## Lens App Area

- `Assets/Scripts/config.js`
  Shared project-level settings.
- `Assets/Scripts/WorldLabs/`
  Main runtime scripts for capture, UI, settings, and backend calls.
- `Assets/UI Elements/`
  Image assets used by the lens UI.

## Backend Area

- `supabase/functions/world-labs-assist/index.ts`
  Current still-image orchestration function.
- `supabase/functions/world-labs-video/index.ts`
  Video-job orchestration scaffold.
- `supabase/sql/worldlabs_video_jobs.sql`
  SQL for tracking video jobs.

## Video Worker Area

- `video-worker/app/main.py`
  FastAPI entrypoint and health route.
- `video-worker/app/worker.py`
  Video job processing flow.
- `video-worker/app/storage.py`
  Supabase DB and Storage helpers.
- `video-worker/app/worldlabs.py`
  World Labs upload and generation helpers.
- `video-worker/Dockerfile`
  Deployable container definition.

## Documentation Area

- `README.md`
  Best starting point for understanding the project.
- `CONTRIBUTING.md`
  Contribution expectations and workflow notes.
- `SECURITY.md`
  Secret-handling and vulnerability guidance.
- `SUPPORT.md`
  Troubleshooting and where to look first.
- `docs/ARCHITECTURE.md`
  Runtime and systems overview.
- `docs/DEPLOYMENT.md`
  Backend deployment paths.

## Things That Must Stay Local

Never commit:
- `.supabaseProject`
- `.supabaseProject.meta`
- `.env` files
- service-role keys
- raw API keys

The repo `.gitignore` is already set up to block these, but contributors should still verify staged files manually.
