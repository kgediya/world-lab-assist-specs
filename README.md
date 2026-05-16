# WLAO

WLAO is an open-source Spectacles + Lens Studio app for turning real spaces into World Labs Marble worlds.

Created by Krunal MB Gediya, also known as Krazyy Krunal.

## Overview

WLAO is structured as a multi-part open-source project:

- [`lens/`](./lens/) contains the wearable Spectacles app
- [`backend/`](./backend/) contains Supabase Edge Functions and SQL
- [`workers/`](./workers/) contains deployable backend workers
- [`docs/`](./docs/) contains architecture and deployment guides

The app supports two capture paths:

- `Photo Mode`: the proven 4 wide views flow
- `Video Mode`: a short recorded clip that uploads frames, stitches an MP4 through the worker, and starts a World Labs video job

## Current App Flow

1. Open [`lens/WLAO.esproj`](./lens/WLAO.esproj) in Lens Studio.
2. If no World Labs API key is configured, the setup panel opens first.
3. Enter the API key and choose a model:
   - `Mini` -> `Marble 0.1-mini`
   - `Pro` -> `Marble 0.1-plus`
4. Choose a capture mode:
   - `Photo Mode` for four wide views
   - `Video Mode` for a short recorded spatial clip
5. Capture the scan.
6. Submit the scan.
7. The app uploads through Snap Cloud / Supabase to World Labs.
8. The lens returns to idle quickly so the next scan can begin.
9. Generation continues in the background.
10. When finished, the world becomes available in Marble.

## Project Structure

- [`lens/`](./lens/)
  Lens Studio project files, scene assets, scripts, UI assets, and project support files.
- [`backend/supabase/functions/world-labs-assist/`](./backend/supabase/functions/world-labs-assist/)
  The active still-image Edge Function.
- [`backend/supabase/functions/world-labs-video/`](./backend/supabase/functions/world-labs-video/)
  Video-job orchestration Edge Function.
- [`backend/supabase/sql/`](./backend/supabase/sql/)
  SQL used by backend features such as the video jobs table and Storage setup.
- [`workers/video-worker/`](./workers/video-worker/)
  Deployable Docker-based FFmpeg worker for the video-generation path.
- [`docs/`](./docs/)
  Architecture, deployment, and repo-structure notes.

## Core Lens Scripts

- [`lens/Assets/Scripts/config.js`](./lens/Assets/Scripts/config.js)
  Project-level defaults and backend function names.
- [`lens/Assets/Scripts/WorldLabs/WorldLabsController.js`](./lens/Assets/Scripts/WorldLabs/WorldLabsController.js)
  Main app state machine, UI flow, and photo/video mode switching.
- [`lens/Assets/Scripts/WorldLabs/WorldLabsCameraCapture.js`](./lens/Assets/Scripts/WorldLabs/WorldLabsCameraCapture.js)
  Camera capture logic, heading anchoring, preview/device behavior, and short-video frame recording.
- [`lens/Assets/Scripts/WorldLabs/WorldLabsBackend.js`](./lens/Assets/Scripts/WorldLabs/WorldLabsBackend.js)
  Lens-side submission, frame upload, and background polling transport.
- [`lens/Assets/Scripts/WorldLabs/WorldLabsSetupPanel.js`](./lens/Assets/Scripts/WorldLabs/WorldLabsSetupPanel.js)
  API key + model settings flow with local persistence.

## Backend Paths

### Still-image path

This is the safe 4 wide views path:

1. capture four images
2. send them to `world-labs-assist`
3. upload them to World Labs
4. start generation
5. poll status in the background

### Video path

This is the short-video path:

1. record a short clip as sampled frames in the lens
2. upload frame batches to Supabase Storage through `world-labs-video`
3. create a tracked job row
4. trigger the Docker FFmpeg worker
5. stitch MP4
6. upload the MP4 to a public output bucket
7. start generation from the hosted video URI
8. remove raw frames after World Labs accepts the job
9. remove the hosted MP4 after the World Labs operation completes or fails

## Lens Setup

1. Open [`lens/WLAO.esproj`](./lens/WLAO.esproj) in Lens Studio.
2. Make sure the project is configured for Spectacles.
3. Assign required scene references for:
   - `WorldLabsController`
   - `WorldLabsCameraCapture`
   - `WorldLabsBackend`
   - `WorldLabsSetupPanel`
4. Assign required Snap resources:
   - `InternetModule`
   - your local `SupabaseProject` asset
5. Verify [`lens/Assets/Scripts/config.js`](./lens/Assets/Scripts/config.js) matches your backend deployment.
6. For UI mode switching, wire a button callback to one of:
   - `setPhotoMode()`
   - `setVideoMode()`
   - `toggleCaptureMode()`

## Snap Cloud / Supabase Setup

Because this repo intentionally does **not** commit credential-bearing project assets, contributors need to create local Snap Cloud / Supabase bindings themselves.

### What Snap Cloud gives this project

Snap Cloud, powered by Supabase, is used here for:

- Edge Functions
- Storage buckets
- job tracking in Postgres
- authenticated project configuration through Lens Studio

### Local setup steps

