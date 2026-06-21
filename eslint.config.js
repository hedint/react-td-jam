import antfu from "@antfu/eslint-config";

export default antfu({
  ignores: [
    "dist/**",
    "node_modules/**",
  ],
  stylistic: {
    indent: 2,
    quotes: "double",
  },
  rules: {
    "antfu/top-level-function": "off",
    "curly": ["error", "multi-line"],
    "eslint-comments/no-unlimited-disable": "off",
    "node/prefer-global/process": "off",
    "no-console": ["error", { allow: ["info", "error"] }],
    "style/brace-style": ["error", "1tbs"],
    "style/semi": ["error", "always"],
    "vue/block-order": ["error", { order: ["template", "script", "style"] }],
  },
}, {
  files: ["**/*.{js,ts,vue}"],
  ignores: [
    "tests/**",
    "**/*.{test,spec}.{js,ts,vue}",
  ],
  rules: {
    "max-lines": ["error", { max: 500 }],
  },
});
