import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// The rule that earns its keep here is no-undef. A missing import is not a
// build error — Rollup treats an unknown identifier as a global, so the bundle
// builds and the app throws at runtime. That is how `parseEntry` shipped
// undefined and white-screened the whole page.
export default [
  { ignores: ["dist/**", "node_modules/**"] },

  {
    files: ["**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Unused function arguments are common in callbacks; unused variables
      // are not, and usually mean something was left half-renamed.
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^_" }],
      // The app throws these away deliberately when storage is unavailable.
      "no-empty": ["error", { allowEmptyCatch: true }],

      // Warnings, not errors: these are real but they are design changes, not
      // tidy-ups, so they should not block a lint run until they are dealt
      // with deliberately.
      //
      // set-state-in-effect (8): every page syncs its selected financial year
      //   to the month cursor with useEffect(() => setSelFY(...)). Deriving it
      //   during render instead is the fix, and it overlaps with the open
      //   finding P3-05, where the FY tab and the month cursor disagreeing
      //   produces a nonsense year-to-date gauge.
      // immutability (1): ComboChart accumulates cumulative totals by
      //   reassigning locals inside a map during render. It works today but
      //   breaks under the React Compiler.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },

  {
    files: ["**/*.test.js", "vitest.config.js", "vite.config.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
