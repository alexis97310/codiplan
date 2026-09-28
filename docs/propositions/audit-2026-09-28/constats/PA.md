# Audit « code » — groupe PA : Paramètres et Imports — 28/09/2026

**Commit lu : `bcc637e`** (main publié = production), en lecture seule : aucun fichier du dépôt modifié, aucun serveur, aucune base, aucun accès à la production.
**Pages :** `/parametres`, `/parametres/societe`, `/parametres/taux-horaire`, `/parametres/prestations`, `/parametres/forfaits`, `/parametres/forfaits/[id]`, `/parametres/trajets`, `/parametres/agences`, `/parametres/agences/[id]`, `/parametres/agences/[id]/modifier`, `/parametres/agences/nouvelle`, `/parametres/equipe`, `/parametres/habilitations`, `/parametres/materiel`, `/imports`, `/imports/[id]`, avec leurs routes `app/api/{parametres,imports,techniciens,habilitations}/**` et leurs dépôts `lib/{imports,excel,prestations,materiel,tarification,agences,techniciens,habilitations,calendar}/**`.

**Niveaux de preuve.** « Bug prouvé » = vu en ligne le 28/09 et cause trouvée dans le code. « Bug déduit » = établi par lecture du code seule (**DÉDUIT**, chemin exact donné), à rejouer en recette avant correction. « À VÉRIFIER » = hypothèse dont la vérification exige d'exécuter.
**Anonymat (I9).** Aucun nom de client, de technicien ni d'établissement de la base : « agence A / agence B », « technicien 1 ».
**Valeurs.** Aucune valeur métier n'est proposée ; quand un correctif en exige une : « valeur à fixer par Alexis (CLAUDE.md §8) ».

---

## Transversal — toutes les pages du groupe

- **PA-01** — **Tarifs lisibles par tout compte de la société, technicien compris** — Gravité : Majeur — Nature : Écart à arbitrer (D37, RG-DRO-03)
  - Constat : aucune page de `/parametres/*` ni de `/imports/*` ne lit le rôle : il suffit d'une session et d'une société active. Les montants du taux horaire et des forfaits s'affichent donc au technicien (qui a l'adresse) et à l'administrateur de société, deux rôles à qui la matrice retire « voir les montants de vente ». La fiche intervention, elle, masque ces mêmes montants à ces deux rôles.
  - Preuve : `app/(back-office)/parametres/taux-horaire/page.tsx:74-81` (seules `session` et `societeId` sont testées) ; `lib/auth/habilitations.ts:157` `voir_montants_vente: { complet: [DIR, RM, RS, ADV] },` ; `app/(back-office)/interventions/[id]/page.tsx:245` `const montants = accesAuxMontants(session.contexte.role);`.
  - Effet pour l'utilisateur : un même compte voit le taux dans les paramètres et ne le voit pas sur la fiche ; un technicien peut lire la grille tarifaire.
  - Correctif proposé : trancher d'abord qui voit un tarif (le taux et les forfaits sont-ils des « montants de vente » ?) puis appliquer `accesAuxMontants` (ou la capacité retenue) sur `/parametres/taux-horaire`, `/parametres/forfaits`, `/parametres/forfaits/[id]`. **Arrêt §8** (droits).
  - Couverture : NOUVEAU.

- **PA-02** — **Le « ○ » de la direction vaut un accès complet, et les agences ne sont pas gardées par leur capacité** — Gravité : Majeur — Nature : Écart à arbitrer (§5.2, D37)
  - Constat : la matrice donne à la direction un ○ sur « Paramétrer une société » (« périmètre limité ou lecture seule ») ; `exigerCapacite` laisse passer tout ○, et aucune route de paramétrage ne restreint ensuite : la direction pose un taux, un forfait, un horaire, un trajet. Les routes d'agence exigent `parametrer_societe` alors que `administrer_agences` (admin société seul) existe : la direction crée et modifie des établissements, ce que la ligne « Administrer les agences » lui refuse.
  - Preuve : `lib/auth/habilitations.ts:161` `parametrer_societe: { complet: [ADMS], restreint: [DIR] },` ; `lib/auth/porte.ts:66` `return peut(contexte.role, capacite) ? contexte : null;` ; `app/api/parametres/agences/creer/route.ts:34` et `app/api/parametres/agences/[id]/modifier/route.ts:47` `exigerCapacite("parametrer_societe")` ; `lib/auth/habilitations.ts:166` `administrer_agences: { complet: [ADMS] },`.
  - Effet pour l'utilisateur : la direction peut changer un tarif ou ouvrir un établissement alors que la règle écrite ne le prévoit pas.
  - Correctif proposé : Alexis dit ce que « ○ » veut dire pour la direction (lecture seule ? tarifs seulement ?) ; puis `administrer_agences` sur les deux routes d'agence et, si « lecture seule », `peutPleinement` sur les routes d'écriture de paramétrage. **Arrêt §8** (droits).
  - Couverture : NOUVEAU.

- **PA-03** — **Trois réglages changent après coup les montants affichés des interventions clôturées** — Gravité : Majeur — Nature : Écart à arbitrer (RG-TAR-04)
  - Constat (DÉDUIT) : la clôture fige `montant_ht`, mais la fiche intervention **recalcule** taux, forfait et majoration à chaque affichage, et le bon relit taux et forfait. Un taux posé avec une date d'effet passée, un montant de forfait modifié (PA-23) ou un horaire d'agence changé (texte `calendrier.retroactif`) modifient donc le total affiché d'une intervention déjà clôturée, sans toucher au montant stocké.
  - Preuve : `lib/interventions/depot.ts:1913-1915` `if (brute.temps_valide_min !== null && brute.temps_valide_min > 0) { … const taux = await tauxEnVigueur(tx, brute.date_planifiee ?? instant);` ; `lib/interventions/bon.ts:226-231` (taux et forfait relus, total = `montant_ht` stocké) ; `prisma/migrations/20260909200000_intervention_l2_planning/migration.sql:214` « Figé à la clôture : une facture qui change quand le tarif change est une facture fausse (RG-TAR-04) ».
  - Effet pour l'utilisateur : la fiche montre un total différent du bon ; sur le bon, taux × heures + forfait ne donne plus le total imprimé.
  - Correctif proposé : pour une intervention clôturée, afficher les termes **figés** (taux, forfait, majoration stockés à la clôture) et non recalculés — cela demande de stocker ces termes (migration). À défaut, afficher `montant_ht` et le signaler quand le recalcul diverge. **Arrêt §8** (montants).
  - Couverture : NOUVEAU.

- **PA-04** — **La société est lue « au premier rang », sans son identifiant (devise des forfaits, devise de l'import d'historique)** — Gravité : Majeur (latent : compte habilité sur deux sociétés) — Nature : Bug déduit
  - Constat (DÉDUIT) : la table `societe` rend toutes les sociétés où la personne est habilitée (politique « adhésion »). Le taux horaire le sait et nomme la société par son id ; les forfaits et l'import d'historique ne le font pas. Pour un compte habilité sur deux sociétés, la devise lue peut être celle de l'autre : montants affichés « — » et libellé du champ faux ; création d'un forfait refusée par le déclencheur de devise ; et à l'import d'historique, montants écrits avec le code de l'autre devise (aucun déclencheur ne garde `intervention.devise_code`).
  - Preuve : `app/(back-office)/parametres/forfaits/page.tsx:114-118` `tx.societe.findFirst({ select: { devise: … } })` ; `app/api/parametres/forfaits/devise.ts:19` `tx.societe.findFirst({ select: { devise_code: true } }),` ; `lib/imports/parc-societe.ts:31` `tx.societe.findFirstOrThrow({` puis `lib/imports/modeles.ts:1705` `devise_code: … parcs.devise.code,` ; à comparer avec `app/(back-office)/parametres/taux-horaire/page.tsx:98-104` (« elle doit donc être NOMMÉE par son id »).
  - Effet pour l'utilisateur : pour un compte à deux sociétés, catalogue illisible ou refus incompréhensible ; au pire, montants d'historique dans la mauvaise devise (I2).
  - Correctif proposé : `where: { id: contexte.societeId }` sur les quatre lectures (`forfaits/page.tsx`, `forfaits/[id]/page.tsx:70`, `devise.ts`, `parc-societe.ts`) ; un gardien qui refuse `societe.findFirst` sans `where.id` hors `lib/auth`. **Arrêt §8** (devise, I2).
  - Couverture : NOUVEAU.

- **PA-05** — **Messages de succès affichés dans le cadre rouge d'un refus** — Gravité : Mineur — Nature : Ergonomie
  - Constat : « L'établissement a été créé », « Les modifications ont été enregistrées » et « Cette personne … a été rattachée » arrivent par `?motif=` sur des pages qui peignent tout motif en rouge (seul `/imports/[id]` choisit le ton selon la clé).
  - Preuve : `app/api/parametres/agences/creer/route.ts:62-63` (`motif=agence.creee`) → `app/(back-office)/parametres/agences/[id]/page.tsx:153-158` (`border-app-rouge-bord bg-app-rouge-fond`) ; `app/api/parametres/agences/[id]/modifier/route.ts:76-78` → `modifier/page.tsx:83-91` ; `app/api/techniciens/creer/route.ts:35` → `app/(back-office)/parametres/equipe/page.tsx:163-172`.
  - Effet pour l'utilisateur : une réussite se lit comme une erreur.
  - Correctif proposé : réutiliser `tonDuMotif` (`app/(back-office)/imports/types.ts:338`) et `CLASSES_TON` sur les bandeaux de motif des pages de paramètres.
  - Couverture : NOUVEAU (même famille que M13 du 26/09, corrigé ailleurs par GR17).

