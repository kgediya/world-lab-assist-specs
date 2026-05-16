import os
from typing import Any

from supabase import Client, create_client


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = require_env("SUPABASE_SERVICE_ROLE_KEY")
INPUT_BUCKET = os.environ.get("INPUT_BUCKET", "worldlabs-video-input").strip() or "worldlabs-video-input"
OUTPUT_BUCKET = os.environ.get("OUTPUT_BUCKET", "worldlabs-video-output").strip() or "worldlabs-video-output"

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


def delete_input_frames(paths: list[str]) -> None:
    if not paths:
        return
    supabase.storage.from_(INPUT_BUCKET).remove(paths)


def upload_output_video(path: str, video_bytes: bytes, content_type: str = "video/mp4") -> None:
    supabase.storage.from_(OUTPUT_BUCKET).upload(
        path,
        video_bytes,
        file_options={
            "content-type": content_type,
            "upsert": "true",
        },
    )


def get_public_video_url(path: str) -> str:
    response = supabase.storage.from_(OUTPUT_BUCKET).get_public_url(path)

    if isinstance(response, str):
        return response

    if isinstance(response, dict):
        public_url = response.get("publicUrl") or response.get("publicURL")
        if public_url:
            return str(public_url)

    if hasattr(response, "get"):
        public_url = response.get("publicUrl") or response.get("publicURL")
        if public_url:
            return str(public_url)

    raise RuntimeError("Could not resolve public URL for uploaded video")


def delete_output_video(path: str) -> None:
    if not path:
        return
    supabase.storage.from_(OUTPUT_BUCKET).remove([path])
