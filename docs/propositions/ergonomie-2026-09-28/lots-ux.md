# Ergonomie, graphisme et usage — découpage en tickets (lots TP-UX)

*28/09/2026. Accompagne `ergonomie-graphisme-usage-2026-09-28.md` et `maquette-toutes-pages.html`. S'adresse au **pilote**, la conversation Cowork qui écrit les tickets de la file.*

**Gabarit habituel**
- « OBLIGATOIRE : TU COMMITES » en tête ;
- `<!-- limite 150m -->` en ligne 3 (210m pour trois parties) ;
- LE CONSTAT mesuré, CE QUE TU FAIS, Territoire ;
- le bloc commun, de « INTERDITS » à « POUR FINIR » ;
- DEUX ROUGES ET TU T'ARRÊTES ;
- les captures AVANT et APRÈS ;
- une passation.

**Découpage** : chaque partie (UX1-a1, UX1-b…) devient la partie d'un ticket regroupé de deux ou trois parties. Une partie qui passe seule, avec un lot fonctionnel, fait un ticket d'une partie (150m).

**Noms** : lots `TP-UX0` à `TP-UX9` ; questions `QE-1` à `QE-19` (numéros 12, 14 et 16 vides ; `QE-13a` à `QE-13e`) ; écarts `É-1` à `É-19` (É-12 retiré) ; principes `PR-1` à `PR-12` ; propositions `PU-1` à `PU-12` ; parcours `U1` à `U8`. Aucun ne se confond avec D…, P1 à P4 (priorités), L…, QG-…, PG-…, QT-… ni AA-…, ni avec les TP-… de l'audit (TP-UX est un préfixe à part).

## Règles avant d'écrire un ticket TP-UX

1. **Remesurer sur `main`** (clone, `git pull`). Les mesures ci-dessous datent de `ca9bcea`.
2. **La maquette montre, le ticket construit.**
   - Ouvrir `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html` (menu « Données fictives » › Sommaire) et la page concernée.
   - Les écrans se reconstruisent avec les composants de `components/ui/` : on ne copie pas le HTML de la maquette.
   - Là où la maquette complète dessine l'écran, elle fait foi (D124, D125), aux écarts nommés près (§6 de la spécification).
3. **Aucune règle de gestion ne change.** La maquette dessine les réponses (a) des QT (séries 1 et 2 répondues le 28/09 ; série 3 supposée, sauf QT-23 : la tuile « Demandes à valider » du produit reste) : un ticket TP-UX ne livre pas une fonction qu'une décision n'a pas débloquée. Il livre la forme et laisse l'emplacement prêt.
4. **Un ticket marqué ⚠ QE-x ne s'écrit qu'après la réponse d'Alexis.**
   - Chaque réponse devient une décision au numéro libre au moment du commit, au format des tests `tests/unit/docs/*arbitrage*` (`forme-arbitrage`, `cablage-arbitrages`, `amendements-arbitrages`) ; un seul ticket de documents par envoi de réponses.
   - QE-13a (a) : une décision qui prolonge D125 sans toucher D95. Chaque lot qui reconstruit un écran que la maquette complète ne dessine pas la cite dans son titre : TP-UX3 à TP-UX9.
5. **Captures et mesure**
   - Tout ticket dépose `docs/propositions/<ticket>/captures/` : AVANT et APRÈS de chaque écran touché ou créé, à 1 280 et 375 px (plus 1 024 px pour la coque), avec un `README.md` (commit photographié, date). Le terrain : 375 px.
   - Scène de démonstration seulement, jamais une donnée de production (I9).
   - **Le ticket le dit en toutes lettres** : « prends des captures d'écran de chaque écran touché ou créé ».
   - À partir de TP-UX1, le ticket joint aussi la mesure du script (textes, cibles, débordements).
6. **Jamais une valeur inventée** (durée, délai, taux, seuil, prix) : « valeur à fixer par Alexis ». Les seuils de la spécification :
   - 12 px — valeur proposée par QE-1 (aucune norme ; D124 met 11 px) ;
   - 32 px — seuil de travail de l'audit du 28/09 ; WCAG 2.5.8 AA exige 24 px ; le bouton de menu vise 44 px (TR-47) ;
   - 44 px — CDC §13.4.
7. **Aucune dépendance nouvelle** sans décision (CLAUDE.md) : les icônes sont dessinées dans le dépôt (QE-2).
8. **Un territoire par ticket** (file des travaux §6) : le ticket utilise les nouveaux composants dans son territoire seulement ; il ne refait pas un écran qu'il ne touche pas.
9. **Rien en parallèle de la file** : une seule session Claude Code.

---

