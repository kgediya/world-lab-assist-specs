# Contributing

Thanks for contributing to WLAO.

Project creator and maintainer:
- Krunal MB Gediya (Krazyy Krunal)

## Contribution Areas

WLAO currently has three main contribution areas:

- the in-lens Spectacles experience
- the Supabase / Snap Cloud backend flow
- the optional video-worker infrastructure

Try to keep a change scoped to one of those areas unless a broader refactor is clearly worth it.

## Repo Orientation

Start here:
- [`README.md`](./README.md)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
- [`docs/REPO_STRUCTURE.md`](./docs/REPO_STRUCTURE.md)

Key source areas:
- [`lens/`](./lens/)
- [`backend/`](./backend/)
- [`workers/`](./workers/)

## Workflow

1. Work inside the `WLAO` repo only.
2. Keep changes readable and production-minded.
3. Avoid committing local cache, workspace noise, or generated temporary files.
4. Keep secrets and environment-specific assets out of git.
5. Test in Lens Studio preview when possible and on Spectacles when device behavior matters.

## Lens Studio Guidelines

- Prefer editing files under [`lens/Assets/`](./lens/Assets/) and avoid relying on cache output.
- Keep wearable UI copy short, calm, and easy to read.
- Prefer focused script changes over scene-wide churn when possible.
- If you change inspector wiring expectations, document that clearly in the PR.

## Backend Guidelines

- Keep the still-image path stable unless you are intentionally changing active app behavior.
- Treat the video path as an additive scaffold unless you are finishing that feature end to end.
- Document new environment variables and deployment steps whenever you add backend behavior.

## Secrets and Credentials

Never commit:
- `.supabaseProject` files
- `.supabaseProject.meta` files
- `.env` files
- Supabase service-role keys
- raw World Labs API keys

If you discover a committed secret or credential-bearing asset:
1. remove it from the tracked tree
2. rewrite history if needed
3. rotate the credential
4. document the cleanup in the PR

## Pull Requests

Please include:
- a short summary of the user-facing change
- which area changed:
  - lens
  - Edge Function
  - video worker
  - docs
- any required scene wiring or inspector changes
- whether you tested in:
  - Lens Studio preview
  - Spectacles
  - backend only

## Good First Contributions

Useful areas for contributors:
- capture-guidance tuning
- UI and interaction polish
- safer setup/account flows
- background job handling
- video upload path improvements
- deployment documentation
