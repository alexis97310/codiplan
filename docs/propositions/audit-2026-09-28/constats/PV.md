# Audit PV — Parc machines, fiche machine, VGP, identifiant / QR / étiquette

*Partie « code » de l'audit du 28/09/2026. Dépôt `/home/claude/codiplan`, commit `bcc637e`, lu en LECTURE SEULE (aucun fichier modifié, aucun serveur, aucune base). Preuves = `fichier:ligne` à ce commit. « DÉDUIT » = constat tiré du code, non vu en ligne. Les observations en ligne viennent de la consigne et des notes du 28/09 (`notes-live-28-09.md`). Aucune donnée de production nommée : « client A », « technicien 1 ».*

Pages : `/parc`, `/parc/[id]`, `/parc/[id]/modifier`, `/parc/nouvelle`, `/vgp`, `/vgp/a-determiner`, `/vgp/enregistrer/[id]`, identifiant machine / QR / étiquette, scan et fiche terrain (`app/(mobile)/terrain/**`).

---

## /parc

- **PV-01** — **Machines remplacées, ferraillées, fusionnées : mêlées au parc par défaut, impossibles à isoler** — Gravité : Majeur — Nature : Écart à arbitrer (D28, RG-PAR-05)
  - Constat : le filtre n'offre que 3 statuts ; « Tous les statuts » (défaut) n'applique AUCUN filtre de statut, donc les 3 statuts terminaux sont listés et comptés (« Machines affichées », « sur N au total »). On ne peut pas les isoler : `?statut=remplacee` fait échouer la validation et rend 0 ligne. À l'inverse, la fiche site et la fiche client les excluent (« équipements actifs ») : pour un même site, `/parc?site=` et la fiche ne comptent pas la même chose. Impact actuel limité : le gabarit « Équipements » n'importe aucun statut (toute machine importée est « En service »).
  - Preuve : `lib/machines/depot.ts:277-278` `criteres.statut === "tous" ? {} : { statut: criteres.statut }` ; `lib/machines/saisie.ts:197-202` (4 valeurs) ; `lib/machines/depot.ts:725-728` et `:793-797` (`statut: { notIn: [...STATUTS_HORS_PARC_ACTIF] }`) ; D28, `docs/arbitrages.md:452` : « ses LECTEURS sont … les listes du parc, qui l'excluent ».
  - Effet pour l'utilisateur : une machine sortie du parc reste visible et comptée comme présente chez le client.
  - Correctif proposé : par défaut, exclure `STATUTS_HORS_PARC_ACTIF` (critère unique déjà écrit) de la liste et des KPI ; ajouter l'option « Sorties du parc ». Conforme à D28, à confirmer par Alexis.
  - Couverture : NOUVEAU.

- **PV-02** — **« Agence CODIMA » : le nom d'une société écrit en dur dans un produit multi-société** — Gravité : Majeur — Nature : Incohérence
  - Constat : le libellé est composé `mot("agence")` + une clé dont la valeur est « CODIMA », sur l'aperçu et sur la fiche. Autres occurrences AFFICHÉES : le portail client (« Ce que CODIMA suit pour vous », « votre interlocuteur CODIMA ») — vues par les clients de TOUTE société, y compris la seconde société du semis. Non affichées aujourd'hui : les définitions du vocabulaire (« Établissement CODIMA — … »). `lib/imports/vgp.ts:132` n'est pas un libellé (valeur de fichier reconnue à l'import).
  - Preuve : `lib/i18n/fr.ts:2171` `"parc.kv_agence_suffixe": "CODIMA"` + `app/(back-office)/parc/page.tsx:544` ; `lib/i18n/fr.ts:2365` + `app/(back-office)/parc/[id]/page.tsx:360` ; `lib/i18n/fr.ts:133-134`, `:159-160` rendues par `app/(portail)/portail/page.tsx:125`, `:212` ; `lib/i18n/fr.ts:578-583` (aucune lecture de `.definition` hors `lib/i18n/vocabulaire.ts`).
  - Effet pour l'utilisateur : une autre société lirait « Agence CODIMA » ; ses clients liraient « CODIMA » sur leur portail (ce qu'un client voit).
  - Correctif proposé : « Agence » seul (`mot("agence")`), ou composé avec `societe.raison_sociale` lue sous contexte ; idem portail. Écart de CONTENU à la maquette, à nommer dans `lib/machines/ecarts-maquette.ts` (D128).
  - Couverture : NOUVEAU.

