# Captures — 9CZ-RETOUCHES-9

Prises par `tests/e2e/captures-9cz-retouches-9.spec.ts` (env `CAPTURES_9CZ`), sur une scène
forgée en `beforeAll`, effacée en `afterAll` — identité jetable préfixée `9cz.` (I9). Compte
de TEST uniquement : la clé et les codes de secours affichés sont ceux d'un compte de
démonstration, jeté à chaque exécution.

- `*-avant.png` — rejoué sur le code d'AVANT ce lot (`lib/i18n/fr.ts` stashé
  temporairement, commit `6e5e3ed`, 9CY-RETOUCHES-8 — passation et capture de preuve, le
  dernier commit avant ce lot).
- `*-apres.png` — après le commit de code de ce lot (`ba9d171`, 9CZ-RETOUCHES-9 — D64
  prouvé sur le code de secours, texte, outils de test).

## Ce que la seule paire montre (point 2 du lot)

`enrolement-codes-secours-aide-*` — l'étape clé + QR + codes de secours de `/enrolement`,
juste après la préparation (même étape que `enrolement-cle-qr-codes-*` de
`docs/propositions/9CW-TP-S6-SECOND-FACTEUR/captures/`).

**Avant** : « Notez-les maintenant : ils ne seront plus affichés. » — faux depuis 9CW, les
codes restent relus côté serveur tant que l'enrôlement n'est pas confirmé.

**Après** : « Notez-les maintenant : ils restent affichés jusqu'à la confirmation de
l'activation, plus jamais après. » — le texte dit maintenant ce que l'écran fait
réellement.

Aucun autre écran n'est touché par ce lot (points 1 et 3 ne changent aucun texte visible).
