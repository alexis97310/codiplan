# 9ET-COMPTES-BUREAU-1 — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

Un administrateur de société peut désormais donner, depuis le serveur (l'écran suit au lot 2,
9ET-COMPTES-BUREAU-2), un accès à un compte de **bureau** — ADV, responsable matériel, responsable
SAV, direction, ou un second administrateur de société — sans relancer le script d'amorçage
(`scripts/amorcage-premier-compte.mts`, D65), désormais réservé à la toute première identité d'une
société neuve.

Deux routes nouvelles :

- `POST /api/equipe/bureau/creer` — crée (ou rattache, si le courriel est déjà connu de la
  plateforme) un compte, avec l'un des cinq rôles de bureau ; une case permet d'envoyer le lien
  d'accès dans le même geste.
- `POST /api/equipe/bureau/[id]/envoyer-acces` — envoie ou réémet le lien de premier accès.

Les deux sont gardées par `administrer_utilisateurs` (D37, `admin_societe` seul), enregistrées dans
la liste close `ROUTE_CAPACITE` du gardien D-12 (`tests/unit/auth/porte.test.ts`).

Voir `docs/arbitrages.md`, **D196**, pour la décision complète (fondée sur les décisions 78 et 80
d'Alexis du 12/10/2026) et ses deux amendements (D65 point 4, D162).

## Ce que j'ai mesuré

- `UtilisateurSociete` (`prisma/schema.prisma:913`) porte déjà tout ce qu'il faut : `role: Role`
  (l'énumération compte dix valeurs depuis D37, qui a ajouté `admin_societe`) et
  `@@unique([utilisateur_id, societe_id])` — un seul rôle par personne et par société. **Aucune
  migration dans ce lot.**
- `utilisateur_societe` porte DEUX politiques de SELECT permissives (mesuré en relisant les
  migrations `20260820120000_rls_policies` et `20260908140000_enrolement_second_facteur_l1_02f`) :
  la forme « société » ordinaire, ET la forme « appartenance » (D61,
  `utilisateur_societe_mes_habilitations`), qui rend à un compte SES PROPRES lignes, toutes
  sociétés confondues, ancrée sur `app.utilisateur_id`. PostgreSQL combine les politiques
  permissives par OR : sous `avecContexteApplicatif` (qui pose cette variable pour l'auteur de
  l'audit), une lecture de `utilisateur_societe` non filtrée explicitement rendrait donc AUSSI les
  habilitations de l'administrateur dans ses autres sociétés. Éprouvé en isolation
  (`tests/isolation/acces-bureau.test.ts`, « piège RLS D61 ») : sans le filtre explicite
  `societe_id` dans `listerComptesDeBureau`, ce test rougit (vérifié en le retirant puis en le
  remettant).
- `envoyerLienDAcces` (technicien, D162) et le futur geste pour un compte de bureau partagent TOUT
  sauf l'étape 1 (« cette personne est-elle membre, et sous quelle forme ? ») — extrait vers
  `lib/auth/lien-d-acces.ts` (partie A1) avant d'écrire `lib/auth/acces-bureau.ts` (partie A2),
  plutôt que copié.
- Le jeton de premier accès vit une heure — mesuré dans `node_modules/better-auth/dist/api/routes/
  password.mjs` (`resetPasswordTokenExpiresIn || 3600`) : `lib/auth/config.ts` ne surcharge jamais
  ce réglage, et c'est ce défaut que `corpsPremierAcces` annonce déjà (« il expire au bout d'une
  heure »). Nommé en constante (`DUREE_LIEN_PREMIER_ACCES_SECONDES`) pour que
  `etatsAccesDesComptes` lise la MÊME valeur que celle qui gouverne réellement le jeton.

## Ce que j'ai tranché, et pourquoi

- **Le script d'amorçage reste.** Ce chemin exige qu'un administrateur soit déjà connecté pour
  agir ; il ne peut donc pas ouvrir le premier administrateur d'une société neuve. La lettre de D65
  point 4 est amendée sur ce point précis (voir D196) plutôt que le script retiré.
- **Pas de motif dédié « courriel invalide » dans `creerCompteDeBureau`.** Le schéma Zod
  (`schemaCreationCompteDeBureau`, `z.email()`) refuse une saisie malformée AVANT que la route
  n'appelle le dépôt — même convention que `schemaTechnicien` / `saisieTechnicienRecue`, qui ne
  distingue pas non plus ce cas d'un autre champ manquant (`equipe.refus.saisie`, générique). Le
  dépôt ne porte donc que deux motifs propres : `role_hors_liste` et `deja_membre`.
- **`role` accepte les DIX valeurs de `schemaRole` à la saisie**, et c'est `creerCompteDeBureau` qui
  refuse, NOMMÉMENT, un rôle hors des cinq (`role_hors_liste`) — jamais un rejet Zod générique. Un
  administrateur qui poste `technicien` ou `client` directement (en contournant un futur écran)
  reçoit un refus qui NOMME le problème, pas une saisie « invalide ».
- **`envoyerLienDAccesBureau` étape 1 utilise `avecSociete`, jamais `avecContexteApplicatif`** —
  celui-ci pose `app.utilisateur_id` et rouvrirait la fuite D61 décrite plus haut ; celui-là ne pose
  que `app.societe_id` (et `app.role = null`), ce qui ferme la branche « appartenance » (elle ne
  rend aucune ligne sans `app.utilisateur_id`).
- **Pas de tri de `listerComptesDeBureau`** (à la différence de `listerLesTechniciens`, trié par
  nom) : le ticket ne le demande pas pour ce lot serveur-seul, et l'écran du lot 2 décidera de son
  propre ordre de présentation sans qu'un tri serveur préjuge d'un gabarit pas encore dessiné.
- **`maintenant("UTC")` dans `etatsAccesDesComptes`**, plutôt qu'un `Date.now()` nu, pour respecter
  le gardien L0-08 (`tests/unit/calendar/sans-date-courante-implicite.test.ts`) qui interdit toute
  lecture de l'horloge hors de `lib/calendar/fuseau.ts` — même si cette comparaison est une DURÉE,
  pas une lecture calendaire, et que le fuseau choisi ne change donc rien à l'instant rendu.

## Ce que je n'ai PAS fait

- **Aucun écran.** L'onglet « comptes de bureau » d'Équipe est le territoire de
  9ET-COMPTES-BUREAU-2 — ce lot construit le serveur (lister, créer, envoyer/réémettre l'accès) et
  ses épreuves, rien d'affiché.
- **Changer le rôle d'un compte existant, le désactiver.** `utilisateur_societe` ne porte aucune
  colonne `actif` ; une désactivation exigerait soit une colonne nouvelle (migration, hors
  territoire), soit une suppression de la ligne (perdrait la trace du rôle qu'elle portait —
  contraire au principe déjà tenu pour `technicien`, jamais supprimé).
- **Le dernier administrateur.** Rien n'empêche aujourd'hui un `admin_societe` de se retirer
  lui-même si un geste de retrait existait — et ce lot n'en construit pas. À garder en tête pour le
  jour où une désactivation s'ouvrira.
- **Les sessions ouvertes d'un compte dont l'accès serait révoqué, et `Utilisateur.derniere_connexion`**
  (colonne jamais écrite, mesuré) — hors territoire, non touchés.
- **Le refus « habilité dans une autre société »** (le même refus que celui que D162 avait déjà
  renoncé à implémenter pour le technicien, pour la même raison : `journal_acces.societe_id_cible`
  est informative par arbitrage D34, jamais filtrante, et le détecter exigerait une politique RLS
  nouvelle, hors territoire).

## Les pièges pour la session suivante (9ET-COMPTES-BUREAU-2, l'écran)

- **Le piège RLS D61** décrit plus haut mord sur TOUTE lecture future de `utilisateur_societe`
  filtrée par rôle sans filtrer `societe_id` en même temps — pas seulement dans ce lot. Un écran qui
  réécrirait sa propre requête (plutôt que d'appeler `listerComptesDeBureau`) y retombera s'il
  l'oublie.
- **`etatsAccesDesComptes` lit l'historique de L'ADMINISTRATEUR COURANT**, jamais celui de la cible
  (même limite qu'`etatsAccesDesTechniciens`, voir l'en-tête de `lib/auth/acces-technicien.ts`) : un
  second administrateur qui aurait envoyé le lien verrait, depuis SA session, « aucun » là où le
  premier administrateur verrait « lien envoyé ». Connu, non réparé (même héritage que le chemin
  technicien).
- **`envoyerLienDAccesPartage` (dans `lib/auth/lien-d-acces.ts`) vérifie la capacité
  `administrer_utilisateurs` elle-même**, en plus de la porte de route : un appel direct au dépôt
  depuis un futur écran (Server Action, par exemple) hérite donc déjà de cette garde, mais elle
  lève une exception (`RefusEnvoiAcces`), jamais un motif nommé — l'appelant doit l'attraper.
- **Les deux routes attendent un `FormData`**, pas un JSON — même convention que les routes
  techniciens. Si le futur écran poste en JSON, `saisieCompteDeBureauRecue` rendra `null` et le
  refus générique `equipe.refus.saisie` sans dire pourquoi.

## Ce qui reste à faire

Tout l'écran : l'onglet « comptes de bureau » sur `/parametres/equipe`, au gabarit de la maquette
(9ET-COMPTES-BUREAU-2). Les quatre fonctions de `lib/auth/acces-bureau.ts` et les deux routes sont
prêtes à être appelées depuis cet écran sans changement d'API attendu.
