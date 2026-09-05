import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import checkFile from "eslint-plugin-check-file";
import importX from "eslint-plugin-import-x";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

// Next.js convention files and configuration files that require default exports.
const defaultExportFiles = [
  "app/**/{layout,page,route,error,global-error,not-found,loading,template,default,forbidden,unauthorized}.{ts,tsx}",
  "app/**/instrumentation.ts",
  "instrumentation.ts",
  "middleware.ts",
  "drizzle.config.ts",
  "eslint.config.mjs",
  "jest.config.mjs",
  "next.config.ts",
  "postcss.config.mjs",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  prettierRecommended,

  // Named exports by default; default exports allowed only in the enumerated
  // Next.js convention and configuration files above.
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-exports": [
        "error",
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
    },
  },
  {
    files: defaultExportFiles,
    rules: {
      "no-restricted-exports": "off",
    },
  },

  // Grouped, alphabetically sorted imports plus basic import hygiene.
  {
    plugins: { "import-x": importX, "simple-import-sort": simpleImportSort },
    rules: {
      "import-x/first": "error",
      "import-x/no-duplicates": "error",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // Side-effect imports.
            ["^\\u0000", "^node:"],
            // Packages: react family first, then everything else.
            ["^react$", "^react-dom$", "^next", "^@?\\w"],
            // Path alias imports.
            ["^@/"],
            // Relative parent imports.
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            // Relative sibling imports (including stylesheets).
            ["^\\./"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
    },
  },

  // Module boundaries: the presentation/transport layer and shared UI never
  // touch persistence infrastructure or private domain implementation files
  // directly. Outside consumers may import a domain only through its public
  // `index`, `client`, or `server` entry points; deeper imports (including
  // private sub-module entry points such as @/domains/users/auth/server)
  // cross module boundaries and are forbidden.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db", "@/lib/db/*"],
              message: "/app and /components must access persistence only through domain interfaces (e.g. @/domains/users/server).",
            },
            {
              // Restricts every @/domains/** import except the public entry
              // points: a bare domain import (resolves to index) or an explicit
              // index/client/server file, with or without extension. Private
              // implementation files and sub-module entry points such as
              // @/domains/users/auth/server are matched and rejected.
              regex: "^@/domains/(?!([^/]+)(?:/(?:index|client|server)(?:\\.[cm]?[jt]sx?)?)?$).+$",
              message: "Import domain modules only through their public index, client, or server entry points (e.g. @/domains/users/server).",
            },
          ],
        },
      ],
    },
  },

  // Runtime dependency flow is domain -> lib; /lib never imports domains.
  // /lib/auth is allowed since it needs user data
  {
    files: ["lib/**/*.{ts,tsx}"],
    ignores: ["lib/auth/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/domains/*"],
              message: "/lib must not depend on domain modules.",
            },
          ],
        },
      ],
    },
  },

  // Kebab-case filenames. Scoped to filenames only: Next.js route syntax
  // ([id], [...slug], (group), @slot) applies to directories, not files.
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: { "check-file": checkFile },
    rules: {
      "check-file/filename-naming-convention": [
        "error",
        { "**/*.{js,mjs,cjs,ts,tsx}": "KEBAB_CASE" },
        {
          ignoreMiddleExtensions: true,
          errorMessage:
            "Filenames must be kebab-case (dots allowed for extensions, e.g. next.config.ts). Next.js route syntax such as [id] and (group) applies to directories, which are not checked here.",
        },
      ],
    },
  },

  // Disable type-aware rules for JavaScript files outside the TS project.
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
