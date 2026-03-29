// @input Component.ScriptComponent controller
// @input Component.Image previewImage
// @input SceneObject trackingObject
// @input bool useRightCamera = false
// @input bool enablePreviewStream = true
// @input int previewSmallerDimension = 640 {"widget":"slider","min":256,"max":1200,"step":1}
// @input int stillImageWidth = 3200 {"widget":"slider","min":640,"max":3200,"step":1}
// @input int stillImageHeight = 2400 {"widget":"slider","min":480,"max":2400,"step":1}
// @input int compressionPreset = 2 {"widget":"combobox", "values":[{"label":"Low","value":0},{"label":"Medium","value":1},{"label":"High","value":2}]}
// @input bool encodeAsPng = false
// @input float targetPitchDeg = 0
// @input float maxPitchOffsetDeg = 18
// @input float captureToleranceDeg = 26
// @input int minSampleIntervalMs = 900
// @input float minTranslationDeltaCm = 6
// @input float minYawDeltaDeg = 10
// @input float minPitchDeltaDeg = 6
// @input float maxAngularVelocityDegPerSec = 140
// @input float maxTranslationSpeedCmPerSec = 120
// @input bool debugLogs = false

var cameraModule = require("LensStudio:CameraModule");
var previewTexture = null;
var previewTextureProvider = null;
var activeCameraId = null;
var lastAcceptedPose = null;
var lastAcceptedDirectionId = "";
var lastSampleAtMs = 0;
var isCapturingStill = false;
var latestGuidance = null;
var captureAnchorYawDeg = 0;
var hasCaptureAnchor = false;
var DIRECTION_TARGETS = [
    { id: "front", label: "Front", yawDeg: 0 },
    { id: "right", label: "Right", yawDeg: 90 },
    { id: "back", label: "Back", yawDeg: 180 },
    { id: "left", label: "Left", yawDeg: 270 }
];

function log(message) {
    if (script.debugLogs) {
        print("[WorldLabsCameraCapture] " + message);
    }
}

function getController() {
    return script.controller || null;
}