## TP-UX0 — Les documents dans le dépôt (1 ticket, sans code ; à la suite de la file, après 9BK-TP-0-DOCS)

| Ticket | Contenu | Preuve |
|---|---|---|
| **TP-UX0-DOCS** | Depuis le dossier `ergonomie-28-09/` du PC, dans leur version corrigée : `ergonomie-graphisme-usage-2026-09-28.md`, `lots-ux.md`, `maquette-toutes-pages.html` → `docs/propositions/ergonomie-2026-09-28/` ; le dossier `captures/` entier (`bureau-1440/`, `telephone-390/`, `etats/`, `README.md`, `index.json`) → `docs/propositions/ergonomie-2026-09-28/captures/`. Une ligne en tête de `docs/audit-ergonomie-2026-09-28.md` (créé par 9BK-TP-0-DOCS) renvoie à la spécification. Commit seul. | `git show --stat` : aucun fichier de code ; la maquette s'ouvre hors ligne (police embarquée). |

## TP-UX1 — Fondations visuelles (⚠ QE-1, QE-2, QE-13b ; 3 tickets ; après TP-I9, avant DEPLANIFIEE-1)

**Constat mesuré à `ca9bcea`** : 171 classes de texte sous 12 px dans 49 fichiers.

| Taille | Classes |
|---|---|
| `text-[11px]` | 69 |
| `text-[11.5px]` | 72 |
| `text-[10.5px]` | 23 |
| `text-[10px]` | 1 |
| `text-[9px]` | 6 |

- Mesure : `grep -rEo 'text-\[(9|1[01])(\.[0-9])?px\]' components app --include=*.tsx | wc -l`, et `grep -rEl` (même motif) pour les fichiers.
- Répartition : `components/ui/` 10 classes dans 9 fichiers (`tableau`, `pagination`, `maitre-detail`, `champ`, `carte`, `badge`, `selecteur-recherche`, `kpi`, `carte-entite`) ; `components/navigation/{barre,marque}.tsx` 3 ; `components/{parc/formulaire-machine,interventions/site-et-machines}.tsx` 4 ; `app/` 154 dans 36 fichiers, dont `app/(back-office)/planning/page.tsx` 27.
- Tests qui figent une taille sous 12 px (huit attentes) : `tests/unit/ui/composants-maquette.test.ts` l.241-242, 299-300, 339-340, 370-371, 407-408, 617-618 ; `tests/unit/ui/carte-entite.test.ts` l.140-141 ; `tests/e2e/ecrans-largeur-utile.spec.ts` l.125.
- Le menu du produit n'a aucune icône (`components/navigation/barre.tsx:327-396`) ; la maquette complète y dessine des glyphes Unicode.

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX1-d Mesure** (en premier) | `scripts/captures.mts` mesure et écrit, pour chaque capture : textes sous 12 px, cibles sous 32 px à 375 px (44 px sur le terrain), débordement horizontal, erreurs de console. Le résultat va dans le README des captures. | `scripts/captures.mts`, `scripts/etat-des-captures.mts` | le README du ticket porte la mesure AVANT |
| **UX1-a1 Échelle, jetons, composants** | Échelle 12 / 13 / 14 / 15 / 16 / 18 / 24 / 28 px (§3.2) ; plus aucune classe sous 12 px dans `components/ui/` et `components/navigation/` ; focus visible (anneau 3 px) ; chiffres tabulaires pour montants et heures. **Aucune couleur nouvelle** (D124). Les huit attentes de 10,5 et 11 px passent à 12 px, en citant la décision QE-1 (a) écrite dans `docs/arbitrages.md` (elle amende D124 pour la typographie) : c'est le seul cas où ces tests changent. | `app/globals.css`, `components/ui/*.tsx`, `components/navigation/{barre,marque}.tsx`, `tests/unit/ui/composants-maquette.test.ts`, `tests/unit/ui/carte-entite.test.ts`, `tests/e2e/ecrans-largeur-utile.spec.ts` | `grep` (motif ci-dessus) : zéro dans le territoire ; tests verts ; captures |
| **UX1-a2 Pages d'exploitation** | Même échelle dans les pages : planning, interventions (registre, fiche, bon, création), demandes, absences, tableau de bord, arrivée, contacts. | `app/(back-office)/{planning,interventions,demandes,absences,tableau-de-bord,arrivee,contacts}/**` | `grep` : zéro dans le territoire ; captures |
| **UX1-a3 Autres pages** | Même échelle : clients, sites, parc, VGP, paramètres, imports, terrain, portail, et les deux composants métier. | `app/(back-office)/{clients,sites,parc,vgp,parametres,imports}/**`, `app/(mobile)/terrain/**`, `app/(portail)/portail/page.tsx`, `components/parc/formulaire-machine.tsx`, `components/interventions/site-et-machines.tsx` | `grep` : zéro sur tout le dépôt ; zéro texte sous 12 px sur les pages de la scène |
| **UX1-b Icônes** | `components/ui/icone.tsx` : une planche SVG au trait (1,8 px, grille 24), les icônes de la maquette (source : objet `ICONS` de `maquette-toutes-pages.html`, 104 icônes, dessin maison, libre) ; le menu, les boutons et les tuiles les emploient. | `components/ui/icone.tsx` (nouveau), `components/navigation/barre.tsx`, `components/ui/{button,kpi}.tsx` | test : chaque entrée du menu a une icône ; captures du menu à 1 280, 1 024 et 375 px |
| **UX1-c Composants de base** | Bouton (primaire unique par zone), pastille (12 px, le mot toujours), **puce de priorité**, **tuile cliquable** (barre de couleur, chevron : QE-13b), **bande de décomptes**, message (titre + une ligne + action), état vide (pourquoi + quoi faire), onglets à compteur. | `components/ui/{button,badge,kpi,carte,etat-vide}.tsx`, nouveaux `components/ui/{priorite,bande-decomptes,onglets,message}.tsx` | tests de rendu ; captures du tableau de bord et du registre |

