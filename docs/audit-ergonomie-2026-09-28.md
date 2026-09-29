# Audit de toutes les pages de CODIPLAN — ergonomie, bugs, modules (28/09/2026)

Complément du 28/09/2026 : ergonomie, graphisme et usage, avec la maquette de toutes les pages — `docs/propositions/ergonomie-2026-09-28/ergonomie-graphisme-usage-2026-09-28.md`.

- **Pour** : Alexis (directeur d'exploitation), et la conversation qui pilote la file de tickets.
- **Commit lu** : `bcc637e` (main publié ; `/api/sante` de la production renvoie ce commit le 28/09).
- **Périmètre** : toutes les pages, sauf le planning, audité à fond le 27/09 (`docs/audit-ergonomie-2026-09-27.md`) ; celui-ci n'est repris que là où une autre page le touche.
- **Méthode** :
  1. passage en ligne de chaque page, en lecture seule (aucun formulaire envoyé, aucun glisser-déposer), avec le compte bureau administrateur, à 1280 puis 375 px, console ouverte ;
  2. relecture du code par six relecteurs, un par groupe de pages ;
  3. vérification contradictoire par trois autres relecteurs, qui ont cherché à réfuter chaque constat. Aucun constat majeur n'a été réfuté. Une soixantaine d'affirmations ont été nuancées, dont une vingtaine de gravités revues à la baisse ; les verdicts ont été reportés ici ; une dernière relecture a confronté cette synthèse aux rapports et au code ;
  4. confrontation aux décisions écrites (`docs/arbitrages.md`, `docs/decisions/`, cahier des charges, décisions du 27/09).
- **Règles tenues** :
  - aucune écriture en production ;
  - aucune donnée de production identifiante (clients « A », « B », aucun nom de technicien, aucun courriel, aucun numéro réel) ; les décomptes cités sont des ordres de grandeur relevés en ligne ;
  - aucune valeur métier inventée (durée, délai, taux, seuil, prix) : quand il en faut une, c'est « valeur à fixer par Alexis (CLAUDE.md §8) » ;
  - tout écart à une décision est écrit « écart à arbitrer », jamais corrigé en silence.
- **Noms** :
  - **constats** : `IN-` interventions, demandes, tableau de bord · `CS-` clients, sites, interlocuteurs · `PV-` parc, VGP · `PA-` paramètres, imports · `TR-` absences, terrain, accès, navigation · `MO-` modules ;
  - **questions** : `QT-1` à `QT-26` ;
  - **lots** : `TP-…`.

  Aucun de ces préfixes ne se confond avec D…, P…, L…, QG-…, PG-… ou AA-….
- **Preuves** : chaque constat a son `fichier:ligne` au commit `bcc637e` dans `docs/propositions/audit-2026-09-28/constats/` (`IN.md`, `CS.md`, `PV.md`, `PA.md`, `TR.md`, `MO.md`). Les verdicts de vérification (`VERIF-*.md`, même dossier) **prévalent** sur ces six rapports. Les lots sont dans `docs/propositions/audit-2026-09-28/lots.md`.
- **« §8 »** : dans ce document, « point d'arrêt » renvoie au §8 de CLAUDE.md ; le §8 de ce document, lui, liste les gestes d'Alexis.

---

## 0. En bref

1. **Le produit ne boucle pas encore une intervention.** Seul le premier compte d'une société peut être ouvert : un technicien créé dans Équipe n'a pas d'accès, aucun second compte de bureau ne peut être créé, et un mot de passe oublié n'a aucune issue. Or la clôture exige le temps mesuré par le compteur du technicien (D120). **Aucune intervention créée dans CODIPLAN ne peut donc être clôturée aujourd'hui, et rien n'est « à facturer ».** → §1.1, QT-1.
2. **Avant d'ouvrir le premier compte de technicien, il faut fermer ce qu'il pourrait lire ou faire.** Il verrait tout le registre, des chiffres de toute la société au tableau de bord (dossiers bloqués, pièces attendues, sans durée), le parc au-delà de ce que RG-DRO-02 lui ouvre, les interlocuteurs des clients (téléphones, courriels), les tarifs et les absences nominatives de l'équipe. Les routes du terrain lui permettraient aussi d'écrire sur l'intervention d'un collègue. Rien de tout cela ne joue aujourd'hui (aucun compte technicien), mais tout jouera dès le premier. → §2, QT-2 ; le lot TP-S passe **avant** le lot d'accès TP-ACC.
3. **Le cycle de vie écrit (D8) n'est pas tenu.**
   - « Terminée » n'est jamais atteinte.
   - Des transitions interdites passent : suspendre avant démarrage, démarrer une « À planifier ».
   - Une intervention clôturée peut être annulée, et son statut de facturation ne bouge pas.
   - Si le bureau clôture ou annule pendant qu'un compteur tourne, le technicien reste bloqué (latent : aucun compte technicien).

   → §1.2, QT-4, QT-5.
4. **Argent (point d'arrêt de CLAUDE.md §8).**
   - Le mode de valorisation est présélectionné sur « Temps passé » (aucun choix vide), et ne se modifie plus après la création.
   - La fiche d'une intervention clôturée recalcule ses montants avec les réglages actuels (montant du forfait, horaires et agence actuels du technicien, taux antidaté). Le bon garde le total figé, mais relit le taux et le forfait.
   - Un forfait se modifie sans historique.
   - Le bon imprime les montants selon le rôle de la personne qui l'imprime.

   → §3, QT-6 à QT-8.
5. **VGP.**
   - Les réserves des organismes sont enregistrées, mais ne s'affichent nulle part et ne deviennent jamais des interventions (D88 §10).
   - Le régime VGP d'une famille ne se décide sur aucun écran.
   - Une date de vérification dans le futur est acceptée, et ne peut plus être corrigée.
   - Le registre s'arrête à 200 lignes sans le dire.
   - La fiche site présente une échéance dépassée comme « Prochaine VGP due ».

   → §1.3, QT-9.
6. **Parc.**
   - Aucun geste ne change le statut, le site ou le client d'une machine, alors que l'écran « Corriger la fiche » y renvoie.
   - Le QR imprimé contient un jeton qu'aucun écran ne lit : la phrase « le scan ouvre la fiche » est fausse.
   - L'identifiant « Local-… » imprimé sur l'étiquette est provisoire.

   À trancher avant d'imprimer des étiquettes en série. → §1.4, QT-10 à QT-12.
7. **Des bugs sont prouvés en ligne et ne demandent aucune décision.**
   - La fiche site cache les interventions « À planifier » ; la fiche client les range en dernière page.
   - Le rapport d'import dit à la fois « Appliqué » et « pas encore appliqué ».
   - « Agence CODIMA » est écrit en dur.
   - La date est incomplète dans le sous-titre du planning (mois absent au premier jour), et trompeuse dans le titre du calendrier des absences (seul le mois du lundi).

   → §4, lot TP-A, à passer tôt. Déduit du code, dans le même lot (TP-A4) : un refus de droit s'affiche comme un échec de connexion.
8. **Modules** (§6).
   - **Ajouter** : l'accès des comptes, « À facturer » (un onglet du registre), les « Réserves VGP », le scan du QR ; puis « Données à compléter », « Indicateurs du mois », les gestes sur une machine, les exports Excel.
   - **Retirer** : les portes Clients et Sites du hub Paramètres, le bloc Documents toujours vide, le « modèle Excel » qui ne se télécharge pas ; et, si Alexis revient sur ses choix (QT-22, QT-23), la page Charte et la tuile « Sans objet » des absences.
   - **Fusionner** : « Familles à déterminer » dans le registre VGP ; « Horaires d'ouverture » et établissements en une page « Agences ».
9. **Gestes d'Alexis, sans code** (§8) :
   - les interventions et le contact d'essai ;
   - le catalogue des prestations et les forfaits ;
   - les observations VGP rejetées à l'import (près de la moitié) ;
   - les sites sans zone.
10. **Données réelles dans le dépôt (I9)** : des commentaires du code, des tests et des passations citent des raisons sociales présentées comme mesurées en production (à confirmer par Alexis). → lot TP-I9.

**26 questions** (§7), en trois séries : la première bloque les lots qui touchent aux droits, au cycle de vie et à l'argent. D'autres décisions, plus petites, sont listées en fin de §7 : chacune est attendue avant le lot qu'elle concerne.

---

## 1. Le fil rouge : ce qui empêche de boucler une intervention

### 1.1 Aucun second accès possible — Bloquant

*Constats TR-40, PA-36, MO-1, MO-15, TR-32, MO-16 (vérifiés).*

**Ce qui se passe**
- **Un technicien créé dans Équipe n'a pas de compte de connexion.** Il reçoit une identité, pas d'accès (`lib/techniciens/depot.ts:73-80`). Le commentaire qui dit « la personne obtient son accès par le flux d'enrôlement existant » (`:79-80`) est faux : la réémission du lien de premier accès refuse une identité sans compte (`lib/auth/amorcage.ts:466-471`).
- **Aucun second compte de bureau ne peut être créé**, même par script. Le geste d'amorçage n'ouvre que la première identité d'une société (`lib/auth/amorcage.ts:174-180`) ; ADV, responsables et direction n'ont donc aucun chemin.
- **Un mot de passe oublié n'a aucune issue.** La production n'émet aucun jeton de réinitialisation (`lib/auth/config.ts:205-231`), et la réémission est fermée dès qu'un mot de passe existe (`lib/auth/amorcage.ts:473-478`).

**Ce que cela bloque**
1. Sans compte, pas de compteur : la route du compteur est réservée au périmètre du technicien (`app/api/terrain/[id]/compteur/route.ts:76-82`).
2. Sans compteur, pas de clôture : `peutCloturer` exige un temps mesuré strictement positif (`lib/interventions/cycle-de-vie.ts:91-93`). Le code l'écrit comme une conséquence assumée : « une intervention sur laquelle personne n'a démarré de compteur ne se clôture pas dans CODIPLAN » (`:77-79`).
3. Sans clôture, rien à facturer.

Les seules interventions clôturées en production viennent de la reprise d'historique.

**Décision touchée.** D65 place le « chemin administratif d'ouverture de compte » au lot 7 (point 2), et son point 4 retire le geste d'amorçage le jour où ce chemin existe (`tests/unit/auth/amorcage-retrait.test.ts`) ; D37 confie l'ouverture des comptes à l'administrateur de la société. → **ÉCART À ARBITRER (D65)**, question **QT-1**. Conséquence à peser : sans geste d'amorçage, le premier compte d'une **nouvelle** société ne pourra plus s'ouvrir avant la console du lot 7.

**Proposition**
- Sur Équipe, un bouton « Envoyer le lien d'accès », réservé à l'administrateur de la société et journalisé, avec l'état de l'accès (envoyé, activé).
- La réémission pour un mot de passe oublié.
- Ensuite, les comptes de bureau.
- Le geste d'amorçage est retiré, comme le point 4 de D65 le prévoit (conséquence : voir QT-1).

Ce lot passe **après** le lot de cloisonnement TP-S (§2).

*Non vérifiable en lecture : l'existence de comptes technicien créés autrement en production. Alexis le sait.*

### 1.2 Le cycle de vie de D8 n'est pas tenu

*Constats IN-14 (≡ TR-21), IN-15, IN-16, IN-17 (≡ TR-18), IN-18, IN-19, IN-20, TR-19, TR-14, TR-20.*

- **« Terminée » est inatteignable.**
  - Seul le semis de démonstration écrit ce statut (`prisma/seed-data.ts:1552`) ; aucune écriture dans `lib/`, `app/`, les scripts ou les migrations.
  - Arrêter le compteur laisse l'intervention « En cours » (`lib/interventions/depot-compteur.ts:172-179`), et le terrain n'a aucun bouton « Terminer ».
  - Effets : l'onglet « À contrôler » et les filtres « Terminée » et « Affectée » du registre sont toujours vides (IN-11). La clôture part d'« En cours ».
  - Rappel : D131 prévaut sur l'arbitrage 3.17 ; le technicien peut clôturer sa propre intervention.
- **La matrice des transitions n'est tenue ni par l'écran, ni par le serveur, ni par le déclencheur** (`lib/interventions/cycle-de-vie.ts:142-159`, `:81-95`, `:186-191` ; `prisma/migrations/20260915060000_les_deux_temps_d120/migration.sql:154-179`). On peut :
  - suspendre une « À planifier » ou une « Planifiée » ;
  - démarrer le compteur sur une « À planifier » (TR-19) ;
  - clôturer depuis « En cours » ou « Suspendue » ;
  - annuler une « Terminée ».

  Pourtant, L2-07, marqué LIVRÉ, exige le refus de toute transition hors matrice (`docs/backlog.md:647`).

  **Attention à l'ordre** : appliquer D8 à la lettre sans rendre « Terminée » atteignable rendrait toute clôture impossible. « Terminer » vient d'abord.
- **Une intervention clôturée peut être annulée** (IN-16).
  - Le bloc « Annuler » est offert sur une clôturée (`app/(back-office)/interventions/[id]/page.tsx:821-856`), et le serveur accepte (`cycle-de-vie.ts:178-191`).
  - L'annulation n'écrit que le statut, le motif et la date (`lib/interventions/depot.ts:1406-1413`) : le statut de facturation (« à facturer ») et le montant restent en place.
  - D8 dit « CLOTUREE est terminal ». Vu en ligne sur une clôturée de l'historique repris.
- **Clôturer ou annuler pendant qu'un compteur tourne bloque le technicien** (IN-17).
  - L'arrêt du compteur réécrit l'intervention, et le déclencheur refuse toute écriture sur une intervention figée (`lib/interventions/depot-compteur.ts:206-229` ; migration `…d120` l. 157-167). La route rend une erreur 500.
  - Le segment reste ouvert pour toujours, et aucun autre compteur ne peut démarrer (un seul ouvert par personne).
  - Latent tant qu'aucun technicien n'a de compte.
  - Même famille :
    - une pause reste « en cours » après l'annulation d'une suspendue (IN-18) ;
    - la journée du technicien montre les annulées, et en ouvrir une jamais vue fait planter la fiche (TR-14) ;
    - « Enregistrer le rapport » sur une annulée ou une clôturée rend une erreur 500 (TR-20).
- **La clôture ne vérifie ni rapport validé ni signature** (IN-20). D8 conserve ces gardes (RG-INT-03, RG-INT-04). La table de signature existe (`prisma/schema.prisma:2093`) ; il manque un état « rapport validé ».
- **Annuler une intervention planifiée ne prévient ni le client ni le technicien** (IN-19). L'arbitrage 3.11 range l'annulation parmi les modifications à notifier (RG-INT-05 : à moins de 24 h) ; AVERTISSEMENTS-1 ne couvre que planifier, déplacer et affecter, et 3.19 exclut toute notification au technicien en V1. L'étendre à l'annulation est une décision (fin du §7).

→ **QT-4** (D8 à la lettre : « Terminer », matrice, clôturée terminale), **QT-5** (signature) et deux décisions de fin du §7 (annulation, compteur). Lot **TP-CY**, à coordonner avec PG-G14 (« Transmettre », qui touche la même machine à états).

### 1.3 VGP : la partie qui rapporte n'est pas branchée

*Constats PV-43, PV-41, PA-45, PV-46, PV-30, PV-31, PV-32, CS30 (≡ PV-34), PV-12.*

- **Les réserves ne deviennent jamais des interventions, et ne se lisent nulle part** (PV-43).
  - Une observation saisie est enregistrée avec `intervention_id` vide (`lib/vgp/verification.ts:162-171`).
  - `planifierLObservation` et `observationsEnAttente` ne sont appelées que par des tests. Aucun écran ne lit `vgp_observation`.
  - D88 §10 en fait pourtant « le seul point où ce lot alimente le planning, et celui qui rapporte de l'argent ». L9-10 est marqué LIVRÉ.
  - Autre défaut : `planifierLObservation` crée l'intervention dans une transaction séparée de celle du lien (`lib/vgp/observations.ts:99-107`), contrairement à ce que dit son commentaire.
  - Pour l'import : qu'il ne crée aucune intervention est conforme à l'arbitrage du 22/09 (PV-44, nuancé).
- **Le régime VGP d'une famille ne se décide sur aucun écran** (PV-41, PA-45).
  - Seul l'import des familles l'écrit (`lib/imports/application.ts:1004-1079`). Le formulaire de famille n'a aucun champ VGP (`app/api/parametres/materiel/saisie-recue.ts:27-33`).
  - `/vgp/a-determiner` liste sans rien permettre, et `/parametres/materiel` renvoie à un registre qui n'a pas de formulaire.
  - La campagne (L9-08, `lib/vgp/campagne.ts`) et l'exception par machine (L9-06, `lib/vgp/assujettissement.ts:132`) n'ont aucun appelant.
- **Une date de vérification dans le futur est acceptée et ne se corrige plus** (PV-46) : `components/vgp/formulaire-verification.tsx:40-45` (pas de borne), `lib/vgp/saisie-verification.ts:33-43` (aucun contrôle). Une faute de frappe masque une machine pendant des années.
- **Registre**
  - Il est coupé à 200 lignes, sans compte ni pagination (PV-30, `app/(back-office)/vgp/page.tsx:137`, `:291`). L'ordre « dépassées les plus anciennes en tête » (`lib/vgp/registre.ts:642-656`) a été arbitré le 25/09 ; la coupe muette, non.
  - Il n'a ni tuile ni filtre « Sans information » (PV-31, D88 §2), alors que le tableau de bord la compte.
  - Il compte les machines des clients inactifs (PV-32, D129 muet sur la VGP).
- **Fiche site : une échéance dépassée affichée comme « Prochaine VGP due »** (CS30, prouvé en ligne : dépassée de six mois). `lib/vgp/registre.ts:244-271` prend la plus petite échéance connue, passée comprise, et la tuile n'en dit rien (`app/(back-office)/sites/[id]/page.tsx:554-561`). La fiche machine, elle, dit bien « Échéance dépassée ».
- **Fiche machine** (PV-12, choix commenté N-11/99B, en écart à D88 §2) :
  - « À déterminer » s'affiche aussi pour une famille non soumise et pour une machine sans information ;
  - aucune date de dernière information ;
  - pas d'« Enregistrer » pour une machine jamais renseignée.

→ **QT-9** (un état pour chaque réserve, migration) et **QT-13** (ordre du registre). Lots **TP-A2** (affichage, sans décision) et **TP-VGP**.

### 1.4 Parc : le référentiel ne suit pas la vie des machines

*Constats PV-25, PV-22, PV-21, PV-24.*

- **Aucun chemin ne change le statut, le site, le client ou le modèle d'une machine** (PV-25).
  - La seule mise à jour de `machine` ne les touche pas (`lib/machines/depot.ts:1027-1047`).
  - Le sous-titre de « Corriger la fiche » envoie vers la fiche « pour ces gestes » ; la fiche n'en a aucun.
  - RG-PAR-03 (déplacement avec historique), RG-PAR-05 (sortie du parc : ferraillée ou remplacée) et RG-PAR-06 (lien de remplacement) n'ont aucun chemin. La « machine à l'arrêt » depuis une intervention est EN FILE (PG-G17).
- **Le QR** (PV-22, prouvé en ligne et dans le code).
  - Il contient le jeton brut (`components/ui/qr-code.tsx:69-70`, `parc/[id]/page.tsx:462-466`). La ligne « CODIPLAN:Local-… » n'est que le texte imprimé dessous.
  - La route de résolution rend du JSON (`app/api/machines/qr/[jeton]/route.ts:41-48`), et aucun écran ne lit un QR (L3-11 BLOQUÉ).
  - « Le scan ouvre directement la fiche autorisée » est donc faux : l'appareil photo d'un téléphone affichera un texte.
- **« Local-XXXXXX »** (PV-21) : ce sont les six derniers caractères de l'UUID (aléatoires). L'identifiant est provisoire, introuvable par la recherche du parc, et partagé avec les interventions ; NUMERO-1 ne vise que les interventions. Au jour d'une numérotation des machines, le texte imprimé sous le QR deviendrait faux (le QR, lui, reste valable) : à décider avant d'étiqueter.
- **Terrain** : la fiche d'intervention du technicien ne montre pas la machine (PV-24), ni la panne, ni le contact, ni l'heure, ni la priorité (TR-22). À traiter dans le lot terrain.

→ **QT-10** (contenu du QR), **QT-11** (texte de l'étiquette), **QT-12** (qui déplace, remplace ou ferraille). Lot **TP-PARC**.

---

## 2. Droits et cloisonnement — points d'arrêt (CLAUDE.md §8)

Presque tout ce qui suit est **latent** : seul le premier compte de la société, l'administrateur, peut exister aujourd'hui (§1.1). « Réel » veut dire que ce compte administrateur est touché dès aujourd'hui. Le reste devient réel au premier autre compte ouvert. D'où la règle d'ordre : **le lot TP-S passe avant le lot d'accès TP-ACC.**

| Constat | Qui | Ce qu'il voit ou fait aujourd'hui | Preuve | Effet |
|---|---|---|---|---|
| IN-06 | technicien | tout le registre des interventions ; au tableau de bord, des chiffres de toute la société (dossiers bloqués, pièces attendues, sans durée) | `lib/interventions/depot.ts:2911-2998` (aucune restriction par personne) ; page sans garde `interventions/page.tsx:158-164` ; politique `intervention` sans clause par personne | latent |
| PV-10 | technicien | le parc, les fiches et le registre VGP en entier, au-delà de ce que RG-DRO-02 (amendée par D22) lui ouvre ; il crée et modifie toute machine, ce que la matrice §5.2 lui accorde | pages gardées par session et société seulement (`parc/page.tsx:138-145`) ; politique `machine` sans rôle | latent |
| CS5 | tout compte interne | clients, sites et **interlocuteurs** (téléphones, courriels), sans contrôle de rôle. Un compte client reste borné par la RLS | politiques `cloisonnement_parc` sans prédicat de rôle ; posture écrite dans `tests/unit/auth/porte.test.ts:189-214`, jamais arbitrée | latent (technicien) |
| PA-01, PA-02 | tout compte, technicien compris | les **tarifs** (taux horaire, forfaits). Le « ○ » de la direction vaut un accès complet ; les agences ne sont pas gardées par `administrer_agences` | `parametres/taux-horaire/page.tsx:74-81`, `forfaits/page.tsx:78-84` ; `lib/auth/porte.ts:66` | latent (technicien) |
| TR-4 | technicien | les **absences nominatives** de toute l'équipe, plus un formulaire et un bouton « Lever » que le serveur lui refuse | `absences/page.tsx:134-140` ; `lib/absences/ecran.ts:53`, `:65-69` | latent |
| TR-23 | technicien | les routes du terrain (compteur, rapport, photos, signature) écrivent sur **n'importe quelle** intervention de la société : un envoi forgé agit sur celle d'un collègue | `lib/interventions/depot-compteur.ts:117-120`, `depot-rapport-terrain.ts:85-89`, `lib/documents/depot.ts:421-453` | latent |
| PA-49 | responsables SAV et matériel, ADV | l'import ne demande que le droit « Importer / exporter en masse » : les responsables SAV et matériel **créent en masse** des clients et des sites malgré D130 ; les responsables et l'ADV créent des familles (avec leur régime VGP), des modèles et des prestations que l'écran leur refuse | `app/api/imports/[id]/appliquer/route.ts:99` ; D130 | latent (aucun compte de ce rôle, §1.1) |
| IN-41 | technicien, client | les quatre actions sur une demande (accuser, qualifier, transformer, clore) sont ouvertes à `creer_demande` au lieu de « Qualifier / affecter » (§5.2) | `app/api/demandes/[id]/*/route.ts` | latent (aucune demande ne naît) |
| CS14, CS31, IN-29, PV-49, TR-6 | rôles sans le droit | les écrans offrent des formulaires que le serveur refuse ensuite, **avec le message d'échec de connexion « Vérifiez vos identifiants »** (PV-49 : motif « pas lisible sous la société active ») | `clients/[id]/page.tsx:367-427` ; `sites/[id]/page.tsx:731-787` ; `lib/i18n/fr.ts:93-94` | latent (aucun compte de ce rôle, §1.1) |
| TR-36, TR-34, TR-38 | trois rôles à second facteur | à l'enrôlement, la clé secrète, l'URI `otpauth://` et les codes de secours passent **dans l'URL**. Les codes de secours ne se saisissent nulle part à la connexion. La page d'enrôlement n'a pas de déconnexion et boucle avec `/connexion` | `app/api/session/enrolement/route.ts:33-42` ; `connexion/code/page.tsx:37-42` | réel pour l'administrateur (TR-36, TR-34) ; TR-38 ne joue qu'avant le premier enrôlement |
| CS6 | responsables SAV et matériel | le menu leur cache Clients et Sites, parce qu'il exige le droit d'écriture ; aucune décision ne l'a voulu | `lib/navigation/entrees.ts:523-524` | latent (aucun compte de ce rôle) ; Mineur |
| PA-25 | ADV | refusée sur les trajets par zone, que D107 lui confie. Écart écrit dans R3-03 le 12/09, jamais tranché | `app/api/parametres/trajet-zone/route.ts:48` | latent (aucun compte ADV) |

→ **QT-2** (ce que lit un technicien), **QT-3** (droits d'import), et les décisions de droits listées en fin de §7. Lot **TP-S**.

---

## 3. Argent — points d'arrêt (CLAUDE.md §8)

- **Le mode de valorisation est présélectionné, puis figé** (IN-01).
  - La liste n'a pas de choix vide : « Temps passé » est pris par défaut (`interventions/nouvelle/page.tsx:320-326`, `lib/interventions/saisie.ts:170`).
  - Aucune route ne le modifie ensuite (seule écriture : `lib/interventions/depot.ts:401`), contrairement à RG-TAR-05.
  - Que « Forfait » donne un total inconnu est un choix écrit (`docs/backlog.md:687`) : ce n'est pas le défaut.
- **Les montants d'une intervention clôturée changent à l'affichage** (PA-03).
  - La fiche recalcule à chaque affichage : le taux (celui de la date de l'intervention, dans la grille actuelle : un taux antidaté le change), le forfait (montant actuel) et la majoration (horaires et agence **actuels** du technicien) (`lib/interventions/depot.ts:1912-1946`, `:1154-1171`).
  - Le bon imprime le total figé à la clôture, `montant_ht` (`lib/interventions/bon.ts:231-234`), mais relit le taux et le forfait, sans afficher la majoration.
- **Un forfait se modifie en place**, sans historique ni avertissement, nature comprise (PA-23, `lib/tarification/depot-forfaits.ts:285-297`). C'est contraire à D109, qui historise le forfait comme le taux.
- **Taux antidaté** (PA-12, Mineur).
  - Re-tarifer les interventions non clôturées est la règle RG-TAR-04.
  - Le défaut est le texte de confirmation, qui décrit une autre règle (`lib/i18n/fr.ts:2039-2040`).
- **Déplacement** (PA-19, PA-18, PA-20).
  - Dans une zone sans forfait de déplacement, le déplacement n'est pas facturé, sans que rien le dise (`lib/tarification/valorisation.ts:323-336`) — sauf s'il existe un forfait de déplacement sans condition de zone : il s'applique alors partout. La non-facturation sans forfait applicable est conforme à D11.
  - Le forfait est choisi une fois, à la création : c'est un choix du code (`lib/interventions/depot.ts:379-383`) qu'aucune décision n'écrit. Ajouter un forfait ou une zone ne rattrape pas les interventions déjà créées, et l'écran ne le dit pas. Le recalculer jusqu'à la clôture changerait une règle (point d'arrêt).
  - `/parametres/forfaits` affiche « Retenu » pour des natures de forfait que le calcul n'applique jamais.
  - La case « Cumulable avec le temps passé » n'est lue par aucun calcul, et contredit D77.
- **Le bon remis au client imprime les montants selon qui l'imprime** (IN-35). Ils ne sont masqués que pour un rôle sans droit (`interventions/[id]/bon/page.tsx:269-306`). L'arbitrage 3.8 ne met aucun montant sur le bon du client.
- **Annuler une clôturée laisse « à facturer »** (IN-16, §1.2). Le montant d'une intervention reprise de l'archive est caché sur la fiche et affiché sur le bon (IN-24).
- **Latent** (PA-04) : la devise est lue sans l'identifiant de la société (forfaits, import d'historique). Le défaut ne joue que pour un compte habilité sur deux sociétés.

→ **QT-6** (valorisation : où et jusqu'à quand), **QT-7** (montants figés, forfait historisé), **QT-8** (bon client sans montant), et la case « Cumulable » (fin du §7). Lot **TP-ARG**.

---

## 4. Bugs prouvés en ligne, avec leur cause

Trois lignes demandent une décision (n° 7, 14, 16) ; elles renvoient à leur question.

| # | Page | Ce qu'on voit | Cause dans le code | Constat |
|---|---|---|---|---|
| 1 | fiche site | « Dernières interventions — celles qui restent à planifier en bas » : 12 lignes, dont 2 planifiées et 10 clôturées ; les 2 « À planifier » (la tuile dit 4 ouvertes) **n'apparaissent pas** | `ORDER BY date_planifiee DESC NULLS LAST` puis `take: 12` (`lib/interventions/depot.ts:2743-2756`) : les sans-date sont coupées dès 12 datées | CS29 |
| 2 | fiche client | les interventions ouvertes sans date tombent **à la dernière page** de l'historique (page 21 sur 21 pour le client observé) ; la tuile « Interventions ouvertes » n'est pas cliquable | même tri, paginé (`depot.ts:2597-2602`) | CS9, CS12 |
| 3 | fiche site | « Prochaine VGP due » en gras neutre, pour une échéance dépassée de six mois | minimum des échéances, passées comprises (`lib/vgp/registre.ts:244-271`) | CS30 ≡ PV-34 |
| 4 | rapport d'import | « Appliqué » (la date affichée dessous est celle du contrôle) **et** « Durée de l'application — non mesurée — ce lot n'a pas encore été appliqué » | colonne de durée ajoutée le 23/09 sans reprise des lots déjà appliqués ; valeur vide traduite sans regarder le statut (`app/(back-office)/imports/presentation.ts:136-143`) | PA-53 |
| 5 | rapport d'import | après application, « seront créés… ne seront pas écrits » : la page montre la proposition du contrôle, au futur | choix écrit (`lib/imports/application.ts:467-473`) ; seul le texte trompe | PA-54 |
| 6 | rapport d'import | 300 rejets environ, listés un par un sur 19 000 px, tous du même motif ; « Annuler ce lot » est un bouton principal, sans confirmation, irréversible | aucun regroupement (`imports/[id]/page.tsx:376-413`) ; `ActionPrimaire` sans dialogue | PA-55, PA-56 |
| 7 | fiche intervention clôturée | bloc « Annuler l'intervention » offert, et accepté | voir §1.2 | IN-16 → QT-4 |
| 8 | fiche intervention clôturée (reprise) | « Aucun segment de travail enregistré : le compteur n'a pas encore tourné » ; « heure non fixée » ; année absente | texte sans condition de statut (`interventions/[id]/page.tsx:1427-1430`) | IN-23 |
| 9 | fiche machine | « Le scan ouvre directement la fiche autorisée » et « CODIPLAN:Local-… » | voir §1.4 | PV-22 |
| 10 | Corriger la fiche machine | renvoie à des gestes qui n'existent pas | voir §1.4 | PV-25 |
| 11 | parc (aperçu), fiche machine, portail | « Agence CODIMA », « CODIMA » : le nom d'une société écrit en dur dans un produit multi-société (« Agence CODIMA » est repris de la maquette ; les textes du portail, non) | `lib/i18n/fr.ts:2171`, `:2365`, `:133-134`, `:159-160` | PV-02, TR-53 |
| 12 | planning | « Semaine 40 — du 28 au 3/10/2026· Glisser-déposer » (mois absent au premier jour, espace manquant) | `app/(back-office)/planning/page.tsx:1908-1913` ; `fr.ts:3161` | TR-54 |
| 13 | absences | le calendrier titre « Septembre 2026 » une semaine qui déborde sur octobre | mois du lundi (`absences/presentation.ts:77-81`) | TR-7 |
| 14 | absences | « Lever » reste offert sur une absence terminée ; le texte dit « libère les jours à venir » | aucune borne de date (`lib/absences/depot.ts:309-327`). Le recalcul des taux passés est une règle assumée (R3-14) | TR-2 → QT-15 |
| 15 | parc à 375 px | « Fiche complète » déborde de 6 px | rangée flex sans `min-w-0` (`components/ui/maitre-detail.tsx:197-216`) | PV-06 |
| 16 | menu (compte bureau) | « App technicien » renvoie en silence vers le planning | conforme à la **lettre** de D132 (l. 4855), contraire à son **motif** (l. 4843) ; renvoi figé par une épreuve e2e | TR-44 (Mineur) → QT-24 |
| 17 | fiche client | « + Intervention » ouvre un formulaire vide (la fiche site, elle, passe le site) | `?client=` n'est pas lu | IN-04 ≡ CS13 |
| 18 | registre VGP | 200 lignes et « les premières lignes du registre » : combien il y en a en tout n'est dit nulle part | tri puis `.slice(0, 200)`, sans compte ni pagination (`app/(back-office)/vgp/page.tsx:137`, `:291`) | PV-30 |

**Observations en ligne réfutées ou nuancées**
- **« Trajet — » sur la liste des sites** : cause réfutée. La liste montre bien la valeur appliquée (durée du site, sinon valeur de la zone) ; le tiret reste pour les sites sans durée ni zone, ou aux Îles. Pour un tel site, le planning compte une « journée au trajet inconnu » à 0 minute, et le signale (CS25).
- **« Hors registre » avec « Enregistrer »** : confirmée. Le serveur enregistre la vérification, mais rien ne change à l'écran et aucun message n'apparaît (PV-33).
- **Import des observations VGP sans intervention** : conforme à l'arbitrage du 22/09, ce n'est pas un défaut. Le défaut est que ces observations ne se lisent nulle part (PV-44, PV-43).

---

## 5. Page par page

Pour chaque page : ce qui va, les constats (identifiant, gravité après vérification), puis ce qui doit évoluer. Les constats déjà écrits dans les audits du 26/09 ou du 27/09, ou déjà en file, sont cités en une ligne : on vérifie seulement qu'ils sont toujours vrais.

### 5.1 Exploitation

#### Tableau de bord — `/tableau-de-bord`
- **Ce qui va** : tuiles cliquables, blocs « Priorités opérationnelles » et « VGP », rien ne déborde à 375 px.
- **Constats**
  - IN-46 (Mineur) : « Interventions aujourd'hui » et « Urgences » comptent les annulées, que la vue Jour du planning masque.
  - IN-47 (Mineur) : le chiffre de la tuile « VGP à prévoir » et la liste qu'elle ouvre ne comptent pas la même chose.
  - IN-48 (Mineur) : « Demandes en attente de qualification » compte aussi des demandes déjà qualifiées.
  - IN-49 (Mineur) : les priorités n'ont ni âge, ni client sur les pièces, ni borne ; une clé de texte est morte.
  - IN-06 (§2) : un technicien y verrait les chiffres de toute la société.
  - EN FILE : « planifiées sans durée » compte des « À planifier » (PG-A6) ; lien « blocages d'agenda » (PG-G15).
- **Vu en ligne** : deux interventions d'essai sont affichées (geste d'Alexis, §8).
- **À faire évoluer**
  - Exclure les annulées des tuiles.
  - Une tuile « VGP » qui mène à une liste de même critère.
  - Âge et client sur chaque ligne de priorité, avec une borne et « Tout voir » (nombre à fixer par Alexis).
  - Un lien « Indicateurs du mois » (§6, MO-6).
  - En file : la tuile « En retard » (PG-G8).

#### Registre des interventions — `/interventions`
- **Ce qui va** : onglets, filtres, pagination par 50, défilement horizontal indiqué (CG3).
- **Constats**
  - IN-07 (Mineur) : une période inversée vide la liste et remet tous les compteurs à zéro, sans aucun message.
  - IN-08 (Mineur) : « Planifiées cette semaine » compte des annulées, des clôturées et les clients inactifs.
  - IN-09 (Mineur) : la file d'attente est en dernière page ; « À planifier » est triée à l'inverse du planning ; « Aujourd'hui » n'est pas triée par heure.
  - IN-10 (Mineur) : des filtres se perdent à la pagination et au retour de fiche.
  - IN-11 (Mineur) : les filtres « Affectée », « Terminée » et l'onglet « À contrôler » sont toujours vides (statuts inatteignables, §1.2).
  - IN-12 (Mineur) : « Aucune intervention enregistrée » pour une recherche sans résultat.
  - DÉJÀ COUVERT (GR18) : hauteur d'environ 4 600 px, petits textes, tableau de 920 px à 375 px.
- **À faire évoluer**
  - Colonne « Ancienneté » pour les « À planifier ».
  - Un ordre propre à chaque onglet.
  - Un message quand la recherche est invalide.
  - Retirer « Affectée », « Terminée » et « À contrôler » tant que ces statuts sont inatteignables, ou les rendre atteignables (QT-4, PG-G14).
  - Un technicien ne voit que ses interventions (QT-2).
  - Un onglet « À facturer » (MO-2, QT-19).
  - Un bouton « Exporter » (MO-9).

#### Nouvelle intervention — `/interventions/nouvelle`
- **Ce qui va** : création sans date (PARCOURS-1), refus nommés, champ refusé encadré (GR17).
- **Constats**
  - IN-01 (Majeur, §3) : mode de valorisation imposé à « Temps passé », jamais modifiable ensuite.
  - IN-02 (Mineur) : priorité imposée à « P3 — normale ».
  - IN-03 (Mineur) : après un refus, la demande d'origine et le mode sont perdus.
  - IN-04 (Mineur) : `?client=` n'est pas lu.
  - DÉJÀ COUVERT (26/09 M4) : le retour dit toujours « ← Retour au planning ».
- **À faire évoluer**
  - Lire `?client=` (site présélectionné s'il est seul).
  - Choix vide pour la priorité.
  - Retour vers l'écran d'origine.
  - Le mode de valorisation choisi à la planification et modifiable jusqu'à la clôture (QT-6).
  - En file : la durée à la création (PG-G7).

#### Fiche intervention — `/interventions/[id]`
- **Ce qui va** : blocs d'action repliés, chronologie, créneau et durée au résumé (PG-A5), note interne.
- **Constats**
  - Majeurs, détaillés au §1.2 :
    - IN-14 : « Terminée » inatteignable ;
    - IN-15 : la matrice D8 n'est pas tenue ;
    - IN-16 : une clôturée s'annule ;
    - IN-17 : compteur bloqué après une clôture ou une annulation ;
    - IN-19 : l'annulation ne prévient personne ;
    - IN-20 : la clôture ne vérifie ni rapport ni signature.
  - Mineurs :
    - IN-18 : une pause reste « en cours » ;
    - IN-21 : le retour d'origine se perd après toute action ;
    - IN-22 : trois refus affichent un motif faux (affecter sans technicien, pièce sans date, temps non entier) ;
    - IN-23 : l'historique repris se lit comme en attente ;
    - IN-24 : le montant de l'archive est caché ici, affiché sur le bon ;
    - IN-25 : la note interne n'a pas de libellé ;
    - IN-26 : la borne « 90 prochains jours » est présentée comme une règle ;
    - IN-27 : aucune ancienneté affichée ;
    - IN-28 : sélecteurs à valeur imposée ;
    - IN-29 : des blocs sont offerts à un rôle que la route refuse ;
    - IN-30 : planifier dans le passé est accepté sans un mot (règle absente, point d'arrêt) ;
    - IN-31 : huit lectures successives pour afficher la fiche.
  - EN FILE : heure facultative à la pose (QG-4, PG-G4) ; « Suspendue héritée sans durée » (IN-32 : PG-G4, variante à y ajouter).
  - DÉJÀ COUVERT : « Clôturer » replié sur une « À planifier » (G9).
- **À faire évoluer**
  - Une seule chronologie datée : planification, segments, pauses, clôture.
  - « Créée il y a N jours » sur une « À planifier ».
  - Un refus nommé « un compteur tourne encore ».
  - Un courriel d'annulation, si Alexis le décide (3.11, 3.19 ; fin du §7).
  - Retirer les blocs hors matrice (après QT-4).
  - Historique repris : bandeau « Reprise de l'archive », et Réalisation et Pauses masquées quand elles sont vides.

#### Bon d'intervention — `/interventions/[id]/bon`
- **Ce qui va** : les informations de l'intervention et la signature quand elle existe.
- **Constats**
  - IN-35 (Majeur, §3) : les montants dépendent du rôle de qui imprime.
  - IN-36 (Mineur) : « Adresse — » : la rue ne se saisit nulle part.
  - IN-37 (Mineur) : le bon est rendu dans la coque ; imprimé depuis le navigateur, il emporte la barre latérale ; son titre est la raison sociale.
  - IN-38 (Mineur) : ni date de réalisation, ni cadre pour signer, ni document figé (L3-15 BLOQUÉ).
- **À faire évoluer**
  - Sortir le bon de la coque, avec une vraie mise en page d'impression.
  - Aucun montant sur la version du client (QT-8).
  - La date de réalisation et un cadre de signature.
  - L'adresse du site (QT-18).
  - Plus tard : un PDF figé à la clôture (RAPPORT-1).

#### Demandes — `/demandes`, `/demandes/[id]`
- **Ce qui va** : file triée par ancienneté, « Demande — client » en titre (GR17).
- **Constats**
  - DÉJÀ COUVERT (26/09 G4), toujours vrai : aucune demande ne peut naître (`deposerDemande` n'a aucun appelant) ; la page est donc vide par construction tant que le portail est fermé.
  - IN-40 (Mineur) : les demandes traitées disparaissent de toute liste.
  - IN-41 (Mineur, latent, §2) : actions ouvertes à `creer_demande`.
  - IN-42 (Mineur) : une demande close ou transformée peut encore servir à créer une intervention.
  - IN-43 (Mineur) : deux textes contredisent l'écran.
  - IN-44 (Mineur) : le motif « Résolue par téléphone » est présélectionné.
- **À faire évoluer** : selon QT-14.
  - (a) Donner une source à la file : « Créer une demande » depuis la « suite à donner » d'une intervention (MO-5).
  - (b) Ou masquer l'entrée et la tuile tant qu'aucune source n'existe (revient sur D133).

  Dans les deux cas : un onglet « Traitées », pas de motif présélectionné, les actions gardées par « qualifier / affecter ».

#### Absences — `/absences` (titre à l'écran : « Blocages d'agenda »)
- **Ce qui va** : l'aperçu d'impact avant de poser, la rupture de service, la semaine navigable.
- **Constats**
  - TR-1 (Mineur, EN FILE PG-G15) : « Blocages d'agenda » partout où le menu dit « Absences ». Le périmètre du ticket doit couvrir environ 23 clés de texte et le témoin des captures. D136 n'est pas dans `docs/arbitrages.md`.
  - TR-2 (Mineur) : « Lever » est offert sur une absence terminée, et le texte est faux.
  - TR-3 (Mineur) : une absence qui commence au-delà de J+90 n'apparaît pas au tableau, et ne peut donc pas être levée tant qu'elle n'y est pas.
  - TR-4 (Majeur, §2) : un technicien verrait les absences nominatives de l'équipe.
  - TR-5 (Mineur, écart R3-14) : un technicien ne peut plus bloquer son propre agenda.
  - TR-6 (Mineur) : refus de droit affiché comme un échec de connexion.
  - TR-7 (Mineur) : titre du mois faux.
  - TR-8 (Mineur) : tuile « Demandes à valider — Sans objet ».
  - TR-9 (Mineur) : liste « Personne » triée par identifiant technique, sans choix vide.
  - TR-10 (Mineur) : aucun retour après l'envoi.
  - TR-11 (Mineur) : tableau de trois colonnes imposé à 760 px.
  - DÉJÀ COUVERT : paragraphes de doctrine (C7) ; tuile « Rupture de service » rouge à 0 (TR-13, C5 du 26/09).
- **À faire évoluer**
  - « Écourter » une absence en cours à la place de « Lever », et un état par ligne : à venir, en cours, terminée (QT-15).
  - La tuile « Sans objet » remplacée par « Absents aujourd'hui » (QT-23).
  - « Déclarer une absence » depuis la ligne d'un technicien au planning (avec PG-G13). La page reste au menu (D121).

### 5.2 Clients et parc

#### Clients — `/clients`
- **Ce qui va** : recherche, filtre d'état, clients sans équipement comptés (GR12), cartes lisibles à 375 px.
- **Constats**
  - CS1 (Mineur) : badge « Active » (genre et casse) différent du filtre « Actifs ».
  - CS2 (Mineur) : la recherche ne porte que sur la raison sociale et le code, tient compte des accents, et ignore la commune annoncée par la maquette.
  - CS3 (Mineur) : le compteur « Sans code externe » hérite du masquage des clients sans équipement.
  - CS4 (Mineur, écart D29) : le libellé « Code externe » n'est réglable nulle part.
  - CS5 (Majeur, §2) : aucun contrôle de rôle en lecture.
  - CS6 (Mineur) : Clients et Sites sont cachés du menu des responsables SAV et matériel.
  - DÉJÀ COUVERT : clients sans équipement masqués sans le dire (I-16) ; « 0 équipements » (R-f).
- **À faire évoluer**
  - Chercher aussi la commune, sans tenir compte des accents.
  - Choix du tri (raison sociale, nombre d'équipements, dernière intervention réalisée).
  - Nombre d'interventions à planifier sur chaque carte (dessiné par la maquette).

#### Fiche client — `/clients/[id]`
- **Ce qui va** : tuiles, lieux d'intervention, historique paginé, interlocuteurs, formulaire d'identité.
- **Constats**
  - CS9 (Majeur, bug prouvé, §4 n°2) : les ouvertes sans date tombent en dernière page.
  - CS10 (Mineur) : « Interventions ouvertes » exclut les « Terminée » que le registre range « À contrôler » (règle absente).
  - CS11 (Mineur) : « Équipements » désigne deux populations différentes.
  - CS12 (Mineur) : tuiles inertes.
  - CS13 ≡ IN-04 (Mineur) : « + Intervention » ne préremplit rien.
  - CS14 (Majeur, §2) : formulaires offerts à qui le serveur refusera, avec un message de connexion.
  - CS15 (Mineur) : un client inactif n'est pas signalé sur sa fiche, qui propose ce que le serveur refuse.
  - CS16 (Majeur, écart à arbitrer D129, point d'arrêt) : **désactiver un client retire ses interventions ouvertes du planning, du tableau de bord et de l'application du technicien, sans aucun avertissement**.
  - CS17 (Mineur) : messages de réussite affichés en rouge, comme des refus.
  - CS18 (Mineur) : « Lieux d'intervention » survit.
  - CS19 (Mineur) : sites et interlocuteurs triés par l'ordre SQL (LISTES-1).
  - EN FILE (PG-G8, à y ajouter : ce ticket ne vise pas les fiches client et site) : planifiée à date passée sans « En retard » (CS22).
  - DÉJÀ COUVERT : fil d'Ariane doublé d'un lien de retour (I-13, M12) ; « Dernière intervention » = la plus récente, tout statut confondu (I-10), vu en ligne sur une planifiée du jour.
- **À faire évoluer**
  - Un **bloc « À traiter »** en tête : à planifier par urgence puis ancienneté, planifiées à venir, en retard, suspendues.
  - La tuile « Équipements » mène au parc filtré (`/parc?client=`).
  - « Dernière intervention réalisée » séparée de « Prochaine intervention ».
  - Désactivation refusée tant qu'il reste des interventions ouvertes (QT-16).

#### Nouveau client — `/clients/nouveau`
- CS23 (Mineur) : champ obligatoire non signalé, saisie perdue au refus (décision du 27/09 : « (obligatoire) » partout).
- CS24 (Mineur) : un double clic crée deux fiches. Même défaut pour les sites et les interlocuteurs.

#### Sites — `/sites`
- **Ce qui va** : trajet appliqué affiché (CS25 : observation réfutée), sites sans équipement comptés, « Client — Site » (GR12).
- **Constats**
  - CS25 (Mineur) : « — » mêle « zone manquante » et « Îles ».
  - CS26 (Mineur) : « Client — Libellé » répété quand le site porte le nom du client.
  - CS27 (Mineur) : les sites d'un client inactif sont présentés comme actifs.
  - CS28 (Mineur, I9) : des commentaires du code et des tests citent des raisons sociales réelles (lot TP-I9).
- **À faire évoluer** : un filtre « Trajet inconnu » (DÉJÀ COUVERT, 27/09 §4.9) ; l'état du client sur la ligne.

#### Fiche site — `/sites/[id]`
- **Ce qui va** : « + Intervention » et « + Machine » préremplis, parc du site, habilitations exigées.
- **Constats**
  - CS29 (Majeur, bug prouvé, §4 n°1) : les « À planifier » n'apparaissent pas.
  - CS30 ≡ PV-34 (Majeur, bug prouvé, §4 n°3) : « Prochaine VGP due » dépassée.
  - CS31 (Mineur) : « Exiger » et « Retirer » une habilitation sont offerts à tous, et réservés à l'administrateur de société (choix écrit qui suit D37 ; D130 est à confronter).
  - CS32 (Mineur) : rattachement affiché « DUCOS — DUCOS ».
  - CS33 (Mineur) : le trajet réellement appliqué n'est pas affiché sur la fiche.
  - CS34 (Mineur) : l'aide promet « les tournées ».
  - CS35 (Mineur) : ni état actif, ni adresse, ni horaires d'accès.
  - CS36 (Mineur) : historique sans colonne Machine.
  - CS37 (Mineur) : une douzaine de lectures successives pour afficher la fiche.
  - DÉJÀ COUVERT : « Dernière intervention » (I-10) ; formulaire sans titre en bas de page, fil d'Ariane par « Clients » (M12, C6).
- **À faire évoluer**
  - Le même bloc « À traiter » que la fiche client.
  - Un bloc « VGP du site » : machines soumises, état (dépassée en rouge, sans information depuis…, à venir), bouton « Enregistrer ».
  - « Qui sera prévenu » (l'interlocuteur donneur d'ordre qui reçoit les courriels).
  - Le trajet appliqué et sa source ; l'adresse (QT-18).

#### Nouveau site — `/sites/nouveau`
- CS40 (Mineur, Majeur si des homonymes existent en base) : deux clients homonymes sont indiscernables dans la recherche ; un nom tapé sans choisir dans la liste est refusé avec un message sur des « champs numériques », et la saisie est perdue.
- CS41 (Mineur) : aucun rattachement présélectionné alors qu'une seule agence est proposable (décision 11).
- CS42 (Mineur) : obligatoires non marqués ; saisie et client perdus au refus ; aucun rappel d'un site homonyme.

#### Interlocuteurs — bloc des fiches client et site
- CS43 (Majeur, bug déduit) : **vider le courriel d'un interlocuteur provoque une erreur serveur**, la contrainte en base n'étant pas rattrapée (`lib/contacts/depot.ts:78-97`).
- CS44 (Majeur, règle absente, point d'arrêt) : le courriel est exigé de tout interlocuteur, alors que seul le donneur d'ordre en reçoit.
- CS45 (Mineur) : seul le rôle « donneur d'ordre » sert à quelque chose ; « signataire », « contact technique » et « comptabilité » ne sont lus nulle part.
- CS46 (Mineur) : obligatoires non marqués, saisie perdue au refus.
- CS47 (Mineur) : coordonnées cachées derrière le formulaire de modification ; pas d'appel direct.
- CS48 (donnée) : un interlocuteur d'essai est enregistré sur un client réel (§8).
- **À faire évoluer** : courriel exigé du seul donneur d'ordre (QT-17) ; téléphone cliquable ; « qui reçoit quoi » affiché sur la carte.

#### Parc machines — `/parc`
- **Ce qui va** : liste et aperçu côte à côte, filtres, pagination, fiche complète.
- **Constats**
  - PV-01 (Mineur, latent) : les machines remplacées, ferraillées ou fusionnées sont mêlées au parc et impossibles à isoler (D28).
  - PV-02 (Mineur ; Majeur avant d'ouvrir une seconde société) : « Agence CODIMA ».
  - PV-03 (Mineur) : la recherche annonce « l'identifiant » mais ne le cherche pas.
  - PV-04 (Mineur) : libellés des filtres hétérogènes.
  - PV-05 (Mineur) : dans l'aperçu, l'intervention sans date passe en tête, sans statut ni lien.
  - PV-06 (Mineur, bug prouvé) : débordement à 375 px.
  - PV-07 (Mineur) : sur téléphone, l'aperçu reste sous une liste de 680 px.
  - PV-08 (Mineur, point d'arrêt) : le seuil de « Garanties < 90 jours » vient de la maquette, et la date de fin de garantie ne s'affiche ni sur l'aperçu ni sur la fiche (seulement dans le formulaire de correction).
  - PV-09 (Mineur) : indicateurs calculés sur 500 fiches au plus, sans le dire.
  - PV-10 (Majeur, §2) : un technicien lit et modifie tout.
  - PV-11 (Mineur) : un lien vers le registre VGP est glissé entre la liste et sa pagination.
- **À faire évoluer**
  - Une option « Sorties du parc ».
  - La recherche sur la référence interne.
  - La tuile « garanties » cliquable, avec son seuil fixé par Alexis.

#### Fiche machine — `/parc/[id]`
- **Ce qui va** : identité, rattachement, historique, échéance VGP dépassée bien signalée, QR et impression.
- **Constats**
  - PV-12 (Majeur, écart à D88 §2 d'un choix écrit, N-11/99B) : « À déterminer » affiché à tort ; pas de date de dernière information ; pas d'« Enregistrer » pour une machine jamais renseignée.
  - PV-13 (Mineur) : la colonne « Résultat » affiche le statut.
  - PV-15 (Mineur) : trois ordres d'historique différents (fiche machine, fiche site, fiche client).
  - PV-16 (Mineur) : bloc « Documents » : aucun chemin ne crée de document, et « le téléchargement n'est pas encore disponible ».
  - PV-17 (Mineur, D128) : fin de garantie, criticité, localisation, référence interne et facture d'origine absentes de la fiche.
  - PV-18 (Mineur) : aucun message après « Enregistrer ».
  - PV-19 (Mineur) : une machine sortie du parc garde son bandeau orange et « + Intervention ».
  - PV-21 (Majeur avant toute campagne d'étiquetage, Mineur sinon) et PV-22 (Majeur), §1.4 : identifiant « Local- » et QR.
  - PV-23 (Mineur) : l'étiquette imprime la carte entière, sans désignation ni numéro de série.
  - DÉJÀ COUVERT : « Aucun technicien affecté » sur l'historique repris (I-12) ; h1 générique (M5, choix de la maquette).
- **À faire évoluer**
  - Un bloc « Gestes » : changer l'état, transférer, remplacer, sortir du parc (QT-12).
  - « Historique des états et des emplacements », lu dans le journal d'audit.
  - Un bloc « Vérifications reçues » avec leurs réserves et « Créer l'intervention » (`verificationsDeLaMachine` existe sans appelant).
  - Les faits réels manquants (D128).
  - Le bloc Documents seulement s'il porte un document.

#### Corriger la fiche — `/parc/[id]/modifier` ; Nouvelle machine — `/parc/nouvelle`
- PV-25 (Majeur, §1.4) : impasse.
- PV-26 (Mineur) : « Connexion interrompue… Rien n'a été modifié » affirme ce que le code ne sait pas.
- PV-27 (Mineur) : « Remplacée » et « Ferraillée » dès la création, sans date ni remplaçante ; « Fusionnée » est accepté par le serveur.
- PV-28 (Mineur) : les défauts « En service » et « Normale » viennent du schéma, jamais d'un arbitrage ; la criticité n'a aucun effet.
- PV-29 (Mineur) : des doublons de modèles à la casse ou aux espaces près contournent RG-PAR-01 (à mesurer sur les données).
- **À faire évoluer** : retirer le sous-titre trompeur tout de suite ; retirer les statuts terminaux de la création quand le geste de sortie existera.

#### Registre des vérifications périodiques — `/vgp`
- **Ce qui va** : tuiles « à venir » et « dépassées » cliquables, motif de chaque état, recherche, « Échéance dépassée » dite une seule fois (GR17).
- **Constats**
  - PV-30, PV-31, PV-32 (Majeurs, §1.3) : coupe muette à 200 lignes ; pas de « Sans information » ; clients inactifs comptés.
  - PV-33 (Mineur) : « Enregistrer » sur une ligne hors registre écrit, sans rien changer à l'écran ni afficher de message.
  - PV-35 (Mineur, point d'arrêt) : « à venir » vaut 30 jours au tableau de bord, et n'a pas de borne au registre.
  - PV-36 (Mineur) : le même message vide quel que soit le filtre.
  - PV-37 (Mineur) : la désignation est cherchée mais jamais affichée ; marque, famille et site ne sont pas cherchés.
  - PV-38 (Mineur, D88 §3) : badge « Hors registre » pour une famille « à déterminer ».
  - PV-39 (Mineur) : textes de référence des régimes d'attente ; « mois » écrit en dur.
  - PV-40 (Mineur) : 401 cibles tactiles de moins de 32 px à 375 px (page de 17 000 px).
- **À faire évoluer**
  - Compte total et pagination.
  - Filtres Client et Site ; vue groupée par client puis par site, imprimable (MO-12).
  - Tuile et filtre « Sans information ».
  - Vue « Réserves » (MO-3, QT-9).
  - Bloc « Familles à déterminer », affiché seulement s'il y en a, avec « Décider le régime » (MO-29).

#### Familles à déterminer — `/vgp/a-determiner`
- PV-41 (Majeur, §1.3) : liste sans issue.
- PV-42 (Mineur) : bandeau « 0 familles restent à déterminer → » et tuile « À déterminer » inerte.
- **À faire évoluer** : fondre la page dans le registre (MO-29), puis la retirer.

#### Enregistrer une vérification — `/vgp/enregistrer/[id]`
- PV-43 (Majeur, §1.3) : les observations ne deviennent pas des interventions.
- PV-46 (Majeur) : une date future est acceptée et ne se corrige plus.
- PV-45 (Mineur) : refus = saisie perdue ; double envoi = doublon.
- PV-47 (Mineur, D114) : « Organisme » obligatoire même pour une « Déclaration du client ».
- PV-48 (Mineur) : écran « aveugle », sans l'état actuel de la machine, et sans retour après l'enregistrement.
- PV-49 (Mineur, D131) : un technicien voit le bouton partout, puis un refus « pas lisible sous la société active ».
- **À faire évoluer**
  - Refuser une date postérieure au jour civil de la société (son fuseau) — règle à confirmer (fin du §7).
  - Afficher la dernière information connue.
  - « Organisme » facultatif pour une déclaration du client (à arbitrer, D114).
  - Après l'enregistrement, revenir à la ligne concernée avec un message.

### 5.3 Paramètres et imports

#### Hub — `/parametres` (« Sociétés & tarifs »)
- **Constats**
  - PA-07 (Mineur) : onze portes, dont deux doublons du menu (Clients, Sites), sans Imports ni App technicien.
  - PA-08 (Mineur, D125) : le hub n'a pas été confronté à la maquette complète.
  - TR-46 (Mineur, D121) : le libellé est trop étroit pour son contenu.
- **À faire évoluer**
  - Retirer les portes Clients et Sites. Leur motif (« barre close à onze entrées ») est caduc depuis D121 ; aucune décision n'est touchée.
  - Regrouper en sections : Société · Tarifs · Organisation (agences, trajets, équipe, habilitations) · Référentiels (matériel, prestations) · Données (imports, données à compléter) — écart à arbitrer (D125 : la maquette dessine trois cartes, Société · Agences · Tarification, et un tableau des forfaits actifs, PA-08 ; fin du §7).
  - Titre « Paramètres » (QT-21, écart à D121).

#### Charte de la société — `/parametres/societe`
- PA-09 (Mineur) : page sans action, qui renvoie à une console éditeur invisible (lot 7).
- PA-10 (Mineur) : ce que la société a réglé à sa mise en service (devise, fuseau, territoire, majoration) n'est lisible nulle part.
- **À faire évoluer** : remplacer la page par une carte « Identité de la société », en lecture, dans le hub, et retirer la porte jusqu'au lot 7 (QT-22, revient sur N-02).

#### Taux horaire — `/parametres/taux-horaire`
- PA-11 (Mineur) : seul le taux du jour a un statut ; l'ancien ne dit pas « remplacé le… ».
- PA-12 (Mineur) : le texte de confirmation d'une date d'effet passée décrit une autre règle.
- PA-13 (Mineur) : les refus parlent encore d'« unités mineures ».
- PA-01 (Majeur, §2) : les tarifs sont lisibles par tout compte.
- **À faire évoluer** : un statut par ligne ; une confirmation qui compte les interventions non clôturées touchées par une date passée.

#### Prestations — `/parametres/prestations`
- PA-14 (Mineur) : « … ou au forfait qui s'applique » : aucun forfait de prestation n'est jamais appliqué.
- PA-15 (Mineur) : la même explication deux fois.
- PA-16 (Mineur) : un formulaire « Modifier » déplié par prestation sous le tableau.
- PA-17 (Mineur) : la durée standard ne sert à rien aujourd'hui ; des familles désactivées sont proposées.
- **Vu en ligne** : une seule prestation au catalogue (geste d'Alexis, §8). La « durée d'abord » du futur planning (PG-G6/G7) s'appuiera sur ce catalogue.

#### Forfaits — `/parametres/forfaits`, `/parametres/forfaits/[id]`
- PA-18, PA-19, PA-20, PA-23 (§3) : verdict « Retenu » faux, déplacement non facturé sans le dire, case « Cumulable » contraire à D77, forfait modifié en place.
- PA-21 (Mineur) : le sélecteur de zone n'a pas de libellé associé, ni d'option « site sans zone ».
- PA-22 (Mineur) : trois mots pour la nature d'un forfait ; la colonne Actions sort du cadre à 1280 px. Retirer la colonne « Catégorie » serait un écart à D125.
- **À faire évoluer**
  - La phrase « Aucun forfait de déplacement pour cette zone : le déplacement n'est pas facturé ».
  - « Désigné par N interventions » avant de modifier un forfait.
  - Un forfait historisé comme le taux (QT-7).

#### Trajets par zone — `/parametres/trajets`
- PA-24 (Mineur) : « 30 min (30 minutes) ».
- PA-26 (Mineur) : l'origine des valeurs de référence n'est pas dite ; « Enregistrer » fige la référence ; une colonne sort du cadre à 1280 px.
- PA-25 (Majeur, §2) : l'ADV est refusée (R3-03, jamais tranché).

#### Agences — `/parametres/agences` et ses sous-pages
- **Constats**
  - DÉJÀ COUVERT (27/09 §4.12), toujours vrai : l'agence inactive est listée en premier, et reste réglable (PA-27).
  - PA-28 (Mineur) : deux calendriers portent le même nom ; la fiche des horaires ne dit pas quelle agence elle règle.
  - PA-29 (Mineur) : même adresse, deux entités : `/parametres/agences/[id]` attend un calendrier, `/parametres/agences/[id]/modifier` une agence.
  - PA-30 (Mineur) : vocabulaire mélangé sur un même parcours : agence, établissement, calendrier, horaires d'ouverture.
  - PA-31 (Mineur) : la colonne « Horaires » ne montre que le premier jour travaillé.
  - PA-32 (Mineur) : colonne « Exceptions », alors qu'aucun écran ne permet d'en poser.
  - PA-33 (Mineur) : jargon sur les « compteurs d'accusé de réception ».
  - PA-34 (Mineur) : « Ajouter une plage » est prérempli 08:00–12:00 sur chaque jour, jours fermés compris.
  - PA-35 (Mineur) : « nc » s'affiche « NC » mais est refusé ; tout code de deux lettres est accepté ; le fuseau est en saisie libre.
- **À faire évoluer** (MO-30)
  - Une seule page **« Agences »**, le mot imposé par D5 et la maquette, et non « Établissements ».
  - Une fiche par agence : identité, horaires, fériés travaillés et ponts (RG-PLA-02, aucun écran aujourd'hui).
  - Les inactives en fin de liste.
  - Territoire et fuseau choisis dans une liste.

#### Équipe — `/parametres/equipe`
- PA-36 ≡ TR-40 (Bloquant, §1.1) : un technicien ajouté ici ne peut jamais se connecter.
- PA-37 (Mineur) : nom et courriel non modifiables après la création.
- PA-38 (Mineur) : tableau puis seconde liste « Modifier — nom » des mêmes lignes (même motif qu'A-02).
- PA-39 (Mineur) : l'équipe est triée par identifiant technique.
- PA-40 (Mineur) : aucun geste pour renouveler une habilitation expirée.
- EN FILE : le champ salarié/patenté (PG-G16) ; « (patenté) » est aujourd'hui écrit dans le nom.
- **À faire évoluer** : « Envoyer le lien d'accès » et l'état de l'accès (QT-1) ; nom modifiable ; « Renouveler » une habilitation.

#### Habilitations — `/parametres/habilitations`
- DÉJÀ COUVERT (A-02, arbitrage H1) : deux listes des mêmes lignes.
- PA-42 (Mineur) : « aide à la saisie » qui n'existe pas ; la carte du hub promet ce que la page ne fait pas.

#### Référentiel matériel — `/parametres/materiel`
- PA-43 (Majeur, ergonomie) : les modèles (environ 130) forment un seul bloc, une ligne et un volet par modèle, sans recherche ni pagination : 19 000 px.
- PA-44 (Mineur) : « Entretien périodique » n'alimente rien, et son unité « h » est inventée.
- PA-45 (Majeur, §1.3) : le régime VGP ne se déclare nulle part.
- PA-46 (Mineur) : une famille désactivée reste proposée, avec ses modèles.
- PA-47 (donnée) : un modèle porte un numéro de série dans sa référence (§8).
- **À faire évoluer** : familles et modèles sur deux onglets, recherche et « Voir plus », nombre de machines par modèle (repère pour les doublons).

#### Imports — `/imports`, `/imports/[id]`
- **Constats**
  - PA-48 (Majeur ; Bloquant le 26/09, B2), toujours vrai : « Télécharger le modèle Excel » est inerte.
  - PA-49 (Majeur, §2) : l'import contourne D130.
  - PA-50 (Mineur) : type affiché en code technique ; la seule date est celle du contrôle ; plafond de 50 lignes non dit.
  - PA-51 (Mineur) : « Contacts — Contrôle seulement », sur un motif périmé depuis CONTACTS-1.
  - PA-52 (Mineur, D125) : disposition non confrontée à la maquette complète.
  - PA-53 à PA-56 (§4 n°4 à 6) : états contradictoires, textes au futur, rejets listés un par un, annulation sans confirmation.
  - PA-57 (Mineur) : le rattachement d'un lot d'historique est recalculé contre le parc d'aujourd'hui.
  - PA-58 (Mineur) : lot introuvable → page nue.
- **À faire évoluer**
  - Un seul écran à étapes (Fichier · Contrôle · Confirmation · Résultat), dont le résultat dit ce qui a été écrit.
  - Les rejets regroupés par motif, avec leur nombre et la correction à faire.
  - L'annulation confirmée.
  - Appliquer l'import des contacts (MO-10), ou masquer ce type.
  - Livrer le modèle Excel, ou masquer le lien.

### 5.4 Terrain, accès, navigation

#### Terrain — `/terrain`, `/terrain/[id]` (non vu en ligne : aucun compte technicien)
- TR-14 (Majeur, latent) : la journée montre les annulées, et en ouvrir une jamais vue fait planter la fiche.
- TR-20 (Majeur, latent) : « Enregistrer le rapport » sur une annulée ou une clôturée → erreur 500.
- TR-22 (Majeur, latent) : la fiche ne montre ni la panne, ni le contact, ni l'heure, ni la priorité, ni la machine (CDC §13.3).
- TR-23 (Majeur, §2) : aucune écriture n'est filtrée par personne.
- TR-19 (Mineur) : « Démarrer » est offert quel que soit le statut, puis refusé sur une annulée, une clôturée ou une suspendue ; accepté sur « À planifier » (IN-15) ; pas de « Reprendre ».
- TR-15, TR-16, TR-24, TR-25 (Mineurs) : « Affectées, sans date » mêle plusieurs états ; aucun signe qu'un compteur tourne ; carte sans priorité ni panne ; textes qui ne disent pas ce qui se passe ; cibles peu adaptées au terrain.
- EN FILE : « Planifiée » visible du terrain avant transmission (QG-5, PG-G14) ; plantage à l'ouverture d'une « Planifiée » héritée sans durée (PG-G4).
- **À faire évoluer** (lot terrain)
  - « Ma journée » : bandeau du compteur en cours ; demain et sept jours.
  - Fiche : panne, créneau, contact cliquable, machine, « Terminer » (QT-4), « Suspendre » et « Reprendre », signature avec « client absent » tracé (QT-5).
  - Scanner un QR (MO-4).

#### Connexion, code, enrôlement, premier accès
- TR-40 (Bloquant, §1.1) et TR-32 (Majeur) : aucun accès pour un nouveau technicien ; aucune issue pour un mot de passe oublié.
- TR-34 (Majeur) : les codes de secours remis à l'enrôlement ne se saisissent nulle part.
- TR-36 (Majeur) : la clé secrète et les codes de secours passent dans l'URL.
- TR-37 (Mineur) : pas de QR code à l'enrôlement, alors que le dépôt sait en dessiner un.
- TR-38 (Mineur, trois rôles) : pas de déconnexion ; boucle avec `/connexion`.
- TR-39 (Mineur) : un code faux ramène à l'étape du mot de passe.
- TR-31 (Mineur) : base injoignable → « Vérifiez vos identifiants ».
- TR-33 (Mineur) : autocomplétion mal renseignée.
- TR-35 (Mineur) : le titre reprend le libellé du champ ; aucun retour vers la connexion.
- TR-41 (Mineur) : textes et champs du premier accès.
- **À faire évoluer** (lot TP-S) : secrets hors de l'URL ; QR à l'enrôlement ; saisie d'un code de secours ; « Se déconnecter ».

#### Navigation, titres, retours
- TR-44 (Mineur, D132) : « App technicien » renvoie les rôles de bureau vers le planning, en silence (QT-24).
- TR-45 (Mineur) : docblocks périmés depuis D132.
- TR-47 (Mineur) : bouton du menu à 36 px sur téléphone.
- TR-48 à TR-51 (Mineurs) : deux fils d'Ariane seulement, chacun doublé d'un lien de retour ; cinq cas où le retour mène ailleurs que l'origine ; libellés de retour hors modèle ; titres qui ne disent pas quelle fiche est ouverte.
- **À faire évoluer** : un seul modèle de retour — un fil d'Ariane sur toutes les fiches, un « ← » seulement là où il n'y a pas de fil, `depuis` sur tous les points d'entrée (chantier C6 du 26/09 : la forme est une décision, fin du §7).

#### Vocabulaire
- TR-52, TR-55 (Mineurs) : « établissement » (30 fois) et « lieu(x) » (environ 40 fois) coexistent avec « Agence » et « Site ». CLAUDE.md les donne comme définitions : c'est une question de glossaire d'affichage, pas une fraude au gardien.
- TR-53 (Mineur) : « CODIMA » et « Winpro » sont écrits en dur.
- TR-56 (Mineur) : clés mortes.
- **À faire évoluer** : un glossaire d'affichage arrêté par Alexis (un mot par notion), puis le test du vocabulaire étendu aux synonymes (changer un gardien est une décision : fin du §7).

#### Portail, arrivée, santé
- TR-27 (Mineur) : pour un compte bureau, le portail atteint par son adresse enferme dans la coque du portail.
- TR-28 (Mineur) : textes du portail avec le nom de la société en dur.
- TR-29 (Mineur) : l'arrivée redirige directement, sans écran « qui suis-je » ; changer de société exige de taper l'adresse.
- TR-30 (Mineur) : sans société active, la barre ne montre que « Demandes », qui renvoie à l'arrivée.
- TR-42 (Mineur) : deux lignes de la page santé toujours « non lisible », et des textes hors dictionnaire.
- TR-43 (Mineur) : le détail d'une migration s'affiche deux fois.
- **À faire évoluer** : la page santé affiche le commit servi et sa date (utile pour savoir ce qui est en ligne) ; une page « Mon compte » (rôle en clair, société active, changer de société, second facteur) — P3.

---

## 6. Modules et pages : ajouter, retirer, fusionner

*Détail et preuves : `docs/propositions/audit-2026-09-28/constats/MO.md` (matrice de couverture du cahier des charges, modules M1 à M12, parcours P1 à P7, indicateurs, amorçage), corrigé par `VERIF-PA-MO.md` (même dossier).*

### 6.1 Où en est le cahier des charges

| Module | État au 28/09 | Ce qui manque surtout |
|---|---|---|
| M1 Référentiels | presque livré | adresse, GPS et horaires des sites (colonnes présentes, sans écran ni import) ; import des contacts ; forfaits autres que le déplacement jamais appliqués, forfait non historisé (M1g : PARTIEL, et non LIVRÉ) |
| M2 Parc | partiel | gestes sur une machine (statut, déplacement, remplacement, ferraillage) ; scan du QR ; ajout de documents ; historique des états |
| M3 Interventions | partiel | « Terminée » ; matrice D8 ; demandes sans source ; valorisation modifiable |
| M4 Planning | en file | lots PG-G4 à PG-G17 (audit du 27/09) ; fériés travaillés et ponts sans écran ; astreinte absente |
| M5 Rapport | partiel | PDF, envoi, validation ; les préconisations ne deviennent pas des demandes |
| M6 Contrats | différé (décision 9) | — |
| M7 Terrain | partiel | **aucun accès technicien possible** ; en ligne seulement ; fiche pauvre |
| M8 Portail | hors V1 | — |
| M9 Tableaux de bord | partiel | un seul tableau « du jour » ; aucun indicateur mensuel ; aucun export |
| M10 Administration | partiel | **aucun second compte** ; journal d'audit sans écran |
| M11 Imports / exports | imports : livrés à 9 types sur 10 ; exports : absents | « À facturer », exports normalisés |
| M12 Console éditeur | différé (lot 7) | — |

**Couches écrites sans écran qui les atteigne** (vérifiées) :
- réserves VGP (`lib/vgp/observations.ts`) ;
- campagne VGP (`lib/vgp/campagne.ts`) et exception par machine (`lib/vgp/assujettissement.ts:132`) ;
- vérifications d'une machine (`verificationsDeLaMachine`) ;
- planche d'étiquettes (`engendrerPlancheDeJetons`) ;
- dépôt d'une demande (`deposerDemande`) ;
- contrôle « site fermé » (`avertissementSiteFerme`) ;
- statut de facturation, lu par aucun écran ;
- journal d'audit ;
- six capacités sans consommateur, dont `preparer_facturation` et `valider_rapport`.

**Angle mort de l'outillage** : le gardien `pnpm chemins` ne regarde que `lib/*/depot*.ts`, ce qui laisse passer ces fonctions VGP. Il faudrait l'étendre (lot TP-A6).

### 6.2 Ajouter

**P1 — ce qui fait boucler le métier**

| # | Ajout | Où | Pourquoi | Décision |
|---|---|---|---|---|
| MO-1, MO-15 | **Accès des comptes** : « Envoyer le lien d'accès » (techniciens d'abord, puis comptes de bureau), état de l'accès, réémission pour un mot de passe oublié | Paramètres › Équipe | sans accès, pas de compteur, pas de clôture, rien à facturer | écart D65 → QT-1 ; **après TP-S** |
| MO-2 | **« À facturer »** : les clôturées à facturer, colonnes utiles, export Excel, « Marquer facturée » (n° et date de facture Winpro) | onglet du registre des interventions, gardé par `preparer_facturation` (D37) | relie le travail fait à l'argent encaissé (P7, FACTURE-1) | QT-19 ; restera vide tant que QT-1 n'est pas fait, et invisible pour l'administrateur (seul compte ouvert) tant que les comptes de bureau ne sont pas ouverts (TP-ACC) |
| MO-3 | **« Réserves VGP »** : chaque réserve d'organisme, son état, et « Créer l'intervention », une par une | vue du registre VGP, plus un bloc sur la fiche machine | D88 §10 : la VGP qui rapporte | QT-9 (état de la réserve : migration, point d'arrêt) |
| MO-4 | **Scan du QR** : une page d'atterrissage qui ouvre la fiche (bureau) ou la fiche terrain (technicien), session exigée | page sans entrée de menu | décision 8 du 23/09 : « scan téléphone → fiche » | QT-10 ; **avant toute impression d'étiquettes en série** |

**P2 — ce qui fiabilise et fait gagner du temps**

| # | Ajout | Où | Pourquoi | Décision |
|---|---|---|---|---|
| MO-7 | **« Données à compléter »** : des décomptes cliquables vers l'écran qui corrige — sites sans zone ni trajet, zones sans forfait de déplacement, sites dont le client ne sera prévenu faute de donneur d'ordre avec courriel, planifiées sans durée, rejets d'import, familles à déterminer, prestations sans durée | porte « Données » du hub Paramètres | ces trous faussent la charge, la facturation et les courriels sans que personne ne les voie | aucune (compatible AV-14 : ce n'est pas le tableau de bord) |
| MO-6 | **« Indicateurs du mois »** : machines ajoutées, interventions créées et clôturées par nature, préventif et curatif, heures validées et mesurées, chiffre d'affaires clôturé (si droit), état du registre VGP | page ouverte depuis le tableau de bord | §2.2 du cahier des charges ; « ne pas mesurer » est une cause d'échec de l'amorçage (cahier des charges §8.4) | QT-20 ; décomptes seulement, aucun objectif inventé |
| MO-8 | **Gestes sur une machine** : changer l'état, transférer, remplacer, sortir du parc, avec historique | fiche machine | RG-PAR-03, 05, 06 ; « Corriger la fiche » y renvoie déjà | QT-12 ; la « machine à l'arrêt » est EN FILE (PG-G17) |
| MO-9 | **Exporter** (registre, parc, registre VGP), montants seulement avec le droit | bouton des trois listes | M9, M11 ; l'ADV recopie dans Winpro | écart nommé sous D128, à lever |
| MO-12 | **Registre VGP par client et par site**, imprimable | filtres et vue groupée de `/vgp` | dire au client ce qu'on sait de ses échéances | vendre la VGP reste hors V1 (D88) |
| MO-10 | **Appliquer l'import des contacts** | Imports | le type n'est que contrôlé, sur un motif périmé | aucune |
| MO-11 | **Adresse et horaires d'accès du site**, montrés au technicien et sur le bon | fiche site | « Adresse — » sur le bon ; un SAV itinérant doit savoir où aller | QT-18 |
| MO-5 | **Suites à donner → Demandes** : « Créer une demande » depuis la suite saisie par le technicien | fiche intervention | M5 : « le principal gisement commercial » ; donne une source à `/demandes` | QT-14 ; ÉCART À ARBITRER (CDC §7 M5 : « automatiquement ») ; geste manuel proposé |

**P3 — plus tard**
- **« Mon compte »** : rôle, société active, second facteur. Le changement de mot de passe en libre-service est à arbitrer (D58).
- **Journal d'audit consultable** : administrateur, direction.
- **Centre de notifications** dans le bandeau : sans push, nouvelle table (point d'arrêt).
- **Pose à deux techniciens** : deux interventions « jumelles » factureraient deux déplacements et deux planchers, contre D11 → à arbitrer.
- **Prêts** : le lot PRET est en file ; la place au menu sera à décider à son arrivée.

### 6.3 Retirer ou masquer

| # | Quoi | Pourquoi | Décision |
|---|---|---|---|
| MO-27 | les portes **Clients** et **Sites** du hub Paramètres | doublons du menu depuis D121 | aucune |
| MO-24 | la page **Charte de la société**, jusqu'au lot 7 (information gardée dans une carte « Identité ») | page sans action | QT-22 (N-02) |
| MO-25 | la tuile **« Demandes à valider — Sans objet »** des absences, remplacée par « Absents aujourd'hui » | tuile sans information | QT-23 (choix du 25/09) |
| MO-26 | le bloc **Documents** de la fiche machine quand il est vide, et « pas encore disponible » | aucun document ne peut être ajouté | aucune (ajout nommé, hors maquette) |
| PA-48 | le lien **« Télécharger le modèle Excel »** tant qu'il est inerte (ou le livrer) | lien mort, signalé Bloquant le 26/09 | aucune |
| PA-51, MO-10 | le type d'import **Contacts** s'il n'est pas appliqué | proposé, jamais applicable | aucune |
| IN-11 | les filtres **« Affectée », « Terminée », « À contrôler »** tant que ces statuts sont inatteignables | toujours vides | dépend de QT-4 et de PG-G14 |
| PV-22, CS34, MO-18 | les promesses **« le scan ouvre la fiche »** et **« … aux tournées »** | textes faux | écart de contenu nommé (D128) pour la phrase du scan, reprise de la maquette |
| TR-44, MO-23 | **« App technicien »** pour les rôles de bureau : au minimum une page « réservé aux techniciens » au lieu du renvoi silencieux | entrée qui ne s'ouvre pas | QT-24 (D132, décision du 26/09) |
| MO-28 | l'entrée **Demandes** et sa tuile, **seulement si** QT-14 = (b) | file sans source | D133 |

### 6.4 Fusionner

| # | Fusion | Pourquoi | Décision |
|---|---|---|---|
| MO-29 | **« Familles à déterminer » dans le registre VGP**, avec le geste « Décider le régime » (soumise avec périodicité et texte, non soumise, vérifiée), puis ouverture de la campagne existante | la page d'aujourd'hui ne permet rien ; la règle existe (`lib/vgp/assujettissement.ts:60`) | aucune (D88 §3, §5, §7 tenus) |
| MO-30 | **Horaires d'ouverture + établissements → « Agences »** : liste, puis une fiche par agence (identité, horaires, fériés travaillés et ponts) | une adresse, deux entités (PA-29) ; fériés sans écran | aucune ; mot « Agence » (D5) |
| MO-31 | **Absences ← planning** : « Déclarer une absence » depuis la ligne d'un technicien ; la page reste | l'absence est un fait de planning | aucune (retirer la page serait un écart D121) |
| MO-32 | **Taux horaire + Forfaits → « Tarifs »** (facultatif) | deux réglages d'argent rarement touchés ; la maquette les montre ensemble | aucune |
| CS9, CS29, PV-15 | **un seul ordre d'historique** : à traiter en tête, puis le plus récent (fiches machine, site, client, aperçu du parc) | trois ordres pour la même question, dont deux qui cachent des lignes | aucune |
| PV (fusion 3) | **une seule lecture de l'état VGP** : fiche machine, fiche site, registre, tableau de bord | quatre lectures, quatre réponses (CS30, PV-12, PV-35) | aucune, sauf l'horizon « à venir » (valeur à fixer par Alexis, PV-35) |

### 6.5 Écarté, avec la raison
- **Astreinte** : aucun besoin exprimé ; la modéliser comme une absence typée contredirait R3-14.
- **Compétences** : les habilitations portent déjà les exigences des sites (RG-PLA-04).
- **Tournées** : P3 ; un filtre « Zone » dans la colonne « À traiter » du planning suffit (à joindre à PG-G9).
- **Campagne de recensement** : elle attend le terrain hors ligne.
- **Entretien préventif hors contrat** (d'après la périodicité des modèles) : aucune périodicité n'est saisie, la règle n'existe pas au chapitre 10, et les contrats sont différés (décision 9) → QT-25.

### 6.6 Le menu, après ces changements

| Domaine (D121) | Entrées |
|---|---|
| Exploitation | Tableau de bord (→ Indicateurs du mois) · Planning · Demandes (selon QT-14) · Interventions (onglets, dont **À facturer**) · Absences |
| Clients & parc | Clients · Sites · Parc machines · VGP (Registre · **Réserves** · Familles à déterminer si > 0) · Prêts (lot PRET, à décider) |
| Paramètres | Paramètres (hub en sections : Société · Tarifs · Organisation · Référentiels · **Données à compléter**) · Imports Excel · App technicien (selon QT-24) |
| Hors menu | page de **scan** · **Mon compte** (initiales du bandeau) |

---

## 7. Questions pour Alexis

Une question = une décision. La recommandation est en premier. La série 1 bloque les lots qui touchent aux droits, au cycle de vie et à l'argent ; aucun ticket marqué « ⚠ QT-x » ne part sans la réponse.

### Série 1 — accès, droits, cycle de vie, argent

| # | Question | Options (recommandée en premier) | Débloque |
|---|---|---|---|
| QT-1 | Avancer dès maintenant l'ouverture des comptes par l'administrateur (D65, prévue au lot 7) : « Envoyer le lien d'accès » depuis Équipe pour les techniciens, puis les comptes de bureau, et la réémission pour un mot de passe oublié ? Conséquence (D65, point 4) : le geste d'amorçage disparaît, et le premier compte d'une nouvelle société ne pourra plus s'ouvrir avant la console du lot 7. | (a) oui, **après** le lot de cloisonnement TP-S ; (b) oui, tout de suite, en acceptant les défauts latents du §2 ; (c) non, rester au lot 7 (aucune clôture possible d'ici là) | TP-ACC, « À facturer » |
| QT-2 | Que lit et que fait un technicien ? La règle écrite est RG-DRO-02, amendée par D22 : les machines de ses interventions, tout le parc des clients chez qui il a une intervention planifiée dans les 7 jours, la résolution par QR ; la matrice §5.2 lui donne « Créer / modifier une machine ». | (a) appliquer RG-DRO-02 : ses interventions et leurs fiches, le parc des clients qu'il visite sous 7 jours, sa propre absence ; ni le registre complet, ni les chiffres de la société, ni les tarifs, ni les absences des autres ; il garde la création et la modification de machines ; (b) le limiter à ses seules interventions, sans créer ni modifier de machine (écart à arbitrer : D22, matrice §5.2) ; (c) laisser tel quel (écart à RG-DRO-02) | TP-S |
| QT-3 | Les droits de l'import suivent-ils ceux des écrans (clients et sites : les rôles de D130 ; familles, modèles, prestations : ceux de leur écran) ? | (a) oui, droits par type d'import (D130 pour clients et sites) ; (b) garder le seul droit « Importer / exporter en masse » pour tout (lettre de la matrice §5.2, mais contraire à D130 pour les clients et les sites) | TP-S |
| QT-4 | D8 s'applique-t-il à la lettre : un bouton « Terminer » pour le technicien (En cours → Terminée), la clôture seulement depuis « Terminée », les transitions hors matrice refusées (suspendre avant démarrage, démarrer une « À planifier »), et une clôturée qui ne s'annule plus ? | (a) oui, D8 à la lettre, « Terminer » d'abord ; (b) amender D8 pour garder la clôture depuis « En cours » | TP-CY, filtres du registre |
| QT-5 | La signature du client : RG-INT-04 l'exige pour **clôturer**, sauf motif d'exception tracé et notifié au responsable ; D-S5 (16/09, décision du projet, absente de `docs/arbitrages.md`) la place au « Terminer ». L'exige-t-on dès « Terminer » ? | (a) oui, au « Terminer », avec un motif d'absence tracé et notifié au responsable (puis écrire D-S5 dans `docs/arbitrages.md`) ; (b) seulement à la clôture (lettre de RG-INT-04) ; (c) facultative (revient sur RG-INT-04 et sur D8) | TP-CY, terrain |
| QT-6 | Le mode de valorisation (temps passé ou forfait) : où le choisit-on, et jusqu'à quand se modifie-t-il (RG-TAR-05) ? | (a) choisi à la planification (qualification), modifiable jusqu'à la clôture par les rôles qui qualifient (ADV, responsables, direction, administrateur) ; (b) choisi à la création, non modifiable (état actuel) | TP-ARG |
| QT-7 | Les montants d'une intervention clôturée sont-ils figés (la fiche et le bon lisent le montant figé ; le forfait est historisé comme le taux, D109) ? | (a) oui, figés à la clôture ; (b) recalculés à chaque affichage (état actuel, contraire à RG-TAR-04 et à D109) | TP-ARG |
| QT-8 | Le bon remis au client porte-t-il des montants (arbitrage 3.8) ? | (a) jamais : une version client sans montant, et une version interne ; (b) selon le rôle de qui imprime (état actuel, contraire à 3.8) | TP-ARG, bon |

### Série 2 — VGP et parc

| # | Question | Options | Débloque |
|---|---|---|---|
| QT-9 | Chaque réserve VGP reçoit-elle un état (à traiter, levée, écartée avec motif), avec la reprise de l'état importé, pour être affichée et transformée en intervention une par une ? (migration ; « levée » est ce qu'un client verra.) D88 §10 et L9-10 écrivent qu'une observation « engendre » une intervention ; le code a choisi un geste humain par réserve, et l'arbitrage du 22/09 exclut toute création à l'import. | (a) oui, avec le geste manuel une par une ; (b) afficher sans état ; (c) plus tard. Une création automatique serait l'autre lecture de D88 | TP-VGP, MO-3 |
| QT-10 | Le QR imprimé porte-t-il une adresse web (avec le jeton, session exigée), pour que l'appareil photo de n'importe quel téléphone ouvre la fiche ? Cela revient sur la lettre du cahier des charges (§11 : « le QR encode le qr_token, jamais autre chose », qui cite I10 et D7). | (a) oui, avant toute impression en série ; (b) non : jeton seul, et un lecteur dans l'application | TP-PARC, MO-4 |
| QT-11 | Sous le QR, imprimer la désignation et le numéro de série plutôt que « Local-… », qui est provisoire ? | (a) oui ; (b) attendre un numéro de machine définitif (NUMERO-1 étendu aux machines) | TP-PARC |
| QT-12 | Changer l'état d'une machine, la transférer, la remplacer, la sortir du parc : qui peut le faire, et avec quelle trace ? | (a) le bureau seulement, tracé (ancien et nouveau site, date, motif) : restreint le droit que la matrice §5.2 donne au technicien sur les machines (écart à arbitrer) ; (b) le bureau et le technicien affecté, tracé | TP-PARC, MO-8 |
| QT-13 | Registre VGP : garder l'ordre arbitré le 25/09 (dépassées les plus anciennes en tête), en ajoutant le compte, la pagination, et une tuile et un filtre « Sans information » ? | (a) garder l'ordre, ajouter le reste ; (b) dépassées, la plus récente d'abord ; (c) « à venir » d'abord | TP-A2, TP-VGP |

### Série 3 — pages et modules

| # | Question | Options | Débloque |
|---|---|---|---|
| QT-14 | La file « Demandes », tant que le portail est fermé ? | (a) la nourrir par « Créer une demande » depuis la suite à donner d'une intervention — geste manuel, alors que le cahier des charges (M5) demande une création automatique : écart à arbitrer ; (b) masquer l'entrée et la tuile (revient sur D133) ; (c) la laisser vide | TP-DEM |
| QT-15 | Absences : remplacer « Lever » (une suppression : R3-14 point 5, votre arbitrage du 14/09) par « Écourter » (les jours passés restent), et ne plus rien proposer sur une absence terminée ? | (a) oui (revient sur R3-14 point 5) ; (b) garder « Lever » partout | TP-ABS |
| QT-16 | Désactiver un client qui a des interventions ouvertes (D129 muet) ? | (a) refuser, en listant les interventions ouvertes ; (b) avertir (« N interventions ouvertes vont sortir du planning et du terrain »), puis désactiver ; (c) laisser faire (état actuel : elles disparaissent du planning) | TP-CLI |
| QT-17 | Le courriel est-il obligatoire pour tout interlocuteur ? | (a) seulement pour le donneur d'ordre (le seul qui reçoit des courriels) ; (b) pour tous (état actuel) | TP-CLI |
| QT-18 | L'adresse d'un site : une ligne libre (rue, lieu-dit, boîte postale) en plus de la commune ? | (a) une ligne libre ; (b) des champs séparés | TP-CLI, bon, terrain |
| QT-19 | « À facturer » : un onglet du registre des interventions, gardé par le droit de préparer la facturation, avec export et « Marquer facturée » (n° et date de facture Winpro) ? | (a) onglet ; (b) nouvelle entrée de menu (écart nommé à D121) | TP-MOD (FACTURE-1) |
| QT-20 | Une page « Indicateurs du mois » maintenant (décomptes seulement : ni objectif, ni taux consolidé, ni marge), alors que la feuille de route du 23/09 différait le pilotage ? | (a) oui ; (b) après les contrats | TP-MOD |
| QT-21 | Titre du hub : « Paramètres » au lieu de « Sociétés & tarifs » ? | (a) oui, écart nommé à D121 ; (b) non | TP-NAV |
| QT-22 | Retirer la page « Charte de la société » jusqu'au lot 7, en gardant l'information dans une carte « Identité » du hub ? | (a) oui (revient sur N-02) ; (b) non | TP-NAV |
| QT-23 | Absences : remplacer la tuile « Demandes à valider — Sans objet » par « Absents aujourd'hui » ? | (a) oui (revient sur le choix du 25/09) ; (b) non | TP-ABS |
| QT-24 | « App technicien » pour les rôles de bureau, qui sont aujourd'hui renvoyés en silence vers le planning ? | (a) garder l'entrée, mais afficher « réservé aux techniciens » au lieu de renvoyer (revient sur votre décision du 26/09, « Rien, D132 tient », prise en connaissant ce renvoi ; seul fait nouveau : le renvoi est silencieux) ; (b) masquer l'entrée (revient sur D132 et sur la décision du 26/09) ; (c) laisser tel quel | TP-NAV |
| QT-25 | Proposer les entretiens préventifs hors contrat d'après la périodicité des modèles, avant le module Contrats ? | (a) pas maintenant ; (b) oui (règle à écrire au chapitre 10, périodicités à saisir) | — |
| QT-26 | L'ordre global proposé au §9 ? Il avance PG-G14 (« Transmettre ») avant PG-G11 à G13, contrairement à l'ordre accepté le 27/09. | (a) d'accord ; (b) autre ordre | tout |

### Décisions à obtenir avant le lot concerné (hors numérotation)

Aucun ticket du lot ne part sans la réponse ; le pilote les pose au moment du lot, une question = une décision.

- **TP-S**
  - Que veut dire le « ○ » de la direction sur « Paramétrer une société » : lecture seule, ou tarifs seulement (PA-02) ?
  - L'administrateur de société, qui pose les tarifs, doit-il pouvoir les lire (D37, PA-01) ?
  - Les responsables SAV et matériel lisent-ils les clients et les sites (CS6) ?
  - Qui déclare les habilitations exigées d'un site : les rôles de D130 ou l'administrateur seul (D37, CS31) ?
  - L'ADV règle-t-elle les trajets par zone (D107 contre R3-03, PA-25) ?
- **TP-CY**
  - Prévenir le client et le technicien par courriel à l'annulation d'une intervention planifiée (3.11 ; 3.19 exclut la notification du technicien en V1 ; IN-19) ?
  - Un compteur qui tourne pendant une clôture ou une annulation : refuser (recommandé, aucune écriture de temps), ou fermer le segment à cet instant (cela écrit un temps facturé, D119, D120) ?
- **TP-A2** : refuser une date de vérification postérieure au jour de la société (PV-46) ? Recommandé : oui ; aucune valeur à inventer.
- **TP-VGP**
  - Les machines des clients inactifs sortent-elles du registre VGP (D129 muet, PV-32) ?
  - Quel horizon « à venir », unique pour tous les écrans (30 jours au tableau de bord, aucune borne au registre ; valeur à fixer, PV-35) ?
- **TP-ABS** : un technicien peut-il de nouveau bloquer son propre agenda (R3-14, TR-5) ?
- **TP-NAV**
  - La disposition du hub : les trois cartes de la maquette (D125), ou des sections (PA-08) ?
  - La forme du retour : fil d'Ariane partout, ou « ← » (chantier C6 du 26/09) ?
  - Le glossaire d'affichage (un mot par notion), et l'extension du gardien du vocabulaire aux synonymes ?
- **TP-PARC** : le seuil de « Garanties < » (90 jours dans la maquette, PV-08) ?
- **TP-ARG** : retirer la case « Cumulable avec le temps passé », contraire à D77 (PA-20) ?

---

## 8. Gestes d'Alexis, sans code

1. **Annuler les deux interventions d'essai.** Déjà demandé le 27/09 ; elles sont toujours au planning et au tableau de bord le 28/09.
2. **Compléter heure et durée des interventions « Planifiée » sans durée.** Déjà demandé le 27/09.
3. **Désactiver l'interlocuteur d'essai** enregistré sur un client réel : fiche client, bloc Interlocuteurs.
4. **Catalogue des prestations** : il n'en contient qu'une. Saisir les prestations courantes avec leur durée standard (valeurs d'Alexis). La future « durée d'abord » du planning s'en servira.
5. **Forfaits de déplacement** : il n'y en a qu'un, pour une seule zone. Décider des autres zones (montants d'Alexis), ou accepter que le déplacement n'y soit pas facturé (et le faire dire à l'écran, PA-19).
6. **Observations VGP rejetées à l'import** : près de la moitié des lignes du lot, pour le même motif (« la référence de rapport couvre plusieurs machines »). Compléter la colonne « Machine (n° de série) » dans le fichier des rejets (téléchargeable depuis le rapport du lot), puis redéposer. Utile dès que les réserves s'affichent (MO-3).
7. **Sites sans zone ni trajet** : les compléter. Sinon le planning compte 0 minute de trajet et le signale.
8. **Le modèle dont la référence contient un numéro de série** : le corriger dans le référentiel matériel. Si la référence corrigée existe déjà, la correction est refusée (aucune fusion de modèles n'existe).
9. **Précautions en attendant les corrections**
   - Ne pas désactiver un client qui a des interventions ouvertes : elles disparaîtraient du planning (CS16).
   - Ne pas saisir de date de vérification VGP dans le futur : elle ne se corrige plus (PV-46).
   - Ne pas imprimer d'étiquettes QR en série avant QT-10 et QT-11.
10. **Familles soumises à la VGP** : remplacer la référence « … à préciser » par le texte qui fonde la périodicité (D88 §4).
11. **Sites à « 0 min » de trajet** : vérifier que c'est voulu.

---

## 9. Lots proposés et ordre

*Détail (parties, territoire, dépendances, preuves à remesurer) : `docs/propositions/audit-2026-09-28/lots.md`.*

| Lot | Contenu | Décision | Taille |
|---|---|---|---|
| **TP-0-DOCS** | cet audit, les lots et les constats dans `docs/` (commit seul) | aucune | 1 ticket |
| **TP-A1** | fiches client et site : historiques (ouvertes sans date en tête, un seul ordre), tuiles cliquables, `?client=` | aucune | 1 ticket |
| **TP-A2** | VGP, affichage : échéance de la fiche site, registre compté et paginé, « Sans information », « Enregistrer » sur une ligne hors registre, date future refusée, textes du scan et de « Corriger la fiche » | QT-13 pour l'ordre ; date future : décision de fin du §7 | 1 ticket |
| **TP-A3** | rapport d'import : état juste, textes au passé, rejets groupés par motif, annulation confirmée, liens morts masqués | aucune | 1 ticket |
| **TP-A4** | messages : refus de droit distinct de l'échec de connexion, motifs faux, période inversée, messages vides, réussites en vert, saisie gardée après un refus | aucune | 1 ticket |
| **TP-A5** | libellés et textes faux : « CODIMA » et « Winpro » en dur, sous-titre du planning, mois des absences, tournées, « Retenu », zone sans forfait, statut du taux, historique repris | aucune | 1 ticket |
| **TP-A6** | tris et petites mises en page : débordement à 375 px, agence inactive en fin de liste, tri de l'équipe, annulées exclues du tableau de bord ; gardien `pnpm chemins` étendu | aucune | 1 ticket |
| **TP-I9** | raisons sociales réelles remplacées par des noms fictifs (commentaires, tests, passations) — l'historique git n'est pas réécrit | aucune (I9) | 1 ticket |
| **TP-S** | cloisonnement et sécurité (§2) | ⚠ QT-2, QT-3 et décisions de fin du §7 ; point d'arrêt ; migration possible (RLS) | 2 à 3 tickets |
| **TP-CY** | cycle de vie (§1.2) : « Terminer », matrice D8, compteur, pause, annulées au terrain, courriel d'annulation | ⚠ QT-4, QT-5 et décisions de fin du §7 ; point d'arrêt ; migration (déclencheur du cycle de vie) ; avec ou après PG-G14 | 2 tickets |
| **TP-TER** | terrain : fiche complète (panne, contact, machine, priorité), bandeau du compteur, « Démarrer » selon le statut, « Reprendre » | après TP-CY ; à fondre dans le lot « terrain » en file | 1 à 2 tickets |
| **TP-ACC** | accès des comptes (§1.1) | ⚠ QT-1 ; point d'arrêt ; **après TP-S** | 1 à 2 tickets |
| **TP-ARG** | argent (§3) | ⚠ QT-6, QT-7, QT-8 et décision de fin du §7 ; point d'arrêt ; migration (forfait daté) | 2 tickets |
| **TP-VGP** | réserves, régime des familles (fusion de `/vgp/a-determiner`), exception, vérifications sur la fiche machine, vue par client | ⚠ QT-9, QT-13 et décisions de fin du §7 ; migration | 2 à 3 tickets |
| **TP-PARC** | gestes sur une machine et historique, QR et page de scan, étiquette | ⚠ QT-10, QT-11, QT-12 ; seuil des garanties (fin du §7) | 2 tickets |
| **TP-CLI** | client inactif, interlocuteurs (erreur serveur, courriel, rôles), homonymes, double clic, recherche | ⚠ QT-16, QT-17, QT-18 | 2 tickets |
| **TP-ABS** | « Écourter », états, fenêtre J+90, tuile, entrée depuis le planning | ⚠ QT-15, QT-23 et décision de fin du §7 ; avec PG-G15 | 1 ticket |
| **TP-DEM** | demandes : source, droits, onglet « Traitées » | ⚠ QT-14 ; migration si (a) | 1 ticket |
| **TP-NAV** | retours et fils d'Ariane, hub en sections, « Agences », glossaire, « App technicien » | ⚠ QT-21, QT-22, QT-24 et décisions de fin du §7 (hub, retour, glossaire) | 2 à 3 tickets |
| **TP-MOD** | « À facturer », « Indicateurs du mois », « Données à compléter », exports, import des contacts | ⚠ QT-19, QT-20 ; « À facturer » après TP-ACC et TP-CY | 3 à 4 tickets |

**Ordre recommandé (QT-26)**
1. **TP-0-DOCS**, juste après le ticket en cours.
2. **La file du planning GMAO continue jusqu'à PG-G10 (fin de PG-C).** On y intercale TP-A1 à TP-A6, puis TP-I9 : un TP-A après chaque groupe PG. Ils touchent peu le planning et la fiche intervention : TP-A5 corrige le sous-titre du planning et deux textes de la fiche, TP-A4 trois refus des routes de la fiche. Chacun est remesuré sur main au dépôt, après les groupes PG qui modifient ces fichiers.
3. **Le circuit** : DEPLANIFIEE-1 (à sa place, après PG-G10) → PG-G14 (« Transmettre », avancé avant PG-G11 à G13, ce qui revient sur l'ordre accepté le 27/09) → TP-S → TP-CY → TP-TER (avec le lot « terrain ») → TP-ACC → TP-ARG → « À facturer » (TP-MOD). C'est ce qui permet de clôturer et de facturer dans CODIPLAN.
4. **Ensuite**
   - la fin du planning : PG-G11 à PG-G13, PG-G15 avec TP-ABS, PG-G16, PG-G17 avec TP-PARC ;
   - puis TP-VGP, TP-CLI, TP-DEM, TP-NAV et le reste de TP-MOD.

**Pour tout ticket qui touche un écran**
- Captures **avant et après**, à 1280 et 375 px, dans `docs/propositions/<ticket>/captures/`, avec un README (commit photographié, date).
- Scène de démonstration uniquement, jamais une donnée de production (I9).

---

## 10. Limites de cet audit

- **Non vu en ligne**
  - Le terrain et le portail, faute de compte technicien et de compte client : leurs constats sont lus dans le code (marqués « latent » ou « déduit »).
  - L'existence de comptes technicien créés autrement, en production.
- **Non mesuré**
  - Les homonymes de clients (CS40) et les doublons de modèles (PV-29).
  - La performance : les lectures sont comptées, pas chronométrées.
- **Lu sans exécuter** : les politiques RLS, dans les migrations.
- **375 px** : émulé dans le navigateur intégré (téléphone Android simulé), pas sur un vrai téléphone.
- **Planning** : voir l'audit du 27/09, et les lots PG en file.

## Annexes

Dans `docs/propositions/audit-2026-09-28/` :
- `lots.md` : le découpage en tickets ;
- `constats/IN.md`, `CS.md`, `PV.md`, `PA.md`, `TR.md` : les constats page par page, avec preuves (`fichier:ligne` au commit `bcc637e`), effet, correctif et couverture ;
- `constats/MO.md` : la matrice de couverture du cahier des charges et les propositions MO-1 à MO-32 ;
- `constats/VERIF-IN-TR.md`, `VERIF-CS-PV.md`, `VERIF-PA-MO.md` : les verdicts de la vérification contradictoire (confirmé, nuancé, réfuté), **qui prévalent**.