function nowMs() {
    return Math.floor(getTime() * 1000);
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function absAngleDeg(value) {
    return Math.abs(value);
}

function deltaAngleDeg(a, b) {
    var delta = a - b;
    while (delta > 180) {
        delta -= 360;
    }
    while (delta < -180) {
        delta += 360;
    }
    return delta;
}

function normalizeYawDeg(value) {
    var normalized = value % 360;
    if (normalized < 0) {
        normalized += 360;
    }
    return normalized;
}

function isEditorMode() {
    return global.deviceInfoSystem && global.deviceInfoSystem.isEditor && global.deviceInfoSystem.isEditor();
}

function getTrackingTransform() {
    if (script.trackingObject) {
        return script.trackingObject.getTransform();
    }
    return script.getSceneObject().getTransform();
}

function getPoseSample() {
    var transform = getTrackingTransform();
    var position = transform.getWorldPosition();
    var rotation = transform.getWorldRotation();
    var forward = transform.forward.uniformScale(-1).normalize();
    var yawDeg = Math.atan2(forward.x, -forward.z) * 180 / Math.PI;
    var horizontalLength = Math.sqrt(forward.x * forward.x + forward.z * forward.z);
    var pitchDeg = Math.atan2(forward.y, Math.max(horizontalLength, 0.0001)) * 180 / Math.PI;

    return {
        timestampMs: nowMs(),
        position: position,
        rotation: rotation,
        forward: forward,
        yawDeg: yawDeg,
        pitchDeg: pitchDeg
    };
}

function getAnchoredYawDeg(relativeYawDeg) {
    return normalizeYawDeg((hasCaptureAnchor ? captureAnchorYawDeg : 0) + relativeYawDeg);
}

function withAnchoredTarget(target) {
    return {
        id: target.id,
        label: target.label,
        yawDeg: getAnchoredYawDeg(target.yawDeg)
    };
}

function getOpenTargets() {
    var controller = getController();
    var targets = [];
    var i;
    for (i = 0; i < DIRECTION_TARGETS.length; i++) {
        if (!controller || !controller.isSectorCovered || !controller.isSectorCovered(DIRECTION_TARGETS[i].id)) {
            targets.push(withAnchoredTarget(DIRECTION_TARGETS[i]));
        }
    }
    if (!targets.length) {
        targets.push(withAnchoredTarget(DIRECTION_TARGETS[DIRECTION_TARGETS.length - 1]));
    }
    return targets;
}

function getClosestOpenTarget(pose) {
    var targets = getOpenTargets();
    var bestTarget = targets[0];
    var bestError = Math.abs(deltaAngleDeg(pose.yawDeg, bestTarget.yawDeg));
    var i;
    for (i = 1; i < targets.length; i++) {
        var error = Math.abs(deltaAngleDeg(pose.yawDeg, targets[i].yawDeg));
        if (error < bestError) {
            bestError = error;
            bestTarget = targets[i];
        }
    }
    return bestTarget;
}

function getHoldMessage(targetLabel) {
    return "Hold steady on " + targetLabel.toLowerCase() + ".";
}

function buildGuidance(pose) {
    var target = getClosestOpenTarget(pose);
    var yawError = deltaAngleDeg(pose.yawDeg, target.yawDeg);
    var pitchError = pose.pitchDeg - script.targetPitchDeg;
    var withinYaw = absAngleDeg(yawError) <= script.captureToleranceDeg;
    var withinPitch = absAngleDeg(pitchError) <= script.maxPitchOffsetDeg;
    var turnInstruction = getHoldMessage(target.label);
    var turnDirection = "none";
    var turnStrength = 0;
    var pitchDirection = "none";
    var pitchStrength = 0;

    if (yawError > script.captureToleranceDeg) {
        turnInstruction = "Turn a little left.";
        turnDirection = "left";
        turnStrength = clamp01((absAngleDeg(yawError) - script.captureToleranceDeg) / 60);
    } else if (yawError < -script.captureToleranceDeg) {
        turnInstruction = "Turn a little right.";
        turnDirection = "right";
        turnStrength = clamp01((absAngleDeg(yawError) - script.captureToleranceDeg) / 60);
    }

    if (!withinPitch) {
        if (pitchError > 0) {
            turnInstruction = "Lower your gaze slightly.";
            pitchDirection = "down";
            pitchStrength = clamp01((absAngleDeg(pitchError) - script.maxPitchOffsetDeg) / 30);
        } else {
            turnInstruction = "Lift your gaze slightly.";
            pitchDirection = "up";
            pitchStrength = clamp01((absAngleDeg(pitchError) - script.maxPitchOffsetDeg) / 30);
        }
    }

    return {
        target: target,
        yawError: yawError,
        pitchError: pitchError,
        withinYaw: withinYaw,
        withinPitch: withinPitch,
        ready: withinYaw && withinPitch,
        turnDirection: turnDirection,
        turnStrength: turnStrength,
        pitchDirection: pitchDirection,
        pitchStrength: pitchStrength,
        message: withinYaw && withinPitch ? getHoldMessage(target.label) : turnInstruction
    };
}

function reject(reason) {
    var controller = getController();
    if (controller && controller.setDebug) {
        controller.setDebug("Rejected: " + reason);
    }
    return false;
}

function canAcceptPose(pose, guidance) {
    if (!guidance.ready) {
        return reject("not_aligned_" + guidance.target.id);
    }

    if (!lastAcceptedPose) {
        return true;
    }

    var dtMs = Math.max(1, pose.timestampMs - lastAcceptedPose.timestampMs);
    if (dtMs < script.minSampleIntervalMs) {
        return reject("cooldown");
    }

    var translationDelta = pose.position.distance(lastAcceptedPose.position);
    var yawDelta = Math.abs(deltaAngleDeg(pose.yawDeg, lastAcceptedPose.yawDeg));
    var pitchDelta = Math.abs(deltaAngleDeg(pose.pitchDeg, lastAcceptedPose.pitchDeg));
    var angularVelocity = (yawDelta + pitchDelta) / (dtMs / 1000);
    var translationSpeed = translationDelta / (dtMs / 1000);

    if (angularVelocity > script.maxAngularVelocityDegPerSec) {
        return reject("turning_too_fast");
    }

    if (translationSpeed > script.maxTranslationSpeedCmPerSec) {
        return reject("moving_too_fast");
    }

    var controller = getController();
    if (controller && controller.isSectorCovered && controller.isSectorCovered(guidance.target.id)) {
        return reject("direction_already_captured");
    }

    if (guidance.target.id === lastAcceptedDirectionId) {
        return reject("repeat_direction");
    }

    if (translationDelta < script.minTranslationDeltaCm && yawDelta < script.minYawDeltaDeg && pitchDelta < script.minPitchDeltaDeg) {
        return reject("insufficient_pose_change");
    }

    return true;
}

function compressionQuality() {
    if (script.compressionPreset <= 0) {
        return CompressionQuality.LowQuality;
    }
    if (script.compressionPreset >= 2) {
        return CompressionQuality.HighQuality;
    }
    return CompressionQuality.IntermediateQuality;
}

function encodeTexture(texture) {
    return new Promise(function (resolve, rejectPromise) {
        Base64.encodeTextureAsync(
            texture,
            resolve,
            rejectPromise,
            compressionQuality(),
            script.encodeAsPng ? EncodingType.Png : EncodingType.Jpg
        );
    });
}

async function requestStillImage() {
    var imageRequest = CameraModule.createImageRequest();
    if (imageRequest.resolution) {
        imageRequest.resolution = new vec2(script.stillImageWidth, script.stillImageHeight);
    }
    return await cameraModule.requestImage(imageRequest);
}

function getFallbackTexture() {
    if (previewTexture) {
        return previewTexture;
    }
    if (script.previewImage && script.previewImage.mainPass && script.previewImage.mainPass.baseTex) {
        return script.previewImage.mainPass.baseTex;
    }
    return null;
}

async function buildCapturedFrameFromTexture(texture, guidance, pose, timestampMs, sourceLabel) {
    var base64Data = await encodeTexture(texture);
    var width = texture && texture.getWidth ? texture.getWidth() : script.previewSmallerDimension;
    var height = texture && texture.getHeight ? texture.getHeight() : script.previewSmallerDimension;

    return {
        id: "frame_" + nowMs() + "_" + guidance.target.id,
        timestampMs: timestampMs || nowMs(),
        base64Data: base64Data,
        encoding: script.encodeAsPng ? "png" : "jpg",
        width: width,
        height: height,
        captureLabel: guidance.target.label,
        pose: {
            timestampMs: pose.timestampMs,
            position: [pose.position.x, pose.position.y, pose.position.z],
            rotation: [pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w],
            forward: [pose.forward.x, pose.forward.y, pose.forward.z],
            yawDeg: pose.yawDeg,
            pitchDeg: pose.pitchDeg
        },
        sectorId: guidance.target.id,
        score: sourceLabel === "preview" ? 0.75 : 1,
        source: sourceLabel
    };
}

async function buildCapturedFrame(guidance, pose) {
    if (!isEditorMode()) {
        var imageFrame = await requestStillImage();
        return await buildCapturedFrameFromTexture(imageFrame.texture, guidance, pose, imageFrame.timestampMillis || nowMs(), "still");
    }

    var fallbackTexture = getFallbackTexture();
    if (!fallbackTexture) {
        throw new Error("Preview texture unavailable for editor fallback capture.");
    }

    return await buildCapturedFrameFromTexture(fallbackTexture, guidance, pose, nowMs(), "preview");
}

async function captureStill(guidance, pose) {
    var controller = getController();
    isCapturingStill = true;
    lastSampleAtMs = nowMs();

    try {
        if (controller && controller.setDebug) {
            controller.setDebug((isEditorMode() ? "Capturing preview " : "Capturing high-res ") + guidance.target.id + " view...");
        }

        var frame = await buildCapturedFrame(guidance, pose);
        var accepted = controller && controller.registerAcceptedFrame ? controller.registerAcceptedFrame(frame) : false;
        if (accepted) {
            lastAcceptedPose = pose;
            lastAcceptedDirectionId = guidance.target.id;
        }
    } catch (error) {
        log("capture failed: " + error);
        if (controller && controller.setDebug) {
            controller.setDebug("Capture failed: " + error);
        }
    } finally {
        isCapturingStill = false;
    }
}

async function tryCapture() {
    var controller = getController();
    if (!controller || !controller.isCapturing || !controller.isCapturing()) {
        return;
    }
    if (isCapturingStill) {
        return;
    }

    var pose = getPoseSample();
    var guidance = buildGuidance(pose);
    latestGuidance = guidance;

    if (!canAcceptPose(pose, guidance)) {
        return;
    }

    await captureStill(guidance, pose);
}

function startPreviewCamera() {
    if (!script.enablePreviewStream) {
        return;
    }

    var request = CameraModule.createCameraRequest();
    request.cameraId = activeCameraId;
    request.imageSmallerDimension = script.previewSmallerDimension;

    previewTexture = cameraModule.requestCamera(request);
    previewTextureProvider = previewTexture.control;

    previewTextureProvider.onNewFrame.add(function () {
        if (script.previewImage) {
            script.previewImage.mainPass.baseTex = previewTexture;
        }
    });
}

function startCamera() {
    var editorMode = isEditorMode();
    activeCameraId = editorMode ? CameraModule.CameraId.Default_Color : (script.useRightCamera ? CameraModule.CameraId.Right_Color : CameraModule.CameraId.Left_Color);
    startPreviewCamera();
    log("camera ready for " + (editorMode ? "preview-texture fallback capture" : "still-image capture"));
}

function getSectorConfig() {
    return {
        yawSectorCount: DIRECTION_TARGETS.length,
        pitchSectorCount: 1
    };
}

function getNextTargetLabel() {
    var pose = getPoseSample();
    return getClosestOpenTarget(pose).label.toLowerCase();
}

function getLiveGuidance() {
    var pose = getPoseSample();
    var guidance = buildGuidance(pose);
    latestGuidance = guidance;
    return {
        targetId: guidance.target.id,
        targetLabel: guidance.target.label,
        message: isCapturingStill ? (isEditorMode() ? "Capturing preview view." : "Capturing high-res view.") : guidance.message,
        ready: guidance.ready,
        yawErrorDeg: guidance.yawError,
        pitchErrorDeg: guidance.pitchError,
        turnDirection: guidance.turnDirection,
        turnStrength: guidance.turnStrength,
        pitchDirection: guidance.pitchDirection,
        pitchStrength: guidance.pitchStrength,
        showHorizontalArrow: guidance.turnDirection !== "none" && !guidance.ready,
        showVerticalArrow: guidance.pitchDirection !== "none" && !guidance.withinPitch,
        isCapturingStill: isCapturingStill
    };
}

function setCaptureAnchorFromCurrentPose() {
    var pose = getPoseSample();
    captureAnchorYawDeg = normalizeYawDeg(pose.yawDeg);
    hasCaptureAnchor = true;
    log("capture anchor yaw=" + captureAnchorYawDeg);
    return captureAnchorYawDeg;
}

function resetCaptureState() {
    lastAcceptedPose = null;
    lastAcceptedDirectionId = "";
    lastSampleAtMs = 0;
    isCapturingStill = false;
    captureAnchorYawDeg = 0;
    hasCaptureAnchor = false;
}

script.startCamera = startCamera;
script.getSectorConfig = getSectorConfig;
script.getNextTargetLabel = getNextTargetLabel;
script.getLiveGuidance = getLiveGuidance;
script.setCaptureAnchorFromCurrentPose = setCaptureAnchorFromCurrentPose;
script.resetCaptureState = resetCaptureState;

script.createEvent("OnStartEvent").bind(function () {
    startCamera();
});

script.createEvent("UpdateEvent").bind(function () {
    tryCapture();
});
