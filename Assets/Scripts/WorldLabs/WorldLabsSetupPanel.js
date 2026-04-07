// @input SceneObject panelRoot
// @input SceneObject mainMenuRoot
// @input Component.ScriptComponent apiKeyField
// @input Component.ScriptComponent modelToggleGroup
// @input Component.ScriptComponent doneButton
// @input Component.ScriptComponent miniToggle
// @input Component.ScriptComponent proToggle
// @input Component.Text modelText
// @input Component.Text statusText
// @input Component.Text maskedKeyText
// @input bool startOpen = false

var STORE = global.persistentStorageSystem ? global.persistentStorageSystem.store : null;
var STORAGE_KEY_API = "worldlabs.apiKey";
var STORAGE_KEY_MODEL = "worldlabs.modelName";

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

var MODEL_FAST = getConfig("modelOptions.miniValue", "Marble 0.1-mini");
var MODEL_QUALITY = getConfig("modelOptions.proValue", "Marble 0.1-plus");
var MODEL_FAST_LABEL = getConfig("modelOptions.miniLabel", "Mini");
var MODEL_QUALITY_LABEL = getConfig("modelOptions.proLabel", "Pro");
var latestApiKeyDraft = "";
var latestModelDraft = MODEL_FAST;
var panelIsOpen = false;
var suppressModelSelectionCallback = false;

function sanitizeModelName(modelName) {
    if (modelName === MODEL_QUALITY || modelName === MODEL_FAST) {
        return modelName;
    }
    if (modelName === MODEL_QUALITY_LABEL || modelName === "plus" || modelName === "pro") {
        return MODEL_QUALITY;
    }
    return MODEL_FAST;
}

function readStoredString(key, fallback) {
    if (!STORE || !STORE.getString) {
        return fallback;
    }
    try {
        var value = STORE.getString(key);
        return value || fallback;
    } catch (error) {
        return fallback;
    }
}

function writeStoredString(key, value) {
    if (!STORE) {
        return;
    }
    try {
        if (!value) {
            if (STORE.remove) {
                STORE.remove(key);
            }
            return;
        }
        if (STORE.putString) {
            STORE.putString(key, value);
        }
    } catch (error) {
    }
}

function logMaskedKey(maskedValue) {
    print("[WorldLabsSetupPanel] API key: " + (maskedValue || "Not connected"));
}

function maskApiKey(value) {
    if (!value) {
        return "Not connected";
    }
    if (value.length <= 8) {
        return value;
    }
    return value.substring(0, 4) + " **** " + value.substring(value.length - 4);
}

function ensureSettings() {
    if (!global.WorldLabsUserSettings) {
        global.WorldLabsUserSettings = {
            apiKey: readStoredString(STORAGE_KEY_API, ""),
            modelName: readStoredString(STORAGE_KEY_MODEL, MODEL_FAST),
            maskedKey: ""
        };
    }

    if (!global.WorldLabsUserSettings.apiKey) {
        global.WorldLabsUserSettings.apiKey = readStoredString(STORAGE_KEY_API, "");
    }

    if (!global.WorldLabsUserSettings.modelName) {
        global.WorldLabsUserSettings.modelName = readStoredString(STORAGE_KEY_MODEL, MODEL_FAST);
    }

    global.WorldLabsUserSettings.modelName = sanitizeModelName(global.WorldLabsUserSettings.modelName);

    global.WorldLabsUserSettings.maskedKey = maskApiKey(global.WorldLabsUserSettings.apiKey || "");
    return global.WorldLabsUserSettings;
}

function persistSettings() {
    var settings = ensureSettings();
    writeStoredString(STORAGE_KEY_API, settings.apiKey || "");
    writeStoredString(STORAGE_KEY_MODEL, sanitizeModelName(settings.modelName || MODEL_FAST));
}

function commitSettings(apiKey, modelName) {
    var settings = ensureSettings();
    settings.apiKey = String(apiKey || "").trim();
    settings.modelName = sanitizeModelName(modelName || MODEL_FAST);
    settings.maskedKey = maskApiKey(settings.apiKey);
    latestApiKeyDraft = settings.apiKey;
    latestModelDraft = settings.modelName;
    logMaskedKey(settings.maskedKey);
    persistSettings();
}

