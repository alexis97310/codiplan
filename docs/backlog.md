# CODIPLAN — Backlog exécutable

**Tickets des lots 0 à 3 — chemin critique jusqu'à la mise en service terrain**

*Version 3 — intègre les notes d'arbitrage n°1 et n°2. Les tickets modifiés par un arbitrage portent la référence `[Dxx]`.*

Format : `[identifiant] but — critères d'acceptation`. Chaque critère doit être vérifiable par une machine.
Source de la règle métier : **chapitre 10 du cahier des charges**, complété par `docs/arbitrages.md` qui prévaut.

---

## Lot 0 — Socle (3 semaines)

**L0-01 — Initialiser le dépôt.**
Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, ESLint, Prettier, pnpm.
*Acceptation :* `pnpm build` et `pnpm typecheck` passent ; la page d'accueil affiche « CODIPLAN ».

**L0-02 — Chaîne de vérification. [D14]**
Vitest, Playwright, et **deux portes distinctes** :
`pnpm verify` = typecheck + lint + test + test:isolation + build — porte de chaque ticket.
`pnpm verify:full` = verify + test:e2e — porte de chaque lot.
CI **GitHub Actions** : `verify` à chaque commit, `verify:full` sur `main` et chaque nuit.
*Acceptation :* les deux commandes passent ; un test volontairement faux fait échouer la commande et la CI.

**L0-03 — Schéma multi-société. [D4] [D5]**
Tables `societe`, `agence`, `devise`, `parite`, `utilisateur`, `utilisateur_societe`, `utilisateur_client`.
`agence` est nouvelle (D5) : code, libellé, adresse, fuseau, calendrier, actif.
`parite` remplace `devise.parite_reference` (D20) : devise, date d'effet, taux, source.
`utilisateur_client` (D10) : utilisateur, client, société, périmètre de sites.
*Acceptation :* migration appliquée ; `pnpm db:seed` crée deux sociétés — CODIMA-NC en XPF avec ses trois agences (Ducos, Koné, Dolbeau) et CODIMA-EU en EUR avec son unique agence (Siège) —, soit **quatre agences au total**, et au moins un compte portail rattaché à un client.
> Le critère « migration appliquée / seed exécuté » est validé par le déclenchement **manuel** du workflow `.github/workflows/db-migrate.yml`, **et non depuis une session cloud** : le proxy sortant de l'environnement cloud ne relaie pas le TCP, la base Neon y est donc injoignable (P1001). Voir `docs/decisions/2026-08-20-migration-par-github-actions.md`.

**L0-04 — Politiques RLS. [D4]**
Sécurité au niveau des lignes sur toutes les tables portant `societe_id`, pilotée par une variable de session.
Forme imposée : `societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL`.
*Acceptation :* une requête sans société positionnée retourne **zéro ligne sur les tables cloisonnées**, et **uniquement les référentiels de plateforme** sur les tables partagées (`devise`, `famille_materiel`, `modele_materiel`, `checklist_modele`).

**L0-05 — Tests d'isolation. [D22]**
Répertoire `tests/isolation/`. Pour chaque ressource : lecture, écriture et suppression tentées depuis une autre société.
Inclut obligatoirement : le chemin **`GET /machines/qr/{token}`**, qui doit refuser un jeton appartenant à une autre société ; l'accès d'un compte portail aux données d'un autre client ; le respect du périmètre de sites.
*Acceptation :* au moins 12 scénarios, tous verts. **Vérification manuelle documentée** dans `docs/decisions/` : retirer un filtre société fait échouer les tests.

**L0-06 — Authentification et rôles. [D21]**
Better Auth, sessions serveur, MFA sur `admin_plateforme` et `direction`.
Énumération canonique des rôles, complète dès maintenant : `admin_plateforme`, `editeur_commercial`, `editeur_support`, **`admin_societe`** [D37], `direction`, `responsable_materiel`, `responsable_sav`, `adv`, `technicien`, `client` — **dix rôles**.
Rôle PostgreSQL `codiplan_reporting` avec `BYPASSRLS`, en `SELECT` seul, réservé à `lib/reporting`.
*Acceptation :* un utilisateur habilité sur A ne peut pas basculer sur B ; tout changement de société active est journalisé ; un test vérifie qu'aucun chemin hors `lib/reporting` n'utilise la connexion `codiplan_reporting`.

