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
  // runtime — they must NOT be bundled. Everything else (including workspace
  // packages like @brayford/*) gets inlined into the output.
  external: ["firebase-admin", "firebase-functions"],
});

console.log("✔ functions bundled successfully");