function getModelLabel(modelName) {
    return sanitizeModelName(modelName) === MODEL_QUALITY ? MODEL_QUALITY_LABEL : MODEL_FAST_LABEL;
}

function hasDraftApiKey() {
    return !!String(latestApiKeyDraft || "").trim();
}

function isConfigured() {
    var settings = ensureSettings();
    return !!(settings.apiKey && settings.apiKey.trim());
}

function setRoots(panelVisible) {
    if (script.panelRoot) {
        script.panelRoot.enabled = !!panelVisible;
    }
    if (script.mainMenuRoot) {
        script.mainMenuRoot.enabled = !panelVisible;
    }
}

function setDoneButtonEnabled(isEnabled) {
    if (!script.doneButton) {
        return;
    }
    try {
        if (script.doneButton.inactive !== undefined) {
            script.doneButton.inactive = !isEnabled;
            return;
        }
        if (script.doneButton.enabled !== undefined) {
            script.doneButton.enabled = !!isEnabled;
        }
    } catch (error) {
    }
}

function setTextInputValue(value) {
    if (!script.apiKeyField) {
        return;
    }
    try {
        if (script.apiKeyField.text !== undefined) {
            script.apiKeyField.text = value;
            return;
        }
        if (script.apiKeyField.inputText !== undefined) {
            script.apiKeyField.inputText = value;
            return;
        }
        if (script.apiKeyField.currentText !== undefined) {
            script.apiKeyField.currentText = value;
            return;
        }
        if (script.apiKeyField.value !== undefined) {
            script.apiKeyField.value = value;
        }
    } catch (error) {
    }
}

function getTextInputValue() {
    if (!script.apiKeyField) {
        return latestApiKeyDraft || "";
    }
    try {
        if (script.apiKeyField.text !== undefined && script.apiKeyField.text !== null) {
            return String(script.apiKeyField.text);
        }
        if (script.apiKeyField.inputText !== undefined && script.apiKeyField.inputText !== null) {
            return String(script.apiKeyField.inputText);
        }
        if (script.apiKeyField.currentText !== undefined && script.apiKeyField.currentText !== null) {
            return String(script.apiKeyField.currentText);
        }
        if (script.apiKeyField.value !== undefined && script.apiKeyField.value !== null) {
            return String(script.apiKeyField.value);
        }
    } catch (error) {
    }
    return latestApiKeyDraft || "";
}

function getPlaceholderText() {
    if (!script.apiKeyField) {
        return "";
    }
    try {
        if (script.apiKeyField.placeholderText !== undefined && script.apiKeyField.placeholderText !== null) {
            return String(script.apiKeyField.placeholderText);
        }
    } catch (error) {
    }
    return "";
}

function getSafeApiKeyCandidate() {
    var candidate = String(latestApiKeyDraft || "").trim();
    if (!candidate) {
        candidate = String(getTextInputValue() || "").trim();
    }

    var placeholder = String(getPlaceholderText() || "").trim();
    if (candidate && placeholder && candidate === placeholder) {
        return "";
    }

    return candidate;
}

function setToggleState(toggleComponent, isOn) {
    if (!toggleComponent) {
        return;
    }
    try {
        if (toggleComponent.toggle) {
            toggleComponent.toggle(!!isOn);
            return;
        }
        if (toggleComponent.isOn !== undefined) {
            toggleComponent.isOn = !!isOn;
            return;
        }
        if (toggleComponent.setValue) {
            toggleComponent.setValue(isOn);
            return;
        }
        if (toggleComponent.value !== undefined) {
            toggleComponent.value = isOn;
            return;
        }
        if (toggleComponent.isToggledOn !== undefined) {
            toggleComponent.isToggledOn = isOn;
        }
    } catch (error) {
    }
}

