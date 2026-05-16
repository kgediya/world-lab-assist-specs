# Lens

This folder contains the Lens Studio project for WLAO.

Open:

- [`WLAO.esproj`](./WLAO.esproj)

Main source areas:

- [`Assets/`](./Assets/)
- [`Packages/`](./Packages/)
- [`Support/`](./Support/)

Primary app scripts:

- [`Assets/Scripts/WorldLabs/`](./Assets/Scripts/WorldLabs/)

## Local Snap Cloud Setup

This repo does not include committed Snap Cloud project assets.

Before the lens will work against your backend, create and assign these locally in Lens Studio:

- a `SupabaseProject` asset generated through the Snap Cloud / Supabase Plugin
- an `InternetModule` asset

Assign them to:

- [`Assets/Scripts/WorldLabs/WorldLabsBackend.js`](./Assets/Scripts/WorldLabs/WorldLabsBackend.js)

The local `SupabaseProject` asset is required because it provides:

- the Snap Cloud project URL
- the public anon token
- the Lens Studio binding to your backend project

Do not commit:

- `.supabaseProject`
- `.supabaseProject.meta`

## Capture Mode UI

The controller supports UI-callable mode switching:

- `setPhotoMode()`
- `setVideoMode()`
- `toggleCaptureMode()`

Attach those to your UI buttons on:

- [`Assets/Scripts/WorldLabs/WorldLabsController.js`](./Assets/Scripts/WorldLabs/WorldLabsController.js)

For repo-level architecture and deployment notes, go back to:

- [`../README.md`](../README.md)
- [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
