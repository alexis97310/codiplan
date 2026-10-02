# Captures — 9CW-TP-S6-SECOND-FACTEUR

Prises par `tests/e2e/captures-9cw-tp-s6-second-facteur.spec.ts` (env `CAPTURES_9CW`), sur
une scène forgée en `beforeAll`, effacée en `afterAll` — identités jetables préfixées
`9cw.` (I9). Comptes de TEST uniquement : la clé, les codes de secours et le compte qui
les porte (`9cw.*@codima.test`) sont de démonstration, jetés à chaque exécution.

- `*-avant.png` — rejoué sur le code d'AVANT ce lot (`git worktree`, commit `d19a9d0`,
  9CS-EN-RETARD-VERT-A-ZERO — passation, le dernier commit avant ce lot).
- `*-apres.png` — après le dernier commit de code de ce lot (`35e493b`,
  9CW-TP-S6-SECOND-FACTEUR — saisie d'un code de secours à la connexion).

## Ce que les quatre paires montrent (D149)

`enrolement-mot-de-passe-*` — l'étape mot de passe de `/enrolement`, inchangée par ce lot
(aucun secret n'y transite encore).

`enrolement-cle-qr-codes-*` — la clé, les codes de secours et le code à saisir, juste
après la préparation. **Avant** : pas de QR, pas de « Se déconnecter » — la page reposait
sur `cle=`/`uri=`/`secours=` dans l'URL de redirection (TR-36). **Après** : un QR apparaît
sous la clé, et « Se déconnecter » sous le formulaire — la clé et les codes sont relus
côté serveur (`preparationEnAttente`), plus jamais portés par l'URL.

`enrolement-code-faux-*` — un code à six chiffres FAUX soumis à cette même étape.
**Avant** : la page retombe sur l'étape mot de passe — la clé est perdue, il faut tout
recommencer (TR-39, bug reproduit tel quel). **Après** : la clé, le QR et les codes de
secours restent affichés à côté du message d'erreur — seule la relecture serveur rend ce
comportement possible, puisque rien dans l'URL ne portait plus la clé à ce moment.

`connexion-code-secours-lien-*` — l'étape « Code à six chiffres » de `/connexion/code`,
à la connexion SUIVANTE d'un compte déjà enrôlé. **Avant** : aucun autre moyen que le code
TOTP, pas de « Se déconnecter ». **Après** : un lien repliable « Utiliser un code de
secours » (TR-34) et « Se déconnecter » (TR-38) apparaissent sous le formulaire.

## Piège connu — la clé affichée doit rester le premier `<code>` de la page

`tests/e2e/setup/session.ts` (`activerLeSecondFacteur`) et
`scripts/captures.mts` lisent la clé par `page.locator("code").first()` : ce script
de captures en dépend aussi (`codeCourant`). Le QR ajouté par ce lot est un `<svg>`, pas
un `<code>` — l'invariant tient.
