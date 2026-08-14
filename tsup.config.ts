import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  outDir: "dist-cli",
  clean: true,
  sourcemap: true,
});
