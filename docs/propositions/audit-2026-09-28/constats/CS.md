# Audit CS — Clients, sites, interlocuteurs — code au commit bcc637e (28/09/2026)

Périmètre : `/clients`, `/clients/[id]`, `/clients/nouveau`, `/sites`, `/sites/[id]`, `/sites/nouveau`, le bloc « Interlocuteurs » des deux fiches, et leurs routes (`app/api/clients/**`, `app/api/sites/**`, `app/api/contacts/**`, `app/api/habilitations/exigences/**`, `app/api/recherche/{clients,sites,site}`) et dépôts (`lib/clients`, `lib/sites`, `lib/contacts`, `lib/interventions/depot.ts` pour les historiques, `lib/vgp/registre.ts` pour la tuile VGP, `lib/interventions/trajet.ts` et `occupation.ts` pour le trajet).
Méthode : lecture seule du dépôt au commit `bcc637e` (aucun fichier modifié, aucun serveur, aucune base). « Bug prouvé » = vu en ligne le 28/09 ET expliqué par le code. « DÉDUIT » = établi par lecture du code, non rejoué. Aucune donnée de production : « client A », « le site observé ».

---

## /clients

- **CS1** — **Badge « Active » / « inactive » : genre et casse faux, différent du filtre, des sites et de la maquette** — Gravité : Mineur — Nature : Incohérence
  - Constat : chaque carte d'un client actif porte « Active » (vert), celle d'un inactif « inactive » (minuscule, gris) ; le filtre dit « Actifs / Inactifs » ; la carte d'un site n'a aucun badge quand il est actif ; la maquette complète écrit « Actif ».
  - Preuve : `app/(back-office)/clients/page.tsx:327-331` `client.actif ? (<Badge ton="vert">{t("clients.etat.actif")}</Badge>) : (<Badge ton="gris">{t("clients.inactif")}</Badge>)` ; `lib/i18n/fr.ts:411` `"clients.etat.actif": "Active"` ; `fr.ts:355` `"clients.inactif": "inactive"` ; `fr.ts:351-352` « Actifs », « Inactifs » ; `docs/maquette/codiplan-maquette-complete.html` (`clients()` : `badge("Actif","green")`) ; `sites/page.tsx:388-394` (aucun badge si actif).
  - Effet pour l'utilisateur : 25 pastilles vertes identiques qui n'apprennent rien, un mot qui ne s'accorde avec rien d'autre à l'écran.
  - Correctif proposé : carte sans badge quand le client est actif, « Inactif » (gris) sinon — même règle que `CarteSite` ; la liste « État de la fiche » de la fiche peut garder le féminin (elle parle de la fiche).
  - Couverture : NOUVEAU.

- **CS2** — **Recherche : raison sociale et code seulement, sensible aux accents, sans la commune** — Gravité : Majeur — Nature : Bug déduit
  - Constat : le texte n'est cherché que dans la raison sociale et le code externe (ni commune, ni RIDET, ni référent, ni interlocuteur) ; `contains` + `mode: insensitive` produit un ILIKE : la casse est ignorée, pas les accents (« etablissement » ne trouve pas « ÉTABLISSEMENT … »). Le champ ne dit pas ce qu'il cherche (« Rechercher un client ») ; la maquette annonce « Raison sociale, code ou commune ». Ajouté au masquage par défaut (CS7), « Aucun client ne correspond » peut répondre pour un client qui existe.
  - Preuve : `lib/clients/depot.ts:314-326` `raison_sociale: { contains: criteres.texte, mode: Prisma.QueryMode.insensitive }` … `code_externe: { contains: … }` ; `lib/i18n/fr.ts:320` « Rechercher un client ».
  - Effet pour l'utilisateur : un client existant introuvable quand on tape sans accent (cas courant au téléphone) ou par sa commune.
  - Correctif proposé : sans migration — la recherche lit déjà TOUTE la population filtrée (`id`, `raison_sociale`) pour la trier en JavaScript (`lib/clients/depot.ts:363-373`) : y appliquer la comparaison normalisée de `normaliserRaisonSociale` (`lib/excel/rapprochement.ts:165`) et compter sur la même liste, pour que le total et la page restent une seule lecture ; ajouter la commune des sites ; libellé « Raison sociale, code ou commune ». Variante `unaccent` en base = migration, Arrêt §8. À VÉRIFIER : sous la collation de la base hébergée (octets, mesurée par LISTES-1), ILIKE replie-t-il la casse des lettres accentuées (É/é) ?
  - Couverture : NOUVEAU.

- **CS3** — **Le compteur « Sans … » hérite du masquage « sans équipement »** — Gravité : Mineur — Nature : Bug déduit
  - Constat : `compterSansCodeExterne` réutilise `filtreDeRecherche`, masquage compris : par défaut il ne compte que les clients qui ont au moins une machine. Les fiches sans machine — souvent créées dans CODIPLAN, donc souvent sans code, celles qu'un import rapprochera mal — ne sont pas comptées, alors que l'aide dit « le compteur porte sur toute la recherche ».
  - Preuve : `lib/clients/depot.ts:447-449` `where: { ...filtreDeRecherche(criteres), code_externe: null }` ; `depot.ts:337-338` `criteres.inclure_sans_equipement ? {} : { machines: { some: {} } }` ; `fr.ts:362-363`.
  - Effet pour l'utilisateur : « 0 » peut s'afficher alors que des fiches masquées n'ont pas de code.
  - Correctif proposé : compter le « sans code » hors masquage d'équipement, ou « N (dont M masqués) » ; tuile affichée seulement si > 0 (déjà proposé le 27/09).
  - Couverture : NOUVEAU (la tuile à « 0 » : DÉJÀ COUVERT, audit du 27/09 §4.8, toujours vrai).

- **CS4** — **« Code externe » en production : le libellé propre à la société n'est réglable nulle part** — Gravité : Mineur — Nature : Écart à arbitrer (D29)
  - Constat : D29 veut « Code Winpro » chez CODIMA par `societe.libelle_code_externe` ; aucune route ni aucun écran n'écrit cette colonne (seul le semis de démonstration la remplit). La production affiche donc le générique : tuile « Sans Code externe » (C majuscule en milieu de titre), champ « Code externe » sur les formulaires.
  - Preuve : `git grep libelle_code_externe` → écriture seulement dans `prisma/seed-data.ts:929` (démo) ; `app/(back-office)/clients/presentation.ts:31` `` `${t("clients.sans_code_titre")} ${libelleCodeExterne(libelleSociete)}` `` ; `lib/clients/code-externe.ts:27-31` ; `docs/arbitrages.md:469`.
  - Effet pour l'utilisateur : l'ADV lit un nom de code qu'elle ne connaît pas.
  - Correctif proposé : un champ « Nom du code client de votre logiciel de gestion » dans Paramètres › Société (autre groupe) ; en attendant, valeur posée en base par un geste d'Alexis ; titre composé en minuscule (« Sans code externe »).
  - Couverture : NOUVEAU.

