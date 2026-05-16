# WLAO Video Worker

This folder contains the deployable backend scaffold for WLAO's future video upload path.

It is intentionally separate from the current still-image flow so contributors can iterate on video processing without destabilizing the live app path.

## Purpose

The worker is responsible for:
- downloading uploaded JPEG frames from Supabase Storage
- stitching them into an MP4 with native FFmpeg
- uploading the MP4 to World Labs as a `video` media asset
- starting World Labs world generation from that video
- updating Supabase job state so the lens can poll in the background

## Folder Layout

- `app/main.py`
  FastAPI entrypoint and health route.
- `app/worker.py`
  Video job orchestration.
- `app/storage.py`
  Supabase database and Storage helpers.
- `app/worldlabs.py`
  World Labs upload and generation helpers.
- `requirements.txt`
  Python dependencies.
- `Dockerfile`
  Deployable image definition.
- `.dockerignore`
  Docker build exclusions.
- `.env.example`
  Environment variable reference.

## Related Repo Pieces

This worker expects these backend pieces to exist:
- [`../../backend/supabase/functions/world-labs-video/index.ts`](../../backend/supabase/functions/world-labs-video/index.ts)
- [`../../backend/supabase/sql/worldlabs_video_jobs.sql`](../../backend/supabase/sql/worldlabs_video_jobs.sql)

## Expected Storage Layout

Frames should already exist in Supabase Storage before a worker job starts.

Recommended path pattern:
- `video-sessions/<sessionId>/frames/000001.jpg`

## Environment Variables

See `.env.example`.

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INPUT_BUCKET`
- `WORLDLABS_BASE_URL`

## Local Run

Typical local flow:

1. create a `.env` file from `.env.example`
2. install dependencies
3. run the FastAPI app
4. test `/health`

Example:

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Deployment Model

Recommended flow:

1. Lens records and uploads frames to Supabase Storage.
2. Lens calls the `world-labs-video` Edge Function.
3. The Edge Function creates a DB job row.
4. The Edge Function calls this worker.
5. The worker stitches MP4 and starts World Labs generation.
6. The lens polls background status through Supabase.

## Recommended Hosting

Best fits:
- Google Cloud Run
- Railway
- Fly.io
- Render

Recommended default:
- **Cloud Run** for the cleanest long-term structure
- **Railway** for quick prototype deployment

## What This Folder Does Not Do

It does not:
- record video directly from Spectacles
- upload frames from the lens
- replace the current still-image workflow

Those pieces remain lens-side or Edge Function responsibilities.

## Related Docs

- [`../../README.md`](../../README.md)
- [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
- [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md)
