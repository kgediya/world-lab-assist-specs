# Deployment

## Overview

WLAO has two backend deployment tracks:

- the still-image path
- the short-video path

You can deploy only the still-image path if you want the simpler production-safe setup, or deploy both if you want mode switching in the lens.

## Snap Cloud / Supabase Prerequisites

Before deploying functions from this repo:

1. Make sure you have Snap Cloud access for your Spectacles project.
2. Install and use the Supabase Plugin in Lens Studio.
3. Create a Snap Cloud backend project for this lens.
4. Generate a local `SupabaseProject` asset in Lens Studio.
5. Keep that asset local only. Do not commit:
   - `.supabaseProject`
   - `.supabaseProject.meta`
6. Assign the local `SupabaseProject` asset and `InternetModule` in the lens scene.

Because the repo intentionally excludes credential-bearing project files, this local setup is required for every contributor.

## Still-Image Path

Deploy:

- [`../backend/supabase/functions/world-labs-assist/index.ts`](../backend/supabase/functions/world-labs-assist/index.ts)

Required env vars:

- `WORLDLABS_API_KEY` if you want a backend default key

The lens can also send a user-provided API key directly.

## Video Path

Deploy all of the following:

- [`../backend/supabase/sql/worldlabs_video_jobs.sql`](../backend/supabase/sql/worldlabs_video_jobs.sql)
- [`../backend/supabase/functions/world-labs-video/index.ts`](../backend/supabase/functions/world-labs-video/index.ts)
- [`../workers/video-worker/`](../workers/video-worker/)

## Supabase SQL

Run:

- [`../backend/supabase/sql/worldlabs_video_jobs.sql`](../backend/supabase/sql/worldlabs_video_jobs.sql)

This creates:

- the `worldlabs_video_jobs` table
- buckets and policies expected by the video flow

If the table already exists in your project, at minimum add the hosted-video tracking column:

```sql
alter table public.worldlabs_video_jobs
add column if not exists video_url text;
```

## Supabase Storage

Create or verify:

- private input bucket: `worldlabs-video-input`
- public output bucket: `worldlabs-video-output`

Recommended path pattern:

- `video-sessions/<sessionId>/frames/000001.jpg`

The video path will automatically clean up:

- raw input frames after World Labs accepts the video generation request
- stitched MP4 output after the World Labs operation completes or fails

## Edge Function: `world-labs-assist`

Deploy:

- [`../backend/supabase/functions/world-labs-assist/index.ts`](../backend/supabase/functions/world-labs-assist/index.ts)

Used for:

- 4 wide views photo flow
- generation status polling for photo mode

## Edge Function: `world-labs-video`

Deploy:

- [`../backend/supabase/functions/world-labs-video/index.ts`](../backend/supabase/functions/world-labs-video/index.ts)

Required env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VIDEO_WORKER_URL`
- `INPUT_BUCKET=worldlabs-video-input`
- `OUTPUT_BUCKET=worldlabs-video-output`
- optional `WORLDLABS_API_KEY`

Used for:

- frame upload batches from the lens
- video job creation
- worker trigger
- job status polling
- cleanup of hosted MP4 artifacts after terminal World Labs state

## Video Worker

Recommended hosts:

- Google Cloud Run
- Railway
- Fly.io
- Render

Recommended defaults:

- Cloud Run for the cleanest long-term shape
- Railway for the fastest prototype deployment

See:

- [`../workers/video-worker/README.md`](../workers/video-worker/README.md)

Worker env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INPUT_BUCKET=worldlabs-video-input`
- `OUTPUT_BUCKET=worldlabs-video-output`
- `WORLDLABS_BASE_URL=https://api.worldlabs.ai`

## Lens Project Setup

Inside Lens Studio, make sure:

- the project points at the correct Snap Cloud deployment
- the local `SupabaseProject` asset is assigned
- `InternetModule` is assigned
- `WorldLabsBackend` uses the right function names
- `WorldLabsController` is wired to the correct UI

For mode switching through UI, wire a button to one of:

- `setPhotoMode()`
- `setVideoMode()`
- `toggleCaptureMode()`

## Deployment Order

If you are enabling only the still-image flow:

1. deploy `world-labs-assist`
2. verify [`../lens/Assets/Scripts/config.js`](../lens/Assets/Scripts/config.js)
3. open the lens and test photo submission

If you are enabling the short-video flow too:

1. run the SQL bootstrap
2. verify the input and output buckets
3. deploy `world-labs-video`
4. deploy or redeploy the `video-worker`
5. configure `VIDEO_WORKER_URL`
6. configure worker env vars including `INPUT_BUCKET` and `OUTPUT_BUCKET`
7. verify the worker `/health` endpoint
8. switch the lens to `Video Mode`
9. test end-to-end recording, upload, and background completion

## Security Notes

Do not commit:

- `.supabaseProject`
- `.supabaseProject.meta`
- `.env` files
- Supabase service-role credentials

If a credential-bearing asset was ever committed:

- remove it from the tree
- rewrite history if needed
- rotate the credential

## Related Docs

- [`../README.md`](../README.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`REPO_STRUCTURE.md`](./REPO_STRUCTURE.md)
