# 99N-AUDITS-26-09 — passation

## Ce que j'ai change (et ce que ca change pour l'exploitation)

Deux audits d'ergonomie du 26/09/2026, jusqu'ici hors depot (sur le poste de bureau, dans
`OneDrive`), sont maintenant versionnes dans `docs/` :

- `docs/audit-ergonomie-2026-09-26.md` — l'audit « GR » (gains GR1-GR18), copie a l'identique
  depuis `.../CODIPLAN/audit-ergonomie-26-09/audit-ergonomie-2026-09-26.md`.
- `docs/audit-ergonomie-2026-09-26-captures.md` — l'audit « captures » (constats C-A1, C-G5...),
  copie a l'identique depuis `.../CODIPLAN/docs/audit-ergonomie-2026-09-26.md`. Nomme different
  du precedent pour ne pas ecraser le premier malgre le nom de fichier source identique.
- `docs/audit-2026-09-26-captures/{navigation,lisibilite,mobile}.md` — les trois angles de
  l'audit « captures », copies a l'identique depuis `.../CODIPLAN/docs/audit/`.

Rien d'autre n'a change : aucun code, aucun test, aucun ecran, aucune migration. Les deux
audits deviennent lisibles et citables depuis le depot au lieu de vivre uniquement sur un
poste de travail.

## Ce que j'ai mesure (comptes AVANT/APRES)

- AVANT : 0 des cinq fichiers dans le depot (`git status` ne les listait pas, `ls docs/` ne
  les contenait pas).
- APRES : les cinq fichiers presents sous `docs/`, chacun verifie identique a sa source par
  `cmp` (aucune difference signalee, donc aucune sortie de `cmp` autre que le succes implicite).
- `pnpm format:check` : vert avant et apres chaque commit (`docs/` est dans `.prettierignore`,
  donc les nouveaux fichiers ne sont pas lus par ce controle — attendu, ecrit dans le constat
  du ticket).
- `pnpm test` : 268 fichiers / 2886 tests, verts avant et apres chaque commit, aucune
  regression.
- `git log --oneline -3` montre les deux commits de ce lot au sommet ; `git status --porcelain`
  ne liste plus aucun des cinq fichiers du lot (seuls les 68 PNG/PDF etrangers restent modifies,
  voir ci-dessous).

## Ce que j'ai tranche et pourquoi

- Le nom de fichier destination du second audit est `docs/audit-ergonomie-2026-09-26-captures.md`
  et non `docs/audit-ergonomie-2026-09-26.md` (qui aurait ecrase le premier) : le ticket
  demandait explicitement un nom distinct, et les deux audits portent des constats differents
  (GR1-GR18 contre C-A1/C-G5...) qu'il ne faut pas confondre sous un seul nom.
- Les trois angles sont verses tels quels dans `docs/audit-2026-09-26-captures/` (memes noms
  de fichiers `navigation.md`, `lisibilite.md`, `mobile.md` que la source), sans les renommer :
  le dossier parent porte deja la date et le mot « captures », inutile de repeter dans les noms
  de fichiers.
- Deux commits distincts (un par audit) plutot qu'un seul : chaque source est une unite
  independante et le ticket demandait un commit separe pour chacune.

## Ce que je n'ai PAS fait

- Je n'ai touche a aucun des 68 fichiers PNG/PDF deja modifies dans `docs/propositions/*/captures/`
  au demarrage du lot — etrangers a ce ticket, listes ci-dessous.
- Je n'ai pas fait tourner `pnpm verify:full` : documentation seule, la file le joue apres moi
  comme prevu par le ticket.
- Je n'ai rien change au contenu des quatre fichiers copies (aucune reformulation, aucune
  correction meme evidente) : la consigne etait de les verser sans y toucher.
- Je n'ai pas supprime les fichiers sources sur le poste de bureau (hors depot, hors perimetre
  de ce ticket).

## Les pieges pour la session suivante

- Les deux audits sources portaient le meme nom de fichier (`audit-ergonomie-2026-09-26.md`)
  mais dans des repertoires differents et avec un contenu totalement different : si un futur
  lot doit a nouveau verser un document depuis ce dossier de bureau, verifier le CHEMIN complet,
  pas seulement le nom de fichier, avant de copier.
- `docs/` est dans `.prettierignore` : `pnpm format:check` ne protege pas la mise en forme de
  ces fichiers Markdown. Ne pas s'y fier pour detecter un probleme d'encodage ou de fin de
  ligne sur de futurs ajouts sous `docs/`.
- 68 fichiers PNG/PDF sous `docs/propositions/*/captures/` etaient deja modifies (non commit
  es) au demarrage de ce lot, dans des dossiers de propositions anciens (47, 48, 50, 52, 55,
  56, 57, 59, 60, 64, 65, 66, 67, 69, 75, 76, 79, 80, 81, 83, 84, 86, 88, 89, 92, 93, 96, 99A,
  99D, 99F et d'autres au-dela de la troncature affichee). Je ne les ai ni touches ni commites ;
  un lot futur qui les concerne devra les traiter explicitement — ils ne viennent pas de cette
  session.

## Ce qui reste a faire

- Rien pour ce lot precis : les deux audits sont verses, verifies identiques, commit es
  separement, et la passation est ecrite.
- Une decision separee (hors perimetre de ce ticket) reste ouverte : que faire des 68 fichiers
  de captures modifies hors ce lot — les restaurer, les recommiter, ou les laisser tels quels.
