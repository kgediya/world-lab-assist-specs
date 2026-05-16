// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface WorldLabsImageInput {
  id: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  azimuth: number;
  sectorId?: string;
  width?: number;
  height?: number;
  pose?: unknown;
}

interface StartPayload {
  action: "start";
  sessionId: string;
  displayName?: string;
  textPrompt?: string;
  modelName?: string;
  apiKey?: string;
  coveragePercent?: number;
  acceptedFrameCount?: number;
  images: WorldLabsImageInput[];
}

interface StatusPayload {
  action: "status";
  operationId: string;
  worldId?: string | null;
  apiKey?: string;
}

type ReqPayload = StartPayload | StatusPayload;

const DEFAULT_WORLDLABS_API_KEY = Deno.env.get("WORLDLABS_API_KEY") || "";
const WORLDLABS_BASE_URL = "https://api.worldlabs.ai";

console.info("world-labs-assist server started");

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

function decodeBase64(base64: string) {
  const clean = base64.includes(",") ? base64.split(",").pop() || "" : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function resolveApiKey(payload?: { apiKey?: string }) {
  const payloadKey = (payload?.apiKey || "").trim();
  return payloadKey || DEFAULT_WORLDLABS_API_KEY;
}

async function worldlabsRequest(
  apiKey: string,
  path: string,
  method: string,
  body?: unknown,
) {
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

async function prepareAndUploadImage(
  apiKey: string,
  image: WorldLabsImageInput,
) {
  const extension = image.mimeType === "image/png" ? "png" : "jpg";

  const prepared = await worldlabsRequest(
    apiKey,
    "/marble/v1/media-assets:prepare_upload",
    "POST",
    {
      file_name: image.fileName || `${crypto.randomUUID()}.${extension}`,
      kind: "image",
      extension,
    },
  );

  console.log("prepare_upload response", JSON.stringify(prepared));

  const uploadInfo = prepared?.upload_info || null;
  const uploadUrl = uploadInfo?.upload_url || null;
  const uploadMethod = uploadInfo?.upload_method || "PUT";
  const requiredHeaders = uploadInfo?.required_headers || {};
  const mediaAssetId =
    prepared?.media_asset?.media_asset_id ||
    prepared?.media_asset?.id ||
    null;

  if (!uploadUrl) {
    throw new Error(
      `prepare_upload missing upload_url: ${JSON.stringify(prepared)}`,
    );
  }

  if (!mediaAssetId) {
    throw new Error(
      `prepare_upload missing media_asset_id/id: ${JSON.stringify(prepared)}`,
    );
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: uploadMethod,
    headers: {
      ...requiredHeaders,
      "Content-Type": image.mimeType || "image/jpeg",
    },
    body: decodeBase64(image.base64Data || ""),
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `Signed upload failed for ${image.fileName}: ${uploadResponse.status} ${await uploadResponse.text()}`,
    );
  }

  return mediaAssetId;
}

async function handleStart(payload: StartPayload) {
  const apiKey = resolveApiKey(payload);

  if (!payload.images || !payload.images.length) {
    return json({ error: "No images provided" }, 400);
  }

  const multiImagePrompt = [];

  for (const image of payload.images) {
    const mediaAssetId = await prepareAndUploadImage(apiKey, image);
    multiImagePrompt.push({
      azimuth: typeof image.azimuth === "number" ? image.azimuth : 0,
      content: {
        source: "media_asset",
        media_asset_id: mediaAssetId,
      },
    });
  }

  console.log("multiImagePrompt", JSON.stringify(multiImagePrompt));

  const operation = await worldlabsRequest(
    apiKey,
    "/marble/v1/worlds:generate",
    "POST",
    {
      display_name: payload.displayName || "World Labs Assist Capture",
      model: payload.modelName || "Marble 0.1-mini",
      world_prompt: {
        type: "multi-image",
        multi_image_prompt: multiImagePrompt,
        text_prompt: payload.textPrompt || undefined,
      },
    },
  );

  console.log("generate response", JSON.stringify(operation));

  return json({
    ok: true,
    sessionId: payload.sessionId,
    operationId: operation.operation_id,
    operation,
  });
}

async function handleStatus(payload: StatusPayload) {
  const apiKey = resolveApiKey(payload);

  if (!payload.operationId) {
    return json({ error: "Missing operationId" }, 400);
  }

  const operation = await worldlabsRequest(
    apiKey,
    `/marble/v1/operations/${payload.operationId}`,
    "GET",
  );

  const worldId =
    operation?.metadata?.world_id ||
    operation?.response?.id ||
    payload.worldId ||
    null;

  let world = null;
  if (operation.done && worldId) {
    const worldResponse = await worldlabsRequest(
      apiKey,
      `/marble/v1/worlds/${worldId}`,
      "GET",
    );
    world = worldResponse?.world || null;
  }

  return json({
    ok: true,
    done: !!operation.done,
    operation,
    worldId,
    worldUrl:
      world?.world_marble_url ||
      operation?.response?.world_marble_url ||
      null,
    world,
    progress: operation?.metadata?.progress || null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  try {
    const payload: ReqPayload = await req.json();

    if (!resolveApiKey(payload)) {
      return json({ error: "Missing World Labs API key" }, 400);
    }

    if (payload.action === "start") {
      return await handleStart(payload);
    }

    if (payload.action === "status") {
      return await handleStatus(payload);
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("world-labs-assist error", error);
    return json({ error: String(error) }, 500);
  }
});
