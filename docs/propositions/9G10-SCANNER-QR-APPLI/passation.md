# 9G10-SCANNER-QR-APPLI — passation

## Reprise 9G10A (24/10/2026)

Point de départ : la garde `9G10-SCANNER-QR-APPLI-garde` (9 commits, bf339c30
+ 5 points livrés), vérifiée indépendamment ROUGE deux fois le 24/10 (05:25,
05:30) — `next build` en `JavaScript heap out of memory` au plafond 4096 Mo.
9H1D (`ed56fde5`, publié 24/10 10:20) a porté ce plafond à 6144 avec l'accord
d'Alexis. Les points ouverts de 9G10 restaient : `test:e2e` jamais allé au
bout, et les captures prises sur un serveur de DÉVELOPPEMENT plutôt que de
PRODUCTION.

**Point 1 — la garde rejouée.** `main` étant extrait ailleurs
(`/home/aplou/codiplan`), le travail part d'une branche dédiée,
`9g10a-reprise-9g10`, à jour d'`origin/main` (`ed56fde5`). La garde se
rebase SANS CONFLIT dessus : les divergences apparentes vues dans
`git diff origin/main..garde` avant rebase (migration, fixtures 9H1C)
n'étaient que l'écart entre le point de fork et `origin/main`, pas un
conflit réel.

**Point 2 — build, isolation, e2e du territoire.** `CI=1 pnpm build` passe
(plafond 6144, confirmé). `pnpm test:isolation` passe (192 fichiers, 1679
épreuves). `tests/e2e/9g10-scanner-qr.spec.ts` échouait de façon
reproductible sur « jeton inconnu — « QR non reconnu », côté bureau comme
côté terrain » : cette épreuve change d'identité (bureau puis terrain) SUR
LA MÊME PAGE sans vider les cookies ; `/connexion` redirige un compte DÉJÀ
connecté (`app/(sans-session)/connexion/page.tsx`) au lieu de lui redemander
ses identifiants, donc le champ e-mail n'apparaissait jamais. Corrigé par
`page.context().clearCookies()` entre les deux identités, comme le fait déjà
le reste du dépôt (`9ez-logo-societe.spec.ts`, `ecrans-largeur-utile.spec.ts`).
Les 4 épreuves du fichier passent ensuite.

**Point 3 — captures reprises sur le serveur de PRODUCTION.** Nouveau
fichier rejouable `tests/e2e/captures-9g10-scanner-qr.spec.ts` (gardé par
`CAPTURES_9G10`, muet sous `pnpm test:e2e` ordinaire), sur le patron de
`captures-9edz-demandes-connexion.spec.ts`. Remplace les huit captures
prises à la main sur `next dev` le 24/10 05:09. Les deux captures de caméra
exigent un appareil FACTICE au lancement du navigateur
(`--use-fake-device-for-media-stream`) : sans lui, l'environnement n'a
AUCUNE caméra et toute tentative échoue par « absente » (`NotFoundError`)
avant même de poser la question d'une autorisation — mesuré en cours de
route sur une première tentative. Mesuré aussi : le sélecteur
`[role="status"], [role="alert"]` ne distingue pas l'état « active » d'une
région `aria-live` globale et vide qui porte le même rôle en permanence ; la
détection de l'état actif attend désormais `videoWidth > 0` sur la vidéo
elle-même. Les huit captures (375/1280 px, en viewport) sont à jour dans
`docs/propositions/9G10-SCANNER-QR-APPLI/captures/`.

**Point 4 — `verify:full`, INCOMPLET : à signaler.** `CI=1 pnpm verify`
(format:check, typecheck, lint, 469 fichiers/5079 épreuves unitaires,
test:isolation 192/1679, build) passe sans erreur — voir
`verify-final.txt`, régénéré par cette reprise. `pnpm verify:full` AJOUTE
`feries:horizon`, `audit:partitions` et surtout `test:e2e` (1581 épreuves,
un seul worker en CI) : cette dernière étape a dépassé l'heure sans
atteindre la fin (plafond de l'outil d'exécution, lui-même à l'intérieur de
la limite de 120 minutes du lot). Dans la portion observée (~1 heure sur
1581 épreuves), AUCUN échec n'était visible — seules deux lignes
d'avertissement bénignes (« "En retard" ne vaut pas 0 au moment de
l'épreuve » avec son propre mécanisme de repli documenté, et un
`[Error: aborted] { code: 'ECONNRESET' }` côté `[WebServer]`, sans échec de
test associé). **`test:e2e` n'a donc pas été rejoué en entier par cette
reprise** — ni confirmé vert, ni trouvé rouge sur une épreuve précise. Une
exécution ultérieure doit soit lui donner plus de temps (en arrière-plan,
suivie plutôt que tenue au premier plan sur un budget de 120 minutes), soit
le fractionner par fichier pour isoler un éventuel point rouge sans tout
rejouer.

Effet de bord repéré et nettoyé : l'exécution partielle de `test:e2e` a
régénéré, par les fichiers `captures-*.spec.ts` d'AUTRES tickets, plus de
250 PNG hors du territoire de 9G10 — tous restaurés (`git checkout --`) ou
supprimés quand nouveaux, avant tout commit.

Arbre propre, branche `9g10a-reprise-9g10` à jour d'`origin/main`
(rebase sans changement : `origin/main` n'avait pas bougé). Jamais poussée.
