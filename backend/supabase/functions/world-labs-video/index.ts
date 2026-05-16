// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEFAULT_WORLDLABS_API_KEY = Deno.env.get("WORLDLABS_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VIDEO_WORKER_URL = Deno.env.get("VIDEO_WORKER_URL") || "";
const WORLDLABS_BASE_URL = "https://api.worldlabs.ai";

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
    return await updateVideoJob(job.id, {
      status: "failed",
      world_id: worldId,
      error_message: JSON.stringify(operation.error),
    });
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

  return await updateVideoJob(job.id, {
    status: "completed",
    world_id: worldId,
    world_url: worldUrl,
    error_message: null,
  });
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