- **PA-06** — **La saisie est perdue après un refus sur les formulaires de création** — Gravité : Mineur — Nature : Bug déduit
  - Constat (DÉDUIT) : nouvel établissement, forfait, taux, prestation, famille, modèle, technicien, habilitation : la route renvoie sur le formulaire avec un motif, mais le formulaire se réaffiche vide (aucun `defaultValue` repris de la saisie). Le commentaire de la route d'agence affirme l'inverse.
  - Preuve : `app/api/parametres/agences/creer/route.ts:15-17` (« un refus qui renvoie ailleurs fait perdre la saisie ») ; `app/(back-office)/parametres/agences/nouvelle/page.tsx:97-103` (`<input name="code" required …/>` sans valeur) ; `app/(back-office)/parametres/forfaits/page.tsx:187-190` (`FormulaireForfait` sans `defauts`).
  - Effet pour l'utilisateur : un rang déjà pris ou un territoire mal saisi fait retaper tout le formulaire.
  - Correctif proposé : renvoyer les champs saisis (hors secret) dans l'URL de refus, comme le fait déjà la confirmation du taux, et les reprendre en `defaultValue`.
  - Couverture : NOUVEAU.

## /parametres

- **PA-07** — **Hub « Sociétés & tarifs » : onze portes, dont deux doublons du menu, et deux destinations du groupe absentes** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la page et son entrée de menu s'appellent « Sociétés & tarifs » ; elles rassemblent onze réglages, dont « Sites d'intervention » et « Clients », déjà au menu « Clients & parc » ; « Imports Excel » et « App technicien », voisins du même groupe « Paramètres » du menu, n'y figurent pas.
  - Preuve : `lib/i18n/fr.ts:2747` `"parametres.index_titre": "Sociétés & tarifs",` ; `lib/navigation/portes-parametrage.ts:75` `chemin: "/sites",` et `:91` `chemin: "/clients",` ; `lib/navigation/entrees.ts:319-323` (Clients, Sites au groupe « Clients & parc ») et `:346`, `:357` (Imports, App technicien hors hub).
  - Effet pour l'utilisateur : le titre annonce des tarifs ; on y trouve l'équipe, le matériel, les clients ; on n'y trouve pas les imports.
  - Correctif proposé : voir « Évolutions » (sections Société / Tarifs / Organisation / Référentiels ; retirer Clients et Sites du hub). Le libellé « Sociétés & tarifs » vient de la maquette (D121) : le changer serait un écart à arbitrer.
  - Couverture : NOUVEAU.

- **PA-08** — **Le hub n'a pas été confronté à la maquette complète** — Gravité : Mineur — Nature : Écart à arbitrer (D125 ; doctrine « aucun décompte » de R3-05)
  - Constat : depuis D125, `codiplan-maquette-complete.html` fait foi sur la disposition de « Sociétés & tarifs » : trois cartes (Société avec fuseau et devise, Agences, Tarification) puis un tableau « Forfaits actifs ». Le hub vivant, antérieur (R3-05, 13/09), est une grille de onze liens, et sa doctrine refuse tout décompte (« 3 agences actives » en est un).
  - Preuve : `docs/maquette/codiplan-maquette-complete.html:107` (`function parametres(){return head("Paramètres","Sociétés & tarifs",…` + cartes Société / Agences / Tarification) ; `lib/navigation/portes-parametrage.ts:15-18` (« aucun décompte, aucune pastille »).
  - Effet pour l'utilisateur : l'écran ne ressemble pas à la maquette qu'Alexis a validée.
  - Correctif proposé : Alexis tranche entre la maquette (cartes avec décomptes) et la doctrine R3-05 (portes sans décompte) ; dans les deux cas, cartes « Société » et « Établissements » en tête.
  - Couverture : NOUVEAU.

## /parametres/societe

- **PA-09** — **Page sans action, qui renvoie à une « console éditeur » invisible** — Gravité : Mineur — Nature : Ergonomie
  - Constat : l'écran ne montre que la pastille de charte (« diagnostic pour l'instant … ne le modifie pas encore ») et renvoie au lot 7 ; or la console éditeur est masquée du menu depuis D132.
  - Preuve : `lib/i18n/fr.ts:80-81` et `:88-89` ; `app/(back-office)/parametres/societe/page.tsx:57-87` (aucun formulaire) ; `lib/navigation/entrees.ts:358` `{ cle: "nav.console_editeur", chemin: null, ouvertePar: "lot 7" },`.
  - Effet pour l'utilisateur : première carte du hub, et elle ne sert à rien au quotidien.
  - Correctif proposé : la remplacer par « Identité de la société » en lecture (PA-10) ou la retirer du hub jusqu'au lot 7.
  - Couverture : NOUVEAU.

- **PA-10** — **Ce que la société a réglé à sa mise en service n'est visible nulle part** — Gravité : Mineur — Nature : Donnée
  - Constat : devise, fuseau, territoire, mentions légales (pied du bon), libellé du code externe et **pourcentage de majoration hors ouverture** vivent sur `societe` et ne s'affichent sur aucun écran ; la majoration est un prix et n'apparaît pas dans « Sociétés & tarifs ».
  - Preuve : `prisma/schema.prisma:121-123` (`fuseau_horaire`, `devise_code`, `majoration_hors_ouverture_pct`) et `:151` (`mentions_legales`) ; `grep -rn majoration_hors_ouverture_pct app --include=*.tsx` → aucune ligne.
  - Effet pour l'utilisateur : impossible de vérifier à l'écran le taux de majoration facturé ou le texte imprimé sur les bons.
  - Correctif proposé : afficher ces valeurs en lecture sur `/parametres/societe` (la maquette complète montre fuseau et devise) ; qui voit la majoration relève de PA-01.
  - Couverture : NOUVEAU.

## /parametres/taux-horaire

