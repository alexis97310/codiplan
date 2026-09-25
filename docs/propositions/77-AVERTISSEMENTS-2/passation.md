# 77-AVERTISSEMENTS-2 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`avertirApresPlanification` (`lib/avertissements/planification.ts`) connaissait
déjà `avant.technicienId` — l'état lu avant l'écriture — mais ne s'en servait
que pour DÉCIDER (remettre le badge « Nouveau » à zéro,
`intervention.vue_technicien_le`). Il ne s'en servait jamais pour PRÉVENIR :
l'ancien technicien d'une réaffectation continuait de croire l'intervention
sienne et pouvait se déplacer pour rien.

- `CompteRenduAvertissement` gagne un troisième bord, `ancienTechnicien`
  (`EtatEnvoiAvertissement | null`, optionnel pour ne pas casser les
  compte-rendus composés avant ce ticket). Renseigné uniquement quand le
  technicien change ET qu'il y en avait un avant ET que cet ancien technicien
  avait un créneau connu (`avant.datePlanifiee` non nul) — jamais à la
  première planification, jamais sur un simple déplacement sans changement de
  technicien.
- Deux fonctions neuves, sur le modèle exact de `sujetPourTechnicien`/
  `corpsPourTechnicien` : `sujetPourAncienTechnicien` (« CODIPLAN —
  Intervention retirée de votre planning ») et `corpsPourAncienTechnicien` —
  qui compose avec l'ANCIEN créneau (`avant.datePlanifiee`/`creneauDebut`),
  jamais le nouveau, et sans lien `/terrain` ni nom du nouveau technicien (ce
  dernier n'est de toute façon jamais lu — le module ne connaît le nouveau
  technicien que par son email).
- `envoyerAlAncienTechnicien` (nouvelle fonction privée) envoie ce courriel,
  même traitement `parti`/`non_parti`/`sans_destinataire` qu'ailleurs dans ce
  module.
- `clesAvertissementCourriel` rend une clé de plus quand `ancienTechnicien`
  est renseigné : `intervention.avertissement.courriel_ancien_technicien_parti`
  ou `..._non_parti` (deux clés neuves dans `lib/i18n/fr.ts`, sur le modèle des
  clés existantes).
- Aucun changement aux routes (`app/api/interventions/[id]/affecter`,
  `.../deplacer`) ni à l'écran (`app/(back-office)/interventions/[id]/page.tsx`) :
  les deux lisent déjà le compte-rendu et les clés génériquement
  (`clesAvertissementCourriel(...)`, puis un filtre `estCleTraduction` côté
  écran) — une clé de plus s'y affiche sans qu'aucune ligne n'y change,
  exactement comme le ticket l'annonçait.

**Pour l'exploitation** : un technicien réaffecté ailleurs reçoit désormais un
courriel « Intervention retirée de votre planning » avec la date et le lieu
qu'il connaissait — il ne se déplace plus pour une intervention qui ne lui
appartient plus.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- AVANT (lecture du code, main à `89f2f0e`) : `CompteRenduAvertissement` ne
  portait que `client` et `technicien`. Une réaffectation A → B n'envoyait
  qu'UN courriel (à B) ; A ne recevait rien.
- APRÈS : `pnpm vitest run --project isolation tests/isolation/avertissements-reaffectation.test.ts`
  — 3 tests neufs, tous verts : réaffectation A → B envoie 2 courriels (B
  « Nouvelle intervention affectée » avec `/terrain/{id}`, A « Intervention
  retirée de votre planning » sans lien ni adresse de B) ; première
  planification n'envoie aucun courriel « retirée » ; déplacement sans
  changement de technicien non plus.
- `pnpm test:isolation` complet : 125 fichiers, 1234 tests, tous verts —
  `tests/isolation/avertissements-planification.test.ts` (AVERTISSEMENTS-1)
  n'a pas été modifié et reste vert.
- `pnpm test` complet : 261 fichiers, 2804 tests, tous verts —
  `tests/unit/avertissements/composition.test.ts` n'a pas été modifié (le
  champ `ancienTechnicien` est optionnel exprès pour ça) et reste vert.
- `pnpm verify` rejoué en entier après le dernier commit : vert —
  format:check, typecheck, lint (0 avertissement), les deux suites de tests
  ci-dessus, build de production.

## Ce que j'ai tranché et pourquoi

- **`ancienTechnicien` est un champ OPTIONNEL du type `CompteRenduAvertissement`**,
  pas un champ requis comme `client`/`technicien`. Le ticket demande
  explicitement que les épreuves `avertissements-1` existantes (dont
  `tests/unit/avertissements/composition.test.ts`) restent vertes SANS
  modification ; en champ requis, TypeScript aurait forcé à toucher les
  quatre objets littéraux de ce fichier pour ajouter `ancienTechnicien: null`
  partout. `undefined` et `null` se lisent identiquement dans
  `clesAvertissementCourriel` (« rien à dire pour ce bord »).
