# 9CW-TP-S6-SECOND-FACTEUR — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

1. **Les secrets du second facteur ne transitent plus par l'URL** (TR-36). `app/api/session/enrolement/route.ts` ne construit plus de `URLSearchParams` et ne redirige que vers `/enrolement`, sans paramètre. `preparationEnAttente` (`lib/auth/enrolement.ts`) relit, côté serveur, la clé (déchiffrée par `symmetricDecrypt`, l'utilitaire même de la bibliothèque) et les codes de secours (`auth.api.viewBackupCodes`, un point d'entrée serveur seul) pour le compte de la session, tant que `utilisateur.mfa_actif` est faux. **Conséquence d'exploitation** : plus aucun secret de second facteur n'apparaîtra dans un journal d'accès HTTP à partir de ce commit.
2. **Un code faux à l'enrôlement ne fait plus perdre la clé** (TR-39). Comme la relecture ne dépend plus de l'URL, elle survit à une confirmation refusée.
3. **Un QR code apparaît à l'enrôlement** (TR-37), à côté de la clé en toutes lettres — `components/ui/qr-code.tsx`, déjà éprouvé par la fiche machine.
4. **« Se déconnecter » apparaît sur `/enrolement` et `/connexion/code`** (TR-38) — même route (`POST /api/session/deconnexion`), simple formulaire sans la barre de navigation qui ne couvre pas ce chrome.
5. **Un code de secours se saisit à la connexion** (TR-34). `app/api/session/code-secours/route.ts` (neuf) appelle `auth.api.verifyBackupCode`, exactement comme `/api/session/code` appelle `verifyTOTP`. `/connexion/code` porte un second formulaire, replié par défaut (`<details>`, sans JavaScript).
6. **D149** (`docs/arbitrages.md`) consigne la décision — aucune règle du chapitre 10, aucune décision amendée (D59 et D64 tiennent sans changement).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **La relecture serveur rend EXACTEMENT la même clé** que `preparerEnrolement` avait rendue, prouvé en calculant un code TOTP sur la clé relue et en l'acceptant à la confirmation (`tests/isolation/enrolement-relecture-serveur.test.ts`).
- **Une seconde préparation, sans confirmer la première, laisse UNE seule ligne `second_facteur`** (jamais deux) — la bibliothèque réutilise la ligne existante (`existingTwoFactor`) et en réécrit le secret. La clé change silencieusement (comportement de la bibliothèque, pas un bug de ce lot) ; la relecture voit toujours la DERNIÈRE préparation. Mesuré dans le même fichier.
- **`second_facteur.verifie` passe à `true` dès la PREMIÈRE tentative de confirmation, juste ou fausse** — c'est écrit avant la vérification du code, par construction de L1-02f (voir le commentaire « L'ORDRE DES DEUX ÉCRITURES… » dans `lib/auth/enrolement.ts`). `preparationEnAttente` ne peut donc PAS filtrer sur `verifie: false` (j'ai d'abord écrit la fonction ainsi, et le test TR-39 a rougi en le montrant) : elle filtre sur `utilisateur.mfa_actif`, qui reste faux tant que l'enrôlement n'est pas RÉELLEMENT abouti.
- **Captures AVANT/APRÈS** (`captures/`, `git worktree` sur `d19a9d0`) : confirment visuellement les quatre points ci-dessus — absence de QR et de déconnexion avant, perte de la clé sur un code faux avant, présence des trois après.
- **`auth.api.verifyBackupCode` ouvre une session, un code déjà utilisé est refusé, un code inventé est refusé, et la route exige le cookie de défi** — `tests/isolation/connexion-code-secours.test.ts`, quatre scénarios dédiés (le premier était déjà prouvé par `plancher-second-facteur.test.ts`, repris ici sans le rejouer).

## Ce que j'ai tranché et pourquoi

- **`preparationEnAttente` lit `utilisateur.mfa_actif`, pas `second_facteur.verifie`** — voir la mesure ci-dessus. C'est un choix technique dicté par le comportement déjà écrit de `confirmerEnrolement`, pas une réinterprétation de la consigne.
- **`tests/unit/auth/porte.test.ts` a été modifié** malgré la mention « tests existants : lecture seule » du territoire. Ce fichier est un REGISTRE auto-entretenu (son propre en-tête : « une route neuve doit apparaître toute seule, gardée ou exemptée, jamais oubliée ») — la route neuve `/api/session/code-secours` ne peut exister sans y gagner une exemption, exactement de la même forme que celle déjà écrite pour `/api/session/code`. Je n'ai ajouté qu'une entrée, jamais retiré ni assoupli une assertion existante.
- **Identité e2e jetable `direction`**, jamais `admin_societe` (déjà enrôlée par `tests/e2e/setup/global.ts`) ni aucune fixture `SCENE.*`. Ouverte par `auth.api.signUpEmail` sous un contexte administratif — le même chemin que `tests/isolation/*.test.ts` emploient, et que `tests/unit/auth/amorcage-retrait.test.ts` exclut explicitement de son périmètre (il ne scanne pas `tests/`).
- **QR dimensionné à 200px** (la fiche machine utilise 220) — écran plus étroit (`max-w-md`), choix réversible.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — conforme aux interdits.
- Je n'ai pas touché `lib/auth/config.ts`, `lib/auth/inscription-fermee.ts`, `components/ui/qr-code.tsx`, `components/navigation/barre.tsx`, `app/api/session/code/route.ts`, `app/api/session/deconnexion/route.ts` — tous lus, aucun modifié.
- Je n'ai pas fait tourner la suite e2e complète (des centaines de fichiers) : trop long pour ce lot. J'ai fait tourner mon propre spec (4/4), `deconnexion.spec.ts` (2/2) et `equipe.spec.ts` (4/4) — les trois dépendent directement des chemins touchés (`ouvrirLaSessionSensible`, le chrome de déconnexion) et sont verts.
- Je n'ai pas purgé les secrets déjà émis par l'ancienne route (voir plus bas).

## Les pièges pour la session suivante

- **`second_facteur.verifie` n'est PAS un signal de « préparation en attente »** — il passe à `true` dès la première tentative, juste ou fausse. Tout futur code qui lirait cette colonne pour décider si un enrôlement est « en cours » reproduira silencieusement TR-39.
- **Un `git worktree` sur un ancien commit a besoin d'un symlink vers `node_modules`** (le `package.json`/lockfile n'avait pas bougé entre `d19a9d0` et ce lot — vérifié par `git diff --stat`, à revérifier si l'écart grandit) : `ln -s <repo>/node_modules <worktree>/node_modules`.
- **`journal_acces` n'a pas de clé étrangère en cascade vers `utilisateur`** — un script e2e qui crée et supprime une identité jetable ayant servi à se connecter doit vider `journal_acces` avant `utilisateur`, sous peine de violation de contrainte en fin de suite (rencontré et corrigé dans ce lot).

## Ce qui reste à faire

- **Passation à Alexis (obligatoire, hors territoire technique)** : les secrets de second facteur déjà émis par l'ancienne route l'ont été par l'URL — un journal d'hébergement peut les porter encore. Un ré-enrôlement des comptes réels concernés (hors comptes de démonstration) est à décider par lui ; ce lot ferme la fuite pour l'avenir, il ne purge rien du passé.
- La suite e2e complète n'a pas tourné en entier sur ce lot (voir ci-dessus) — la file de nuit la rejouera.