- **PA-11** — **Seul le taux du jour a un statut** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la colonne « Statut » ne qualifie que la ligne en vigueur ; un taux remplacé et un taux à venir restent vides.
  - Preuve : `app/(back-office)/parametres/taux-horaire/page.tsx:220-225` `{enVigueurDepuis !== null && ligne.date_effet.getTime() === enVigueurDepuis ? t("taux_horaire.en_vigueur") : null}`.
  - Effet pour l'utilisateur : on ne sait pas si la ligne du haut est à venir ou si l'ancienne a été remplacée, ni quand.
  - Correctif proposé : trois statuts dérivés de la même lecture : « Remplacé le JJ/MM » (date d'effet du suivant), « En vigueur », « À partir du JJ/MM ».
  - Couverture : NOUVEAU.

- **PA-12** — **Date d'effet passée acceptée sans avertissement, et le texte de confirmation décrit une autre règle** — Gravité : Majeur — Nature : Incohérence
  - Constat : le schéma n'exige qu'une date bien formée : on peut poser un taux au mois dernier. Le taux se lit à la **date planifiée** de l'intervention ; la confirmation dit pourtant « à toute intervention valorisée à partir de ce jour ». Conséquences : les interventions non clôturées planifiées depuis cette date passée changent de taux, et l'affichage des clôturées change (PA-03).
  - Preuve : `lib/tarification/succession-taux.ts:58` `date_effet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),` ; `lib/interventions/depot.ts:1304` `const taux = await tauxEnVigueur(tx, ligne.date_planifiee ?? instant);` ; `lib/i18n/fr.ts:2039-2040` (« à toute intervention valorisée à partir de ce jour. Il ne change aucune intervention déjà valorisée. »).
  - Effet pour l'utilisateur : une correction de taux antidatée re-tarife en silence des interventions déjà faites mais pas encore clôturées.
  - Correctif proposé : texte exact (« s'applique aux interventions planifiées à partir de cette date ») ; si la date est passée, une confirmation qui compte les interventions touchées ; accepter ou non l'antidatage est à décider. **Arrêt §8** (montants).
  - Couverture : NOUVEAU.

- **PA-13** — **Les refus parlent encore d'« unités mineures »** — Gravité : Mineur — Nature : Incohérence
  - Constat : GR17 a adapté le libellé du champ à la devise, pas les messages de refus du taux et du forfait.
  - Preuve : `lib/i18n/fr.ts:2045-2046` (« entier strictement positif, en unités mineures ») ; `:1991-1992` (« le montant (entier, en unités mineures) »).
  - Effet pour l'utilisateur : le jargon revient au moment de l'erreur.
  - Correctif proposé : composer le refus avec `libelleDuMontant(devise)` comme le champ.
  - Couverture : NOUVEAU (reliquat de GR17 / M2).

## /parametres/prestations

- **PA-14** — **« … ou au forfait qui s'applique » : aucun forfait de prestation n'est jamais appliqué** — Gravité : Mineur — Nature : Incohérence
  - Constat : l'écran dit que le prix d'une prestation se lit au taux ou au forfait ; le calcul ne sélectionne aucun forfait de prestation, et une intervention « au forfait » a un total inconnu.
  - Preuve : `lib/i18n/fr.ts:2704-2705` et `:2728-2729` ; `lib/tarification/valorisation.ts:266-276` (`if (exigeUnForfaitDePrestation(mode)) { … motifTotalInconnu: "intervention.total.forfait_de_prestation_absent"`).
  - Effet pour l'utilisateur : on croit qu'un forfait de prestation sera facturé ; il ne l'est jamais.
  - Correctif proposé : « Le prix se lit au taux horaire en vigueur à la date de l'intervention. » tant que le forfait de prestation n'est pas calculé.
  - Couverture : NOUVEAU.

- **PA-15** — **Même explication deux fois ; phrase sur la checklist** — Gravité : Mineur — Nature : Ergonomie
  - Constat : le sous-titre et le paragraphe « sans montant » redisent la même règle ; « La checklist type arrivera plus tard. » est la phrase gardée par Alexis le 27/09.
  - Preuve : `lib/i18n/fr.ts:2704-2705`, `:2728-2730` ; `app/(back-office)/parametres/prestations/page.tsx:66-68` (« Décision d'Alexis, 27/09/2026 : phrase raccourcie »).
  - Effet pour l'utilisateur : lecture longue pour une règle d'une ligne.
  - Correctif proposé : retirer `prestations.sans_montant` (le sous-titre suffit).
  - Couverture : DÉJÀ COUVERT pour la checklist (GR16, décision du 27/09) ; NOUVEAU pour le doublon.

- **PA-16** — **Un formulaire « Modifier — code » déplié par prestation sous le tableau** — Gravité : Mineur — Nature : Ergonomie
  - Constat : même motif que A-02, mais sans le repli `<details>` qu'ERGO-1 a posé sur équipe, habilitations et matériel : la page grandit d'un formulaire ouvert par prestation (le type d'import « Prestations » existe).
  - Preuve : `app/(back-office)/parametres/prestations/page.tsx:170-185` (`<section …>` + `FormulairePrestation` pour chaque prestation).
  - Effet pour l'utilisateur : dès que le catalogue est importé, liste perdue entre des formulaires.
  - Correctif proposé : `<details>` replié + ancre depuis un lien « Modifier » dans la ligne, comme `/parametres/habilitations`.
  - Couverture : NOUVEAU (motif de A-02, à trancher avec l'arbitrage H1).

- **PA-17** — **Durée standard sans usage ; familles désactivées proposées** — Gravité : Mineur — Nature : Incohérence
  - Constat : la durée standard n'est lue par aucun calcul ni pré-remplissage (cohérent avec QG-12 « non ») ; le choix de famille liste aussi les familles désactivées.
  - Preuve : `grep -rn duree_standard_min lib app components` → seules les pages, routes, dépôt et import des prestations ; `lib/prestations/depot.ts:169-172` (`tx.familleMateriel.findMany` sans filtre `actif`).
  - Effet pour l'utilisateur : une valeur saisie qui ne sert à rien ; une famille retirée du choix reste proposée.
  - Correctif proposé : dire sous le champ « information : n'entre dans aucun calcul » ; filtrer `actif: true` (en gardant la famille déjà portée par la fiche).
  - Couverture : NOUVEAU.

## /parametres/forfaits

- **PA-18** — **« Retenu » affiché pour des forfaits qu'aucun calcul n'applique** — Gravité : Majeur — Nature : Incohérence
  - Constat : l'écran calcule un verdict « Retenu » pour chacune des quatre natures ; la création d'intervention ne cherche que le forfait de **déplacement**, et rien n'écrit jamais `intervention.forfait_id`. Un forfait « mise en service », « contrôle » ou « prestation », créable par ce formulaire, est présenté « Retenu » et ne sera jamais facturé.
  - Preuve : `app/(back-office)/parametres/forfaits/page.tsx:170-178` et `:238` (`forfaitRetenu` pour chaque nature) ; `lib/interventions/depot.ts:461` `where: { type: "deplacement", actif: true },` ; `grep -rn "forfait_id" lib app` → aucune écriture.
  - Effet pour l'utilisateur : l'écran qui doit expliquer « pourquoi ce montant sur ma facture » promet un montant qui n'y sera pas.
  - Correctif proposé : pour les natures non appliquées, verdict « Non appliqué par le calcul aujourd'hui » et création limitée au déplacement tant que RG-TAR-05 n'est pas construit (à confirmer par Alexis).
  - Couverture : NOUVEAU.

- **PA-19** — **Zone sans forfait de déplacement : déplacement non facturé en silence, et figé à la création** — Gravité : Majeur — Nature : Incohérence (écran muet sur une règle conforme à D11)
  - Constat : le forfait de déplacement est choisi **une seule fois, à la création** de l'intervention, d'après la zone du site. S'il n'y en a pas pour cette zone (ou si le site n'a pas de zone), `forfait_deplacement_id` reste nul : à la clôture, total = main-d'œuvre + majoration, sans message ; la fiche et le bon omettent la ligne. Renseigner la zone ou ajouter le forfait ensuite ne rattrape pas les interventions déjà créées.
  - Preuve : `lib/interventions/depot.ts:379-383` (seul appel à `forfaitDeDeplacement`, dans la création) ; `lib/tarification/valorisation.ts:323-336` (`if (forfaitDeplacement === null) { // *Aucun forfait applicable : le déplacement n'est PAS facturé*`) ; `app/(back-office)/interventions/[id]/page.tsx:1300` (ligne omise) ; `docs/arbitrages.md:238` (D11 : « En l'absence de forfait applicable, non facturé »).
  - Effet pour l'utilisateur : avec un seul forfait (une zone), toutes les interventions des autres zones partent sans déplacement, et personne ne le voit.
  - Correctif proposé : sur `/parametres/forfaits`, pour la zone choisie : « Aucun forfait de déplacement : le déplacement n'est pas facturé » ; sur la fiche : « Déplacement : aucun forfait pour cette zone ». Recalculer le forfait tant que l'intervention n'est pas clôturée serait un changement de règle (**Arrêt §8**).
  - Couverture : NOUVEAU.

- **PA-20** — **Case « Cumulable avec le temps passé » : enregistrée, lue par aucun calcul, contraire à D77** — Gravité : Mineur — Nature : Écart à arbitrer (D77)
  - Constat : D77 : un forfait s'ajoute toujours aux heures, et « une valeur inerte n'est pas neutre, elle est une invitation » ; le formulaire propose pourtant cette case, décochée par défaut, qu'aucun calcul ne lit.
  - Preuve : `components/forfaits/formulaire.tsx:135-140` ; `grep -rn cumulable_temps lib/tarification/valorisation.ts lib/interventions` → aucune ligne ; `docs/arbitrages.md:2565-2567`.
  - Effet pour l'utilisateur : décocher la case laisse croire que le forfait remplacera les heures ; rien ne change.
  - Correctif proposé : retirer la case du formulaire (la colonne relève d'une migration) ; décision d'Alexis.
  - Couverture : NOUVEAU.

- **PA-21** — **Sélecteur de zone sans libellé associé, et aucune option « site sans zone »** — Gravité : Mineur — Nature : Ergonomie
  - Constat : le `<label>` précède le `<select>` sans `htmlFor` ni imbrication ; un lecteur d'écran n'annonce pas le champ. La liste ne permet pas de voir ce qui s'applique à un site sans zone.
  - Preuve : `app/(back-office)/parametres/forfaits/page.tsx:132-139` `<label className="…">{t("forfaits.zone")}</label>` puis `<select name="zone" …>`.
  - Effet pour l'utilisateur : champ muet pour l'accessibilité ; cas « sans zone » invisible.
  - Correctif proposé : `id` + `htmlFor` ; option « Site sans zone » (forfaits sans condition de zone seulement).
  - Couverture : NOUVEAU.

- **PA-22** — **Trois mots pour la nature d'un forfait ; colonne Actions hors cadre à 1280 px** — Gravité : Mineur — Nature : Ergonomie
  - Constat : « Type » dans le formulaire, « Catégorie » en colonne, titre de section par nature. Le tableau exige 1 180 px ; à 1280 px la zone utile mesurée par AGENCE-2 est de 966 px : « Actions » est hors cadre (indice de défilement CG3 présent).
  - Preuve : `lib/i18n/fr.ts:1963` `"forfaits.champ.type": "Type",` et `:2005` `"Catégorie"` ; `app/(back-office)/parametres/forfaits/page.tsx:283` `minimum="1180px"` ; `app/(back-office)/parametres/agences/page.tsx:88-91` (mesure 966 px).
  - Effet pour l'utilisateur : hésitation sur le mot ; « Modifier » introuvable sans défilement.
  - Correctif proposé : un seul mot (« Nature ») ; retirer la colonne « Catégorie », redondante avec la section, pour tenir dans 966 px.
  - Couverture : NOUVEAU.

## /parametres/forfaits/[id]

- **PA-23** — **Modifier le montant réécrit le forfait en place, sans historique ni avertissement** — Gravité : Majeur — Nature : Écart à arbitrer (D109, RG-TAR-04)
  - Constat : la fiche modifie `montant_mineur` sur la même ligne ; D109 décrit le forfait « avec son historisation », qui n'existe pas (pas de date d'effet). Les interventions non clôturées qui le désignent prennent le nouveau montant à la clôture ; les clôturées changent d'affichage (PA-03). L'écran ne dit ni combien d'interventions le désignent ni l'effet.
  - Preuve : `lib/tarification/depot-forfaits.ts:285-292` (`await tx.forfait.update({ … montant_mineur: BigInt(saisie.montant_mineur),`) ; `prisma/schema.prisma:2444-2469` (aucune date d'effet) ; `docs/arbitrages.md:3710` (« avec ses trois axes, son rang (D86) et son historisation »).
  - Effet pour l'utilisateur : une hausse de tarif du déplacement s'applique aussi aux interventions déjà créées et fausse les bons réimprimés.
  - Correctif proposé : historiser le forfait comme le taux (nouvelle ligne datée), ou au minimum afficher « Désigné par N interventions » et confirmer avant d'enregistrer un nouveau montant. **Arrêt §8** (montants, schéma).
  - Couverture : NOUVEAU.

## /parametres/trajets

- **PA-24** — **« 30 min (30 minutes) »** — Gravité : Mineur — Nature : Ergonomie
  - Constat : sous l'heure, la durée et sa parenthèse disent la même chose.
  - Preuve : `app/(back-office)/parametres/trajets/page.tsx:280-282` `` return `${enDuree(minutes)} (${decompte(minutes, …)})`; `` ; `lib/calendar/duree.ts:21-23` (`` if (heures === 0) { return `${reste} ${t("terrain.minutes")}`; ``).
  - Effet pour l'utilisateur : bruit dans chaque cellule.
  - Correctif proposé : parenthèse seulement quand `minutes >= 60`.
  - Couverture : NOUVEAU (reliquat de GR14).

- **PA-25** — **L'ADV, que D107 désigne pour régler les trajets, est refusée par le serveur** — Gravité : Majeur — Nature : Écart à arbitrer (D107 / matrice §5.2)
  - Constat : D107 : « l'ADV peut les corriger ». La route exige `parametrer_societe` (administrateur de société, direction), et le menu masque « Sociétés & tarifs » à l'ADV ; le commentaire de la page affirme encore qu'aucun filtre n'est posé « pour ne pas refuser l'ADV ».
  - Preuve : `app/api/parametres/trajet-zone/route.ts:48` `exigerCapacite("parametrer_societe")` ; `app/(back-office)/parametres/trajets/page.tsx:65-72` ; `lib/navigation/entrees.ts:528` ; `docs/arbitrages.md:3646`.
  - Effet pour l'utilisateur : la personne chargée de ces données ne peut ni trouver l'écran ni enregistrer ; un refus « Vérifiez vos identifiants » l'attend si elle a l'adresse.
  - Correctif proposé : Alexis choisit : ouvrir les trajets à l'ADV (capacité dédiée) ou amender D107. **Arrêt §8** (droits).
  - Couverture : NOUVEAU.

- **PA-26** — **Origine des valeurs de référence non dite ; « Enregistrer » fige la référence ; colonne « Régler » hors cadre à 1280 px** — Gravité : Mineur — Nature : Ergonomie
  - Constat : les valeurs de référence sont celles de D107, « trajet ALLER depuis » l'agence de départ unique d'aujourd'hui, ce que l'écran ne dit pas (il dit « depuis l'établissement dont dépend le lieu »). Le champ est pré-rempli avec la référence : un « Enregistrer » sans changement crée un réglage de société égal à la référence. Tableau de 1 000 px pour 966 px utiles.
  - Preuve : `lib/sites/trajet-zone.ts:86-90` ; `docs/arbitrages.md:3627` et `:3631` ; `lib/i18n/fr.ts:2858-2859` ; `app/(back-office)/parametres/trajets/page.tsx:219` `defaultValue={ligne.reglee ?? ligne.defaut.minutes}` et `:131` `minimum="1000px"`.
  - Effet pour l'utilisateur : dans six mois, ces valeurs se liront comme valables depuis n'importe quel établissement ; « Non réglée » devient « Réglée » sans décision.
  - Correctif proposé : note sous le tableau « Valeurs de référence : décision du 12/09/2026, trajet aller depuis l'agence de départ actuelle » ; champ vide avec la référence en exemple ; resserrer la colonne « Régler ».
  - Couverture : NOUVEAU.

## /parametres/agences

- **PA-27** — **L'agence inactive est listée en premier et reste réglable** — Gravité : Mineur — Nature : Ergonomie
  - Constat : tri par libellé seul ; la ligne inactive garde le formulaire du pas et le lien vers ses horaires.
  - Preuve : `app/(back-office)/parametres/agences/page.tsx:128` `orderBy: { libelle: "asc" },` ; `app/(back-office)/parametres/agences/composants.tsx:132-166` (formulaire du pas rendu quel que soit `actif`).
  - Effet pour l'utilisateur : la première ligne lue est celle qu'on n'utilise plus, et on peut y régler un pas pour rien.
  - Correctif proposé : trier `actif desc, libelle asc`, ligne inactive grisée, réglages repliés derrière « Réactiver ».
  - Couverture : DÉJÀ COUVERT (audit 27/09 §4.12, AGENCE-ACTIVE) — **toujours vrai au commit bcc637e** : AA-0…AA-6 n'ont pas touché cet ordre.

- **PA-28** — **Deux calendriers au même nom, et la fiche des horaires ne dit pas quel établissement elle règle** — Gravité : Majeur — Nature : Bug déduit
  - Constat : le calendrier reçoit le libellé de l'agence **à la création** et n'est jamais renommé ensuite (seul le pas se met à jour). Deux agences de même libellé donnent deux calendriers de même nom ; une agence renommée garde un calendrier à l'ancien nom. La fiche lit les établissements rattachés au calendrier mais ne les affiche pas.
  - Preuve : `lib/agences/depot.ts:171-178` (`tx.calendrier.create({ … libelle: saisie.libelle,`) ; `lib/agences/depot.ts:242-246` (la modification ne touche que `agence`) ; `lib/calendar/depot.ts:299-302` (seul `pas_creneau_minutes` est mis à jour) ; `app/(back-office)/parametres/agences/[id]/page.tsx:126-131` (`agences` lues) et `:141` (titre = libellé du calendrier seul).
  - Effet pour l'utilisateur : risque de régler les horaires du mauvais établissement — donc les créneaux proposés, les refus de pose et la majoration.
  - Correctif proposé : titre de la fiche = « Horaires — <agence> (<code>) » à partir des agences rattachées ; renommer le calendrier avec l'agence (ou ne plus afficher son libellé).
  - Couverture : NOUVEAU.

- **PA-29** — **Même adresse, deux entités : `/agences/[id]` attend un calendrier, `/agences/[id]/modifier` une agence** — Gravité : Mineur — Nature : Incohérence
  - Constat : le segment `[id]` porte un identifiant de **calendrier** sur la fiche horaires, un identifiant d'**agence** sur la modification ; le commentaire l'assume.
  - Preuve : `app/(back-office)/parametres/agences/[id]/page.tsx:104-108` (« La valeur reste un identifiant de CALENDRIER ») ; `app/(back-office)/parametres/agences/[id]/modifier/page.tsx:59-63` (`lireAgence(session.contexte, id)`) ; `composants.tsx:60` et `:119`.
  - Effet pour l'utilisateur : une adresse copiée ou modifiée à la main mène à « introuvable » ; source d'erreur pour tout lien futur.
  - Correctif proposé : `/parametres/agences/[agenceId]` (fiche établissement : identité + horaires) et `/parametres/agences/[agenceId]/modifier` ; l'identifiant de calendrier ne sort plus dans l'URL (voir « Évolutions : fusionner »).
  - Couverture : NOUVEAU.

- **PA-30** — **Vocabulaire mélangé sur un même parcours** — Gravité : Mineur — Nature : Ergonomie
  - Constat : carte « Horaires d'ouverture », titre « Réglage des horaires d'ouverture », colonne « Agence », bouton « Nouvel établissement », retours « ← Tous les établissements » et « Revenir aux établissements » (sans flèche).
  - Preuve : `lib/i18n/fr.ts:2761`, `:2057`, `:2551`, `:2552`, `:2506`.
  - Effet pour l'utilisateur : on ne devine pas que « Horaires d'ouverture » est aussi l'endroit où l'on crée un établissement.
  - Correctif proposé : un mot, « Établissements » (carte, titre, retour), avec la flèche partout.
  - Couverture : NOUVEAU (CG2 ne visait que « ‹ »).

- **PA-31** — **La colonne « Horaires » ne montre que les plages du premier jour travaillé** — Gravité : Mineur — Nature : Bug déduit
  - Constat : jours listés en entier, mais plages et créneaux du seul premier jour ; un samedi à horaires différents (QG-7 : lundi-samedi à rétablir) n'apparaît pas.
  - Preuve : `app/(back-office)/parametres/agences/composants.tsx:102-105` (`const premierJour = jours[0]`) et `:182-190` (`.filter((p) => p.jourSemaine === jourSemaine)`).
  - Effet pour l'utilisateur : la ligne se lit comme « toute la semaine 07:00–17:00 ».
  - Correctif proposé : regrouper les jours à horaires identiques (« lun.–ven. 07:00–17:00 · sam. … »).
  - Couverture : NOUVEAU.

- **PA-32** — **Colonne « Exceptions » et texte d'exception par technicien : aucun écran ne permet d'en poser une** — Gravité : Mineur — Nature : Incohérence
  - Constat : le tableau compte les exceptions et le texte explique « un technicien peut recevoir un autre calendrier » ; aucune route, aucun écran, aucun semis n'écrit `technicien_calendrier`.
  - Preuve : `app/(back-office)/parametres/agences/page.tsx:130-142` ; `lib/i18n/fr.ts:2088-2089` ; `grep -rn "technicienCalendrier\.\(create\|update\|delete\)" lib app` → aucune ligne.
  - Effet pour l'utilisateur : une fonction décrite qu'on ne trouve nulle part.
  - Correctif proposé : retirer colonne et texte jusqu'à l'écran d'exception (ou ajouter ce choix sur la fiche du technicien).
  - Couverture : NOUVEAU.

## /parametres/agences/[id] (fiche des horaires)

- **PA-33** — **« Compteurs d'accusé de réception », jargon au pied du réglage** — Gravité : Mineur — Nature : Ergonomie
  - Constat : le bandeau d'effet rétroactif parle d'un mécanisme interne (le départ du compteur des demandes).
  - Preuve : `lib/i18n/fr.ts:2531-2532` (« le départ des compteurs d'accusé de réception ne bouge pas »).
  - Effet pour l'utilisateur : phrase incompréhensible ; l'information utile (la majoration affichée change aussi pour le passé, cf. PA-03) s'y noie.
  - Correctif proposé : « Les interventions posées restent en place. Le taux d'occupation et la majoration affichée se recalculent, y compris pour les semaines passées. »
  - Couverture : NOUVEAU.

- **PA-34** — **« Ajouter une plage » pré-rempli 08:00–12:00 sur chaque jour, fermé compris** — Gravité : Mineur — Nature : Ergonomie
  - Constat : un clic sur « Ajouter une plage » d'un dimanche fermé l'ouvre de 08:00 à 12:00 ; le commentaire dit que ce ne sont pas des valeurs métier, mais le geste les écrit.
  - Preuve : `app/(back-office)/parametres/agences/[id]/page.tsx:261-272` et `:290-291` (`const DEBUT_PROPOSE = "08:00"; const FIN_PROPOSEE = "12:00";`).
  - Effet pour l'utilisateur : ouverture involontaire d'un jour, donc des créneaux proposés au planning.
  - Correctif proposé : champs vides (requis) ; toute valeur par défaut serait une valeur à fixer par Alexis (CLAUDE.md §8).
  - Couverture : NOUVEAU.

## /parametres/agences/nouvelle et /parametres/agences/[id]/modifier

- **PA-35** — **Territoire : « nc » s'affiche « NC » mais est refusé ; tout code de deux lettres est accepté ; fuseau en saisie libre** — Gravité : Mineur — Nature : Bug déduit
  - Constat : la majuscule n'est qu'un style CSS ; le serveur exige `[A-Z]{2}` sans convertir. Un code sans fériés en base est accepté sans avertissement. Le fuseau est bien validé côté serveur (identifiant IANA connu), mais sans liste, et le refus ne nomme que le territoire.
  - Preuve : `app/(back-office)/parametres/agences/nouvelle/page.tsx:118-126` (`maxLength={2}` + classe `uppercase`) ; `lib/calendar/calendrier.ts:151` `z.string().regex(/^[A-Z]{2}$/` ; `app/api/interventions/actions.ts:70-76` (`champ` ne fait que `trim`) ; `lib/calendar/fuseau.ts:71-81` ; `lib/i18n/fr.ts:2593-2594`.
  - Effet pour l'utilisateur : refus incompréhensible sur une saisie qui s'affiche juste ; établissement créé sans aucun férié possible.
  - Correctif proposé : `toUpperCase()` avant validation ; liste des territoires connus du référentiel de fériés ; liste de fuseaux (ou celui de la société par défaut, déjà prévu) ; refus qui nomme le champ.
  - Couverture : NOUVEAU (les droits : PA-02 ; succès en rouge : PA-05 ; saisie perdue : PA-06).

## /parametres/equipe

- **PA-36** — **Un technicien ajouté ici ne peut jamais se connecter** — Gravité : Majeur — Nature : Bug déduit
  - Constat : « Ajouter » crée l'identité et le rattachement, **pas de compte de connexion** ; aucun écran n'émet de lien de premier accès, et le seul outil qui en émet (`--reemettre` du geste d'amorçage) refuse une identité sans compte. L'écran ne dit rien de l'accès.
  - Preuve : `lib/techniciens/depot.ts:76-80` (« elle n'ouvre ni compte de connexion (`compte`), ni session, ni jeton ») ; `lib/auth/amorcage.ts:461-470` (« ne porte aucun moyen de connexion … la réémission s'arrête ») ; `lib/auth/config.ts:155-158` (aucune demande de réinitialisation depuis un navigateur) ; `lib/i18n/fr.ts:3370-3371` (aide muette sur l'accès).
  - Effet pour l'utilisateur : un nouveau technicien n'ouvre jamais l'application terrain ; rien n'indique ce qu'il manque (sauf si son courriel existait déjà avec un mot de passe).
  - Correctif proposé : « Donner l'accès » depuis la fiche du technicien (émission d'un lien de premier accès), ou compte créé avec l'identité et lien délivré par le flux existant. **Arrêt §8** (authentification : liste close des chemins d'émission, D58/D65).
  - Couverture : NOUVEAU (à rapprocher du lot « terrain — compte technicien de test »).

- **PA-37** — **Nom et courriel non modifiables après création** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la modification ne porte que l'agence et l'état ; une faute de frappe ou « (patenté) » dans le nom ne se corrige qu'en base.
  - Preuve : `lib/techniciens/saisie.ts:29-32` `schemaModificationTechnicien = z.object({ agence_id: z.uuid(), actif: z.boolean() })`.
  - Effet pour l'utilisateur : même après PG-E2 (champ salarié/patenté), le nom restera pollué.
  - Correctif proposé : champ « Nom » modifiable (écriture de l'identité par le chemin déjà utilisé à la création) ; courriel : à arbitrer (clé de connexion).
  - Couverture : NOUVEAU (lié à QG-9 / PG-E2, EN FILE).

- **PA-38** — **Tableau puis seconde liste « Modifier — nom » des mêmes lignes** — Gravité : Mineur — Nature : Ergonomie
  - Constat : même motif que A-02 des habilitations (volets repliés sous le tableau).
  - Preuve : `app/(back-office)/parametres/equipe/page.tsx:202-245` (tableau) et `:253-282` (un `<details>` par technicien).
  - Effet pour l'utilisateur : deux listes des mêmes personnes.
  - Correctif proposé : trancher avec l'arbitrage H1 (volet dépliable DANS la ligne, ou fiche par technicien).
  - Couverture : NOUVEAU (motif de A-02, à trancher avec H1). « (patenté) » dans le nom : EN FILE (QG-9 → PG-E2).

- **PA-39** — **L'équipe est triée par identifiants techniques** — Gravité : Mineur — Nature : Bug déduit
  - Constat : ordre = agence puis utilisateur, tous deux par UUID : ni alphabétique, ni stable pour l'œil (même défaut que le bug 6 du planning, corrigé par PG-A2).
  - Preuve : `lib/techniciens/depot.ts:195` `orderBy: [{ agence_id: "asc" }, { utilisateur_id: "asc" }],`.
  - Effet pour l'utilisateur : on cherche un nom dans une liste sans ordre visible.
  - Correctif proposé : tri par nom (le comparateur partagé de PG-A2).
  - Couverture : NOUVEAU.

- **PA-40** — **Renouveler une habilitation expirée : aucun geste, sauf supprimer puis réattribuer** — Gravité : Mineur — Nature : Ergonomie
  - Constat : une seule attribution par (technicien, habilitation) ; aucune route ne modifie ses dates ; « Retirer » supprime la ligne.
  - Preuve : `prisma/schema.prisma:2714` `@@unique([societe_id, utilisateur_id, habilitation_id])` ; `lib/habilitations/depot.ts:368-376` (`deleteMany`) ; `app/api/habilitations/attributions/` ne porte que `creer` et `[id]/retirer`.
  - Effet pour l'utilisateur : le renouvellement efface la période précédente à l'écran, et le verdict d'une intervention passée change.
  - Correctif proposé : « Renouveler » (nouvelles dates) ; garder l'historique relève d'une migration (**Arrêt §8** si schéma).
  - Couverture : NOUVEAU.

## /parametres/habilitations

- **PA-41** — **Deux listes des mêmes lignes** — Gravité : Mineur — Nature : Ergonomie
  - Constat / Preuve : `app/(back-office)/parametres/habilitations/page.tsx:96-172`. Toujours vrai au commit bcc637e.
  - Couverture : DÉJÀ COUVERT (A-02, arbitrage H1).

- **PA-42** — **« Aide à la saisie » qui n'existe pas ; carte du hub qui promet ce que la page ne fait pas** — Gravité : Mineur — Nature : Incohérence
  - Constat : la durée de validité est dite « une aide à la saisie d'une attribution » ; le formulaire d'attribution (page Équipe) ne la lit pas. La carte du hub annonce attribution et exigences, qui vivent sur Équipe et sur la fiche site. « mois » est écrit en dur dans le composant.
  - Preuve : `lib/i18n/fr.ts:3447-3448` et `:3439-3440` ; `app/(back-office)/parametres/equipe/page.tsx:603-607` (date d'expiration libre) ; `app/(back-office)/parametres/habilitations/page.tsx:316` `const MOIS = " mois";`.
  - Effet pour l'utilisateur : on cherche l'aide et l'attribution au mauvais endroit.
  - Correctif proposé : pré-remplir l'expiration = obtention + durée (modifiable) sur Équipe, ou retirer la phrase ; carte : « Le référentiel des qualifications. Attribution : fiche du technicien ; exigence : fiche du site. » ; « mois » au dictionnaire.
  - Couverture : NOUVEAU.

## /parametres/materiel

- **PA-43** — **130 modèles d'un bloc : une ligne et un volet par modèle, sans recherche ni pagination** — Gravité : Majeur — Nature : Ergonomie
  - Constat : tous les modèles sont lus et rendus deux fois (ligne du tableau + `<details>` « Modifier le modèle ») ; seul un filtre par famille existe. La recherche paginée existe déjà dans le dépôt (sélecteur de modèle).
  - Preuve : `lib/materiel/depot.ts:236-248` (`findMany` sans `take`) ; `app/(back-office)/parametres/materiel/page.tsx:250-297` ; `lib/materiel/depot.ts:310-330` (`rechercherModeles`, `skip`/`take`).
  - Effet pour l'utilisateur : page d'environ 19 000 px (vu en ligne) ; retrouver un modèle = défiler.
  - Correctif proposé : recherche (marque, référence) + « Voir plus » en réutilisant `rechercherModeles` ; familles et modèles sur deux onglets ; lien « Modifier » dans la ligne.
  - Couverture : NOUVEAU (le repli des formulaires, M11/GR17, est fait).

- **PA-44** — **« Entretien périodique » n'alimente rien, et son unité « h » est inventée** — Gravité : Mineur — Nature : Incohérence
  - Constat : les deux périodicités d'entretien ne sont lues par aucun calcul (aucune génération de préventif, aucun rappel) ; tous les modèles affichent « Non périodique ». Le compteur est suffixé « h » alors que le schéma ne fixe aucune unité.
  - Preuve : `grep -rn "periodicite_jours\|periodicite_compteur" lib app components` → uniquement matériel, ses routes et l'import ; `app/(back-office)/parametres/materiel/page.tsx:311-312` (`const JOURS = " j"; const COMPTEUR = " h";`) et `:430-441` ; `prisma/schema.prisma:2616-2619`.
  - Effet pour l'utilisateur : une colonne pleine de « Non périodique » qui ne sert à rien aujourd'hui.
  - Correctif proposé : replier la colonne ou dire « information seulement » tant qu'aucun préventif n'est généré ; unité du compteur : à fixer par Alexis (CLAUDE.md §8).
  - Couverture : NOUVEAU.

- **PA-45** — **Le régime VGP d'une famille ne se déclare nulle part à l'écran ; l'écran renvoie à un registre sans formulaire** — Gravité : Majeur — Nature : Bug déduit
  - Constat : une famille créée ici naît « à déterminer » ; le texte dit que le régime « se déclare à la famille, depuis le registre des VGP » ; aucun écran VGP n'a de formulaire pour le faire (seul l'import de familles écrit `assujettissement_vgp`).
  - Preuve : `lib/i18n/fr.ts:2827-2830` (`materiel.pas_la_vgp`, `materiel.vgp_ailleurs`) ; `lib/materiel/depot.ts:706-719` (`colonnesVgp` : écrit seulement si fourni) ; appelants avec régime : `lib/imports/application.ts:1039`, `lib/imports/annulation.ts:643` ; `app/(back-office)/vgp/a-determiner/page.tsx` (aucun `<form>`).
  - Effet pour l'utilisateur : une obligation réglementaire reste « à déterminer » pour toute famille créée à l'écran ; il faut bâtir un fichier d'import pour la trancher.
  - Correctif proposé : formulaire « Déclarer le régime » sur `/vgp/a-determiner` (règles L9-03/L9-04 déjà en base) ; à confirmer avec l'auditeur du groupe VGP.
  - Couverture : NOUVEAU.

- **PA-46** — **Une famille désactivée reste proposée, et ses modèles aussi** — Gravité : Mineur — Nature : Incohérence
  - Constat : le texte dit « Désactiver les retire du choix » ; le formulaire de modèle liste toutes les familles, la création de modèle n'en refuse aucune, et le sélecteur de modèle de `/parc/nouvelle` ne regarde que l'état du modèle.
  - Preuve : `lib/i18n/fr.ts:2831-2832` ; `app/(back-office)/parametres/materiel/page.tsx:543-554` ; `lib/materiel/depot.ts:500-518` ; `lib/materiel/depot.ts:289-295` (`actif: true` sur le modèle seul).
  - Effet pour l'utilisateur : une famille retirée continue d'être choisie.
  - Correctif proposé : filtrer `actif` sur la famille dans les deux formulaires (en gardant la valeur portée) et dans `filtreDeRechercheModele`.
  - Couverture : NOUVEAU.

- **PA-47** — **Modèle portant un numéro de série dans sa référence** — Gravité : Mineur — Nature : Donnée
  - Constat : vu en ligne ; non vérifiable dans le code. La correction passe par « Modifier le modèle » ; si la référence corrigée existe déjà, l'unicité (marque, référence) refuse, et aucun outil ne fusionne deux modèles.
  - Preuve : `prisma/schema.prisma:2645` `@@unique([societe_id, marque, reference])`.
  - Effet pour l'utilisateur : doublon impossible à résorber sans intervention en base.
  - Correctif proposé : geste d'exploitation (corriger la référence) ; si doublon, « Fusionner dans… » (réaffecte les machines puis désactive) — évolution à arbitrer.
  - Couverture : NOUVEAU.

## /imports

- **PA-48** — **« Télécharger le modèle Excel » inerte** — Gravité : Majeur — Nature : Ergonomie
  - Constat / Preuve : `app/(back-office)/imports/page.tsx:194-204` ; `lib/i18n/fr.ts:690-691`. Toujours vrai au commit bcc637e ; le texte dit « pour ce type d'import » alors qu'aucun type n'est choisi.
  - Couverture : DÉJÀ COUVERT (audit 26/09 B2, chantier C2).

- **PA-49** — **L'import contourne les droits de l'écran** — Gravité : Majeur — Nature : Écart à arbitrer (D130, §5.2)
  - Constat : toutes les routes d'import n'exigent que `importer_exporter`. Résultat : responsable matériel et responsable SAV créent et modifient clients et sites en masse (D130 le leur refuse, « la liste est littérale ») ; ADV, responsable matériel et SAV créent familles (avec leur régime VGP), modèles et prestations que l'écran réserve à l'administrateur et à la direction ; l'administrateur écrit des montants d'historique qu'il ne doit pas lire (D37).
  - Preuve : `app/api/imports/[id]/appliquer/route.ts:99` `exigerCapacite("importer_exporter")` ; `lib/auth/habilitations.ts:160` `importer_exporter: { complet: [ADMS, DIR, RM, ADV], restreint: [RS] },` et `:145` `gerer_client_site: { complet: [ADMS, DIR, ADV] },` ; `docs/arbitrages.md:4762` ; `grep -rn "peut(\|exigerCapacite" lib/imports` → aucun contrôle par type.
  - Effet pour l'utilisateur : ce que l'écran refuse ligne à ligne passe par centaines dans un fichier.
  - Correctif proposé : à l'application (et au contrôle), exiger en plus la capacité de l'entité (`gerer_client_site` pour clients/sites, `parametrer_societe` pour familles/modèles/prestations, `gerer_machine` pour équipements…) ; décision d'Alexis. **Arrêt §8** (droits).
  - Couverture : NOUVEAU.

- **PA-50** — **Journal : type en code technique, seule date = contrôle, plafond de 50 non dit** — Gravité : Mineur — Nature : Ergonomie
  - Constat : la colonne « Type » affiche le code brut (« vgp_observations ») ; la seule date est celle du contrôle, jamais l'application ni l'annulation ; la liste s'arrête aux 50 derniers lots sans le dire (le commentaire affirme que « la liste dit combien elle montre »), et un lot plus ancien n'est plus atteignable, donc plus annulable, depuis l'écran.
  - Preuve : `app/(back-office)/imports/page.tsx:299` `<Cellule mono>{lot.typeImport}</Cellule>` et `:136` ; `lib/imports/depot.ts:346-352` (`take: PLAFOND_LISTE`) et `:368` `export const PLAFOND_LISTE = 50;` ; `lib/i18n/fr.ts:755-756`.
  - Effet pour l'utilisateur : lecture technique ; un lot ancien disparaît du journal.
  - Correctif proposé : `titreDuType` dans la colonne ; colonnes « Appliqué le / Annulé le » ; « Les 50 derniers lots » + page suivante.
  - Couverture : NOUVEAU.

- **PA-51** — **« Contacts — Contrôle seulement » : un type proposé que rien n'applique** — Gravité : Mineur — Nature : Ergonomie
  - Constat / Preuve : `app/(back-office)/imports/types.ts:93-101` (`complet: false`) ; dépôt des contacts à écrire (L1-03b).
  - Effet pour l'utilisateur : on prépare un fichier qui ne sera jamais écrit.
  - Correctif proposé : ne pas lister le type tant que L1-03b n'est pas livré (même logique que D132 pour le menu) — à arbitrer.
  - Couverture : DÉJÀ COUVERT (L1-03b au backlog) pour la fonction ; NOUVEAU pour l'affichage.

- **PA-52** — **Disposition non confrontée à la maquette complète** — Gravité : Mineur — Nature : Écart à arbitrer (D125)
  - Constat : la maquette complète dessine « Imports Excel » avec étapes (Fichier · Contrôle · Confirmation · Résultat), zone de dépôt, bouton « Télécharger un gabarit », « Derniers imports » (Fichier, Type lisible, Lignes, Résultat en pastille, Date). La page vivante suit encore l'ancienne maquette (D95).
  - Preuve : `docs/maquette/codiplan-maquette-complete.html:108` ; `app/(back-office)/imports/page.tsx:48-50` (« D95 lui donne autorité sur la disposition »).
  - Effet pour l'utilisateur : écran différent de la maquette validée.
  - Correctif proposé : confronter bloc par bloc (D125) ; les étapes répondent aussi à PA-53/PA-56.
  - Couverture : NOUVEAU.

## /imports/[id]

- **PA-53** — **« Appliqué » et « ce lot n'a pas encore été appliqué » sur la même page — cause exacte** — Gravité : Mineur — Nature : Bug prouvé
  - Constat : la colonne `duree_application_ms` a été ajoutée le 23/09/2026 à 06:19 (MESURE-1) **sans reprise des lots existants** ; tout lot appliqué avant (dont les lots VGP du 22/09) porte `NULL`. La présentation traduit `NULL` par « non mesurée — ce lot n'a pas encore été appliqué » **quel que soit le statut**. La date affichée sous le statut est celle du **contrôle** : `appliqueLe` et `annuleLe` ne sont jamais montrés.
  - Preuve : `prisma/migrations/20260923120000_duree_application_import_mesure_1/migration.sql:27-28` (`ADD COLUMN "duree_application_ms" INTEGER;`, aucun `UPDATE`) ; `app/(back-office)/imports/presentation.ts:139-141` ; `lib/i18n/fr.ts:818-819` ; `app/(back-office)/imports/[id]/page.tsx:214` `coordonneesDuLot(lot.controleLe, fuseau, lot.auteur)` et `:216-220`.
  - Effet pour l'utilisateur : deux affirmations contradictoires ; la date lue près de « Appliqué » n'est pas celle de l'application.
  - Correctif proposé : message selon le statut (« non mesurée : appliqué avant la mise en place de la mesure » pour un lot `applique` sans durée) ; lignes « Contrôlé le / Appliqué le / Annulé le ».
  - Couverture : NOUVEAU.

- **PA-54** — **Après application, la page montre la proposition du contrôle, pas ce qui a été écrit** — Gravité : Majeur — Nature : Incohérence
  - Constat (DÉDUIT) : titres et détails restent au futur (« Rapport de contrôle », « seront créés », « ne seront pas écrits ») sur un lot appliqué ou annulé. « Nouveaux » et « Modifiés » sont les chiffres du contrôle : les lignes sautées à l'application (parent disparu, fiche absente, écriture refusée) ne sont comptées nulle part, et la route jette les chiffres réels. « Inchangés » est un sous-ensemble de « Modifiés » affiché à côté, et vaut 0 — non mesuré — sur un lot contrôlé ou appliqué avant le 16/09.
  - Preuve : `lib/i18n/fr.ts:776-791` ; `lib/imports/depot.ts:300` `modifications: lot.lignes_modifications,` ; `lib/imports/application.ts:251-252` (« simplement absente des deux listes ») et `:377`, `:429`, `:445` ; `app/api/imports/[id]/appliquer/route.ts:116-120` (seul `imports.applique` est renvoyé) ; `prisma/migrations/20260916120000_lignes_inchangees_import/migration.sql:33` (`DEFAULT 0`).
  - Effet pour l'utilisateur : on croit que N fiches ont été créées ou modifiées alors que moins l'ont été ; un zéro passe pour une mesure.
  - Correctif proposé : stocker à l'application créations, modifications réelles et lignes sautées (migration) ; textes au passé selon le statut ; « Inchangés : non mesuré » tant que le lot n'est pas appliqué. **Arrêt §8** si migration du schéma d'import.
  - Couverture : NOUVEAU.

- **PA-55** — **Les rejets sont listés un par un, même quand ils partagent tous le même motif** — Gravité : Majeur — Nature : Ergonomie
  - Constat : une ligne de tableau par rejet, chacune avec le texte complet du motif (deux phrases pour « rapport introuvable ») ; 308 rejets = page d'environ 19 000 px (vu en ligne). Tout le lot est chargé, lignes comprises.
  - Preuve : `app/(back-office)/imports/[id]/page.tsx:376-413` (`rejetees.map(…)`) ; `lib/imports/depot.ts:387` (`include: { lignes: { orderBy: { rang: "asc" } } }`).
  - Effet pour l'utilisateur : impossible de voir d'un coup d'œil « 300 lignes : rapport introuvable → importer d'abord les vérifications ».
  - Correctif proposé : tableau regroupé par motif (motif, nombre, premières lignes, « Voir les N lignes » replié) ; le fichier des rejets reste le détail complet.
  - Couverture : NOUVEAU.

- **PA-56** — **« Annuler ce lot » : bouton principal, sans confirmation, irréversible** — Gravité : Majeur — Nature : Ergonomie
  - Constat : proposé dès que le lot est « Appliqué » ; conditions serveur : capacité `importer_exporter` (responsable SAV compris), type applicable, statut `applique` — ni délai ni rang (D54). Un clic défait tout ce qui peut l'être et le lot ne se rejoue plus.
  - Preuve : `app/(back-office)/imports/[id]/page.tsx:454-465` (`<ActionPrimaire>{t("imports.annuler")}</ActionPrimaire>`, formulaire POST direct) ; `app/api/imports/[id]/annuler/route.ts:57-72` ; `lib/imports/annulation.ts:207-209` ; `lib/i18n/fr.ts:966` (« il ne se rejoue pas »).
  - Effet pour l'utilisateur : un historique de plusieurs centaines d'interventions ou un registre VGP peut disparaître d'un clic.
  - Correctif proposé : bouton secondaire + dialogue de confirmation qui répète le nombre de fiches concernées (même dialogue que « Annuler » d'une intervention) ; et conserver le détail des lignes refusées à l'annulation (aujourd'hui perdu).
  - Couverture : NOUVEAU.

- **PA-57** — **Lot d'historique : le rattachement affiché est recalculé contre le parc d'aujourd'hui** — Gravité : Mineur — Nature : Incohérence
  - Constat : à chaque affichage, dix index complets sont relus et les rangs recomptés, y compris sur un lot déjà appliqué ; le texte reste au futur (« Chaque ligne qui entrera »).
  - Preuve : `app/(back-office)/imports/[id]/page.tsx:153-163` (`await indexerLesParcs(session.contexte)`) ; `lib/imports/parcs.ts:52-63` ; `lib/i18n/fr.ts:905-906`.
  - Effet pour l'utilisateur : les chiffres d'un lot appliqué changent au gré du parc ; page lente.
  - Correctif proposé : pour un lot appliqué, afficher les rattachements écrits (lignes `intervention_machine` du lot) ; recalcul seulement au statut « Contrôlé ».
  - Couverture : NOUVEAU.

- **PA-58** — **Lot introuvable : page nue, sans titre ni cible du lien d'évitement** — Gravité : Mineur — Nature : Ergonomie
  - Constat : cette branche rend un `<main>` sans le gabarit `Page` (ni titre, ni `id="contenu"`).
  - Preuve : `app/(back-office)/imports/[id]/page.tsx:111-124`.
  - Effet pour l'utilisateur : écran vide de repères.
  - Correctif proposé : rendre `<Page titre=…>` avec le message.
  - Couverture : NOUVEAU.

---

## Évolutions proposées pour ces pages

**Fusionner**
1. **« Horaires d'ouverture » + « Établissements » → une seule entrée « Établissements »** : liste (actifs en tête, inactifs grisés en fin), puis une **fiche établissement** à `/parametres/agences/[agenceId]` réunissant identité (code, nom, territoire, fuseau, état), horaires de la semaine, pas des créneaux et techniciens rattachés. *Pourquoi* : un seul objet métier (l'agence) au lieu de deux adresses pour deux entités (PA-29), plus de calendrier au nom périmé (PA-28), un seul mot (PA-30). Attention : le modèle permet qu'un calendrier serve deux agences ; la fiche doit le dire.
2. **Référentiel matériel** : familles et modèles sur deux onglets, recherche + « Voir plus » (PA-43), nombre de machines par modèle (repère pour les doublons, PA-47).
3. **Rapport d'import** : un seul écran à étapes, conforme à la maquette complète (Fichier · Contrôle · Confirmation · Résultat), dont l'étape « Résultat » dit ce qui a été **écrit** (PA-54), les rejets regroupés par motif (PA-55), et l'annulation confirmée (PA-56).

**Ajouter**
4. **Hub en sections**, sans changer le libellé imposé par la maquette : *Société* (identité, charte) · *Tarifs* (taux horaire, forfaits, majoration en lecture) · *Organisation* (établissements, trajets, équipe, habilitations) · *Référentiels* (matériel, prestations) · *Données* (imports, données à compléter). *Pourquoi* : le titre « Sociétés & tarifs » devient vrai section par section (PA-07), et l'on se rapproche des trois cartes de la maquette (PA-08, à arbitrer).
5. **« Identité de la société »** en lecture à la place de la charte seule : devise, fuseau, territoire, mentions légales du bon, libellé du code externe, majoration hors ouverture (selon PA-01). *Pourquoi* : ce qui décide des factures et des bons doit pouvoir se relire (PA-10) ; c'est la carte « Société » de la maquette.
6. **« Données à compléter »** : une page de comptes cliquables vers les listes existantes — sites sans zone (trajet inconnu), zones sans forfait de déplacement (PA-19), familles VGP « à déterminer » (PA-45), machines « à compléter », clients sans code externe, prestations sans durée, établissements sans plage d'ouverture, techniciens sans accès (PA-36). *Pourquoi* : ces trous faussent la charge, la facturation et le registre sans que personne ne les voie ; la page ne calcule rien de neuf, elle réunit des lectures existantes. La doctrine « aucun décompte » de R3-05 est à rouvrir pour cette page (motif de D88 : afficher « non calculé » si une lecture échoue).
7. **Taux horaire** : statut par ligne (PA-11) et confirmation qui compte les interventions touchées par une date passée (PA-12).
8. **Forfaits** : phrase « Aucun forfait de déplacement pour cette zone : le déplacement n'est pas facturé » (PA-19) ; « Désigné par N interventions » avant modification (PA-23).
9. **Équipe** : « Donner l'accès » (PA-36, **Arrêt §8**), nom modifiable (PA-37), « Renouveler » une habilitation (PA-40), et — à arbitrer — un écran **« Comptes et rôles »** pour les comptes non techniciens (ADV, responsables, direction) : aujourd'hui seul le premier compte (flux GitHub) et les techniciens peuvent naître (`utilisateurSociete.create` n'a que deux appelants : `lib/techniciens/depot.ts:430`, `lib/auth/amorcage.ts:278`), alors que D37 dit que l'administrateur « ouvre les comptes de ses collègues ».
10. **Registre VGP** : formulaire « Déclarer le régime » d'une famille (PA-45).

**Retirer**
11. **Cartes « Clients » et « Sites d'intervention » du hub** : elles sont au menu « Clients & parc » depuis D121 ; le motif R3-05 (« aucun chemin ») est tombé. *Pourquoi* : le hub ne parle plus que de réglages.
12. **Carte « Charte de la société »** jusqu'au lot 7 si l'évolution 5 n'est pas retenue (PA-09).
13. **Case « Cumulable avec le temps passé »** (PA-20, D77), **colonne et texte « Exceptions »** tant qu'aucun écran ne pose d'exception (PA-32), **« Contacts »** de la liste des imports tant que L1-03b n'est pas livré (PA-51), **paragraphe « sans montant »** des prestations (PA-15).
14. **Verdict « Retenu »** pour les natures de forfait que le calcul n'applique pas (PA-18).

**À arbitrer avant toute évolution (points d'arrêt §8)** : qui voit et qui pose un tarif (PA-01, PA-02, PA-25) ; droits propres à chaque type d'import (PA-49) ; valorisation figée à la clôture et historisation du forfait (PA-03, PA-23) ; antidatage du taux (PA-12) ; émission d'un accès technicien (PA-36).

---

## Observations en ligne : confirmées / réfutées

1. Hub titré « Sociétés & tarifs », libellé du menu — **CONFIRMÉE** : `lib/i18n/fr.ts:2747` et `:2926`.
1b. Onze réglages dont « Sites d'intervention » et « Clients » (déjà au menu) — **CONFIRMÉE** : `lib/navigation/portes-parametrage.ts:31-149` (11 portes), `:75`, `:91` ; `lib/navigation/entrees.ts:319-323`.
1c. Ni Imports ni App technicien dans le hub — **CONFIRMÉE** : absents de `PORTES_PARAMETRAGE` ; présents au menu `lib/navigation/entrees.ts:346`, `:357`.
2. `/parametres/societe` « un diagnostic pour l'instant … ne le modifie pas encore », page sans action — **CONFIRMÉE** : `lib/i18n/fr.ts:80-81`, `:88-89` ; aucun formulaire `societe/page.tsx:57-87`.
3. Ancien taux sans statut — **CONFIRMÉE** : `taux-horaire/page.tsx:220-225` (le taux à venir n'en a pas non plus).
3b. Date d'effet passée — **CONFIRMÉE, acceptée sans contrôle** : `lib/tarification/succession-taux.ts:58` ; effet : interventions non clôturées planifiées depuis cette date re-tarifées, clôturées inchangées en base mais affichées recalculées (PA-12, PA-03) ; le texte « sans changer aucune intervention déjà valorisée » n'est vrai que du montant stocké.
3c. Droits — **voit** : tout compte de la société, technicien compris (aucune garde, PA-01) ; **pose** : administrateur de société et direction (○ traité en ●, PA-02).
4. Une seule prestation (donnée) — **NON VÉRIFIABLE** dans le code (donnée) ; « La checklist type arrivera plus tard » — **CONFIRMÉE**, phrase décidée par Alexis le 27/09 (`prestations/page.tsx:66-68`) ; prose longue — **CONFIRMÉE** (même règle deux fois, `fr.ts:2704-2705` et `:2728-2729`).
5. Select de zone sans libellé associé — **CONFIRMÉE** : `forfaits/page.tsx:132-139`.
5b. Zone sans forfait de déplacement à la valorisation — **« 0 silencieux », pas de blocage ni d'avertissement** : total = main-d'œuvre (+ majoration), conforme à D11 (`docs/arbitrages.md:238`) ; code `lib/tarification/valorisation.ts:323-336` ; forfait figé à la création `lib/interventions/depot.ts:379-383` ; ligne omise sur la fiche `interventions/[id]/page.tsx:1300` (PA-19).
6. « 30 min (30 minutes) » — **CONFIRMÉE** : `trajets/page.tsx:280-282` + `lib/calendar/duree.ts:21-23`.
6b. Valeurs de référence — **ÉCRITES DANS UNE DÉCISION** : D107, `docs/arbitrages.md:3631-3640` (trajet aller depuis l'agence de départ unique), recopiées dans `lib/sites/trajet-zone.ts:86-90` ; « Non réglée » partout = aucune ligne `temps_trajet_zone` (donnée).
7. Agence inactive listée en premier et réglable — **CONFIRMÉE** : `agences/page.tsx:128`, `composants.tsx:132-166` (déjà écrit au 27/09 §4.12, non fait).
7b. Deux calendriers de même nom — **CONFIRMÉE, cause trouvée** : libellé copié à la création, jamais renommé (`lib/agences/depot.ts:171-178`, `lib/calendar/depot.ts:299-302`).
7c. Vocabulaire mélangé (h1 / carte / URL / bouton) — **CONFIRMÉE** : `fr.ts:2057`, `:2761`, `:2551`, `:2552`, `:2506`.
7d. `/agences/[id]` = id de calendrier, `/agences/[id]/modifier` = id d'agence — **CONFIRMÉE** : `agences/[id]/page.tsx:104-108` ; `agences/[id]/modifier/page.tsx:59-63`.
7e. « Compteurs d'accusé de réception » — **CONFIRMÉE** : `fr.ts:2531-2532`.
7f. Territoire et fuseau en saisie libre — **CONFIRMÉE pour la saisie libre, RÉFUTÉE pour « sans validation serveur »** : territoire `[A-Z]{2}` (`lib/calendar/calendrier.ts:151`, et CHECK en base), fuseau IANA vérifié (`lib/calendar/fuseau.ts:71-81`) ; mais « nc » est refusé bien qu'affiché « NC » (PA-35).
8. Tableau + seconde liste « Modifier — X » sur Équipe — **CONFIRMÉE** : `equipe/page.tsx:202-245` et `:253-282` ; « (patenté) » — **CONFIRMÉE**, EN FILE (QG-9 → PG-E2), et le nom n'est pas modifiable (PA-37).
9. Page matériel très longue, 130 modèles dans une table — **CONFIRMÉE** : `lib/materiel/depot.ts:236-248` (sans limite) + un volet par modèle `materiel/page.tsx:278-297`.
9b. « Entretien périodique : Non périodique » partout, à quoi sert-il — **RIEN** : aucun lecteur hors écran, routes et import (PA-44) ; « Non périodique » = colonnes nulles (`materiel/page.tsx:430-441`).
9c. Modèle pollué par un numéro de série — **NON VÉRIFIABLE** dans le code (donnée) ; correction possible par « Modifier le modèle », sauf doublon (PA-47).
10. « Télécharger le modèle Excel … pas encore disponible pour ce type d'import » — **CONFIRMÉE** : `imports/page.tsx:194-204`, `fr.ts:690-691` (DÉJÀ COUVERT B2).
10b. Contacts « Contrôle seulement » — **CONFIRMÉE** : `imports/types.ts:93-101` (L1-03b).
10c. Lots « Appliqué » avec beaucoup de rejets — **CONFIRMÉE comme possible** : aucun seuil n'empêche d'appliquer ; seules les lignes acceptées sont écrites (`lib/imports/application.ts:326`, `where: { action: { in: ["creation", "modification"] } }`) ; les PV « en attente » sont comptés en rejets par construction (`fr.ts:938-940`) — donnée.
11. « Appliqué » et « Durée … pas encore été appliqué » sur la même page — **CONFIRMÉE, cause exacte** : colonne ajoutée par MESURE-1 le 23/09 sans reprise (`…mesure_1/migration.sql:27-28`), `NULL` traduit sans regarder le statut (`imports/presentation.ts:139-141`) ; la date sous le statut est celle du contrôle (`imports/[id]/page.tsx:214`) (PA-53).
11b. « Résultat du contrôle … seront créés … ne seront pas écrits » au futur sur un lot appliqué — **CONFIRMÉE** : `fr.ts:776-791`, sans condition de statut ; et les chiffres sont ceux du contrôle, pas de l'application (PA-54).
11c. 308 rejets listés un par un — **CONFIRMÉE** : `imports/[id]/page.tsx:376-413`, aucun regroupement (PA-55).
11d. « Annuler ce lot » toujours proposé — **CONFIRMÉE pour tout lot au statut « Appliqué »** : `imports/[id]/page.tsx:454-465` ; conditions serveur : `importer_exporter` (○ du responsable SAV compris), type applicable, statut `applique`, sans délai (D54) — `annuler/route.ts:57-72`, `lib/imports/annulation.ts:207-209` ; aucune confirmation (PA-56).