- **CS5** — **Lecture des référentiels sans contrôle de rôle, interlocuteurs compris** — Gravité : Majeur — Nature : Écart à arbitrer (RG-DRO-02, §5.2) — À VÉRIFIER
  - Constat : `/clients`, `/sites`, leurs fiches (téléphones et courriels des interlocuteurs) et `/api/recherche/clients` n'exigent qu'une session et une société. Un technicien (RG-DRO-02 : parc des clients visités sous 7 jours) les lit par l'URL ou par les liens de `/parc/[id]` ; aucune page du back-office ne le renvoie vers `/terrain`. La barre les lui masque (D132), mais D132 écrit « ce n'est pas un contrôle d'accès ».
  - Preuve : `clients/page.tsx:125-131` (seuls contrôles : session, société) ; `clients/[id]/page.tsx:176-182` ; `sites/[id]/page.tsx:165-171` ; `app/api/recherche/clients/route.ts:14-17` « Aucune capacité n'est exigée au-delà d'une session valide » ; `docs/cahier-des-charges.md:767`.
  - Effet pour l'utilisateur : données personnelles d'interlocuteurs lisibles par tout compte de la société.
  - Correctif proposé : Arrêt §8 (données personnelles, droits) — le §5.2 n'a aucune ligne « consulter clients et sites ». Option 1 : lecture réservée au bureau (ADMS, DIR, RM, RS, ADV). Option 2 : bureau + technicien restreint au périmètre de RG-DRO-02. Puis garde de page lue dans la matrice.
  - Couverture : NOUVEAU.

- **CS6** — **Menu : « Clients » et « Sites » cachés au responsable SAV et au responsable matériel** — Gravité : Majeur — Nature : Écart à arbitrer (D130 / D132)
  - Constat : la barre exige `gerer_client_site` — le droit d'ÉCRIRE (D130) — pour afficher Clients et Sites, contre la règle écrite trois lignes plus haut dans le même fichier (« la capacité qui gouverne l'écran, jamais une action qu'on y accomplit »). RS et RM perdent l'entrée vers la liste, mais atteignent les fiches par les liens (parc, intervention, demande) et y trouvent des formulaires qu'on leur refusera (CS14).
  - Preuve : `lib/navigation/entrees.ts:523-524` `"nav.clients": "gerer_client_site", "vocabulaire.site.pluriel": "gerer_client_site"` ; `entrees.ts:508-511` « la capacité qui gouverne l'ÉCRAN que la destination ouvre, jamais une action qu'on y accomplit accessoirement » ; `lib/auth/habilitations.ts:145` `gerer_client_site: { complet: [ADMS, DIR, ADV] }`.
  - Effet pour l'utilisateur : le planificateur SAV ne trouve pas depuis le menu « qui appeler » ni les consignes d'accès d'un site.
  - Correctif proposé : trancher en même temps que CS5 la ligne « consulter clients et sites », puis poser `CAPACITE_REQUISE` sur cette capacité de lecture.
  - Couverture : NOUVEAU.

- **CS7** — **Clients sans équipement masqués sans le dire, recherche comprise** — DÉJÀ COUVERT (I-16, audit du 27/09) — toujours vrai à bcc637e : `clients/page.tsx:137` (`params.sans_equipement === "1"`), `lib/clients/depot.ts:337-338` ; aucune phrase « N masqués · Afficher » comme sur `/sites`.

- **CS8** — **« 0 équipements », « 0 sites », « 0 clients »** — DÉJÀ COUVERT (R-f, audit du 27/09) — toujours vrai : `clients/presentation.ts:103` (`nombre !== 1`), `:127-129` et `sites/presentation.ts:106-108` (`nombre === 1 ? … : pluriel`), `app/(back-office)/presentation.ts:54-60` (`decompte`).

## /clients/[id]

