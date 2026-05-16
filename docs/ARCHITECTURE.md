# Architecture

## Overview

WLAO is organized around three clear layers:

- a wearable Lens Studio client
- Supabase Edge Functions for orchestration
- an optional Docker FFmpeg worker for heavier media jobs

That split keeps the Spectacles experience responsive while moving expensive work off-device.

## System Layers

### 1. Lens Studio client

Primary location:
- [`../lens/Assets/Scripts/WorldLabs/`](../lens/Assets/Scripts/WorldLabs/)

Responsibilities:
- setup panel and local settings persistence
- capture guidance and UI state
- image capture flow
- submission triggers
- background polling UX

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

This is the active production path in the current app.

### 3. Video backend scaffold

Primary locations:
- [`../backend/supabase/functions/world-labs-video/`](../backend/supabase/functions/world-labs-video/)
- [`../backend/supabase/sql/`](../backend/supabase/sql/)
- [`../workers/video-worker/`](../workers/video-worker/)

Responsibilities:
- create and track video jobs
- read uploaded frame sequences
- stitch MP4 with FFmpeg
- upload MP4 to World Labs
- start video-based world generation

This path is scaffolded and deployable on the backend side, but not fully wired into the lens yet.

## Request Flows

### Still-image flow

1. The lens captures four wide views.
2. The lens calls `world-labs-assist`.
3. The Edge Function uploads the images to World Labs.
4. The Edge Function starts world generation.
5. The lens returns to idle quickly.
6. The lens polls operation status in the background.

### Video flow

1. The lens records a short frame sequence.
2. The lens uploads frames to Supabase Storage.
3. The lens calls `world-labs-video`.
4. The Edge Function inserts a job row.
5. The Edge Function triggers the video worker.
6. The worker stitches MP4 with FFmpeg.
7. The worker uploads the MP4 to World Labs.
8. The worker starts generation and updates job state.
9. The lens polls job status in the background.

## Design Choices

- heavy media work stays out of Supabase Edge Functions
- the lens should be free to begin another scan after submission
- the still-image path stays stable even while the video path evolves
- local credential-bearing assets stay out of git

## Current Limits

- the still-image flow is the only fully wired end-to-end lens path today
- the video worker is backend-ready, not lens-complete
- local API key persistence is acceptable for prototype use, but not the safest production pattern

## Related Docs

- [`../README.md`](../README.md)
- [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- [`REPO_STRUCTURE.md`](./REPO_STRUCTURE.md)
- [`../workers/video-worker/README.md`](../workers/video-worker/README.md)
