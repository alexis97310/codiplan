# 9L26-DURCISSEMENTS-AUTH — passation

Quatre points. Aucune migration, aucun écran dont le rendu change (le point 4 déplace où une valeur
déjà affichée est LUE, jamais ce qui s'affiche — aucune capture), aucun test existant assoupli.
Décision d'Alexis du 10/11/2026 pour l'ensemble du lot, arbitrage **D274** (`docs/arbitrages.md`),
une règle d'exploitation étant renforcée sur l'authentification.

## Point 1 — l'inscription se ferme aussi par l'option de la bibliothèque

`lib/auth/inscription-fermee.ts` ferme l'inscription en comparant le CHEMIN de la requête à une
liste close — par construction sensible à la casse et à l'encodage. `lib/auth/config.ts` pose
désormais `disableSignUp: true` sur l'instance de PRODUCTION (`creerAuth()` sans contexte
administratif) : la bibliothèque refuse `signUpEmail` À L'INTÉRIEUR de son propre point d'entrée,
quelle que soit la forme du chemin qui y a conduit — une défense qui ne dépend plus du texte, en plus
du filtre existant.

`administration === undefined` distingue l'instance de production des instances ADMINISTRATIVES
construites par ce même module pour un geste précis — l'amorçage (Q1/D65) et le chemin d'Équipe
(D162), les deux seuls appelants restants de `auth.api.signUpEmail` (`tests/unit/auth/
amorcage-retrait.test.ts` le tient) — qui, elles, ne portent pas cette option et restent
fonctionnelles. Vérifié : les ~30 fichiers de test qui construisent une instance `authAdmin` pour
leurs fixtures passent tous `administration`, donc aucun n'a dû changer.

Épreuve, `tests/isolation/inscription-fermee-option.test.ts` : l'instance de production refuse
`signUpEmail` même appelée directement ; l'instance administrative reste autorisée ; une variante de
CASSE du chemin (`estCheminFerme` rend `false` dessus — témoin explicite) est quand même refusée par
`auth.handler` ; une variante d'ENCODAGE l'est aussi.