- **CS9** — **Les interventions ouvertes sans date sont rangées à la toute dernière page de l'historique** — Gravité : Majeur — Nature : Bug prouvé
  - Constat : l'historique est trié par date planifiée décroissante, « NULLS LAST », puis `id` : les À planifier (sans date) passent après la plus ancienne clôturée importée, soit en fin de page 21 sur 21 pour le client observé (251 interventions). La tuile « 4 Interventions ouvertes » n'est pas un lien, et le registre n'a pas de filtre client (le docblock de la page l'écrit).
  - Preuve : `lib/interventions/depot.ts:2597-2600` `orderBy: [{ date_planifiee: { sort: "desc", nulls: "last" } }, { id: "desc" }]` ; `clients/[id]/page.tsx:648-653` (tuile en `<b>`, sans lien) ; `clients/[id]/page.tsx:113-117` « ce registre n'expose aucun filtre `client_id` ».
  - Effet pour l'utilisateur : ce qui reste à faire chez ce client — la raison première d'ouvrir la fiche — est caché derrière vingt pages d'archive.
  - Correctif proposé : bloc « À traiter » en tête de fiche, lecture à part : À planifier (urgence puis ancienneté, l'ordre de la file), planifiées/affectées à venir (date croissante), suspendues ; la tuile y mène ; l'historique garde son ordre.
  - Couverture : NOUVEAU.

- **CS10** — **« Interventions ouvertes » exclut les « Terminée » que le registre range « À contrôler »** — Gravité : Mineur — Nature : Écart à arbitrer (règle absente)
  - Constat : le compteur range `terminee` avec `cloturee` et `annulee` ; le registre fait de `terminee` l'onglet « À contrôler », c'est-à-dire du travail restant pour le bureau.
  - Preuve : `lib/interventions/depot.ts:2644-2648` `STATUTS_INTERVENTION_FERMES = ["terminee", "cloturee", "annulee"]` ; `lib/interventions/depot.ts:3123` `a_controler: compteStatut("terminee")`.
  - Effet pour l'utilisateur : « 0 ouverte » sur un client dont des interventions attendent la clôture.
  - Correctif proposé : faire trancher le sens d'« ouverte » (la constante prévoit elle-même cette réouverture) ; à défaut, « dont N à contrôler » sous la tuile.
  - Couverture : NOUVEAU.

- **CS11** — **« Équipements » : le même mot pour deux populations** — Gravité : Mineur — Nature : Incohérence
  - Constat : carte de `/clients`, tableau des sites de la fiche client et carte de `/sites` comptent TOUTES les machines (remplacées, ferraillées, fusionnées comprises) ; les tuiles « Équipements » des fiches client et site, et le bloc « Équipements enregistrés » du site, ne comptent que les machines en parc. Le masquage « sans équipement » compte toutes les machines : un client dont la seule machine est ferraillée est listé « 1 équipement » et sa fiche dit « 0 ».
  - Preuve : `lib/clients/depot.ts:536-539` et `lib/sites/depot.ts:608-612` (`groupBy` sans filtre de statut) ; `lib/machines/depot.ts:793-797` et `:725-728` (`statut: { notIn: [...STATUTS_HORS_PARC_ACTIF] }`) ; `clients/[id]/page.tsx:239` et `:258-261` (les deux lectures sur la même page).
  - Effet pour l'utilisateur : des chiffres qui se contredisent d'un écran à l'autre, et entre la tuile et le tableau d'une même fiche.
  - Correctif proposé : une seule notion — « équipements en parc » — pour les cartes, les tuiles, les tableaux et le masquage, ou deux libellés distincts (« en parc » / « enregistrés ») ; le bloc du site, qui exclut les hors-parc, dit « Équipements en parc ».
  - Couverture : NOUVEAU.

- **CS12** — **Tuiles de synthèse inertes** — Gravité : Mineur — Nature : Ergonomie
  - Constat : « Lieux d'intervention actifs », « Équipements », « Interventions ouvertes » ne mènent nulle part, alors que `/parc?client=` et `/sites?client=` existent déjà.
  - Preuve : `clients/[id]/page.tsx:636-653` (`<b>` sans `Link`) ; `parc/page.tsx:170-172` (filtre `client`) ; `sites/page.tsx:148` (filtre `client`).
  - Effet pour l'utilisateur : le chiffre qu'on voit ne s'ouvre pas.
  - Correctif proposé : Équipements → `/parc?client=<id>` (même population que CS11) ; Sites → ancre du tableau ; Ouvertes → bloc « À traiter » (CS9). Même chose sur la fiche site (`/parc?site=<id>`).
  - Couverture : NOUVEAU.

- **CS13** — **« + Intervention » depuis le client ne préremplit rien** — Gravité : Mineur — Nature : Ergonomie
  - Constat : choix écrit de FICHE-360-1 (« demanderait un second mécanisme ») ; or la route de recherche des sites accepte déjà un filtre `client`, et le sélecteur accepte des `parametres`.
  - Preuve : `clients/[id]/page.tsx:333-343` `<LienPrimaire href="/interventions/nouvelle">` ; `app/api/recherche/sites/route.ts:40` `client_id: url.searchParams.get("client")` ; `components/ui/selecteur-recherche.tsx:78` (prop `parametres`).
  - Effet pour l'utilisateur : on rechoisit le client qu'on regardait, parmi tous les sites.
  - Correctif proposé : `/interventions/nouvelle?client=<id>` : un seul site actif → prérempli comme `?site=` ; plusieurs → sélecteur de site borné au client (`parametres={{ client: id, clientActif: "1" }}`).
  - Couverture : NOUVEAU (retour du formulaire toujours vers le planning : DÉJÀ COUVERT, M4 du 26/09).

- **CS14** — **D130 à l'écran : formulaires offerts à qui le serveur refusera, avec un message de connexion** — Gravité : Majeur — Nature : Bug déduit
  - Constat : la fiche client affiche à tout rôle le formulaire d'identité, l'état et les formulaires d'interlocuteurs ; la fiche site, son formulaire (seule la case « Sous contrat » est gardée) ; `/clients` et `/sites`, « Nouveau client / Nouveau site ». Les routes exigent `gerer_client_site` (ADMS, DIR, ADV) : RS, RM (et TEC) saisissent, puis lisent « Accès refusé. Vérifiez vos identifiants… », le message d'échec de connexion. Seuls « + Site » et la case contrat lisent la matrice.
  - Preuve : `clients/[id]/page.tsx:367-427` (aucun `peut`) ; `sites/[id]/page.tsx:444` (seule garde : la case contrat) ; `clients/page.tsx:184-188`, `sites/page.tsx:215-219` ; `app/api/clients/[id]/modifier/route.ts:66-69` `exigerCapacite("gerer_client_site")` → `versLaFiche("auth.refus")` ; `lib/i18n/fr.ts:93-94`.
  - Effet pour l'utilisateur : saisie perdue, et un message qui fait croire à un problème de compte.
  - Correctif proposé : la même lecture que la route (`peut(role, "gerer_client_site")`) masque formulaires et boutons ; la fiche se lit (rejoint I-13 « lecture + Modifier ») ; un motif propre au droit (« Votre rôle ne permet pas de modifier cette fiche ») au lieu de `auth.refus` pour un refus de capacité.
  - Couverture : NOUVEAU.

- **CS15** — **Client inactif : la fiche ne le dit pas et propose ce que le serveur refuse ; l'aide promet un retrait qui n'a pas lieu** — Gravité : Mineur — Nature : Incohérence (D129)
  - Constat : aucun badge « Inactif » en tête ; « + Site » et « + Intervention » restent offerts. La création d'intervention refuse ce client, et `/interventions/nouvelle?site=` ignore en silence un site de client inactif (formulaire vide) ; « + Site » crée bien un site pour lui (le préremplissage contourne le filtre « actifs » du sélecteur). L'aide dit « retirée des listes courantes » alors qu'il reste dans `/clients` (« Tous »), `/sites` et `/parc`.
  - Preuve : `clients/[id]/page.tsx:316-348` ; `lib/interventions/depot.ts:323-324` `if (!site.client.actif) { return { accepte: false, cle: "intervention.refus.client_inactif" }` ; `interventions/nouvelle/page.tsx:175-176` `… || !clientDuSite.actif ? undefined` ; `fr.ts:412-413`.
  - Effet pour l'utilisateur : clic sur « + Intervention » → formulaire vide, sans explication.
  - Correctif proposé : badge « Inactif » sous le titre ; « + Intervention » masqué pour un client inactif (« + Site » : à arbitrer) ; aide « Inactive — masquée du planning et du registre ; fiche et historique restent consultables ».
  - Couverture : NOUVEAU.

- **CS16** — **Désactiver un client retire ses interventions ouvertes du planning ET de l'application technicien, sans avertir** — Gravité : Majeur — Nature : Écart à arbitrer (D129)
  - Constat : « Enregistrer » avec l'état « Inactive » ne compte ni ne montre les interventions ouvertes ; `listerPlanning`, qui sert le planning et la liste du technicien, écarte tout client inactif : une planifiée de demain disparaît des deux écrans. D129 n'a traité que l'affichage, pas ce cas.
  - Preuve : `clients/[id]/page.tsx:409-418` ; `lib/interventions/depot.ts:1604` (`listerPlanning`) et `:1622` `...filtreClientActif(false)` ; `app/(mobile)/terrain/page.tsx:111` `const lignes = await listerPlanning(`.
  - Effet pour l'utilisateur : un rendez-vous confirmé au client n'est plus vu ni par le bureau ni par le technicien.
  - Correctif proposé : Arrêt §8 (règle absente). Option 1 : refuser la désactivation tant qu'il reste des interventions ouvertes (liste affichée). Option 2 : confirmation « N interventions ouvertes vont sortir du planning et du terrain ».
  - Couverture : NOUVEAU.

- **CS17** — **Messages de réussite affichés en rouge, comme des refus** — Gravité : Mineur — Nature : Ergonomie
  - Constat : tout `?motif=` est rendu dans l'encadré rouge, y compris « La fiche client est enregistrée », « … est créée », « L'interlocuteur est enregistré », « Le site a été créé », « Les modifications ont été enregistrées » ; une désactivation d'interlocuteur réussie ne dit rien.
  - Preuve : `clients/[id]/page.tsx:350-358` (`border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre` pour tout motif) ; `sites/[id]/page.tsx:305-321` (même classe pour `sites.cree`) ; `app/api/contacts/[id]/activite/route.ts:49-53` (`undefined` si accepté).
  - Effet pour l'utilisateur : on croit à un échec après une réussite.
  - Correctif proposé : deux rendus, réussite (ton neutre ou vert, comme GR17 pour « prévenu par courriel ») et refus (rouge).
  - Couverture : NOUVEAU (GR17 n'a traité que « prévenu par courriel »).

- **CS18** — **« Lieux d'intervention » survit sur la fiche client et la liste** — Gravité : Mineur — Nature : Incohérence (vocabulaire D5/D47)
  - Preuve : `fr.ts:387-389` (« Lieux d'intervention », « Aucun lieu d'intervention… ») ; `fr.ts:3652` « Lieux d'intervention actifs » ; `fr.ts:3532` « Contact du client (aucun lieu associé) » ; `fr.ts:3547` « Ce lieu n'appartient pas à ce client. » ; `fr.ts:338-339` (sous-titre de `/clients`).
  - Correctif proposé : « Sites », « Sites actifs », composés depuis `mot("site")` comme l'a fait GR12c.
  - Couverture : DÉJÀ COUVERT (G15/GR12c du 26/09) pour les trois écrans Sites ; résidu non traité ici.

- **CS19** — **Sites et interlocuteurs de la fiche triés par `ORDER BY` SQL** — Gravité : Mineur — Nature : Bug déduit (LISTES-1) — À VÉRIFIER
  - Constat : la décision LISTES-1 (« tous les classements alphanumériques ») est tenue en JavaScript pour les listes, parce que la base hébergée classe par octets ; la fiche client trie ses sites et ses interlocuteurs en SQL.
  - Preuve : `clients/[id]/page.tsx:209` `orderBy: [{ libelle: "asc" }, { id: "asc" }]` ; `lib/contacts/depot.ts:252` et `:274` `orderBy: [{ nom: "asc" }, …]` ; `lib/tri/collation.ts:1-27`.
  - Effet pour l'utilisateur : majuscules avant minuscules, lettres accentuées en fin de liste (à confirmer sur la base hébergée).
  - Correctif proposé : `trierAlphanumeriquement` sur ces deux lectures.
  - Couverture : NOUVEAU.

- **CS20** — **Fil d'Ariane + « ← Tous les clients » ; formulaire d'identité toujours ouvert** — DÉJÀ COUVERT (I-13 du 27/09, M12 du 26/09) — toujours vrai : `clients/[id]/page.tsx:321-324`, `:344-346`, `:367-427`.

- **CS21** — **« Dernière intervention » = la plus récente par date, tout statut** — DÉJÀ COUVERT (I-10 du 27/09) — toujours vrai : `clients/[id]/page.tsx:241` (`dernieresInterventionsDuClient(…, 1, 1)`), `lib/interventions/depot.ts:2597-2602` (aucun filtre de statut : une planifiée du jour, une future ou une ANNULÉE peut s'y afficher).

- **CS22** — **Planifiée à date passée sans marque « En retard » dans les historiques client et site** — Gravité : Mineur — Nature : Incohérence
  - Preuve : `clients/[id]/page.tsx:510-516` et `sites/[id]/page.tsx:857-862` (pastille de statut seule) ; `docs/propositions/planning-gmao/lots.md:55-57` (PG-C1a/b/c : planning, tableau de bord, registre).
  - Correctif proposé : réutiliser `enRetard()` de PG-C1a dans les deux historiques et le bloc « À traiter » (CS9).
  - Couverture : EN FILE (« En retard », PG-C1a) — les fiches client et site sont hors du périmètre annoncé : à ajouter au ticket.

## /clients/nouveau

- **CS23** — **Obligatoire non signalé, saisie perdue au refus** — Gravité : Mineur — Nature : Écart à la décision du 27/09 (« (obligatoire) » partout) + Bug déduit
  - Constat : « Raison sociale » est `required` mais son libellé ne porte pas « (obligatoire) » ; un refus (code externe déjà porté) renvoie sur `/clients/nouveau?motif=…` avec un formulaire vierge, alors que la route affirme préserver la saisie.
  - Preuve : `clients/nouveau/page.tsx:89-93` et `:131-137` (libellé sans marque) ; `lib/i18n/obligatoire.ts:3-8` (« (obligatoire) partout ») ; `docs/propositions/9AL-GR16-TEXTES/passation.md:24-26` ; `app/api/clients/creer/route.ts:28-33` (Location sans valeurs) et `:11-13` (« un refus qui renvoie ailleurs fait perdre la saisie »).
  - Effet pour l'utilisateur : tout est à retaper après un refus.
  - Correctif proposé : `libelleChampObligatoire` ; valeurs renvoyées dans l'URL et champ fautif encadré, comme la création d'intervention (56-FORMULAIRES-2, GR17-M14).
  - Couverture : NOUVEAU (extension de GR16/GR17 à ce formulaire).

- **CS24** — **Double clic = deux fiches (client, site, interlocuteur)** — Gravité : Mineur — Nature : Bug déduit
  - Constat : l'identifiant est tiré au serveur à chaque envoi ; sans code externe aucune unicité n'arrête le second ; même chose pour un site (aucune unicité (client, libellé), D101) et pour un interlocuteur. La création d'intervention, elle, tire l'identifiant au rendu (55-FORMULAIRES-1). Le bouton ne se désactive pas.
  - Preuve : `lib/clients/depot.ts:141-144` `id: uuidv7()` ; `lib/sites/depot.ts:214-217` ; `lib/contacts/depot.ts:119-120` ; `components/ui/action-primaire.tsx` (`<button type={type}>` sans état) ; `interventions/nouvelle/page.tsx:240` `const idIntervention = uuidv7();`.
  - Effet pour l'utilisateur : doublons, qui rendront ensuite l'import ambigu (rejet, RG-IMP-05 / D101).
  - Correctif proposé : identifiant tiré au rendu en champ caché et création idempotente, sur le modèle de l'intervention.
  - Couverture : NOUVEAU.

## /sites

- **CS25** — **Trajet « — » : la valeur appliquée est bien montrée ; le tiret mélange « zone manquante » et « Îles »** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la carte applique la cascade site → réglage société → défaut D107 et étiquette l'estimation « Trajet estimé ». « — » veut dire : ni durée ni zone, OU zone Îles ; `trajetAffiche` ignore le motif, et la phrase de D107 (« déplacement par avion… ») n'existe qu'en Paramètres › Trajets (CG6).
  - Preuve : `sites/page.tsx:298` `trajet={resoudreTempsTrajet(site, catalogueTrajets)}` ; `sites/presentation.ts:69-75` (`trajet.minutes === null` → tiret, `motif` non lu) ; `lib/sites/trajet-zone.ts:190-197`.
  - Effet pour l'utilisateur : on ne sait pas si le tiret se corrige (zone à renseigner) ou s'il est normal (avion).
  - Correctif proposé : « Zone à renseigner » (lien vers la fiche) pour `sans_zone` ; « Avion » + la phrase D107 en infobulle pour `sans_estimation`.
  - Couverture : NOUVEAU (liste filtrée « trajet inconnu » et zone en série : DÉJÀ COUVERT, 27/09 §4.9 et R-e).

- **CS26** — **« Client — Libellé » répété quand le site porte le nom du client** — Gravité : Mineur — Nature : Incohérence
  - Constat : GR12a compose deux liens et n'emploie pas `libelleClientSite`, qui replie ce cas partout ailleurs (sélecteurs, parc) ; le fil d'Ariane de la fiche répète aussi « Clients › A › A ».
  - Preuve : `sites/page.tsx:374-386` ; `app/(back-office)/presentation.ts:84-91` (repli si égalité) ; `docs/propositions/9AB-GR12-SITES/passation.md` (« deux `<Link>` distincts » choisis pour une épreuve existante) ; `sites/[id]/page.tsx:264-271`.
  - Effet pour l'utilisateur : bruit sur la majorité des cartes (sites nommés comme leur client).
  - Correctif proposé : même test d'égalité (rogné, sans casse) : un seul lien vers le site, le client en ligne muette ; fil d'Ariane « Clients › A › Site ».
  - Couverture : NOUVEAU.

- **CS27** — **Sites d'un client inactif présentés comme actifs** — Gravité : Mineur — Nature : Incohérence (D129)
  - Preuve : `sites/page.tsx:388-394` (badge lu sur `site.actif` seul) ; `lib/sites/depot.ts:444` (`client_actif` jamais passé par `/sites`).
  - Effet pour l'utilisateur : on part créer une intervention que le serveur refusera (CS15).
  - Correctif proposé : mention « Client inactif » sur la carte et en tête de fiche site.
  - Couverture : NOUVEAU.

- **CS28** — **Des commentaires du code citent des raisons sociales présentées comme réelles** — Gravité : Mineur — Nature : Donnée (I9) — À VÉRIFIER
  - Constat : quatre commentaires citent des noms en capitales, « mesurés en production » ; le dépôt est public (décision n° 3 du 23/09). Noms non recopiés ici.
  - Preuve : `lib/sites/depot.ts:452-453` ; `lib/tri/collation.ts:12` ; `lib/interventions/depot.ts:2540` ; `app/api/recherche/sites/route.ts:28`.
  - Correctif proposé : Alexis confirme s'ils sont réels ; si oui, « client A / client B » (I9).
  - Couverture : NOUVEAU.

## /sites/[id]

- **CS29** — **« Dernières interventions » : les À planifier n'apparaissent jamais dès qu'il existe 12 interventions datées** — Gravité : Majeur — Nature : Bug prouvé
  - Constat : cause exacte — une seule requête SQL `ORDER BY date_planifiee DESC NULLS LAST, id DESC LIMIT 12`. La borne est bien appliquée APRÈS le tri ; c'est le tri qui range les sans-date derrière toutes les datées, donc hors des 12. Sur le site observé (≥ 10 clôturées + 2 planifiées), les 2 À planifier (la tuile compte 4 ouvertes) sont coupées. « Celles qui restent à planifier en bas » n'est vrai que sous 12 interventions datées ; ni pagination ni lien « tout voir ». L'épreuve du lot le montrait déjà (13 lignes dont 3 sans date : une coupée). Trois fiches, trois ordres : machine sans date EN TÊTE, site coupées, client en dernière page.
  - Preuve : `lib/interventions/depot.ts:2746-2753` (`orderBy: [{ date_planifiee: { sort: "desc", nulls: "last" } }, { id: "desc" }], take: limite`) ; `sites/[id]/page.tsx:127` `INTERVENTIONS_MONTREES = 12`, `:200-204` ; `fr.ts:522-523` ; `docs/propositions/13-HISTORIQUE-SITE-1/passation.md:43` ; `lib/machines/historique.ts:121` (`orderBy: [{ date_planifiee: "desc" }, …]`, sans `nulls` → en tête).
  - Effet pour l'utilisateur : on planifie sans voir ce qui attend déjà sur ce site — risque de doublon.
  - Correctif proposé : deux lectures — (1) toutes les ouvertes du site, en tête (même bloc « À traiter » que CS9) ; (2) les dernières datées, bornées ; texte de borne exact ; lien vers un historique paginé comme celui du client ; même ordre sur les trois fiches.
  - Couverture : NOUVEAU.

- **CS30** — **« Prochaine VGP due » affiche une échéance dépassée comme une échéance à venir** — Gravité : Majeur — Nature : Bug prouvé
  - Constat : `prochaineEcheanceDuSite` rend le minimum des échéances des machines du site dont une information est reçue, passées comprises (machines hors parc comprises) ; la tuile l'écrit en gras neutre, sans « Échéance dépassée » (que la fiche machine et le registre disent). « — » confond « aucune machine soumise » et « machines soumises sans information » (D88 : un registre à moitié rempli ne doit pas ressembler à un registre complet).
  - Preuve : `lib/vgp/registre.ts:260-270` (`.filter(info => info.etat === "information_recue")` … `reduce(min)`, aucune comparaison à `aujourdHui`) ; `lib/vgp/registre.ts:273-279` (`echeanceDepassee` existe et n'est pas appelé) ; `sites/[id]/page.tsx:554-561` ; `fr.ts:3662`.
  - Effet pour l'utilisateur : une échéance dépassée de 180 jours se lit comme « la prochaine ».
  - Correctif proposé : tuile « VGP » : « N échéances dépassées » en rouge (critère `echeanceDepassee`, le seul), puis « prochaine : … », puis « N sans information » si > 0 ; libellés sans verdict (D88/D128) ; lien vers le registre filtré sur le site (filtre à créer : la recherche de `/vgp` ne porte pas sur le site, `lib/vgp/registre.ts` `rechercheCorrespond`).
  - Couverture : NOUVEAU.

- **CS31** — **Exigences d'habilitation : « Exiger » et « Retirer » offerts à tous, réservés à l'admin société** — Gravité : Majeur — Nature : Bug déduit + Écart à arbitrer (D130 / D37)
  - Constat : le bloc est rendu sans contrôle de rôle ; les deux routes exigent `administrer_utilisateurs` (admin société seul). L'ADV et la direction, qui gèrent la fiche site (D130), sont refusées — avec le message de connexion (CS14). Qui déclare ce qu'un site exige n'est écrit nulle part (D130 : la fiche site ; D37 : les habilitations relèvent de l'administration des utilisateurs).
  - Preuve : `sites/[id]/page.tsx:349-353`, `:731-739`, `:750-787` (aucun `peut`) ; `app/api/habilitations/exigences/creer/route.ts:33` et `app/api/habilitations/exigences/[id]/retirer/route.ts:34` `exigerCapacite("administrer_utilisateurs")` ; `lib/auth/habilitations.ts:162`.
  - Effet pour l'utilisateur : formulaire rempli pour rien ; en pratique, seul l'admin société peut exiger une habilitation.
  - Correctif proposé : faire trancher la capacité (option 1 : `gerer_client_site`, cohérent avec D130 ; option 2 : `administrer_utilisateurs`, cohérent avec D37), puis n'afficher les formulaires qu'aux rôles qui l'ont ; les autres voient la liste.
  - Couverture : NOUVEAU.

- **CS32** — **Rattachement « DUCOS — DUCOS »** — Gravité : Mineur — Nature : Ergonomie
  - Constat : l'option compose « libellé — code » (et non « code — nom ») pour distinguer deux agences homonymes (AGENCE-CODE-1) ; ici libellé et code sont identiques. Avec une seule agence active (Décision 11 : tout à Ducos), le menu n'offre de toute façon qu'un choix.
  - Preuve : `lib/agences/presentation.ts:20-22` `` `${libelle}${t("ponctuation.separateur")}${code}` `` ; `components/agences/options.tsx` (`libelleAgenceAvecCode(agence.libelle, agence.code)`).
  - Effet pour l'utilisateur : doublon visuel, capitales.
  - Correctif proposé : n'ajouter le code que si deux agences proposées partagent le libellé ou si le code diffère du libellé (sans casse) ; libellé en casse normale (donnée, Paramètres › Agences).
  - Couverture : NOUVEAU.

- **CS33** — **Le trajet réellement appliqué n'est pas affiché sur la fiche ; « 0 » accepté sans nuance** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la fiche montre la seule valeur saisie (vide quand l'estimation par zone s'applique) : ni la valeur appliquée, ni son origine, ni le cas Îles. La fiche accepte 0 (« site à l'agence même ») quand le réglage par zone refuse 0 parce que « zéro se lit « sur place » là où il faut lire « je ne sais pas » » ; les « 0 min » vus en ligne sont à vérifier.
  - Preuve : `sites/[id]/page.tsx:422-431` (champ seul ; `resoudreTempsTrajet` n'est appelé que par `sites/page.tsx:298`) ; `lib/sites/saisie.ts:97-106` (`min(0)`) ; `lib/sites/trajet-zone.ts:120-133` (`min(1)`).
  - Effet pour l'utilisateur : on ne sait pas quel trajet le planning compte pour ce site.
  - Correctif proposé : sous le champ, « Appliqué : 30 min — estimation Grand Nouméa (valeur de référence) » ; vérifier les sites à « 0 min » (donnée).
  - Couverture : NOUVEAU.

- **CS34** — **Aide « … et aux tournées » ; « depuis le rattachement »** — Gravité : Mineur — Nature : Incohérence (D107)
  - Constat : la même aide, sur la fiche et à la création, annonce les tournées, différées (D107 Q3) ; le libellé dit « depuis le rattachement » alors que D107 Q1 fixe le départ à l'agence du TECHNICIEN (aujourd'hui Ducos pour tous : même valeur tant que tout est rattaché à Ducos).
  - Preuve : `fr.ts:450-455` ; `docs/arbitrages.md:3603-3605` (tournées différées) et `:3625-3627` (point de départ).
  - Effet pour l'utilisateur : promesse d'un module qui n'existe pas.
  - Correctif proposé : « Sert au calcul de la charge du planning, jamais à la facturation. Vide : estimation par zone. » ; « Temps de trajet aller depuis l'agence (en minutes — ex. 90 = 1 h 30) ».
  - Couverture : NOUVEAU.

- **CS35** — **Fiche site incomplète : ni état actif/inactif, ni adresse, ni horaires, ni coordonnées** — Gravité : Mineur — Nature : Écart (cahier §7, fonction absente)
  - Constat : le schéma accepte ces champs, la route n'en lit aucun ; « la voie ordinaire est la désactivation » mais aucun écran ne désactive un site ; l'avertissement « site fermé » (D13) n'a jamais d'horaires à lire (fonction sans appelant) ; consignes d'accès sur une seule ligne.
  - Preuve : `app/api/sites/[id]/modifier/route.ts:33-46` (CHAMPS sans `actif`, `adresse`, `horaires`, `latitude`, `longitude`) ; `lib/sites/depot.ts:354-360` ; `lib/calendar/usages.ts:194` (`avertissementSiteFerme`, appelé par ses seuls tests) ; `docs/cahier-des-charges.md:354`.
  - Effet pour l'utilisateur : un site fermé reste proposé partout ; on ne note ni l'adresse ni les horaires.
  - Correctif proposé : « État du site » (deux valeurs explicites, comme le client), adresse en texte libre, consignes en zone multiligne ; horaires et coordonnées : à prioriser par Alexis.
  - Couverture : NOUVEAU.

- **CS36** — **Historique du site sans colonne Machine** — Gravité : Mineur — Nature : Incohérence
  - Preuve : `sites/[id]/page.tsx:810-819` (référence, date, nature, statut) ; `clients/[id]/page.tsx:307-311` (colonne Machine, GR11).
  - Effet pour l'utilisateur : scénario E (historique d'une machine) impossible depuis le site sans ouvrir chaque ligne.
  - Correctif proposé : même colonne Machine (et technicien) que la fiche client.
  - Couverture : NOUVEAU (G14/GR11 ne visait que la fiche client).

- **CS37** — **Douze lectures successives pour afficher une fiche site (six pour une fiche client)** — Gravité : Mineur — Nature : Bug déduit (performance)
  - Preuve : `sites/[id]/page.tsx:176-235` (11 `await` successifs, `prochaineEcheanceDuSite` en fait deux dont une sur toute la société) ; `clients/[id]/page.tsx:187-261`.
  - Effet pour l'utilisateur : fiche lente depuis Nouméa (chaque lecture est un aller-retour vers l'hébergeur).
  - Correctif proposé : `Promise.all` des lectures indépendantes, comme le lot PERF l'a fait pour les listes.
  - Couverture : NOUVEAU.