function isToggleOn(toggleComponent) {
    if (!toggleComponent) {
        return false;
    }
    try {
        if (toggleComponent.isOn !== undefined) {
            return !!toggleComponent.isOn;
        }
        if (toggleComponent.getIsToggledOn) {
            return !!toggleComponent.getIsToggledOn();
        }
        if (toggleComponent.getValue) {
            return !!toggleComponent.getValue();
        }
        if (toggleComponent.isOn !== undefined) {
            return !!toggleComponent.isOn;
        }
        if (toggleComponent.value !== undefined) {
            return !!toggleComponent.value;
        }
        if (toggleComponent.isToggledOn !== undefined) {
            return !!toggleComponent.isToggledOn;
        }
    } catch (error) {
    }
    return false;
}

function isSameToggle(a, b) {
    if (!a || !b) {
        return false;
    }
    if (a === b) {
        return true;
    }
    if (a.sceneObject && b.sceneObject && a.sceneObject === b.sceneObject) {
        return true;
    }
    return false;
}

function getToggleList() {
    if (!script.modelToggleGroup) {
        return [];
    }
    try {
        if (script.modelToggleGroup.toggleables && script.modelToggleGroup.toggleables.length !== undefined) {
            return script.modelToggleGroup.toggleables;
        }
        if (script.modelToggleGroup.toggles && script.modelToggleGroup.toggles.length !== undefined) {
            return script.modelToggleGroup.toggles;
        }
        if (script.modelToggleGroup._toggles && script.modelToggleGroup._toggles.length !== undefined) {
            return script.modelToggleGroup._toggles;
        }
    } catch (error) {
    }
    return [];
}

function getToggleIndexFromGroup(toggleComponent) {
    var toggles = getToggleList();
    var i;
    for (i = 0; i < toggles.length; i++) {
        if (isSameToggle(toggleComponent, toggles[i])) {
            return i;
        }
    }
    return -1;
}

function getToggleName(toggleComponent) {
    if (!toggleComponent) {
        return "";
    }
    try {
        if (toggleComponent.sceneObject && toggleComponent.sceneObject.name) {
            return String(toggleComponent.sceneObject.name).toLowerCase();
        }
    } catch (error) {
    }
    return "";
}

function resolveModelFromToggle(toggleComponent) {
    if (!toggleComponent) {
        return null;
    }

    if (script.proToggle && isSameToggle(toggleComponent, script.proToggle)) {
        return MODEL_QUALITY;
    }
    if (script.miniToggle && isSameToggle(toggleComponent, script.miniToggle)) {
        return MODEL_FAST;
    }

    var toggleIndex = getToggleIndexFromGroup(toggleComponent);
    if (toggleIndex === 1) {
        return MODEL_QUALITY;
    }
    if (toggleIndex === 0) {
        return MODEL_FAST;
    }

    var name = getToggleName(toggleComponent);
    if (name.indexOf("plus") !== -1 || name.indexOf("pro") !== -1 || name.indexOf("quality") !== -1) {
        return MODEL_QUALITY;
    }
    if (name.indexOf("mini") !== -1 || name.indexOf("fast") !== -1) {
        return MODEL_FAST;
    }

    return null;
}

function getSelectedToggleFromGroup() {
    if (!script.modelToggleGroup) {
        return null;
    }

    try {
        if (script.modelToggleGroup.selectedToggle) {
            return script.modelToggleGroup.selectedToggle;
        }
        if (script.modelToggleGroup.toggleable) {
            return script.modelToggleGroup.toggleable;
        }
        if (script.modelToggleGroup.currentToggle) {
            return script.modelToggleGroup.currentToggle;
        }
    } catch (error) {
    }

    var toggles = getToggleList();
    var i;
    for (i = 0; i < toggles.length; i++) {
        if (isToggleOn(toggles[i])) {
            return toggles[i];
        }
    }

    return null;
}

