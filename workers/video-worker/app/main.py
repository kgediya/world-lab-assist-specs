import asyncio

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.worker import process_video_job

app = FastAPI(title="WLAO Video Worker")


class StartVideoJobRequest(BaseModel):
    job_id: str


@app.get("/health")
async def health():
    return {"ok": True}


async def _run_job(job_id: str):
    try:
        await process_video_job(job_id)
    except Exception as error:
        print(f"[video-worker] job {job_id} failed: {error}")


@app.post("/process-video-job")
async def process_job(payload: StartVideoJobRequest):
    try:
        asyncio.create_task(_run_job(payload.job_id))
        return {"ok": True, "job_id": payload.job_id, "status": "accepted"}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
