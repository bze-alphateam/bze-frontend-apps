// eslint-config-next 16 is flat-config-native — import its flat arrays directly.
// (Do NOT use FlatCompat.extends("next/...") — that eslintrc bridge crashes with a
// circular-JSON error against the flat-native package.)
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "dist/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
];

export default eslintConfig;