function getSelectedModelFromUi() {
    var resolved = resolveModelFromToggle(getSelectedToggleFromGroup());
    if (resolved) {
        return resolved;
    }

    if (isToggleOn(script.proToggle)) {
        return MODEL_QUALITY;
    }
    if (isToggleOn(script.miniToggle)) {
        return MODEL_FAST;
    }

    if (script.modelToggleGroup) {
        try {
            if (script.modelToggleGroup.selectedIndex !== undefined) {
                return Number(script.modelToggleGroup.selectedIndex) === 1 ? MODEL_QUALITY : MODEL_FAST;
            }
            if (script.modelToggleGroup.value !== undefined) {
                return Number(script.modelToggleGroup.value) === 1 ? MODEL_QUALITY : MODEL_FAST;
            }
        } catch (error) {
        }
    }

    var toggles = getToggleList();
    var i;
    for (i = 0; i < toggles.length; i++) {
        if (isToggleOn(toggles[i])) {
            resolved = resolveModelFromToggle(toggles[i]);
            if (resolved) {
                return resolved;
            }
            return i === 1 ? MODEL_QUALITY : MODEL_FAST;
        }
    }

    return sanitizeModelName(latestModelDraft || ensureSettings().modelName || MODEL_FAST);
}

function syncToggleSelection(modelName) {
    suppressModelSelectionCallback = true;
    setToggleState(script.miniToggle, modelName !== MODEL_QUALITY);
    setToggleState(script.proToggle, modelName === MODEL_QUALITY);

    if (!script.modelToggleGroup) {
        suppressModelSelectionCallback = false;
        return;
    }
    try {
        var toggles = getToggleList();
        if (toggles.length >= 2) {
            setToggleState(toggles[0], modelName !== MODEL_QUALITY);
            setToggleState(toggles[1], modelName === MODEL_QUALITY);
        }
    } catch (error) {
    }
    suppressModelSelectionCallback = false;
}

function refreshUi() {
    var settings = ensureSettings();
    var resolvedModelName = sanitizeModelName(panelIsOpen ? latestModelDraft : (settings.modelName || MODEL_FAST));
    settings.modelName = sanitizeModelName(settings.modelName || MODEL_FAST);

    setTextInputValue(panelIsOpen ? latestApiKeyDraft : (settings.apiKey || ""));

    if (script.modelText) {
        script.modelText.text = getModelLabel(resolvedModelName);
    }
    if (script.maskedKeyText) {
        script.maskedKeyText.text = maskApiKey(settings.apiKey);
    }
    if (script.statusText) {
        script.statusText.text = isConfigured() ? "World Labs is connected." : "Enter your World Labs API key.";
    }

    setDoneButtonEnabled(hasDraftApiKey());
    syncToggleSelection(resolvedModelName);
}

function scheduleUiRefresh() {
    var event = script.createEvent("DelayedCallbackEvent");
    event.bind(function () {
        refreshUi();
    });
    event.reset(0.05);
}

function openPanel() {
    var settings = ensureSettings();
    latestApiKeyDraft = settings.apiKey || "";
    latestModelDraft = sanitizeModelName(settings.modelName || MODEL_FAST);
    panelIsOpen = true;
    setRoots(true);
    refreshUi();
    scheduleUiRefresh();
}

function closePanel() {
    panelIsOpen = false;
    setRoots(false);
}

function togglePanel() {
    var panelVisible = script.panelRoot ? !!script.panelRoot.enabled : false;
    if (panelVisible) {
        closePanel();
    } else {
        openPanel();
    }
}

function applyApiKey(value) {
    var settings = ensureSettings();
    var nextKey = value !== undefined && value !== null ? String(value) : latestApiKeyDraft;
    if ((nextKey === undefined || nextKey === null || nextKey === "") && script.apiKeyField) {
        nextKey = getTextInputValue();
    }
    nextKey = nextKey.trim();
    latestApiKeyDraft = nextKey;
    settings.apiKey = nextKey;
    settings.maskedKey = maskApiKey(nextKey);
    logMaskedKey(settings.maskedKey);
    persistSettings();
    refreshUi();
    if (script.statusText) {
        script.statusText.text = nextKey ? "API key saved on this device." : "API key cleared.";
    }
}

function updateApiKeyDraft(value) {
    latestApiKeyDraft = String(value !== undefined && value !== null ? value : getTextInputValue()).trim();
    setDoneButtonEnabled(hasDraftApiKey());
}

function clearApiKey() {
    latestApiKeyDraft = "";
    var settings = ensureSettings();
    settings.apiKey = "";
    settings.maskedKey = "";
    logMaskedKey("Not connected");
    persistSettings();
    refreshUi();
    if (script.statusText) {
        script.statusText.text = "API key cleared.";
    }
}

