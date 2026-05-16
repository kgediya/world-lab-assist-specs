import os
from typing import Any

import httpx

WORLDLABS_BASE_URL = os.environ.get("WORLDLABS_BASE_URL", "https://api.worldlabs.ai")


async def worldlabs_request(api_key: str, path: str, method: str, body: Any = None) -> dict[str, Any]:
    if not api_key:
        raise Exception("Missing World Labs API key")

    headers = {
        "Content-Type": "application/json",
        "WLT-Api-Key": api_key,
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.request(
            method,
            f"{WORLDLABS_BASE_URL}{path}",
            headers=headers,
            json=body,
        )
        if response.status_code >= 400:
            raise Exception(
                f"World Labs {method} {path} failed: {response.status_code} {response.text}"
            )
        return response.json()


async def prepare_and_upload_video(api_key: str, file_name: str, video_bytes: bytes) -> str:
    prepared = await worldlabs_request(
        api_key,
        "/marble/v1/media-assets:prepare_upload",
        "POST",
        {
            "file_name": file_name,
            "kind": "video",
            "extension": "mp4",
        },
    )

    upload_info = prepared["upload_info"]
    upload_url = upload_info["upload_url"]
    upload_method = upload_info.get("upload_method", "PUT")
    required_headers = upload_info.get("required_headers", {})
    media_asset = prepared["media_asset"]
    media_asset_id = media_asset.get("media_asset_id") or media_asset.get("id")

    if not media_asset_id:
        raise Exception("prepare_upload did not return a media asset id")

    async with httpx.AsyncClient(timeout=600.0) as client:
        response = await client.request(
            upload_method,
            upload_url,
            headers={
                **required_headers,
                "Content-Type": "video/mp4",
            },
            content=video_bytes,
        )
        if response.status_code >= 400:
            raise Exception(f"Signed upload failed: {response.status_code} {response.text}")

    return media_asset_id


async def start_video_generation(
    api_key: str,
    display_name: str,
    model_name: str,
    media_asset_id: str,
    text_prompt: str | None = None,
) -> dict[str, Any]:
    world_prompt: dict[str, Any] = {
        "type": "video",
        "video_prompt": {
            "content": {
                "source": "media_asset",
                "media_asset_id": media_asset_id,
            }
        },
    }

    if text_prompt:
        world_prompt["text_prompt"] = text_prompt

    return await worldlabs_request(
        api_key,
        "/marble/v1/worlds:generate",
        "POST",
        {
            "display_name": display_name,
            "model": model_name,
            "world_prompt": world_prompt,
        },
    )
