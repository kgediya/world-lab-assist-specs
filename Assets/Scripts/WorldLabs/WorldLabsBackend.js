// @input Asset.InternetModule internetModule
// @input Asset.SupabaseProject supabaseProject
// @input string projectUrlOverride = "https://ehhntqueiwfbxcvnnbdl.snapcloud.dev"
// @input string startScanFunctionName = "world-labs-assist"
// @input string statusFunctionName = "world-labs-assist"
// @input string fallbackDisplayName = "World Labs Assist Capture"
// @input string fallbackTextPrompt = "A realistic immersive reconstruction of the scanned environment"
// @input string modelName = "Marble 0.1-mini"
// @input bool includeAuthToken = true
// @input int pollIntervalMs = 10000 {"widget":"slider","min":2000,"max":30000,"step":1000}
// @input int maxPollAttempts = 36 {"widget":"slider","min":3,"max":120,"step":1}
// @input bool useMockResponses = false
// @input bool debugLogs = false

var supabaseClient = null;
var DEFAULT_FUNCTION_NAME = "world-labs-assist";
var MAX_WORLDLABS_IMAGES = 4;
var lastDebug = {
    mode: "idle",
    requestUrl: "",
    requestAction: "",
    requestImageCount: 0,
    responseStatus: "",
    responseSummary: "",
    errorMessage: "",
    operationId: "",
    worldId: "",
    worldUrl: ""
};

function log(message) {
    if (script.debugLogs) {
        print("[WorldLabsBackend] " + message);
    }
}

function summarizeError(error) {
    if (error === undefined || error === null) {
        return "Unknown error";
    }
    if (error.message) {
        return String(error.message);
    }
    return String(error);
}

function clearDebugError() {
    lastDebug.errorMessage = "";
}

function summarizeJson(data) {
    if (!data) {
        return "";
    }
    if (data.error) {
        return "error=" + data.error;
    }
    if (data.operationId || data.operation_id) {
        return "operation=" + (data.operationId || data.operation_id);
    }
    if (data.worldUrl || data.world_marble_url) {
        return "worldUrl=" + (data.worldUrl || data.world_marble_url);
    }
    if (data.done !== undefined) {
        return "done=" + data.done;
    }
    return "ok";
}

function getConfig(path, fallback) {
    var cursor = global.WorldLabsConfig;
    var parts = path.split(".");
    var i;
    for (i = 0; i < parts.length; i++) {
        if (!cursor || cursor[parts[i]] === undefined || cursor[parts[i]] === null) {
            return fallback;
        }
        cursor = cursor[parts[i]];
    }
    return cursor;
}

function getUserSettings() {
    if (!global.WorldLabsUserSettings) {
        global.WorldLabsUserSettings = {
            apiKey: "",
            modelName: "",
            maskedKey: ""
        };
    }
    return global.WorldLabsUserSettings;
}

function getResolvedModelName() {
    var settings = getUserSettings();
    return settings.modelName || script.modelName || getConfig("worldDefaults.modelName", "Marble 0.1-mini");
}

function getResolvedApiKey() {
    var settings = getUserSettings();
    return settings.apiKey || "";
}

function getInternetModule() {
    return script.internetModule || null;
}

function getProjectUrl() {
    if (script.projectUrlOverride) {
        return script.projectUrlOverride;
    }
    if (script.supabaseProject && script.supabaseProject.url) {
        return script.supabaseProject.url;
    }
    return getConfig("supabase.projectUrl", "");
}

function getPublicToken() {
    return script.supabaseProject && script.supabaseProject.publicToken ? script.supabaseProject.publicToken : "";
}

function normalizeFunctionName(name) {
    if (!name) {
        return DEFAULT_FUNCTION_NAME;
    }
    if (name === "worldlabs-start-scan" || name === "worldlabs-scan-status") {
        return DEFAULT_FUNCTION_NAME;
    }
    return name;
}