**Tickets** : TP-UX1-1 = UX1-d + UX1-a1 ; TP-UX1-2 = UX1-a2 + UX1-a3 ; TP-UX1-3 = UX1-c + UX1-b.

## TP-UX2 — Coque (⚠ QE-3 à QE-6 ; décisions de l'audit pour TP-NAV ; 2 tickets ; avec TP-NAV, en fin de file)

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX2-a Bandeau** | Recherche globale (Ctrl K et « / », sans accents, groupes Interventions · Clients · Sites · Machines · Pages) ; « Créer » (intervention, absence, machine ; client et site selon le rôle) ; aide et raccourcis ; le retour (fil d'Ariane ou « ← ») selon la décision de l'audit (TP-NAV ; I-13, TR-48 à TR-51). La largeur utile ne change pas (1 400 px, planning compris) ; le « Plein écran » du planning est celui de PG-C6 (QG-1), hors TP-UX. | `components/navigation/barre.tsx`, `components/navigation/titre-du-bandeau.ts`, nouveaux `components/navigation/{fil-d-ariane,recherche-globale,menu-creer}.tsx`, nouveau `app/api/recherche/route.ts` (groupée, bornée par société et par rôle ; les routes par type `app/api/recherche/{clients,site,sites,modeles}` existent déjà), `lib/i18n/fr.ts` | e2e : « 0452 » ouvre l'intervention ; un n° de série ouvre la machine ; la recherche d'un technicien ne rend que son périmètre (QT-2) |
| **UX2-b Menu** | Rail de 76 px entre 900 et 1 199 px, « Réduire le menu », préférence gardée sur l'appareil ; décomptes : demandes à qualifier, interventions à planifier (rouge si P1), réserves VGP à traiter (quand MO-3 existe) ; ce qui ne s'ouvre pas n'y est pas (D132). | `components/navigation/barre.tsx`, `lib/navigation/entrees.ts` | test : décompte du menu = lignes de la liste ; captures à 1 280, 1 024 et 375 px |
| **UX2-c Téléphone** | Barre basse (Accueil, Planning, Interventions, Parc, Plus) ; bouton « + » seulement sur les pages qui n'ont pas leur propre bouton de création ; actions de la page collées en bas ; dialogues en feuille basse ; le chemin devient un lien de retour « ‹ Parent » (sa forme : décision de l'audit, TP-NAV) ; bouton de menu à 44 px (TR-47). | `components/navigation/bandeau-mobile.tsx`, nouveau `components/navigation/barre-basse.tsx`, `components/ui/{bouton-confirmation,action-primaire}.tsx` | captures à 375 ; mesure : cibles ≥ 32 px |
| **UX2-d Glossaire** | Après la décision de l'audit (TP-NAV) : les mots du §8 à l'écran, puis le gardien du vocabulaire étendu aux synonymes (changer un gardien est une décision). | `lib/i18n/fr.ts`, test du vocabulaire | test : aucun synonyme écarté dans les valeurs affichées |

