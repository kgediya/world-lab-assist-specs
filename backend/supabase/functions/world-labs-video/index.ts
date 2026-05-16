// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEFAULT_WORLDLABS_API_KEY = Deno.env.get("WORLDLABS_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VIDEO_WORKER_URL = Deno.env.get("VIDEO_WORKER_URL") || "";
const INPUT_BUCKET = Deno.env.get("INPUT_BUCKET") || "worldlabs-video-input";
const OUTPUT_BUCKET = Deno.env.get("OUTPUT_BUCKET") || "worldlabs-video-output";
const WORLDLABS_BASE_URL = "https://api.worldlabs.ai";

interface UploadVideoFrame {
  fileName: string;
  mimeType?: string;
  base64Data: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function resolveApiKey(payload?: { apiKey?: string }) {
  const payloadKey = (payload?.apiKey || "").trim();
  return payloadKey || DEFAULT_WORLDLABS_API_KEY;
}

function decodeBase64(base64: string) {
  const clean = base64.includes(",") ? base64.split(",").pop() || "" : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getAdminHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function worldlabsRequest(apiKey: string, path: string, method: string, body?: unknown) {
  if (!apiKey) {
    throw new Error("Missing World Labs API key");
  }

  const response = await fetch(`${WORLDLABS_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `World Labs ${method} ${path} failed: ${response.status} ${await response.text()}`,
    );
  }

  return await response.json();
}

async function insertVideoJob(payload: any, apiKey: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/worldlabs_video_jobs`, {
    method: "POST",
    headers: {
      ...getAdminHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify([
      {
        session_id: payload.sessionId,
        user_id: payload.userId || null,
        status: "queued",
        api_key: apiKey,
        model_name: payload.modelName || "Marble 0.1-mini",
        fps: payload.fps,
        frame_count: payload.frameCount,
        duration_sec: payload.durationSec || null,
        storage_prefix: payload.storagePrefix,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create video job: ${response.status} ${await response.text()}`,
    );
  }

  const rows = await response.json();
  return rows[0];
}

async function uploadFrameToStorage(
  storagePrefix: string,
  frame: UploadVideoFrame,
) {
  const objectPath = `${storagePrefix}/frames/${frame.fileName}`;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${INPUT_BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": frame.mimeType || "image/jpeg",
        "x-upsert": "true",
      },
      body: decodeBase64(frame.base64Data),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to upload video frame ${frame.fileName}: ${response.status} ${await response.text()}`,
    );
  }

  return objectPath;
}

async function getVideoJobById(jobId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/worldlabs_video_jobs?id=eq.${encodeURIComponent(jobId)}&select=*`,
    {
      method: "GET",
      headers: getAdminHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load video job: ${response.status} ${await response.text()}`,
    );
  }

  const rows = await response.json();
  return rows[0] || null;
}

async function updateVideoJob(jobId: string, patch: Record<string, unknown>) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/worldlabs_video_jobs?id=eq.${encodeURIComponent(jobId)}`,
    {
      method: "PATCH",
      headers: {
        ...getAdminHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to update video job: ${response.status} ${await response.text()}`,
    );
  }

  const rows = await response.json();
  return rows[0] || null;
}

async function triggerWorker(jobId: string) {
  const response = await fetch(`${VIDEO_WORKER_URL}/process-video-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!response.ok) {
    throw new Error(
      `Video worker rejected job: ${response.status} ${await response.text()}`,
    );
  }
}

async function deleteStorageObjects(bucket: string, paths: string[]) {
  const validPaths = paths.filter(Boolean);
  if (!validPaths.length) {
    return;
  }

  for (const path of validPaths) {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Failed to delete storage object ${path} from ${bucket}: ${response.status} ${await response.text()}`,
      );
    }
  }
}

async function cleanupVideoArtifacts(job: any) {
  const outputPath = `video-sessions/${job.session_id}/${job.session_id}.mp4`;

  try {
    await deleteStorageObjects(OUTPUT_BUCKET, [outputPath]);
  } catch (error) {
    console.error("cleanup output video failed", error);
  }
}

