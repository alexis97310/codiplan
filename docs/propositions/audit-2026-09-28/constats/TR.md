# Audit TR — absences, terrain, portail, arrivée, connexion, santé, navigation, vocabulaire

*Partie « code » de l'audit page par page du 28/09/2026. Dépôt lu en lecture seule au commit `bcc637e` (= production). Aucun fichier modifié, aucun serveur ni base lancés. Aucune donnée de production ci-dessous.*

**Niveaux de preuve.** « vu en ligne » = observation du passage du 28/09 (compte bureau `admin_societe`) confirmée par le code ; **DÉDUIT** = établi par lecture du code seul, à rejouer en recette avant correction ; **À VÉRIFIER** = le code ne suffit pas à conclure, la raison est dite.
**Décisions relues** : D8, D58, D59, D65, D97, D118, D119, D120, D121, D131, D132, D133, D134 (`docs/arbitrages.md`), R3-14 et 99D-ABSENCES-2 (`docs/backlog.md`), QG-8 (`docs/propositions/planning-gmao/decisions-2026-09-27.md`), CDC §13 et ch. 10. **D135 et D136 n'existent pas dans le dépôt** (`git grep "D136"` : 0 ligne) : la décision « Absence partout » (QG-8, confirmée le 27/09 malgré R3-14) n'est écrite que dans le tableau QG et dans la conversation de pilotage.

---

## /absences

