global.WorldLabsConfig = {
    supabase: {
        projectUrl: "https://ehhntqueiwfbxcvnnbdl.snapcloud.dev"
    },
    edgeFunctions: {
        startScanPath: "world-labs-assist",
        statusPath: "world-labs-assist"
    },
    worldDefaults: {
        displayName: "World Labs Assist Capture",
        textPrompt: "A realistic immersive reconstruction of the scanned environment",
        modelName: "Marble 0.1-mini"
    },
    modelOptions: {
        miniLabel: "Mini",
        proLabel: "Pro",
        miniValue: "Marble 0.1-mini",
        proValue: "Marble 0.1-plus"
    }
};

global.WorldLabsUserSettings = global.WorldLabsUserSettings || {
    apiKey: "",
    modelName: global.WorldLabsConfig.worldDefaults.modelName,
    maskedKey: ""
};
