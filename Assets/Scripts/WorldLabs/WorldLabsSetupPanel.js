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

    global.WorldLabsUserSettings.maskedKey = maskApiKey(global.WorldLabsUserSettings.apiKey || "");
    latestApiKeyDraft = global.WorldLabsUserSettings.apiKey || "";
    return global.WorldLabsUserSettings;
}

function persistSettings() {
    var settings = ensureSettings();
    writeStoredString(STORAGE_KEY_API, settings.apiKey || "");
    writeStoredString(STORAGE_KEY_MODEL, settings.modelName || MODEL_FAST);
}

function getModelLabel(modelName) {
    return modelName === MODEL_QUALITY ? MODEL_QUALITY_LABEL : MODEL_FAST_LABEL;
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

function setToggleState(toggleComponent, isOn) {
    if (!toggleComponent) {
        return;
    }
    try {
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

function syncToggleSelection(modelName) {
    setToggleState(script.miniToggle, modelName !== MODEL_QUALITY);
    setToggleState(script.proToggle, modelName === MODEL_QUALITY);

    if (!script.modelToggleGroup) {
        return;
    }
    try {
        if (script.modelToggleGroup.selectedIndex !== undefined) {
            script.modelToggleGroup.selectedIndex = modelName === MODEL_QUALITY ? 1 : 0;
            return;
        }
        if (script.modelToggleGroup.value !== undefined) {
            script.modelToggleGroup.value = modelName === MODEL_QUALITY ? 1 : 0;
        }
    } catch (error) {
    }
}

function refreshUi() {
    var settings = ensureSettings();

    setTextInputValue(latestApiKeyDraft || settings.apiKey || "");

    if (script.modelText) {
        script.modelText.text = getModelLabel(settings.modelName || MODEL_FAST);
    }
    if (script.maskedKeyText) {
        script.maskedKeyText.text = maskApiKey(settings.apiKey);
    }
    if (script.statusText) {
        script.statusText.text = isConfigured() ? "World Labs is connected." : "Enter your World Labs API key.";
    }

    setDoneButtonEnabled(hasDraftApiKey());
    syncToggleSelection(settings.modelName || MODEL_FAST);
}

function openPanel() {
    setRoots(true);
    refreshUi();
}

function closePanel() {
    setRoots(false);
}

function togglePanel() {
    var panelVisible = script.panelRoot ? !!script.panelRoot.enabled : false;
    setRoots(!panelVisible);
    refreshUi();
}

function applyApiKey(value) {
    var settings = ensureSettings();
    var nextKey = value !== undefined && value !== null ? String(value) : getTextInputValue();
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
    var settings = ensureSettings();
    settings.modelName = modelName || MODEL_FAST;
    persistSettings();
    refreshUi();
    if (script.statusText) {
        script.statusText.text = getModelLabel(settings.modelName) + " mode selected.";
    }
}

function selectFastModel() {
    setModel(MODEL_FAST);
}

function selectQualityModel() {
    setModel(MODEL_QUALITY);
}

function onModelToggleSelected(args) {
    var selectedToggle = args && args.toggleable ? args.toggleable : null;
    if (selectedToggle && script.proToggle && selectedToggle === script.proToggle) {
        selectQualityModel();
        return;
    }
    if (selectedToggle && script.miniToggle && selectedToggle === script.miniToggle) {
        selectFastModel();
        return;
    }

    if (args && args.index !== undefined) {
        if (Number(args.index) === 1) {
            selectQualityModel();
        } else {
            selectFastModel();
        }
        return;
    }

    if (script.modelToggleGroup && script.modelToggleGroup.selectedIndex !== undefined) {
        if (Number(script.modelToggleGroup.selectedIndex) === 1) {
            selectQualityModel();
        } else {
            selectFastModel();
        }
        return;
    }

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
    applyApiKey();
    if (isConfigured()) {
        closePanel();
    } else if (script.statusText) {
        script.statusText.text = "Enter a valid World Labs API key to continue.";
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

script.createEvent("OnStartEvent").bind(function () {
    ensureSettings();
    setRoots(script.startOpen || !isConfigured());
    refreshUi();
});