function getFunctionName(kind) {
    if (kind === "start") {
        return normalizeFunctionName(script.startScanFunctionName || getConfig("edgeFunctions.startScanPath", DEFAULT_FUNCTION_NAME));
    }
    return normalizeFunctionName(script.statusFunctionName || getConfig("edgeFunctions.statusPath", DEFAULT_FUNCTION_NAME));
}

function getFunctionUrl(functionName) {
    var baseUrl = getProjectUrl();
    if (!baseUrl) {
        throw new Error("Missing Supabase project URL. Assign a SupabaseProject asset or set projectUrlOverride/config.js.");
    }

    if (baseUrl.charAt(baseUrl.length - 1) === "/") {
        baseUrl = baseUrl.slice(0, -1);
    }

    return baseUrl + "/functions/v1/" + normalizeFunctionName(functionName);
}

function buildHeaders() {
    var token = getPublicToken();
    var headers = {
        "Content-Type": "application/json"
    };

    if (token) {
        headers["apikey"] = token;
        if (script.includeAuthToken) {
            headers["Authorization"] = "Bearer " + token;
        }
    }

    return headers;
}

function ensureSupabaseClient() {
    if (supabaseClient || !script.supabaseProject) {
        return supabaseClient;
    }

    try {
        var createClient = require("SupabaseClient.lspkg/supabase-snapcloud").createClient;
        supabaseClient = createClient(script.supabaseProject.url, script.supabaseProject.publicToken, {
            realtime: { heartbeatIntervalMs: 2500 }
        });
    } catch (error) {
        log("Supabase client init failed: " + summarizeError(error));
        supabaseClient = null;
    }

    return supabaseClient;
}

function performJsonRequest(url, payload) {
    return new Promise(function (resolve, reject) {
        var internetModule = getInternetModule();
        if (!internetModule) {
            reject(new Error("Missing InternetModule asset on WorldLabsBackend."));
            return;
        }

        var request;
        try {
            request = RemoteServiceHttpRequest.create();
            request.url = url;
            request.method = RemoteServiceHttpRequest.HttpRequestMethod.Post;
            request.body = JSON.stringify(payload || {});
            request.apiSpecId = "http";

            var headers = buildHeaders();
            for (var key in headers) {
                if (headers.hasOwnProperty(key)) {
                    request.setHeader(key, headers[key]);
                }
            }
        } catch (error) {
            reject(new Error("performHttpRequest build failed: " + summarizeError(error)));
            return;
        }

        try {
            internetModule.performHttpRequest(request, function (response) {
                try {
                    if (!response) {
                        reject(new Error("performHttpRequest returned no response"));
                        return;
                    }

                    lastDebug.responseStatus = String(response.statusCode);

                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        reject(new Error("Edge Function request failed with status " + response.statusCode + " " + (response.body || "")));
                        return;
                    }

                    var parsed = {};
                    if (response.body) {
                        parsed = JSON.parse(response.body);
                    }
                    resolve(parsed);
                } catch (callbackError) {
                    reject(new Error("performHttpRequest parse failed: " + summarizeError(callbackError)));
                }
            });
        } catch (error) {
            reject(new Error("performHttpRequest send failed: " + summarizeError(error)));
        }
    });
}

async function sendEdgeFunctionRequest(functionName, payload) {
    if (script.useMockResponses) {
        lastDebug.mode = "mock";
        lastDebug.requestUrl = "mock://" + normalizeFunctionName(functionName);
        lastDebug.requestAction = payload && payload.action ? payload.action : "";
        lastDebug.requestImageCount = payload && payload.images ? payload.images.length : 0;
        lastDebug.responseStatus = "mock";
        lastDebug.responseSummary = "Mock response used";
        lastDebug.errorMessage = "";
        return null;
    }

    ensureSupabaseClient();
    clearDebugError();
    lastDebug.mode = "live";
    lastDebug.requestUrl = getFunctionUrl(functionName);
    lastDebug.requestAction = payload && payload.action ? payload.action : "";
    lastDebug.requestImageCount = payload && payload.images ? payload.images.length : 0;

    log("POST " + lastDebug.requestUrl + " action=" + lastDebug.requestAction + " images=" + lastDebug.requestImageCount);

    var json;
    try {
        json = await performJsonRequest(lastDebug.requestUrl, payload);
    } catch (error) {
        lastDebug.errorMessage = summarizeError(error);
        throw new Error(lastDebug.errorMessage);
    }

    lastDebug.responseSummary = summarizeJson(json);
    if (json.operationId || json.operation_id) {
        lastDebug.operationId = json.operationId || json.operation_id;
    }
    if (json.worldId) {
        lastDebug.worldId = json.worldId;
    }
    if (json.worldUrl) {
        lastDebug.worldUrl = json.worldUrl;
    }
    return json;
}

