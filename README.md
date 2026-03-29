# WLAO

WLAO is a Spectacles + Lens Studio prototype that helps a wearer scan a real space, send four wide views to World Labs, and generate a Marble world from that capture.

Created by Krunal MB Gediya, also known as Krazyy Krunal.

The current experience is intentionally focused:
- configure World Labs once in-lens
- capture four strong environmental views in any order
- submit to Snap Cloud / Supabase
- hand off to Marble when the world is ready

## Current Flow

1. The wearer opens the lens.
2. If no World Labs API key is configured, the setup panel appears first.
3. The user enters their World Labs API key and chooses a model:
   - `Mini` -> `Marble 0.1-mini`
   - `Pro` -> `Marble 0.1-plus`
4. The lens guides the wearer to capture four wide views of the space in any order.
5. The lens sends those views to the `world-labs-assist` Edge Function on Snap Cloud / Supabase.
6. The Edge Function uploads the images to World Labs, starts world generation, and polls operation status.
7. The completed world is handed off to Marble for viewing.

## Architecture

### In-Lens

- `Assets/Scripts/config.js`
  Central project defaults for Supabase URLs, function names, and model labels.
- `Assets/Scripts/WorldLabs/WorldLabsController.js`
  The main state machine for scan flow, button visibility, UI messaging, and submission.
- `Assets/Scripts/WorldLabs/WorldLabsCameraCapture.js`
  Heading-anchored capture logic, guidance, still-image capture on Spectacles, and preview fallback in Lens Studio.
- `Assets/Scripts/WorldLabs/WorldLabsBackend.js`
  Lens-side transport layer for calling the Edge Function and polling generation status.
- `Assets/Scripts/WorldLabs/WorldLabsSetupPanel.js`
  Setup flow for API key entry, model selection, local persistence, and main-menu gating.

### Snap Cloud / Supabase

- `supabase/functions/world-labs-assist/index.ts`
  Local reference copy of the Edge Function used by the lens flow. This is included so contributors can see exactly what payload the lens expects and what the deployed backend should be doing.

The Edge Function currently:
- accepts `start` and `status` actions
- uses the user-provided `apiKey` when supplied by the lens
- uploads up to four captured images as World Labs media assets
- starts a `multi-image` world generation request
- polls operation status and returns the resulting Marble world URL

## Setup

1. Open `WLAO` in Lens Studio.
2. Make sure the project is configured for Spectacles.
3. Assign the required scene references in the inspector for:
   - `WorldLabsController`
   - `WorldLabsCameraCapture`
   - `WorldLabsBackend`
   - `WorldLabsSetupPanel`
4. Assign the required Snap assets such as:
   - `InternetModule`
   - `SupabaseProject`
5. Verify `Assets/Scripts/config.js` matches your Snap Cloud / Supabase deployment.
6. Deploy or update the `world-labs-assist` Edge Function using the local reference copy in `supabase/functions/world-labs-assist/index.ts`.

## Setup Panel Notes

- If the API key is missing, the setup panel is shown before the user can scan.
- `DONE` is disabled until a non-empty API key is entered.
- The selected API key and model are persisted locally on-device for prototype convenience.
- The settings button can reopen the panel later so the user can change their key or switch between `Mini` and `Pro`.

## Preview vs Spectacles

- Lens Studio preview uses the live preview texture as a fallback because `requestImage()` is not supported in editor preview.
- On actual Spectacles, the project uses higher-quality still image capture for accepted views.

Use preview for:
- UI iteration
- state machine checks
- callback wiring

Use Spectacles for:
- actual capture quality
- real still-image behavior
- end-to-end submission validation

## Future Improvements

### Video Upload Path

The current prototype uses four curated still images because it is the smallest reliable architecture for a prototype.

A likely next-generation flow is:
- capture a short guided video instead of four stills
- upload the recorded video as a World Labs media asset
- call the World Labs `video` generation path instead of `multi-image`

Why this is attractive:
- it matches natural head-turn behavior better
- it gives World Labs richer spatial input
- it reduces the "pick four moments" constraint

What is not in scope yet:
- FFmpeg conversion inside the current Edge Function
- panorama stitching inside the current Lens Studio flow

Those paths are possible later, but the current prototype intentionally stays lightweight and cheap to operate.

## Prototype Notes

- API keys are persisted locally on-device in this prototype.
- For a production release, a server-side saved-key or session-token flow would be safer than local secret persistence.
- The included Edge Function file is a local reference copy and should be kept in sync with the deployed Snap Cloud / Supabase backend.

## Contributing and Support

- Contribution guidelines: `CONTRIBUTING.md`
- Community expectations: `CODE_OF_CONDUCT.md`
- Security reporting: `SECURITY.md`
- Support notes: `SUPPORT.md`

## Source Control

This repository follows Snap's Lens Studio source-control guidance:
- ignore caches and user-specific artifacts
- keep actual project content under version control
- keep the root `.gitignore` as the main ignore file for the repo

Reference:
- Snap Lens Studio source control guidance: https://developers.snap.com/lens-studio/lens-studio-workflow/advanced/source-control

## License

This project is licensed under the MIT License. See `LICENSE` for details.

