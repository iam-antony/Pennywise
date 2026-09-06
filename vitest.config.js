import { defineConfig } from "vitest/config";

// Kept separate from vite.config.js on purpose: the tests cover src/lib, which
// is plain JavaScript with no React in it, so loading the React plugin here
// only produces noise.
export default defineConfig({
  test: {
    include: ["src/**/*.test.js"],
    environment: "node",
  },
});