**L0-06b — Arbitrages consécutifs à L0-06. [D34] [D35] [D36] [D37] [D38] [D39] [D40] [D41]**
Troisième catégorie de I1 — **tables techniques d'authentification**, liste close : `session`, `compte`, `verification`, `journal_acces` [D34].
`journal_acces.societe_id_source` et `societe_id_cible`, informatives et nullables : elles répondent à « qui a tenté d'accéder à mes données », jamais à un filtre.
Identités globales, habilitations par société ; **réponses d'authentification indiscernables** — compte inexistant, mot de passe faux, compte sans habilitation [D35].
Dixième rôle `admin_societe`, colonne « Admin » du §5.2 scindée [D37].
Mot de passe de `codiplan_reporting` dans `REPORTING_DATABASE_URL` seulement, et contrôle permanent de ses privilèges [D38].
`second_facteur` rejoint les tables techniques d'authentification ; `utilisateur` reçoit la **quatrième catégorie** de I1, à elle seule, et ne porte **aucune donnée métier** [D39].
Second facteur obligatoire étendu à `admin_societe` — `admin_plateforme`, `admin_societe`, `direction` [D40], règle produit **RG-DRO-05**.
`parite` rejoint les référentiels de plateforme, et surtout : **gardien d'exhaustivité** des catégories de I1, qui part du schéma et non des listes [D41].
*Acceptation :* un test prouve qu'aucune requête applicative ne filtre sur `societe_id_source` ni `societe_id_cible` ; un test prouve que les trois refus rendent le même message et répondent dans le même ordre de grandeur de temps ; le contrôle de cloisonnement échoue si `codiplan_reporting` détient un privilège autre que `SELECT`, lu dans `information_schema.role_table_grants` ; les scénarios positifs et négatifs couvrent les dix rôles ; un gardien statique échoue si une colonne s'ajoute à `utilisateur` hors de sa liste close ; tout rôle capable d'administrer des utilisateurs exige un second facteur ; **toute table de `prisma/schema.prisma` appartient à exactement une catégorie de I1** — zéro comme deux font échouer la vérification.

**L0-06c — `societe`, quatrième catégorie de cas. [D42]**
Rédaction de la **première catégorie de I1** : `societe` fait exception à la forme, non au fond — étant la table que `societe_id` désigne, elle est cloisonnée par son identité (`id = app.societe_id`) [D42].
Rien n'était ouvert : la politique existait depuis L0-04, `force-rls.test.ts` l'éprouvait, l'inventaire comptait `societe` parmi les tables cloisonnées. C'est la phrase de l'invariant qui était incomplète.
L'exception est **nommée** (`CLOISONNEE_PAR_IDENTITE`) plutôt que la règle élargie, et elle devient une **liste close de plus**, gardée comme les trois autres.
Inscrit au CLAUDE.md : toute autre table métier porte `societe_id NOT NULL` ou passe par un arbitrage — **c'est l'objectif des lots 1 à 3, pas une friction à contourner**.
Trois arbitrages relevés à la revue de cette livraison [D43] [D44] [D45] : le symbole du XPF reste `XPF` et la question part au registre avec son déclencheur ; **D19 est amendé** — la conversion vit dans `lib/reporting` ; l'arrondi au quart d'heure est rangé en L2-09.
*Acceptation :* le gardien d'exhaustivité de D41 ne relève plus aucune table hors catégorie ; le gardien de la liste d'exceptions **échoue sur toute entrée autre que `societe`** comme sur son retrait, avec le message « toute addition passe par un arbitrage, elle ne se décide pas dans un ticket », et il est éprouvé sur une addition fabriquée et sur une liste vidée.

