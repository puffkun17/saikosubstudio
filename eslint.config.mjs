import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs (FlatCompat no longer needed).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // New in eslint-plugin-react-hooks 7 (bundled with eslint-config-next 16). Existing
    // Act-2/export code trips these; kept as warnings so the framework bump stays behaviour-neutral.
    // Tracked in next-iteration-plan.md §H.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      // Animation library is motion@14 via motion/react only (AGENTS.md / ui-animation skill).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "framer-motion",
              message: "Import from 'motion/react' instead of 'framer-motion'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/utils/subtitle/**/*.{ts,tsx}", "src/utils/subtitleCore.ts"],
    rules: {
      "import/no-cycle": "error",
    },
  },
  {
    // Layers must not reverse-import the barrel.
    files: ["src/utils/subtitle/**/*.{ts,tsx}"],
    ignores: ["src/utils/subtitle/engine.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "framer-motion",
              message: "Import from 'motion/react' instead of 'framer-motion'.",
            },
            {
              name: "../subtitleCore",
              message: "subtitle layers must not import the subtitleCore barrel.",
            },
            {
              name: "@/utils/subtitleCore",
              message: "subtitle layers must not import the subtitleCore barrel.",
            },
          ],
          patterns: [
            {
              group: ["**/subtitleCore", "**/subtitleCore.*"],
              message: "subtitle layers must not import the subtitleCore barrel.",
            },
          ],
        },
      ],
    },
  },
  {
    // engine: no io/product + no barrel (must be last so it is not overridden).
    files: ["src/utils/subtitle/engine.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "framer-motion",
              message: "Import from 'motion/react' instead of 'framer-motion'.",
            },
            {
              name: "./io",
              message: "subtitle/engine must not import subtitle/io.",
            },
            {
              name: "./product",
              message: "subtitle/engine must not import subtitle/product.",
            },
            {
              name: "../subtitleCore",
              message: "subtitle layers must not import the subtitleCore barrel.",
            },
            {
              name: "@/utils/subtitleCore",
              message: "subtitle layers must not import the subtitleCore barrel.",
            },
          ],
          patterns: [
            {
              group: ["**/subtitle/io", "**/subtitle/product", "**/subtitle/io.*", "**/subtitle/product.*"],
              message: "subtitle/engine must not import io or product.",
            },
            {
              group: ["**/subtitleCore", "**/subtitleCore.*"],
              message: "subtitle layers must not import the subtitleCore barrel.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "dist/**", "public/**", "next-env.d.ts"]),
]);
