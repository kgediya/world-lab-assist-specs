import asyncio
import tempfile
from pathlib import Path

from app.storage import (
    download_frame,
    get_job,
    get_public_video_url,
    list_frame_paths,
    update_job,
    upload_output_video,
)
from app.worldlabs import start_video_generation_from_uri


async def process_video_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise Exception("Video job not found")

    update_job(job_id, {"status": "assembling_video", "error_message": None})

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        frame_paths = list_frame_paths(job["storage_prefix"], int(job["frame_count"]))

        for index, storage_path in enumerate(frame_paths, start=1):
            frame_bytes = download_frame(storage_path)
            (temp_path / f"{index:06d}.jpg").write_bytes(frame_bytes)

        output_path = temp_path / "out.mp4"

        ffmpeg_args = [
            "ffmpeg",
            "-y",
            "-framerate",
            str(job["fps"]),
            "-i",
            str(temp_path / "%06d.jpg"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ]

        process = await asyncio.create_subprocess_exec(
            *ffmpeg_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()

        if process.returncode != 0:
            update_job(
                job_id,
                {
                    "status": "failed",
                    "error_message": stderr.decode("utf-8", errors="ignore"),
                },
            )
            raise Exception("FFmpeg stitching failed")

        update_job(job_id, {"status": "uploading_video"})

        video_bytes = output_path.read_bytes()
        output_storage_path = f"video-sessions/{job['session_id']}/{job['session_id']}.mp4"
        upload_output_video(output_storage_path, video_bytes)
        video_url = get_public_video_url(output_storage_path)

        update_job(
            job_id,
            {
                "status": "generating_world",
                "video_url": video_url,
            },
        )

        operation = await start_video_generation_from_uri(
            job["api_key"],
            "World Labs Assist Video Capture",
            job["model_name"],
            video_url,
        )

        operation_id = operation["operation_id"]
        update_job(
            job_id,
            {
                "status": "polling_worldlabs",
                "operation_id": operation_id,
            },
        )

        return {
            "job_id": job_id,
            "operation_id": operation_id,
            "video_url": video_url,
        }
