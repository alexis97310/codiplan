# Audit IN — interventions, demandes, tableau de bord (28/09/2026)

*Partie « code » de l'audit page par page. Lecture seule du dépôt `/home/claude/codiplan` au commit `bcc637e` (main publié). Aucun serveur, aucune base, aucun test lancé ; aucun accès à la production. Chaque preuve est `fichier:ligne` au commit `bcc637e`. « DÉDUIT » = établi par lecture du code, non rejoué : à rejouer en recette avant correction. Aucune donnée de production ici (clients, techniciens et numéros anonymisés).*

*Pages : `/interventions/nouvelle`, `/interventions` (registre), `/interventions/[id]` (tous statuts), `/interventions/[id]/bon`, `/demandes`, `/demandes/[id]`, `/tableau-de-bord`. Code lu : les sept pages, `app/api/interventions/**`, `app/api/demandes/**`, `lib/interventions/**` (depot, cycle-de-vie, saisie, bon, action-principale, montants-visibles, perimetre-technicien, depot-compteur, depot-reprise), `lib/demandes/**`, `lib/reporting/**`, `lib/i18n/fr.ts`, les migrations des déclencheurs concernés.*

*`lib/reporting/**` : n'est appelé par aucune page du groupe (le tableau de bord n'affiche aucun montant consolidé, « Taux d'occupation » reste « Non calculé ») — rien à signaler.*

---

## /interventions/nouvelle

- **IN-01** — **« Mode de valorisation » imposé à « Temps passé », jamais modifiable ensuite, et « Forfait » rend le total incalculable** — Gravité : Majeur — Nature : Écart à arbitrer (RG-TAR-05)
  - Constat : le `<select>` n'a pas d'option vide : « Temps passé » est retenu sans choix (défaut répété dans le schéma et la route). Aucun écran ni route ne modifie ensuite le mode : la seule écriture est la création. RG-TAR-05 veut un mode « fixé à la qualification et modifiable jusqu'à la clôture ». Choisir « Forfait » ou « Forfait plus heures » produit une intervention dont le total ne sera JAMAIS calculé (aucun forfait de prestation n'est sélectionnable). Le champ est ouvert à tout rôle `creer_demande` (technicien et client compris), alors que la qualification revient à l'ADV ou au responsable (CDC §7 M3, l. 390).
  - Preuve : `app/(back-office)/interventions/nouvelle/page.tsx:320-326` « nom="mode_valorisation" … defaut="temps_passe" » (sans `optionVide`) ; `lib/interventions/saisie.ts:170` « .default("temps_passe") » ; `app/api/interventions/creer/route.ts:108` « ?? "temps_passe" » ; seule écriture : `lib/interventions/depot.ts:401` (grep `mode_valorisation` dans `app/` et `lib/`) ; `lib/tarification/valorisation.ts:266-277` « if (exigeUnForfaitDePrestation(mode)) { … totalHT: null » ; `docs/cahier-des-charges.md:696` « Le mode est fixé à la qualification et modifiable jusqu'à la clôture ».
  - Effet pour l'utilisateur : une intervention au forfait saisie trop vite part « au temps passé » sans que personne l'ait choisi, et l'erreur ne se corrige plus dans CODIPLAN ; choisir « Forfait » fige un total « Sans information ».
  - Correctif proposé : **Arrêt §8 (argent facturé)** — deux options : (a) option vide « — Choisir le mode — » + champ requis, et action « Modifier le mode » sur la fiche jusqu'à la clôture (RG-TAR-05) ; (b) retirer le champ de la création et le poser au geste « Planifier » (qualification), réservé à `qualifier_affecter`. Dans les deux cas, ne proposer « Forfait / Forfait plus heures » que lorsqu'un forfait de prestation peut être choisi.
  - Couverture : NOUVEAU.

- **IN-02** — **Priorité imposée à « P3 — normale »** — Gravité : Mineur — Nature : Ergonomie
  - Constat : même piège que la nature avant GR1 : pas d'option vide, P3 retenue par défaut (sauf depuis une demande, qui reporte son urgence). Aucune règle du chapitre 10 ne fixe ce défaut : il vient du schéma.
  - Preuve : `nouvelle/page.tsx:312-318` « nom="priorite" … defaut="p3" » ; `lib/interventions/saisie.ts:169` « .default("p3") » ; `creer/route.ts:107` ; `prisma/schema.prisma` (`priorite … @default(p3)`).
  - Effet pour l'utilisateur : un appel P1 saisi sans toucher au champ entre P3 dans la file, derrière les urgences.
  - Correctif proposé : option vide « — Choisir la priorité — » + requis (comme GR1), ou défaut fixé par Alexis (valeur à fixer, CLAUDE.md §8).
  - Couverture : NOUVEAU.

- **IN-03** — **Après un refus serveur, le formulaire perd la demande d'origine et le mode de valorisation** — Gravité : Mineur — Nature : Bug déduit
  - Constat : `versLeFormulaire` renvoie site, machine, nature, priorité, panne, référence, contact — pas `demande_id` ni `mode_valorisation`. Après un refus (machine hors site, client ou agence inactifs, lieu sans rattachement…), le bandeau « Préremplie depuis une demande » et le champ caché disparaissent, et le mode repasse à « Temps passé ».
  - Preuve : `app/api/interventions/creer/route.ts:67-75` (`champsResoumis` sans `demande_id` ni `mode_valorisation`) ; `app/api/interventions/creer/formulaire.ts:35-44` ; `nouvelle/page.tsx:138-143`, `277-284` (le lien ne vit que par `?demande=`).
  - Effet pour l'utilisateur : l'intervention finalement créée n'est plus rattachée à sa demande (qui reste dans la file) ; un mode « Forfait » choisi est silencieusement remplacé.
  - Correctif proposé : ajouter `demande` et `mode_valorisation` à `champsResoumis`/`versLeFormulaire` ; test : refus puis resoumission → `demande_id` conservé.
  - Couverture : NOUVEAU.

- **IN-04** — **`?client=` n'est pas lu : « + Intervention » depuis une fiche client ouvre un formulaire vide** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la page ne lit que `demande`, `site`, `machine`, `contact_id`, `type`, `priorite`, `description`, `reference_client`, `motif`. La fiche client pose un lien nu (choix écrit « hors du périmètre de ce ticket »). La recherche de sites sait pourtant déjà filtrer par client.
  - Preuve : `nouvelle/page.tsx:127-234` (aucun `params.client`) ; `app/(back-office)/clients/[id]/page.tsx:333-342` « LIEN SIMPLE, PAS PRÉREMPLI (FICHE-360-1) » ; `app/api/recherche/sites/route.ts:40` « client_id: url.searchParams.get("client") ».
  - Effet pour l'utilisateur : depuis la fiche d'un client, il faut rechercher de nouveau ce même client.
  - Correctif proposé : lire `?client=` (validé sous le contexte, client actif) et le passer au `SelecteurRecherche` (`parametres={{ clientActif: "1", client }}`) ; présélectionner le site quand le client n'en a qu'un actif ; lien `…/nouvelle?client=<id>` sur la fiche client.
  - Couverture : NOUVEAU.

- **IN-05** — **Lien de retour toujours « ← Retour au planning »** — DÉJÀ COUVERT (audit 26/09 M4, chantier C6 ⚠) — toujours vrai : `nouvelle/page.tsx:246-250` `href="/planning"`.

---

## /interventions (registre)

- **IN-06** — **Un technicien voit tout le registre (et des chiffres de toute la société au tableau de bord)** — Gravité : Majeur — Nature : Bug déduit
  - Constat : la restriction par personne (`○` de « Consulter le planning », RG-DRO-02) n'est appliquée que par `listerPlanning`, `lireFicheIntervention`, `lireIntervention` et `lireBonIntervention`. `listerInterventions`, `compterInterventions`, `compterParVue` ne l'appliquent pas ; l'entrée « Interventions » est visible au technicien. Au tableau de bord, « Interventions aujourd'hui » est restreinte mais « Dossiers bloqués », « Pièce attendue » et « sans durée » comptent toute la société.
  - Preuve : `lib/interventions/depot.ts:3001-3030` (aucune `restrictionParPersonne`) contre `:1611`, `:1851` ; `lib/auth/habilitations.ts:114` « consulter_planning: { complet: […], restreint: [TEC] } » ; `lib/navigation/entrees.ts:521` « "nav.interventions": "consulter_planning" » ; `app/(back-office)/tableau-de-bord/page.tsx:252-273` (`enAttenteDePiece`, `compterParVue`, `compterInterventionsSansDuree` sans restriction) ; aucun test du registre sous un rôle technicien (`tests/isolation/ecran-intervention.test.ts`).
  - Effet pour l'utilisateur : un technicien lit clients, sites, priorités et affectations de ses collègues ; chaque ligne qui n'est pas la sienne ouvre une page « introuvable ».
  - Correctif proposé : **Arrêt §8 (cloisonnement, données personnelles)** — composer `restrictionParPersonne(contexte)` dans `filtreDesInterventions` (et dans `enAttenteDePiece`, `compterInterventionsSansDuree`) ; scénario d'isolation avec un technicien restreint (liste, compteurs d'onglets, tuiles).
  - Couverture : NOUVEAU.

