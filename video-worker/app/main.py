from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.worker import process_video_job

app = FastAPI(title="WLAO Video Worker")


class StartVideoJobRequest(BaseModel):
    job_id: str


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/process-video-job")
async def process_job(payload: StartVideoJobRequest):
    try:
        result = await process_video_job(payload.job_id)
        return {"ok": True, "result": result}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
