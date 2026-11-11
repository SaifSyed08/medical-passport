// The root web app's ESLint config ignores mobile/; this one is for the Expo app.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([expoConfig, { ignores: ["dist/*", "dist-check/*"] }]);
