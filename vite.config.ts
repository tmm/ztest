/// <reference types="vitest/config" />
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  test: {
    onConsoleLog(log, type) {
      return !(
        type === "stderr" &&
        /(clearing due to unexpected poke error|"error":"alreadyProcessed")/.test(
          log,
        )
      )
    },
    projects: [
      {
        test: {
          globalSetup: ["test/globalSetup.schema.ts"],
          include: ["shared/mutators.test.ts", "shared/queries.test.ts"],
          name: "schema",
        },
      },
    ],
  },
})
