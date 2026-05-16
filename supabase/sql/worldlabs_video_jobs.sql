create table if not exists public.worldlabs_video_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  user_id text,
  status text not null default 'queued',
  api_key text not null,
  model_name text not null,
  fps integer not null,
  frame_count integer not null,
  duration_sec numeric,
  storage_prefix text not null,
  operation_id text,
  world_id text,
  world_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