**Avertissement mesuré pendant ce point, sans rapport avec l'option elle-même** : `pnpm tsc --noEmit
-p .` lancé directement (sans passer par `pnpm typecheck`) épuise la mémoire par défaut de Node sur
ce dépôt — `pnpm typecheck` porte déjà `--max-old-space-size=6144` dans `package.json` pour cette
raison, et passe sans erreur. Noté ici pour la prochaine session qui verrait la même panne : ce n'est
pas une régression de ce lot, c'est `tsc` nu qui manque de mémoire sur ce projet, indépendamment de ce
qu'on lui fait vérifier.

## Point 2 — `second_facteur_valide` : mesuré, aucune correction nécessaire

`lib/auth/config.ts` déduit `second_facteur_valide` de `mfa_actif` à la création de session. Deux
chemins pourraient en principe le rendre vrai sans vérification à la connexion COURANTE :

- une session transitoire, créée pendant que Better Auth vérifie les identifiants, AVANT que le
  second facteur n'ait été présenté — mesuré que le greffon `two-factor` la supprime lui-même dans la
  MÊME requête (son propre « after hook » sur `/sign-in/email`) avant de renvoyer sa réponse ; aucun
  cookie qui en proviendrait ne rend donc de session active. Épreuve d'exécution,
  `tests/isolation/second-facteur-session-pre-verification.test.ts`, sur un compte réellement enrôlé
  (par le chemin `lib/auth/enrolement.ts`) : la connexion suivante annonce `twoFactorRedirect: true`,
  et le cookie qu'elle porte (s'il en porte un) ne rend aucune session via `obtenirSession`.
- l'« appareil de confiance » de Better Auth (`trustDevice`), qui laisserait une connexion SUIVANTE
  créer une session sans représenter le facteur, en s'appuyant sur une vérification antérieure
  authentique — mesuré qu'aucun appel de ce dépôt ne passe jamais `trustDevice`, donc que Better Auth
  ne pose jamais le cookie qui l'activerait : le mécanisme est entièrement inerte, par absence de
  sollicitation plutôt que par fermeture explicite de la bibliothèque. Gardien statique,
  `tests/unit/auth/second-facteur-sans-trust-device.test.ts`, qui balaie `app/`, `components/` et
  `lib/` et rougit au premier appel qui passerait `trustDevice` — pour que l'ajout futur d'une case
  « se souvenir de cet appareil » ne rallume pas ce chemin sans qu'on l'ait relu.

Aucune ligne de production n'a changé pour ce point : les deux chemins restent fermés, et chacun est
désormais PROUVÉ plutôt que supposé — c'est tout ce que ce point ajoute.

## Point 3 — les deux fonctions acceptant un contexte sortent des fichiers `"use server"`

`resolutionScanBureau`/`resolutionScanTerrain` étaient exportées de `components/machines/
scan-qr-bureau.ts`/`scan-qr-terrain.ts`, deux fichiers `"use server"`, tout en prenant un
`ContexteActif` en argument — une fonction exportée d'un tel fichier devient un point d'entrée que le
navigateur peut invoquer directement, avec les arguments de son choix. Un contexte forgé aurait rejoué
la garde de rôle sur une valeur inventée ; côté terrain, `contexte.utilisateurId` gouverne en plus le
rattachement interrogé, et un contexte forgé aurait ouvert la fiche de n'importe quelle intervention,
de n'importe quel technicien, de n'importe quelle société.

Les deux fonctions vivent désormais dans des modules SANS directive (`scan-qr-bureau-resolution.ts`,
`scan-qr-terrain-resolution.ts`, nouveaux) — même position que `scan-qr-resultat.ts`, qui ne porte que
des types. Seules `resoudreScanBureau`/`resoudreScanTerrain`, qui lisent leur contexte depuis
`headers()` et n'acceptent jamais de contexte en argument, restent exportées des fichiers
`"use server"`. `ScannerQr` (`components/machines/scanner-qr.tsx`) n'appelle que ces deux-là ; aucun
écran ne change.

`tests/isolation/resolution-scan.test.ts`, qui éprouvait déjà les deux fonctions contre la base
jetable, importe désormais depuis les nouveaux modules — aucune assertion modifiée.

## Point 4 — l'adresse du destinataire ne voyage plus dans une URL de redirection

Six routes redirigeaient vers `/parametres/equipe` après l'envoi d'un lien d'accès en portant
`destinataire` (l'adresse électronique) dans la query string : `app/api/equipe/[id]/envoyer-acces`,
`.../nouveau-lien`, leurs deux équivalents `.../bureau/...`, `app/api/equipe/bureau/creer` et
`app/api/techniciens/creer`. Une adresse dans une URL reste dans l'historique du navigateur et les
journaux du serveur ; et la valeur n'était jamais revérifiée côté écran, ce qui aurait aussi laissé
quiconque forge l'URL afficher un bandeau de confirmation pour une adresse de son choix.

Les six routes ne portent plus `destinataire` ; elles continuent de nommer la CIBLE
(`technicien`/`compte`), déjà nécessaire par ailleurs. `app/(back-office)/parametres/equipe/page.tsx`
relit l'adresse à afficher sur la liste des techniciens/comptes de bureau déjà chargée pour l'écran,
par cette même cible — jamais depuis un paramètre que la requête aurait pu fournir. Le texte rendu à
l'écran est identique à l'ancien ; aucune capture.

Deux tests unitaires assertaient `url.searchParams.get("destinataire")` sur l'ancienne valeur
(`tests/unit/techniciens/creer-envoi-acces-non-parti.test.ts`,
`tests/unit/equipe/bureau-creer-envoi-acces-non-parti.test.ts`) : corrigés pour exiger `null` sur ce
paramètre — le comportement a changé délibérément, ce n'est pas un assouplissement.

## Vérification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (6011 tests, 537 fichiers) et `pnpm test:isolation` (2507
tests, 257 fichiers) passent tous sans erreur ni avertissement, à l'état final du lot. `pnpm
verify:full` est laissé à la file, comme demandé.

## État du dépôt

`main` était extrait ailleurs au démarrage (HEAD détachée sur `origin/main`, comme les lots
précédents de cette série) : le travail est posé en détaché, commit par commit, sur ce même point de
départ. Aucun push.
