import js from "@eslint/js"
import tseslint from "typescript-eslint"
import nextPlugin from "@next/eslint-plugin-next"
import reactHooks from "eslint-plugin-react-hooks"

// Flat ESLint config for the THIMBLE frontend.
//
// The headline rule is @typescript-eslint/no-floating-promises: it fails the
// build when a Promise (e.g. a fetch) is fired without being awaited, returned,
// or explicitly handled. That is the class of bug behind the silent
// `.catch(() => {})` / fire-and-forget fetches the audit flagged — a failed
// request that leaves the user staring at a broken UI with no error surfaced.
//
// We intentionally run a MINIMAL rule set (not recommendedTypeChecked) so the
// gate is about real correctness, not restyling the whole codebase.

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "backend/**",
      "**/*.config.{js,mjs,ts}",
      "**/*.test.{ts,tsx}",
      "__tests__/**",
      "__mocks__/**",
      "jest.setup.ts",
    ],
  },

  js.configs.recommended,

  // Type-aware rules — only for app source. projectService is the fast
  // typescript-eslint mode that reuses the TS program instead of re-parsing.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // React Hooks correctness (advisory). Defined so the existing inline
      // `eslint-disable-next-line react-hooks/exhaustive-deps` comments resolve.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Next.js core-web-vitals checks (advisory). Pulled individually rather
      // than spreading the plugin's recommended set, which references
      // react-hooks/* rules whose plugin we don't install.
      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-img-element": "warn",
      "@next/next/no-sync-scripts": "warn",

      // The gate.
      "@typescript-eslint/no-floating-promises": "error",

      // The codebase predates this config; keep the non-headline rules
      // advisory so the gate stays focused on floating promises rather than
      // failing on pre-existing `any` usage, unused vars, or the intentional
      // best-effort `catch {}` blocks (localStorage/SSR guards).
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-unused-vars": "off",
      "no-empty": "warn",
    },
  },
)
