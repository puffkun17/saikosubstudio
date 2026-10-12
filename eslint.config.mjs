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
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "dist/**", "public/**", "next-env.d.ts"]),
]);