- **Le créneau envoyé à l'ancien technicien est calculé séparément de la
  variable `ancien` existante** (celle qui sert à `corpsPourClient`/
  `corpsPourTechnicien` pour annoncer un DÉPLACEMENT). Les deux ne coïncident
  pas : `ancien` ne vaut quelque chose que sur un déplacement de créneau,
  alors que la réaffectation pure (le cas que ce ticket couvre) ne déplace
  rien — seul le technicien change. D'où
  `ancienCreneauPourAncienTechnicien`, calculé indépendamment depuis
  `avant.datePlanifiee`/`creneauDebut`.
- **Guard `ancienCreneauPourAncienTechnicien !== null`** : si l'ancien
  technicien n'avait lui-même jamais eu de date (cas limite — un technicien
  pré-affecté avant la première planification, puis remplacé au moment même
  de planifier), il n'y a pas de créneau à lui rappeler et aucun courriel ne
  part. Ce cas n'est pas dans les scénarios demandés par le ticket ; je l'ai
  traité par cohérence avec le reste du module (`creneauLisible` renvoie déjà
  `null` dans ce cas ailleurs, et c'est systématiquement un signal « rien à
  annoncer »), mais il n'est PAS couvert par un test dédié — voir ci-dessous.
- **Le test appelle `avertirApresPlanification` directement**, pas
  `affecterTechnicien` puis la route HTTP : le module est ce que ce ticket
  fait évoluer, et `affecterTechnicien` (habilitations, absences, RG-PLA-06)
  est déjà éprouvé ailleurs. Même principe que le fichier voisin
  (`avertissements-planification.test.ts`), qui appelle
  `marquerVuParTechnicien` directement plutôt que de passer par une route.
- **Le double de transport courriel est un `vi.stubGlobal("fetch", …)` local
  au fichier de test**, sur le modèle de `tests/unit/courriel/envoi.test.ts`
  — jamais un vrai appel à `api.resend.com`.

## Ce que je n'ai PAS fait

- Je n'ai pas touché aux routes `affecter`/`deplacer` ni à l'écran de la
  fiche : rien n'y était à changer, le canal de clés et le filtre
  `estCleTraduction` sont déjà génériques.
- Je n'ai pas ajouté de capture d'écran : aucun écran neuf, et le bandeau
  d'avertissement existant n'a pas changé de FORME (une clé de plus dans une
  liste qui en affichait déjà plusieurs), conformément à ce que le ticket
  autorise.
- Je n'ai pas écrit de test dédié au cas limite « ancien technicien jamais
  planifié, remplacé à la première planification » (voir ci-dessus,
  « Ce que j'ai tranché ») — hors du périmètre demandé, et je n'ai pas de
  scénario métier confirmé où il se produit réellement.
- Je n'ai pas modifié `tests/unit/avertissements/composition.test.ts` ni
  `tests/isolation/avertissements-planification.test.ts` — le ticket le
  demandait, et le typage en champ optionnel le permet sans aucune édition.

## Les pièges pour la session suivante

- **La politique RLS de `utilisateur` (L1-02c) cache une identité qui n'a
  aucun rattachement société** (`utilisateur_societe` ou `utilisateur_client`).
  Un test qui insère un technicien de scène directement dans `utilisateur`
  sans lui poser aussi une ligne `utilisateur_societe` le rend invisible à
  `tx.utilisateur.findFirst` sous le rôle applicatif — la fonction rend alors
  silencieusement `sans_destinataire`, jamais une erreur. Mesuré en direct :
  la première version de ce test échouait ainsi (compte-rendu
  `sans_destinataire` au lieu de `parti`) avant que j'ajoute les deux lignes
  `utilisateur_societe` en `beforeEach`.
- **`utilisateur.modifie_le` est `NOT NULL` SANS défaut** depuis la migration
  `20260820150000_authentification_et_roles` (le défaut posé à la création de
  la colonne a été retiré juste après, pour ne pas geler une valeur
  périmée) : tout `INSERT` direct dans cette table doit fournir `modifie_le`
  explicitement (`now()`), sous peine de `23502`.
- **`ancienCreneauPourAncienTechnicien` réutilise `creneauLisible`**, la même
  fonction que le reste du module : si son contrat change (par exemple pour
  accepter une heure sans date), le comportement de la notification à
  l'ancien technicien change avec, sans qu'aucune ligne de ce ticket n'y
  touche à nouveau.

## Ce qui reste à faire

- Le cas limite documenté ci-dessus (« Ce que j'ai tranché », dernier point) —
  ancien technicien jamais planifié — n'est pas testé. À couvrir si un
  scénario métier réel l'exige.
- Rien d'autre n'est identifié pour ce ticket : le périmètre annoncé (le
  module et le fichier i18n) est couvert, testé et `pnpm verify` est vert.