function setModel(modelName) {
    latestModelDraft = sanitizeModelName(modelName || MODEL_FAST);
    refreshUi();
    if (script.statusText) {
        script.statusText.text = getModelLabel(latestModelDraft) + " mode selected.";
    }
}

function selectFastModel() {
    setModel(MODEL_FAST);
}

function selectQualityModel() {
    setModel(MODEL_QUALITY);
}

function onModelToggleSelected(args) {
    if (suppressModelSelectionCallback) {
        return;
    }

    var selectedToggle = args && args.toggleable ? args.toggleable : null;
    var resolved = resolveModelFromToggle(selectedToggle);
    if (resolved) {
        latestModelDraft = resolved;
        setModel(resolved);
        return;
    }

    if (args && args.index !== undefined) {
        if (Number(args.index) === 1) {
            latestModelDraft = MODEL_QUALITY;
            selectQualityModel();
        } else {
            latestModelDraft = MODEL_FAST;
            selectFastModel();
        }
        return;
    }

    resolved = resolveModelFromToggle(getSelectedToggleFromGroup());
    if (resolved) {
        latestModelDraft = resolved;
        setModel(resolved);
        return;
    }

    if (script.modelToggleGroup && script.modelToggleGroup.selectedIndex !== undefined) {
        if (Number(script.modelToggleGroup.selectedIndex) === 1) {
            latestModelDraft = MODEL_QUALITY;
            selectQualityModel();
        } else {
            latestModelDraft = MODEL_FAST;
            selectFastModel();
        }
        return;
    }

    latestModelDraft = MODEL_FAST;
    selectFastModel();
}

function cycleModel() {
    var settings = ensureSettings();
    if (settings.modelName === MODEL_QUALITY) {
        setModel(MODEL_FAST);
    } else {
        setModel(MODEL_QUALITY);
    }
}

function onDonePressed() {
    print("[WorldLabsSetupPanel] DONE pressed");
    var nextModel = getSelectedModelFromUi();
    var nextApiKey = getSafeApiKeyCandidate();
    commitSettings(nextApiKey, nextModel);
    print("[WorldLabsSetupPanel] Model: " + getModelLabel(nextModel));
    if (isConfigured()) {
        if (script.statusText) {
            script.statusText.text = "Settings saved.";
        }
        closePanel();
    } else if (script.statusText) {
        script.statusText.text = "Enter a valid World Labs API key to continue.";
        refreshUi();
    }
}

function onTextInputChanged(args) {
    var nextValue = args && args.text !== undefined ? args.text : args;
    updateApiKeyDraft(nextValue);
}

function onKeyboardStateChanged(args) {
    if (args && args.isOpen === false) {
        applyApiKey();
    }
}

function getSettings() {
    return ensureSettings();
}

script.openPanel = openPanel;
script.closePanel = closePanel;
script.togglePanel = togglePanel;
script.applyApiKey = applyApiKey;
script.clearApiKey = clearApiKey;
script.selectFastModel = selectFastModel;
script.selectQualityModel = selectQualityModel;
script.onModelToggleSelected = onModelToggleSelected;
script.onDonePressed = onDonePressed;
script.onTextInputChanged = onTextInputChanged;
script.onKeyboardStateChanged = onKeyboardStateChanged;
script.cycleModel = cycleModel;
script.getSettings = getSettings;
script.isConfigured = isConfigured;
script.getCurrentModelLabel = function () { return getModelLabel(ensureSettings().modelName); };
script.getCurrentModelName = function () { return sanitizeModelName(ensureSettings().modelName); };

script.createEvent("OnStartEvent").bind(function () {
    var settings = ensureSettings();
    latestApiKeyDraft = settings.apiKey || "";
    latestModelDraft = sanitizeModelName(settings.modelName || MODEL_FAST);
    panelIsOpen = !!(script.startOpen || !isConfigured());
    setRoots(script.startOpen || !isConfigured());
    refreshUi();
    scheduleUiRefresh();
});