## TP-UX3 — Gabarit de liste (⚠ QE-8, QE-10, QE-13c à QE-13e ; QE-13a pour les demandes, À facturer et les réserves VGP ; 2 tickets et 3 parties rattachées ; après TP-UX1 ; une liste qu'un lot fonctionnel modifie passe avec lui)

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX3-a Composants** | Filtres : listes déroulantes de D122 (registre, planning, priorités : « Tous » tant que rien n'est choisi, « Effacer les filtres ») ; puces (compteur, état actif, retrait) dans les listes clients, sites, parc, VGP, imports, selon QE-10 ; ligne de résumé « N résultats · tri : … » ; densité « Confort · Compact » ; sélection multiple et barre d'actions selon l'onglet ; cartes au téléphone (même contenu que la ligne) ; filtres dans l'adresse (IN-10). | `components/ui/{barre-de-filtres,tableau,pagination}.tsx`, nouveaux `components/ui/{puces-filtre,liste-cartes,barre-selection}.tsx` | tests de rendu ; e2e : filtre gardé au retour de fiche |
| **UX3-b Registre** | 8 onglets (§5.3), chacun son ordre écrit (IN-09) et ses colonnes ; « À contrôler » après TP-CY (Terminer) ; « À facturer » avec TP-MOD (QT-19) : trois décomptes en lecture, dont « Plus ancienne clôture », qui ouvre l'intervention. Filtres en listes déroulantes (D122) : Technicien, Priorité, Nature, Statut (onglet « Toutes »), « Suivi » (retours sous 30 jours au sens de RG-INT-10 amendée par D25 — un curatif sur une machine dont un curatif a été clôturé dans les 30 jours, ni préventif ni garantie ; sous garantie ouvertes ; sans durée prévue : le critère du décompte qui y mène) ; densité « Confort · Compact » ; période invalide dite (IN-07). Sélection selon l'onglet : « Transmettre… » sur « Aujourd'hui » (après PG-G14, seulement les planifiées), « Exporter » ailleurs (MO-9) ; jamais de pose en lot (D106). | `app/(back-office)/interventions/{page.tsx,presentation.ts}`, `lib/interventions/depot.ts` | test : compteur d'onglet = lignes ; chaque choix de « Suivi » = le décompte qui y mène ; captures à 1 280 et 375 |
| **UX3-c Clients, sites, parc, imports** | Même gabarit, filtres en puces selon QE-10 (sinon listes déroulantes, D122) : clients et sites (cartes, D123 ; puces à décompte ; tri ; donneur d'ordre et compteurs après QE-13c), parc (puces dont « Sorties du parc »), imports. | `app/(back-office)/{clients,sites,parc,imports}/page.tsx` ; fonctions de dépôt groupées de `lib/clients/`, `lib/sites/` après QE-13c | captures |
| **UX3-d Demandes** (avec TP-DEM) | Onglets « À traiter » (nouvelles et qualifiées) et « Traitées » (IN-40) ; tableau du §5.3 ; « + Demande » en volet ; états et sources : les listes closes du produit (`StatutDemande`, `SourceDemande`). | `app/(back-office)/demandes/page.tsx` | captures ; compteur d'onglet = lignes |
| **UX3-e Absences** (avec PG-G15 et TP-ABS) | Les décomptes du produit gardés (« Absences ce mois », « Rupture de service », « Demandes à valider : sans objet » tant que QT-23 n'est pas répondue) ; semaine en calendrier ; blocs « Interventions rendues à la file à planifier » et « Rupture de service » (D128) ; les 4 prochaines semaines en bandes (après QE-13e) ; tableau et onglets du §5.3. | `app/(back-office)/absences/page.tsx` | captures ; compteur d'onglet = lignes |
| **UX3-f VGP** (avec TP-VGP) | Onglets (après QE-13d), tuiles, filtres (puces selon QE-10), interrupteurs ; ordre de QT-13 (a), compte et pagination ; réserves : « Créer l'intervention » ouvre un court dialogue (nature et priorité obligatoires, rien de choisi d'avance ; durée facultative ; description reprise de la réserve). | `app/(back-office)/vgp/page.tsx` | captures ; hauteur de la page mesurée avant/après |

**Tickets** : TP-UX3-1 = UX3-a + UX3-b ; TP-UX3-2 = UX3-c. UX3-d, UX3-e et UX3-f passent chacune avec leur lot.

## TP-UX4 — Gabarit de fiche (⚠ QE-9 ; QE-13a pour les fiches que la maquette complète ne dessine pas ; 2 tickets)

Place : composants et fiche intervention après TP-CY ; son onglet Valorisation après TP-ARG (d'ici là, la forme seule) ; fiches client, site et machine après TP-UX3.

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX4-a Composants** | En-tête de fiche (surtitre, titre = l'objet, pastilles, faits, actions) ; bandeau d'état ; **frise d'étapes** D8 (réduite au téléphone) ; onglets ; colonne de contexte collante ; bloc « À traiter » ; chronologie unique ; historique à ordre unique (comparateur de TP-A1). | `components/ui/fiche.tsx`, nouveaux `components/ui/{frise-etapes,bandeau-etat,colonne-contexte}.tsx` | tests de rendu |
| **UX4-b Fiche intervention** (après TP-CY) | Onglets Résumé, Temps, Rapport, Valorisation (la forme seule jusqu'à TP-ARG), Historique ; le Résumé montre le lien vers la demande d'origine ou la réserve VGP quand il existe (aucun champ « Origine » : le schéma n'en a pas) ; actions par statut (§5.3) ; « ⋯ » : « Changer la priorité… » et « Annuler l'intervention… » (motif) sur une à planifier, une planifiée, une affectée, une suspendue et une en cours (D8 à la lettre, QT-4 a), plus « Remettre dans la file » sur une planifiée, une affectée ou une suspendue ; sur une terminée, « Bon d'intervention (version client) » et « Rouvrir » ; jamais « Annuler » sur une terminée ni sur une clôturée (matrice D8) ; un libellé par geste : « Déplacer… » pour une intervention déjà datée, en retard comprise, « Remettre dans la file » ; « Suspendre… » : motif, rien de choisi, et précision (pièce : référence et date ensemble, RG-INT-06). Terminée : le bloc « Avant de clôturer » en tête du Résumé (PU-9 : rapport validé, signature ou motif, temps mesuré avec compteur arrêté, temps validé, montant figé) ; « Valider le rapport » (responsables, direction, administrateur ; jamais l'ADV) fixe le temps validé ; « Corriger le temps validé… » pour les responsables et l'ADV — la lecture de D120 et sa limite sont écrites au §5.3, le ticket les cite ; « Clôturer » désactivé tant qu'une ligne manque (après QT-4, QT-5, QT-7 ; l'état « rapport validé » est à créer : IN-20, §1.2 de l'audit, avec TP-CY ; migration, point d'arrêt). | `app/(back-office)/interventions/[id]/page.tsx`, `components/interventions/*` | captures à 1 280 et 375 dans chaque état de la scène (à planifier, en cours, terminée, clôturée, reprise de l'archive) |
| **UX4-c Fiches client, site, machine** (après TP-UX3) | Client ; site (« VGP du site », « Qui sera prévenu ») ; machine (identité D126, VGP et réserves, gestes après QT-12, étiquette ; « Sortir du parc » et « Remplacer » avec des interventions ouvertes : un avertissement qui les liste — les refuser est une proposition, à poser avec TP-PARC). | `app/(back-office)/{clients/[id],sites/[id],parc/[id]}/page.tsx` | captures des trois fiches, à 1 280 et 375 |

**Tickets** : TP-UX4-1 = UX4-a + UX4-b ; TP-UX4-2 = UX4-c. L'onglet Valorisation se complète avec TP-ARG.

## TP-UX5 — Gabarit de formulaire et volets (⚠ QE-13a ; 1 ticket et 2 parties rattachées)

Place : composants et créations après TP-UX1, en gardant ce que PG-G7 a livré ; client et site avec TP-CLI ; absence avec PG-G15 et TP-ABS.

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX5-a Composants** | Sections numérotées ; « (obligatoire) » ; aide « ? » (une phrase) ; **choix visibles** pour 6 options ou moins (priorité, état ; la nature reste une liste), aucun choisi à l'avance quand le schéma l'imposait sans arbitrage (IN-02, IN-28, PV-28) ; erreur sous le champ avec la correction ; saisie gardée au refus ; double envoi bloqué ; **volet** latéral de 440 px (la fenêtre de pose n'en est pas un : c'est une fenêtre, celle des lots PG-B2 et PG-B3, que la maquette dessine à 880 px). | `components/ui/{champ,case-a-cocher,selecteur-recherche}.tsx`, nouveaux `components/ui/{choix,volet}.tsx` | tests de rendu ; e2e : refus → saisie gardée |
| **UX5-b Créations** | Nouvelle intervention (§5.3) : deux sections, « Qui et où » et « Ce qui est demandé » ; recherche unique ; les machines du site en choix, « Sans machine », « Machine non listée » (une au plus, facultative, PARCOURS-1) ; nature en liste et priorité sans valeur imposée ; « Machine à l'arrêt » (propose P1, QG-10) avec PG-G17 ; durée facultative en choix rapides (PG-B6) ; contact sur place et référence client facultatifs ; alertes de doublon et de retour avant d'enregistrer (retour : RG-INT-10 amendée par D25, un curatif sur une machine dont un curatif a été clôturé dans les 30 jours ; la même lecture que le tableau de bord et le registre, à écrire) ; « Qui sera prévenu » nomme le donneur d'ordre ; un seul bouton « Créer », puis « Planifier maintenant » ou « Laisser dans la file ». Nouvelle machine (doublon, état limité) ; vérification VGP (état actuel à côté) ; nouvelle agence (listes). | pages `interventions/nouvelle`, `parc/nouvelle`, `parametres/agences/nouvelle`, `vgp/enregistrer/[id]` ; `components/parc/formulaire-machine.tsx`, `components/interventions/site-et-machines.tsx`, `components/vgp/*`, `components/agences/*` | e2e : `?client=` / `?site=` / `?machine=` pré-remplissent, retour vers `?depuis=` ; captures |
| **UX5-c Client et site** (avec TP-CLI) | Nouveau client (doublon) ; nouveau site (adresse après QT-18, zone, horaires d'accès). | `app/(back-office)/{clients,sites}/nouveau/page.tsx` | captures |
| **UX5-d Absence** (après PG-G15, avec TP-ABS) | Volet : technicien, du, au, demi-journée ou plage ; ni type, ni motif, ni note (R3-14) ; impact « N interventions repasseront à planifier » (RG-PLA-06, automatique). | volet de `app/(back-office)/absences/page.tsx` et du planning | captures ; e2e : l'impact annoncé = les interventions rendues |

**Tickets** : TP-UX5-1 = UX5-a + UX5-b. UX5-c et UX5-d passent chacune avec leur lot.

## TP-UX6 — Tableau de bord et indicateurs (⚠ QE-7 ; QE-13a et QT-20 pour les indicateurs ; 1 à 2 tickets)

Place : tableau de bord après TP-UX3 ; Indicateurs du mois avec le reste de TP-MOD, après QT-20.

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX6-a Par rôle** | Les cinq compositions du §5.3 (ADV : À planifier, Aujourd'hui, En retard, À facturer, plus « à transmettre aujourd'hui » ; responsable matériel : À planifier, En retard, Réserves VGP sans intervention, Suspendues, plus « garanties qui finissent », seuil à fixer ; responsable SAV : À contrôler, Aujourd'hui, Suspendues, Retours sous 30 jours, plus « sous garantie ouvertes » ; direction : Clôturé du mois, En retard, Parc suivi, À facturer, plus « P1 à planifier » ; administrateur : Accès à ouvrir, Données à compléter, Import en contrôle, Parc suivi, plus habilitations expirées, à renouveler à 60 jours, sites sans trajet) ; dans chacune, la bande des trois décomptes communs (demandes en attente de qualification et techniciens indisponibles aujourd'hui, gardés par D128 ; interventions sans durée prévue, TABLEAU-1) avant le décompte du rôle ; alerte P1 en tête pour l'ADV et les responsables ; « Interventions sans durée » à la place d'« Activité récente », comme le produit (TABLEAU-1) ; le journal pour la direction et l'administrateur seulement (`consulter_journal_audit`) ; les alertes du CDC §16.1 là où elles servent (rapport non validé depuis plus de 48 h, retour sous 30 jours selon RG-INT-10 amendée par D25, habilitation à J-60, demande non qualifiée après 30 minutes) ; charge par technicien seulement (D111) — la charge des 4 prochaines semaines est un tableau, une ligne par technicien —, jamais un pourcentage d'équipe ; tuiles et décomptes cliquables vers la liste de même critère (IN-47) ; annulées exclues (IN-46) ; « Priorités » : filtre en liste déroulante (D122), une action par ligne, nombre de lignes à fixer (IN-49). | `app/(back-office)/tableau-de-bord/{page.tsx,presentation.ts}`, `lib/interventions/depot.ts` (lectures déjà bornées par société et par la RLS) ; jamais `lib/reporting/` (D21, D38) | test par tuile : chiffre = lignes de la liste ouverte ; captures des cinq rôles |
| **UX6-b Mise en route** | PU-1 : les 8 étapes, chacune lue dans l'existant (identité de la société ; agence, horaires et fériés ; taux horaire ; trajets et forfaits de déplacement ; référentiel matériel et régimes VGP ; équipe ; clients, sites et machines importés ; premier planning transmis). Étape 1 lue seulement ; étapes 3 et 4 selon PA-01 (D37) ; étape 6 après TP-ACC ; étape 8 après PG-G14. | tableau de bord de l'administrateur | test : une scène vide montre 0 sur 8 |
| **UX6-c Indicateurs du mois** | Après QT-20 : décomptes du mois et du mois précédent, sans objectif (MO-6). | nouvelle `app/(back-office)/indicateurs/page.tsx` | captures |

## TP-UX7 — Terrain (⚠ QE-11 ; QE-13a pour les écrans que la maquette complète ne dessine pas (elle n'a que « Mon intervention ») : journée, rapport, signature, scan, fiche machine, mes machines, profil ; QT-2, QT-4, QT-5 ; avec TP-TER, après TP-CY et avant TP-ACC ; UX7-d avec TP-PARC)

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX7-a Navigation, journée, profil** | Barre basse (Journée, Machines, Scanner, Profil) ; bandeau avec l'état du réseau (en ligne seulement, D121 : « Pas de réseau : rien n'est enregistré tant qu'il ne revient pas ») ; bandeau du compteur en cours ; ce qui est transmis (QG-5) : aujourd'hui, demain, la semaine ; annulées absentes (TR-14) ; profil (habilitations et échéances, ses 7 prochains jours avec sa propre absence, QT-2 a). | `app/(mobile)/terrain/page.tsx`, composants terrain | captures à 375 ; mesure : cibles ≥ 44 px |
| **UX7-b Intervention** | À démarrer ; en cours : la carte du compteur avec « Mettre en pause » (acquis du produit, `terrain.compteur.pause` : le segment se ferme, le statut reste « En cours ») et « Reprendre le compteur » (nouveau libellé de la relance, aujourd'hui « Démarrer l'intervention ») ; en bas, « Suspendre » (change le statut : motif obligatoire ; pièce : référence ET date, RG-INT-06) et « Terminer » ; terminée ; demande, machine, sur place, contact, historique (TR-22). Aucune position enregistrée (CDC §15 : hors TP-UX). | `app/(mobile)/terrain/[id]/page.tsx`, `lib/i18n/fr.ts` | e2e : « Mettre en pause » laisse « En cours » ; « Terminer » passe en Terminée (QT-4) |
| **UX7-c Rapport et signature** | « Terminer » ouvre le rapport puis la signature : prestations en choix, commentaire (dictée du navigateur), suite à donner (facultative), photos ; signature avec nom et fonction du signataire (champs existants, 76-BON-4), ou client absent avec motif (QT-5). | idem, `components/interventions/signature-terrain.tsx`, `lib/interventions/depot-rapport-terrain.ts` | e2e ; captures |
| **UX7-d Scanner et machines** | Avec TP-PARC, après QT-10 : scan ; fiche machine terrain ; « Mes machines » (QT-2). « Machine express » attend le hors ligne (différé le 19/09). | nouvelles pages sous `app/(mobile)/terrain/` | captures |

## TP-UX8 — Accès (⚠ QE-13a : la maquette complète ne dessine aucun de ces écrans ; QE-17 pour UX8-a, QE-18 pour UX8-b ; 2 parties ; UX8-a avec TP-S, UX8-b avec TP-ACC)

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX8-a Connexion et second facteur** | Connexion en deux panneaux ; erreur neutre (ni l'existence du compte, ni les essais restants) ; « Rester connecté » seulement si QE-17 le décide ; code avec « code de secours » (TR-34) ; code faux sans retour au mot de passe (TR-39) ; enrôlement en trois étapes, QR, **rien dans l'adresse** (TR-36, avec TP-S) ; « Se déconnecter ». | `app/(sans-session)/{connexion,connexion/code,enrolement}/page.tsx`, `components/session/formulaire.tsx` | e2e : l'URL ne contient aucun secret ; captures |
| **UX8-b Premier accès et société** | Attend QT-1 (a, répondue) et TP-ACC. Premier accès par lien (8 caractères au moins ; lien valable une heure ; écran « Ce lien n'est plus valide ») ; mot de passe oublié : « Demandez un nouveau lien d'accès à votre administrateur » (formulaire seulement si QE-18 le décide) ; choix de la société (TR-29). | `app/(sans-session)/premier-acces/page.tsx`, `app/(back-office)/arrivee/page.tsx`, nouvelle page « mot de passe oublié » | captures |

## TP-UX9 — Impression (⚠ QE-13a pour le bon et le registre VGP imprimable, que la maquette complète ne dessine pas ; QE-15 pour le bon ; QT-8, QT-10, QT-11 ; 3 parties, à trois moments : bon avec TP-ARG, étiquette avec TP-PARC, registre avec TP-VGP)

| Partie | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|
| **UX9-a Bon** (avec TP-ARG) | Hors de la coque ; versions client (sans montant, QT-8) et interne ; date de réalisation, adresse, cadres de signature avec nom et fonction du signataire (IN-36 à IN-38) ; société émettrice : raison sociale et mentions légales (QE-15). | `app/(back-office)/interventions/[id]/bon/page.tsx`, `components/interventions/actions-bon.tsx`, `app/globals.css` (impression) | capture de l'aperçu d'impression ; test : version client sans montant |
| **UX9-b Étiquette** (avec TP-PARC) | Étiquette seule, à son format (valeur à fixer), désignation et n° de série sous le QR (après QT-10, QT-11). | `components/ui/qr-code.tsx`, `app/(back-office)/parc/[id]/page.tsx` | capture d'impression |
| **UX9-c Registre VGP** (avec TP-VGP) | Registre VGP imprimable par client (MO-12). | `app/(back-office)/vgp/page.tsx` | capture d'impression |

---

## Ordre proposé dans la file

L'ordre de QT-26 (a) ne change pas ; les TP-UX s'y insèrent.
- TP-UX0-DOCS à la suite de la file, APRÈS 9BK-TP-0-DOCS (il ajoute une ligne à `docs/audit-ergonomie-2026-09-28.md`, que 9BK crée) : documents seuls, commit seul, dans leur version corrigée.
- TP-UX1 (fondations) après TP-I9 et avant DEPLANIFIEE-1 : cela retarde le circuit de trois tickets ; le dire à Alexis avant de déposer. Aucun autre TP-UX de code avant lui (TP-UX0 est un lot de documents).
- TP-UX8-a avec TP-S ; TP-UX8-b avec TP-ACC.
- TP-UX7 avec TP-TER (le lot terrain), après TP-CY et avant TP-ACC ; le scan et « Mes machines » (UX7-d) avec TP-PARC.
- TP-UX4 :
  - fiches client, site et machine après TP-UX3 ;
  - fiche intervention après TP-CY ;
  - son onglet Valorisation après TP-ARG : d'ici là, la forme seule.
- TP-UX5 : création d'intervention après TP-UX1, en gardant ce que PG-G7 a livré ; client et site avec TP-CLI ; absence avec PG-G15 et TP-ABS.
- TP-UX3 : listes après TP-UX1 ; registre VGP avec TP-VGP (TP-A2 est déjà passé) ; une liste qu'un autre lot modifie passe avec lui (absences avec TP-ABS, demandes avec TP-DEM).
- TP-UX9 en trois parties : bon avec TP-ARG, étiquette avec TP-PARC, registre imprimable avec TP-VGP.
- TP-UX6 : tableau de bord après TP-UX3 ; Indicateurs du mois avec le reste de TP-MOD, après QT-20.
- TP-UX2 avec TP-NAV, à sa place en fin de file. L'avancer serait une autre réponse à QT-26 : poser la question à Alexis.
- Les règles de l'audit tiennent : TP-S avant tout compte technicien ; « Terminer » avant la matrice D8 ; « À facturer » après TP-ACC et TP-CY.

**Dans la file, cela donne** (les places que les règles laissent libres — TP-UX3-1 et -2, TP-UX5-1, TP-UX4-2, TP-UX6 — sont proposées après le circuit) :
1. TP-UX0-DOCS, après 9BK-TP-0-DOCS.
2. PG jusqu'à PG-G10, avec TP-A1…A6 puis TP-I9 intercalés.
3. TP-UX1 (3 tickets).
4. DEPLANIFIEE-1 → PG-G14.
5. TP-S avec TP-UX8-a → TP-CY, puis TP-UX4-1 (composants de fiche et fiche intervention) → TP-TER avec TP-UX7 (sans UX7-d) → TP-ACC avec TP-UX8-b → TP-ARG avec le bon (TP-UX9-a) et l'onglet Valorisation → « À facturer ».
6. TP-UX3-1 et TP-UX3-2 (composants, registre, clients, sites, parc, imports) → TP-UX5-1 (composants, créations) → TP-UX4-2 (fiches client, site, machine) → TP-UX6 (tableau de bord et mise en route).
7. PG-G11…G13 ; PG-G15 avec TP-ABS, UX5-d (volet d'absence) et UX3-e (page Absences) ; PG-G16 ; PG-G17 avec TP-PARC, l'étiquette (TP-UX9-b) et UX7-d.
8. TP-VGP avec UX3-f (registre VGP) et TP-UX9-c ; TP-CLI avec UX5-c (client et site) ; TP-DEM avec UX3-d (demandes) ; TP-NAV avec TP-UX2 ; reste de TP-MOD avec UX6-c (Indicateurs du mois).

**Ce qui ne doit pas arriver**
- Un lot TP-UX qui change une règle de gestion.
- Une valeur métier inventée pour remplir une maquette.
- Une bibliothèque ajoutée sans décision.
- Un écran refait en copiant le HTML de la maquette au lieu des composants.
- Un lot qui sort de son territoire, ou refait un écran qu'il ne touche pas.
- Des captures faites sur des données de production.
- Deux sessions Claude Code en même temps.
