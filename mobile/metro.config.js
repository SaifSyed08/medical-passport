// Lets the app import the dependency-free API types in ../shared without an npm workspace.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../shared")];
module.exports = config;
