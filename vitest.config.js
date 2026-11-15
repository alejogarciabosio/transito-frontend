import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/test/**", "src/main.jsx"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 75 },
    },
  },
});
