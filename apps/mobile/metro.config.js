// Expo's default Metro config, plus wasm-as-asset so the web preview can
// bundle sql.js (the web SqlDriver). CommonJS by Metro convention.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("wasm");

module.exports = config;
