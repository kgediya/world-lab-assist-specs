# WLAO Video Worker

This folder contains the deployable FFmpeg worker for WLAO's short-video path.

It is intentionally separate from the 4-view photo flow so contributors can iterate on video processing without destabilizing the simpler path.

## Purpose

The worker is responsible for:

- downloading uploaded JPEG frames from Supabase Storage
- stitching them into an MP4 with native FFmpeg
- uploading the MP4 to a public Supabase output bucket
- starting World Labs world generation from that hosted video URL
- updating Supabase job state so the lens can poll in the background
- removing raw frame uploads after World Labs accepts the video job

## Folder Layout

- `app/main.py`
  FastAPI entrypoint and health route.
- `app/worker.py`
  Video job orchestration.
- `app/storage.py`
  Supabase database and Storage helpers.
- `app/worldlabs.py`
  World Labs generation helpers.
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

The stitched output video is written to:

- `video-sessions/<sessionId>/<sessionId>.mp4`

## Environment Variables

See `.env.example`.

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INPUT_BUCKET`
- `OUTPUT_BUCKET`
- `WORLDLABS_BASE_URL`

Example:

- `INPUT_BUCKET=worldlabs-video-input`
- `OUTPUT_BUCKET=worldlabs-video-output`

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

1. Lens records and uploads frame batches to Supabase Storage.
2. Lens calls the `world-labs-video` Edge Function.
3. The Edge Function creates a DB job row.
4. The Edge Function calls this worker.
5. The worker stitches MP4.
6. The worker uploads the MP4 to a public Supabase bucket.
7. The worker calls World Labs using `video_prompt.source = "uri"`.
8. The worker removes the raw uploaded frames after World Labs accepts the request.
9. The Edge Function later removes the hosted MP4 when the World Labs job finishes or fails.
10. The lens polls background status through Supabase.

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
- own the Lens Studio `SupabaseProject` setup
- replace the current photo workflow

Those pieces remain lens-side or Edge Function responsibilities.

## Related Docs

- [`../../README.md`](../../README.md)
- [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
- [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md)
