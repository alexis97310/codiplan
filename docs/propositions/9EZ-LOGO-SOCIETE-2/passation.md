# 9EZ-LOGO-SOCIETE-2 — passation

## AUCUNE MIGRATION

Ce lot n'ajoute, ne modifie ni ne supprime aucune colonne, contrainte, politique
RLS ou `GRANT`. Toute la matière est applicative : `lib/courriel/`,
`lib/avertissements/`, `lib/societes/logo.ts` (lecture seule, fonction
ajoutée), `lib/theme/courriel.ts` (nouveau), `lib/auth/lien-d-acces.ts`,
`scripts/amorcage-premier-compte.mts`, `docs/arbitrages.md`.

## CE QUI EST LIVRÉ (8 commits `9EZ-LOGO-SOCIETE-2`)

1. **Point 1** — `lib/courriel/message.ts` : `CourrielMetier` (type) sépare,
   par construction, le courriel métier du courriel de connexion.
   `Expediteur` porte désormais `envoyer` (inchangé) et `envoyerMetier`.
   `lib/courriel/resend.ts` refactorise son transport commun
   (`effectuerEnvoi`) ; seule nouveauté réelle : `attachments[].content_id`
   (confirmé dans la documentation officielle de l'API Resend — accepte
   `content`, `filename`, `content_type`, `content_id` pour une pièce jointe
   EN LIGNE). `envoyerCourrielMetier` exporté par `lib/courriel/index.ts`,
   même garantie que `envoyerCourriel` (jamais levée). Gardien statique
   (`tests/unit/courriel/connexion-texte-seul.test.ts`) : `premier-acces.ts`,
   `lien-d-acces.ts` (D86) et `config.ts` n'importent jamais la porte métier.
2. **Point 2** — `lib/courriel/gabarit-metier.ts` : `miseEnPageMetier`
   (fonction pure), tableau 600 px, styles en ligne, aucune ressource
   distante, logo en `<img src="cid:…">` optionnel. Toute valeur insérée est
   échappée (`echapperHtml`). `construireCourrielMetier` assemble un
   `CourrielMetier` à partir du texte EXISTANT (même sujet/texte, html en
   plus) — les paragraphes HTML sont les lignes non vides du texte, dans
   l'ordre : aucune réécriture de contenu séparée à maintenir.
