import { defineConfig, globalIgnores } from "eslint/config";

export const baseConfig = defineConfig([
  globalIgnores(["dist/**", "build/**", "node_modules/**"]),
]);

export default baseConfig;
