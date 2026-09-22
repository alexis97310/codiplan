# HEBERGEMENT-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- Créé `vercel.json` à la racine, avec `"regions": ["syd1"]`.
- Créé un gardien, `tests/unit/deploiement/region-vercel.test.ts`, qui exige que
  `vercel.json` existe et déclare `regions: ["syd1"]`.
- Mis à jour `docs/mise-en-ligne.md` en deux endroits (§3 « La région, et pourquoi
  elle compte plus qu'ailleurs », et l'étape 2 de la procédure §6) : ce qui était une
  instruction pour la console Vercel (« choisir la région au plus près de Sydney »)
  est désormais une valeur posée dans le dépôt, avec un renvoi vers le gardien.

Pour l'exploitation : au prochain déploiement ordinaire, les fonctions s'exécuteront
à `syd1` (Sydney) au lieu de la région par défaut de l'hébergeur (`iad1`, Washington
D.C.). Chaque aller-retour vers la base Neon (`ap-southeast-2`, Sydney) cesse de
traverser le Pacifique deux fois. Aucun geste manuel n'est requis chez l'hébergeur :
c'est le dépôt qui porte le réglage, et il survit à un changement de projet ou de
personne. Aucun déploiement n'a été déclenché par cette session.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**AVANT** (mesuré le 23/09/2026, avant toute modification) :
- `ls vercel.json` → fichier absent.
- `grep -rn "preferredRegion\|regions" next.config.ts` → aucun résultat.
- `grep -rn "preferredRegion\|regions" app/` → aucun résultat.
- Le gardien neuf, joué contre cet état : **2 tests rouges** (le fichier n'existe
  pas ; le `JSON.parse` échoue en `ENOENT`).

**APRÈS** :
- `vercel.json` existe, `{"$schema": "...", "regions": ["syd1"]}`.
- Le gardien : **2 tests verts**.
- `pnpm verify:full` joué en entier, **deux fois de suite** (une fois pour la revue,
  une fois pour vérifier l'exit code réel après un pipe vers `tail` qui l'avait
  masqué) : format, typecheck, lint, tests unitaires, isolation, build, e2e (155
  passés, 3 ignorés délibérément par la suite elle-même), `feries:horizon`,
  `audit:partitions` — tout vert, code de sortie `0` les deux fois.

## Ce que j'ai tranché et pourquoi

- **`syd1` et pas une autre région.** Vérifié dans la documentation Vercel
  (`vercel.com/docs/regions`, consultée le 23/09/2026, table « Region list ») :
  `syd1` correspond EXACTEMENT à `ap-southeast-2` (Sydney, Australie) — la même
  région AWS que celle où vit la base Neon (`docs/mise-en-ligne.md`, §3). Ce n'est
  pas une approximation, c'est la même région des deux côtés.
- **Syntaxe `vercel.json`** : vérifiée sur `vercel.com/docs/functions/configuring-functions/region`
  — la clé de premier niveau `regions` (tableau de codes) est la forme documentée pour
  fixer la région par défaut de toutes les fonctions d'un projet.
- **Un seul réglage dans `vercel.json`**, comme demandé : pas de `functions`,
  pas de `functionFailoverRegions` (Enterprise seulement, hors sujet ici), rien
  d'autre — un fichier de configuration qui grossit sans motif devient une source
  de surprises.
- **Gardien qui vérifie la valeur exacte, pas seulement la présence du fichier.**
  Le ticket demandait un gardien qui « exige qu'une région y soit nommée » ; j'ai
  choisi de vérifier `["syd1"]` précisément plutôt qu'un simple « `regions` est un
  tableau non vide », pour qu'un `vercel.json` réécrit plus tard avec une région
  fausse ou approximative rougisse aussi, pas seulement son absence.

## Ce que je n'ai PAS fait

- Je n'ai touché à aucun code applicatif, aucune migration, aucun flux GitHub.
- Je n'ai déclenché aucun déploiement, ni ouvert aucune console (Vercel ou
  autre) : la déclaration vit uniquement dans le dépôt.
- Je n'ai pas changé la région de la base Neon — elle reste à `ap-southeast-2`.
- Je n'ai pas touché à `next.config.ts` ni à `app/` : aucune route ne portait de
  `preferredRegion`, et le ticket ne demandait pas d'en ajouter un — `vercel.json`
  suffit à fixer la région par défaut de toutes les fonctions du projet.
- Aucune capture d'écran : rien à l'écran n'a changé, le ticket le dit lui-même.

## Les pièges pour la session suivante

- **Ne pas relire l'exit code d'un `pnpm verify:full` à travers un `| tail`** :
  le code de sortie visible ensuite est celui de `tail`, pas de la commande
  pipée — toujours vert en apparence même si `verify:full` a échoué. Rediriger
  vers un fichier (`> log 2>&1 ; echo $?`) plutôt que piper.
- Le point 154 (Neon pooler vs hôte direct) et les points d'hygiène du §5.5 de
  `docs/mise-en-ligne.md` restent non tranchés — ce ticket n'y touchait pas.
- Si un futur lot ajoute un stockage S3-compatible (lot 8, §4 bis du même
  document), vérifier qu'il est ouvert dans la MÊME région (`ap-southeast-2` /
  au plus proche de `syd1`) pour la même raison de latence — la note le disait
  déjà avant ce ticket.

## Ce qui reste à faire

- Rien dans le périmètre de ce ticket. Le réglage est posé, gardé, documenté ;
  seul un déploiement ordinaire (hors mandat de cette session) reste à jouer
  pour qu'il prenne effet en production.
- Point non vérifié par cette session, à surveiller au prochain déploiement réel :
  le nombre de régions disponibles dépend du plan Vercel (Hobby : une seule
  région — compatible avec ce réglage à une seule entrée ; Pro : jusqu'à 5). Si
  le projet est sur un plan Hobby, `["syd1"]` seul convient déjà ; le vérifier
  seulement si un jour une seconde région est envisagée.
