# Security Policy

## Reporting a Vulnerability

If you discover a security issue, please avoid opening a public issue with sensitive details.

Report it privately to the project maintainer with:
- a description of the issue
- steps to reproduce it
- potential impact
- any suggested mitigation

## Security Priorities For WLAO

WLAO mixes:
- wearable client code
- Supabase / Snap Cloud infrastructure
- optional server-side video processing
- user-supplied World Labs API keys

The most important risk areas are:
- accidental secret commits
- token exposure through Lens Studio project assets
- overly permissive backend environment configuration
- leaving leaked credentials active after cleanup

## Secrets Policy

Never commit:
- `.supabaseProject` files
- `.supabaseProject.meta` files
- `.env` files
- Supabase service-role credentials
- raw World Labs API keys
- ad-hoc text files containing tokens or keys

The repo `.gitignore` reduces this risk, but contributors should still verify staged files manually.

## If A Credential Was Committed

If a credential or credential-bearing asset was ever committed:
1. remove it from the current tree
2. rewrite git history if necessary
3. rotate the affected credential
4. confirm the remote repo no longer exposes the artifact

## Prototype-Specific Notes

- The lens currently supports local persistence of a user-provided World Labs API key for prototype convenience.
- For a production deployment, server-side saved-key or session-token patterns are safer than local persistence.
- The optional video worker uses Supabase admin credentials server-side and should be deployed carefully.

## Repo Hygiene Reminder

Especially for Lens Studio projects, be careful with:
- `.supabaseProject` assets
- workspace files that may include local paths
- copied terminal output containing tokens
- temporary backend config files added during deployment