- **TR-1** — **« Blocages d'agenda » partout où le menu dit « Absences » ; le périmètre de PG-G15 n'est pas vérifiable** — Gravité : Mineur — Nature : Incohérence
  - Constat : vu en ligne. Le titre, l'onglet du navigateur, le lien du planning et le retour de la fiche intervention lisent `absences.titre` ; le formulaire, les tuiles, la pastille, le tableau de bord et le planning portent leurs propres clés « blocage / bloqué / agenda / indisponible ». Le corps du ticket PG-G15 (E3a) vit hors dépôt (VM Cowork) : `lots.md` ne dit que « un mot (« Absence ») », l'audit I-6 liste 7 surfaces. **À VÉRIFIER** dans le corps du ticket qu'il couvre la liste exhaustive ci-dessous.
  - Preuve : `lib/i18n/fr.ts:2614` `"absences.titre": "Blocages d'agenda",` ; `lib/navigation/entrees.ts:313` `{ cle: "nav.absences", chemin: "/absences" }` ; `scripts/captures.mts:434` `temoin: "Blocages d'agenda",`.
    Liste à couvrir (23 clés + 3 hors dictionnaire) : `absences.titre` (h1, onglet, lien du planning `planning/page.tsx:621`, retour « ← Retour aux blocages d'agenda » `interventions/presentation.ts:315`), `absences.declarer` (« Bloquer un agenda »), `absences.declarer_action` (« Bloquer »), `absences.aucune`, `absences.immediat`, `absences.retroactif`, `absences.levee_explication`, `absences.levee_confirmation_avant`, `absences.kpi_demandes_a_valider_motif`, `absences.pastille_bloque` (« Bloqué »), `absence.refus.inconnue`, `absence.refus.saisie`, `absence.refus.pour_autrui`, `intervention.refus.absence`, `intervention.technicien_agenda_bloque_le`, `intervention.disponibilite_technicien.fenetre`, `tableau_de_bord.lien_absences_jour` (« Voir la semaine dans les blocages d'agenda → »), `tableau_de_bord.kpi_absences_jour` (« Techniciens indisponibles »), `planning.agenda_bloque`, `planning.legende.agenda_bloque`, `planning.resume_agenda_bloque_un`, `planning.resume_agendas_bloques`, `planning.legende.suspendue` (« Suspendue / absence ») ; hors dictionnaire : témoin de prise de vue `scripts/captures.mts:432-434` (sinon la capture de `/absences` sera refusée, comme `client-detail` le 23/09), écart nommé `lib/absences/ecarts-maquette.ts:64` (« Le formulaire « Bloquer un agenda » »), docblock `app/(back-office)/absences/page.tsx:99-105` (« Le TITRE reste « Blocages d'agenda » »).
  - Effet pour l'utilisateur : trois mots (absence, blocage, indisponible) pour une même chose ; on doute d'être sur la bonne page.
  - Correctif proposé : reporter la liste ci-dessus dans PG-G15 ; écrire D136 (décision du 27/09, fond de R3-14 conservé : aucun motif) ; passer 99D-ABSENCES-2 de BLOQUÉ à LIVRÉ ; réécrire le docblock.
  - Couverture : EN FILE (PG-G15, E3a — QG-8) ; DÉJÀ COUVERT (26/09 M10, 27/09 I-6).

- **TR-2** — **« Lever » une absence passée est accepté, efface la période entière et réécrit les taux d'occupation passés** — Gravité : Majeur — Nature : Bug déduit / Écart à arbitrer (R3-14 point 4)
  - Constat : vu en ligne (absence passée de deux jours avec « Lever » actif) ; conséquences DÉDUITES. `leverLeBlocage` ne regarde aucune date : la ligne est supprimée, passée ou en cours. Le taux d'occupation relit la table à chaque rendu : les semaines concernées regagnent les jours absents au dénominateur. Une absence en cours perd aussi ses jours déjà écoulés. Le texte affiché dit l'inverse (« libère les jours à venir ») et l'avertissement rétroactif ne parle que de la pose.
  - Preuve : `lib/absences/depot.ts:318-325` `const blocage = await tx.absence.findFirst({ where: { id: saisie.absence_id } … await tx.absence.delete(…)` ; `lib/interventions/occupation.ts:210` `const absences = await tx.absence.findMany({` ; `lib/i18n/fr.ts:2636` « Lever un blocage libère les jours à venir. »
  - Effet pour l'utilisateur : un clic sur une ligne terminée ne libère rien pour le planning mais change en silence le taux d'occupation de semaines déjà lues (et l'absence disparaît de l'historique affiché).
  - Correctif proposé : masquer « Lever » sur une absence terminée (état « Terminée ») ; pour une absence en cours, « Écourter » (fin = veille) plutôt que supprimer — **règle nouvelle, Arrêt §8 / question à Alexis** (R3-14 point 4 n'a tranché que la pose) ; au minimum, étendre `absences.retroactif` à la levée.
  - Couverture : NOUVEAU.

- **TR-3** — **Une absence qui commence au-delà de J+90 n'apparaît pas au tableau et ne peut pas être levée** — Gravité : Majeur — Nature : Bug déduit
  - Constat : DÉDUIT. Le tableau (seul endroit portant « Lever ») lit la fenêtre J-30 → J+90 ; le calendrier montre la pastille si l'on navigue jusqu'à la semaine, mais la pastille n'a aucune action. Après la pose d'une absence lointaine, rien ne confirme qu'elle existe.
  - Preuve : `app/(back-office)/absences/page.tsx:588-589` `const JOURS_DE_PASSE = 30; const JOURS_A_VENIR = 90;` ; `lib/absences/ecran.ts:53-54` `where: { du: { lte: fenetre.au }, au: { gte: fenetre.du } }` ; `page.tsx:486-493` (pastille = `<span>`, pas de lien).
  - Effet pour l'utilisateur : une absence saisie par erreur pour dans quatre mois ne se corrige pas ; on risque de la reposer (doublon).
  - Correctif proposé : lire toutes les absences à venir (borne haute ouverte) et garder J-30 pour le passé ; ou rendre la pastille cliquable vers la ligne. Sans valeur métier nouvelle (J+90 est une borne d'écran, pas une règle).
  - Couverture : NOUVEAU.

- **TR-4** — **Un technicien ouvre /absences : il voit les absences nominatives de toute l'équipe, le formulaire et « Lever », que le serveur lui refuse** — Gravité : Majeur — Nature : Écart à arbitrer (R5-01, R3-14)
  - Constat : DÉDUIT. L'entrée « Absences » exige `consulter_planning`, que le technicien a en ○ ; la page n'exige qu'une session et une société ; la lecture n'a aucun filtre par personne. Le planning, lui, a été corrigé le 17/09 (R5-01) précisément parce que « le technicien voyait la liste nominative de toute l'équipe — une fuite par déduction ». L'épreuve `tests/e2e/navigation-app-technicien.spec.ts:96-99` établit qu'un technicien atteint bien la barre du back-office.
  - Preuve : `lib/navigation/entrees.ts:522` `"nav.absences": "consulter_planning",` ; `lib/absences/ecran.ts:53` `const absences = await tx.absence.findMany({` et `:65` `tx.technicien.findMany({ where: { actif: true },` ; contraste `app/(back-office)/planning/page.tsx:161-170`.
  - Effet pour l'utilisateur : un technicien lit qui est absent et quand (donnée qu'on a voulu soustraire au client, D94) et se voit offrir des gestes refusés.
  - Correctif proposé : **Arrêt §8 (données personnelles)** — option A : restreindre `/absences` au périmètre (le technicien ne voit que lui, comme le planning, via `perimetreDuPlanning`) ; option B : entrée et page réservées à `modifier_planning`. À trancher par Alexis.
  - Couverture : NOUVEAU.

- **TR-5** — **Un technicien ne peut plus bloquer son propre agenda, contrairement à l'arbitrage R3-14** — Gravité : Mineur — Nature : Écart à arbitrer (R3-14)
  - Constat : DÉDUIT. R3-14 garde le déclencheur « un technicien bloque son propre agenda, jamais celui d'un autre » ; depuis D-12 (20/09) la route exige `modifier_planning`, que le technicien n'a pas. Le déclencheur et le message `absence.refus.pour_autrui` sont devenus inatteignables depuis l'application, sans décision écrite.
  - Preuve : `app/api/absences/declarer/route.ts:31` `const contexte = await exigerCapacite("modifier_planning");` ; `lib/auth/habilitations.ts:115` `modifier_planning: { complet: [ADMS, DIR, RM, RS, ADV] },` ; `docs/backlog.md:1710` « `absence_declaree_pour_soi` demeure — un technicien bloque son propre agenda ».
  - Effet pour l'utilisateur : le technicien doit passer par le bureau ; le texte et la base promettent un geste qui n'existe plus.
  - Correctif proposé : trancher (R3-14 le garde « jusqu'au jour où l'on dira qui a le droit de vider un agenda ») : soit rouvrir la pose pour soi (route acceptant le ○ restreint à soi), soit retirer la clause de R3-14 et le déclencheur mort.
  - Couverture : NOUVEAU.

- **TR-6** — **Un refus de droit s'affiche avec le texte de l'échec de connexion** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. Toutes les routes de `/absences` et du terrain renvoient `auth.refus` quand la capacité manque, à une personne déjà connectée.
  - Preuve : `app/api/absences/lever/route.ts:26-28` `if (contexte === null) { return versLesAbsences("auth.refus"); }` ; `lib/i18n/fr.ts:93-94` « Accès refusé. Vérifiez vos identifiants ; si le problème persiste… ».
  - Effet pour l'utilisateur : on lui dit de vérifier des identifiants qui sont justes.
  - Correctif proposé : une clé « Votre rôle ne permet pas ce geste. » pour les refus de capacité d'une session ouverte (D35 ne vise que l'authentification).
  - Couverture : NOUVEAU.

- **TR-7** — **Le calendrier titre la semaine par le mois du lundi** — Gravité : Mineur — Nature : Bug prouvé (vu en ligne)
  - Constat : semaine du 28/09 au 04/10 titrée « Septembre 2026 », colonnes « Jeu 1 … Dim 4 » sans mois.
  - Preuve : `app/(back-office)/absences/presentation.ts:77-81` « celui du PREMIER jour affiché » ; `page.tsx:251` `<Carte titre={libelleMoisAnnee(vue.semaine[0])}>`.
  - Effet pour l'utilisateur : on lit « jeudi 1er septembre ».
  - Correctif proposé : « Septembre – octobre 2026 » quand la semaine chevauche deux mois (même fonction pour le planning).
  - Couverture : NOUVEAU.

- **TR-8** — **Tuile « Demandes à valider — Sans objet »** — Gravité : Mineur — Nature : Écart à arbitrer (décision d'Alexis du 25/09)
  - Constat : vu en ligne, confirmé : tuile orange à valeur « Sans objet ». Alexis l'a GARDÉE le 25/09 à 12 h 15 (tri de l'audit du 25/09, décision 36 ; rappelé par `docs/audit-ergonomie-2026-09-26.md:265`).
  - Preuve : `app/(back-office)/absences/page.tsx:241-248` ; `lib/i18n/fr.ts:2673-2678`.
  - Effet pour l'utilisateur : un tiers de la rangée de chiffres ne dit rien.
  - Correctif proposé : reposer la question à Alexis avec PG-G15 (son texte « Le blocage est immédiat… » change de toute façon) : la remplacer par « Absents aujourd'hui » (valeur déjà calculée au tableau de bord), sans règle nouvelle.
  - Couverture : DÉJÀ ARBITRÉ (gardée le 25/09) — retrait = arbitrage.

- **TR-9** — **Liste « Personne » triée par identifiant technique, sans choix vide** — Gravité : Mineur — Nature : Bug déduit
  - Constat : DÉDUIT. Même défaut que celui corrigé par PG-A2 sur le planning ; le premier technicien (par UUID) est présélectionné.
  - Preuve : `lib/absences/ecran.ts:65-68` `tx.technicien.findMany({ where: { actif: true }, … orderBy: { utilisateur_id: "asc" } })` ; `page.tsx:345-359` (aucune option « — Choisir — »).
  - Effet pour l'utilisateur : ordre imprévisible, et risque de poser l'absence sur la mauvaise personne si l'on oublie de choisir.
  - Correctif proposé : trier par nom avec le comparateur de PG-A2 ; option vide obligatoire.
  - Couverture : NOUVEAU.

- **TR-10** — **Formulaire sans retour d'information** — Gravité : Mineur — Nature : Ergonomie
  - Constat : DÉDUIT. « Voir l'impact » avec dates vides ou inversées : rien ne s'affiche ; pose sans intervention rendue et levée : aucun message de succès ; la semaine du calendrier ne suit pas les dates de l'aperçu ; flèches « ‹ » « › » sans nom accessible.
  - Preuve : `presentation.ts:226-234` (saisie illisible → `null`, aucun motif) ; `app/api/absences/actions.ts:27-45` (retour sans motif) ; `page.tsx:256-273` (liens « ‹ »/« › », `hrefSemaine` sans `apercu`), `page.tsx:337` (le formulaire GET ne porte pas `semaine`).
  - Effet pour l'utilisateur : on ne sait pas si l'absence est posée ni pourquoi l'aperçu ne vient pas.
  - Correctif proposé : `required` + motif `absence.refus.saisie` sur l'aperçu ; message « Absence posée » / « Absence levée » ; `semaine` = lundi de `du` ; `aria-label` « Semaine précédente / suivante ».
  - Couverture : partiellement relevé par l'audit du 25/09 (constat 37, hors dépôt), jamais ticketé.

- **TR-11** — **Tableau de 3 colonnes imposé à 760 px, trié du plus lointain au plus ancien, sans état** — Gravité : Mineur — Nature : Ergonomie
  - Constat : DÉDUIT (défilement vu en ligne à 375 px). Aucune distinction « terminée / en cours / à venir ».
  - Preuve : `page.tsx:438` `<Tableau colonnes={COLONNES()} minimum="760px">` ; `lib/absences/ecran.ts:63` `orderBy: [{ du: "desc" }, …]`.
  - Effet pour l'utilisateur : défilement latéral sur téléphone pour trois colonnes ; les absences en cours sont au milieu.
  - Correctif proposé : minimum réduit ou cartes sous 768 px ; ordre « en cours, à venir (croissant), terminées » ; pastille d'état.
  - Couverture : NOUVEAU.

- **TR-12** — **Paragraphes de doctrine sous le formulaire** — Gravité : Mineur — Nature : Ergonomie
  - Constat : vu en ligne (« Le taux dit toujours le mieux qu'on sait… »).
  - Preuve : `lib/i18n/fr.ts:2626`, `2634`, `2636`, `2660`.
  - Effet pour l'utilisateur : lecture longue avant le geste.
  - Correctif proposé : une phrase par aide (passe éditoriale).
  - Couverture : DÉJÀ COUVERT (26/09 C7 — chantier, non ticketé ; `absences.sous_titre` déjà réécrit par GR16).

- **TR-13** — **Tuile « Rupture de service » rouge à 0** — Gravité : Mineur — Nature : Ergonomie
  - Constat : ton rouge fixe.
  - Preuve : `page.tsx:231` `ton="rouge"`.
  - Effet pour l'utilisateur : alerte visuelle sans objet.
  - Correctif proposé : rouge seulement si > 0.
  - Couverture : DÉJÀ COUVERT (26/09 C5 ⚠).

## /terrain

- **TR-14** — **La journée du technicien montre les annulées ; ouvrir une annulée jamais vue fait planter la fiche** — Gravité : Majeur — Nature : Bug déduit
  - Constat : DÉDUIT. `listerPlanning` garde les annulées par défaut, pour que `/terrain` et le tableau de bord « continuent de voir exactement ce qu'ils voyaient » (`lib/interventions/depot.ts:1580-1584`) ; celles sans date restent à vie dans « Affectées, sans date ». À l'ouverture, `marquerVuParTechnicien` réécrit la ligne sans regarder le statut ; le déclencheur refuse toute écriture sur une annulée → exception, écran d'erreur. La carte porte « Nouveau » + « Annulée » : c'est exactement celle qu'on ouvre.
  - Preuve : `app/(mobile)/terrain/page.tsx:111-115` (`listerPlanning` sans option) et `lib/interventions/depot.ts:1623` `...filtreStatutAnnulee(options?.inclureAnnulees ?? true),` ; `app/(mobile)/terrain/[id]/page.tsx:125` `await marquerVuParTechnicien(contexte, id);` ; `prisma/migrations/20260915060000_les_deux_temps_d120/migration.sql:157` `IF OLD."statut" = 'annulee' THEN RAISE EXCEPTION`.
  - Effet pour l'utilisateur : le technicien tape sur une intervention annulée avant qu'il l'ait vue et obtient « Une erreur est survenue » ; « Réessayer » replante.
  - Correctif proposé : `/terrain` : annulées masquées (ou seulement celles du jour, grisées) ; `marquerVuParTechnicien` n'écrit que sur un statut modifiable et ne fait jamais échouer la page.
  - Couverture : partiellement EN FILE (PG-G4, partie A4 : « l'ouverture de /terrain/[id] ne doit jamais échouer pour le vu ») — le constat du ticket ne cite que la planifiée sans durée ; y ajouter l'annulée.

- **TR-15** — **« Affectées, sans date » mêle des états différents et emploie le nom d'un statut inatteignable** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. La section reçoit tout ce qui est sans date et affecté au technicien : les « À planifier » rendues à la file par une absence (le technicien est gardé), les annulées, les en cours démarrées sans date (TR-19). « Affectée » est un statut de D8 qu'aucun chemin ne pose (bug 7 du 27/09).
  - Preuve : `lib/i18n/fr.ts:1827` `"terrain.sans_date": "Affectées, sans date",` ; `terrain/page.tsx:117-118` ; `lib/absences/depot.ts:220-230` (« LA DATE ET LE CRÉNEAU PARTENT, LE TECHNICIEN RESTE »).
  - Effet pour l'utilisateur : le technicien croit encore à sa charge une intervention que le bureau a remise dans la file.
  - Correctif proposé : libellé « Sans date » ; exclure les À planifier déplanifiées (ou les marquer « Déplanifiée », lien avec DEPLANIFIEE-1).
  - Couverture : NOUVEAU (DEPLANIFIEE-1 en file pour le marquage au planning).

- **TR-16** — **Rien ne signale sur la liste qu'un compteur tourne ; la carte ne dit ni priorité ni panne ; seule la journée du jour est visible** — Gravité : Mineur — Nature : Ergonomie
  - Constat : DÉDUIT. La page ne lit pas `compteurEnCours` ; la carte porte heure, statut, client, site, nature. D119 nomme le coût du compteur oublié (« une nuit entière facturera onze heures »).
  - Preuve : `terrain/page.tsx:104-118` (aucun appel au compteur) ; `terrain/page.tsx:196-235` (contenu de la carte).
  - Effet pour l'utilisateur : un compteur oublié ne se voit qu'en ouvrant la bonne fiche ; une P1 ressemble à une P3.
  - Correctif proposé : bandeau « Compteur en cours chez <client> depuis HH:MM — Mettre en pause » en tête ; pastille de priorité (GR5) ; section « Demain » (voir Évolutions).
  - Couverture : NOUVEAU.

- **TR-17** — **Les « Planifiée » sont visibles du terrain avant transmission** — Gravité : Mineur — Nature : Écart à arbitrer (QG-5)
  - Constat : état actuel contraire à la décision QG-5 du 27/09.
  - Preuve : `terrain/page.tsx:111-115` (aucun filtre de statut).
  - Effet pour l'utilisateur : le technicien voit la préparation du bureau.
  - Correctif proposé : celui de PG-G14.
  - Couverture : EN FILE (PG-G14, E1 — QG-5).

## /terrain/[id]

- **TR-18** — **Le compteur ne peut plus être arrêté si le bureau annule ou clôture l'intervention pendant qu'il tourne** — Gravité : Bloquant — Nature : Bug déduit
  - Constat : DÉDUIT. `arreterLeCompteur` ferme le segment puis réécrit `temps_mesure_min` sur l'intervention ; si elle est annulée (ou clôturée), le déclencheur lève, la transaction entière est annulée (segment compris) et la route, sans `catch`, rend une erreur 500. L'annulation (et la clôture) ne regarde pas les segments ouverts. Le compteur reste ouvert indéfiniment ; l'index « un compteur par personne » interdit alors de démarrer toute autre intervention.
  - Preuve : `lib/interventions/depot-compteur.ts:206` puis `:226-228` `await tx.intervention.update({ … data: { temps_mesure_min: mesurer(tous).minutes } })` ; `lib/interventions/depot.ts:1406-1411` (annulation sans lecture de `segment_travail`) ; `migration.sql:157-167` (refus sur `annulee`, et sur `cloturee` hors annulation) ; `app/api/terrain/[id]/compteur/route.ts:113-116` (aucun `try`).
  - Effet pour l'utilisateur : le technicien est bloqué (ni pause ni nouveau départ) ; son temps n'est jamais écrit ; seul un geste en base le débloque.
  - Correctif proposé : **Arrêt §8 (le temps mesuré est facturé, D119)** — options : (a) refuser nommément l'annulation/clôture tant qu'un compteur tourne ; (b) les accepter et fermer le segment dans la même transaction à l'instant de l'annulation. Dans les deux cas, la pause sur une intervention figée ferme le segment sans planter.
  - Couverture : NOUVEAU.

- **TR-19** — **« Démarrer l'intervention » est proposé quel que soit le statut : refusé sur annulée, clôturée et suspendue ; accepté sur « À planifier » contre la matrice D8** — Gravité : Majeur — Nature : Écart à arbitrer (D8, D120, D131)
  - Constat : DÉDUIT. Le bouton ne dépend que du compteur, jamais du statut. Suspendue : refus « reprenez-la », mais le terrain n'a aucun « Reprendre » (D131 donne pourtant suspendre/reprendre au technicien sur SES interventions — seulement sur la fiche du back-office). À planifier (cas réel : intervention déplanifiée par une absence, technicien gardé) : `peutDemarrerLeCompteur` laisse passer, la base ne tient pas la matrice, l'intervention passe EN_COURS sans date. D8 n'autorise pas A_PLANIFIER → EN_COURS ; D120 ne dit rien du statut de départ.
  - Preuve : `app/(mobile)/terrain/[id]/page.tsx:227-239` ; `lib/interventions/cycle-de-vie.ts:115-126` (seuls annulee, cloturee, suspendue refusés) ; `lib/interventions/depot-compteur.ts:159-164` `data: { statut: "en_cours" }` ; `docs/arbitrages.md:179` (ligne A_PLANIFIER : ni EN_COURS).
  - Effet pour l'utilisateur : actions refusées après un aller-retour réseau ; une intervention « à planifier » disparaît de la file du bureau sans date.
  - Correctif proposé : bouton conditionné par le même verdict que le serveur (refus affiché à la place de l'action) ; « Reprendre » sur le terrain pour une suspendue (D131) ; trancher A_PLANIFIER → EN_COURS (dépannage imprévu sur place ?) avec Alexis — Arrêt §8 (statuts).
  - Couverture : NOUVEAU.

- **TR-20** — **« Enregistrer le rapport » sur une intervention annulée ou clôturée rend une erreur 500** — Gravité : Majeur — Nature : Bug déduit
  - Constat : DÉDUIT. Le formulaire est affiché pour tout statut ; le dépôt écrit sur `intervention` ; le déclencheur refuse ; la route n'intercepte rien. Le docblock du dépôt dit « le déclencheur le refuse déjà, sans qu'il y ait rien à répéter ici » — le refus n'est jamais traduit.
  - Preuve : `app/api/terrain/[id]/rapport/route.ts:58` `const ecrite = await enregistrerRapportTexte(contexte, id, {` (sans `try`) ; `lib/interventions/depot-rapport-terrain.ts:21-26` (docblock) ; `migration.sql:157-167`.
  - Effet pour l'utilisateur : page d'erreur brute, commentaire perdu.
  - Correctif proposé : rapport en lecture seule sur annulée/clôturée (message « figée ») ; refus nommé côté dépôt (`intervention.refus.annulee_figee` / `cloturee_figee`).
  - Couverture : NOUVEAU.

- **TR-21** — **Aucun geste « Terminer » : TERMINÉE est inatteignable, et la clôture part d'EN_COURS sans les gardes de D8** — Gravité : Majeur — Nature : Écart à arbitrer (D8, arbitrage 3.17, RG-INT-02/03/04)
  - Constat : DÉDUIT. Le docblock le dit (« ce geste-là n'existe encore nulle part ») ; aucun code n'écrit `terminee`. D8 conserve RG-INT-02 sur → TERMINÉE et RG-INT-03/04 (rapport validé, signature) sur → CLÔTURÉE ; `peutCloturer` ne juge que le statut figé et le temps mesuré. Conséquence : l'onglet « À contrôler » du registre (= terminee) ne peut se remplir par aucun geste de l'application.
  - Preuve : `app/(mobile)/terrain/[id]/page.tsx:66-70` ; `git grep '"terminee"' -- lib app` : lectures seulement (`depot.ts:2890`, `:3123`) ; `lib/interventions/depot.ts:1294-1297` ; `docs/arbitrages.md:190` « Gardes conservées : RG-INT-02 … RG-INT-03 et RG-INT-04 ».
  - Effet pour l'utilisateur : le technicien ne peut pas dire « j'ai fini » ; le responsable clôture sans rapport validé ni signature.
  - Correctif proposé : bouton « Terminer » (EN_COURS → TERMINÉE, compteur fermé, RG-INT-02) ; clôture seulement depuis TERMINÉE — **Arrêt §8 (statuts, règles du ch. 10)**, à croiser avec le groupe Interventions (clôture).
  - Couverture : NOUVEAU.

- **TR-22** — **La fiche du technicien ne montre ni la panne signalée, ni le contact, ni l'heure, ni la priorité, ni la machine** — Gravité : Majeur — Nature : Ergonomie (écart au CDC §13.3, narratif)
  - Constat : DÉDUIT. Trois lignes seulement (site, nature, date) alors que la lecture rend `description` (panne), `contact`, le créneau et la priorité ; CDC §13.3 : « client, site, contact avec appel direct, itinéraire, machines, historique, checklist, démarrer / terminer ».
  - Preuve : `app/(mobile)/terrain/[id]/page.tsx:186-202` ; `lib/interventions/depot.ts:114` (`description`) et `:1809-1810` (`contact`) ; `docs/cahier-des-charges.md:1176`.
  - Effet pour l'utilisateur : le technicien part sans savoir ce qui est en panne, qui demander, ni à quelle heure (l'heure n'est que sur la liste).
  - Correctif proposé : ajouter panne signalée, créneau « 08:00–10:00 (2 h) » (formateur de PG-A5), priorité, contact (lien `tel:`), machine(s) et référence client — données déjà lues, aucune règle.
  - Couverture : NOUVEAU.

- **TR-23** — **Les routes du terrain écrivent sur n'importe quelle intervention de la société (aucun filtre par personne)** — Gravité : Majeur — Nature : Écart à arbitrer (R5-01, D131)
  - Constat : DÉDUIT. L'écran ne montre que les interventions du technicien, mais les dépôts d'écriture (compteur, rapport, prestations, photos, signature) lisent l'intervention par son seul `id`, sous la politique « société ». Un POST forgé démarre un compteur (et fait passer EN_COURS) ou écrit le rapport sur l'intervention d'un collègue. Le docblock de la route affirme que « la politique et le dépôt s'en chargent ».
  - Preuve : `lib/interventions/depot-compteur.ts:117-120` `tx.intervention.findFirst({ where: { id: interventionId }` ; `lib/interventions/depot-rapport-terrain.ts:86-89` (même forme) ; `app/api/terrain/[id]/compteur/route.ts:51-52` (docblock).
  - Effet pour l'utilisateur : aucun visible aujourd'hui ; une écriture sur la fiche d'autrui reste possible hors écran.
  - Correctif proposé : **Arrêt §8 (cloisonnement par personne)** — appliquer `restrictionParPersonne` dans ces dépôts, sauf si Alexis veut le « renfort » (plusieurs techniciens sur une intervention, que `mesureDeLIntervention` évoque) : alors l'écrire comme règle.
  - Couverture : NOUVEAU.

- **TR-24** — **Textes qui ne disent pas ce qui se passe** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. (1) Succès silencieux : « Rapport enregistré. », « Prestations enregistrées. », « Signature enregistrée. » existent mais aucune route ne les renvoie. (2) « Le compteur tourne. » sans heure de départ, alors que le docblock promet « annoncé à part, avec son heure de départ ». (3) « Démarrer l'intervention » pour reprendre après une pause. (4) `compteur.refus.fin_avant_debut` dit « Vérifiez l'heure de l'appareil » alors que l'instant vient du serveur.
  - Preuve : `lib/i18n/fr.ts:1857`, `1864`, `1881` (aucun appelant : `git grep`) ; `page.tsx:221-225` vs `page.tsx:72-77` ; `lib/i18n/fr.ts:1894` vs `compteur/route.ts:100-107`.
  - Effet pour l'utilisateur : sur un réseau faible, on ne sait pas si c'est enregistré ; un compteur oublié ne se repère pas.
  - Correctif proposé : renvoyer la clé de succès ; « Le compteur tourne depuis HH:MM » ; « Reprendre le compteur » quand l'intervention est déjà en cours ; motif sans « appareil ».
  - Couverture : NOUVEAU.

- **TR-25** — **Cibles et saisies peu adaptées au terrain** — Gravité : Mineur — Nature : Ergonomie (CDC §13.4, narratif)
  - Constat : DÉDUIT. Boutons de 36 et 32 px (CDC : 44 px « avec des gants ») ; `capture="environment"` interdit de choisir une photo existante sur certains téléphones ; légende de photo sans libellé (clé « Légende » inutilisée) ; onglet du navigateur « Ma journée » sur la fiche.
  - Preuve : `components/ui/button.tsx:24-25` (`h-9`, `h-8`) ; `terrain/[id]/page.tsx:360-373` ; `lib/i18n/fr.ts:1870` ; `terrain/[id]/page.tsx:34`.
  - Effet pour l'utilisateur : ratés au doigt, photo déjà prise impossible à joindre.
  - Correctif proposé : taille 44 px sur le segment `(mobile)` ; retirer `capture` (le choix caméra/galerie reste) ; `<label>` « Légende » ; titre d'onglet = client.
  - Couverture : NOUVEAU (CG8 n'a traité que les cases du paramétrage).

- **TR-26** — **Ouvrir une « Planifiée » héritée sans durée plante (écriture du « vu »)** — Gravité : Majeur — Nature : Bug déduit
  - Constat : bug 4 de l'audit du 27/09, toujours présent à `bcc637e`.
  - Preuve : `terrain/[id]/page.tsx:125`.
  - Effet pour l'utilisateur : fiche inaccessible.
  - Correctif proposé : celui de PG-A4.
  - Couverture : EN FILE (PG-G4, partie A4).

## /portail (compte bureau)

- **TR-27** — **Entrée masquée : confirmé ; l'écran atteint par URL enferme l'utilisateur dans la coque du portail** — Gravité : Mineur — Nature : Ergonomie
  - Constat : vu en ligne (« Cet écran est réservé aux comptes de portail client ») ; DÉDUIT pour la suite : la mise en page du segment rend la barre du portail (une entrée « Votre parc », marque → `/portail`) et aucun lien vers le planning ; titre « Votre parc » pour un interne.
  - Preuve : `app/(portail)/portail/page.tsx:66-78` ; `app/(portail)/layout.tsx:47-52` ; masquage : `lib/navigation/entrees.ts:527` + `lib/auth/habilitations.ts:153` (`consulter_parc_propre` : client seul).
  - Effet pour l'utilisateur : un lien ou un favori ancien mène à une impasse (et l'application installée n'a pas de bouton retour).
  - Correctif proposé : pour un rôle interne, redirection vers `/planning` ou lien « Retourner au planning ».
  - Couverture : NOUVEAU (le masquage, lui, est D132).

- **TR-28** — **Nom de société en dur dans les textes du portail** — Gravité : Mineur — Nature : Incohérence
  - Constat : voir TR-53 (« Ce que CODIMA suit pour vous », « interlocuteur CODIMA »). Portail hors V1.
  - Preuve : `lib/i18n/fr.ts:134`, `:160`.
  - Effet pour l'utilisateur : faux pour toute autre société cliente.
  - Correctif proposé : nom de la société active (`theme.nom`).
  - Couverture : NOUVEAU.

## /arrivee

- **TR-29** — **La redirection directe (une seule société) supprime le seul écran « qui suis-je » ; changer de société exige de taper l'URL ; le refus de bascule est muet** — Gravité : Mineur — Nature : Ergonomie
  - Constat : vu en ligne (→ `/planning`), voulu par 99A-ARRIVEE. DÉDUIT : plus aucun écran ne montre rôle, courriel et société active (utile pour comprendre TR-44) ; aucun lien de l'application ne mène à `/arrivee` (la pastille de société est un `div`) ; la page ignore `?motif=` alors que la route de bascule y renvoie ses refus.
  - Preuve : `app/(back-office)/arrivee/page.tsx:96-109` et `decision.ts:43` ; `page.tsx:68` `export default async function PageArrivee() {` (aucun `searchParams`) ; `app/api/session/societe/route.ts:52` `redirectionAvecMotif("/arrivee", "auth.refus")` ; `components/theme/bandeau-societe.tsx:57` (élément non cliquable).
  - Effet pour l'utilisateur : un compte multi-société ne trouve pas où changer de société ; un refus de bascule ne s'affiche pas.
  - Correctif proposé : pastille de société et initiales cliquables vers une page « Mon compte » (voir Évolutions) ; afficher le motif sur `/arrivee`.
  - Couverture : NOUVEAU (M2 de l'audit « captures » 26/09 : affordance de la pastille).

- **TR-30** — **Sans société active, la barre ne montre que « Demandes », qui renvoie à `/arrivee` ; un compte portail y lit les domaines du back-office** — Gravité : Mineur — Nature : Bug déduit / Écart à arbitrer (D97, D133)
  - Constat : DÉDUIT. Rôle `null` : toutes les entrées à capacité tombent, sauf « Demandes » (sans capacité, D133) ; `/demandes` renvoie à `/arrivee`. Pour un compte `client` sur `/arrivee` (plusieurs sociétés) : « Exploitation › Demandes » et « Clients & parc › Portail client » s'affichent dans la barre du back-office, ce que D97 interdit.
  - Preuve : `lib/navigation/entrees.ts:557-561` ; `app/(back-office)/demandes/page.tsx:80-82` ; `docs/arbitrages.md` D97 (« Le portail a SA barre, jamais celle du back-office »).
  - Effet pour l'utilisateur : une entrée qui boucle ; hors V1 pour le portail.
  - Correctif proposé : « Demandes » exige `consulter_planning` ou `creer_demande` (D133 à amender) ; `/arrivee` sans barre pour un rôle `null` ou `client`.
  - Couverture : NOUVEAU.

## /

- **Aucun défaut propre.** La racine redirige vers `/connexion` ou `/arrivee` (`app/(sans-session)/page.tsx:19-25`). Voir TR-31 pour la conduite en panne de base et TR-38 pour la boucle d'enrôlement qui y passe.

## /connexion

- **TR-31** — **Base injoignable → « Vérifiez vos identifiants »** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. Toute exception de `signInEmail` est rendue comme un refus d'identifiants.
  - Preuve : `lib/auth/connexion.ts:129-134` `} catch { … return refus(); }` ; `lib/i18n/fr.ts:93-94`.
  - Effet pour l'utilisateur : en panne, chacun croit s'être trompé de mot de passe et réessaie (verrouillage possible).
  - Correctif proposé : distinguer l'indisponibilité (message « Service momentanément indisponible ») sans rien révéler du compte (D35 n'est pas en cause).
  - Couverture : NOUVEAU (coût nommé en R2-16 pour la page, pas pour la route).

- **TR-32** — **Aucune issue pour un mot de passe oublié** — Gravité : Majeur — Nature : Écart à arbitrer (D35, D58, D65)
  - Constat : DÉDUIT. La réinitialisation est désactivée en production par construction ; la réémission du lien de premier accès est « FERMÉE pour toujours » dès qu'un mot de passe existe et renvoie au « chemin ordinaire », qui n'existe pas ; le message d'échec renvoie à l'administrateur de société, qui n'a aucun écran pour agir.
  - Preuve : `lib/auth/config.ts:210-213` (« Il n'y a donc aucune émission de jeton en libre-service ») ; `lib/auth/amorcage.ts:472-477` « Un mot de passe oublié se traite par le chemin ordinaire » ; `lib/i18n/fr.ts:93-94`.
  - Effet pour l'utilisateur : un salarié qui oublie son mot de passe ne peut plus entrer, et personne dans l'application ne peut le débloquer.
  - Correctif proposé : **Arrêt §8 (accès, données personnelles)** — options : (a) réémission par l'`admin_societe` depuis l'Équipe (geste journalisé, D58 : accès délivré) ; (b) « Mot de passe oublié » en libre-service (réponse indiscernable, D35). À trancher.
  - Couverture : NOUVEAU (aucun ticket au lot 7).

- **TR-33** — **Autocomplétion mal renseignée** — Gravité : Mineur — Nature : Ergonomie
  - Constat : DÉDUIT. Courriel `autocomplete="on"`, tous les mots de passe `current-password` (y compris « Nouveau mot de passe »), code à 6 chiffres sans `inputmode="numeric"` ni `one-time-code`.
  - Preuve : `components/session/formulaire.tsx:67` `autoComplete={type === "password" ? "current-password" : "on"}`.
  - Effet pour l'utilisateur : clavier alphabétique pour un code, gestionnaire de mots de passe mal guidé.
  - Correctif proposé : propriété `autocomplete` par champ (`username`, `new-password`, `one-time-code`) et `inputMode="numeric"`.
  - Couverture : NOUVEAU.

## /connexion/code

- **TR-34** — **Les codes de secours remis à l'enrôlement ne peuvent être saisis nulle part** — Gravité : Majeur — Nature : Bug déduit / Incohérence
  - Constat : DÉDUIT. Le seul formulaire de code n'accepte que six chiffres et n'appelle que `verifyTOTP` ; l'enrôlement dit « Chacun ne sert qu'une fois, si vous perdez votre application », et un autre texte dit « Téléphone perdu : prévenez l'administrateur ».
  - Preuve : `app/api/session/code/route.ts:27` `auth().api.verifyTOTP({` ; `app/(sans-session)/connexion/code/page.tsx:41` `motif="[0-9]{6}"` ; `lib/i18n/fr.ts:236-237` vs `:227-228`.
  - Effet pour l'utilisateur : un administrateur qui perd son téléphone reste dehors avec ses codes en main (il faut L7-01, non construit).
  - Correctif proposé : lien « Utiliser un code de secours » → champ libre → vérification du code de secours par le greffon `twoFactor` (point d'entrée non fermé par `CHEMINS_FERMES` ; nom exact À VÉRIFIER, bibliothèque absente du clone) ; ou retirer les codes et le texte. Arrêt §8 (second facteur, D59).
  - Couverture : NOUVEAU.

- **TR-35** — **Titre = libellé du champ ; aucun retour à la connexion** — Gravité : Mineur — Nature : Ergonomie
  - Constat : DÉDUIT. h1 et libellé : « Code à six chiffres » ; pas de lien « Revenir / changer de compte ».
  - Preuve : `connexion/code/page.tsx:32` et `:40`.
  - Effet pour l'utilisateur : impasse si l'on s'est trompé de compte (bouton retour absent en application installée).
  - Correctif proposé : h1 « Vérification en deux étapes » ; lien « ← Revenir à la connexion ».
  - Couverture : NOUVEAU.

## /enrolement

- **TR-36** — **Clé secrète, URI `otpauth://` et codes de secours passent dans l'URL** — Gravité : Majeur — Nature : Écart à arbitrer (D59)
  - Constat : DÉDUIT. La préparation redirige vers `/enrolement?cle=…&uri=…&secours=…` ; l'URI `otpauth://` (clé + identifiant du compte, format standard — libellé exact À VÉRIFIER) n'est même pas lue par la page. Tout reste dans l'historique du navigateur (poste partagé) et, selon l'hébergeur, dans les journaux d'accès (À VÉRIFIER côté Vercel).
  - Preuve : `app/api/session/enrolement/route.ts:37-42` `new URLSearchParams({ cle: …, uri: …, secours: … })` ; `lib/auth/enrolement.ts:280-287` (seuls `cle`, `secours`, `motif` sont relus).
  - Effet pour l'utilisateur : quiconque ouvre l'historique récupère de quoi produire ses codes.
  - Correctif proposé : **Arrêt §8** — rendre la page de la clé directement dans la réponse au POST (sans redirection) ou via un témoin chiffré à usage unique ; ne jamais transmettre `uri`.
  - Couverture : NOUVEAU (choix documenté dans la route, jamais arbitré).

- **TR-37** — **Pas de QR code alors que l'URI est calculée et que le dépôt sait rendre un QR** — Gravité : Majeur — Nature : Ergonomie
  - Constat : DÉDUIT. Seule la clé en toutes lettres s'affiche ; le type la décrit comme « à présenter en QR code » ; `components/ui/qr-code.tsx` rend un SVG serveur sans dépendance.
  - Preuve : `app/(sans-session)/enrolement/page.tsx:85` `<code …>{cle}</code>` ; `lib/auth/enrolement.ts:74` « URI `otpauth://` à présenter en QR code ».
  - Effet pour l'utilisateur : 32 caractères à recopier sur téléphone ; une faute ramène à l'étape 1 (TR-39).
  - Correctif proposé : QR de l'URI (rendu dans la réponse, cf. TR-36) + clé en repli.
  - Couverture : NOUVEAU.

- **TR-38** — **Piège : pas de déconnexion, et `/connexion` renvoie vers l'enrôlement du compte ouvert** — Gravité : Majeur — Nature : Bug déduit
  - Constat : DÉDUIT. Le segment sans session n'a aucun chrome (pas de « Se déconnecter ») ; `/connexion`, `/` et `/arrivee` renvoient à `/enrolement` tant que la session demande l'enrôlement.
  - Preuve : `app/(sans-session)/connexion/page.tsx:31-33` `if (etat.issue === "enrolement_requis") { redirect("/enrolement"); }` ; `app/(sans-session)/layout.tsx:28-42` (aucune barre).
  - Effet pour l'utilisateur : sur un poste partagé, personne d'autre ne peut se connecter tant que les témoins ne sont pas effacés.
  - Correctif proposé : bouton « Se déconnecter » (POST `/api/session/deconnexion`) sur `/enrolement`.
  - Couverture : NOUVEAU.

- **TR-39** — **Un code faux fait revenir à l'étape du mot de passe** — Gravité : Mineur — Nature : Ergonomie
  - Constat : DÉDUIT : le refus redirige sans la clé ; **À VÉRIFIER** (bibliothèque absente du clone) si la nouvelle préparation génère une autre clé, rendant caduque l'entrée déjà ajoutée dans l'application d'authentification.
  - Preuve : `app/api/session/enrolement/route.ts:52` `return redirectionAvecMotif("/enrolement", "enrolement.code_invalide");`.
  - Effet pour l'utilisateur : ressaisie du mot de passe, peut-être deux entrées dans l'application d'authentification.
  - Correctif proposé : réafficher la même clé après un code faux (lié à TR-36).
  - Couverture : NOUVEAU.

## /premier-acces

- **TR-40** — **Un technicien créé depuis l'Équipe n'a aucun moyen d'obtenir un accès** — Gravité : Bloquant — Nature : Bug déduit (À VÉRIFIER en recette)
  - Constat : DÉDUIT. Créer un technicien crée l'identité « pas son accès » (aucun `compte`) ; le seul émetteur de lien (script d'amorçage `--reemettre`) refuse une identité sans `compte` ; l'application n'émet aucun lien. Le texte « Demandez-en un nouveau à la personne qui vous l'a transmis » renvoie à une personne qui ne peut rien.
  - Preuve : `lib/techniciens/depot.ts:76-79` « Créer un technicien crée son identité, pas son accès » ; `lib/auth/amorcage.ts:462-471` (refus « ne porte aucun moyen de connexion ») ; `git grep envoyerLienPremierAcces` : seul `scripts/amorcage-premier-compte.mts`.
  - Effet pour l'utilisateur : l'application technicien est inaccessible à tout nouveau technicien (le terrain n'a d'ailleurs jamais pu être audité faute de compte technicien).
  - Correctif proposé : « Envoyer le lien de premier accès » depuis l'Équipe (admin_societe, journalisé, D58 : accès délivré) — à coordonner avec le groupe Paramètres ; Arrêt §8 (accès).
  - Couverture : lié au lot « terrain (compte technicien de test) » (Plus tard) ; l'impasse elle-même n'est écrite nulle part.

- **TR-41** — **Textes et champs du premier accès** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. « Enregistrer et se connecter » ne connecte pas (retour à la connexion) ; la longueur minimale n'est annoncée qu'après refus ; accroche confuse (« il ne peut plus être réémis par ce chemin ») ; lien incomplet : un formulaire POST vers `/connexion` avec « Se connecter » au lieu d'un lien (comportement du POST sur une page À VÉRIFIER).
  - Preuve : `lib/i18n/fr.ts:211` ; `app/api/session/premier-acces/route.ts:29` `redirectionAvecMotif("/connexion", "premier_acces.abouti")` ; `lib/i18n/fr.ts:207-208`, `:218-219` ; `app/(sans-session)/premier-acces/page.tsx:55`.
  - Effet pour l'utilisateur : surprise d'avoir à se reconnecter, essais inutiles.
  - Correctif proposé : « Enregistrer le mot de passe » ; aide « au moins huit caractères » sous le champ (valeur déjà codée) ; lien simple vers `/connexion`.
  - Couverture : NOUVEAU (C7 pour la prose).

## /sante

- **TR-42** — **Deux lignes toujours « non lisible », et des textes affichés écrits hors du dictionnaire** — Gravité : Mineur — Nature : Incohérence (CLAUDE.md §5)
  - Constat : DÉDUIT. Les décomptes sont `decompteNonLisible()` par construction ; leur motif et les détails de migration sont des chaînes françaises de `lib/db/sante.ts` rendues à l'écran (le gardien ne les voit pas : pas de JSX).
  - Preuve : `lib/db/sante.ts:307-308` `const societes = decompteNonLisible();` ; `lib/db/sante.ts:374-381`, `:67-71`, `:83-88` ; `app/(sans-session)/sante/page.tsx:70-71`.
  - Effet pour l'utilisateur : deux lignes sans information et un long paragraphe à chaque visite.
  - Correctif proposé : retirer les deux lignes ; clés `sante.*` pour les détails (la route machine garde ses codes).
  - Couverture : NOUVEAU (GR17 a retiré le seul décompte « quatre questions »).

- **TR-43** — **Le détail d'une migration s'affiche deux fois, avec un préfixe faux en cas d'échec** — Gravité : Mineur — Nature : Bug déduit
  - Constat : DÉDUIT. Note « Migration non appliquée : <détail> » puis le même détail en rouge ; pour une migration en échec, le préfixe dit « non appliquée ».
  - Preuve : `sante/page.tsx:61-68` et `:97-99`.
  - Effet pour l'utilisateur : lecture confuse au moment d'une panne.
  - Correctif proposé : une seule ligne de détail.
  - Couverture : NOUVEAU.

## Navigation — la barre (lib/navigation/entrees.ts, components/navigation/**, layouts)

- **TR-44** — **« App technicien » est visible pour admin_societe, responsable matériel et responsable SAV, et les renvoie au planning** — Gravité : Majeur — Nature : Écart à arbitrer (D132)
  - Constat : vu en ligne, établi par le code. **Qui voit l'entrée** : les rôles ayant `saisir_rapport` (ADMS, RM, RS, TEC). **Qui peut ouvrir `/terrain`** : les seuls rôles au périmètre « restreint » sur `consulter_planning` (TEC) ; « complet » (ADMS, DIR, RM, RS, ADV) → `/planning` ; « aucun » → `/arrivee`. Intersection : le technicien seul. **Un admin sans profil technicien** : la garde lit le rôle, jamais un profil ; et un admin ne peut pas en avoir sur sa société (`deja_membre`) : il est toujours renvoyé au planning ; les routes du compteur le refusent aussi. D132 décrit ce symptôme comme ce qu'elle supprime, puis garde l'entrée à l'admin « (il a saisir_rapport) » : deux lectures d'un même critère (capacité dans la barre, périmètre dans la route). Une épreuve e2e fige le renvoi. Le classement « CG5 périmé (D132 tient, App technicien déjà vivante) » est donc **réfuté** : vivante pour le seul technicien.
  - Preuve : `lib/navigation/entrees.ts:530` `"nav.app_technicien": "saisir_rapport",` ; `lib/auth/habilitations.ts:114` et `:118` ; `app/(mobile)/terrain/page.tsx:92-99` `if (perimetre.acces === "complet") { redirect("/planning"); }` ; `docs/arbitrages.md:4843`, `:4851`, `:4855` ; `tests/e2e/navigation-app-technicien.spec.ts:71-79` ; `lib/techniciens/depot.ts:116`.
  - Effet pour l'utilisateur : clic sans effet apparent pour trois rôles, sans explication ; la capacité `saisir_rapport` de ces rôles n'est utilisable nulle part.
  - Correctif proposé : ÉCART À ARBITRER (D132) — (a) l'entrée suit le critère de la route (`perimetreParPersonne(…).acces === "restreint"`, une seule lecture) ; (b) garder l'entrée et remplacer la redirection muette par une page qui explique (clause de réouverture « prévisualiser » de D132) ; (c) question de fond : un responsable SAV qui intervient lui-même doit-il pouvoir tenir un compteur ? Amender l'épreuve e2e avec la décision, jamais avant.
  - Couverture : NOUVEAU (CG5 classé périmé à tort).

- **TR-45** — **Docblocks périmés depuis D132 et branche « inerte » devenue morte** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. La mise en page du back-office et la barre écrivent « une entrée n'est jamais masquée pour cause de droit » / « une entrée inerte reste rendue » ; `entreesAffichables` retire désormais les deux. Le rendu inerte (`nav.a_venir`) n'est plus jamais atteint. Le hub des paramètres dit encore « la barre est close à onze entrées ».
  - Preuve : `app/(back-office)/layout.tsx:20-24` ; `components/navigation/barre.tsx:52-57` et `:371-385` ; `lib/navigation/portes-parametrage.ts:88`.
  - Effet pour l'utilisateur : aucun direct ; un futur ticket se fiera à une règle fausse.
  - Correctif proposé : réécrire les trois commentaires ; supprimer la branche morte ou la garder avec un gardien qui dit pourquoi.
  - Couverture : NOUVEAU (distinct de CG7, classé sans ticket, qui visait d'autres docblocks, ceux du planning).

- **TR-46** — **« Sociétés & tarifs » : libellé trop étroit et portes en double vers Clients et Sites** — Gravité : Mineur — Nature : Écart à arbitrer (D121)
  - Constat : vu en ligne. Le hub porte 11 réglages (dont équipe, habilitations, matériel) et deux portes vers `/clients` et `/sites`, qui ont leur propre entrée depuis D121 : cliquer une porte fait sauter la section allumée de « Sociétés & tarifs » à « Clients » ou « Sites ».
  - Preuve : `lib/navigation/portes-parametrage.ts:75` et `:91` ; `lib/navigation/entrees.ts:339-341` ; `docs/arbitrages.md:4283` (libellé lettre pour lettre de la maquette).
  - Effet pour l'utilisateur : on cherche l'équipe sous « tarifs » ; on se perd entre deux chemins.
  - Correctif proposé : retirer les portes Clients/Sites du hub (sans arbitrage) ; renommer l'entrée « Réglages » = écart à la maquette → arbitrage D121.
  - Couverture : NOUVEAU (R4-04 posait déjà la question « Paramètres remplace-t-il Sociétés & tarifs »).

- **TR-47** — **Bouton du menu sur téléphone à 36 px** — Gravité : Mineur — Nature : Ergonomie
  - Constat : DÉDUIT.
  - Preuve : `components/navigation/bandeau-mobile.tsx:152` `h-9 w-9`.
  - Effet pour l'utilisateur : cible sous 44 px.
  - Correctif proposé : `h-11 w-11`.
  - Couverture : NOUVEAU.

## Navigation — fils d'Ariane, liens de retour et titres de toutes les pages

**Inventaire (compte bureau, barre filtrée par rôle ; « section » = entrée allumée par préfixe du chemin, `entreeActive`)**

| Route | Section allumée | Surtitre | Fil d'Ariane | Lien de retour (libellé → cible) | h1 |
|---|---|---|---|---|---|
| /tableau-de-bord | Tableau de bord | Exploitation | non | — | « Tableau de bord » |
| /planning | Planning | Exploitation | non | — | « Planning des interventions » |
| /demandes | Demandes | Exploitation | non | — | « Demandes » |
| /demandes/[id] | Demandes | Exploitation | non | « ← Toutes les demandes » → /demandes | « Demande — client » + statut (nommé) |
| /interventions | Interventions | Exploitation | non | — | « Interventions » |
| /interventions/nouvelle | Interventions | Exploitation | non | « ← Retour au planning » → /planning, toujours | « Créer une intervention » |
| /interventions/[id] | Interventions | Exploitation | non | selon `depuis` : planning (défaut, y compris depuis le tableau de bord), registre filtré, client, site, machine, demande, blocages d'agenda | « Intervention Local-… » + statut (numéro, pas le client) |
| /interventions/[id]/bon | Interventions | aucun (pas de `Page`) | non | « ← Fiche Local-… » → fiche, en haut à gauche, couleur de marque | nom de la SOCIÉTÉ |
| /absences | Absences | Exploitation | non | — | « Blocages d'agenda » (menu : « Absences ») |
| /arrivee | aucune | aucun | non | — | « Vous êtes connecté » |
| /clients | Clients | Clients & parc | non | — | « Clients » |
| /clients/nouveau | Clients | Clients & parc | non | « ← Tous les clients » → /clients | « Nouveau client » |
| /clients/[id] | Clients | Clients & parc | **oui** (Clients › client) | « ← Tous les clients » (doublon du fil) | raison sociale |
| /sites | Sites | Clients & parc | non | — | « Sites » |
| /sites/nouveau | Sites | Clients & parc | non | « ← Tous les sites » → /sites, même ouvert depuis une fiche client | « Nouveau site » |
| /sites/[id] | Sites | Clients & parc | **oui** (Clients › client › site) + client en sous-titre | « ← Tous les sites » → /sites | libellé du site |
| /parc | Parc machines | Clients & parc | non | — | « Parc machines » |
| /parc/nouvelle | Parc machines | Clients & parc | non | « ← Retour au parc » → /parc, même depuis une fiche site | « Nouvelle machine » |
| /parc/[id] | Parc machines | Clients & parc | non | « ← Retour au parc » → /parc (filtres gardés seulement depuis /parc) | « Fiche machine » (générique ⚠ maquette) |
| /parc/[id]/modifier | Parc machines | Clients & parc | non | « ← Retour à la fiche » → /parc/[id] | « Corriger la fiche » |
| /vgp | VGP | Clients & parc | non | — (retiré par GR17) | « Registre des vérifications périodiques » |
| /vgp/a-determiner | VGP | Clients & parc | non | « ← Retour au registre » → /vgp | « Familles à déterminer » |
| /vgp/enregistrer/[id] | VGP | Clients & parc | non | « ← Retour au registre » → /vgp, même depuis la fiche machine ; après enregistrement → /vgp | « Enregistrer une vérification » |
| /imports | Imports Excel | Paramètres | non | — | « Imports Excel » |
| /imports/[id] | Imports Excel | Paramètres (lot introuvable : aucun, **sans h1**) | non | « ← Retour aux imports » → /imports | « Rapport de contrôle » (fichier en sous-titre) |
| /parametres | Sociétés & tarifs | Paramètres | non | — | « Sociétés & tarifs » |
| /parametres/agences | Sociétés & tarifs | Paramètres | non | « ← Sociétés & tarifs » → /parametres | « Réglage des horaires d'ouverture » (porte du hub : « Horaires d'ouverture ») |
| /parametres/agences/nouvelle | Sociétés & tarifs | Paramètres | non | « ← Tous les établissements » | « Nouvel établissement » |
| /parametres/agences/[id] | Sociétés & tarifs | Paramètres | non | « Revenir aux établissements » (sans ←, lien bleu) | « Horaires d'ouverture — <agence> » |
| /parametres/agences/[id]/modifier | Sociétés & tarifs | Paramètres | non | « ← Tous les établissements » (pas vers la fiche) | « Modifier un établissement » (sans nom) |
| /parametres/forfaits/[id] | Sociétés & tarifs | Paramètres | non | « ← Retour au catalogue » → /parametres/forfaits (« Forfaits applicables ») | libellé du forfait |
| /parametres/equipe, forfaits, habilitations, materiel, prestations, societe, taux-horaire, trajets | Sociétés & tarifs | Paramètres | non | « ← Sociétés & tarifs » → /parametres | titre de la section |
| /terrain | pas de barre | — | non | — (marque → /terrain) | « Ma journée » |
| /terrain/[id] | pas de barre | — | non | « ← Retour à ma journée », en haut à gauche | client (onglet : « Ma journée ») |
| /portail | « Votre parc » (barre du portail) | aucun | non | — | « Votre parc » |
| /connexion, /connexion/code, /enrolement, /premier-acces | pas de barre | — | non | marque → / | titre du formulaire ; /connexion/code : h1 = libellé du champ |
| /sante | pas de barre | — | non | aucun lien, aucune marque | « État de l'installation » |

- **TR-48** — **Deux fils d'Ariane seulement, chacun doublé d'un lien de retour ; la fiche site part de « Clients » quand le menu allume « Sites »** — Gravité : Mineur — Nature : Ergonomie
  - Constat : vu en ligne, confirmé. La fiche site nomme le client trois fois (fil, sous-titre, retour vers une autre liste).
  - Preuve : `app/(back-office)/clients/[id]/page.tsx:321-324` et `:344-346` ; `app/(back-office)/sites/[id]/page.tsx:264-275`, `:276-280`, `:295-297`.
  - Effet pour l'utilisateur : deux chemins de retour qui ne vont pas au même endroit.
  - Correctif proposé : un seul modèle (fil sur toutes les fiches, retour supprimé là où le fil existe).
  - Couverture : DÉJÀ COUVERT (26/09 M4 et C6 ⚠, 27/09 I-13) — toujours vrai.

- **TR-49** — **Des retours qui ne ramènent pas d'où l'on vient** — Gravité : Mineur — Nature : Ergonomie
  - Constat : vu en ligne pour la création ; DÉDUIT pour le reste. Création d'intervention → planning ; fiche intervention ouverte depuis le tableau de bord → planning (le tableau ne passe pas `depuis`) ; fiche machine ouverte depuis un site, un client, une intervention ou le registre VGP → parc ; vérification VGP lancée depuis la fiche machine → registre, et l'enregistrement redirige vers `/vgp` ; nouveau site depuis une fiche client → liste des sites ; nouvelle machine depuis une fiche site → parc.
  - Preuve : `app/(back-office)/interventions/nouvelle/page.tsx:247-249` ; `tableau-de-bord/presentation.ts:313`, `:340`, `:374` (sans `depuis`) et `interventions/presentation.ts:259-262` (défaut planning) ; `parc/[id]/page.tsx:231-236` et liens `vgp/page.tsx:460`, `sites/[id]/page.tsx:637`, `clients/[id]/page.tsx:585`, `interventions/[id]/page.tsx:1730` ; `parc/[id]/page.tsx:625` → `vgp/enregistrer/[id]/page.tsx:71-74` et `app/api/vgp/enregistrer/[id]/route.ts:65` ; `sites/nouveau/page.tsx:89-91` ; `parc/nouvelle/page.tsx:88-90`.
  - Effet pour l'utilisateur : on perd la liste ou la fiche de départ ; le menu allume une autre section que celle d'où l'on vient.
  - Correctif proposé : étendre `depuis` (déjà en place pour la fiche intervention, `retourFiche`) aux fiches machine et VGP, au tableau de bord et aux trois formulaires de création.
  - Couverture : DÉJÀ COUVERT pour la création d'intervention (26/09 M4) ; NOUVEAU pour les autres cas.

- **TR-50** — **Libellés de retour faux ou hors modèle** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. « ← Retour au catalogue » mène à « Forfaits applicables » (« Catalogue » est le titre des prestations) ; « Revenir aux établissements » sans flèche, en lien bleu, vers une page titrée « Réglage des horaires d'ouverture » ; « Modifier un établissement » ne nomme pas l'agence et revient à la liste, pas à sa fiche ; clé morte `planning.retour`.
  - Preuve : `lib/i18n/fr.ts:1960`, `:1995`, `:2703` ; `app/(back-office)/parametres/agences/[id]/page.tsx:144-146` et `fr.ts:2506`, `:2057` ; `parametres/agences/[id]/modifier/page.tsx:70-80` ; `fr.ts:989`.
  - Effet pour l'utilisateur : on ne reconnaît pas la page annoncée.
  - Correctif proposé : « ← Forfaits applicables », « ← Horaires d'ouverture » (même glyphe, même style gris), titre « Modifier — <agence> » avec retour vers sa fiche ; supprimer `planning.retour`.
  - Couverture : NOUVEAU (CG2 a laissé `calendrier.retour` « hors objet »).

- **TR-51** — **Titres qui ne disent pas quelle fiche est ouverte** — Gravité : Mineur — Nature : Ergonomie
  - Constat : vu en ligne pour la fiche machine ; DÉDUIT pour le reste. « Intervention Local-… » sans le client ; « Rapport de contrôle » ; bon titré du nom de la société (pas de l'intervention) ; lot d'import introuvable sans aucun h1 (le bandeau téléphone reste vide).
  - Preuve : `interventions/[id]/page.tsx:502-512` ; `imports/[id]/page.tsx:199-201` et `:111-120` ; `interventions/[id]/bon/page.tsx:156-158`.
  - Effet pour l'utilisateur : l'onglet et le bandeau téléphone ne distinguent pas deux fiches.
  - Correctif proposé : « Intervention — client » (comme « Demande — client ») ; « Import — <fichier> » ; h1 sur la page d'erreur du lot.
  - Couverture : partiellement DÉJÀ COUVERT (26/09 M5 : demande faite par GR17 ; « Fiche machine » ⚠ maquette).

## Vocabulaire — lib/i18n/fr.ts

- **TR-52** — **Le gardien du vocabulaire imposé est contourné par des synonymes : 30 « établissement », 42 « lieu(x) »** — Gravité : Majeur — Nature : Écart à arbitrer (CLAUDE.md §3, D5, D47)
  - Constat : vu en ligne (agence / établissement / calendrier ; lieu / site), cause établie. Le gardien refuse « agence » et « site » hors des clés `vocabulaire.*` ; pour ne pas composer avec `mot()`, les textes écrivent « établissement » (30 valeurs : « Nouvel établissement », « Tous les établissements »…) et « lieu d'intervention » (42 valeurs : « Lieux d'intervention » sur la fiche client, « Tous les lieux » au filtre du parc…). L'écran porte donc trois mots pour l'agence et deux pour le site.
  - Preuve : `tests/unit/i18n/vocabulaire-impose.test.ts:52` `const MOTS_IMPOSES = /\b(?:agences?|sites?)\b/i;` ; `lib/i18n/fr.ts:2551-2552` `"agence.creer": "Nouvel établissement", "agence.retour": "← Tous les établissements",` ; `fr.ts:387` `"clients.fiche.sites": "Lieux d'intervention",`.
  - Effet pour l'utilisateur : « établissement », « agence » et « calendrier » désignent la même chose d'un écran à l'autre ; « lieu » et « site » aussi.
  - Correctif proposé : arbitrer un mot affiché par notion (recommandation : « Agence », « Site », comme le menu et la maquette), composer avec `mot()`/`motDansUnePhrase()`, puis étendre le gardien aux synonymes (liste close) — changement de gardien = décision, pas un ticket d'affichage.
  - Couverture : partiellement DÉJÀ COUVERT (GR12 pour les titres et boutons de /sites) ; le reste NOUVEAU.

- **TR-53** — **Nom de société et d'ERP en dur dans un produit multi-société** — Gravité : Mineur — Nature : Incohérence (D29)
  - Constat : vu en ligne (« AGENCE CODIMA » sur le parc et la fiche machine) ; DÉDUIT pour le reste : portail (« Ce que CODIMA suit pour vous », « interlocuteur CODIMA »), refus de clôture (« se traite dans Winpro »), définitions du vocabulaire imposé (non affichées), grammaire d'import VGP (« Non rattachée à un document CODIMA »).
  - Preuve : `lib/i18n/fr.ts:2171` `"parc.kv_agence_suffixe": "CODIMA",` et `:2365` (composés en `parc/page.tsx:544`, `parc/[id]/page.tsx:360`) ; `fr.ts:134`, `:160`, `:1539`, `:578-583` ; `lib/imports/vgp.ts:132`.
  - Effet pour l'utilisateur : juste chez CODIMA, faux dès la deuxième société cliente ; D29 a déjà sorti « Code Winpro » du produit pour cette raison.
  - Correctif proposé : « Agence » seul ou suivi du nom de la société active ; « votre interlocuteur » ; « dans votre logiciel de facturation » (ou libellé par société, comme `libelle_code_externe`) ; statuts d'import VGP paramétrables ou génériques.
  - Couverture : NOUVEAU.

- **TR-54** — **Sous-titre du planning : « … du 28 au 3/10/2026· Glisser-déposer »** — Gravité : Mineur — Nature : Bug prouvé (vu en ligne)
  - Constat : le premier jour n'a pas de mois (ambigu quand la semaine chevauche deux mois) ; la mention commence par « · » sans espace et suit le texte sans séparation JSX.
  - Preuve : `app/(back-office)/planning/page.tsx:1908-1913` `… ${t("planning.du")} ${premier.jour} ${t("planning.au")} ${dernier.jour}/…` ; `page.tsx:510-522` ; `lib/i18n/fr.ts:3161` `"· Glisser-déposer pour réaffecter"`.
  - Effet pour l'utilisateur : lecture hachée, date du début incomplète.
  - Correctif proposé : « du 28/09 au 03/10/2026 » ; espace avant « · » (ou séparateur composé).
  - Couverture : NOUVEAU (effet de bord hors de mon groupe : planning).

- **TR-55** — **Autres doublons de vocabulaire** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. Machine / équipement / matériel (71 / 17 / 12 valeurs) ; intervention / dossier (« Dossiers bloqués ») ; Technicien / Personne (formulaire d'absence) ; absence / blocage / indisponible (TR-1).
  - Preuve : `lib/i18n/fr.ts:3653` `"clients.fiche.synthese.equipements": "Équipements",` ; `:2983` `"tableau_de_bord.kpi_dossiers_bloques": "Dossiers bloqués",` ; `:2619` `"absences.personne": "Personne",`.
  - Effet pour l'utilisateur : on se demande si « 7 équipements » et « Parc machines » comptent la même chose.
  - Correctif proposé : un glossaire d'affichage court (un mot par notion) arrêté par Alexis, appliqué par passe éditoriale.
  - Couverture : partiellement DÉJÀ COUVERT (26/09 G7 « suspendue » à quatre noms, C7).

- **TR-56** — **Clés mortes** — Gravité : Mineur — Nature : Incohérence
  - Constat : DÉDUIT. Clés sans appelant : `planning.retour`, `terrain.rapport.enregistre`, `terrain.prestations.enregistre`, `terrain.signature.enregistre`, `terrain.photos.libelle` ; `nav.a_venir` n'est plus atteignable (TR-45).
  - Preuve : `lib/i18n/fr.ts:989`, `:1857`, `:1864`, `:1881`, `:1870`, `:2910` (`git grep` : aucun appelant hors du dictionnaire).
  - Effet pour l'utilisateur : aucun ; signe de fonctions annoncées non branchées (TR-24).
  - Correctif proposé : brancher (TR-24, TR-25) ou supprimer.
  - Couverture : NOUVEAU.

---

## Évolutions proposées pour ces pages

1. **Absences intégrées au planning (fusionner).** Sur la ligne d'un technicien au planning (et dans la future frise PG-G11) : « Déclarer une absence » pré-rempli (personne, jour), avec le même aperçu d'impact ; `/absences` devient la liste et l'historique (onglets « En cours / À venir / Terminées ») plutôt qu'un second calendrier. *Pourquoi* : une absence est un fait de planning (le code le dit : elle rend des interventions à la file et réduit la capacité) ; la déclarer là où l'on voit la charge évite l'aller-retour et montre tout de suite les cartes rendues. Garder l'entrée de menu (D121 fixe les destinations) : retirer `/absences` serait un écart à arbitrer (D121, D125).
2. **Absence à la demi-journée, « Écourter » plutôt que « Lever », état visible par ligne** (retirer « Lever » des absences terminées). *Pourquoi* : QG-8 (demi-journée) est décidé ; l'écourtement évite de réécrire les taux passés (TR-2). « Écourter » = règle nouvelle, Arrêt §8.
3. **Remplacer la tuile « Demandes à valider — Sans objet » par « Absents aujourd'hui »** (valeur déjà calculée au tableau de bord). *Pourquoi* : la seule tuile sans information de la page ; retrait = décision d'Alexis (gardée le 25/09).
4. **Page « Mon compte » (ajouter)**, ouverte par les initiales du bandeau : nom, courriel, rôle en clair, société active et changement de société (le sélecteur de `/arrivee`), état du second facteur (« actif / exigé par votre rôle »), sessions ouvertes. *Pourquoi* : depuis la redirection directe de `/arrivee`, rien ne dit à quelqu'un quel rôle il a ni pourquoi une entrée ne s'ouvre pas (TR-44) ; un compte multi-société n'a aucun chemin pour changer de société (TR-29). Le changement de mot de passe en libre-service est exclu par D58 (seul l'enrôlement est ouvert) : l'ajouter est un arbitrage.
5. **Accès : « Envoyer le lien de premier accès » et « Réémettre un lien » depuis l'Équipe (ajouter)**, geste de l'`admin_societe`, journalisé. *Pourquoi* : sans lui, aucun nouveau technicien ne peut entrer (TR-40) et un mot de passe oublié est définitif (TR-32). Arrêt §8 (D58, D65).
6. **Centre de notifications dans le bandeau (ajouter)** : cloche avec compteur, liste « non lus » : demandes arrivées, interventions rendues à la file par une absence (avec DEPLANIFIEE-1), rupture de service, import terminé, compteur resté ouvert (seuil = valeur à fixer par Alexis, CLAUDE.md §8), VGP échue. *Pourquoi* : ces événements existent déjà mais ne vivent que sur l'écran qui les a produits ou dans un courriel ; le push reste hors V1 (arbitrage 3.19) — ici rien n'est poussé. Nouvelle table cloisonnée (société + personne) = changement de schéma, Arrêt §8 ; choix des événements = Alexis.
7. **Terrain « Ma journée » (ajouter)** : bandeau du compteur en cours (TR-16), section « Demain » puis « 7 jours » (CDC §13.2), priorité et panne sur la carte ; **fiche** : panne, créneau, contact `tel:`, machine, historique court, « Terminer » (TR-21), « Suspendre / Reprendre » (D131), signature avec « client absent » tracé (M5 du CDC) ; écrans prévus par CDC §13.3 et absents : scanner un QR (la route `/api/machines/qr/[jeton]` rend du JSON, aucune page ne l'utilise), fiche machine terrain, profil (habilitations et échéances). *Pourquoi* : aujourd'hui le technicien part sans savoir quoi réparer ni qui appeler, et ne peut pas dire qu'il a fini. Déjà annoncé comme lot « terrain » ; hors-ligne différé par Alexis le 19/09.
8. **Un seul modèle de retour (fusionner)** : fil d'Ariane sur toutes les fiches (Clients › client › site › machine ; Interventions › n° ; Paramètres › section › fiche), le lien « ← » seulement là où il n'y a pas de fil, et `depuis` sur tous les points d'entrée (TR-48 à TR-50). *Pourquoi* : trois formes de retour aujourd'hui, et cinq cas où le retour mène ailleurs que l'origine. Chantier C6 ⚠ (26/09) : la forme reste à arbitrer.
9. **Hub des paramètres (retirer)** : portes « Clients » et « Sites » (doublons du menu depuis D121) ; **(renommer)** l'entrée « Sociétés & tarifs » en « Réglages » — écart à la maquette, arbitrage D121.
10. **Santé (ajouter / retirer)** : afficher la version servie (empreinte courte du commit et date, déjà lue par `commitDeploye()` pour `/api/sante`) ; retirer les deux décomptes « non lisible ». *Pourquoi* : c'est la page qu'Alexis ouvre pour savoir ce qui est en ligne ; la version y manque.
11. **Enrôlement (ajouter)** : QR code, bouton « Se déconnecter », saisie d'un code de secours à la connexion (TR-34, TR-37, TR-38).
12. **Glossaire d'affichage arrêté (ajouter)** : un mot par notion (agence, site, machine, absence, intervention), gardé par le test du vocabulaire étendu aux synonymes (TR-52, TR-55).

## Observations en ligne : confirmées / réfutées

1. **App technicien (compte admin_societe)** — CONFIRMÉE : entrée visible (`entrees.ts:530`, `habilitations.ts:118`) et `/terrain` renvoie au planning (`terrain/page.tsx:92-96`), comportement figé par `tests/e2e/navigation-app-technicien.spec.ts:71-79`. Le classement du pilote « CG5 périmé (D132 tient, App technicien déjà vivante) » est RÉFUTÉ : vivante pour le technicien seul ; pour ADMS/RM/RS le symptôme que D132 voulait supprimer demeure (`arbitrages.md:4843` vs `:4855`) → ÉCART À ARBITRER (D132), TR-44.
2. **/absences, h1 « Blocages d'agenda » / menu « Absences »** — CONFIRMÉE (`fr.ts:2614`, `page.tsx:207`) ; périmètre de PG-G15 NON VÉRIFIABLE depuis le dépôt (corps hors dépôt) — liste exhaustive fournie en TR-1 (h1, tuiles, « Bloquer un agenda », lien du planning, lien du tableau de bord et 18 autres surfaces, dont le témoin de prise de vue).
3. **/absences, tuile « Demandes à valider — Sans objet »** — CONFIRMÉE (`page.tsx:241-248`) ; gardée par Alexis le 25/09 : retrait = arbitrage (TR-8).
4. **/absences, « Lever » sur une absence passée** — CONFIRMÉE : aucune borne de date côté serveur (`lib/absences/depot.ts:318-325`) ; la ligne est supprimée et les taux d'occupation des semaines passées sont recalculés sans elle (`occupation.ts:210`) ; le texte « libère les jours à venir » est faux dans ce cas (TR-2).
5. **/absences, « Septembre 2026 » pour la semaine du 28/09** — CONFIRMÉE (`presentation.ts:77-81`, `page.tsx:251`) (TR-7).
6. **/absences, longs paragraphes** — CONFIRMÉE (`fr.ts:2626-2636`) ; DÉJÀ COUVERT par C7 (TR-12).
7. **/portail pour un compte bureau** — CONFIRMÉE (`portail/page.tsx:66-78`) ; entrée masquée conforme à D132 (`entrees.ts:527`) ; page sans retour (TR-27).
8. **/arrivee → /planning** — CONFIRMÉE (`arrivee/page.tsx:96-109`, `decision.ts:43`), voulu par 99A-ARRIVEE ; conséquences en TR-29.
9. **Vocabulaire agence / établissement / calendrier ; lieu / site** — CONFIRMÉE, cause trouvée : le gardien ne voit pas les synonymes (`vocabulaire-impose.test.ts:52`) — 30 « établissement », 42 « lieu(x) » (TR-52).
10. **Absence / Blocage d'agenda** — CONFIRMÉE (TR-1).
11. **« AGENCE CODIMA » sur le parc** — CONFIRMÉE (`fr.ts:2171`, `:2365` ; `parc/page.tsx:544`, `parc/[id]/page.tsx:360`), avec quatre autres noms en dur (TR-53).
12. **Sous-titre du planning « … du 28 au 3/10/2026· Glisser-déposer »** — CONFIRMÉE (`planning/page.tsx:1908-1913`, `:510-522`, `fr.ts:3161`) (TR-54).
13. **Fiches client et site : fil d'Ariane ET lien de retour** — CONFIRMÉE (`clients/[id]/page.tsx:321-346`, `sites/[id]/page.tsx:264-297`) (TR-48).
14. **/interventions/nouvelle : toujours « Retour au planning »** — CONFIRMÉE (`nouvelle/page.tsx:247-249`), déjà relevée le 26/09 (M4) ; cinq autres retours mènent aussi ailleurs que l'origine (TR-49).
15. **Menu du compte bureau** (Tableau de bord, Planning, Demandes, Interventions, Absences | Clients, Sites, Parc machines, VGP | Sociétés & tarifs, Imports Excel, App technicien) — CONFIRMÉE : c'est exactement `entreesAffichables(ENTREES, admin_societe)` (`entrees.ts:518-576`).
