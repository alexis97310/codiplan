# 9I5-ECRANS-INCOMPLETS-LE-DISENT — passation

## Ce qui a été fait

Cinq écrans, chacun mesuré contre sa maquette (ou contre la décision qui l'en écarte), puis une phrase ajoutée —
même composant, même style que le sous-titre d'« Indicateurs du mois » (`indicateurs.sous_titre`, D170) : un
second `<p className="text-app-encre-faible text-[13px] font-bold">` (ou, pour « Ma journée », qui n'utilise pas
`Page`, le même style recopié à la taille mobile imposée, 16 px, D143) quand le sous-titre de l'écran portait
déjà autre chose ; le `sousTitre` de `Page` lui-même quand il était libre (fiche machine).

| Écran | Ce qui manque (mesuré) | Source | Phrase ajoutée |
|---|---|---|---|
| **Tableau de bord** | « À facturer », « Retours sous 30 jours » et les réserves VGP sans intervention sont nommées dans `TUILES_PAR_COMPOSITION` mais n'ont aucune lecture et sont retirées du rendu, quel que soit le rôle. | D189, `TUILES_ABSENTES` (`docs/arbitrages.md`) | « Ce tableau compte les interventions et le parc ; il ne facture pas, ne suit pas les retours sous 30 jours, ni les réserves VGP sans intervention. » |
| **VGP** | Deux onglets seulement (Registre, Familles à déterminer) ; aucun onglet « Réserves ». | D166 (« Aucun onglet « Réserves » : l'état n'existe pas encore (lot suivant, avec migration). C'est un ÉCART NOMMÉ à D125. ») | « Ce registre montre ce qu'on nous a transmis et les familles à déterminer ; les réserves n'y ont pas encore leur propre onglet. » |
| **Fiche machine** | Pas de carte « VGP » séparée, pas de panneau « Gestes sur la machine » (changer l'état, transférer, remplacer, sortir du parc), pas d'historique des états/emplacements. | D192, QT-12 | « Cette fiche montre l'identité de la machine et son historique ; les gestes sur la machine (changer l'état, transférer, remplacer, sortir du parc) et la carte VGP séparée n'y sont pas encore. » |
| **Données à compléter** | 4 points comptés ; 5 autres nommés par l'audit MO-7 restent hors de ce lot. | D170, QE-19 (a) (« Les cinq AUTRES points que l'audit MO-7 nomme — sites sans zone/trajet, agences sans horaires, imports avec rejets, personne prévenu, zones sans forfait — restent hors de ce lot ») | « Cette page compte quatre points. Cinq autres — sites sans zone ni trajet, agences sans horaires, imports avec rejets, personne prévenu, zones sans forfait — restent hors de cette page. » (« site »/« agence » composés depuis `motDansUnePhrase`, jamais écrits dans le dictionnaire, §3/D5/D47) |
| **Ma journée (terrain)** | Aucune liste ni fiche « Machines » ; la barre du bas ne porte que « Journée » et « Profil ». | D161 (« "Machines" et "Scanner" […] arriveront avec TP-PARC » ; « CE QUE ÇA NE TOUCHE PAS : […] aucune fiche "Mes machines" ») | « Cette page montre votre journée ; les machines du terrain (liste, fiche) n'y sont pas encore — seuls « Journée » et « Profil » existent dans la barre du bas. » |

Un écran du lot de référence (« Indicateurs du mois ») portait déjà sa propre phrase — il n'a pas été touché.

## Ce que je n'ai pas fait

Rien d'identifié comme manquant sans source n'a été laissé de côté : les cinq écrans du périmètre avaient chacun
une mesure ET une raison écrite. Je n'ai donc rien eu à signaler comme « manque sans décision ».

## Décisions de forme prises en cours de route

- **Vocabulaire imposé (§3, D5/D47)** : la phrase de « Données à compléter » nomme « sites » et « agences ». Le
  gardien `tests/unit/i18n/vocabulaire-impose.test.ts` refuse ces mots en dur dans `lib/i18n/fr.ts` hors des clés
  `vocabulaire.*`. La clé a donc été coupée en trois (`..._1`, `..._2`, `..._3`) et la page compose les deux mots
  depuis `motDansUnePhrase("site", true)` / `motDansUnePhrase("agence", true)`, comme le reste du dépôt.
- **Typographie du terrain (D143, point 8)** : le terrain n'autorise que 16/18/24/28 px, jamais le 13 px du
  back-office. La phrase de « Ma journée » utilise `text-16`, la même taille que la ligne de date juste au-dessus,
  plutôt que de recopier `text-[13px]` du composant `Page`.

## Tests

Un test de rendu par écran, dans `tests/unit/<domaine>/9i5-ce-qui-manque.test.tsx` : rendu réel (RTL) du composant
`Page` (ou, pour le terrain, du même style recopié tel quel) avec la clé réelle du dictionnaire — jamais un texte
en dur — plus une assertion de contenu (présent, sans date promise). Les 483 fichiers de `pnpm test` passent
(5192 tests), `pnpm typecheck`, `pnpm lint` et `pnpm format` sont verts.

## Captures

`docs/propositions/9I5-ECRANS-INCOMPLETS-LE-DISENT/captures/{avant,apres}/`, 375 et 1280 px, prises avec
`tests/e2e/captures-9i5-ecrans-incomplets.spec.ts` (`CAPTURES_9I5=<dossier> pnpm playwright test
tests/e2e/captures-9i5-ecrans-incomplets.spec.ts`) — AVANT sur un `git worktree` au commit d'avant ce lot
(`a47991560`, node_modules et `.env` repris du dépôt principal), APRÈS sur ce commit-ci. Dix paires (un écran ×
deux largeurs) :

| Fichier | avant (octets) | après (octets) |
|---|---:|---:|
| tableau-de-bord-1280.png | 226 571 | 231 279 |
| tableau-de-bord-375.png | 174 802 | 181 800 |
| vgp-1280.png | 212 997 | 217 722 |
| vgp-375.png | 189 263 | 194 415 |
| fiche-machine-1280.png | 138 393 | 145 672 |
| fiche-machine-375.png | 103 488 | 110 669 |
| donnees-a-completer-1280.png | 58 682 | 64 966 |
| donnees-a-completer-375.png | 30 712 | 36 983 |
| terrain-ma-journee-1280.png | 59 059 | 69 704 |
| terrain-ma-journee-375.png | 51 854 | 56 963 |

Vérifiées à l'œil (vgp-1280, fiche-machine-1280, terrain-ma-journee-375) : la phrase est absente en AVANT,
visible en APRÈS, au bon endroit, sans rien déplacer d'autre à l'écran.

## Point d'arrêt

Aucun. Les cinq écrans sont verts, un commit par écran (voir `git log`), passation committée avant
`verify:full`.
