# Support

For help with WLAO, start with:
- [README.md](/d:/Workspace/Lens%20Studio/Spectacles/WLAO/README.md)
- [docs/ARCHITECTURE.md](/d:/Workspace/Lens%20Studio/Spectacles/WLAO/docs/ARCHITECTURE.md)
- [docs/DEPLOYMENT.md](/d:/Workspace/Lens%20Studio/Spectacles/WLAO/docs/DEPLOYMENT.md)
- [docs/REPO_STRUCTURE.md](/d:/Workspace/Lens%20Studio/Spectacles/WLAO/docs/REPO_STRUCTURE.md)
- [video-worker/README.md](/d:/Workspace/Lens%20Studio/Spectacles/WLAO/video-worker/README.md)

## Common Troubleshooting Areas

### Lens setup

Check:
- required inspector references are assigned
- `InternetModule` is assigned
- the local `SupabaseProject` asset is assigned correctly
- the setup panel saved the expected World Labs API key and model

### Generation issues

Check:
- the World Labs API key is valid
- the selected model is supported by the account
- World Labs API credits are available
- the deployed Edge Function matches the local reference copy

### Background submission issues

Check:
- the lens can reach the correct Supabase function URL
- the app returns to idle after submit
- the Edge Function returns an operation id successfully
- later polling requests use the same expected API key context

### Video path issues

Check:
- the Supabase Storage bucket exists
- the SQL table from `supabase/sql/worldlabs_video_jobs.sql` exists
- `world-labs-video` is deployed
- `VIDEO_WORKER_URL` is set
- the worker `/health` endpoint responds
- FFmpeg container logs are healthy

### Preview vs device issues

Remember:
- Lens Studio preview is useful for UI and state-flow validation
- Spectacles are required for real device capture behavior

## If You Need To File An Issue

Helpful details include:
- what you were trying to do
- which path failed:
  - still-image flow
  - setup flow
  - background submission
  - video worker
- exact error text
- whether the problem happened in preview or on Spectacles

For security-sensitive issues, use [SECURITY.md](/d:/Workspace/Lens%20Studio/Spectacles/WLAO/SECURITY.md) instead of posting sensitive details publicly.
