import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: ["@woorisai/shared"],
});
