import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { importX } from "eslint-plugin-import-x";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * Minimal flat config after dropping eslint-config-next (Switch B).
 * Keeps: framer-motion ban, subtitle layer import bans + no-cycle, react-hooks.
 */
export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "public/**",
    "scripts/**",
    "node_modules/**",
    ".github/**",
    ".agents/**",
    "workers/feedback-mailer/**",
    "**/*.mjs",
    "**/*.js",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    linterOptions: {
      // Stale @next/next disable comments remain in a few components.
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-object-type": "off",
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
    // PR #48 boundary: import/no-cycle on subtitle layers + barrel (via import-x).
    files: ["src/utils/subtitle/**/*.{ts,tsx}", "src/utils/subtitleCore.ts"],
    plugins: {
      import: importX,
    },
    rules: {
      "import/no-cycle": "error",
    },
  },
  {
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
]);