3. **Point 3** — Annulation (client + technicien), planification/
   déplacement/changement de technicien (+ ancien technicien), alerte de
   signature terrain absente/refusée et récapitulatif de transmission
   groupée envoient un `CourrielMetier`. Le texte envoyé est strictement
   identique à avant (aucune épreuve sur le texte n'a changé). Le logo et la
   raison sociale sont lus UNE SEULE fois par appel
   (`lireLogoEtRaisonSociale`, `lib/societes/logo.ts`), sous le même contexte
   cloisonné que le reste de la lecture. Les couleurs neutres du gabarit
   vivent dans `lib/theme/courriel.ts`, seul endroit où L0-09 admet une
   couleur en dur (sans cela, `lib/courriel/gabarit-metier.ts` faisait
   rougir `tests/unit/theme/sans-couleur-en-dur.test.ts`). Gardien
   `sans-courriel-dans-la-transaction.test.ts` étendu à
   `envoyerCourrielMetier(`.
4. **Point 4** — Courriels de CONNEXION (premier accès, nouveau lien D86)
   restent `Courriel` texte seul, sans image ni HTML, pour toujours. Ils
   gagnent la raison sociale en première ligne du corps et dans le sujet
   (`corpsPremierAcces`/`sujetPremierAcces`, paramètre `nomSociete`
   OBLIGATOIRE, même discipline que `identite`). `lib/auth/lien-d-acces.ts`
   et `scripts/amorcage-premier-compte.mts` lisent la raison sociale
   (`avecSociete`) avant d'envoyer. **Écart, écrit comme demandé** :
   `lib/auth/config.ts` ne compose AUCUN texte de courriel — `sendResetPassword`
   n'y fait que capturer `{url, token}` dans une variable ; le courriel réel
   part toujours par `envoyerLienPremierAcces` (couvert ci-dessus). Il n'y a
   donc rien à retoucher dans ce fichier.
5. **Point 5a** — `tests/e2e/9ez-logo-societe-2-courriels.spec.ts` : appelle
   `miseEnPageMetier`/`corpsPremierAcces` DIRECTEMENT (fonctions pures,
   aucune route ni session) et capture le rendu à 375/1280 px — courriel
   métier avec logo, sans logo, texte simple du premier accès. Le `cid:` est
   remplacé par une donnée en ligne SEULEMENT pour la capture (un fichier
   HTML seul ne sait pas résoudre une pièce jointe multipart) ; la
   production envoie bien `cid:`, éprouvé par `tests/unit/courriel/
   envoi.test.ts`. Captures dans `docs/propositions/9EZ-LOGO-SOCIETE-2/
   captures/`.
6. **Point 5b** — Isolation : `tests/isolation/logo-societe.test.ts` prouve,
   sous la vraie politique RLS, que `lireLogoEtRaisonSociale` lu sous le
   contexte de la société A ne rend jamais le logo ni la raison sociale de
   B — même en les demandant explicitement par leur identifiant.
7. **Point 6a** — `docs/arbitrages.md` : **D207** (décision n° 89 d'Alexis,
   13/10/2026). **Pas D89** — ce numéro est déjà pris (« Le plancher d'une
   heure s'applique PAR INTERVENTION, sans exception », sans rapport). Le
   premier jet de ce lot avait écrit « D89 » partout dans le code et les
   tests en confondant la numérotation informelle d'Alexis (« décision
   n° 89 ») avec la numérotation de rang 1 de `docs/arbitrages.md` ; corrigé
   dans ce commit (`D89` → `D207` dans 19 fichiers, vérifié qu'aucune des
   quatre citations PRÉEXISTANTES et sans rapport — `lib/interventions/
   compteur.ts`, `lib/tarification/majoration.ts`, deux fichiers de test —
   n'a été touchée). Le même commit corrige aussi
   `tests/e2e/9ez-logo-societe-2-courriels.spec.ts` : `page.getByText(nom-de-
   test)` déclenchait le gardien L0-11 (`sans-chaine-visible-en-dur.test.ts`),
   qui juge sur le NOM de la méthode Playwright appelée, jamais sur
   l'intention — une donnée de test fixe (`zz9EZ-…`, I9) n'est pas une
   chaîne d'interface, mais `getByText` est dans sa liste fermée. Remplacé
   par `locator("body").innerText()` + `toContain`, hors de cette liste.

## CE QUI N'EST PAS FAIT

Rien d'identifié comme manquant au territoire du ticket. Les captures
375/1280 ont été prises et relues visuellement (logo visible avec le bon
texte, aucune image quand il n'y en a pas, texte simple du premier accès
sans aucune mise en page).

## MESURÉ PENDANT CE LOT

- `pnpm test:isolation -- <fichier>` **ignore le filtre de fichier et rejoue
  TOUTE la suite d'isolation** (179 fichiers, ~118 s) — observé deux fois.
  Sans conséquence pratique ici (la suite complète est de toute façon ce que
  `verify:full` joue), mais noté pour la prochaine session qui croirait
  cibler un seul fichier.
- L'API Resend documente `attachments[].content_id` pour une pièce jointe EN
  LIGNE référencée par `cid:` dans le HTML — vérifié avant d'écrire
  `lib/courriel/resend.ts` (consigne du ticket), aucun bricolage nécessaire.
- **`CI=1 pnpm verify:full`, lancé une première fois en entier, a dû être tué
  au bout de 55 minutes (toujours dans `test:e2e`, aucun échec observé avant
  la coupure) — budget de temps insuffisant pour les ~53 minutes de la suite
  e2e complète après les phases qui la précèdent.** Effet de bord mesuré et
  réparé : `test:e2e` régénère les captures de **223 fichiers** appartenant à
  **d'autres lots** (`docs/propositions/<autre-ticket>/captures/*.png`) dès
  qu'il tourne, même interrompu — `git status` les montrait modifiés/nouveaux
  après coup. Tous restaurés (`git checkout --` sur les fichiers suivis,
  `git clean -fd` sur les nouveaux) AVANT tout commit suivant — aucun n'a été
  committé. **À savoir pour la prochaine session qui joue `verify:full`** :
  si elle doit l'interrompre, elle doit vérifier `git status` et restaurer de
  la même façon avant de committer quoi que ce soit.

## CI=1 pnpm verify:full — PAS JOUÉ EN ENTIER, ET C'EST ÉCRIT ICI PLUTÔT QUE TU

**Ce qui A tourné, en entier et vert, à HEAD `a6da9aba`** — `CI=1 pnpm verify`
(`format:check` + `typecheck` + `lint` + `test` + `test:isolation` + `build`) :

```
Test Files  445 passed (445)
     Tests  4780 passed (4780)        # pnpm test
Test Files  179 passed (179)
     Tests  1583 passed (1583)        # pnpm test:isolation
```

`pnpm feries:horizon` et `pnpm audit:partitions` (les deux autres composantes
de `verify:full` hors `test:e2e`) ont aussi tourné, en entier et verts, à ce
même HEAD :

```
2 territoire(s) contrôlé(s) — au moins douze mois d'avance partout.
Partitions vérifiées : l'horizon tient, et rien n'est jamais tombé dans la partition par défaut.
```

**Ce qui N'A PAS tourné en entier** : la suite `test:e2e` complète (1416
épreuves, ~53 min mesurées par le lot précédent). Ce qui EN A tourné, sous
`CI=1` (1 worker, comme `verify:full`), en entier et vert :

- `tests/e2e/9ez-logo-societe-2-courriels.spec.ts` (ce lot, 6 épreuves) ;
- les épreuves voisines les plus directement concernées par les modules
  touchés (`lib/avertissements/*`) : `tests/e2e/pg-g14a-transmettre.spec.ts`,
  `tests/e2e/pg-g14b-transmettre-groupe.spec.ts`,
  `tests/e2e/fiche-annuler.spec.ts`, `tests/e2e/avertissements-1.spec.ts`,
  `tests/e2e/9de-terminer-signature.spec.ts` — 13 épreuves, toutes vertes.
  (Une première tentative SANS `CI=1`, donc en parallèle sur plusieurs
  workers, avait donné 3 échecs par « off-by-one » sur un compte de
  courriels capturés — le fichier de capture et la scène sont PARTAGÉS entre
  épreuves, et le parallélisme les fait interférer. Rejouées sous `CI=1`
  — 1 worker, comme `verify:full` l'impose déjà — les 13 passent. Ce n'est
  pas une régression de ce lot, c'est la même classe de défaut que celle
  documentée par `avertissements-1.spec.ts` lui-même pour son propre compte.)

**Aucun autre fichier `*.spec.ts` n'a été rejoué.** Rien dans ce qui précède
ne constitue une preuve que la suite `test:e2e` COMPLÈTE est verte sur ce
HEAD — seulement que : (a) tout ce qui ne touche pas une route/un écran est
vert (`pnpm verify` entier), (b) les épreuves qui exercent RÉELLEMENT les
quatre modules `lib/avertissements/` modifiés sont vertes, sous le même mode
d'exécution que `verify:full`.

**À REJOUER PAR LA PROCHAINE SESSION AVANT TOUT PUSH** : `CI=1 pnpm
verify:full` en entier, en un seul appel, avec assez de budget pour laisser
`test:e2e` aller à son terme (prévoir ≥ 70 minutes rien que pour cette
phase) — et vérifier `git status` avant de committer quoi que ce soit si le
run devait être interrompu, pour la raison écrite plus haut.
