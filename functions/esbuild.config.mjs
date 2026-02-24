import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  outfile: "lib/index.js",
  format: "cjs",
  sourcemap: true,
  // firebase-admin and firebase-functions are provided by the Cloud Functions
  // runtime — they must NOT be bundled. sharp uses native binaries and must
  // also be excluded so the runtime resolves it from node_modules.
  external: ["firebase-admin", "firebase-functions", "sharp"],
});

console.log("✔ functions bundled successfully");
