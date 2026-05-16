# Deployment

## Overview

WLAO has two backend deployment tracks:

- the active still-image path
- the optional video-generation path

You can deploy only the still-image path if you want the current app behavior.

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

This creates the `worldlabs_video_jobs` table used by the video path.

If the table already exists in your project, add the new hosted-video tracking column:

```sql
alter table public.worldlabs_video_jobs
add column if not exists video_url text;
```

## Edge Function: `world-labs-video`

Deploy:
- [`../backend/supabase/functions/world-labs-video/index.ts`](../backend/supabase/functions/world-labs-video/index.ts)

Required env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VIDEO_WORKER_URL`
- optional `WORLDLABS_API_KEY`

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

## Supabase Storage

Create a bucket for uploaded video frames, for example:
- `worldlabs-video-input`

Recommended path pattern:
- `video-sessions/<sessionId>/frames/000001.jpg`

Also create a public output bucket for stitched MP4s, for example:
- `worldlabs-video-output`

## Lens Project Setup

Inside Lens Studio, make sure:
- the project points at the correct Supabase deployment
- the `SupabaseProject` asset is local only
- required `InternetModule` and script references are assigned
- no `.supabaseProject` asset is committed

## Deployment Order

If you are enabling only the current app flow:

1. deploy `world-labs-assist`
2. verify [`../lens/Assets/Scripts/config.js`](../lens/Assets/Scripts/config.js)
3. open the lens and test still-image submission

If you are enabling the video scaffold too:

1. create the SQL table
2. add the `video_url` column if your table already existed
3. deploy `world-labs-video`
4. redeploy the `video-worker`
5. configure `VIDEO_WORKER_URL`
6. configure worker env vars including `INPUT_BUCKET` and `OUTPUT_BUCKET`
7. create the Storage buckets
8. test the worker `/health` endpoint

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
