# WLAO Video Worker

This folder contains a deployable Docker-based backend for the `WLAO` video upload path.

It is designed to work alongside the existing still-image flow without replacing it.

## What It Does

1. Receives a job trigger from a Supabase Edge Function.
2. Downloads uploaded frame JPEGs from Supabase Storage.
3. Uses native `ffmpeg` inside Docker to stitch the frames into an MP4.
4. Uploads that MP4 to World Labs as a `video` media asset.
5. Starts World Labs world generation from the stitched video.
6. Writes job state back into Supabase so the lens can poll in the background.

## Folder Layout

- `app/main.py`
  FastAPI entrypoint.
- `app/worker.py`
  Orchestrates video job execution.
- `app/storage.py`
  Supabase Storage and database helpers.
- `app/worldlabs.py`
  World Labs API helpers.
- `requirements.txt`
  Python dependencies.
- `Dockerfile`
  Deployable container image.
- `.dockerignore`
  Docker ignore rules.
- `.env.example`
  Required environment variables.

## Required Supabase Pieces

Deploy these alongside this worker:

- `supabase/sql/worldlabs_video_jobs.sql`
- `supabase/functions/world-labs-video/index.ts`

## Required Environment Variables

See `.env.example`.

At minimum:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INPUT_BUCKET`
- `WORLDLABS_BASE_URL`

## Deploy

This worker is ideal for:

- Google Cloud Run
- Railway
- Fly.io
- Render

Recommended default: **Google Cloud Run**

## Notes

- The worker expects frames to already exist in Supabase Storage under:
  - `video-sessions/<sessionId>/frames/000001.jpg`
- The lens should upload frames first, then call the video Edge Function.
- The lens should not wait for FFmpeg or World Labs completion. Use background polling.
