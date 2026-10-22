import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
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
      // import/no-cycle needs eslint-plugin-import; skip if not installed — layer bans below cover the critical edges.
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
