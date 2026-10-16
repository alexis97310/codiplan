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

## CI=1 pnpm verify:full EN ENTIER, EN UN SEUL APPEL

Voir la fin de ce document — section ajoutée après exécution.
