# Architecture

## Overview

WLAO is organized around three clear layers:

- a wearable Lens Studio client
- Supabase Edge Functions for orchestration
- a Docker FFmpeg worker for heavier media jobs

That split keeps the Spectacles experience responsive while moving expensive work off-device.

## System Layers

### 1. Lens Studio client

Primary location:

- [`../lens/Assets/Scripts/WorldLabs/`](../lens/Assets/Scripts/WorldLabs/)

Responsibilities:

- setup panel and local settings persistence
- capture guidance and UI state
- photo capture flow
- short-video recording flow
- submission triggers
- background polling UX
- capture mode switching through UI callbacks

Key files:

- [`../lens/Assets/Scripts/WorldLabs/WorldLabsController.js`](../lens/Assets/Scripts/WorldLabs/WorldLabsController.js)
- [`../lens/Assets/Scripts/WorldLabs/WorldLabsCameraCapture.js`](../lens/Assets/Scripts/WorldLabs/WorldLabsCameraCapture.js)
- [`../lens/Assets/Scripts/WorldLabs/WorldLabsBackend.js`](../lens/Assets/Scripts/WorldLabs/WorldLabsBackend.js)
- [`../lens/Assets/Scripts/WorldLabs/WorldLabsSetupPanel.js`](../lens/Assets/Scripts/WorldLabs/WorldLabsSetupPanel.js)
- [`../lens/Assets/Scripts/config.js`](../lens/Assets/Scripts/config.js)

### 2. Still-image backend

Primary location:

- [`../backend/supabase/functions/world-labs-assist/`](../backend/supabase/functions/world-labs-assist/)

Responsibilities:

- receive the four-image payload
- upload images to World Labs
- start world generation
- return operation status back to the lens

This is the safe 4-view path.

### 3. Video backend

Primary locations:

- [`../backend/supabase/functions/world-labs-video/`](../backend/supabase/functions/world-labs-video/)
- [`../backend/supabase/sql/`](../backend/supabase/sql/)
- [`../workers/video-worker/`](../workers/video-worker/)

Responsibilities:

- receive uploaded frame batches
- create and track video jobs
- read frame sequences from Supabase Storage
- stitch MP4 with FFmpeg
- upload MP4 to a hosted output bucket
- start video-based world generation from a hosted URI
- clean up temporary frames and hosted output after safe milestones

## Request Flows

### Photo flow

1. The lens captures four wide views.
2. The lens calls `world-labs-assist`.
3. The Edge Function uploads the images to World Labs.
4. The Edge Function starts world generation.
5. The lens returns to idle quickly.
6. The lens polls operation status in the background.

### Video flow

1. The lens records a short frame sequence.
2. The lens uploads frame batches to Supabase Storage through `world-labs-video`.
3. The lens calls `start_video_job`.
4. The Edge Function inserts a job row.
5. The Edge Function triggers the video worker.
6. The worker stitches MP4 with FFmpeg.
7. The worker uploads the MP4 to a public output bucket.
8. The worker starts generation using `video_prompt.source = "uri"`.
9. The worker removes raw frames once World Labs accepts the job.
10. The Edge Function removes the hosted MP4 once the World Labs operation completes or fails.
11. The lens polls job status in the background.

## Snap Cloud Role

Snap Cloud powered by Supabase provides the shared backend surface for this app:

- Postgres for video job tracking
- Storage for frame and MP4 assets
- Edge Functions for orchestration
- Lens Studio project binding through the local `SupabaseProject` asset

Because the `SupabaseProject` asset includes local project credentials and bindings, it is intentionally excluded from git and must be recreated locally by contributors.

## Design Choices

- heavy media work stays out of Supabase Edge Functions
- the lens should be free to begin another scan after submission
- the 4-view photo path stays stable even while video evolves
- local credential-bearing assets stay out of git
- temporary media should be deleted automatically once it is safe

## Current Limits

- local API key persistence is acceptable for prototype use, but not the safest production pattern
- the hosted output bucket is public because World Labs needs to fetch the MP4 by URI
- short-video capture uses sampled preview frames, not native direct MP4 recording

## Related Docs

- [`../README.md`](../README.md)
- [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- [`REPO_STRUCTURE.md`](./REPO_STRUCTURE.md)
- [`../workers/video-worker/README.md`](../workers/video-worker/README.md)