async function syncJobWithWorldLabs(job: any) {
  if (!job?.operation_id || !job?.api_key) {
    return job;
  }

  const operation = await worldlabsRequest(
    job.api_key,
    `/marble/v1/operations/${job.operation_id}`,
    "GET",
  );

  const worldId =
    operation?.metadata?.world_id ||
    operation?.response?.id ||
    job.world_id ||
    null;

  if (!operation?.done) {
    return await updateVideoJob(job.id, {
      status: "polling_worldlabs",
      world_id: worldId,
    });
  }

  if (operation?.error) {
    const failedJob = await updateVideoJob(job.id, {
      status: "failed",
      world_id: worldId,
      error_message: JSON.stringify(operation.error),
    });
    await cleanupVideoArtifacts(job);
    return failedJob;
  }

  let worldUrl = job.world_url || null;
  if (worldId) {
    const worldResponse = await worldlabsRequest(
      job.api_key,
      `/marble/v1/worlds/${worldId}`,
      "GET",
    );
    worldUrl =
      worldResponse?.world?.world_marble_url ||
      operation?.response?.world_marble_url ||
      worldUrl;
  }

  const completedJob = await updateVideoJob(job.id, {
    status: "completed",
    world_id: worldId,
    world_url: worldUrl,
    error_message: null,
  });
  await cleanupVideoArtifacts(job);
  return completedJob;
}

async function handleStartVideoJob(payload: any) {
  const apiKey = resolveApiKey(payload);

  if (!apiKey) {
    return json({ error: "Missing World Labs API key" }, 400);
  }

  if (!payload.sessionId || !payload.frameCount || !payload.fps || !payload.storagePrefix) {
    return json({ error: "Missing video job fields" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VIDEO_WORKER_URL) {
    return json({ error: "Missing video backend environment configuration" }, 500);
  }

  const job = await insertVideoJob(payload, apiKey);
  await triggerWorker(job.id);

  return json({
    ok: true,
    jobId: job.id,
    sessionId: payload.sessionId,
    status: job.status,
    message: "Video job started",
  });
}

async function handleUploadVideoFrames(payload: any) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing Supabase admin environment configuration" }, 500);
  }

  if (!payload.sessionId || !payload.storagePrefix || !payload.frames?.length) {
    return json({ error: "Missing video frame upload fields" }, 400);
  }

  const uploadedPaths = [];
  for (const frame of payload.frames as UploadVideoFrame[]) {
    if (!frame?.fileName || !frame?.base64Data) {
      return json({ error: "Each frame needs fileName and base64Data" }, 400);
    }
    uploadedPaths.push(await uploadFrameToStorage(payload.storagePrefix, frame));
  }

  return json({
    ok: true,
    sessionId: payload.sessionId,
    uploadedCount: uploadedPaths.length,
    storagePrefix: payload.storagePrefix,
    uploadedPaths,
  });
}

async function handleGetVideoJob(payload: any) {
  if (!payload.jobId) {
    return json({ error: "Missing jobId" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing Supabase admin environment configuration" }, 500);
  }

  let job = await getVideoJobById(payload.jobId);
  if (!job) {
    return json({ error: "Video job not found" }, 404);
  }

  if (job.status === "polling_worldlabs" && job.operation_id && job.api_key) {
    job = await syncJobWithWorldLabs(job);
  }

  return json({
    ok: true,
    jobId: job.id,
    sessionId: job.session_id,
    status: job.status,
    operationId: job.operation_id || null,
    worldId: job.world_id || null,
    worldUrl: job.world_url || null,
    videoUrl: job.video_url || null,
    errorMessage: job.error_message || null,
    updatedAt: job.updated_at,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  try {
    const payload = await req.json();

    if (payload.action === "upload_video_frames") {
      return await handleUploadVideoFrames(payload);
    }

    if (payload.action === "start_video_job") {
      return await handleStartVideoJob(payload);
    }

    if (payload.action === "get_video_job") {
      return await handleGetVideoJob(payload);
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("world-labs-video error", error);
    return json({ error: String(error) }, 500);
  }
});