1. Make sure you have access to Snap Cloud for Spectacles projects.
2. In Lens Studio, install and use the Supabase Plugin.
3. Create or connect a Snap Cloud backend for this lens.
4. Generate the local `SupabaseProject` asset in Lens Studio.
5. Assign that asset to [`WorldLabsBackend.js`](./lens/Assets/Scripts/WorldLabs/WorldLabsBackend.js).
6. Assign an `InternetModule` asset in the same scene.
7. Deploy the Edge Functions from [`backend/supabase/functions/`](./backend/supabase/functions/).
8. Create the required Storage buckets:
   - `worldlabs-video-input`
   - `worldlabs-video-output`
9. Keep the generated `.supabaseProject` asset out of git.

This local project asset is required because the lens needs:

- the Snap Cloud project URL
- the public anon token
- a valid Lens Studio project binding for backend calls

See also:

- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
- [`lens/README.md`](./lens/README.md)
- [`backend/README.md`](./backend/README.md)

## Storage Cleanup

The video path automatically cleans up temporary media for efficiency:

- raw uploaded frames are removed after World Labs accepts the video generation job
- the hosted stitched MP4 is removed after the World Labs operation completes or fails

## Billing Note

World Labs subscription access and World Labs API billing are different.

If generation fails with something like:

- `402 Insufficient credits for model ...`

that usually means:

- the API key is valid
- the request reached World Labs
- API credits or billable access for that model are not currently available

## Secrets and Local Assets

This repo is set up to avoid committing local credential-bearing assets.

Keep local only:

- `.supabaseProject`
- `.supabaseProject.meta`
- `.env` files
- Supabase service-role keys
- raw World Labs API keys

The repo `.gitignore` already blocks these patterns, but contributors should still sanity-check staged files.

## Preview vs Spectacles

Lens Studio preview is useful for:

- UI iteration
- state-machine checks
- callback wiring

Actual Spectacles are required for:

- real still-image capture behavior
- true device quality
- realistic end-to-end validation

## Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
- [`docs/REPO_STRUCTURE.md`](./docs/REPO_STRUCTURE.md)
- [`workers/video-worker/README.md`](./workers/video-worker/README.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`SECURITY.md`](./SECURITY.md)
- [`SUPPORT.md`](./SUPPORT.md)

## Tech Stack Documentation

### Snap / Lens Studio / Spectacles

- Lens scripting API overview: https://developers.snap.com/lens-studio/api/lens-scripting/
- Lens Studio source control guidance: https://developers.snap.com/lens-studio/4.55.1/references/guides/general/source-control
- Spectacles Camera Module guide: https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module
- `CameraModule` API: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.CameraModule.html
- `CameraRequest` API: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.CameraModule.CameraRequest.html
- `ImageRequest` API: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.CameraModule.ImageRequest.html
- Internet access guide: https://developers.snap.com/spectacles/about-spectacles-features/apis/internet-access
- `InternetModule` API: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.InternetModule.html?lang=en-US
- `RemoteServiceHttpRequest` API: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.RemoteServiceHttpRequest.html
- `RemoteServiceHttpResponse` API: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.RemoteServiceHttpResponse.html
- Spectacles UIKit `TextInputField`: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Packages_SpectaclesUIKit_Scripts_Components_TextInputField_TextInputField.TextInputField.html
- Spectacles UIKit `ToggleGroup`: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Packages_SpectaclesUIKit_Scripts_Components_Toggle_ToggleGroup.ToggleGroup
- Spectacles UIKit `CapsuleButton`: https://developers.snap.com/lens-studio/api/lens-scripting/classes/Packages_SpectaclesUIKit_Scripts_Components_Button_CapsuleButton.CapsuleButton

### Snap Cloud / Supabase

- Snap Cloud overview: https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/overview
- Snap Cloud getting started: https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/getting-started
- Supabase Edge Functions overview: https://supabase.com/docs/guides/functions
- Supabase Edge Functions quickstart: https://supabase.com/docs/guides/functions/quickstart
- Supabase Edge Functions architecture: https://supabase.com/docs/guides/functions/architecture
- Supabase Edge Functions limits: https://supabase.com/docs/guides/functions/limits
- Supabase Edge Function routing / HTTP methods: https://supabase.com/docs/guides/functions/http-methods
- Supabase Storage overview: https://supabase.com/docs/guides/storage

### World Labs / Marble

- World Labs API quickstart: https://docs.worldlabs.ai/api
- World Labs API FAQ: https://docs.worldlabs.ai/api/faq
- World Labs API pricing: https://docs.worldlabs.ai/api/pricing
- World Labs media upload reference: https://docs.worldlabs.ai/api/reference/media-assets/prepare-upload
- World Labs get operation: https://docs.worldlabs.ai/api/reference/operations/get
- World Labs get world: https://docs.worldlabs.ai/api/reference/worlds/get
- World Labs generate world: https://docs.worldlabs.ai/api/reference/worlds/generate

## Contributing and Support

- Contribution guidelines: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Community expectations: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- Security reporting: [`SECURITY.md`](./SECURITY.md)
- Support notes: [`SUPPORT.md`](./SUPPORT.md)

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE) for details.
