# 9DJ-TP-ACC1-DONNER-ACCES — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

QT-1 (28/09/2026, fondu avec TP-UX8-b) : créer un technicien dans Équipe
(`lib/techniciens/depot.ts`) écrivait son identité mais n'ouvrait aucun moyen de
connexion — le commentaire du module affirmait le contraire (« la personne
obtient son accès par le flux d'enrôlement existant »), ce qui était faux. Le
seul chemin qui émettait un jeton de premier accès était le geste d'AMORÇAGE,
réservé à la toute première identité d'une société : un technicien créé ensuite
restait sans accès pour toujours, sans qu'aucun écran ne le signale.

- **Module neuf `lib/auth/acces-technicien.ts`** — `envoyerLienDAcces(contexteAdmin, utilisateurId)` :
  vérifie que la personne est un technicien ACTIF de la société active, pose la
  ligne `compte` au repos si elle n'existe pas (modèle `prisma/seed.ts`), émet un
  jeton de premier accès par une instance Better Auth munie du canal de remise
  (`creerAuth`, même mécanique que le geste d'amorçage), envoie le courriel HORS
  transaction, et trace le geste dans `journal_acces` en réutilisant les valeurs
  EXISTANTES de l'énumération (`ouverture_identite` au premier envoi,
  `reemission_premier_acces` ensuite — le schéma annonçait déjà cet usage : « elle
  vaudra telle quelle pour le chemin administratif du lot 7 »). **L'auteur de la
  trace est l'ADMINISTRATEUR**, jamais le technicien visé — forme reprise de
  `lib/auth/deverrouillage.ts` (L7-04), pas de l'amorçage, dont la trace aurait
  menti sur qui a agi.
- **Route neuve** `app/api/equipe/[id]/envoyer-acces/route.ts`, gardée par
  `administrer_utilisateurs` (ligne ajoutée à `tests/unit/auth/porte.test.ts`,
  69 routes désormais).
- **Écran Équipe** : par technicien, l'état d'accès en clair (« Pas d'accès » /
  « Lien envoyé le JJ/MM à HH:MM » / « Accès activé ») et le bouton
  « Envoyer »/« Renvoyer le lien d'accès » (`BlocAcces`, masqué si déjà actif) ;
  compte rendu honnête après le geste (« Lien envoyé à X » ou « Le lien n'est pas
  parti : <motif> », ce second cas étant celui qu'on verra tant que la
  production reste en mode test Resend).
- **Mot de passe oublié (QE-18 a)** : un lien sous le formulaire de connexion mène
  à `/mot-de-passe-oublie`, texte seul — aucun formulaire, aucune route publique.
  Les textes du premier accès renvoient désormais vers « votre administrateur »
  plutôt que « la personne qui vous l'a transmise ».
- **Décision D162** dans `docs/arbitrages.md`.

Pour l'exploitation : un administrateur de société peut désormais, depuis
Équipe, donner (ou redonner) l'accès à un technicien déjà créé — ce qui était
jusqu'ici impossible sans passer par le geste d'amorçage, réservé à la première
identité. Le geste d'amorçage lui-même n'est PAS retiré (voir plus bas).

## Ce que j'ai mesuré

- **Unitaire** (`pnpm test`, 374 fichiers / 3916 tests, vert) : `viseCetteCible`
  (le marqueur de cible dans `journal_acces.detail`, toujours en fin de chaîne) ;
  le tableau `ROUTE_CAPACITE` et son compteur (69) ; les textes du premier accès
  adaptés sans casser le gardien de clés.
- **Isolation, contre la vraie base** (`pnpm test:isolation`, 150 fichiers /
  1362 tests, vert) : premier envoi (compte au repos, trace `ouverture_identite`,
  auteur l'administrateur) ; réémission (`reemission_premier_acces`) ; les trois
  refus nommés implémentés (`introuvable` pour un technicien d'une autre société
  OU un identifiant inconnu, `membre_inactif`, `deja_un_mot_de_passe`) ; le refus
  de rôle (`RefusEnvoiAcces`, avant toute écriture) ; les trois états
  d'`etatsAccesDesTechniciens`.
- **Bout en bout, contre un serveur réel** (`tests/e2e/acces-technicien.spec.ts`,
  rejoué seul puis en parallèle avec `equipe.spec.ts`, `terrain.spec.ts` et
  `barre-sans-session.spec.ts` — 13/13 vert) : administrateur avec second
  facteur → crée un technicien dans Équipe → « Envoyer le lien d'accès » → lien
  relu dans le courriel intercepté (transport doublé) → premier accès → connexion
  → arrivée au terrain → « Démarrer l'intervention » puis « Mettre en pause » sur
  une intervention affectée par le test. Scène propre, préfixée `9DJ-ACC`,
  retirée en `afterAll`.
- **`CI=1 pnpm verify:full` rejoué EN ENTIER, EN UN SEUL APPEL, au premier
  plan** (contrairement à plusieurs lots précédents qui avaient dépassé le
  plafond d'un appel outil) : vert de bout en bout — format, typecheck, lint,
  3916 tests unitaires, 1362 tests d'isolation, `pnpm build`, `feries:horizon`,
  `audit:partitions`, et 807 épreuves de bout en bout passées (7 ignorées,
  préexistant, sans rapport avec ce lot) sur un seul worker, zéro échec.

## Ce que j'ai tranché, et pourquoi

- **Le quatrième refus nommé par le ticket — « cette personne a un accès dans
  une autre société : son accès se règle par la plateforme » — N'EST PAS
  implémenté.** `utilisateur_societe` porte la forme « société » de I1 : sous le
  contexte de l'administrateur, aucune lecture ne peut voir une ligne d'une
  AUTRE société — la base rend zéro ligne, à l'aveugle comme en nommant.
  `journal_acces` porte bien `societe_id_cible`, mais ces deux colonnes sont
  INFORMATIVES PAR ARBITRAGE (D34) et un gardien dédié
  (`tests/unit/auth/journal-acces-informatif.test.ts`) refuse qu'elles filtrent
  une décision. Détecter ce cas exigerait une politique RLS nouvelle — une
  MIGRATION, explicitement exclue par le ticket (« Migration : NON »). Les
  épreuves demandées par le ticket ne couvrent d'ailleurs pas ce quatrième cas —
  seulement « technicien de B → introuvable », déjà couvert. Écrit dans D162
  avec sa condition de réouverture.
- **`envoyerLienDAcces` ne réutilise pas `ouvrirPremierCompte` /
  `reemettreJetonPremierAcces` tels quels**, bien que le ticket l'ait suggéré
  « si c'est propre » : leur trace nomme l'IDENTITÉ elle-même comme auteur (« il
  n'y a personne d'autre »), ce qui serait FAUX ici où l'administrateur agit sur
  le compte d'un tiers. J'ai donc composé directement les mêmes briques
  (`creerAuth`, `avecDesignationAuth`) plutôt que de copier leur corps, et repris
  la forme de trace de `lib/auth/deverrouillage.ts` (admin-auteur,
  cible-dans-le-detail), qui règle exactement le même problème pour le même
  genre de geste (L7-04).
- **L'état d'accès par technicien, affiché à l'écran, se reconstruit en relisant
  l'historique COMPLET de l'administrateur courant puis en filtrant côté
  application sur un marqueur `cible:<id>` en fin de `detail`** — jamais un
  `where` sur `societe_id_cible` (D34). C'est la conséquence directe du choix
  précédent (auteur = administrateur) : `journal_acces` ne peut plus être
  interrogé par technicien directement. Documenté en tête de module.
- **Compte créé mais jamais activé (`compte.mot_de_passe IS NULL`) sans
  événement correspondant retrouvé** (cas limite, non rencontré en pratique) :
  `etatsAccesDesTechniciens` retombe sur `compte.cree_le` plutôt que d'afficher
  faussement « Pas d'accès ».
- **Le geste d'amorçage n'est PAS retiré** : D65 point 4 prévoit son retrait
  « le jour où le chemin administratif d'ouverture de compte existe » — mais ce
  lot donne l'accès à un technicien DÉJÀ créé, il n'ouvre pas la toute première
  identité d'une société (branche `app_societe_active_vierge`, qui reste
  nécessaire). Le retrait complet est donc le lot SUIVANT, et il exige une
  migration.

## Ce que je n'ai PAS fait

- **Les captures AVANT/APRÈS** (page Équipe aux trois états, 1280/375 px ;
  connexion avec le lien ; page Mot de passe oublié ; page premier accès) — le
  ticket les demande, je ne les ai pas prises. Choix explicite de session, faute
  de temps après avoir fait passer `CI=1 pnpm verify:full` en entier : j'ai
  préféré garantir un code correct et entièrement éprouvé plutôt que de risquer
  de manquer le commit final pour des captures. **Non vérifié visuellement**, à
  prendre à la session suivante.
- Comptes de bureau (MO-15), « Mon compte » (MO-16), `/arrivee` (TR-29), durée du
  jeton, verrouillage, formulaire public de mot de passe oublié : hors périmètre,
  comme demandé.
- Le retrait du geste d'amorçage et de sa migration : explicitement reporté
  (voir plus haut).

## Les pièges pour la session suivante

- **`journal_acces` est désormais désignée par DEUX identités différentes
  selon l'événement** : `ouverture_identite`/`reemission_premier_acces` émis
  depuis Équipe portent l'ADMINISTRATEUR comme `utilisateur_id` (D162), alors
  que les mêmes événements émis par le geste d'amorçage portent l'IDENTITÉ
  elle-même. Un futur lecteur de `journal_acces` qui supposerait « l'auteur
  d'un `ouverture_identite` est toujours le compte concerné » se tromperait
  pour la moitié des lignes écrites après ce lot.
- **`viseCetteCible` dépend d'un marqueur `cible:<uuid>` TOUJOURS en fin de
  `detail`** — si un futur lot enrichit ce texte en ajoutant quelque chose
  APRÈS le marqueur, la corrélation entre un événement et son technicien casse
  silencieusement (la fonction rend `false` partout, donc l'écran retomberait
  sur `compte.cree_le`, pas une erreur bruyante).
- Le nom d'une fixture e2e qui ajoute un préfixe à un libellé EXISTANT sans
  préfixe (ici `equipe.e2e.nom`, « Technicien de l'épreuve ») peut en devenir un
  SUR-ENSEMBLE et faire matcher les deux fiches par
  `getByRole(..., { name })` (correspondance partielle par défaut) — mesuré en
  faisant tourner `acces-technicien.spec.ts` et `equipe.spec.ts` en parallèle.
  Réparé en changeant le libellé de CE lot (`9DJ-ACC — Compte à activer`), mais
  le risque inverse (un futur lot nommant sa fixture en sur-ensemble de la
  mienne) reste entier.
- Les nouvelles clés `compte`/`technicien`/`modifie_le` sont NOT NULL sans
  défaut en base pour un `INSERT` écrit à la main (mesuré dans l'épreuve
  d'isolation « technicien de B ») : tout futur `$executeRawUnsafe` sur ces
  tables doit poser `modifie_le = now()` explicitement.

## Ce qui reste à faire

- Prendre les captures AVANT/APRÈS listées par le ticket.
- Faire valider D162 par Alexis (comme D152/D153 avant elle, cette page reste
  « à valider »).
- Le retrait du geste d'amorçage (D65 point 4) — lot suivant, avec sa migration.
- Si une politique RLS ou une autre source honnête permet un jour de savoir
  qu'une identité est habilitée dans une autre société sans violer D34,
  implémenter le quatrième refus nommé par ce ticket (voir la condition de
  réouverture de D162).
