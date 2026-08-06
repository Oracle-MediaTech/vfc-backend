const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  minify: false,
  sourcemap: false,
  treeShaking: true,
  legalComments: "none",
  external: [
    "@prisma/client",
    ".prisma",
    "bcrypt",
    "argon2"
  ]
}).catch(() => process.exit(1));