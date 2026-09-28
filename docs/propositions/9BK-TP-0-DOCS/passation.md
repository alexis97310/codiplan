# 9BK-TP-0-DOCS — passation

## Ce que j'ai change (et ce que ca change pour l'exploitation)

Copie a l'identique, depuis le poste local hors depot, de l'audit ergonomique de toutes les
pages du 28/09/2026 dans `docs/` :
- `docs/audit-ergonomie-2026-09-28.md` (le rapport de synthese) ;
- `docs/propositions/audit-2026-09-28/lots.md` (le decoupage en lots proposes) ;
- `docs/propositions/audit-2026-09-28/constats/` (les 10 constats par domaine : CS, IN, MO,
  PA, PV, README, TR, et les trois verifications croisees VERIF-CS-PV, VERIF-IN-TR,
  VERIF-PA-MO).

Cree `docs/propositions/audit-2026-09-28/decisions-2026-09-28.md` : les 14 decisions
d'Alexis du 28/09 (QT-1 a QT-13, QT-26) sous forme de tableau, avec le lot qui les consomme.

Pour l'exploitation : rien ne change dans l'application — c'est un lot documentaire pur.
Ce que ca change, c'est que l'audit et les decisions qui en decoulent sont desormais dans le
depot, versionnes, et que les tickets a venir (TP-ACC, TP-S, TP-CY, TP-ARG, TP-VGP, TP-PARC,
TP-A2, …) peuvent s'y referer par chemin de fichier plutot que par un dossier hors depot que
seul Alexis peut lire.

## Ce que j'ai mesure (comptes AVANT/APRES)

AVANT : `docs/audit-ergonomie-2026-09-28.md` absent, `docs/propositions/audit-2026-09-28/`
absent (verifie par `ls`, mesure a jour sur main avant le lot).

APRES : 13 fichiers ajoutes en un commit — `git show --stat HEAD` confirme 13 fichiers, tous
sous `docs/`, 4207 insertions, aucun fichier de code. Le detail :
- `docs/audit-ergonomie-2026-09-28.md` (991 lignes) ;
- `docs/propositions/audit-2026-09-28/lots.md` (189 lignes) ;
- `docs/propositions/audit-2026-09-28/constats/` : CS.md (363), IN.md (437), MO.md (444),
  PA.md (501), PV.md (417), README.md (23), TR.md (508), VERIF-CS-PV.md (98),
  VERIF-IN-TR.md (107), VERIF-PA-MO.md (108) — 10 fichiers, comme attendu ;
- `docs/propositions/audit-2026-09-28/decisions-2026-09-28.md` (21 lignes, cree par moi).

`git status --porcelain -- docs/audit-ergonomie-2026-09-28.md docs/propositions/audit-2026-09-28/`
est vide apres le commit : rien du territoire du lot ne reste non commite.

## Ce que j'ai tranche et pourquoi

Verification de donnees personnelles (I9, etape 3 du ticket) : `grep -RIniE '@|gmail|hotmail|outlook'`
sur les 12 fichiers copies plus le fichier de decisions ne remonte que des occurrences
techniques (`@@unique`, `@default` Prisma, `@media` CSS) — aucune adresse courriel, aucun nom
de personne. J'ai lu ces occurrences une par une plutot que de les exclure par regex, pour ne
pas manquer un vrai courriel colle a un `@` technique.

Le fichier `prompt-pilote-toutes-pages.md` present dans le dossier source n'a PAS ete copie,
conformement a la consigne explicite du ticket.

`docs/` etant hors Prettier (`.prettierignore`), aucun `pnpm format:check` n'etait necessaire
sur les fichiers copies eux-memes ; je l'ai tout de meme fait tourner sur l'ensemble du depot
avant le commit, par prudence, sans qu'il y ait de fichier de code a verifier.

## Ce que je n'ai PAS fait

Aucune ligne de code, aucune migration, aucun semis — hors territoire du ticket. Je n'ai pas
retouche le contenu des fichiers copies (consigne : copie a l'identique). Je n'ai pas ouvert
de ticket pour les series 2/3 des questions d'audit (QT-14 a QT-25, decisions de fin du §7) :
elles restent a poser par le ticket qui les consommera, comme le prescrit le pied du tableau
de decisions.

## Les pieges pour la session suivante

Le dossier source reste sur le poste local hors depot
(`/mnt/c/Users/aplou/OneDrive/Bureau/Développement/CODIPLAN/audit-ergonomie-28-09/`) : il ne
sera pas visible depuis une autre machine ou une session `claude -p` qui ne partage pas ce
poste. Si un futur lot doit s'y referer, il doit lire les copies dans `docs/`, pas
l'original.

`docs/propositions/audit-2026-09-28/decisions-2026-09-28.md` ne couvre que QT-1 a QT-13 et
QT-26, tel qu'exige par ce ticket. Un ticket qui consomme une decision de la serie 3 (QT-14 a
QT-25) devra l'ajouter lui-meme au tableau — ne pas supposer qu'elle y est deja.

## Ce qui reste a faire

Les lots decrits dans `docs/propositions/audit-2026-09-28/lots.md` (TP-ACC, TP-S, TP-CY,
TP-ARG, TP-VGP, TP-PARC, TP-A2, …) restent a ouvrir et a executer un par un ; ce ticket ne
fait que poser les documents et les decisions qui les guideront. Les decisions de la serie 3
(QT-14 a QT-25) et celles de fin du §7 de l'audit restent a poser avant le lot concerne.
