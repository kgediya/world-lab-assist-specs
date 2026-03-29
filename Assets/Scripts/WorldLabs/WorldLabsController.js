// @input Component.ScriptComponent cameraCapture
// @input Component.ScriptComponent backend
// @input Component.ScriptComponent setupPanel
// @input Component.Text statusText
// @input Component.Text secondaryText
// @input Component.Text progressText
// @input Component.Text debugText
// @input SceneObject startScanButton
// @input SceneObject completeCaptureButton
// @input SceneObject submitButton
// @input SceneObject resetButton
// @input SceneObject settingsButton
// @input string sessionLabelPrefix = "worldlabs"
// @input int maxAcceptedFrames = 12 {"widget":"slider","min":4,"max":40,"step":1}
// @input float targetCoveragePercent = 100 {"widget":"slider","min":25,"max":100,"step":1}
// @input float buttonScaleLerpSpeed = 8 {"widget":"slider","min":1,"max":20,"step":0.5}
// @input float hiddenButtonScale = 0.001 {"widget":"slider","min":0.001,"max":0.2,"step":0.001}
// @input bool autoCreateRemoteSession = true
// @input bool debugLogs = false

var STATE_IDLE = "idle";
var STATE_PREPARING = "preparing";
var STATE_CAPTURING = "capturing";
var STATE_REVIEW = "review";
var STATE_UPLOADING = "uploading";
var STATE_COMPLETED = "completed";
var STATE_FAILED = "failed";

var REQUIRED_DIRECTIONS = ["front", "right", "back", "left"];

var state = STATE_IDLE;
var acceptedFrames = [];
var coveredSectors = {};
var manifest = null;
var buttonBindings = [];

function nowMs() {
    return Math.floor(getTime() * 1000);
}

function log(message) {
    if (script.debugLogs) {
        print("[WorldLabsController] " + message);
    }
}

function createSessionId() {
    var prefix = script.sessionLabelPrefix || "worldlabs";
    return prefix + "_" + nowMs();
}

function getCameraCapture() {
    return script.cameraCapture || null;
}

function getBackend() {
    return script.backend || null;
}

function getSetupPanel() {
    return script.setupPanel || null;
}

function hasConfiguredApiKey() {
    var setupPanel = getSetupPanel();
    if (setupPanel && setupPanel.isConfigured) {
        return !!setupPanel.isConfigured();
    }
    var settings = global.WorldLabsUserSettings;
    return !!(settings && settings.apiKey && String(settings.apiKey).trim());
}

function openSettingsPanel() {
    var setupPanel = getSetupPanel();
    if (setupPanel && setupPanel.openPanel) {
        setupPanel.openPanel();
    }
}

function getButtonSceneObjects() {
    return [
        { key: "start", sceneObject: script.startScanButton },
        { key: "complete", sceneObject: script.completeCaptureButton },
        { key: "submit", sceneObject: script.submitButton },
        { key: "reset", sceneObject: script.resetButton },
        { key: "settings", sceneObject: script.settingsButton }
    ];
}

function initializeButtons() {
    buttonBindings = [];
    var specs = getButtonSceneObjects();
    var i;
    for (i = 0; i < specs.length; i++) {
        var sceneObject = specs[i].sceneObject;
        if (!sceneObject) {
            continue;
        }

        var transform = sceneObject.getTransform();
        var authoredScale = transform.getLocalScale();
        buttonBindings.push({
            key: specs[i].key,
            sceneObject: sceneObject,
            transform: transform,
            shownScale: authoredScale,
            hiddenScale: new vec3(script.hiddenButtonScale, script.hiddenButtonScale, script.hiddenButtonScale),
            visible: false
        });
    }
}

function getButtonVisibleMap() {
    return {
        start: state === STATE_IDLE,
        complete: state === STATE_CAPTURING,
        submit: state === STATE_REVIEW,
        reset: state === STATE_REVIEW || state === STATE_COMPLETED || state === STATE_FAILED,
        settings: state !== STATE_UPLOADING
    };
}

