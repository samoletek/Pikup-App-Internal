const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");
const globals = require("globals");

module.exports = defineConfig([
  {
    ignores: [
      "node_modules/**",
      "android/**",
      "ios/**",
      ".expo/**",
      "dist/**",
      "coverage/**",
      "__generated__/**",
      "supabase/functions/**",
    ],
  },
  expoConfig,
  {
    files: ["**/__tests__/**/*.[jt]s?(x)", "jest.setup.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    rules: {
      "no-console": "error",
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
    },
  },
  {
    files: ["services/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: [
      "hooks/**/*.{js,jsx,ts,tsx}",
      "screens/**/*.{js,jsx,ts,tsx}",
      "components/**/*.{js,jsx,ts,tsx}",
      "contexts/**/*.{js,jsx,ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/config/supabase"],
              message: "Import Supabase only inside service/repository modules.",
            },
            {
              group: ["**/services/repositories/**"],
              message: "UI layers must consume domain services/hooks, not repositories directly.",
            },
            {
              group: ["**/supabase/functions/**"],
              message: "Edge function sources are infra-only and must not be imported into app runtime.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["scripts/**/*.js", "plugins/**/*.js"],
    rules: {
      "no-console": "off",
    },
  },
]);
