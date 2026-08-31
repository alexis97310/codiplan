import { dirname } from "path";
import { fileURLToPath } from "url";

import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "docs/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // CLAUDE.md §5 — définition de « terminé ».
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "error",
      // D26, ticket L0-11 — aucune chaîne littérale dans le JSX.
      //
      // C'est l'ÉCHO de la règle, pas la règle : le gardien
      // `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` la porte, avec les
      // attributs visibles, les métadonnées, les requêtes d'écran et la forme
      // en deux temps que cette règle-ci ne voit pas. Elle est ici parce qu'un
      // avertissement dans l'éditeur, à la frappe, coûte moins cher qu'une
      // vérification échouée dix minutes plus tard. Les deux formes qu'elle
      // refuse — le texte nu entre deux balises, et le littéral dans un
      // conteneur — ont été mesurées sur une faute réellement écrite dans
      // `app/page.tsx` : le gardien les refuse aussi. Elle en dit donc moins,
      // jamais autre chose.
      //
      // `ignoreProps` laisse passer les propriétés : `className`, `variant` ou
      // `href` ne sont pas du texte, et c'est le gardien qui distingue, parmi
      // les attributs, les quelques-uns qu'un humain lit.
      "react/jsx-no-literals": [
        "error",
        { noStrings: true, ignoreProps: true, allowedStrings: [] },
      ],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
];

export default eslintConfig;
