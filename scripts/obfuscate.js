const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "dist", "server.js");

console.log("Obfuscating backend...");

const code = fs.readFileSync(file, "utf8");

const result = JavaScriptObfuscator.obfuscate(code, {
  compact: true,
  controlFlowFlattening: true,
  deadCodeInjection: false,
  stringArray: true,
  rotateStringArray: true,
});

fs.writeFileSync(file, result.getObfuscatedCode());

console.log("Backend obfuscated successfully.");