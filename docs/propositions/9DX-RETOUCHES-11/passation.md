# Passation — 9DX-RETOUCHES-11

Six commits sur `main` local (détaché), aucun push :

```
354d0eca A5 : captures AVANT/APRÈS des six écrans de paramétrage, direction et ADV
ebac507e R8 (addendum) : demande jetable plutôt qu'écriture sur la fixture partagée DEMANDE_A1
07b56431 R7 : le périmètre se juge avant d'écrire la photo sur le disque
5ed83dd2 R4-R6 : D151 élargi à tous les rôles, le client éprouvé, le refus visible en capture
d26c64cf R2-R3 : les rejets d'un lot suivent le droit de son type
d8908e14 A1-A4 : trajet-zone sous exigerCapaciteComplete, vraie porte dans les épreuves
```

---

## 1. Ce que j'ai changé, et ce que ça change pour l'exploitation

**A1 — défaut réel, corrigé.** `/api/parametres/trajet-zone` appelait `exigerCapacite`
(le `○` passe) au lieu d'`exigerCapaciteComplete` : la direction, censée être en LECTURE
SEULE sur les trajets depuis D153, pouvait en réalité les ÉCRIRE. Corrigé — la direction
ne voit plus le formulaire « Régler », confirmé par capture (§2). La phrase de D153 qui
affirmait le contraire (« par le même mécanisme, `exigerCapacite`, pas
`exigerCapaciteComplete` ») est corrigée dans `docs/arbitrages.md`.

**A2.** `tests/unit/auth/porte.test.ts` porte désormais une liste close
(`PORTE_COMPLETE`, 14 routes) et un test qui échoue si l'une d'elles revient à
`exigerCapacite` simple — la condition de réouverture de D153 est désormais vérifiable
par un gardien, pas seulement affirmée en prose.

**A3.** `tests/isolation/droits-ecrans-tp-s3.test.ts` ne force plus `null` pour simuler
un refus de droit : les trois refus rejouent le verdict réel de `peut`/`peutPleinement`
contre la matrice. Si la matrice change un jour sous ces rôles, l'épreuve rougit pour la
bonne raison plutôt que de continuer à mentir un refus qu'elle n'imposait plus.

**A4.** La référence morte à `menu-droits-tp-s3.spec.ts` (jamais écrite) dans
`materiel-replie.spec.ts` pointe maintenant vers l'épreuve réelle
(`droits-ecrans-tp-s3.test.ts`).

**A5.** 48 captures (6 écrans × 2 rôles × 2 largeurs × avant/après), preuve visuelle du
défaut A1 et de sa correction (voir §2).

**R2-R3 — retouche confiée à 9DH, non faite.** `GET /api/imports/{id}/rejets`
n'exigeait que « Importer / exporter en masse » : un responsable matériel pouvait
télécharger le fichier annoté des rejets d'un lot de CLIENTS que D130 lui refuse à
l'unité. Corrigé : la route exige désormais `peutImporterLeType`, comme les trois autres
routes d'import ; l'écran n'offre plus le lien de téléchargement quand le rôle n'a pas le
droit. D150 est amendé. Pour l'exploitation : un responsable matériel/SAV ne peut plus
récupérer, même en lecture, le détail d'un import de type qu'il n'a pas le droit de
poser.

**R4-R6 — gardiens élargis.** Le gardien D151 (`saisir_rapport`) ne vérifiait que 4
rôles sur 10 ; il en couvre désormais 10, exactement la condition de réouverture écrite
dans `docs/arbitrages.md`. L'épreuve D151 sur les actions de demande ne couvrait que le
technicien ; le rôle `client` (qui a aussi `creer_demande` sans `qualifier_affecter`)
est désormais couvert. La capture e2e du refus d'une demande vérifiait seulement que
`<main>` restait visible — elle ne prouvait pas le refus ; elle vérifie maintenant le
texte du refus et l'absence du bouton d'action.

**R7 — défaut réel, corrigé.** `POST /api/terrain/{id}/photos` écrivait le fichier sur
disque AVANT de vérifier que le technicien pouvait agir sur cette intervention — un
renfort refusé par `deposerPhotoIntervention` (D151) laissait un fichier orphelin
derrière lui. Le périmètre se vérifie désormais AVANT `enregistrerObjet`
(`peutDeposerPhotoSurCetteIntervention`, nouvelle fonction de `lib/documents/depot.ts`).
Pour l'exploitation : plus de fichiers fantômes sous `.donnees-locales/objets/` à chaque
tentative refusée d'un renfort.