**L0-07 — Module monétaire. [D19]**
`lib/money` : `formatMoney(montant, devise)` — symbole si la devise en a un, code sinon.
`lib/reporting` : `convertForConsolidation(montant, source, cible, dateParite)`, exigeant une date de parité explicite. **La conversion vit dans `lib/reporting`, jamais dans `lib/money`** [D44] — D19 disait `lib/money` contre I2, le §6 et ce ticket ; il est amendé, pas contourné.
L'arrondi au quart d'heure **ne fait pas partie de ce ticket** : c'est une politique de facturation, elle est rangée en L2-09 [D45].
*Acceptation :* `7 000 XPF` sans décimale [D19] [D43], `100,00 €` avec deux ; un appel à `convertForConsolidation` hors de `lib/reporting` fait échouer un test.

**L0-08 — Module calendrier. [D5] [D13] [D46] [D47]**
`lib/calendar` : calendriers rattachés à l'**agence**, jours fériés **portés par un référentiel territorial** `jour_ferie` (D46) et surchargeables par agence via le booléen `travaille`, calcul des jours et heures ouvrés. Fuseau IANA porté par l'agence, instants en `timestamptz`, récurrences stockées sous forme de règle locale et déroulées à la lecture.
Fonctions distinctes par usage : SLA (agence de l'intervention), majoration (agence du technicien), conflit à la pose (calendrier du technicien).
*Acceptation :* le samedi est ouvré pour Ducos et non pour Koné ; un férié marqué travaillé compte comme ouvré ; un délai SLA de 4 h ouvrées démarré vendredi 16 h échoit lundi.

**L0-09 — Thématisation par société.**
Couleurs, logo et mentions issus du paramétrage de la société active.
*Acceptation :* basculer de société change l'identité visuelle sans redéploiement.

**L0-10 — Journal d'audit. [D32]**
**Trigger PostgreSQL**, pas un intercepteur applicatif. Droits `UPDATE` et `DELETE` révoqués sur `journal_audit` pour le rôle applicatif.
Périmètre : intervention, contrat, machine, paramétrage société, compte client. Plus les accès des rôles éditeur et les basculements de société.
*Acceptation :* toute écriture sur une table sensible produit une ligne d'audit ; une tentative de suppression d'une ligne d'audit échoue au niveau de la base.

**L0-11 — Module i18n. [D26]** *(nouveau)*
`lib/i18n/fr.ts`, dictionnaire plat. Aucune chaîne visible en dur dans un composant.
*Acceptation :* une règle ESLint signale toute chaîne littérale dans le JSX des composants.

---

## Lot 1 — Référentiels, tarification, imports (4 semaines)

**L1-01** Clients — CRUD, **`code_externe`** [D29] avec libellé paramétrable par société, recherche.
**L1-02** Sites — adresses, zones géographiques (`grand_noumea`, `sud`, `cote_est`, `cote_ouest`, `nord`, `iles`) [D23], horaires, `temps_trajet_min` par agence qui **fait foi** sur l'estimation par zone.
**L1-03** Contacts — rôles, préférences de notification.
**L1-04** Techniciens et habilitations. **[D9]**
Trois tables : `habilitation`, `technicien_habilitation` (datée), `site_habilitation_requise` (avec booléen bloquant).
*Acceptation :* l'affectation est **bloquée** — et non signalée — si le site exige une habilitation bloquante absente ou expirée à la date d'intervention. Test sur RG-PLA-04.
**L1-05** Familles et modèles — `societe_id` nullable pour les référentiels de plateforme [D4] ; une copie portant un `societe_id` masque l'original.
**L1-06** Prestations et forfaits — `societe_id NOT NULL`. Conditions d'application par zone, famille, type.
*Acceptation :* un forfait dont les conditions ne sont pas remplies n'est pas proposé. Test sur RG-TAR-06.
**L1-07** Taux horaire — par société, surchargeable, **historisé**.
*Acceptation :* modifier le taux ne change pas les interventions déjà valorisées. Test sur RG-TAR-04.
**L1-08** Moteur d'import. **[D15] [D31]**
Format `.xlsx` uniquement. Version en cellule A1 (`CODIPLAN-<type>-v<n>`), en-têtes ligne 2, données ligne 3. Dates `JJ/MM/AAAA`, décimale virgule. Colonnes inconnues ignorées avec avertissement.
Annulation **partielle et sûre** : refus motivé sur les lignes modifiées ou référencées depuis ; jamais de suppression en cascade ; seul le dernier lot est annulable.
*Acceptation :* un fichier de 300 lignes avec 5 erreurs produit un rapport exact ; l'annulation restaure ce qui peut l'être et refuse le reste avec motif ; tests sur RG-IMP-01 à 05.
**L1-09** Modèles Excel téléchargeables et documentés — clients, sites, contacts, modèles, prestations.
**L1-10** Import de l'historique des ventes matériel — fiches créées avec `complet = false`, remontées en file de complétion.

---

## Lot 2 — Parc et interventions (4 semaines)

**L2-01** Fiche machine. **[D6] [D7]**
**Quatre champs obligatoires** : `modele_id`, `client_id`, `site_id`, `numero_serie`. Numéro illisible → `SN-INCONNU-<référence>` et `complet = false`.
`id` en UUID v7 généré côté client ; `numero` attribué par le serveur à la synchronisation ; affichage `Local-<6 car.>` tant qu'il est nul.
*Acceptation :* unicité (société, modèle, n° de série) sans NULL ; aucun doublon silencieux possible.
**L2-02** QR codes — le jeton est dérivé de l'`id`, jamais du numéro. Résolution serveur avec **contrôle de société** [D22]. Planches pré-générées pour le recensement.
**L2-03** Compteurs — non-régression après réordonnancement par `horodatage_terrain` [3.12].
**L2-04** Documents machine — visibilité client, marquage « embarqué mobile ».
**L2-05** Historique machine — conservé au changement de site.
**L2-06** Demandes — statuts `NOUVELLE`, `QUALIFIEE`, `TRANSFORMEE`, `CLOSE_SANS_SUITE` ; motifs `resolue_telephone`, `hors_perimetre`, `refus_client`, `doublon` [3.5]. Horodatage de l'accusé de réception en **heures ouvrées de l'agence** [D13].
**L2-07** Cycle de vie des interventions. **[D8]**
Huit statuts : `A_PLANIFIER`, `PLANIFIEE`, `AFFECTEE`, `EN_COURS`, `SUSPENDUE`, `TERMINEE`, `CLOTUREE`, `ANNULEE`. `statut_facturation` est une colonne **distincte**.
Matrice des transitions autorisées : voir D8 du document d'arbitrage.
*Acceptation :* chaque transition hors matrice est refusée avec un message explicite ; `SUSPENDUE` peut revenir vers `A_PLANIFIER`, `PLANIFIEE` et `EN_COURS` ; tests sur RG-INT-01 à 11.
**L2-08** Interventions multi-machines et multi-techniciens. Machine facultative pour `expertise`, `installation` et **`recensement`** [D16].
**L2-09** Valorisation. **[D11] [D12] [D45]**
Quart d'heure supérieur, cumul par technicien, attente non facturée, trajet couvert par le forfait de zone, un seul forfait de déplacement par intervention, majoration +50 % sur la main-d'œuvre seule au prorata.
Ordre : forfaits → heures excédentaires → majoration → total HT.
**L'arrondi au quart d'heure vit ici** [D45], et nulle part ailleurs — ni dans `lib/calendar`, ni dans `lib/money`. Raison : le calendrier répond à « quand » — jours ouvrés, horaires, fuseaux — et n'a pas à connaître la politique de facturation, sinon un changement de tarif pourra casser un planning ; le module monétaire formate et calcule, il ne décide pas ce qu'on facture.
**À trancher AVANT d'écrire ce ticket** [D45] : l'arrondi s'applique-t-il à **chaque intervention** ou au **total d'une journée** ? Cinq passages de cinq minutes font 1 h 15 dans un cas et 30 minutes dans l'autre. Décision commerciale, inscrite au registre de `docs/arbitrages.md` — ne pas la trancher en séance.
**L2-10** File « en attente de pièce » — motif, référence, date prévisionnelle, ancienneté.

---

## Lot 3 — Planning et PWA (5 semaines)

**L3-01** Vue calendrier ressources avec **Schedule-X** [D17], glisser-déposer, redimensionnement.
**L3-02** Contrôles à la pose — avertissements non bloquants, **blocage strict** sur habilitation expirée [D9].
**L3-03** File d'attente à planifier, tri par urgence et échéance.
**L3-04** Absences, alerte de rupture de service à effectif unique, report groupé.
**L3-05** Tournées — regroupement, ordonnancement, estimation des trajets.
**L3-06** Socle PWA — manifeste, service worker, installabilité. **Pas de notifications push** [3.19].
**L3-07** Cache local — IndexedDB, dont **le parc complet des clients visités sous 7 jours** [D22].
**L3-08** File d'opérations et synchronisation — priorisation, reprise, indicateur d'état.
*Acceptation :* test bout en bout — intervention complète en mode avion puis synchronisation intégrale sans perte.
**L3-09** Résolution de conflits. **[D27]**
Terrain sur l'exécution, back-office sur la planification, **statut par préséance** : `ANNULEE` > `CLOTUREE` > `TERMINEE` > `EN_COURS` > `SUSPENDUE` > planification.
*Acceptation :* une intervention annulée pendant sa réalisation hors ligne conserve temps, diagnostic, photos et signature, et le conflit est remonté.
**L3-10** Doublons hors ligne — détection **et fusion**. **[D28]**
La fiche la plus ancienne survit ; le `qr_token` de l'absorbée **redirige** vers elle ; historiques fusionnés ; divergences arbitrées champ par champ ; réversible 30 jours.
**L3-11** Scan QR et création express — moins de 60 secondes. **Pas de reconnaissance de plaque** [D33] : photo conservée en pièce jointe, saisie manuelle.
**L3-12** Recensement en série — enchaînement sans retour au menu, compteur de saisies.
**L3-13** Saisie de rapport — checklist, temps, pièces, photos compressées, préconisations. Absence de checklist = condition satisfaite ; un point non conforme impose une préconisation [3.10].
**L3-14** Signature client — `appareil_id` et `horodatage_terrain`, pas d'adresse IP [3.9].
**L3-15** Génération et envoi du PDF. **Validation systématique** avant diffusion [D24]. Le **PDF serveur fait foi** ; la version locale porte la mention « provisoire ». **Aucun montant** sur le rapport [3.8].
*Acceptation :* contrôle visuel humain obligatoire — aucun test automatique ne remplace ce point.

---

## Lots 4 à 7

Même format, à découper au moment de les aborder. Contrats et générateur de propositions (lot 4), portail client et tableaux de bord (lot 5), exports et flux BI (lot 6), console éditeur et abonnements (lot 7).

Un backlog écrit six mois à l'avance est périmé quand on y arrive.

### Tickets déjà arrêtés hors du chemin critique

Ils ne sont pas à construire maintenant ; ils sont écrits parce qu'un arbitrage les a rendus obligatoires, et qu'un corollaire non écrit est un corollaire perdu.

**L7-01 — Déblocage d'un `admin_societe` ayant perdu son second facteur. [D40]**
RG-DRO-05 rend le second facteur obligatoire sur `admin_societe`. Ce rôle est, chez un client, le seul à pouvoir administrer les comptes : son titulaire bloqué ne peut être débloqué par personne de sa société. Sans procédure, cela se règle par un appel au support puis par un second compte `admin_societe` créé « au cas où » — c'est-à-dire par le contournement de la mesure.
Exécutable par **`admin_plateforme` seul**. Journalisée dans **`journal_acces`** — la seule table qui puisse la porter, puisqu'elle enjambe les sociétés par construction (D34).
*Acceptation :* aucun autre rôle ne peut l'exécuter, y compris `direction` de la société concernée ; chaque déblocage laisse une ligne au journal des accès portant l'auteur, la société cible et le compte débloqué ; le compte débloqué doit réactiver un second facteur avant de retrouver ses droits d'administration.
