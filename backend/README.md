# Backend

This folder contains the backend-side pieces for WLAO.

Current areas:

- [`supabase/functions/world-labs-assist/`](./supabase/functions/world-labs-assist/)
  Active still-image orchestration flow.
- [`supabase/functions/world-labs-video/`](./supabase/functions/world-labs-video/)
  Short-video orchestration flow.
- [`supabase/sql/`](./supabase/sql/)
  SQL used by backend features such as video job tracking, Storage buckets, and policies.

## Snap Cloud / Supabase Notes

These backend pieces are designed for Snap Cloud powered by Supabase.

Contributors still need a local Lens Studio `SupabaseProject` asset, because the repo intentionally excludes credential-bearing project files from git.

Typical split of responsibility:

- Lens Studio local asset:
  - project URL
  - anon/public token
  - local project binding
- Backend deployment:
  - Edge Functions
  - Postgres tables
  - Storage buckets
  - service-role credentials

## Main deployment pieces

- `world-labs-assist`
  - current 4 wide views flow
- `world-labs-video`
  - frame upload batching
  - video job creation
  - worker trigger
  - job polling
  - hosted MP4 cleanup
- `worldlabs_video_jobs.sql`
  - table, buckets, and policies for the video path

See also:

- [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
- [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
