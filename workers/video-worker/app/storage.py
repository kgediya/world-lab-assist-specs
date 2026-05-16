import os
from typing import Any

from supabase import Client, create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
INPUT_BUCKET = os.environ.get("INPUT_BUCKET", "worldlabs-video-input")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_job(job_id: str) -> dict[str, Any] | None:
    response = (
        supabase.table("worldlabs_video_jobs")
        .select("*")
        .eq("id", job_id)
        .single()
        .execute()
    )
    return response.data


def update_job(job_id: str, patch: dict[str, Any]) -> None:
    supabase.table("worldlabs_video_jobs").update(patch).eq("id", job_id).execute()


def list_frame_paths(storage_prefix: str, frame_count: int) -> list[str]:
    return [
        f"{storage_prefix}/frames/{index:06d}.jpg"
        for index in range(1, frame_count + 1)
    ]


def download_frame(path: str) -> bytes:
    return supabase.storage.from_(INPUT_BUCKET).download(path)