function updateButtonTargets() {
    var visibleMap = getButtonVisibleMap();
    var i;
    for (i = 0; i < buttonBindings.length; i++) {
        buttonBindings[i].visible = !!visibleMap[buttonBindings[i].key];
    }
}

function applyButtonTargetsImmediately() {
    var i;
    for (i = 0; i < buttonBindings.length; i++) {
        var binding = buttonBindings[i];
        binding.transform.setLocalScale(binding.visible ? binding.shownScale : binding.hiddenScale);
    }
}

function animateButtons() {
    if (!buttonBindings.length) {
        return;
    }

    var lerpT = Math.min(1, getDeltaTime() * Math.max(0.001, script.buttonScaleLerpSpeed));
    var i;
    for (i = 0; i < buttonBindings.length; i++) {
        var binding = buttonBindings[i];
        var targetScale = binding.visible ? binding.shownScale : binding.hiddenScale;
        var currentScale = binding.transform.getLocalScale();
        var nextScale = new vec3(
            currentScale.x + (targetScale.x - currentScale.x) * lerpT,
            currentScale.y + (targetScale.y - currentScale.y) * lerpT,
            currentScale.z + (targetScale.z - currentScale.z) * lerpT
        );
        binding.transform.setLocalScale(nextScale);
    }
}

function setState(nextState, statusMessage) {
    state = nextState;
    if (script.statusText) {
        script.statusText.text = statusMessage || ("State: " + nextState);
    }
    if (script.secondaryText && !statusMessage) {
        script.secondaryText.text = "";
    }
    updateButtonTargets();
    log("state=" + nextState + " message=" + (statusMessage || ""));
}

function setSecondary(message) {
    if (script.secondaryText) {
        script.secondaryText.text = message || "";
    }
}

function setProgress() {
    if (!script.progressText) {
        return;
    }
    script.progressText.text = "Views " + getCompletedDirectionCount() + "/" + REQUIRED_DIRECTIONS.length + " | Frames " + acceptedFrames.length;
}

function setDebug(message) {
    if (script.debugText) {
        script.debugText.text = message || "";
    }
    log(message || "");
}

function getCompletedDirectionCount() {
    var count = 0;
    var i;
    for (i = 0; i < REQUIRED_DIRECTIONS.length; i++) {
        if (coveredSectors[REQUIRED_DIRECTIONS[i]]) {
            count += 1;
        }
    }
    return count;
}

function getCoveragePercent() {
    return Math.round((getCompletedDirectionCount() / REQUIRED_DIRECTIONS.length) * 100);
}

function getDirectionChecklist() {
    var parts = [];
    var i;
    for (i = 0; i < REQUIRED_DIRECTIONS.length; i++) {
        var direction = REQUIRED_DIRECTIONS[i];
        var shortLabel = direction.charAt(0).toUpperCase();
        parts.push(shortLabel + (coveredSectors[direction] ? "[x]" : "[ ]"));
    }
    return parts.join(" ");
}

function getPendingDirection() {
    var cameraCapture = getCameraCapture();
    if (cameraCapture && cameraCapture.getNextTargetLabel) {
        return cameraCapture.getNextTargetLabel();
    }

    var i;
    for (i = 0; i < REQUIRED_DIRECTIONS.length; i++) {
        if (!coveredSectors[REQUIRED_DIRECTIONS[i]]) {
            return REQUIRED_DIRECTIONS[i];
        }
    }

    return "";
}

function getDirectionPrompt(directionName) {
    if (directionName === "front") {
        return "Look ahead.";
    }
    if (directionName === "right") {
        return "Turn right.";
    }
    if (directionName === "back") {
        return "Turn around.";
    }
    if (directionName === "left") {
        return "Turn left.";
    }
    return "Turn slowly.";
}