function wait(delayMs) {
    return new Promise(function (resolve) {
        var event = script.createEvent("DelayedCallbackEvent");
        event.bind(resolve);
        event.reset(delayMs / 1000);
    });
}

function getAzimuthFromYaw(yawDeg) {
    var normalized = ((yawDeg % 360) + 360) % 360;
    return Math.round(normalized);
}

function pushIfPresent(target, frame) {
    if (frame && target.indexOf(frame) === -1 && target.length < MAX_WORLDLABS_IMAGES) {
        target.push(frame);
    }
}

function selectKeyframes(frames) {
    var buckets = { front: null, right: null, back: null, left: null };
    var bestBySector = {};
    var i;
    for (i = 0; i < frames.length; i++) {
        var frame = frames[i];
        if (!frame || !frame.pose) {
            continue;
        }

        var azimuth = getAzimuthFromYaw(frame.pose.yawDeg || 0);
        var bucketName = "front";
        if (azimuth >= 45 && azimuth < 135) {
            bucketName = "right";
        } else if (azimuth >= 135 && azimuth < 225) {
            bucketName = "back";
        } else if (azimuth >= 225 && azimuth < 315) {
            bucketName = "left";
        }

        if (!buckets[bucketName]) {
            buckets[bucketName] = frame;
        }
        if (!bestBySector[frame.sectorId]) {
            bestBySector[frame.sectorId] = frame;
        }
    }

    var selected = [];
    pushIfPresent(selected, buckets.front);
    pushIfPresent(selected, buckets.right);
    pushIfPresent(selected, buckets.back);
    pushIfPresent(selected, buckets.left);

    if (selected.length < MAX_WORLDLABS_IMAGES) {
        for (var sectorId in bestBySector) {
            if (!bestBySector.hasOwnProperty(sectorId)) {
                continue;
            }
            pushIfPresent(selected, bestBySector[sectorId]);
            if (selected.length >= MAX_WORLDLABS_IMAGES) {
                break;
            }
        }
    }

    return selected.slice(0, MAX_WORLDLABS_IMAGES);
}

function buildStartPayload(manifest, frames) {
    var displayName = manifest && manifest.sessionLabel ? manifest.sessionLabel : (script.fallbackDisplayName || getConfig("worldDefaults.displayName", "World Labs Assist Capture"));
    var textPrompt = script.fallbackTextPrompt || getConfig("worldDefaults.textPrompt", "A realistic immersive reconstruction of the scanned environment");
    var modelName = getResolvedModelName();
    var apiKey = getResolvedApiKey();
    var selectedFrames = selectKeyframes(frames || []);
    var images = [];
    var i;

    for (i = 0; i < selectedFrames.length; i++) {
        var frame = selectedFrames[i];
        images.push({
            id: frame.id,
            fileName: frame.id + "." + (frame.encoding || "jpg"),
            mimeType: frame.encoding === "png" ? "image/png" : "image/jpeg",
            base64Data: frame.base64Data,
            azimuth: getAzimuthFromYaw(frame.pose && frame.pose.yawDeg ? frame.pose.yawDeg : 0),
            sectorId: frame.sectorId,
            width: frame.width,
            height: frame.height,
            pose: frame.pose
        });
    }

    return {
        action: "start",
        sessionId: manifest && manifest.localSessionId ? manifest.localSessionId : ("session_" + Math.floor(getTime() * 1000)),
        displayName: displayName,
        textPrompt: textPrompt,
        modelName: modelName,
        apiKey: apiKey,
        coveragePercent: manifest && manifest.coveragePercent ? manifest.coveragePercent : 0,
        acceptedFrameCount: manifest && manifest.acceptedFrameCount ? manifest.acceptedFrameCount : selectedFrames.length,
        images: images
    };
}