- **IN-07** — **Période inversée ou paramètre invalide : liste vide, tous les compteurs à zéro, aucun message** — Gravité : Mineur — Nature : Bug déduit
  - Constat : le schéma refuse « au < du » (et un `agence` non UUID) ; la page remplace alors la liste, le total et les onglets par des zéros et n'affiche aucune puce ni motif. Le message écrit dans le schéma n'est jamais montré ; l'état vide dit « Aucune intervention enregistrée. ».
  - Preuve : `lib/interventions/saisie.ts:503-506` « .refine((v) => … v.au >= v.du, { message: "La fin de la période doit suivre son début." » ; `app/(back-office)/interventions/page.tsx:219-234` (`Promise.resolve([])`, `0`, `COMPTES_VUE_VIDES`) ; `:312-314` ; `lib/i18n/fr.ts:1004`.
  - Effet pour l'utilisateur : une faute de saisie de date fait croire que le registre est vide.
  - Correctif proposé : quand `criteres.success` est faux, afficher le motif (clé `fr.ts`) et encadrer le champ fautif ; état vide distinct « Aucune intervention ne correspond à ces critères » (IN-12).
  - Couverture : NOUVEAU.

- **IN-08** — **« Planifiées cette semaine » compte les annulées, les clôturées et les clients inactifs** — Gravité : Mineur — Nature : Incohérence
  - Constat : le compte porte sur toute ligne datée de la semaine, « quel que soit le statut », sans le filtre client actif que 99V a posé sur les deux autres tuiles.
  - Preuve : `interventions/page.tsx:724-729` « tx.intervention.count({ where: { date_planifiee: { gte: debutSemaine, lt: finSemaine } } }) » ; docblock `:684-687`.
  - Effet pour l'utilisateur : le chiffre ne correspond à aucune liste (une annulée de la semaine « planifiée »).
  - Correctif proposé : exclure `annulee` et appliquer `filtreClientActif(false)` ; libellé exact de la population ; le lien vers l'onglet « À venir » reste PG-C1c.
  - Couverture : NOUVEAU (le lien manquant : EN FILE PG-C1c / audit 27/09 I-11).

- **IN-09** — **Tris : la file d'attente en dernière page, « À planifier » triée à l'inverse du planning, « Aujourd'hui » pas par heure** — Gravité : Mineur — Nature : Ergonomie
  - Constat : ordre unique `date_planifiee desc nulls last, id desc`. « Toutes » s'ouvre sur les interventions les plus lointaines dans le futur et relègue les « À planifier » en dernière page ; l'onglet « À planifier » les range par création décroissante, alors que la file du planning range par urgence puis ancienneté (L3-03) ; « Aujourd'hui » range par création, pas par créneau.
  - Preuve : `lib/interventions/depot.ts:3020-3023` ; contre `:1669-1675` (planning : `priorite asc, cree_le asc`) ; `:2881-2884` (onglet Aujourd'hui).
  - Effet pour l'utilisateur : la même population apparaît dans deux ordres différents selon l'écran ; une P1 ancienne n'est pas en tête de l'onglet « À planifier ».
  - Correctif proposé : ordre par onglet — « À planifier » : priorité puis ancienneté (le critère de `listerPlanning`) ; « Aujourd'hui » : créneau croissant ; « Bloquées » : ancienneté de suspension (C4) ; « Toutes » : inchangé ou onglet par défaut à arbitrer.
  - Couverture : NOUVEAU (tri des Bloquées : DÉJÀ COUVERT, chantier C4).

- **IN-10** — **Des filtres se perdent : « sans durée » à la pagination et aux onglets, « Inclure les clients inactifs » au retour de fiche** — Gravité : Mineur — Nature : Bug déduit
  - Constat : `parametresActifs` (pagination, onglets) n'inclut pas `sans_duree_a_venir` (le code le reconnaît) ; la liste fermée du retour de fiche n'inclut pas `inclure_clients_inactifs`.
  - Preuve : `interventions/page.tsx:245-262`, `:301-306` « il ne survit pas à un changement d'onglet ni de page », `:664-666` ; `app/(back-office)/interventions/presentation.ts:178-189` (`PARAMETRES_RETOUR_REGISTRE` sans `inclure_clients_inactifs`).
  - Effet pour l'utilisateur : la page 2 de la liste « sans durée » est le registre entier ; en revenant d'une fiche, la ligne d'un client inactif d'où l'on vient a disparu.
  - Correctif proposé : ajouter les deux paramètres à `parametresActifs` et à `PARAMETRES_RETOUR_REGISTRE`.
  - Couverture : NOUVEAU.

- **IN-11** — **Filtres « Affectée » et « Terminée », onglet « À contrôler » : toujours vides** — Gravité : Mineur — Nature : Incohérence
  - Constat : le filtre propose les huit statuts ; « Affectée » et « Terminée » ne sont écrits par aucun chemin (IN-14), donc « À contrôler » (= `terminee`) est toujours à zéro hors démonstration.
  - Preuve : `interventions/page.tsx:426-431` ; `lib/interventions/depot.ts:2889-2890` « case "a_controler": return { statut: "terminee" } ».
  - Effet pour l'utilisateur : trois choix qui ne rendent jamais rien.
  - Correctif proposé : suit l'arbitrage de IN-14 et de QG-5 (PG-E1) ; en attendant, masquer ces choix ou les annoter.
  - Couverture : « Affectée » EN FILE (bug 7, PG-E1) ; « Terminée »/« À contrôler » NOUVEAU.

- **IN-12** — **« Aucune intervention enregistrée. » pour une recherche sans résultat** — Gravité : Mineur — Nature : Ergonomie
  - Constat : le même texte sert au registre vide, à un filtre sans résultat et à une recherche invalide.
  - Preuve : `interventions/page.tsx:633-637` ; `lib/i18n/fr.ts:1004`.
  - Effet pour l'utilisateur : on croit que la base est vide.
  - Correctif proposé : texte distinct quand un filtre ou un onglet est actif, avec « Tout effacer ».
  - Couverture : NOUVEAU.

- **IN-13** — **Hauteur, petits textes, tableau de 920 px** — DÉJÀ COUVERT (GR18, chantier C3) — toujours vrai : `interventions/page.tsx:628-632` `minimum="920px"`, 50 lignes par page (`saisie.ts:397`), statut en `text-[11px]` (`:777`), pagination en `text-[11.5px]` (`components/ui/pagination.tsx`). Le sélecteur 50/100/200 lignes (audit 25/09, constat 18) n'est pas fait.

---

## /interventions/[id]

- **IN-14** — **« Terminée » est inatteignable** — Gravité : Majeur — Nature : Écart à arbitrer (D8 §3, arbitrage 3.17)
  - Constat : aucun chemin n'écrit `statut = terminee` : « arrêter le compteur » ferme le segment sans toucher au statut (« ce point n'est pas tranché »), le terrain n'a pas de route « terminer ». Une intervention démarrée reste « En cours » jusqu'à ce que le bureau la clôture directement ; l'action principale d'une « En cours » est nulle (Clôturer est un bloc replié) ; le bon n'est disponible qu'en « Terminée » ou « Clôturée », donc jamais sur place pour le technicien ; « En cours » accumule du travail fini.
  - Preuve : grep `statut: "terminee"` dans `lib/` et `app/` : aucune écriture ; `lib/interventions/depot-compteur.ts:175-179` « Ce qui les distinguerait est ce que l'arrêt ferait au statut de l'intervention, et ce point n'est pas tranché » ; `lib/interventions/action-principale.ts:22-24` « en_cours: null, … terminee: "cloturer" » ; `lib/interventions/cycle-de-vie.ts:204-209` ; `docs/arbitrages.md:184`, `:539` « le technicien ne clôture pas. Il termine, le responsable valide et clôture ». Décision D-S5 (16/09, consignée dans le Projet, `claude/passation-stockage-documents.md` §3, absente de `docs/arbitrages.md`) : « la signature … conditionne le "terminé" ».
  - Effet pour l'utilisateur : l'onglet « À contrôler » est toujours vide, la clôture se fait sans étape de contrôle, et « Le bon sera disponible une fois l'intervention terminée » annonce un état que personne ne peut produire.
  - Correctif proposé : **Arrêt §8 (statuts d'intervention)** — (a) geste terrain « Terminer » (En cours → Terminée), conditionné à la signature ou à son motif d'absence (D-S5, vigilance V1), et Clôturer principal sur « Terminée » ; (b) assumer la clôture depuis « En cours » : amender D8/3.17, retirer « Terminée » et « À contrôler » des écrans. Reporter D-S5 dans `docs/arbitrages.md`.
  - Couverture : NOUVEAU.

- **IN-15** — **La matrice des transitions de D8 n'est pas tenue, ni à l'écran ni en base** — Gravité : Majeur — Nature : Écart à arbitrer (D8)
  - Constat : les gardes ne regardent que « annulée / clôturée » ; le déclencheur aussi. Des tests unitaires fixent ces permissions. L2-07 (LIVRÉ) exigeait « chaque transition hors matrice est refusée avec un message explicite ». Matrice constatée (rôle bureau, `admin_societe`) :

    | Statut | Blocs offerts sur la fiche | Serveur | D8 |
    |---|---|---|---|
    | À planifier | Planifier (principal) · Clôturer (replié, refus « aucun temps ») · **Suspendre** · Annuler · Ajouter une machine | Suspendre **accepté** | → Suspendue : **non** |
    | Planifiée | Affecter (principal) · Déplacer · Clôturer (replié ; permis si un segment existe) · **Suspendre** · Annuler | Suspendre et Clôturer **acceptés** | → Suspendue, → Clôturée : **non** |
    | Affectée | inatteignable (bug 7) | — | — |
    | En cours | aucune principale · Affecter · Déplacer · **Clôturer** (si temps > 0) · Suspendre · Annuler | Clôturer **accepté** (saute Terminée) | → Clôturée : **non** |
    | Suspendue | Reprendre (principal) · Affecter · Déplacer · **Clôturer** (si temps > 0) · Annuler | Clôturer **accepté** ; Reprendre ne rend jamais « En cours » | → Clôturée : **non** |
    | Terminée | inatteignable (IN-14) ; sinon Clôturer · **Suspendre** · **Annuler** | acceptés | → Suspendue, → Annulée : **non** |
    | Clôturée | **Annuler** (seul bloc) | **accepté** | terminal |
    | Annulée | aucun | refus | terminal |
  - Preuve : `lib/interventions/cycle-de-vie.ts:142-159` (`peutSuspendre` : seuls annulée/clôturée/suspendue refusés), `:81-95` (`peutCloturer` : aucun contrôle de `terminee`), `:186-191` (`peutAnnuler`) ; `prisma/migrations/20260915060000_les_deux_temps_d120/migration.sql:157-167` ; `docs/arbitrages.md:177-188` ; `docs/backlog.md:647` ; `tests/unit/interventions/suspension.test.ts:61` « peutSuspendre("planifiee", "Attente de pièce").refuse).toBe(false) » ; `tests/unit/interventions/cycle-de-vie.test.ts:50`.
  - Effet pour l'utilisateur : on peut suspendre une intervention jamais planifiée, clôturer une intervention suspendue en attente de pièce, annuler une intervention terminée ou clôturée — autant de chemins que la décision écrite interdit.
  - Correctif proposé : **Arrêt §8 (statuts)** — (a) tenir la matrice D8 dans `cycle-de-vie.ts` ET dans `intervention_cycle_de_vie` (migration), et retirer de la fiche les blocs hors matrice ; (b) amender D8 pour écrire les transitions voulues (ex. « attente de pièce avant visite » = Planifiée → Suspendue) et aligner les tests. Ne rien changer avant l'arbitrage.
  - Couverture : NOUVEAU.

- **IN-16** — **Annuler une intervention clôturée : bloc offert, serveur d'accord, facturation intacte** — Gravité : Majeur — Nature : Écart à arbitrer (D8, D115)
  - Constat : sur une clôturée (y compris l'historique importé, posé `facturee`), la fiche affiche « Seule l'annulation reste possible » et le bloc « Annuler » avec sa confirmation ; le serveur accepte (lecture de I5, préséance de synchronisation). L'annulation n'écrit que statut, motif et date : `statut_facturation` (« à facturer » ou « facturée ») et `montant_ht` restent.
  - Preuve : `app/(back-office)/interventions/[id]/page.tsx:821-856` ; `lib/interventions/cycle-de-vie.ts:178-191` « ANNULEE a la préséance sur tout, y compris sur CLOTUREE » ; `…/20260915060000_les_deux_temps_d120/migration.sql:163-167` ; `lib/interventions/depot.ts:1406-1413` ; `prisma/migrations/20260913220000_statut_facturation_d8/migration.sql:135-165` ; `lib/interventions/depot-reprise.ts:30-32` ; `docs/arbitrages.md:188` « CLOTUREE est terminal » ; `docs/constitution/invariants.md:177-180` (I5 = conflit de synchronisation).
  - Effet pour l'utilisateur : une intervention annulée peut rester « à facturer » ou « facturée », avec son montant, et un historique importé déjà facturé se laisse annuler d'un clic.
  - Correctif proposé : **Arrêt §8 (argent, statuts)** — (a) conforme à D8 : retirer le bloc et refuser côté serveur (préséance I5 réservée à la synchronisation) ; (b) garder l'annulation d'une clôturée, mais décider ce que devient `statut_facturation` (D115 : la réponse est dans Winpro) et le dire dans la confirmation.
  - Couverture : NOUVEAU (le texte « Seule l'annulation reste possible » vient de GR16 ; l'écart à D8 n'était pas relevé).

- **IN-17** — **Clôturer ou annuler pendant qu'un compteur tourne bloque le compteur du technicien** — Gravité : Majeur — Nature : Bug déduit
  - Constat : la clôture et l'annulation ne regardent pas les segments ouverts. Ensuite, « arrêter le compteur » ferme le segment PUIS réécrit `temps_mesure_min` sur l'intervention ; le déclencheur refuse toute écriture sur une clôturée ou une annulée ; la transaction est annulée et le segment reste ouvert. L'index « un seul compteur ouvert par personne » empêche alors tout autre démarrage.
  - Preuve : `lib/interventions/depot-compteur.ts:206-229` (segment fermé puis `tx.intervention.update({ … temps_mesure_min })`) ; `…/20260915060000_les_deux_temps_d120/migration.sql:157-167` ; `prisma/migrations/20260909200000_intervention_l2_planning/migration.sql:187-188` (BEFORE UPDATE, toute écriture) ; `lib/interventions/compteur.ts:73-80` (la mesure ne compte que les segments fermés) ; `lib/interventions/cycle-de-vie.ts:81-95`, `:186-191` ; `lib/interventions/depot-compteur.ts:130-133` + `lib/interventions/compteur.ts:120` (démarrage refusé « deja_en_cours » tant qu'un segment de la personne est ouvert) ; `prisma/migrations/20260915010000_compteur_du_technicien_r5_02/migration.sql:94-96` (index « un seul ouvert par personne ») ; `docs/arbitrages.md:4184`.
  - Effet pour l'utilisateur : le technicien ne peut plus arrêter ni démarrer aucun compteur ; le temps de ce segment n'est jamais compté (contraire à I5 : « le travail terrain n'est jamais perdu »). La clôture a pu partir avec un temps partiel. À rejouer en recette.
  - Correctif proposé : **Arrêt §8 (argent, I5)** — (a) refus nommé de clôturer/annuler tant qu'un segment est ouvert (« Un compteur tourne encore sur cette intervention ») ; (b) fermer les segments ouverts à l'instant de la clôture/annulation (écrit un temps : décision D119/D120). Dans tous les cas, l'arrêt d'un compteur ne doit pas dépendre de l'écriture sur l'intervention.
  - Couverture : NOUVEAU.

- **IN-18** — **Annuler (ou clôturer) une suspendue laisse la pause « En cours » à jamais** — Gravité : Mineur — Nature : Bug déduit
  - Constat : seule la reprise ferme la ligne `intervention_pause` ; l'annulation et la clôture ne la ferment pas, et aucun déclencheur ne le fait.
  - Preuve : `lib/interventions/depot.ts:2402-2422` (fermeture à la reprise) ; `:1387-1417` et `:1246-1380` (aucune écriture de `interventionPause`) ; `prisma/migrations/20260924180000_interventions_2/migration.sql:110-112` (une seule pause ouverte) ; `app/(back-office)/interventions/[id]/page.tsx:1352-1363` (« En cours »).
  - Effet pour l'utilisateur : une intervention annulée affiche une pause en cours depuis des mois.
  - Correctif proposé : fermer la pause ouverte dans la même transaction que l'annulation et la clôture (`fin` = instant, `fermee_par` = session).
  - Couverture : NOUVEAU.

- **IN-19** — **Annuler une intervention planifiée ne prévient ni le client ni le technicien** — Gravité : Majeur — Nature : Écart à arbitrer (arbitrage 3.11, RG-INT-05)
  - Constat : la route d'annulation n'appelle aucun avertissement ; le retour dans la file (Déplacer, tout vidé) non plus. Or le client et le technicien ont reçu un courriel à la planification (AVERTISSEMENTS-1).
  - Preuve : `app/api/interventions/[id]/annuler/route.ts:27-47` (aucun appel à `avertirApresPlanification`) ; `lib/avertissements/planification.ts:375-379` « Retourné à la file d'attente : rien à annoncer avec une date » ; `docs/arbitrages.md:533` « Notifications de modification : Créneau, technicien et annulation » ; `docs/cahier-des-charges.md:707`.
  - Effet pour l'utilisateur : le client attend un technicien qui ne viendra pas.
  - Correctif proposé : courriel d'annulation au client et au technicien (texte simple, comme AVERTISSEMENTS-1) ; la déplanification relève de DEPLANIFIEE-1. **Arrêt §8** : ce que le client reçoit.
  - Couverture : NOUVEAU.

- **IN-20** — **La clôture ne vérifie ni rapport validé ni signature** — Gravité : Majeur — Nature : Écart à arbitrer (D8 « gardes conservées », D24)
  - Constat : `cloturerIntervention` ne juge que le statut et le temps mesuré. RG-INT-03 (rapport validé) et RG-INT-04 (signature, sauf motif d'exception) ne sont tenues nulle part ; aucun modèle « rapport » n'existe.
  - Preuve : `lib/interventions/depot.ts:1293-1301` ; `docs/arbitrages.md:190` « RG-INT-03 et RG-INT-04 sur → CLOTUREE », `:414` (D24) ; `docs/cahier-des-charges.md:705-706`.
  - Effet pour l'utilisateur : une intervention se clôture (et part en facturation) sans signature ni motif d'absence de signature.
  - Correctif proposé : à arbitrer avec IN-14 (D-S5 : signature au « Terminer ») — au minimum, exiger à la clôture une signature ou un motif tracé (signée / absente / refusée, vigilance V1 du Projet). **Arrêt §8**.
  - Couverture : RG-INT-03 DÉJÀ COUVERT (backlog L3-15, BLOQUÉ) ; RG-INT-04 NOUVEAU.

- **IN-21** — **Le retour d'origine se perd après toute action, et depuis le tableau de bord, le bon et la création** — Gravité : Mineur — Nature : Bug déduit
  - Constat : toutes les routes de la fiche redirigent vers `/interventions/<id>` sans `depuis`/`retour` ; le tableau de bord, le bon (« ← Fiche ») et la création (y compris depuis une demande) ouvrent la fiche sans `depuis`. Le lien retombe sur « ← Retour au planning », et les filtres du registre sont perdus.
  - Preuve : `app/api/interventions/actions.ts:27-44` ; `app/(back-office)/interventions/presentation.ts:259-268` (défaut « planning ») ; `app/(back-office)/tableau-de-bord/presentation.ts:313`, `:340`, `:374` ; `app/(back-office)/interventions/[id]/bon/page.tsx:144-149` ; `app/api/interventions/creer/route.ts:160`.
  - Effet pour l'utilisateur : après « Planifier » sur une fiche ouverte depuis le registre filtré, le retour mène au planning.
  - Correctif proposé : relayer `depuis`, `depuis_id`, `retour` dans les formulaires (champs cachés) et dans `versLaFiche` ; ajouter `tableau-de-bord` à la liste fermée ; création depuis une demande → `?depuis=demande&depuis_id=<demande>`.
  - Couverture : NOUVEAU (la création seule : DÉJÀ COUVERT, 26/09 M4).

- **IN-22** — **Trois refus affichent un motif faux** — Gravité : Mineur — Nature : Bug déduit
  - Constat : (1) « Affecter » avec l'option vide « Aucun technicien affecté » → message d'habilitation ; (2) « Suspendre » avec une référence sans date (ou l'inverse) → « Le motif est obligatoire » ; (3) « Clôturer » avec un temps non entier ou nul → « Aucun temps n'a été mesuré… ».
  - Preuve : `app/api/interventions/[id]/affecter/route.ts:37-40` ; `app/(back-office)/interventions/[id]/page.tsx:936-942` (option vide proposée) ; `app/api/interventions/[id]/suspendre/route.ts:47-57` ; `app/api/interventions/[id]/cloturer/route.ts:40-48` ; `lib/i18n/fr.ts:1271-1272`, `:1558-1559`, `:1538-1539`.
  - Effet pour l'utilisateur : on cherche une habilitation ou un motif qui ne sont pas en cause.
  - Correctif proposé : clés nommées (« Choisissez un technicien », « Référence et date de disponibilité vont ensemble », « Le temps validé est un nombre entier de minutes, au moins 1 ») ; `min="1" step="1"` sur les champs numériques ; retirer l'option vide d'« Affecter » (retirer un technicien = « Déplacer »).
  - Couverture : NOUVEAU.

- **IN-23** — **Historique importé présenté comme en attente : « pas encore tourné », heure inventée, année absente** — Gravité : Mineur — Nature : Donnée
  - Constat : le texte « le compteur n'a pas encore tourné » s'affiche quel que soit le statut ; la clôture importée est posée à minuit UTC et s'affiche « … 11:00 » (heure qui n'existe pas dans l'archive) ; le résumé « <jour> jj/mm · heure non fixée » omet l'année et parle d'une heure « non fixée » sur une clôturée ; priorité P3, mode « Temps passé », nature « Curatif » sont des défauts de reprise.
  - Preuve : `app/(back-office)/interventions/[id]/page.tsx:1427-1430` ; `lib/i18n/fr.ts:1566-1567` ; `lib/interventions/depot-reprise.ts:28-29` ; `page.tsx:1495-1499` et `:1576` (`dateHeureLocale`) ; `app/(back-office)/interventions/presentation.ts:399-404` (sans année), `:432-433` ; `lib/imports/reprise.ts:80`.
  - Effet pour l'utilisateur : une intervention de l'an passé se lit comme un rendez-vous à fixer, à une heure fausse.
  - Correctif proposé : texte selon le statut (clôturée/annulée : « Aucun segment de travail enregistré. » ; reprise : « Temps non repris de l'archive ») ; date seule (jj/mm/aaaa) quand l'instant vient de l'archive ; année dans le résumé hors année courante ; « — » pour les valeurs non reprises (I-12).
  - Couverture : NOUVEAU (valeurs par défaut présentées comme faits : DÉJÀ COUVERT, audit 27/09 I-12).

- **IN-24** — **Montant de l'archive : caché sur la fiche, affiché sur le bon** — Gravité : Mineur — Nature : Incohérence
  - Constat : la fiche ne calcule la valorisation que si un temps validé existe (jamais sur l'historique repris) ; le bon affiche `montant_ht` de l'archive dès qu'un taux existe à la date.
  - Preuve : `lib/interventions/depot.ts:1913` « if (brute.temps_valide_min !== null && brute.temps_valide_min > 0) » ; `lib/interventions/bon.ts:231-234`, `:282` ; `lib/interventions/depot-reprise.ts:71`.
  - Effet pour l'utilisateur : deux écrans, deux réponses pour le montant d'une même intervention.
  - Correctif proposé : sur la fiche, ligne « Montant repris de l'archive » (droits `voir_montants_vente`), sans décomposition.
  - Couverture : NOUVEAU.

- **IN-25** — **Note interne : zone de texte sans libellé** — Gravité : Mineur — Nature : Ergonomie
  - Constat : le `<textarea>` n'a ni `<label>`, ni `aria-label`, ni `aria-labelledby` ; le titre « Note interne » n'y est pas relié.
  - Preuve : `app/(back-office)/interventions/[id]/page.tsx:1607-1625`.
  - Effet pour l'utilisateur : un lecteur d'écran annonce une zone d'édition anonyme.
  - Correctif proposé : `id` sur le `h2` et `aria-labelledby`, ou `<label>` visible.
  - Couverture : NOUVEAU.

- **IN-26** — **« 90 prochains jours » : une borne d'écran exposée comme une règle** — Gravité : Mineur — Nature : Incohérence
  - Constat : 90 est une constante d'écran (66-PLANNING-4), reprise de `/absences` où elle est dite « pas des durées métier » ; aucune règle du chapitre 10 ni arbitrage ne l'écrit. La phrase affiche la limite d'une implémentation.
  - Preuve : `app/(back-office)/interventions/[id]/page.tsx:146-152` ; `lib/i18n/fr.ts:1269-1270` ; `app/(back-office)/absences/page.tsx:581-589` ; `docs/propositions/66-PLANNING-4/passation.md:21-25`.
  - Effet pour l'utilisateur : une absence au-delà de 90 jours n'est pas signalée avant l'envoi (le serveur refuse ensuite).
  - Correctif proposé : lire les absences de la date choisie à la demande (lecture ciblée, route en lecture seule, voir PG-B1) et retirer la phrase ; si une borne reste : valeur à fixer par Alexis (CLAUDE.md §8).
  - Couverture : NOUVEAU.

- **IN-27** — **Aucune ancienneté affichée pour une « À planifier » (fiche, registre, tableau de bord)** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la date de création n'apparaît que dans la chronologie, en date absolue ; le registre n'a pas de colonne ; le tableau de bord n'indique l'âge que pour les pièces attendues. QG-11 a exclu les délais cibles : afficher l'âge, sans seuil ni couleur inventée.
  - Preuve : `app/(back-office)/interventions/page.tsx:316-337` ; `app/(back-office)/tableau-de-bord/presentation.ts:364-376` ; `docs/propositions/planning-gmao/decisions-2026-09-27.md:15`.
  - Effet pour l'utilisateur : une P1 non planifiée depuis six jours ne se distingue pas d'une P1 d'aujourd'hui.
  - Correctif proposé : « créée il y a N j » sur la fiche (sous le titre), colonne « Ancienneté » dans les onglets À planifier et Bloquées, et sur les lignes « À planifier » du tableau de bord.
  - Couverture : EN FILE (PG-C2, planning) ; fiche, registre et tableau de bord : proposé à l'audit 27/09 §4.1, sans ticket.

- **IN-28** — **Sélecteurs à valeur imposée : machine présélectionnée, option vide trompeuse** — Gravité : Mineur — Nature : Ergonomie
  - Constat : « Ajouter une machine » présélectionne la première machine du site (pas d'option vide) ; « Planifier » propose en option vide « Aucun technicien affecté » sur un champ obligatoire.
  - Preuve : `app/(back-office)/interventions/[id]/page.tsx:738-748`, `:912-918`.
  - Effet pour l'utilisateur : un clic sur « Ajouter » rattache une machine au hasard ; l'option vide se lit comme un choix valable.
  - Correctif proposé : option vide « — Choisir une machine — » requise ; « — Choisir un technicien — » dans « Planifier ».
  - Couverture : NOUVEAU.

- **IN-29** — **Des blocs sont offerts à un rôle que la route refuse** — Gravité : Mineur — Nature : Incohérence (esprit de D131)
  - Constat : « Déplacer » ne juge que le statut, « Ajouter une machine » ne juge rien ; pour un technicien (sans `modifier_planning` ni `qualifier_affecter`), les deux s'affichent et échouent en « auth.refus » à l'envoi.
  - Preuve : `page.tsx:958-963`, `:996-1005` (commentaire qui l'assume), `:721-756` ; `app/api/interventions/[id]/machine/route.ts` (`exigerCapacite("qualifier_affecter")`) ; `docs/arbitrages.md:4825`.
  - Effet pour l'utilisateur : un formulaire qu'on remplit pour rien.
  - Correctif proposé : conditionner les deux blocs à la capacité exigée par leur route (même lecture `peut(...)`).
  - Couverture : NOUVEAU.

- **IN-30** — **Planifier dans le passé : accepté sans un mot** — Gravité : Mineur — Nature : Écart à arbitrer (règle absente, §8)
  - Constat : ni le champ date (pas de `min`) ni la pose ne regardent si la date est passée.
  - Preuve : `page.tsx:881-886` ; `lib/interventions/pose.ts` (aucun contrôle de date passée).
  - Effet pour l'utilisateur : une faute de saisie crée une intervention immédiatement « en retard ».
  - Correctif proposé : **Arrêt §8** (règle absente) — avertissement (jamais un refus sans règle écrite) « Cette date est passée ».
  - Couverture : NOUVEAU.

- **IN-31** — **Rendu de la fiche : huit allers-retours séquentiels vers la base** — Gravité : Mineur — Nature : Ergonomie (performance)
  - Constat : techniciens actifs, annuaire, absences du jour, absences de la fenêtre, machines du site, données matériel s'enchaînent en `await` successifs alors que plusieurs sont indépendants (base à Sydney).
  - Preuve : `page.tsx:325-333`, `:334-340`, `:364-371`, `:408-415`, `:454-456`, `:468-471`, `:485-491`.
  - Effet pour l'utilisateur : fiche plus lente à s'ouvrir depuis Nouméa.
  - Correctif proposé : regrouper les lectures indépendantes dans un `Promise.all` (comme le registre, lot PERF).
  - Couverture : NOUVEAU.

- **IN-32** — **Reprendre une suspendue « héritée » datée sans durée → « réessayez »** — EN FILE (PG-A4, variante à ajouter au ticket) — `lib/interventions/depot.ts:2395-2401` repasse en `planifiee` sans durée ; contrainte `intervention_planifiee_a_sa_duree` (`prisma/migrations/20260923130000_parcours_1_creer_puis_planifier/migration.sql:131-134`).

- **IN-33** — **« Planifier » : « Heure de début (laisser vide pour une journée sans heure) » sous « les quatre valeurs se donnent ensemble »** — EN FILE (QG-4 tranché, PG-A3b) — toujours vrai : `page.tsx:878`, `:900-905` ; `lib/i18n/fr.ts:1494-1495`.

- **IN-34** — **« Clôturer » replié sur une « À planifier »** — DÉJÀ COUVERT (G9, amendement D120 du 26/09 : replier, pas retirer) — toujours vrai : `page.tsx:1029-1040`, `lib/interventions/action-principale.ts:44-53` ; le serveur refuse (`cycle-de-vie.ts:91-93`, temps nul). Le retirer contredirait l'amendement : à arbitrer avec IN-15.

---

## /interventions/[id]/bon

- **IN-35** — **Le bon remis au client imprime les montants, selon qui l'imprime** — Gravité : Majeur — Nature : Écart à arbitrer (arbitrage 3.8)
  - Constat : pour DIR, RM, RS, ADV, la section « Valorisation » (taux, forfait, total HT) s'imprime ; pour un technicien ou `admin_societe`, elle est masquée. Le même bon sort donc en deux versions. L'arbitrage 3.8 exclut tout montant du rapport remis au client ; D-S4 (Projet) envoie le bon AVEC la facture Winpro, qui porte les montants.
  - Preuve : `app/(back-office)/interventions/[id]/bon/page.tsx:269-306` (`print:hidden` seulement si `!montants.montre`) ; `docs/arbitrages.md:530` « Aucun montant ni sur le rapport PDF, ni sur le portail client en V1 » ; `docs/propositions/16-BON-1/passation.md:36-40`.
  - Effet pour l'utilisateur : un client peut recevoir un bon chiffré, un autre non, et un taux horaire imprimé.
  - Correctif proposé : **Arrêt §8 (ce que le client voit)** — (a) aucun montant à l'impression, section visible à l'écran seulement ; (b) deux versions nommées (« interne » chiffrée / « client » sans montant).
  - Couverture : NOUVEAU.

- **IN-36** — **« Adresse » : la rue ne peut être saisie nulle part** — Gravité : Mineur — Nature : Donnée
  - Constat : le bon lit `site.adresse.rue` et `site.commune`. Aucun formulaire de site ne porte de champ adresse ; le modèle d'import « Sites » déclare une colonne « Adresse » mais ne l'applique pas. « Adresse — » signifie : site sans commune (la rue est toujours vide).
  - Preuve : `lib/interventions/bon.ts:335-346` ; `lib/imports/modeles.ts:407`, `:510` (colonne déclarée), `:414-419` (non appliquée), `:425-427` (« aucune forme n'est fixée ») ; grep `adresse` sous `app/(back-office)/sites` et `app/api/sites` : aucune occurrence.
  - Effet pour l'utilisateur : la ligne ajoutée par BON-3 reste vide ; l'adresse contenue dans un fichier d'import est ignorée sans le dire.
  - Correctif proposé : champ « Adresse » sur la fiche site et application de la colonne d'import (forme libre `{ rue }`, déjà lue par le bon), ou retrait de la ligne ; signaler au rapport d'import que la colonne n'est pas reprise.
  - Couverture : NOUVEAU.

- **IN-37** — **Bon rendu dans la coque ; imprimé par le menu du navigateur, il emporte la barre latérale ; titre = raison sociale** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la route vit sous `app/(back-office)/` (barre latérale) ; l'isolement à l'impression n'existe que si l'on clique « Imprimer le bon » (classe posée par JavaScript) ; `Ctrl+P` ou « Imprimer » du téléphone imprime tout l'écran. La page n'utilise pas `Page` : `<h1>` = raison sociale, pas de `<main id="contenu">` (le lien d'évitement ne mène nulle part).
  - Preuve : `app/(back-office)/layout.tsx:45-78` ; `components/interventions/actions-bon.tsx:22-30` ; `app/globals.css:471-499` (règles sous `body.print-bon` seulement) ; `bon/page.tsx:142`, `:156-158` ; `components/mise-en-page/page.tsx:121`.
  - Effet pour l'utilisateur : un bon mal imprimé depuis un téléphone ou une tablette.
  - Correctif proposé : mise en page d'impression dédiée (groupe de routes sans coque) ou règle `@media print` générique ; à l'écran, titre « Bon d'intervention <réf.> », raison sociale en en-tête du document.
  - Couverture : NOUVEAU.

- **IN-38** — **Ce que le bon ne dit pas : date de réalisation, place pour signer, document figé** — Gravité : Mineur — Nature : Écart à arbitrer (D-S2, décision du Projet)
  - Constat : la date imprimée est la date PLANIFIÉE, pas celle du travail ; sans signature numérique, la section est masquée à l'impression (aucune place pour signer sur papier) ; le bon est régénéré à chaque ouverture (taux relu), alors que D-S2 et le §0 de la passation stockage (16/09, Projet) veulent un document figé à la clôture.
  - Preuve : `bon/page.tsx:134-139`, `:386-388` ; `lib/interventions/bon.ts:226`, `:282` ; `claude/passation-stockage-documents.md` §0 et D-S2 (Projet) ; `docs/backlog.md:920-927` (L3-15 BLOQUÉ).
  - Effet pour l'utilisateur : un bon imprimé le lendemain d'une intervention décalée porte une date fausse et ne peut pas être signé.
  - Correctif proposé : date = premier segment (à défaut, date planifiée, dite comme telle) ; cadre « Signature du client » vide à l'impression quand aucune n'est recueillie ; figer le PDF à la clôture (L3-15). Reporter D-S2/D-S5 dans `docs/arbitrages.md`.
  - Couverture : figé/PDF : DÉJÀ COUVERT (backlog L3-15, BLOQUÉ) ; date et cadre de signature : NOUVEAU.

---

## /demandes

- **IN-39** — **Aucune demande ne peut naître** — DÉJÀ COUVERT (audit 26/09 G4 : « aucune demande ne peut encore arriver ») — confirmé par le code : `deposerDemande` n'a aucun appelant dans `app/` (exemption `scripts/lib/chemins-de-depot.ts:358-364`, « Ouvert par l'écran de dépôt du portail ») ; aucun autre `demande.create` dans le dépôt ni dans le semis. La page et la tuile du tableau de bord sont donc structurellement vides.

- **IN-40** — **Les demandes traitées disparaissent de toute liste** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la seule liste lit `nouvelle` et `qualifiee` ; une demande transformée ou close sans suite n'est plus atteignable que par un lien direct (retour depuis une intervention issue).
  - Preuve : `lib/demandes/depot.ts:364-378` « where: { statut: { in: ["nouvelle", "qualifiee"] } } » ; `app/(back-office)/demandes/page.tsx:89-90`.
  - Effet pour l'utilisateur : impossible de retrouver « les demandes closes au téléphone ce mois-ci », alors que ce motif « mesure le service rendu à distance ».
  - Correctif proposé : onglets « À traiter » / « Traitées » (même lecture, filtre de statut), paginés.
  - Couverture : NOUVEAU.

## /demandes/[id]

- **IN-41** — **Les quatre actions sont ouvertes à `creer_demande` (technicien, client) au lieu de « Qualifier / affecter »** — Gravité : Majeur — Nature : Écart à arbitrer (§5.2)
  - Constat : accuser réception, qualifier, marquer transformée et clore sans suite exigent `creer_demande`, que portent aussi le technicien et le client. La matrice réserve « Qualifier / affecter » au bureau. La politique de `demande` n'a pas de clause par commande : un compte portail pourrait, par une requête, accuser réception de sa propre demande (l'horodatage qui mesure le standard des 30 minutes) ou la clore.
  - Preuve : `app/api/demandes/[id]/accuser/route.ts:27`, `…/qualifier/route.ts:20`, `…/transformer/route.ts:25`, `…/clore/route.ts:26` « exigerCapacite("creer_demande") » ; `lib/auth/habilitations.ts:116-117` ; `docs/cahier-des-charges.md:273-274` ; `prisma/migrations/20260913140000_demande_l2_06/migration.sql:146-174` (politique sans `FOR`, `GRANT … UPDATE`).
  - Effet pour l'utilisateur : la mesure de réactivité peut être faussée et une demande qualifiée ou close par qui ne devrait pas.
  - Correctif proposé : **Arrêt §8 (droits, portail)** — qualifier, transformer, clore sous `qualifier_affecter` ; accuser réception : bureau seulement (à confirmer par Alexis) ; scénario d'isolation « client → accuser » refusé.
  - Couverture : NOUVEAU.

- **IN-42** — **La création « depuis cette demande » n'est pas tenue : n'importe quel statut passe, et la demande reste dans la file** — Gravité : Mineur — Nature : Bug déduit
  - Constat : `creerIntervention` ne vérifie que la société et le site de la demande, jamais son statut : une demande nouvelle (non qualifiée), transformée ou close peut engendrer une intervention par l'URL `?demande=`. Après création, la demande reste « qualifiée » (dans la file et au compteur du tableau de bord) jusqu'au geste manuel « Marquer comme transformée ».
  - Preuve : `lib/interventions/depot.ts:369-377` ; `lib/demandes/depot.ts:403-417` (lecture sans statut) ; `app/(back-office)/interventions/nouvelle/page.tsx:138-143` ; `app/(back-office)/demandes/[id]/page.tsx:369-375`.
  - Effet pour l'utilisateur : deux gestes pour un seul fait, et une demande close peut réapparaître comme origine d'une intervention.
  - Correctif proposé : refus nommé si la demande n'est pas « qualifiée » ; à arbitrer : marquer la demande transformée dans la même transaction que la création liée (fusion des deux gestes, cycle 3.5 inchangé).
  - Couverture : NOUVEAU (double geste : relevé en G4 du 26/09 sous l'angle inverse).

- **IN-43** — **Deux textes contredisent l'écran** — Gravité : Mineur — Nature : Incohérence
  - Constat : (1) « Qualifiez la demande … c'est la qualification qui décide de la nature, de la durée et de l'affectation » — « Qualifier » est un bouton sans aucun champ ; (2) « Créez-la depuis le bouton ci-dessus, avant ou après avoir marqué cette demande transformée » — une fois transformée, ce bouton disparaît.
  - Preuve : `lib/i18n/fr.ts:1742-1743`, `:1788-1789` ; `app/(back-office)/demandes/[id]/page.tsx:385-389`, `:369-375`.
  - Effet pour l'utilisateur : on cherche où qualifier, et on marque « transformée » en croyant pouvoir créer ensuite.
  - Correctif proposé : réécrire le refus pour dire ce que fait réellement le geste (« Qualifiez d'abord la demande : elle passe alors dans la file à transformer »), ou fusionner « Qualifier » avec la création (IN-42, à arbitrer — le statut QUALIFIEE de 3.5 ne change pas) ; note : « Créez l'intervention avant de marquer la demande transformée ».
  - Couverture : NOUVEAU.

- **IN-44** — **Motif de « Clore sans suite » présélectionné : « Résolue par téléphone »** — Gravité : Mineur — Nature : Donnée
  - Constat : le `<select>` n'a pas d'option vide ; le refus « Choisissez un motif » ne peut jamais s'afficher.
  - Preuve : `app/(back-office)/demandes/[id]/page.tsx:415-428` ; `lib/demandes/saisie.ts:56-61` ; `lib/i18n/fr.ts:1723-1724`.
  - Effet pour l'utilisateur : la statistique du « service rendu à distance » se gonfle par défaut.
  - Correctif proposé : option vide « — Choisir le motif — » requise (comme GR1).
  - Couverture : NOUVEAU.

- **IN-45** — **Refus rouges pour des actions sans objet (« déjà qualifiée », « devenue une intervention » ×3)** — DÉJÀ COUVERT (chantier C5 ⚠) — toujours vrai : `app/(back-office)/demandes/[id]/page.tsx:492-500`.

---

## /tableau-de-bord

- **IN-46** — **« Interventions aujourd'hui » et « Urgences » comptent les annulées ; la vue Jour liée les masque** — Gravité : Mineur — Nature : Bug déduit
  - Constat : le tableau de bord appelle `listerPlanning` sans option : les annulées sont incluses par défaut (choix de PG-A8 pour ne pas toucher cet appelant). Les « Urgences » retiennent toute P1 du jour, annulée ou clôturée comprise. Le planning, lui, les masque par défaut.
  - Preuve : `app/(back-office)/tableau-de-bord/page.tsx:248`, `:277-281` ; `lib/interventions/depot.ts:1580-1590`, `:1623` « filtreStatutAnnulee(options?.inclureAnnulees ?? true) » ; `app/(back-office)/tableau-de-bord/presentation.ts:305-306` ; `app/(back-office)/planning/page.tsx:187`, `:388`.
  - Effet pour l'utilisateur : la tuile annonce N interventions, la journée du planning en montre moins ; une P1 annulée reste « urgence ».
  - Correctif proposé : `listerPlanning(…, { inclureAnnulees: false })` ici ; « Urgences » limitées aux statuts non terminaux.
  - Couverture : NOUVEAU.

- **IN-47** — **Tuile « VGP à prévoir » : le chiffre et la liste ouverte ne comptent pas la même chose** — Gravité : Mineur — Nature : Incohérence
  - Constat : le chiffre additionne dépassées et à venir sous 30 jours ; le lien ouvre les seules dépassées.
  - Preuve : `tableau-de-bord/page.tsx:370-384` ; `tableau-de-bord/presentation.ts:157-159` ; `app/(back-office)/vgp/page.tsx:161`, `:269-278`.
  - Effet pour l'utilisateur : « 12 » sur la tuile, 9 lignes dans la liste.
  - Correctif proposé : deux liens (dépassées / à venir) ou un filtre « à prévoir » qui réunit les deux.
  - Couverture : NOUVEAU.

- **IN-48** — **« Demandes en attente de qualification » compte aussi les demandes déjà qualifiées** — Gravité : Mineur — Nature : Incohérence
  - Preuve : `lib/i18n/fr.ts:3038-3039` ; `lib/demandes/depot.ts:372`.
  - Effet pour l'utilisateur : libellé inexact (sans effet aujourd'hui : IN-39).
  - Correctif proposé : « Demandes ouvertes », ou compter les seules nouvelles.
  - Couverture : NOUVEAU.

- **IN-49** — **« Priorités opérationnelles » : pas d'âge, pas de client sur les pièces, pas de borne, une clé morte** — Gravité : Mineur — Nature : Ergonomie
  - Constat : les lignes « Pièce attendue » n'ont ni client ni site (titre générique) ; les « À planifier » n'ont pas d'âge (IN-27) ; la liste n'est pas bornée ; `tableau_de_bord.priorite_demande_titre` n'est utilisée nulle part ; pas de ligne « En retard ».
  - Preuve : `tableau-de-bord/presentation.ts:331-342`, `:364-376` ; `tableau-de-bord/page.tsx:292-296` ; `lib/i18n/fr.ts:3059` (aucune occurrence hors `fr.ts`).
  - Effet pour l'utilisateur : une ligne « Pièce attendue » ne dit pas chez qui.
  - Correctif proposé : titre « Pièce <réf.> — <client> » (jointure client dans `enAttenteDePiece`) ; « créée il y a N j » ; borne d'affichage + « Tout voir » (nombre à fixer par Alexis) ; retirer la clé morte.
  - Couverture : « En retard » EN FILE (PG-C1b) ; le reste NOUVEAU.

- **IN-50** — **« Planifiées sans durée prévue » compte des « À planifier »** — EN FILE (audit 27/09 I-5, PG-A6) — toujours vrai : `lib/i18n/fr.ts:3066-3067` ; `lib/interventions/depot.ts:1737-1745`.

- **IN-51** — **« Voir la semaine dans les blocages d'agenda »** — EN FILE (QG-8 tranché, PG-E3 « Absence » partout) — toujours vrai : `lib/i18n/fr.ts:3045-3046`.

---

## Effets de bord hors groupe (pour les agents concernés)

- `dernieresInterventionsDuSite` (et la première page de `dernieresInterventionsDuClient`) : `orderBy … nulls: "last"` puis `take` — les « À planifier » sont coupées par la borne alors que la fiche annonce « celles qui restent à planifier en bas » (`lib/interventions/depot.ts:2743-2754`). Cause probable du constat en ligne sur la fiche site/client.
- `marquerVuParTechnicien` sur une intervention annulée ou clôturée non encore vue : même déclencheur que IN-17 (écriture refusée) — côté `/terrain`, à vérifier par le groupe terrain.

---

## Évolutions proposées pour ces pages

**/interventions/nouvelle**
- Ajouter : `?client=` (recherche de site limitée au client, site présélectionné s'il est seul) — un clic et une recherche en moins depuis la fiche client (IN-04).
- Retirer « Mode de valorisation » de la création, le poser à la qualification (« Planifier ») et le rendre modifiable jusqu'à la clôture — c'est RG-TAR-05 et la répartition des rôles du §5.2 (IN-01, Arrêt §8).
- Option vide pour « Priorité » (IN-02).
- Retour vers l'écran d'origine, relayé jusqu'à la fiche créée (IN-05, IN-21 ; chantier C6).
- Déjà en file : durée prévue facultative (PG-B6), « Machine à l'arrêt » (PG-E4).

**/interventions (registre)**
- Ajouter : colonne « Ancienneté » (À planifier, Bloquées), ordre propre à chaque onglet (IN-09), motif affiché quand la recherche est invalide (IN-07), sélecteur 50/100/200 lignes, lignes denses sur une ligne (hauteur actuelle ≈ 4 570 px).
- Ajouter (en file) : onglets « À venir » et « En retard » (PG-C1c).
- Retirer : « Affectée », « Terminée » et « À contrôler » tant que ces statuts sont inatteignables — ou les rendre atteignables (IN-11, IN-14, PG-E1).
- Restreindre le registre du technicien à ses interventions (IN-06, Arrêt §8).

**/interventions/[id]**
- Fusionner « Réalisation », « Pauses » et « Chronologie » en une seule chronologie datée (segments, pauses, clôture), enrichie des événements de planification déjà proposés à l'audit 27/09 §4.4 — une fiche qui se lit de haut en bas.
- Ajouter : « créée il y a N j » pour une À planifier (IN-27), « Modifier le mode de valorisation » jusqu'à la clôture (IN-01), refus nommé « un compteur tourne encore » (IN-17), courriel d'annulation (IN-19).
- Retirer (après arbitrage D8) : les blocs hors matrice — Suspendre avant démarrage, Clôturer hors « Terminée », Annuler une clôturée (IN-15, IN-16).
- Historique repris : masquer Réalisation/Pauses vides, bandeau « Reprise de l'archive du jj/mm/aaaa », « — » au lieu des valeurs par défaut, montant d'archive (IN-23, IN-24).
- Libellé sur la note interne, `min`/`step` sur les champs numériques, options vides explicites (IN-22, IN-25, IN-28).

**/interventions/[id]/bon**
- Sortir le bon de la coque et imprimer proprement quel que soit le geste (IN-37).
- Aligner sur 3.8 : aucun montant sur la version client (IN-35, Arrêt §8).
- Ajouter : champ « Adresse » sur la fiche site (ou retirer la ligne), date de réalisation, cadre de signature papier (IN-36, IN-38).
- Plus tard : PDF figé à la clôture, envoyé avec la facture (D-S2/D-S4, L3-15).

**/demandes et /demandes/[id]**
- Tant qu'aucune demande ne peut naître : dire pourquoi sous le titre, ou masquer l'entrée de menu et la tuile — ÉCART À ARBITRER (D133 ; tuile « Demandes » gardée par Alexis le 25/09).
- Fusionner « Qualifier » et « Créer l'intervention depuis cette demande », et marquer la demande transformée à la création liée (IN-42, IN-43) — à arbitrer (L2-06, 3.5).
- Ajouter : onglet « Traitées » (IN-40), âge et état de l'accusé dans la file, option vide du motif de clôture (IN-44).
- Garder les actions sous `qualifier_affecter` (IN-41, Arrêt §8).

**/tableau-de-bord**
- Exclure les annulées de « Interventions aujourd'hui » et des « Urgences » (IN-46).
- Tuile VGP : deux liens ou un filtre réunissant les deux voies (IN-47).
- « Ouvrir » → `?depuis=tableau-de-bord` (IN-21).
- Lignes de priorité : client sur les pièces, âge sur les À planifier, borne + « Tout voir » (IN-49).
- En file : tuile « En retard » (PG-C1b), libellé « sans durée » (PG-A6), jour fermé → prochain jour ouvré (audit 27/09 §4.1).

---

## Observations en ligne : confirmées / réfutées

1. Retour « ← Retour au planning » depuis site, machine, client — **CONFIRMÉE** : `nouvelle/page.tsx:246-250` (DÉJÀ COUVERT, 26/09 M4).
2. « Mode de valorisation » sans option vide, valeur imposée — **CONFIRMÉE** : `nouvelle/page.tsx:320-326` (« Temps passé ») ; touche l'argent : oui (RG-TAR-05, `valorisation.ts:266-277`) → IN-01.
3. Priorité par défaut — **P3 — normale** (`nouvelle/page.tsx:317`, `saisie.ts:169`) ; depuis une demande : l'urgence de la demande (`:224-226`) → IN-02.
4. La page reçoit-elle `?client=` ? — **NON, CONFIRMÉ** : aucun `params.client` (`nouvelle/page.tsx:127-234`) → IN-04.
5. Clôturée importée : « le compteur n'a pas encore tourné » — **CONFIRMÉE** : texte indépendant du statut (`[id]/page.tsx:1427-1430`) → IN-23.
6. Bloc « Annuler » sur une Clôturée — **CONFIRMÉE** (`[id]/page.tsx:821-856`) ; le serveur **ACCEPTE** (`cycle-de-vie.ts:186-191`, déclencheur `…d120/migration.sql:163`) → contraire à D8 « CLOTUREE est terminal » → IN-16.
7. Chronologie « Enregistrée dans CODIPLAN <date d'import> » — **CONFIRMÉE, voulue** (`interventions/presentation.ts:860-871`) ; mais la clôture importée s'affiche à 11:00, heure inventée → IN-23.
8. « Clôturer » proposé sur une À planifier — **CONFIRMÉE** (replié, D120 amendé) ; le serveur refuse (temps nul) → IN-34.
9. « Les quatre valeurs… » à côté de « laisser vide pour une journée sans heure » — **CONFIRMÉE** (EN FILE, PG-A3b) → IN-33.
10. Note interne sans libellé — **CONFIRMÉE** (`[id]/page.tsx:1620-1625`) → IN-25.
11. « 90 prochains jours » — **CONFIRMÉE** : constante d'écran (`[id]/page.tsx:152`), reprise de `/absences` (« pas des durées métier »), écrite dans aucune règle ni arbitrage → IN-26.
12. Aucun indicateur d'ancienneté — **CONFIRMÉE** : ni fiche, ni registre, ni tableau de bord (l'âge n'y figure que pour les pièces) ; le planning trie par ancienneté sans l'afficher → IN-27.
13. Bon rendu dans la coque — **CONFIRMÉE** (route sous `app/(back-office)/`) ; h1 = raison sociale — **CONFIRMÉE** (`bon/page.tsx:156-158`) → IN-37.
14. « Votre rôle ne donne pas accès aux montants de vente » pour `admin_societe` — **CONFIRMÉE et conforme** : D37 et §5.2 (« Voir les montants de vente » : admin société « — » ; DIR, RM, RS, ADV « ● ») ; D131 ne traite pas des montants (`montants-visibles.ts:76-83`, `habilitations.ts:157`).
15. « Adresse — » — **CONFIRMÉE** : `site.commune` vide et `site.adresse.rue` impossible à saisir (aucun champ, colonne d'import ignorée) → IN-36.
16. À quoi sert le bon — impression navigateur par le bouton « Imprimer le bon » ; ni PDF, ni envoi, ni signature sur papier ; imprimable proprement seulement par ce bouton → IN-37, IN-38 ; montants imprimés selon le rôle → IN-35.
17. Registre : 4 570 px, textes < 12 px, tableau de 920 px — **CONFIRMÉE par le code** (50 lignes, `text-[11px]`, `minimum="920px"`) — GR18 en file → IN-13.
18. Registre : tri par défaut — date planifiée décroissante, file d'attente en dernière page → IN-09 ; filtres : huit statuts dont trois choix toujours vides → IN-11 ; pagination 50 + précédent/suivant, filtre « sans durée » perdu → IN-10.
19. Registre : lignes qui disparaissent — seulement le client inactif (D129, case « Inclure… ») ; agence inactive et annulées restent affichées — **RÉFUTÉ pour agence et annulées**. Mais un technicien voit toutes les lignes → IN-06.
20. Tableau de bord : deux interventions de test — **CONFIRMÉE**, geste d'exploitation (DÉJÀ COUVERT, audit 27/09 R-a).
21. « Voir la semaine dans les blocages d'agenda » — **CONFIRMÉE** (EN FILE, PG-E3) → IN-51.
22. Tuile ↔ liste : **CONFIRMÉ pour** « Dossiers bloqués » (onglet Bloquées), « Demandes » (même lecture), « sans durée » (même critère) ; **RÉFUTÉ pour** « Interventions aujourd'hui » (annulées, IN-46), « VGP » (IN-47) et « Techniciens indisponibles » (lien vers une semaine, choix écrit de 98-TABLEAU-2).
23. Fuseau « aujourd'hui » à Nouméa — **RÉFUTÉ (aucun défaut)** : fuseau de la société, `maintenant(fuseau)` puis `instantDuJour` (`tableau-de-bord/page.tsx:224-236`) ; aucun `CURRENT_DATE` dans le groupe.
24. « Priorités opérationnelles » — P1 du jour (annulées comprises, IN-46), pièces attendues (sans client), toute la file « À planifier » triée P1→P4 ; ni retard, ni âge → IN-49.
25. `/demandes` vide, aucune saisie au bureau — **CONFIRMÉE et structurelle** : `deposerDemande` n'a aucun appelant, même pas au portail (IN-39).
26. Parcours qualifier → transformer — Qualifier = bascule de statut sans saisie ; création par `/interventions/nouvelle?demande=` ; « Marquer comme transformée » = second geste manuel (IN-42, IN-43).
27. `/demandes/[id]` : états (Nouvelle bleu, Qualifiée orange, Transformée vert, Close gris), actions (créer — si qualifiée —, accuser, qualifier, marquer transformée avec confirmation si aucune intervention, clore avec motif présélectionné) ; textes contradictoires → IN-43, IN-44 ; droits → IN-41.
