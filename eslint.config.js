import antfu from "@antfu/eslint-config";

export default antfu({
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
});