function refreshCaptureUi() {
    setProgress();

    if (state !== STATE_CAPTURING && state !== STATE_REVIEW) {
        return;
    }

    if (state === STATE_REVIEW) {
        setSecondary("Views ready. " + getDirectionChecklist());
        return;
    }

    var cameraCapture = getCameraCapture();
    var guidance = cameraCapture && cameraCapture.getLiveGuidance ? cameraCapture.getLiveGuidance() : null;
    var pendingDirection = getPendingDirection();
    var header = pendingDirection ? getDirectionPrompt(pendingDirection) : "Turn slowly.";
    var compactMessage = guidance && guidance.ready ? "Hold." : header;
    setSecondary(compactMessage + " " + getDirectionChecklist());
}

function resetInternal() {
    acceptedFrames = [];
    coveredSectors = {};
    manifest = null;
    setDebug("");
    var cameraCapture = getCameraCapture();
    if (cameraCapture && cameraCapture.resetCaptureState) {
        cameraCapture.resetCaptureState();
    }
    refreshCaptureUi();
}

function buildNaturalDebugSummary(prefix, debug) {
    var parts = [];
    if (prefix) {
        parts.push(prefix);
    }
    if (debug.errorMessage) {
        parts.push("World Labs needs another try.");
        parts.push(debug.errorMessage);
        return parts.join(" ");
    }
    if (debug.requestAction === "start") {
        parts.push("Sending " + debug.requestImageCount + " views to World Labs.");
    } else if (debug.requestAction === "status") {
        parts.push("Waiting for World Labs to finish your world.");
    }
    if (debug.operationId) {
        parts.push("Operation " + debug.operationId + ".");
    }
    if (debug.worldId) {
        parts.push("World ready.");
    }
    if (debug.responseStatus) {
        parts.push("Status " + debug.responseStatus + ".");
    }
    return parts.join(" ").trim();
}

function setBackendDebugSummary(prefix) {
    var backend = getBackend();
    if (!backend || !backend.getLastDebug) {
        return;
    }

    var debug = backend.getLastDebug();
    setDebug(buildNaturalDebugSummary(prefix, debug));
}

async function startScan() {
    if (!hasConfiguredApiKey()) {
        setState(STATE_IDLE, "Connect World Labs first.");
        setSecondary("Open Settings to add your API key and choose a model.");
        setDebug("Add your World Labs API key before starting a scan.");
        openSettingsPanel();
        return false;
    }

    resetInternal();
    setState(STATE_PREPARING, "Getting ready...");

    manifest = {
        localSessionId: createSessionId(),
        remoteSessionId: "",
        sessionLabel: createSessionId(),
        createdAtMs: nowMs(),
        updatedAtMs: nowMs(),
        targetCoveragePercent: script.targetCoveragePercent,
        coveragePercent: 0,
        acceptedFrameCount: 0,
        worldLabsWorldId: "",
        worldLabsWorldUrl: ""
    };

    var backend = getBackend();
    if (backend && backend.isMockMode && backend.isMockMode()) {
        setDebug("Preview mode is on. No live world will be created.");
    }

    var cameraCapture = getCameraCapture();
    if (cameraCapture && cameraCapture.setCaptureAnchorFromCurrentPose) {
        cameraCapture.setCaptureAnchorFromCurrentPose();
    }

    if (script.autoCreateRemoteSession && backend && backend.createSession) {
        try {
            manifest.remoteSessionId = await backend.createSession({
                localSessionId: manifest.localSessionId,
                sessionLabel: manifest.sessionLabel,
                targetCoveragePercent: script.targetCoveragePercent
            });
        } catch (error) {
            setState(STATE_FAILED, "Could not start the scan.");
            setDebug("The scan session could not be prepared yet.");
            return false;
        }
    }

    setState(STATE_CAPTURING, "Scan started.");
    refreshCaptureUi();
    return true;
}