async function createSession(payload) {
    return payload && payload.localSessionId ? payload.localSessionId : ("session_" + Math.floor(getTime() * 1000));
}

async function uploadSession(manifest, frames, onProgress) {
    if (script.useMockResponses) {
        manifest.remoteSessionId = manifest.localSessionId;
        manifest.worldLabsOperation = {
            operation_id: "mock_operation_" + Math.floor(getTime() * 1000),
            done: true,
            metadata: { progress: { status: "SUCCEEDED", description: "Mock generation completed" }, world_id: "mock_world_" + Math.floor(getTime() * 1000) },
            response: { id: "mock_world_" + Math.floor(getTime() * 1000), world_marble_url: "https://marble.worldlabs.ai/world/mock" }
        };
        manifest.worldLabsWorldId = manifest.worldLabsOperation.metadata.world_id;
        manifest.worldLabsWorldUrl = manifest.worldLabsOperation.response.world_marble_url;
        if (onProgress) {
            onProgress(1, 1, "Preview mode is on. No live request was sent.");
        }
        return true;
    }

    var startPayload = buildStartPayload(manifest, frames);
    if (!startPayload.apiKey) {
        lastDebug.errorMessage = "Add your World Labs API key in Settings first.";
        throw new Error(lastDebug.errorMessage);
    }
    if (!startPayload.images.length) {
        lastDebug.errorMessage = "No views are ready yet.";
        throw new Error(lastDebug.errorMessage);
    }

    if (onProgress) {
        onProgress(1, 3, "Sending " + startPayload.images.length + " views to World Labs.");
    }

    var startResponse = await sendEdgeFunctionRequest(getFunctionName("start"), startPayload);
    manifest.remoteSessionId = startResponse.operationId || startResponse.operation_id || manifest.localSessionId;

    var attempt;
    var statusResponse = null;
    for (attempt = 0; attempt < script.maxPollAttempts; attempt++) {
        if (onProgress) {
            onProgress(attempt + 2, script.maxPollAttempts + 1, "Waiting for World Labs to finish your world.");
        }

        statusResponse = await sendEdgeFunctionRequest(getFunctionName("status"), {
            action: "status",
            operationId: manifest.remoteSessionId,
            worldId: startResponse.worldId || null,
            apiKey: startPayload.apiKey
        });

        if (statusResponse && statusResponse.done) {
            break;
        }

        await wait(script.pollIntervalMs);
    }

    if (!statusResponse || !statusResponse.done) {
        lastDebug.errorMessage = "World Labs took too long to finish this request.";
        throw new Error(lastDebug.errorMessage);
    }

    manifest.worldLabsOperation = statusResponse.operation || statusResponse;
    manifest.worldLabsWorldId = statusResponse.worldId || (statusResponse.operation && statusResponse.operation.metadata ? statusResponse.operation.metadata.world_id : "");
    manifest.worldLabsWorldUrl = statusResponse.worldUrl || (statusResponse.operation && statusResponse.operation.response ? statusResponse.operation.response.world_marble_url : "");
    lastDebug.worldId = manifest.worldLabsWorldId || "";
    lastDebug.worldUrl = manifest.worldLabsWorldUrl || "";

    return true;
}

async function finalizeSession(manifest) {
    return true;
}

script.createSession = createSession;
script.uploadSession = uploadSession;
script.finalizeSession = finalizeSession;
script.buildStartPayload = buildStartPayload;
script.getFunctionUrl = getFunctionUrl;
script.getPublicToken = getPublicToken;
script.getSupabaseClient = ensureSupabaseClient;
script.getInternetModule = getInternetModule;
script.getResolvedModelName = getResolvedModelName;
script.getResolvedApiKey = getResolvedApiKey;
script.getLastDebug = function () { return lastDebug; };
script.isMockMode = function () { return !!script.useMockResponses; };
