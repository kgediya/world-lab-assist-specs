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


async def start_video_generation_from_uri(
    api_key: str,
    display_name: str,
    model_name: str,
    video_uri: str,
    text_prompt: str | None = None,
) -> dict[str, Any]:
    world_prompt: dict[str, Any] = {
        "type": "video",
        "video_prompt": {
            "source": "uri",
            "uri": video_uri,
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