- **PV-03** — **La recherche annonce « l'identifiant » mais ne le cherche pas** — Gravité : Majeur — Nature : Bug déduit
  - Constat : sous-titre et champ promettent l'identifiant ; le filtre texte porte sur n° de série, client, site, commune, référence, marque, famille — ni `numero`/« Local-… », ni `reference_interne`. L'identifiant imprimé sur l'étiquette ne retrouve rien. Aggravant : un texte contenant « : » (« CODIPLAN:Local-… » recopié de l'étiquette) fait perdre tous les filtres au retour de la fiche.
  - Preuve : `lib/i18n/fr.ts:2106-2109` ; `lib/machines/depot.ts:208-271` (7 colonnes, aucune `numero` ni `reference_interne`) ; `app/(back-office)/parc/presentation.ts:80-82` (rejet en bloc de toute valeur contenant « : »).
  - Effet pour l'utilisateur : la seule référence visible sur la machine ne mène pas à sa fiche.
  - Correctif proposé : chercher `reference_interne` ; pour « Local-… », soit une recherche exacte reconstituée côté serveur (sur l'`id`, donc hors Prisma : décision), soit retirer « identifiant » des deux textes tant que la numérotation n'existe pas. Dans `retourVersParc`, ne rejeter « : » que pour les schémas d'URL.
  - Couverture : NOUVEAU.

- **PV-04** — **Libellés des quatre filtres hétérogènes** — Gravité : Mineur — Nature : Incohérence
  - Constat : « Filtrer par statut », « Filtrer par client », puis « Site », « Famille » ; l'option du filtre Site dit « Tous les lieux ».
  - Preuve : `lib/i18n/fr.ts:2111`, `:2118`, `:2120` ; `app/(back-office)/parc/page.tsx:376` (`mot("site")`), `:397` (`t("parc.famille")`).
  - Effet pour l'utilisateur : lecture hachée, deux mots pour le site.
  - Correctif proposé : « Statut », « Client », « Site », « Famille » ; « Tous les sites » composé depuis `mot("site", true)`.
  - Couverture : NOUVEAU (GR10 a rendu les libellés visibles ; ce constat porte sur leur texte).

- **PV-05** — **Aperçu « Derniers événements » : l'intervention sans date passe en tête, sans statut ni lien** — Gravité : Mineur — Nature : Incohérence
  - Constat : la frise prend les 3 premières lignes de l'historique trié `date_planifiee DESC` (NULL en tête sous PostgreSQL) ; chaque événement = nature + date, « — » sans date, jamais le statut. Une « Garantie » à planifier (« Garantie — ») ou une intervention planifiée la semaine prochaine s'affiche comme le « dernier » événement.
  - Preuve : `lib/machines/historique.ts:121` `orderBy: [{ date_planifiee: "desc" }, { numero: "desc" }]` ; `app/(back-office)/parc/page.tsx:563-568`, `:799-803`.
  - Effet pour l'utilisateur : « Garantie — » ne dit ni que c'est à faire, ni quand.
  - Correctif proposé : « À faire » (statut affiché) séparé des « Derniers événements » réalisés et datés ; chaque ligne mène à l'intervention.
  - Couverture : NOUVEAU (l'ordre lui-même : PV-15).

- **PV-06** — **À 375 px, « Fiche complète » déborde de l'aperçu** — Gravité : Mineur — Nature : Bug prouvé (vu en ligne, cause dans le code)
  - Constat : l'en-tête de l'aperçu est une rangée flex sans retour à la ligne ni `min-w-0` (symbole 58 px + référence + titre du modèle insécable + bouton).
  - Preuve : `components/ui/maitre-detail.tsx:197-216` `className="… flex items-start justify-between gap-4 …"` ; la bannière de la fiche, elle, passe en colonne : `app/(back-office)/parc/[id]/page.tsx:256` `max-[600px]:flex-col`.
  - Effet pour l'utilisateur : bouton rogné de 6 px.
  - Correctif proposé : `max-[600px]:flex-col` (ou `flex-wrap`) et `min-w-0 break-words` sur le bloc texte, comme la bannière.
  - Couverture : NOUVEAU.

- **PV-07** — **Téléphone : toucher une ligne recharge la page en haut ; l'aperçu reste sous une liste de 680 px** — Gravité : Majeur — Nature : Ergonomie (DÉDUIT)
  - Constat : sous 901 px le maître-détail passe en une colonne : la liste (hauteur max 680 px, défilement interne) précède l'aperçu ; la ligne est un lien `/parc?…&machine=<id>` sans ancre, la navigation revient en haut de page.
  - Preuve : `components/ui/maitre-detail.tsx:40` (`grid-cols-1`, deux colonnes à partir de 901 px), `:70` (`max-h-[680px] overflow-auto`) ; `app/(back-office)/parc/page.tsx:629-657` (`hrefDeLaLigne`, pas d'ancre).
  - Effet pour l'utilisateur : sur téléphone, le toucher semble ne rien faire.
  - Correctif proposé : sous 901 px, la ligne mène directement à la fiche (`/parc/<id>?retour=…`) ; sinon ancre `#apercu`. À vérifier en ligne.
  - Couverture : NOUVEAU (précise C3 de l'audit du 26/09).

- **PV-08** — **KPI « Garanties < 90 jours » : seuil repris de la maquette, rien derrière le chiffre** — Gravité : Majeur — Nature : Écart à arbitrer (CLAUDE.md §8 ; arbitrage VGP-4 du 25/09)
  - Constat : fenêtre de 90 jours en dur, commentée « (chapitre 11) » alors que le chapitre 11 n'en dit rien (elle vient du libellé de la maquette) ; le KPI n'est pas un lien et `garantie_fin` n'est affichée NULLE PART (ni aperçu, ni fiche) : impossible de savoir quelles machines il compte. Le même raisonnement a fait refuser les « 30 jours » de la maquette sur `/vgp` (VGP-4), mais le tableau de bord garde 30 jours pour les VGP (PV-35).
  - Preuve : `lib/machines/depot.ts:114-115` `/** 90 jours (chapitre 11) … */ const JOURS_GARANTIE = 90;` ; `app/(back-office)/parc/page.tsx:435-441` (Kpi sans lien) ; `docs/maquette/codiplan-maquette-complete.html:101` (« Garanties < 90 jours ») ; aucun « 90 » dans `docs/cahier-des-charges.md:774-1077`.
  - Effet pour l'utilisateur : un chiffre invérifiable.
  - Correctif proposé : fenêtre = valeur à fixer par Alexis (CLAUDE.md §8) ; KPI cliquable vers une liste filtrée ; « Fin de garantie » sur l'aperçu et la fiche (PV-17).
  - Couverture : NOUVEAU.

- **PV-09** — **KPI calculés sur 500 fiches au plus, sans le dire ; « fiches à compléter » accolé au total général** — Gravité : Mineur — Nature : Bug déduit
  - Constat : le résumé lit `take: 500` sans ordre ; au-delà, « En panne ou arrêtées » et « Garanties » portent sur un sous-ensemble arbitraire. Le détail « sur N machines au total · M fiches à compléter » accole un M du périmètre FILTRÉ au N du parc entier.
  - Preuve : `lib/machines/depot.ts:496-503` ; `lib/machines/saisie.ts:182` ; `app/(back-office)/parc/page.tsx:672-677`.
  - Effet pour l'utilisateur : sans effet aujourd'hui (un peu plus de 200 machines) ; faux en silence plus tard.
  - Correctif proposé : comptes agrégés (`groupBy` statut, `count` garantie) au lieu d'une lecture plafonnée ; « M fiches à compléter dans cette sélection ».
  - Couverture : NOUVEAU.

- **PV-10** — **Parc, fiches et registre VGP ouverts en entier à un technicien (et lisibles par un compte client)** — Gravité : Majeur — Nature : Écart à arbitrer (RG-DRO-02) — **Arrêt §8 (cloisonnement)**
  - Constat : aucune page du groupe ne vérifie `consulter_parc_complet` ; la politique RLS de `machine` ne restreint que les comptes portail ; le technicien (« ○ ») voit les entrées « Parc machines » et « VGP » et TOUT le parc. Un compte client qui tape l'URL obtient le back-office borné à son client, avec « Modifier », « + Machine », « Enregistrer » refusés seulement après l'envoi.
  - Preuve : `app/(back-office)/parc/page.tsx:138-145` (session + société seulement, idem `[id]`, `modifier`, `nouvelle`, `vgp/*`) ; `lib/auth/habilitations.ts:148` « Le périmètre lui-même relève du lot 2 » ; `lib/navigation/entrees.ts:525-526` + `lib/auth/habilitations.ts:197-199` (`peut` vrai pour « ○ ») ; `prisma/migrations/20260909150000_machine_l2_01/migration.sql:229-248`.
  - Effet pour l'utilisateur : RG-DRO-02 (machines de ses interventions + parc des clients visités sous 7 jours) n'est pas tenue.
  - Correctif proposé : décision d'Alexis — amender RG-DRO-02 (le technicien voit tout le parc) ou borner dans le dépôt comme `perimetreParPersonne`. À VÉRIFIER : un compte technicien de production ouvre-t-il le back-office (l'arrivée l'envoie vers `/terrain`, rien ne l'empêche d'ouvrir `/parc`).
  - Couverture : NOUVEAU.

- **PV-11** — **Lien « Registre des vérifications périodiques » entre la liste et sa pagination** — Gravité : Mineur — Nature : Ergonomie
  - Constat : justifié comme « seul appelant de /vgp » — faux depuis l'entrée de menu « VGP » ; le docblock de `/vgp` dit encore « n'est pas une entrée de la barre ».
  - Preuve : `app/(back-office)/parc/page.tsx:579-585` ; `lib/navigation/entrees.ts:327` (`nav.vgp`) ; `app/(back-office)/vgp/page.tsx:112-116`.
  - Effet pour l'utilisateur : un lien isolé entre la liste et « Page suivante ».
  - Correctif proposé : le retirer (et l'écart correspondant de `ECARTS_MAQUETTE_AJOUTS_PARC`).
  - Couverture : NOUVEAU.

## /parc/[id]

- **PV-12** — **VGP sur la fiche : « À déterminer » affiché à tort, aucune date, pas d'« Enregistrer » pour une machine jamais renseignée** — Gravité : Majeur — Nature : Écart à arbitrer (D88 §2) + Bug déduit
  - Constat : (1) sous le badge, `libelleEcheance(...) ?? "À déterminer"` : une machine de famille NON SOUMISE lit « Hors registre · À déterminer », une machine SOUMISE jamais renseignée « Sans information · À déterminer » — alors que la décision est prise dans les deux cas. (2) La fiche ne montre ni « sans information depuis X », ni la date de la dernière information reçue (le registre les montre). (3) « Enregistrer la vérification » n'apparaît que si l'échéance est connue : jamais pour « sans information », le cas de la première information.
  - Preuve : `app/(back-office)/parc/[id]/page.tsx:620` `{libelleEcheance(information) ?? t("machine.fiche.vgp_a_determiner")}` ; `:622` (`echeanceDepassee(information) || echeanceEstAVenir(information)`) ; `lib/vgp/libelles.ts:79-82` (`null` hors `information_recue`) ; D88 §2, `docs/arbitrages.md:2787` : « Chaque écran porte la date de la dernière information reçue … jamais blanc ».
  - Effet pour l'utilisateur : la fiche contredit le registre et ne permet pas de saisir la première vérification depuis la machine.
  - Correctif proposé : texte par état — hors registre → le régime (« Non soumis », « À déterminer », « Vérifié non soumis ») ; sans information → « Sans information depuis <date> » ou « depuis une date inconnue » ; information reçue → « Dernière information <date> » + échéance ; lien d'enregistrement dès que la machine est soumise.
  - Couverture : NOUVEAU.

- **PV-13** — **Colonne « Résultat » de l'historique = statut de l'intervention** — Gravité : Mineur — Nature : Incohérence
  - Constat : l'en-tête dit « Résultat », la cellule rend le statut (À planifier, Planifiée, Clôturée).
  - Preuve : `lib/i18n/fr.ts:2378` ; `app/(back-office)/parc/[id]/page.tsx:515-520` `{t(\`statut.${ligne.statut}\`)}`.
  - Effet pour l'utilisateur : « Résultat : À planifier ».
  - Correctif proposé : en-tête « Statut ».
  - Couverture : NOUVEAU.

- **PV-14** — « Aucun technicien affecté » sur les clôturées importées — DÉJÀ COUVERT (I-12, audit du 27/09) — toujours vrai : `lib/interventions/depot-reprise.ts:38-41` (technicien NUL), `app/(back-office)/parc/[id]/page.tsx:535-542`.

- **PV-15** — **Trois ordres d'historique pour la même question** — Gravité : Mineur — Nature : Incohérence
  - Constat : fiche machine et aperçu : `date_planifiee DESC` nu → lignes sans date EN TÊTE, départagées par `numero`, nul pour toutes les interventions (l'ordre des ex æquo n'est pas déterminé, contrairement au commentaire). Fiche site : `nulls: "last"` + 12 lignes → les « À planifier » passent après la 12e et disparaissent (vu en ligne : 4 ouvertes annoncées, 2 « À planifier » absentes). Fiche client : `nulls: "last"` paginé → en dernière page.
  - Preuve : `lib/machines/historique.ts:42-46`, `:121` ; `lib/interventions/depot.ts:2749-2753` (site, `take: limite`) + `app/(back-office)/sites/[id]/page.tsx:127` (`INTERVENTIONS_MONTREES = 12`) ; `lib/interventions/depot.ts:2597-2602` (client).
  - Effet pour l'utilisateur : on ne sait jamais où chercher ce qui reste à faire ; sur la fiche site, cela disparaît.
  - Correctif proposé : une règle écrite une fois : bloc « À faire » séparé, puis historique daté `nulls last`, ex æquo par `id`. L'ordre de la fiche machine est un choix commenté : à confirmer par Alexis.
  - Couverture : NOUVEAU.

- **PV-16** — **Bloc « Documents » : aucun chemin ne crée de document de machine ; « bien enregistrés » sous un tableau vide** — Gravité : Mineur — Nature : Incohérence
  - Constat : les seules écritures de `document` sont `classer` (bac de réception, sans écran) et `deposerPhotoIntervention` (cible intervention) ; aucun gabarit d'import de documents. En production le bloc est donc vide, suivi de « Le téléchargement des fichiers n'est pas encore disponible ; les documents listés ci-dessus sont bien enregistrés ». Les photos des interventions de la machine et les pièces des VGP n'y figurent pas.
  - Preuve : `lib/documents/depot.ts:190-219`, `:421-451` ; `scripts/lib/chemins-de-depot.ts:369`, `:375` (exemptions « écran du bac ») ; `app/(back-office)/imports/types.ts` (8 types, aucun document) ; `lib/i18n/fr.ts:2404-2405` ; `app/(back-office)/parc/[id]/page.tsx:442-444`.
  - Effet pour l'utilisateur : un bloc qui annonce une fonction absente.
  - Correctif proposé : note affichée seulement s'il y a des lignes ; sinon une ligne « Aucun document » ; ajouter (lecture seule) les photos des interventions de la machine.
  - Couverture : NOUVEAU.

- **PV-17** — **Faits réels absents de la fiche : fin de garantie, criticité, localisation, référence interne, facture d'origine** — Gravité : Mineur — Nature : Écart à arbitrer (D128)
  - Constat : ces colonnes sont lues, se saisissent (formulaire, import) et ne s'affichent ni sur la fiche ni sur l'aperçu ; la criticité n'est lue par aucune règle (priorité comprise).
  - Preuve : `lib/machines/depot.ts:56-96` (lues par `CHAMPS_PARC`) ; `app/(back-office)/parc/[id]/page.tsx:313-378` (11 paires, aucune de ces 5) ; `git grep criticite` → saisie, formulaire, import seulement ; D128 point 2, `docs/arbitrages.md:4697`.
  - Effet pour l'utilisateur : une donnée saisie qu'on ne relit plus ; « Garanties < 90 jours » invérifiable (PV-08).
  - Correctif proposé : ajouter ces paires APRÈS celles de D126 et de la maquette (ajout volontaire nommé, D128) ; l'usage de la criticité (priorité proposée ?) : règle à fixer par Alexis (§8).
  - Couverture : NOUVEAU.

- **PV-18** — **Aucun message après « Enregistrer » (création ou correction)** — Gravité : Mineur — Nature : Bug déduit
  - Constat : les routes et le formulaire renvoient vers `/parc/<id>?motif=machine.creee|modifiee` ; la fiche ne lit que `retour`.
  - Preuve : `app/api/machines/creer/route.ts:44`, `app/api/machines/[id]/modifier/route.ts:50`, `components/parc/formulaire-machine.tsx:200` ; `app/(back-office)/parc/[id]/page.tsx:154` `const { retour } = await searchParams;` (comparer `app/(back-office)/sites/[id]/page.tsx:305-319`).
  - Effet pour l'utilisateur : aucune confirmation, on ne sait pas si c'est enregistré.
  - Correctif proposé : bandeau de succès sur la fiche, comme `/sites/[id]`.
  - Couverture : NOUVEAU.

- **PV-19** — **Machine sortie du parc : bandeau d'alerte orange et « + Intervention » toujours proposés** — Gravité : Mineur — Nature : Incohérence (RG-PAR-05)
  - Constat : tout statut ≠ « En service » affiche le bandeau « ! » orange (Remplacée, Ferraillée, Fusionnée compris) ; « + Intervention » reste offert, et ni la création d'intervention ni la liste des machines d'un site ne regardent le statut de la machine.
  - Preuve : `app/(back-office)/parc/[id]/page.tsx:277-306`, `:385-397` ; `lib/interventions/depot.ts:353-360` (contrôle du site seul) ; `lib/machines/depot.ts:837-846` (`machinesDesSites`, sans filtre de statut).
  - Effet pour l'utilisateur : une machine ferraillée peut recevoir une intervention.
  - Correctif proposé : bandeau neutre « Sortie du parc » ; « + Intervention » masqué et refusé côté serveur pour les statuts terminaux — règle à confirmer par Alexis.
  - Couverture : NOUVEAU.

- **PV-20** — Titre h1 générique « Fiche machine » — DÉJÀ COUVERT (M5, audit du 26/09 : suit la maquette, laissé volontairement) — toujours vrai : `app/(back-office)/parc/[id]/page.tsx:224` ; l'onglet porte marque + référence (`:114-128`).

## Identifiant machine, QR, étiquette et scan terrain

- **PV-21** — **« Local-XXXXXX » : identifiant provisoire, imprimé sur l'étiquette, introuvable, et partagé avec les interventions** — Gravité : Majeur — Nature : Incohérence
  - Constat : « Local- » + 6 derniers caractères hexadécimaux de l'UUID tant que `numero` est nul ; aucun code n'attribue `numero` aux machines (lot 3 ; NUMERO-1 est décrit pour les interventions — À VÉRIFIER s'il couvre les machines). Dès qu'il le sera, l'écran affichera « MAC-000123 » : le texte imprimé sous la QR deviendra obsolète (la QR, elle, reste valable : elle porte le jeton). Ces 6 caractères = 24 bits aléatoires : deux machines peuvent partager le même code (calcul d'ordre de grandeur : ≈ 0,3 % de risque pour 300 machines, ≈ 3 % pour 1 000) ; le même format « Local-… » désigne aussi les interventions. « Copier l'ID » copie ce code, que la recherche ne trouve pas (PV-03).
  - Preuve : `app/(back-office)/parc/[id]/page.tsx:652-660` `return \`Local-${machine.id.replaceAll("-", "").slice(-6).toUpperCase()}\`;` (recopiée dans `app/(back-office)/parc/page.tsx:700-709` et `app/(back-office)/interventions/presentation.ts:63-71`) ; `lib/db/uuid.ts` (octets 6 à 15 tirés au sort) ; `prisma/schema.prisma:1458-1461` (« Aucun code ne l'attribue aujourd'hui ») ; `components/machines/actions-qr.tsx` (copie `identifiant`).
  - Effet pour l'utilisateur : une étiquette collée aujourd'hui porte un texte qui changera et qu'aucun écran ne retrouve.
  - Correctif proposé : ne plus imprimer l'identifiant provisoire (PV-23) ; décider AVANT toute campagne d'étiquetage si les étiquettes « Local- » seront réimprimées au jour de la numérotation ; une seule fonction `referenceMachine` (dans `lib/machines/presentation.ts`), préfixes au dictionnaire.
  - Couverture : EN FILE pour la numérotation (NUMERO-1 / lot 3) ; NOUVEAU pour l'étiquette et la collision.

- **PV-22** — **« Le scan ouvre directement la fiche autorisée » : faux — la QR contient un jeton brut et aucun écran ne la lit** — Gravité : Majeur — Nature : Bug prouvé (texte faux, vu en ligne)
  - Constat : la QR encode `qr_token` (26 caractères), pas une adresse : un appareil photo de téléphone n'affiche qu'un texte ; aucun écran, bureau ou terrain, ne lit une QR ; la seule résolution est `GET /api/machines/qr/{jeton}`, qui rend du JSON. La ligne « CODIPLAN:Local-XXXXXX » sous la QR laisse croire que c'est son contenu (c'est ce que l'observation en ligne a compris). D98 affirme que le chemin « depuis un QR code » existe.
  - Preuve : `components/ui/qr-code.tsx:69-70` `qr.addData(valeur)` avec `valeur={machine.qr_token}` (`app/(back-office)/parc/[id]/page.tsx:462-466`) ; `:470-473` + `lib/i18n/fr.ts:2388` (`"CODIPLAN:"` + référence) ; `lib/i18n/fr.ts:2385-2386` ; `app/api/machines/qr/[jeton]/route.ts:48` `return Response.json({ machine });` ; `lib/machines/ecarts-maquette.ts:55-58` ; `docs/backlog.md:893-894` (L3-11 BLOQUÉ) ; D98, `docs/arbitrages.md:3263`.
  - Effet pour l'utilisateur : l'étiquette promet un geste impossible ; scanner ne donne rien.
  - Correctif proposé : retirer la phrase (ou « Réservé à l'application terrain ») et le préfixe « CODIPLAN: ». À trancher AVANT l'impression en série (**Arrêt §8**, décision produit) : QR = jeton brut (lisible par la seule application) ou adresse portant le jeton (lisible par tout appareil photo ; I10 exige le jeton, jamais le numéro) — changer après coup impose de réimprimer tout le parc (le motif même de D71).
  - Couverture : EN FILE pour l'écran de scan (L3-11, bloqué) ; NOUVEAU pour le texte et le format de la QR.

- **PV-23** — **Étiquette imprimée : la carte entière, pleine page, sans désignation ni n° de série** — Gravité : Mineur — Nature : Ergonomie
  - Constat : « Imprimer l'étiquette » isole la carte QR (surtitre, titre, phrase de PV-22, QR, référence provisoire, ligne CODIPLAN) en pleine largeur de page ; rien ne permet de vérifier à l'œil qu'elle est collée sur la bonne machine.
  - Preuve : `app/globals.css:445-461` ; `app/(back-office)/parc/[id]/page.tsx:448-475` ; support d'impression = « question ouverte n° 6 », `docs/backlog.md:603`.
  - Effet pour l'utilisateur : une étiquette sans repère humain.
  - Correctif proposé : gabarit QR + marque référence + n° de série ; format et support = question n° 6, à trancher par Alexis.
  - Couverture : NOUVEAU.

- **PV-24** — **Terrain : la fiche d'intervention mobile ne montre pas la machine** — Gravité : Majeur — Nature : Ergonomie (DÉDUIT)
  - Constat : la page terrain affiche client, lieu, nature, date, statut — ni famille, ni marque, ni référence, ni n° de série (AFFICHAGE-MATERIEL-1 les a portés sur la carte du planning et la fiche bureau). Sans scan (PV-22), le technicien n'a aucun moyen d'identifier la machine visée.
  - Preuve : `app/(mobile)/terrain/[id]/page.tsx` ne lit que `fiche.client`, `fiche.lieu`, `ligne.type`, `ligne.date_planifiee`, `ligne.statut` (seule occurrence de « machine » : le commentaire l. 59) ; `lib/machines/depot.ts:641-681` (`donneesMaterielDesMachines` existe).
  - Effet pour l'utilisateur : sur un site à plusieurs machines, le technicien ne sait pas laquelle.
  - Correctif proposé : bloc « Matériel » (famille, marque référence, S/N) sur la fiche terrain, disponible hors ligne avec le reste (I4).
  - Couverture : NOUVEAU (à rattacher au lot terrain).

## /parc/[id]/modifier

- **PV-25** — **Impasse : aucun chemin ne change le statut, le site, le client ou le modèle** — Gravité : Majeur — Nature : Bug prouvé + Écart à arbitrer (RG-PAR-03, RG-PAR-05, RG-PAR-06)
  - Constat : le sous-titre renvoie à « la fiche pour ces gestes » ; la fiche n'en porte aucun et aucun code ne les écrit : la seule mise à jour de `machine` (`modifierMachineDans`) n'écrit ni statut, ni site, ni client, ni modèle, ni exception VGP, ni lien de remplacement. RG-PAR-03 (déménagement), RG-PAR-05 (sortie du parc) et RG-PAR-06 (lien de remplacement) n'ont aucun chemin ; un statut choisi à la création est définitif, et tout le parc importé reste « En service » (le gabarit n'a pas de colonne statut) — le KPI « En panne ou arrêtées » ne reflète que des choix de création.
  - Preuve : `lib/i18n/fr.ts:2423-2424` ; `lib/machines/depot.ts:1027-1047` ; `git grep "machine\.(update|updateMany|upsert)("` → `lib/machines/depot.ts:1032` et `prisma/seed.ts:966` seulement ; `app/api/machines/creer/route.ts:54-69` (`machine_remplacee_id` jamais lu) ; `lib/imports/modeles.ts:1102-1111`.
  - Effet pour l'utilisateur : le parc ne peut pas suivre la réalité ; les machines disparues restent au registre VGP, en tête des échéances dépassées (PV-30).
  - Correctif proposé : tout de suite, sous-titre vrai (« ne se corrigent pas encore ») ; ensuite, gestes datés sur la fiche : « Changer l'état », « Sortir du parc » (ferraillée : date + motif ; remplacée : machine remplaçante → RG-PAR-06), « Transférer » (site du même client d'abord ; changement de client = décision à part : garantie, contrat, portail). **Arrêt §8** : transitions, rôles et date à écrire au chapitre 10 par Alexis.
  - Couverture : EN FILE pour « En panne » par l'intervention (QG-10 / PG-E4) ; NOUVEAU pour le reste.

- **PV-26** — **« Connexion interrompue … Rien n'a été modifié » : le texte affirme ce que le code dit ignorer** — Gravité : Mineur — Nature : Incohérence (vaut aussi pour `/parc/nouvelle`)
  - Constat : sur coupure réseau, on ne sait pas si l'écriture a eu lieu ; le message affirme que rien n'a changé (un second envoi de création finira en « numéro de série déjà utilisé »).
  - Preuve : `components/parc/formulaire-machine.tsx:76-78` « On ne sait pas si l'écriture a été appliquée » ; `lib/i18n/fr.ts:2479-2480`.
  - Effet pour l'utilisateur : réessai à l'aveugle, puis refus incompréhensible.
  - Correctif proposé : « La réponse n'est pas arrivée : vérifiez la fiche (ou cherchez le n° de série) avant de réessayer. »
  - Couverture : NOUVEAU.

## /parc/nouvelle

- **PV-27** — **Statut à la création : « Remplacée » et « Ferraillée » sans date ni remplaçante ; « Fusionnée » accepté par le serveur** — Gravité : Mineur — Nature : Incohérence (D28, RG-PAR-06)
  - Constat : 5 valeurs à l'écran (fusionnée retirée côté écran seulement) ; une machine peut naître « Remplacée » sans lien de remplacement, ou « Ferraillée » ; un envoi forgé `statut=fusionnee` passe, alors que D28 réserve ce statut à la fusion (L3-10).
  - Preuve : `components/parc/formulaire-machine.tsx:352-363` ; `lib/machines/saisie.ts:64-73`, `:127` `statut: z.enum(STATUTS_MACHINE).default("en_service")` ; `app/api/machines/creer/route.ts:67` ; D28, `docs/arbitrages.md:452`.
  - Effet pour l'utilisateur : un état terminal saisi sans trace, et figé (PV-25).
  - Correctif proposé : à la création, les seuls états « en activité » ; `fusionnee` refusé côté serveur ; la sortie du parc devient un geste daté (PV-25).
  - Couverture : NOUVEAU.

- **PV-28** — **Défauts « En service » et « Normale » : hérités du schéma, jamais arbitrés ; la criticité n'a aucun effet** — Gravité : Mineur — Nature : Donnée / Écart à arbitrer (cahier M2)
  - Constat : défauts écrits 4 fois (schéma Prisma, Zod, formulaire, page) ; aucune décision ni règle du chapitre 10 ne les fixe (le chapitre 11 liste les valeurs sans défaut). Le cahier dit que la criticité « change l'ordre de priorité » ; elle n'est ni affichée, ni lue (PV-17).
  - Preuve : `prisma/schema.prisma:1487-1488` ; `lib/machines/saisie.ts:127-128` ; `components/parc/formulaire-machine.tsx:356` `defaultValue="en_service"` ; `app/(back-office)/parc/nouvelle/page.tsx:116` `criticite: "normale"` ; `docs/cahier-des-charges.md:370`, `:908-909`.
  - Effet pour l'utilisateur : « Normale » se lit comme une qualification que personne n'a faite.
  - Correctif proposé : décision d'Alexis sur l'usage de la criticité ; si elle doit compter, pas de défaut silencieux (choix obligatoire, ou valeur « non renseignée » = migration) — **Arrêt §8** (règle absente).
  - Couverture : NOUVEAU.

- **PV-29** — **Doublons de modèles à la casse ou aux espaces près : RG-PAR-01 contournable** — Gravité : Mineur — Nature : Bug déduit (À VÉRIFIER sur les données)
  - Constat : unicité modèle = (société, marque, référence) exacte ; unicité machine = (société, modèle, n° de série) exacte. « ABC 12 » et « abc 12 » font deux modèles, et la même machine peut exister deux fois ; le sélecteur montre deux lignes quasi identiques.
  - Preuve : `prisma/migrations/20260908170000_familles_et_modeles_l1_05/migration.sql:169-170` ; `prisma/migrations/20260909150000_machine_l2_01/migration.sql:139-140` ; `app/api/recherche/modeles/route.ts` (libellé « marque — référence (famille) »).
  - Effet pour l'utilisateur : doublons silencieux, historiques coupés en deux.
  - Correctif proposé : avertissement de quasi-doublon (casse, espaces, ponctuation) à la création d'un modèle ; liste « modèles à rapprocher » sur `/parametres/materiel` ; la fusion reste L3-10 (D28). Un index normalisé serait une migration : décision.
  - Couverture : NOUVEAU.

## /vgp

- **PV-30** — **Tête du registre = échéances de plusieurs années ; 200 lignes sans pagination ni compte ; les « sans information » repoussées hors d'atteinte** — Gravité : Majeur — Nature : Écart à arbitrer (arbitrage VGP-4 du 25/09 ; D88 §2)
  - Constat : tri arbitré « dépassées, la plus ANCIENNE en tête » : la tête est faite des échéances les plus vieilles (≈ 1 700 jours en ligne), qui ne peuvent pas quitter le registre faute de geste « sortie du parc » (PV-25) ; puis les à venir ; puis TOUT le reste (hors registre et sans information mêlés) par n° de série ; coupe à 200 sans « 200 sur N » ni pagination. En ligne, 155 lignes datées laissent 45 places pour plus de 60 machines : les dernières par n° de série n'apparaissent pas, sauf recherche.
  - Preuve : `lib/vgp/registre.ts:642-656` (`trierParUrgence`) ; `lib/vgp/registre.ts:137` `orderBy: [{ numero: "desc" }, { numero_serie: "asc" }]` ; `app/(back-office)/vgp/page.tsx:137` `LIGNES_AFFICHEES = 200`, `:291` ; `lib/i18n/fr.ts:2236-2237` (« Les premières lignes… », sans nombre) ; `docs/propositions/91-VGP-4-REPRISE/passation.md:8-18`.
  - Effet pour l'utilisateur : 15 000 px qui s'ouvrent sur ce qui ne sera pas traité ; l'état qui compte selon D88 est invisible.
  - Correctif proposé : pagination (contrat de `/parc`) et « N lignes sur M » ; vue par client / site (Évolutions) ; au sein des dépassées, ordre à ré-arbitrer par Alexis (la plus récente d'abord, ou un regroupement « dépassée depuis plus de … » dont le seuil est une valeur à fixer par Alexis, CLAUDE.md §8). Ne pas changer l'ordre sans lui (VGP-4).
  - Couverture : NOUVEAU.

- **PV-31** — **« Sans information » : aucune tuile, aucun filtre sur le registre (le tableau de bord, lui, le compte)** — Gravité : Majeur — Nature : Écart à arbitrer (D88 §2)
  - Constat : le résumé ignore les soumises jamais renseignées ; les tuiles sont À venir, Dépassées, Informations reçues, À déterminer ; `?etat=` ne connaît que dépassées / à venir. Le tableau de bord affiche « N sans information » et mène… aux dépassées.
  - Preuve : `lib/vgp/registre.ts:580-625` (`ResumeDuRegistre` sans voie « sans information ») ; `app/(back-office)/vgp/page.tsx:161`, `:317-363` ; `lib/vgp/registre.ts:448-451` (voie `sansInformation` du tableau de bord) ; `app/(back-office)/tableau-de-bord/page.tsx:381`.
  - Effet pour l'utilisateur : exactement « le registre à moitié rempli qui ressemble à un registre complet » (D88).
  - Correctif proposé : tuile « Sans information » + `?etat=sans_information` (même prédicat que `compterAPrevoir`, écrit une fois) ; la tuile du tableau de bord ouvre le filtre de la voie concernée.
  - Couverture : NOUVEAU.

- **PV-32** — **Machines sorties du parc et clients inactifs comptés dans le registre, ses KPI, le tableau de bord et la fiche site** — Gravité : Majeur — Nature : Écart à arbitrer (RG-PAR-05, D28 ; D129 muet)
  - Constat : `listerLeRegistre`, `compterAPrevoir`, `prochaineEcheanceDuSite`, `famillesADeterminer` ne filtrent ni le statut de la machine ni `client.actif`. RG-PAR-05 : une machine ferraillée ou remplacée « sort des échéanciers » ; D28 idem pour fusionnée ; D129 ne vise que le planning et `/interventions`.
  - Preuve : `lib/vgp/registre.ts:129-140` (aucun `where`), `:444-451`, `:251-258`, `:709-716`.
  - Effet pour l'utilisateur : « Échéances dépassées » gonflées par des machines hors d'usage ou de clients perdus (dès qu'un statut pourra être posé).
  - Correctif proposé : exclure `STATUTS_HORS_PARC_ACTIF` (critère unique) ; clients inactifs : question à Alexis.
  - Couverture : NOUVEAU.

- **PV-33** — **« Enregistrer » sur une ligne « Hors registre » : le serveur écrit, rien ne change à l'écran, aucun message** — Gravité : Mineur — Nature : Bug déduit
  - Constat : chaque ligne porte « Enregistrer », hors registre compris (la fiche machine, elle, ne le propose que si l'échéance est connue : deux règles). Le serveur ne regarde pas l'assujettissement : la vérification est écrite, mais `etatDeLInformation` rend « Hors registre » avant de lire l'information → ligne, KPI et fiche inchangés ; retour à `/vgp` sans confirmation → l'utilisateur recommence (aucune contrainte d'unicité, PV-45).
  - Preuve : `app/(back-office)/vgp/page.tsx:502-509` ; `lib/vgp/verification.ts:112-179` (aucune lecture de la famille) ; `lib/vgp/information.ts:125-130` ; `app/api/vgp/enregistrer/[id]/route.ts:63-66` `headers: { Location: "/vgp" }`.
  - Effet pour l'utilisateur : une saisie qui paraît perdue, puis des doublons.
  - Correctif proposé : une seule règle d'affichage du bouton (registre = fiche = rôle) ; pour une hors registre : masquer, ou avertir « enregistrée ; comptera si la famille devient soumise » — à trancher.
  - Couverture : NOUVEAU.

- **PV-34** — **Fiche site : « Prochaine VGP due » affiche une échéance dépassée comme à venir** — Gravité : Majeur — Nature : Incohérence (D88 §2) — vu en ligne (notes du 28/09 : date dépassée de 180 j, en gras neutre ; la fiche machine dit « Échéance dépassée »)
  - Constat : la fiche site retient la plus petite échéance, dépassées comprises, et l'affiche sous « Prochaine VGP due » sans ton ni mention ; « — » quand toutes les soumises du site sont sans information (« jamais blanc », D88).
  - Preuve : `lib/vgp/registre.ts:260-270` ; `app/(back-office)/sites/[id]/page.tsx:554-561` ; `lib/i18n/fr.ts:3662`.
  - Effet pour l'utilisateur : un retard présenté comme une échéance à venir.
  - Correctif proposé : réutiliser `tonEtat` / `libelleEtatCourt` / `libelleEcheance` (`lib/vgp/libelles.ts`) ; « N sans information » quand c'est le cas.
  - Couverture : NOUVEAU (page `/sites/[id]`, cohérence demandée pour ce groupe).

- **PV-35** — **« À venir » : 30 jours au tableau de bord, sans borne au registre** — Gravité : Mineur — Nature : Écart à arbitrer (CLAUDE.md §8 ; arbitrage VGP-4)
  - Constat : `HORIZON_VGP_JOURS = 30` en dur, alors que l'arbitrage du 25/09 a refusé ces 30 jours sur `/vgp` ; deux « à venir » différents ; la tuile ne mène qu'aux dépassées.
  - Preuve : `app/(back-office)/tableau-de-bord/page.tsx:55`, `:264`, `:381` ; `lib/vgp/registre.ts:303-309` (`echeanceEstAVenir`, non borné).
  - Effet pour l'utilisateur : deux chiffres « à venir » qui ne se recoupent pas.
  - Correctif proposé : un seul horizon — valeur à fixer par Alexis (CLAUDE.md §8) — ou aucun, partout.
  - Couverture : NOUVEAU.

- **PV-36** — **Message vide faux sous un filtre ou une recherche** — Gravité : Mineur — Nature : Bug déduit
  - Constat : une recherche ou un `?etat=` sans résultat affiche « Aucune machine n'est enregistrée pour cette société ».
  - Preuve : `app/(back-office)/vgp/page.tsx:438-442` ; `lib/i18n/fr.ts:2231-2232`.
  - Effet pour l'utilisateur : on croit le registre vide.
  - Correctif proposé : « Aucune ligne ne correspond » + « Voir tout le registre ».
  - Couverture : NOUVEAU.

- **PV-37** — **Recherche sur la « désignation » : cherchée mais jamais affichée ; marque, famille, site non cherchés** — Gravité : Mineur — Nature : Incohérence
  - Constat : la ligne montre n° de série, famille, client, site — pas le modèle ; la recherche porte sur n° de série, référence du modèle (sans la marque) et client. `/parc` cherche marque, famille, site.
  - Preuve : `lib/vgp/registre.ts:182` `modele: machine.modele.reference`, `:671-682` ; `app/(back-office)/vgp/page.tsx:459-472`.
  - Effet pour l'utilisateur : un résultat qui ne contient pas le texte cherché ; une marque ne trouve rien.
  - Correctif proposé : afficher « marque référence » (D126) et chercher les mêmes colonnes que `/parc`. Le n° de série brut « SN-INCONNU-… » affiché ici : DÉJÀ COUVERT (R-b, audit du 27/09), à étendre au registre.
  - Couverture : NOUVEAU.

- **PV-38** — **Badge « Hors registre » pour une famille « à déterminer »** — Gravité : Mineur — Nature : Écart à arbitrer (D88 §3)
  - Constat : `a_determiner` est rangé en `hors_registre` ; le badge gris est celui d'une famille non soumise ; seule l'infobulle « Voir le motif » distingue.
  - Preuve : `lib/vgp/information.ts:121-130` ; `lib/vgp/libelles.ts:133-136`.
  - Effet pour l'utilisateur : « un pont élévateur sortirait du registre en silence » (D88 §3).
  - Correctif proposé : badge « À déterminer » distinct (le calcul ne change pas).
  - Couverture : NOUVEAU.

- **PV-39** — **Texte de référence des régimes d'attente ; « mois » en dur ; texte de la tuile « Informations reçues »** — Gravité : Mineur — Nature : Donnée / Incohérence
  - Constat : (1) vu en ligne (référentiel matériel) : les familles soumises portent une référence du texte d'attente (« … à préciser ») ; la base l'accepte (non vide) mais D88 §4 exige le texte qui fonde la périodicité — et c'est lui que « Voir le motif » affiche sur chaque ligne. (2) « mois » est écrit dans le code de la page. (3) « Ce que les clients nous ont transmis » alors que l'origine peut être l'organisme ou une vignette constatée.
  - Preuve : `lib/vgp/assujettissement.ts:86-92` (seul contrôle : non nul) ; `app/(back-office)/vgp/page.tsx:535` `` `${ligne.periodiciteMois} mois — ${provenance}${texte}` `` ; `lib/i18n/fr.ts:2273` (`vgp.kpi_informations_recues_detail`).
  - Effet pour l'utilisateur : des échéances fondées sur un texte que personne ne peut défendre.
  - Correctif proposé : (1) donnée à compléter par Alexis ; (2) clé existante `materiel.vgp_mois` (`lib/i18n/fr.ts:2819`) ; (3) « Ce qui nous a été transmis, quelle qu'en soit l'origine ».
  - Couverture : NOUVEAU.

- **PV-40** — **Cibles tactiles < 32 px (401 relevées à 375 px)** — Gravité : Mineur — Nature : Ergonomie
  - Constat / Preuve : « Voir le motif » en texte 11,5 px (`app/(back-office)/vgp/page.tsx:493-500`) et « Enregistrer » en `py-1` (`:503-507`), une paire par ligne.
  - Effet pour l'utilisateur : registre inutilisable au doigt.
  - Correctif proposé : zones ≥ 32 px (même correction que 99B-FICHE-MACHINE) ; ou « Voir le motif » dans une vue détail.
  - Couverture : NOUVEAU (CG8 ne couvre que les cases à cocher ; GR18 vise le registre des interventions).

## /vgp/a-determiner

- **PV-41** — **Une liste sans issue : aucun écran ne sait décider l'assujettissement d'une famille (ni ouvrir une campagne, ni poser une exception)** — Gravité : Majeur — Nature : Écart à arbitrer (D88 §3, §6, §8)
  - Constat : la page liste les familles « à déterminer » (nom, nombre de machines) sans lien ni action. Le référentiel matériel AFFICHE que la périodicité réglementaire « se déclare à la famille, depuis le registre des VGP » — le registre n'a aucun formulaire. Le seul chemin qui écrit `assujettissement_vgp` est l'import de familles (création ; la modification est IMPORT-3). Une famille créée à l'écran reste donc « à déterminer » ; un régime faux ne se corrige pas. Sans aucun appelant non plus : la campagne datée (L9-08) et l'exception motivée d'une machine (L9-06), tickets marqués LIVRÉ.
  - Preuve : `app/(back-office)/vgp/a-determiner/page.tsx:71-85` ; `lib/i18n/fr.ts:2827-2828` (`materiel.pas_la_vgp`, rendu `app/(back-office)/parametres/materiel/page.tsx:228`) ; `app/api/parametres/materiel/saisie-recue.ts:27-33` (aucun champ VGP) ; `lib/imports/application.ts:988-1041` ; `lib/vgp/campagne.ts:63`, `:96`, `:156` (aucun import) ; `lib/vgp/assujettissement.ts:132-152` (`schemaExceptionMachine`, aucun appelant) ; `docs/backlog.md:1035-1048`.
  - Effet pour l'utilisateur : bloquant dès la première famille créée à l'écran ; D88 §6 et §8 inatteignables.
  - Correctif proposé : sur chaque ligne, « Décider » → régime + périodicité + texte (`schemaAssujettissementFamille`, déjà écrit), qui ouvre la campagne si « soumis » (`ouvrirCampagne`) ; « Voir les machines » → `/parc?famille=<id>` ; exception motivée sur la fiche machine ; remettre les marques L9-06 / L9-08 à l'état réel.
  - Couverture : EN FILE partiel (IMPORT-3, voie import) ; NOUVEAU pour l'écran.

- **PV-42** — **Bandeau orange « 0 familles restent à déterminer → » et tuile « À déterminer » inerte** — Gravité : Mineur — Nature : Ergonomie
  - Constat : le lien reste affiché à 0, en couleur d'alerte (choix écrit dans le code) ; la tuile « À déterminer » n'est PAS un lien ; à 0 la page n'affiche qu'une phrase.
  - Preuve : `app/(back-office)/vgp/page.tsx:356-362`, `:365-382` ; `lib/i18n/fr.ts:2341-2342`.
  - Effet pour l'utilisateur : une alerte et un clic pour rien.
  - Correctif proposé : fusionner tuile et bandeau — la tuile devient le lien ; à 0, texte neutre sans lien. À confirmer par Alexis (le commentaire l. 365-370 défend le lien permanent).
  - Couverture : NOUVEAU (GR17 n'a fait que souligner le lien).

## /vgp/enregistrer/[id]

- **PV-43** — **Les observations saisies ne deviennent jamais des interventions, et ne se lisent nulle part** — Gravité : Majeur — Nature : Écart à arbitrer (D88 §10 ; L9-10 marqué LIVRÉ)
  - Constat : chaque ligne du champ « Observations » crée une `vgp_observation` avec `intervention_id` NUL — ni nature, ni priorité, ni file. `planifierLObservation` (nature `controle_reglementaire`) et `observationsEnAttente` n'ont aucun appelant ; aucun écran ne lit `vgp_observation`. Le gardien `pnpm chemins` ne le voit pas : il ne juge que les fichiers `depot*.ts`. En outre `planifierLObservation` lit l'observation dans une transaction et crée l'intervention dans une autre (`creerIntervention` ouvre la sienne) : sa « même transaction » est fausse — à corriger avant de la câbler.
  - Preuve : `lib/vgp/verification.ts:162-171` ; `lib/vgp/observations.ts:58-115`, `:99` `creerIntervention(contexte, saisie, client)`, `:104-107` ; `lib/interventions/depot.ts:281-288` ; `git grep planifierLObservation` → aucun appelant dans `app/` ; `docs/backlog.md:1055-1058` (« LIVRÉ », acceptation : « une observation saisie produit une intervention en file d'attente ») ; `tests/unit/gardiens/chemins-de-depot.test.ts:40`.
  - Effet pour l'utilisateur : « le seul point qui rapporte de l'argent » (D88 §10) n'existe pas ; la spécification du planning GMAO suppose l'origine « Observation VGP » dans la file.
  - Correctif proposé : bloc « Observations » sur la fiche machine et page « Observations en attente » (plus anciennes d'abord, déjà écrit) avec « Planifier » une par une (esprit de D115, et arbitrage 1 du 22/09 : rien d'automatique) ; priorité de l'intervention créée = valeur à fixer par Alexis ; une seule transaction.
  - Couverture : NOUVEAU.

- **PV-44** — **Import « vgp_observations » : 0 intervention créée ; « consultable » seulement dans le rapport du lot** — Gravité : Majeur — Nature : Donnée / Incohérence
  - Constat : l'import n'écrit que le libellé et le rapport parent, `intervention_id` NUL (arbitrage 1 du 22/09, écrit dans le code et l'aide de l'import, absent de `docs/arbitrages.md`) : les 362 observations appliquées n'ont créé aucune intervention et ne sont pas dans la file « À planifier ». L'aide dit « une observation importée est consultable » : seulement dans le rapport du lot (`/imports/[id]`), aucune fiche ne la montre ; leur statut d'archive (levée, chiffrée, non rattachée) n'a pas de colonne. Les observations rejetées du même fichier (notes en ligne : 308, un seul motif) sont absentes du produit.
  - Preuve : `lib/vgp/depot-import.ts:49-66` ; `lib/imports/vgp.ts:37-41`, `:113-133` ; `lib/i18n/fr.ts:744-745` ; aucune lecture de `vgpObservation` hors `lib/vgp/` et `lib/imports/`.
  - Effet pour l'utilisateur : des centaines de réserves en base, invisibles.
  - Correctif proposé : inscrire l'arbitrage 1 du 22/09 dans `docs/arbitrages.md` ; afficher les observations importées (même bloc que PV-43) avec le statut d'archive lu dans la ligne du lot ; une colonne de statut = migration, **Arrêt §8** (« levée » est ce qu'un client voit).
  - Couverture : NOUVEAU.

- **PV-45** — **Refus = saisie perdue ; double envoi = doublon** — Gravité : Mineur — Nature : Bug déduit
  - Constat : formulaire HTML nu ; un refus redirige vers le formulaire VIDE (le commentaire de la route affirme l'inverse) ; aucun blocage du double clic (règle D-06 appliquée au formulaire machine, pas ici) ; aucune contrainte d'unicité sur `vgp_verification`.
  - Preuve : `components/vgp/formulaire-verification.tsx:33-36` (aucune valeur initiale) ; `app/api/vgp/enregistrer/[id]/route.ts:9-11` « un refus qui renvoie ailleurs fait perdre la saisie », `:36-42` ; `prisma/schema.prisma` `model VgpVerification` (seul `@@unique([societe_id, id])`).
  - Effet pour l'utilisateur : observations retapées ; vérifications en double.
  - Correctif proposé : même composant que `FormulaireMachine` (quatre issues, envoi unique, saisie conservée).
  - Couverture : NOUVEAU.

- **PV-46** — **Date future acceptée, aucune correction possible : une faute de frappe masque une machine pendant des années** — Gravité : Majeur — Nature : Bug déduit
  - Constat : aucune borne sur la date (ni « pas après aujourd'hui », ni « pas avant la mise en service ») ; la dernière information est la date MAX ; rien ne corrige ni ne supprime une vérification saisie à l'écran. Une année mal tapée dans le futur fait passer la machine « à venir » pour des décennies, sans retour.
  - Preuve : `components/vgp/formulaire-verification.tsx:39-46` (`type="date"`, sans `max`) ; `lib/vgp/verification.ts:49` `date_verification: z.date()` ; `:196-199` (`_max: { date_verification: true }`) ; `docs/propositions/vgp-import/README.md:33-34` (« rien ne modifie une vérification existante »).
  - Effet pour l'utilisateur : une échéance dépassée disparaît du registre et du tableau de bord.
  - Correctif proposé : refus serveur d'une date postérieure au jour civil de la société ; geste « Corriger / annuler une vérification » journalisé, réservé au bureau.
  - Couverture : NOUVEAU.

- **PV-47** — **« Organisme » obligatoire, même pour « Déclaration du client »** — Gravité : Mineur — Nature : Écart à arbitrer (D114)
  - Constat : exigé par Zod, le formulaire et la base quelle que soit l'origine ; pour une déclaration, l'organisme peut être inconnu → on saisira « ? » (un « inconnu » déguisé, ce que D114 refuse pour l'origine).
  - Preuve : `lib/vgp/verification.ts:50` `organisme: texteNonVide` ; `components/vgp/formulaire-verification.tsx:62` `required` ; `prisma/schema.prisma` `organisme String`.
  - Effet pour l'utilisateur : une valeur probante fabriquée.
  - Correctif proposé : à trancher par Alexis — organisme facultatif pour `declaration_client` (colonne nullable = migration, **Arrêt §8**), ou aide « organisme cité par le client, s'il l'a nommé ».
  - Couverture : NOUVEAU.

- **PV-48** — **Écran « aveugle » et sans retour** — Gravité : Mineur — Nature : Ergonomie
  - Constat : ni régime, ni périodicité, ni dernière information, ni avertissement « hors registre » ; sous-titre avec le n° de série brut (« SN-INCONNU-… ») ; après succès, retour à `/vgp` sans message, même venu de la fiche.
  - Preuve : `app/(back-office)/vgp/enregistrer/[id]/page.tsx:66-87`, `:95-101` ; `app/api/vgp/enregistrer/[id]/route.ts:63-66`.
  - Effet pour l'utilisateur : on enregistre sans savoir contre quoi, et sans confirmation.
  - Correctif proposé : encadré « Ce que le registre sait » (`informationDeLaMachine`) ; bandeau de succès ; retour vers l'écran d'origine.
  - Couverture : NOUVEAU (n° de série brut : DÉJÀ COUVERT R-b, audit du 27/09).

- **PV-49** — **Technicien : bouton proposé partout, refus « pas lisible sous la société active »** — Gravité : Mineur — Nature : Incohérence (D131)
  - Constat : D131 limite le technicien aux machines de ses interventions non annulées ; le registre lui propose « Enregistrer » sur toutes les lignes ; le refus dit que la machine n'est « pas lisible », alors qu'il vient de la lire.
  - Preuve : `lib/vgp/verification.ts:128-149` ; `app/api/vgp/enregistrer/[id]/route.ts:54-61` ; `lib/i18n/fr.ts:2220-2221`.
  - Effet pour l'utilisateur : saisie tapée pour rien, motif trompeur.
  - Correctif proposé : bouton masqué hors périmètre (même lecture que le dépôt) ; message unique et juste pour les deux cas (« Vous ne pouvez pas enregistrer de vérification sur cette machine »), toujours indiscernable (D50).
  - Couverture : NOUVEAU.

---

## Évolutions proposées pour ces pages

**Ajouter**
1. **Fiche machine — gestes datés** : « Changer l'état » (en service / en panne / arrêtée), « Sortir du parc » (ferraillée : date + motif ; remplacée par… : lien RG-PAR-06), « Transférer » (vers un site du même client ; le changement de client à part). *Pourquoi* : RG-PAR-03/05/06 n'ont aucun chemin ; sans eux le parc et le registre VGP divergent de la réalité. Règles à écrire par Alexis (Arrêt §8).
2. **Fiche machine — « Historique des états et des emplacements »**, lu dans `journal_audit` (I8 journalise déjà l'avant / après de `machine`) — le cahier M2 le demande (« changements de statut et de localisation »). Droit de lecture à trancher (`consulter_journal_audit` = administrateur, direction).
3. **Fiche machine — bloc « Vérifications périodiques »** : date, organisme, origine, référence, observations avec « Planifier » (`verificationsDeLaMachine` existe sans appelant). Et les faits absents : fin de garantie, criticité, localisation, référence interne (D128).
4. **« Observations en attente »** (bureau) : une par une, « Planifier » (intervention `controle_reglementaire`) ou laisser — D88 §10, sans automatisme (arbitrage 1 du 22/09, esprit de D115). Priorité créée : valeur à fixer par Alexis.
5. **Registre VGP « par client / site » pour préparer une campagne** : filtres Client et Site (mêmes options que `/parc`), intertitres client puis site, par groupe « dépassées · à venir · sans information », impression de la liste d'un client (`window.print`, sans dépendance). Un export Excel demanderait une bibliothèque d'écriture : décision (§2).
6. **Décider un régime depuis `/vgp/a-determiner`** (régime + périodicité + texte), ouverture de la campagne datée (L9-08) ; exception motivée par machine (L9-06).
7. **`/parc`** : option « Sorties du parc » ; recherche sur la référence interne ; KPI garantie cliquable vers la liste concernée.
8. **Étiquette** : gabarit QR + désignation + n° de série ; planche de plusieurs machines (L2-02) — après décision du format de la QR (PV-22) et du support (question ouverte n° 6).
9. **Terrain** : bloc « Matériel » sur la fiche d'intervention (PV-24).
10. **Référentiel** : liste « modèles à rapprocher » (quasi-doublons) avant la fusion L3-10.

**Retirer**
1. « Le scan ouvre directement la fiche autorisée » et le préfixe « CODIPLAN: » devant la référence (jusqu'à L3-11).
2. Le sous-titre de « Corriger la fiche » qui renvoie à des gestes inexistants.
3. « Remplacée » / « Ferraillée » du formulaire de création (remplacés par le geste de sortie) ; `fusionnee` côté serveur.
4. Le lien « Registre des vérifications périodiques » en bas de `/parc` (le menu l'a).
5. La note « sans octets » sous un tableau de documents vide.
6. « CODIMA » des quatre libellés affichés (aperçu, fiche, portail ×2).
7. *(à arbitrer)* Les lignes « Hors registre » non soumises de la vue par défaut du registre → « Afficher les hors registre (N) ».

**Fusionner**
1. `referenceMachine`, `TONS_STATUT`, `lieuAffiche`, `numeroDeSerieAffiche`, `anneeDeVenteAffichee` recopiées dans 2 ou 3 fichiers → `lib/machines/presentation.ts` ; préfixes « Local- », « MAC- », « INT- » au dictionnaire.
2. Tuile « À déterminer » + bandeau des familles → une tuile-lien.
3. Une seule lecture de l'état VGP pour fiche machine, fiche site, registre et tableau de bord (`lib/vgp/libelles.ts`), un seul horizon « à venir ».
4. Un seul ordre d'historique (fiche machine, aperçu `/parc`, fiche site, fiche client).
5. Une seule règle d'affichage d'« Enregistrer une vérification » (registre = fiche = rôle, D131).
6. Une seule population « machines du site / du client » entre `/parc?site=`, `/parc?client=` et les fiches site et client.

---

## Observations en ligne : confirmées / réfutées

1. `/parc` — filtre à 3 statuts contre 5 à la création : **confirmé** (`app/(back-office)/parc/page.tsx:333-344` ; `components/parc/formulaire-machine.tsx:352-363`). « Ces machines sont-elles exclues ? » : **réfuté** — elles sont DANS « Tous les statuts » (défaut, `lib/machines/depot.ts:277-278`), badge gris, mais impossibles à isoler (`lib/machines/saisie.ts:197-202`).
2. `/parc` — libellés de filtres incohérents : **confirmé** (`lib/i18n/fr.ts:2111`, `:2118`, `:2120` ; `page.tsx:376`, `:397`).
3. `/parc` — « AGENCE CODIMA » en dur : **confirmé**, dans le dictionnaire (`lib/i18n/fr.ts:2171`, `:2365`), composé par `page.tsx:544` et `[id]/page.tsx:360` ; autres occurrences affichées : `fr.ts:133-134`, `:159-160` (portail).
4. `/parc` — « Derniers événements : Garantie — » : **confirmé** (`lib/machines/historique.ts:121`, `page.tsx:799-803`).
5. `/parc` — « Fiche complète » déborde à 375 px : **confirmé par la cause** (`components/ui/maitre-detail.tsx:197-216`), mesure non refaite.
6. `/parc/[id]` — h1 générique : **confirmé**, DÉJÀ COUVERT (M5, 26/09).
7. `/parc/[id]` — « Local-XXXXXX » = 6 derniers caractères hexadécimaux de l'UUID : **confirmé** (`[id]/page.tsx:652-660`). « Imprimé DANS le QR » : **réfuté** — la QR encode le jeton `qr_token` (`components/ui/qr-code.tsx:69-70`), « CODIPLAN:Local-… » n'est que la ligne de texte sous la QR (`[id]/page.tsx:470-473`). Provisoire : **confirmé** (bascule en « MAC-… » dès que `numero` existe ; aucun code ne l'attribue, `prisma/schema.prisma:1458-1461`) ; au jour de la numérotation, la QR reste valable, le texte imprimé devient obsolète.
8. Scan terrain : **aucun écran de scan** (L3-11 bloqué, `docs/backlog.md:893-894`) ; la résolution existe seulement en route JSON, par le jeton (130 bits, unique GLOBALEMENT : `prisma/migrations/20260909150000_machine_l2_01/migration.sql:147`), sous RLS (`lib/machines/resolution.ts:104-107`) → **aucune collision possible par la QR**, ni entre machines ni entre sociétés (réponse 404 indiscernable). Le code « Local- » (24 bits) peut, lui, se répéter, mais rien ne le résout.
9. `/parc/[id]` — colonne « RÉSULTAT » = statut : **confirmé** (`fr.ts:2378`, `[id]/page.tsx:515-520`).
10. `/parc/[id]` — « Aucun technicien affecté » sur les clôturées importées : **confirmé**, DÉJÀ COUVERT (I-12, 27/09).
11. Trois ordres différents (machine en tête / site en bas / client en fin de pagination) : **confirmé** (`lib/machines/historique.ts:121` ; `lib/interventions/depot.ts:2749-2753`, `:2597-2602`) ; sur la fiche site, la limite de 12 fait disparaître les « À planifier ».
12. Bloc Documents « pas encore disponible » : **confirmé** (`fr.ts:2404-2405`) ; en outre, aucun chemin ne crée de document de machine.
13. Ordre des informations et D126 : **conforme** pour les cinq faits de tête (`[id]/page.tsx:313-333`) ; écart au titre de D128 : garantie, criticité, localisation, référence interne non affichées.
14. `/parc/[id]/modifier` — impasse : **confirmé** (`lib/machines/depot.ts:1027-1047`, seule écriture de `machine` ; aucune route de statut, de site, de client ni de modèle).
15. `/parc/nouvelle` — 5 statuts, défaut « En service », criticité « Normale » : **confirmé** ; défauts hérités du schéma (`prisma/schema.prisma:1487-1488`, `lib/machines/saisie.ts:127-128`, `formulaire-machine.tsx:356`, `nouvelle/page.tsx:116`), aucun arbitrage.
16. `/vgp` — 200 lignes, tête = échéances anciennes, pas de pagination : **confirmé** (`vgp/page.tsx:137`, `:291` ; `lib/vgp/registre.ts:642-656`, ordre arbitré le 25/09).
17. `/vgp` — tuiles À venir / Dépassées / Informations reçues / À déterminer : **confirmé** ; pas de tuile « Sans information » (`lib/vgp/registre.ts:580-625`).
18. `/vgp` — « Hors registre » avec « Enregistrer » : **confirmé** (`vgp/page.tsx:502-509`) ; le serveur écrit sans contrôle d'assujettissement, et l'écran ne change pas (`lib/vgp/information.ts:125-130`).
19. `/vgp` — « Sans information — Depuis une date inconnue » : **confirmé** : sous-ligne rendue quand la date de mise en service est nulle (`vgp/page.tsx:207-215`, `fr.ts:2286`).
20. `/vgp/a-determiner` — « page vide atteinte par une tuile à 0 » : **partiellement réfuté** — la page affiche une phrase (`fr.ts:2341-2342`) et c'est le bandeau orange, pas la tuile (inerte, `vgp/page.tsx:356-362`), qui y mène ; **confirmé** qu'elle n'offre aucune action.
21. `/vgp/enregistrer/[id]` — « Organisme » obligatoire en texte libre même pour « Déclaration du client » : **confirmé** (`lib/vgp/verification.ts:50`, `formulaire-verification.tsx:62`).
22. Observations « une par ligne » : **confirmé** qu'aucune intervention n'est créée — une `vgp_observation` par ligne, `intervention_id` NUL, sans nature ni priorité (`lib/vgp/verification.ts:162-171`) ; `planifierLObservation` sans appelant.
23. Import `vgp_observations` (362 lignes appliquées) : **0 intervention créée**, rien dans la file « À planifier » (`lib/vgp/depot-import.ts:49-66`, arbitrage 1 du 22/09 dans `lib/imports/vgp.ts:37-41`) ; visibles seulement dans le rapport du lot.
24. Fiche site « Prochaine VGP due » sans retard (notes du 28/09) : **confirmé** (`lib/vgp/registre.ts:260-270`, `sites/[id]/page.tsx:554-561`).