**R8 — hygiène de test.** `tests/isolation/demandes-2.test.ts` écrivait dans la fixture
PARTAGÉE `DEMANDE_A1` (la qualifiait, irréversiblement pour le reste de l'exécution).
Remplacé par une demande jetable, créée déjà `qualifiee`, nettoyée en fin de test. Aucun
effet sur l'exploitation — hygiène de harnais seulement.

---

## 2. Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **A1, preuve visuelle** : `trajets-direction-avant-1280.png` montre la colonne
  « RÉGLER » avec des champs modifiables et des boutons « Enregistrer » pour la
  direction (code d'avant 9DH, commit `9a2f6ed`) ; `trajets-direction-apres-1280.png`
  montre la même colonne vide pour la direction, et `trajets-adv-apres-1280.png` montre
  qu'elle reste pleine pour l'ADV — la régression était réelle, la correction est
  visible.
- **`pnpm typecheck`** : vert, zéro erreur, à chaque étape intermédiaire et à la fin.
- **`pnpm lint`** : vert, zéro avertissement.
- **`pnpm format:check`** : vert (trois fichiers reformatés en cours de route avant
  commit : `droits-ecrans-tp-s3.test.ts`, `photo-orpheline-r7.test.ts`,
  `porte.test.ts`).
- **`pnpm test`** : 372 fichiers, **3934 tests**, tous verts (dont
  `tests/unit/docs/amendements-arbitrages.test.ts` et
  `tests/unit/docs/coherence-backlog.test.ts`, qui confirment que l'amendement de D150
  et la correction de D153 n'ont rien cassé côté câblage de décisions).
- **`pnpm test:isolation`** : 152 fichiers, **1375 tests**, tous verts — rejoué deux
  fois (une fois après R1-R7, une fois après R8), identique les deux fois.
- **`pnpm build`** : vert, 72/72 pages.
- **`pnpm verify`** (chaîne complète) : rejoué une dernière fois juste avant les
  captures A5, entièrement vert.
- **Captures e2e** : 24 captures APRÈS (code livré) en une passe (2,2 min, 24/24
  passées) ; 24 captures AVANT (worktree temporaire sur `9a2f6ed`) en une seconde passe
  (2,1 min, 24/24 passées). 48 fichiers PNG au total, vérifiés par `ls`.
- **Nouvelle épreuve R7** (`photo-orpheline-r7.test.ts`) : 2/2 verte — le renfort refusé
  n'appelle jamais `enregistrerObjet` (vérifié par mock-spy) et ne crée aucun document ;
  le technicien affecté, lui, dépose sa photo normalement (1 appel, 1 document).
- **Nouvelle épreuve R3** (ajoutée à `droits-import-par-type.test.ts`) : responsable
  matériel refusé sur les rejets d'un lot CLIENTS (`imports.refus.type_reserve`),
  administrateur de société accepté sur le même lot (status 200).

---

## 3. Ce que j'ai tranché, et pourquoi

- **R7 — vérifier avant d'écrire, plutôt que supprimer après coup.** Le ticket offrait
  le choix. Supprimer l'objet orphelin après un refus aurait risqué de romper la
  déduplication par empreinte (L8-01, BON-2) si un document légitime partageait la même
  empreinte — improbable mais réel. Vérifier le périmètre avant tout `enregistrerObjet`
  coûte une seconde lecture de `technicien_id`, jamais une seconde RÈGLE, et c'est le
  choix sûr.
- **R2/R3, le commentaire de `lib/imports/droits.ts`.** Plutôt que de réduire le texte à
  « trois routes » comme le lisait R2 isolément, j'ai fait les deux retouches ensemble
  (R2 corrige le texte, R3 corrige le code) et réécrit le commentaire pour décrire
  l'état FINAL (quatre routes, dont `rejets` depuis ce lot) — un commentaire qui
  décrirait un état vrai pendant quelques minutes puis faux dès le commit suivant
  n'aurait aidé personne.
- **D150, amendement plutôt que réécriture.** Le texte d'origine de D150 affirmait
  explicitement que `rejets` « n'est pas concernée et reste inchangée » — une décision
  déjà rendue, pas un oubli à corriger en silence. J'ai suivi la convention déjà en
  usage dans `docs/arbitrages.md` (`### AMENDEMENT <date>`, vue sur D118/D28) : la
  rédaction d'origine reste, annotée *(amendé)*, et un amendement daté explique le
  changement et pourquoi.
- **A5, compte direction.** Aucun compte `direction` n'est connectable dans la scène
  e2e (seuls `adv`, `garnier`, `admin.societe` sont enrôlés par `global.ts`). Plutôt que
  d'ajouter une ligne à `scene.ts` (interdit par le ticket), j'ai suivi le précédent déjà
  dans le dépôt (`tests/e2e/enrolement-secrets-hors-url.spec.ts`) : le spec de capture
  crée sa PROPRE identité direction par `signUpEmail`, et la supprime en fin. Rien n'est
  ajouté à la scène partagée.
- **A5, le worktree temporaire SANS symlink de `node_modules`.** La recette habituelle
  (mémorisée d'un lot précédent) symlinke `node_modules` pour éviter une réinstallation.
  Mesuré ici que ça casse : une migration de schéma (`9DE-TP-CY1-TERMINER-SIGNATURE`,
  entre `9a2f6ed` et `HEAD`) a changé `InterventionSignature`, et le client Prisma
  partagé via le symlink reflète le schéma ACTUEL, pas celui de `9a2f6ed` — le vieux
  code ne compilait plus contre ce client. Un vrai `pnpm install` dans le worktree
  (store pnpm content-addressable, donc rapide malgré tout — 7,5 s) régénère un client
  Prisma local, correct pour l'ancien schéma.

---

## 4. Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix, comme l'interdisait le ticket.
- R3 est marqué par le ticket comme « à valider par Alexis ce soir » : je l'ai
  implémenté et documenté comme un amendement daté de D150, mais sa validation finale
  reste à Alexis — rien dans ce lot ne force cette décision au-delà de ce que le pilote
  avait déjà choisi.
- Aucune tentative de géolocaliser ou de recréer la cause du conflit nommé par le
  pilote (« collision de D153/D173 ») au-delà de ce que la relecture a mesuré — hors
  mandat de ce lot.
- Le test ajouté pour R5 (rôle `client` sur `qualifier_affecter`) reste une épreuve de
  capacité pure (`exigerCapacite` avec session fabriquée), pas un appel à une vraie
  route : `exigerCapacite("qualifier_affecter")` est appelée sans second argument par
  les quatre routes de demande (lecture de `headers()`, hors contexte Next en test
  unitaire) — un appel de route réel aurait exigé un harnais complet (DB jetable,
  mock du module porte) hors de la portée raisonnable d'un « si possible ».

---

## 5. Les pièges pour la session suivante

- **Le symlink de `node_modules` pour un worktree AVANT/APRÈS n'est sûr que si AUCUNE
  migration de schéma Prisma n'est intervenue entre les deux commits.** Vérifier
  d'abord (`git log <avant>..<après> -- prisma/migrations/ prisma/schema.prisma`) ;
  si une migration existe, faire un vrai `pnpm install` dans le worktree (rapide, le
  store pnpm est content-addressable) plutôt que de symlinker — sinon `tsc` échoue sur
  des champs de modèle qui n'existent pas encore dans le vieux code, voire pire, le
  serveur du vieux code tourne contre un client Prisma qui ne correspond pas à sa
  propre base.
- **`NODE_OPTIONS="--max-old-space-size=4096"` est nécessaire pour `tsc --noEmit`**
  sur ce dépôt (déjà posé dans le script `typecheck` de `package.json`, mais pas si on
  invoque `tsc` à la main dans un worktree) — sinon `OOM` au bout d'environ 20 secondes.
- **Les treize + une routes de `PORTE_COMPLETE`** (`tests/unit/auth/porte.test.ts`)
  forment maintenant une DEUXIÈME liste close à côté de `ROUTE_CAPACITE` : toute route
  future qui doit fermer le `○` (prochaine restriction du genre de PA-02/PA-25) doit
  entrer dans les deux listes à la fois — `ROUTE_CAPACITE` pour la capacité,
  `PORTE_COMPLETE` pour la porte.
- Les 48 captures de `docs/propositions/9DX-RETOUCHES-11/captures/` sont volumineuses
  (~3,6 Mo au total) — normal pour des `fullPage` à 1280px, cohérent avec les autres
  tickets de capture du dépôt.

---

## 6. Ce qui reste à faire

- Valider R3 avec Alexis (le ticket le marque explicitement « à valider ce soir ») :
  si la décision change, amender à nouveau l'amendement de D150 plutôt que de le
  réécrire en silence.
- La reprise 9DH avait aussi laissé en suspens la validation du choix de LECTURE
  OUVERTE sur `/parametres/agences` pour la direction (hors mandat de ce lot,
  documenté par 9DHA).
- Avancer `main` vers ce commit depuis le worktree qui porte réellement la branche —
  cette session a travaillé en HEAD détaché sur `origin/main`, comme les sessions
  précédentes de cette série (voir `git log`).