- **CS38** — **« Dernière intervention » du site = `interventions[0]`** — DÉJÀ COUVERT (I-10, étendu au site) : `sites/[id]/page.tsx:326` — même défaut que CS21.

- **CS39** — **Formulaire en bas sans titre ; fil par « Clients » et retour vers « Tous les sites »** — DÉJÀ COUVERT (M12 du 26/09 ; C6/M4 du 26/09) — toujours vrai : `sites/[id]/page.tsx:372-376`, `:264-271`, `:295-297`.

## /sites/nouveau

- **CS40** — **Client : c'est bien une recherche serveur, mais les homonymes sont indiscernables et un nom tapé sans choisir est refusé en « champs numériques »** — Gravité : Majeur — Nature : Bug déduit
  - Constat : le champ est un `SelecteurRecherche` (clients actifs, 20 par page, « voir plus »), pas un texte libre. Mais (1) chaque option n'affiche que la raison sociale : deux homonymes sont identiques ; (2) `required` porte sur le texte visible, pas sur l'identifiant caché : un nom tapé sans cliquer une proposition passe le navigateur, puis le serveur refuse avec « Vérifiez les champs numériques et les longueurs », formulaire vidé ; (3) un client inactif répond « Aucun résultat » sans dire pourquoi.
  - Preuve : `app/api/recherche/clients/route.ts:28` (`etat: "actifs"`) et `:46` (`libelle: client.raison_sociale`) ; `components/ui/selecteur-recherche.tsx:203-214` (champ caché sans `required`, `required={obligatoire}` sur le texte) ; `app/api/sites/creer/route.ts:23-27`, `:45-47` ; `fr.ts:553-554`.
  - Effet pour l'utilisateur : site créé chez le mauvais homonyme, ou refus incompréhensible et saisie perdue.
  - Correctif proposé : option « raison sociale · code · commune » ; refus nommé « Choisissez le client dans la liste » ; valeurs renvoyées au formulaire.
  - Couverture : NOUVEAU.