function completeCapture(message) {
    if (!manifest) {
        return;
    }
    manifest.updatedAtMs = nowMs();
    manifest.coveragePercent = getCoveragePercent();
    manifest.acceptedFrameCount = acceptedFrames.length;
    setState(STATE_REVIEW, message || "Four views are ready.");
    refreshCaptureUi();
}

function registerAcceptedFrame(frame) {
    if (state !== STATE_CAPTURING || !manifest) {
        return false;
    }

    acceptedFrames.push(frame);
    coveredSectors[frame.sectorId] = true;
    manifest.updatedAtMs = nowMs();
    manifest.coveragePercent = getCoveragePercent();
    manifest.acceptedFrameCount = acceptedFrames.length;

    setState(STATE_CAPTURING, (frame.captureLabel || frame.sectorId) + " captured.");
    refreshCaptureUi();

    if (getCoveragePercent() >= script.targetCoveragePercent || getCompletedDirectionCount() >= REQUIRED_DIRECTIONS.length) {
        completeCapture("All four views captured.");
    } else if (acceptedFrames.length >= script.maxAcceptedFrames) {
        completeCapture("The best four views are ready.");
    }

    return true;
}

async function submitScan() {
    if (state !== STATE_REVIEW || !manifest || !acceptedFrames.length) {
        setDebug("Finish the capture before creating your world.");
        return false;
    }

    var backend = getBackend();
    if (!backend || !backend.uploadSession) {
        setState(STATE_FAILED, "Backend script is not ready.");
        return false;
    }

    setState(STATE_UPLOADING, "Creating your world...");
    setBackendDebugSummary("Working with World Labs.");

    try {
        var success = await backend.uploadSession(manifest, acceptedFrames, function (currentBatch, totalBatches, label) {
            setSecondary(label || ("Uploading batch " + currentBatch + "/" + totalBatches));
            setBackendDebugSummary("Working with World Labs.");
        });
        if (!success) {
            setState(STATE_FAILED, "Upload failed.");
            setDebug("World Labs did not accept this scan yet.");
            return false;
        }
    } catch (error) {
        setState(STATE_FAILED, "Upload failed.");
        setDebug("World Labs could not finish this request. " + String(error));
        setBackendDebugSummary("");
        return false;
    }

    setState(STATE_COMPLETED, "World submitted successfully.");
    setSecondary("Check Marble to view your new world.");
    setDebug("Your world has been handed off to Marble.");
    return true;
}

function resetScan() {
    resetInternal();
    if (!hasConfiguredApiKey()) {
        setState(STATE_IDLE, "Connect World Labs first.");
        setSecondary("Open Settings to add your API key and choose Mini or Pro.");
        setDebug("Add your World Labs API key before starting a scan.");
        openSettingsPanel();
        return;
    }
    setState(STATE_IDLE, "Ready to scan.");
    setSecondary("Capture four wide views.");
}

script.startScan = startScan;
script.completeCapture = completeCapture;
script.submitScan = submitScan;
script.resetScan = resetScan;
script.registerAcceptedFrame = registerAcceptedFrame;
script.openSettings = openSettingsPanel;
script.isCapturing = function () { return state === STATE_CAPTURING; };
script.isSectorCovered = function (sectorId) { return !!coveredSectors[sectorId]; };
script.getCoveragePercent = getCoveragePercent;
script.getAcceptedFrameCount = function () { return acceptedFrames.length; };
script.getManifest = function () { return manifest; };
script.getState = function () { return state; };
script.setDebug = setDebug;

script.createEvent("OnStartEvent").bind(function () {
    initializeButtons();
    updateButtonTargets();
    resetScan();
    applyButtonTargetsImmediately();
});

script.createEvent("UpdateEvent").bind(function () {
    animateButtons();
    if (state === STATE_CAPTURING) {
        refreshCaptureUi();
    }
});