- **CS41** — **Rattachement sans présélection alors qu'une seule agence est proposable** — Gravité : Mineur — Nature : Écart à arbitrer (D56 / Décision 11 du 23/09)
  - Preuve : `sites/nouveau/page.tsx:129-137` (`defaultValue=""`, option vide) ; `lib/sites/saisie.ts:126-131` (« aucune valeur par défaut qui ne soit pas un mensonge ») ; décision n° 11 d'Alexis du 23/09 (« tout est rattaché à DUCOS »).
  - Effet pour l'utilisateur : un choix unique à faire à chaque création.
  - Correctif proposé : option 1 — présélectionner quand une seule agence est proposable (ce n'est plus un choix) ; option 2 — garder D56 tel quel. À Alexis.
  - Couverture : NOUVEAU.

- **CS42** — **Obligatoires non marqués, saisie perdue, aucun rappel d'un site homonyme** — Gravité : Mineur — Nature : Bug déduit + Écart (décision du 27/09)
  - Constat : Client, Rattachement et Libellé sont requis sans « (obligatoire) » ; tout refus renvoie un formulaire vide (client compris, sauf venu de « + Site ») ; rien ne signale qu'un site du même libellé existe déjà chez ce client, ce que D101 rend ambigu à l'import (rejet). Aide « tournées » : voir CS34.
  - Preuve : `sites/nouveau/page.tsx:113-146` ; `app/api/sites/creer/route.ts:23-27` ; `docs/arbitrages.md:3368-3370`.
  - Correctif proposé : « (obligatoire) » ; valeurs renvoyées ; avertissement non bloquant « Ce client a déjà un site « … » ».
  - Couverture : NOUVEAU.

## Interlocuteurs (bloc des fiches `/clients/[id]` et `/sites/[id]` ; `app/api/contacts/**`)

- **CS43** — **Vider le courriel d'un interlocuteur provoque une erreur serveur** — Gravité : Majeur — Nature : Bug déduit
  - Constat : à la modification, les canaux ne sont pas transmis : la règle « courriel si canal courriel » ne s'exécute pas ; l'écriture atteint la contrainte `contact_courriel_si_canal_email`, que `motifDeLErreur` ne reconnaît pas : l'exception remonte sans filet (aucun `try` dans la route).
  - Preuve : `app/api/contacts/saisie-recue.ts:44-55` (aucun `canaux`) ; `lib/contacts/saisie.ts:184` `if (saisie.canaux !== undefined) {` ; `prisma/migrations/20260907140000_contact_l1_03/migration.sql:155-159` (CHECK) ; `lib/contacts/depot.ts:78-97`, `:195-196` (`throw erreur`).
  - Effet pour l'utilisateur : page d'erreur au lieu d'un refus lisible.
  - Correctif proposé : appliquer la même règle en modification (canaux lus en base ou posés comme à la création) et traduire la contrainte en motif nommé.
  - Couverture : NOUVEAU.

- **CS44** — **Courriel exigé de tout interlocuteur, alors que seul le donneur d'ordre en reçoit** — Gravité : Majeur — Nature : Écart à arbitrer (règle absente, §8)
  - Constat : oui, le courriel est obligatoire côté serveur à la création (canal « courriel » posé par défaut, contrôle Zod, contrainte en base) — l'aide dit vrai. Mais le seul envoi vers un client choisit le donneur d'ordre actif muni d'un courriel (du site, sinon du client) : un contact technique ou un comptable qui n'a qu'un téléphone ne peut pas être enregistré.
  - Preuve : `lib/contacts/saisie.ts:136` `canaux: … .default([CANAL_PAR_DEFAUT])` et `:116-127` ; `fr.ts:3524-3525` ; `lib/avertissements/planification.ts:83-98` (`contact.roles.includes(ROLE_DONNEUR_ORDRE)`) ; `docs/cahier-des-charges.md:356` (« préférence de notification »).
  - Effet pour l'utilisateur : interlocuteurs non saisis, ou saisis avec un faux courriel.
  - Correctif proposé : Arrêt §8. Option 1 : courriel obligatoire pour le seul donneur d'ordre. Option 2 : case « Prévenir par courriel » (la préférence du cahier), courriel exigé si cochée.
  - Couverture : NOUVEAU.

- **CS45** — **Rôles : un seul sert ; la fiche ne dit pas qui sera prévenu** — Gravité : Majeur — Nature : Incohérence
  - Constat : « Donneur d'ordre » = destinataire des courriels de planification et de déplacement (site d'abord, sinon client) et tri en tête de la fiche client ; « Signataire » : `peutSigner` n'a aucun appelant (la signature terrain prend un nom libre) ; « Contact technique » et « Comptabilité » ne sont lus nulle part ; le « contact sur place » choisi sur l'intervention (imprimé sur le bon) n'est pas celui qu'on prévient. La fiche site ne montre pas les interlocuteurs « du client », qui reçoivent pourtant les courriels de ce site s'il n'a pas de donneur d'ordre ; un interlocuteur désactivé reste proposé comme « contact sur place » ; aucun portail ni envoi du bon n'existe.
  - Preuve : `lib/avertissements/planification.ts:83-98`, `:466-480` ; `git grep peutSigner` → `lib/contacts/saisie.ts:195` et son test seulement ; `lib/contacts/depot.ts:263-277` (site seul) ; `app/api/recherche/site/[id]/route.ts:37-43` (aucun filtre `actif`) ; `lib/interventions/bon.ts:79-80`.
  - Effet pour l'utilisateur : l'ADV ne sait pas qui recevra le rendez-vous ; des cases cochées sans effet.
  - Correctif proposé : sur chaque fiche, marque « Reçoit les courriels de planification » calculée par `destinataireClient`, sinon « Personne ne sera prévenu » ; sur la fiche site, les interlocuteurs du client en second bloc ; aide des rôles (« Donneur d'ordre : reçoit les courriels ; les autres : information ») ; désactivé = retiré des choix (principe D129/D134).
  - Couverture : NOUVEAU.

- **CS46** — **Formulaire d'interlocuteur : obligatoires non marqués, saisie perdue au refus** — Gravité : Majeur — Nature : Bug déduit + Écart (décision du 27/09)
  - Constat : nom, au moins un rôle et courriel sont exigés ; rien ne les marque ; un refus revient sur la fiche avec le formulaire vide et un message générique. Cas fréquent vu CS44.
  - Preuve : `app/(back-office)/contacts/presentation.tsx:236-257` ; `app/api/contacts/creer/route.ts:33-35` ; `fr.ts:3543-3544`.
  - Correctif proposé : « (obligatoire) » ; valeurs renvoyées ; message qui nomme le champ.
  - Couverture : NOUVEAU.

- **CS47** — **Coordonnées cachées derrière le formulaire de modification ; pas d'appel direct ; rattachement figé** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la ligne repliée montre nom, fonction, rôles ; téléphone et courriel n'apparaissent qu'en dépliant, au-dessus du formulaire de modification ; aucun lien `tel:` / `mailto:` (usage depuis un téléphone) ; le site de rattachement ne se corrige pas (désactiver puis recréer).
  - Preuve : `contacts/presentation.tsx:100-136` ; `app/api/contacts/[id]/modifier/route.ts:13-17`.
  - Correctif proposé : coordonnées cliquables dans la ligne ; « Modifier » replié à part ; rattachement modifiable.
  - Couverture : NOUVEAU.

- **CS48** — **Interlocuteur d'essai sur un client réel en production** — Gravité : Mineur — Nature : Donnée
  - Constat : non vérifiable dans le code. L'écran ne supprime pas un interlocuteur, il le désactive (il restera listé « Inactif »).
  - Preuve : `lib/contacts/depot.ts:202-207` (bascule d'activité, pas de suppression).
  - Correctif proposé : geste d'exploitation — le désactiver, ou le faire retirer par une correction tracée.
  - Couverture : NOUVEAU.

---

## Évolutions proposées pour ces pages

**Ajouter**
- **Bloc « À traiter » en tête des fiches client et site** (CS9, CS29) : À planifier par urgence puis ancienneté, planifiées/affectées à venir, en retard (PG-C1a), suspendues, et — selon l'arbitrage de CS10 — terminées à contrôler. Pourquoi : on ouvre une fiche pour savoir ce qui reste à faire chez ce client ou à cet endroit, avant d'en planifier une autre.
- **« Parc du client / du site »** : la tuile Équipements mène à `/parc?client=` ou `/parc?site=` (filtres existants). Pourquoi : le chiffre s'ouvre, sans écran nouveau.
- **« VGP du site »** : bloc des machines soumises du site avec l'état D88/D114 (hors registre / sans information depuis X / information reçue, origine, échéance, dépassée en rouge) ; filtre « site » au registre `/vgp`. Pourquoi : c'est la question posée sur place, et la tuile actuelle ment (CS30). Contrat : garder la seule case (module différé, D132).
- **« Qui est prévenu »** sur la fiche site (CS45). Pourquoi : chaque planification envoie un courriel ; l'ADV doit savoir à qui avant de poser.
- **Compteur « à planifier » sur les cartes client et site**, et **donneur d'ordre sur la carte client** : dessinés par la maquette (`clients()`, `sites()`) ; D123 attendait une fonction de dépôt groupée pour le premier, et justifiait l'absence du second par l'absence de saisie des contacts — levée par CONTACTS-1. Pourquoi : repérer d'un coup d'œil les clients qui attendent.
- **Choix du tri sur `/clients`** (raison sociale ; nombre d'équipements ; dernière intervention réalisée). Pourquoi : la liste a un ordre fixe, non dit.
- **Sur la fiche site** : état actif/inactif, adresse, consignes multilignes, trajet appliqué (CS33, CS35).

**Retirer**
- Le badge vert « Active » de chaque carte (CS1) ; la ligne « Agence — DUCOS » répétée sur chaque carte tant qu'une seule agence est active (Décision 11 ; à réafficher le jour où une seconde agence fait partir un technicien) ; le code d'agence quand il répète le libellé (CS32).
- « tournées » de l'aide du trajet (CS34).
- Les formulaires d'écriture pour les rôles qui ne peuvent pas écrire (CS14, CS31) ; la tuile « Sans … » à zéro (27/09 §4.8).

**Fusionner**
- Fiche client : identité en lecture + « Modifier », un seul retour (I-13).
- « Dernière intervention » → « Dernière réalisée » + « Prochaine », sur les deux fiches (I-10, CS21, CS38).
- Un seul mot et un seul compte : « équipements en parc » (CS11) ; « Lieux d'intervention » → « Sites » (CS18).
- Historiques client, site (et machine) : mêmes colonnes (machine, technicien), même ordre, même pagination (CS29, CS36).

---

## Observations en ligne : confirmées / réfutées

1. `/clients` — badge « Active » face au filtre « Actifs / Inactifs » : **confirmée** (`fr.ts:411`, `:351-352` ; `clients/page.tsx:327-331`) ; l'inactif s'écrit en plus « inactive » en minuscule (`fr.ts:355`).
2. `/clients` — tuile « 0 Sans Code externe » : **confirmée** (`clients/page.tsx:203-217`, `clients/presentation.ts:31`) ; libellé générique car `libelle_code_externe` n'est réglable nulle part (CS4) ; le compte hérite du masquage (CS3).
3. `/clients` — cartes : **confirmée** (voulu, D123) ; « aucun tri » : **réfutée en partie** — ordre alphabétique fixe, insensible à la casse et aux accents (`lib/clients/depot.ts:369-373`), mais aucun choix de tri.
4. `/clients` — 25 clients, sans équipement masqués : **confirmée** (`clients/page.tsx:137`, `lib/clients/depot.ts:337-338`) ; compte affiché = total filtré, masquage compris (`depot.ts:408-418`) ; recherche = raison sociale + code, casse ignorée, accents non (`depot.ts:314-326`) ; client inactif : reste listé (« Tous »), fiche intacte mais « + Intervention » vers un refus (CS15), et ses interventions sortent du planning et du terrain (CS16).
5. `/clients/[id]` — fil d'Ariane + « ← Tous les clients » : **confirmée** (`clients/[id]/page.tsx:321-324`, `:344-346`).
6. `/clients/[id]` — « + Site » prérempli, « + Intervention » sans client : **confirmée** (`:329`, `:340`, choix écrit `:334-339`) ; la fiche site passe bien `?site=` (`sites/[id]/page.tsx:284`).
7. `/clients/[id]` — « Dernière intervention » = planifiée du jour : **confirmée** — requête `dernieresInterventionsDuClient(…, 1, 1)` = date décroissante, NULLS LAST, tout statut (`clients/[id]/page.tsx:241`, `lib/interventions/depot.ts:2597-2602`).
8. `/clients/[id]` — tuile « Équipements » non cliquable : **confirmée** (`:642-647`) ; elle compte les seules machines en parc, pas la carte de la liste (CS11).
9. `/clients/[id]` — ouvertes sans date absentes de la tête de l'historique : **confirmée et expliquée** — NULLS LAST puis `id` : elles tombent en fin de DERNIÈRE page (`lib/interventions/depot.ts:2597-2600`).
10. `/clients/[id]` — Planifiée passée sans marque de retard : **confirmée** — aucune lecture « en retard » (`:510-516`) ; PG-C1 ne couvre pas les fiches (CS22).
11. `/sites` — trajet « — » pour la plupart : **réfutée quant à la cause** — la carte montre la valeur appliquée (estimation par zone étiquetée « Trajet estimé », `sites/page.tsx:298`, `trajet-zone.ts:180-203`) ; « — » = ni durée ni zone (ou Îles).
12. `/sites` — site sans durée ni zone, que compte le planning : **ni refus ni avertissement à la pose** — la journée passe en « journées dont le trajet est inconnu — elles comptent pour zéro minute de trajet » (`lib/interventions/occupation.ts:250`, `lib/interventions/trajet.ts:145-147`, `fr.ts:1173-1176`).
13. `/sites` — « Client — Libellé » répété : **confirmée** (`sites/page.tsx:374-386`, choix de GR12a).
14. `/sites/[id]` — tuile « Prochaine VGP due » neutre malgré une échéance dépassée : **confirmée** (`lib/vgp/registre.ts:260-270`, `sites/[id]/page.tsx:554-561`).
15. `/sites/[id]` — 12 lignes sans les 2 À planifier : **confirmée, cause exacte** — `ORDER BY date_planifiee DESC NULLS LAST, id DESC LIMIT 12` : la borne suit le tri, mais le tri met les sans-date derrière toutes les datées (`lib/interventions/depot.ts:2746-2753`).
16. `/sites/[id]` — « DUCOS — DUCOS » : **confirmée**, mais c'est « libellé — code » (`lib/agences/presentation.ts:20-22`), pas « code — nom ».
17. `/sites/nouveau` — « Client » champ texte : **réfutée** — sélecteur à recherche serveur (`sites/nouveau/page.tsx:113-125`) ; deux homonymes y sont indiscernables (`app/api/recherche/clients/route.ts:46`) ; nom tapé sans choisir → refus « champs numériques » (CS40).
18. `/sites/nouveau` — aide « tournées » : **confirmée** (`fr.ts:454-455`), aussi sur la fiche site.
19. Interlocuteurs — courriel obligatoire côté serveur : **confirmée à la création** (`lib/contacts/saisie.ts:116-137` + CHECK en base) ; à la modification, non contrôlé par Zod et refusé par la base en erreur non rattrapée (CS43).
20. Interlocuteurs — usage des rôles : seul « Donneur d'ordre » sert (destinataire des courriels de planification, `lib/avertissements/planification.ts:83-98`) ; « Signataire », « Contact technique », « Comptabilité » ne sont lus nulle part ; aucun portail ni envoi de bon (CS45).
21. Interlocuteurs — contact d'essai sur un client réel : **non vérifiable dans le code** ; donnée, à désactiver (CS48).
