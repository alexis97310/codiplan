# Ergonomie, graphisme et usage — toutes les pages de CODIPLAN (28/09/2026)

*Complète l'audit de toutes les pages du même jour (`audit-ergonomie-2026-09-28.md`), qui disait ce qui ne va pas. Celui-ci dit à quoi les pages doivent ressembler et comment on s'en sert. La maquette cliquable `maquette-toutes-pages.html` (même dossier, « la maquette du 28/09 ») montre chaque page ; ses captures sont dans `captures/`, avec un `README.md`. La planche Design « CODIPLAN, toutes les pages » les montre toutes côte à côte (lien donné à la livraison, hors du dépôt).*

- **Base** : dépôt au commit `ca9bcea` ; production observée au commit `bcc637e` (audit du 28/09) ; réponses d'Alexis du 28/09 (`decisions-2026-09-28.md`, déposé avec l'audit).
- **Maquette du 28/09** : 68 vues au Sommaire (49 refondues, 14 nouvelles, 4 fusionnées, 1 hors V1), bureau et téléphone. **Données fictives** : raisons sociales vérifiées absentes de la production le 28/09, noms des techniciens et des personnes vérifiés absents de la page Équipe, marques et organismes absents du référentiel et du registre VGP ; adresses inventées (aucune rue réelle) — seuls des communes et des quartiers réels sont nommés, parce que les zones de déplacement et les trajets en dépendent. Rien n'y est enregistré.
- **Charte** : gardée (couleurs, police Inter, rayon, ombre de `docs/maquette/codiplan-maquette-complete.html`, ci-dessous « la maquette complète », D124). Tout le reste est refondu, et chaque écart à la maquette complète est nommé (§6) pour décision (§7).
- **Valeurs** : aucune valeur métier n'est fixée ici. Une valeur tirée du CDC le cite ; une valeur du produit est celle du dépôt ; toute autre valeur est soulignée dans la maquette (pointillé orange : **à fixer par Alexis**, point d'arrêt de CLAUDE.md). Les montants, durées et trajets affichés sont des exemples de démonstration.
- **Repères** — tous les préfixes employés ici :
  - **audit du 28/09** : QT-1 à QT-26 (questions), TP-… (lots), et les constats IN- (interventions, demandes, tableau de bord), CS (clients, sites), PV- (parc, VGP), PA- (paramètres, imports), TR- (absences, terrain, accès, navigation), MO- (modules) ;
  - **audit et spécification du planning du 27/09** : QG-1 à QG-12 (questions), PG-… (lots, regroupés en PG-G1 à PG-G17), I-… (constats) ;
  - **audit du 26/09** : M… (constats), C… (chantiers), GR… (lots ERGO) ;
  - **décisions et règles** : D… (`docs/arbitrages.md`) ; RG-… (règles de gestion du cahier des charges) ; « CDC §… » et « CDC M1 » à « M12 » (sections et modules du cahier des charges) ; R2-…, R3-…, R5-… (arbitrages de revue, `docs/backlog.md`) ; I9 (aucune donnée de production dans le dépôt, CLAUDE.md) ;
  - **tickets et lots du dépôt**, cités par leur nom : 76-BON-4, BON-2, CONTACTS-1, PARCOURS-1, AV-14, DEPLANIFIEE-1, RELEASE-1, 9BK-TP-0-DOCS (le ticket qui dépose l'audit)… ; A-02 est un point ouvert de la file des travaux (habilitations listées deux fois) ;
  - **P1 à P4** : les priorités d'intervention, et rien d'autre ;
  - **nouveaux ici** : PR-1 à PR-12 (principes), U1 à U8 (parcours), PU-1 à PU-12 (propositions d'usage), É-1 à É-19 (écarts ; É-12 retiré), QE-… (questions), TP-UX0 à TP-UX9 (lots ; un préfixe à part des TP-… de l'audit).

---

## Ce que je vous demande

Une question = une décision. Ma recommandation est toujours la réponse (a). Au plus quatre questions par envoi, dans cet ordre. Les séries 1 et 2 de l'audit et l'ordre de la file (QT-26) sont déjà répondus : rien ici ne les repose, ni aucune autre question de l'audit.

**Maintenant, seule**

1. **QE-13a** — La maquette du 28/09 sert-elle de modèle de disposition pour les écrans que la maquette complète ne dessine pas ?
   - (a) oui, en complément : l'ancienne maquette de référence reste valable ; (b) oui, en remplacement de l'ancienne ; (c) écran par écran, à chaque lot.
   - Conséquence de (a) : la disposition seulement, jamais une règle ni un contenu ; aucun test ne change.

**Ensuite, en un envoi : les fondations**

2. **QE-1** — Plus aucun texte sous 12 px, même là où la maquette complète met 11 px (pastilles, en-têtes de tableau) ?
   - (a) oui ; (b) garder 11 px là où elle les met.
   - Conséquence de (a) : la règle de typographie (D124) change, et huit tests qui figent 10,5 ou 11 px avec elle.
3. **QE-2** — Des icônes au trait, dessinées pour CODIPLAN, dans le menu et les boutons ?
   - (a) oui, dessinées dans le dépôt, sans bibliothèque ; (b) une bibliothèque d'icônes (dépendance nouvelle) ; (c) les symboles de la maquette complète.
   - Conséquence de (a) : aucune dépendance ajoutée. Aujourd'hui, le menu n'a aucune icône.
4. **QE-13b** — Toutes les tuiles cliquables, avec un chevron, alors que la maquette complète les dessine inertes ?
   - (a) oui ; (b) non.
   - Conséquence de (a) : chaque chiffre ouvre la liste exacte qu'il compte, vérifié par un test.

**Ensuite, en un envoi : le cadre commun (bandeau, menu, téléphone)**

5. **QE-3** — Revient sur D122 : le bandeau porte une recherche globale, « Créer » et l'aide, au lieu du chemin de la page ?
   - (a) oui ; (b) la recherche seule ; (c) garder le bandeau de la maquette complète.
   - Conséquence de (a) : une seule recherche pour tout. La forme du retour (fil d'Ariane ou « ← ») reste la question de l'audit (TP-NAV).
6. **QE-4** — Entre 900 et 1 199 px, le menu se replie en une bande d'icônes ; ailleurs, à la demande ?
   - (a) oui ; (b) seulement à la demande ; (c) non.
   - Conséquence de (a) : à 1 024 px, le planning et les tableaux gagnent la place du menu.
7. **QE-5** — Des décomptes dans le menu : demandes à qualifier, interventions à planifier (rouge s'il y a une P1), réserves VGP à traiter ?
   - (a) oui, ces trois-là ; (b) non.
   - Conséquence de (a) : une P1 en attente se voit depuis toute page.
8. **QE-6** — Au téléphone, pour le bureau : barre en bas, bouton « + » sur les pages sans bouton de création, actions en bas, fenêtres qui montent du bas ?
   - (a) oui ; (b) garder le tiroir seul, comme la maquette complète.
   - Conséquence de (a) : tout se fait au pouce.

**Avant leur lot** (chaque ligne dit quand)

9. **QE-7** (après QT-20, avant le tableau de bord) — Un tableau de bord selon le rôle : ADV, responsables, direction, administrateur ?
   - (a) oui, cinq compositions ; (b) une seule, celle du produit : les quatre tuiles de la maquette complète, les décomptes de D128, « Interventions sans durée ».
   - Conséquence de (a) : chacun voit d'abord ce qu'il doit faire ; la bande de décomptes (D128) reste partout, avec un décompte propre au rôle.
10. **QE-8** (après QT-19, avant le registre) — Le registre en 8 onglets avec compteur, au lieu des 3 tuiles et de la liste « Tous les statuts » ?
    - (a) oui ; (b) garder les 3 tuiles au-dessus des onglets.
    - Conséquence de (a) : une question par onglet, avec son ordre écrit ; « À contrôler » arrive avec « Terminer », « À facturer » avec QT-19.
11. **QE-9** (avant les fiches) — Le titre d'une fiche nomme l'objet (« Pont élévateur 2 colonnes · Talvor T2C-40 ») au lieu de « Fiche machine » ?
    - (a) oui ; (b) garder « Fiche machine », comme la maquette complète.
    - Conséquence de (a) : on sait quelle fiche est ouverte ; un écart nommé à la maquette complète.
12. **QE-10** (avant les listes) — Revient sur D122 : dans les listes clients, sites, parc, VGP et imports, des filtres en boutons avec leur décompte ?
    - (a) oui ; (b) non : des listes déroulantes partout.
    - Conséquence de (a) : un clic au lieu de deux, les filtres actifs se voient ; registre, planning et priorités gardent les listes déroulantes (D122).
13. **QE-11** (avant le terrain) — Téléphone du technicien : barre en bas à 4 entrées, « Scanner » au centre, un écran par étape ?
    - (a) oui ; (b) l'écran unique de la maquette complète.
    - Conséquence de (a) : un geste par écran, au pouce, avec des gants.
14. **QE-13c** (avant les listes clients et sites) — Revient sur D123 : sur les cartes clients et sites, le donneur d'ordre et des compteurs (machines, à planifier, dernière intervention, VGP dépassées) ?
    - (a) oui ; (b) le donneur d'ordre seul.
    - Conséquence de (a) : de nouvelles lectures groupées en base, à écrire et à tester.
15. **QE-13d** (avant le registre VGP) — VGP : trois onglets (Registre, Réserves, Familles) et le titre « Vérifications périodiques (VGP) » ?
    - (a) oui ; (b) non : quatre tuiles, un tableau et le titre « Contrôles VGP », comme la maquette complète.
    - Conséquence de (a) : les réserves ont leur place, sans nouvelle entrée de menu.
16. **QE-13e** (avant la page Absences) — Absences : sous la semaine en calendrier, ajouter les 4 prochaines semaines en bandes ?
    - (a) oui, en ajout (rien de retiré, comme QG-2) ; (b) non : la semaine seule, comme la maquette complète et le produit.
    - Conséquence de (a) : on prévoit le mois sans perdre la semaine ; décomptes et blocs restent ceux du produit.
17. **QE-15** (avant TP-ARG) — Ajouter à la société son adresse, son téléphone, son courriel, son RIDET et le nom de son logiciel de facturation ?
    - (a) non : le bon lit la raison sociale et les mentions légales ; l'écran dit « votre logiciel de facturation » ; (b) oui, avec TP-ARG.
    - Conséquence de (a) : aucune migration ; (b) en demande une (votre geste).
18. **QE-17** (avec les décisions de TP-S) — La connexion propose-t-elle « Rester connecté » ?
    - (a) non, pas maintenant : la session longue du technicien sur son téléphone (CDC §15) se décidera avec le terrain ; (b) oui, pour tous ; (c) oui, pour le technicien seulement.
    - Conséquence de (a) : la connexion ne change pas ; les sessions expirent (CDC §15).
19. **QE-18** (avant TP-ACC) — « Mot de passe oublié » dit seulement « Demandez un nouveau lien d'accès à votre administrateur », sans formulaire ?
    - (a) oui, le texte seul ; (b) un formulaire qui prévient l'administrateur.
    - Conséquence de (a) : aucune porte ouverte sans session ; l'administrateur renvoie le lien depuis Équipe (QT-1 a).
20. **QE-19** (avec les décisions de TP-S) — « Données à compléter » s'ouvre-t-elle aussi à l'ADV, qui corrige clients et sites ?
    - (a) oui ; (b) non : administrateur et direction seulement.
    - Conséquence de (a) : l'ADV voit les trous qu'elle peut combler ; un droit de plus, à écrire.

**Avec QT-14 (série 3 de l'audit)** : une option à ajouter, (d) « Signaler une panne » depuis la fiche machine du terrain (le technicien crée une demande ; CDC §5.2 le lui permet). Aujourd'hui, il l'écrit en « suite à donner ».

---

## 0. En bref

1. **Ce qui manquait à l'audit : la forme.** La voici, page par page : 68 vues, dont 14 nouvelles et 4 fusions, toutes dessinées et cliquables, au bureau et au téléphone.
2. **Charte gardée, tout le reste refondu** : 12 principes d'ergonomie (PR-1 à PR-12, §2), un système graphique (§3), 8 parcours avant/après (§4), la cible de chaque page (§5).
3. **Ce qui se voit le plus**
   - un cadre commun qui aide : recherche partout (Ctrl K), « Créer » partout, décomptes au menu, menu repliable ;
   - les mêmes modèles partout : liste, fiche, formulaire, état vide, confirmation ;
   - un téléphone traité comme un vrai écran : barre basse, actions en bas, listes en cartes ; terrain à 44 px, en ligne seulement (D121).
4. **Ce qui fait gagner le plus de temps**
   - l'appel d'un client devient une intervention créée puis posée, sans changer de page (U1) ;
   - contrôler, valider, clôturer, préparer la facture : **un fil sans détour** (U4) ;
   - **chaque tuile et chaque décompte ouvrent la liste exacte** qu'ils comptent.
5. **Pour une société qui achète CODIPLAN** : une « Mise en route » en 8 étapes sur le tableau de bord de l'administrateur (PU-1), et « Données à compléter » qui montre les trous tant qu'il en reste (MO-7).
6. **18 écarts** à la maquette complète et aux décisions de forme (D122 à D125), nommés au §6 (É-1 à É-19 ; É-12 retiré). **Les questions** sont en tête (« Ce que je vous demande ») et détaillées au §7 : QE-13a d'abord, puis les fondations, puis le cadre commun ; les autres avant leur lot. Aucune ne repose une question de l'audit.
7. **10 lots TP-UX** (§9, détail dans `lots-ux.md`). L'ordre de QT-26 (a) ne change pas ; les TP-UX s'y insèrent :
   - TP-UX0 (documents) à la suite de la file, après 9BK-TP-0-DOCS ;
   - TP-UX1 (fondations) après TP-I9 et avant DEPLANIFIEE-1 : il retarde le circuit de trois tickets ; aucun autre TP-UX de code avant lui (TP-UX0 est un lot de documents) ;
   - les autres à la place que fixe le §9 : avec le lot fonctionnel qui touche les mêmes écrans (TP-S, TP-CY, TP-TER, TP-ACC, TP-ARG, TP-ABS, TP-PARC, TP-VGP, TP-CLI, TP-MOD), ou après TP-UX1 pour les gabarits de liste, de fiche et de formulaire ; TP-UX2 avec TP-NAV, en fin de file ;
   - **aucun ne modifie une règle de gestion** ; rien en parallèle de la file.
8. **12 propositions d'usage** (§4.9), dont la recherche globale, « Planifier maintenant » juste après la création, la sélection multiple, « Qui sera prévenu » et l'aperçu d'impact avant d'enregistrer.

---

## 1. Ce que la maquette du 28/09 tient pour acquis

**Décisions tenues telles quelles**
- D121 : trois domaines au menu ; la barre du terrain reste vide ; la v1 technicien refuse de fonctionner sans réseau ;
- D132 : le menu cache ce qui ne s'ouvre pas ; « App technicien » exige la capacité `saisir_rapport` ;
- D122 : un filtre est une liste déroulante — tenu au registre, au planning et dans les priorités du tableau de bord (les autres listes : É-10, QE-10) ;
- D123 : les référentiels en cartes (Clients, Sites), le transactionnel en tableaux ;
- D124 : les jetons de couleur, la police, le rayon, l'ombre ; la largeur utile reste celle de D95 (1 400 px), sur toutes les pages, planning compris ;
- D126 : l'identité d'une machine dans l'ordre famille, marque, référence, n° de série, année de vente ;
- D128 : le contenu réel l'emporte sur la disposition — la bande de décomptes du tableau de bord ; aux absences, les blocs « Interventions rendues à la file à planifier » et « Rupture de service » ;
- D8 : les huit statuts et leur matrice ; D131 : le technicien clôture sa propre intervention, le bureau toutes ;
- D120 : le compteur est la seule source du temps ; temps mesuré et temps validé ; aucune machine exigée ;
- D25 (RG-INT-10, CDC l.712) : un **retour sous 30 jours** est une intervention curative sur une machine qui a eu une intervention curative **clôturée** dans les 30 jours calendaires précédents, comptés depuis la date de clôture ; les préventifs et les garanties ne comptent pas. Le produit ne le calcule pas encore : une seule lecture, à écrire, sert au tableau de bord, au registre et à la création ;
- D106, D107 : aucune proposition de technicien ni de date ; le trajet compté est l'aller vers le premier site et le retour depuis le dernier ;
- D109 : une prestation porte une durée, jamais un prix ; D111 : la charge est un taux par technicien ;
- D88, D114 : la VGP enregistre ce qu'on lui dit, jamais une conformité ;
- PARCOURS-1 (23/09) : une intervention porte une machine au plus, et naît sans date, heure ni technicien ;
- R3-14 (14/09) : une absence, c'est une personne, un début et une fin — ni nature, ni motif, ni note ;
- l'annexe D du CDC : quelle couleur porte quel statut ;
- la spécification du planning du 27/09 et les réponses QG-1 à QG-12 : statut = fond, priorité = puce, trame = fermé, absence en violet ; colonnes de 150 px ; « Plein écran » replie la barre latérale et la file (QG-1) ; « Transmettre » est un geste à part ;
- ce que le produit fait déjà : au terrain, « Mettre en pause » arrête le compteur et laisse l'intervention « En cours » (§5.6) ; au tableau de bord, « Interventions sans durée » à la place d'« Activité récente » (TABLEAU-1, 23/09) ; aux absences, les décomptes « Absences ce mois », « Rupture de service » et « Demandes à valider : sans objet ».

**Réponses de l'audit**
- **Répondues le 28/09, toutes en (a)** : série 1 (QT-1 à QT-8), série 2 (QT-9 à QT-13), QT-26 (ordre de la file) ; décision du lot TP-A1 (historiques, dernière intervention datée).
- **Pas encore répondues** : série 3 (QT-14 à QT-25) et décisions de fin du §7 de l'audit. La maquette dessine leur option recommandée (a), sauf QT-23 : la page Absences garde, comme le produit et la maquette complète, la tuile « Demandes à valider : sans objet » ; QT-23 (a) la remplacerait par « Absents aujourd'hui » (TP-ABS). Si Alexis répond autrement, seuls les écrans ci-dessous changent.

| Question | Écrans dessinés en conséquence |
|---|---|
| QT-1 (accès, après TP-S) | Équipe et accès, Premier accès, Mot de passe oublié, tableau de bord de l'administrateur |
| QT-2 (ce que lit un technicien) | Terrain : Ma journée, Mes machines, fiche machine terrain, profil |
| QT-3 (droits d'import par type) | Imports (types réservés marqués d'un cadenas) |
| QT-4 (D8 à la lettre) | Fiche intervention (frise, boutons), registre (onglet « À contrôler »), terrain (« Terminer ») |
| QT-5 (signature au « Terminer ») | Terrain : signature et « client absent » ; fiche intervention : bandeau et contrôle de clôture |
| QT-6, QT-7 (valorisation, montants figés) | Fiche intervention (onglet Valorisation), fenêtre de pose, À facturer |
| QT-8 (bon sans montant pour le client) | Bon d'intervention, deux versions |
| QT-9 (état des réserves VGP) | VGP · Réserves, fiche machine (bloc VGP) |
| QT-10, QT-11 (QR) | Scan d'une étiquette, étiquette de la fiche machine, Nouvelle machine |
| QT-12 (gestes sur une machine) | Fiche machine (bloc « Gestes »), Corriger la fiche |
| QT-13 (ordre du registre VGP) | VGP · Registre |
| QT-14 (source des demandes) | Demandes, fiche intervention (« Créer une demande ») |
| QT-15, QT-23 (absences) | Absences (« Écourter » ; la tuile « Demandes à valider » reste tant que QT-23 n'est pas répondue) |
| QT-16 (désactiver un client) | Fiche client (dialogue de désactivation) |
| QT-17, QT-18 (courriel, adresse) | Interlocuteurs, Nouveau site, fiche site, bon |
| QT-19, QT-20 (à facturer, indicateurs) | À facturer, Indicateurs du mois |
| QT-21, QT-22 (titre du hub, page Charte) | Paramètres (titre, carte « Identité » en tête du hub) |
| QT-24 (App technicien au bureau) | App technicien, ouverte par un rôle de bureau |

---

## 2. Douze principes d'ergonomie

Chaque principe dit pourquoi, où on le voit dans la maquette du 28/09, et la règle vérifiable que les tickets appliquent.

| # | Principe | Pourquoi (constats) | Dans la maquette | Règle pour les tickets |
|---|---|---|---|---|
| PR-1 | **Une page, une question, une action principale.** | Action irréversible en bouton principal (PA-56) ; formulaire sans titre en bas de page (CS39). | Un seul bouton bleu en haut à droite ; au téléphone, il descend dans la barre collée en bas. | Au plus un bouton primaire visible par zone (en-tête, carte, volet, dialogue). |
| PR-2 | **Tout chiffre est une porte.** | Tuiles inertes, chiffre et liste qui ne comptent pas la même chose (CS12, IN-47, IN-48). | Tuiles, décomptes du menu, puces de filtre, bande de décomptes : tous ouvrent la liste filtrée. Un décompte à 0 n'est pas une porte : il dit « à jour ». Les décomptes en lecture d'une page (À facturer, Absences) la résument sans s'ouvrir. | Un test par tuile : le chiffre affiché égale le nombre de lignes de la liste qu'elle ouvre. |
| PR-3 | **Ce qui demande une action d'abord.** | Trois ordres d'historique différents ; « À planifier » en dernière page (CS9, CS29, PV-15, IN-09). | Un ordre unique : à traiter en tête, puis le plus récent (TP-A1). Chaque onglet dit son tri au-dessus du tableau. | Une seule fonction d'ordre partagée ; le tri est écrit à l'écran. |
| PR-4 | **La couleur ne parle jamais seule.** | Retards signalés par la seule couleur, ou pas du tout (CS22). | Statut = fond de l'annexe D + mot ; priorité = puce ; retard = « en retard » + filet rouge à gauche de la ligne. | Toute couleur de sens est accompagnée d'un mot (WCAG 1.4.1). |
| PR-5 | **Dire ce qui se passe, en une ligne.** | Paragraphes de doctrine, textes au futur sur un lot appliqué, messages qui décrivent le mécanisme (C7, PA-54, TR-24). | Sous-titre d'une ligne ; aide courte derrière « ? » ; verbes au bon temps. | Sous-titre ≤ 1 ligne à 1 280 px ; plus de paragraphe explicatif dans une page. |
| PR-6 | **Prévenir avant d'écrire, confirmer l'irréversible.** | Refus après coup, saisie perdue, annulation sans confirmation (CS23, PV-45, PA-56). | Doublon, date future, habilitation, horaires d'accès : signalés avant d'enregistrer ; un dialogue répète l'objet et la conséquence avant d'annuler, de désactiver, de défaire un lot. | Tout geste irréversible passe par un dialogue qui nomme l'objet ; tout refus dit la correction à faire. |
| PR-7 | **Garder le contexte.** | Retour toujours « au planning », filtres perdus, création sans pré-remplissage (IN-04, IN-10, IN-21). | Créer depuis une fiche pré-remplit client, site, machine ; retour vers l'origine ; filtres dans l'adresse. | `?client=`, `?site=`, `?machine=`, `?depuis=` lus par toutes les créations ; filtres dans l'URL. |
| PR-8 | **Trouver sans chercher la bonne liste, créer de partout.** | Chaque liste a sa recherche, avec ses limites (CS2, PV-03, PV-37). | Recherche globale (Ctrl K ou « / ») sur n° d'intervention, client, site, commune, n° de série, pages ; « Créer » dans le bandeau (QE-3). | Recherche sans accents, sur tous les champs utiles, résultats groupés par type. |
| PR-9 | **Mêmes gabarits partout.** | Chaque page réinvente sa liste, sa fiche, ses messages (PA-38, A-02). | Liste, fiche, formulaire, état vide, dialogue : un gabarit chacun (§3.4). | Tout écran se construit depuis les composants de `components/ui/` ; aucune mise en forme locale. |
| PR-10 | **Le téléphone est un vrai écran.** | Tableaux de 920 px en défilement (IN-13, GR18), pages de 17 000 à 19 000 px (PV-40, PA-43, PA-55), 401 cibles de moins de 32 px (PV-40). | Bureau : barre basse, actions collées, listes en cartes, dialogues en feuille basse. Terrain : cibles de 44 px, texte de 15 à 16 px. | Aucun défilement horizontal de page ; tableaux en cartes sous 900 px. |
| PR-11 | **Lisible par tous.** | 115 textes de moins de 12 px sur le registre (notes du 28/09, relevé en ligne) ; cibles trop petites (PV-40). | Rien sous 12 px (QE-1) ; corps de 14 px ; focus visible ; libellés associés. | Mesure automatique : aucun texte < 12 px ; cibles ≥ 32 px (bureau au téléphone) et ≥ 44 px (terrain) ; contraste AA. |
| PR-12 | **Honnête sur l'état.** | Renvoi silencieux, écran vide sans raison, message de connexion pour un refus de droit (TR-6, TR-44, IN-12). | Chaque écran a ses états : vide (pourquoi, quoi faire), chargement, erreur, sans réseau (terrain), réussi, réservé à un rôle. | Chaque page livre ses états vide et erreur, photographiés dans les captures du ticket. |

---

## 3. Système graphique

### 3.1 Ce qui est gardé (D124)

| Rôle | Jeton | Valeur |
|---|---|---|
| Fond | `--bg` | `#f4f6f9` |
| Surface | `--surface` / `--surface-2` | `#ffffff` / `#f8fafc` |
| Filets | `--line` / `--line-2` | `#dce2ea` / `#edf0f4` |
| Encre | `--ink` / `--muted` | `#142033` / `#637083` |
| Bleu (marque, action) | `--blue` / `--blue-2` | `#0053a1` / `#e8f1fb` |
| Rouge (urgence, en cours) | `--red` / `--red-2` | `#e30613` / `#fdebed` |
| Vert (terminé, réussi) | `--green` / `--green-2` | `#12824b` / `#e5f5ec` |
| Orange (attente, avertissement, suspendue) | `--orange` / `--orange-2` | `#a76500` / `#fff1d5` |
| Violet (absence) | `--purple` / `--purple-2` | `#6941c6` / `#f0eafe` |
| Gris (annulée, neutre) | `--gray` / `--gray-2` | `#6b7280` / `#eef0f2` (D95, `app/globals.css`) |
| Barre latérale | chrome | `#10233e`, actif `#0d66b8` |
| Rayon, ombre | `--radius`, `--shadow` | `14px`, `0 14px 38px rgba(29,43,67,.08)` |
| Police | Inter | `14px/1.45`, fichier `public/fonts/inter/Inter-Variable.woff2` |

**Aucune couleur nouvelle.** Les états de survol, de focus et les encres foncées des tons (`#0b3d75`, `#8a0810`, `#0a6b3d`, `#7a5200`, `#3f4650`) existent déjà dans `app/globals.css`. La maquette du 28/09 n'emploie que ces jetons et leurs mélanges (`color-mix()` de jetons) : un code couleur qui n'en vient pas ne se reprend pas. Le violet est réservé à l'absence ; une suspension (pièce attendue) est orange. Quel statut porte quelle couleur reste la règle de l'annexe D.

### 3.2 Typographie

Les valeurs sont celles de la maquette complète (D124). La maquette du 28/09 s'en écarte de peu (titre en graisse 800, valeur de tuile en 850) : les tickets suivent la maquette complète.

| Usage | Taille | Graisse | Remarque |
|---|---|---|---|
| Titre de page (h1) | 28 px | 700 (le gras par défaut : la maquette complète n'en fixe pas) | 24 px sous 600 px ; interlettrage −0,035 em |
| Valeur de tuile | 28 px | 860 | chiffres tabulaires |
| Titre de section | 18 px | 800 | |
| Titre de carte | 15 px | 800 | |
| Texte courant | 14 px | 400 | interligne 1,45 |
| Texte secondaire | 13 px | 700 minimum (décision du 30/09/2026, D143 ; amende 400 à 650) | couleur `--muted` |
| Plus petit texte | **12 px** (QE-1 ; 11 px dans la maquette complète) | 700 à 850 (décision du 30/09/2026, D143) | pastilles, en-têtes de tableau, groupes du menu, surtitres |
| Terrain | 16 px (décision du 30/09/2026, D143 ; amende 15 à 16 px) | | champs et boutons à 16 px (le téléphone ne zoome pas) |

- Chiffres tabulaires pour les montants, heures, décomptes — partout, par une règle unique sur `body` (décision du 30/09/2026, D143).
- Chasse fixe pour les n° de série et les références internes.
- Montants au format du dépôt (`lib/money/format.ts`) : espace insécable, devise après, jamais d'`Intl`.
- Heures « 07:30 » (`enHeure`, `lib/calendar/parametrage.ts`) ; durées « 45 min », « 1 h 30 » (`enDuree`, `lib/calendar/duree.ts`). Une seule écriture chacune.

### 3.3 Espacements, grille, points de rupture

- **Rythme** : multiples de 4 px (4 à 24). Contenu : marge 30 px, largeur utile 1 400 px sur toutes les pages, planning compris (`LARGEUR_UTILE_PX`, D124, gardée par un test). Au planning, « Plein écran » (QG-1, déjà décidé ; PG-C6) replie la barre latérale et la file « À traiter » : la grille prend la place libérée, le temps de planifier. Cartes : 16 à 18 px de marge intérieure.
- **Deux colonnes** pour les fiches et les formulaires : le principal et une colonne de contexte (420 px, 340 px sous 1 360 px) qui reste visible au défilement. Une colonne sous 1 024 px ; la fiche machine et les priorités dès 1 180 px, comme la maquette complète.

| Largeur | Menu | Contenu |
|---|---|---|
| ≥ 1 200 px | barre latérale de 272 px (maquette complète) | 4 tuiles par ligne ; fiches et formulaires sur deux colonnes |
| 900 à 1 199 px | **rail de 76 px** (icônes, décomptes en pastille : É-4, QE-4) | sous 1 180 px (maquette complète) : tuiles et cartes sur 2 colonnes, fiche machine et priorités sur une colonne |
| 600 à 899 px | tiroir (maquette complète) + **barre basse** (Accueil, Planning, Interventions, Parc, Plus : É-6, QE-6) | une colonne de contenu, tuiles sur 2 colonnes, listes en cartes, actions collées en bas |
| < 600 px | idem | tuiles sur une colonne ; titre de page à 24 px (maquette complète) |

La maquette du 28/09 garde 2 tuiles par ligne jusqu'au téléphone et passe à 2 colonnes dès 1 199 px : les tickets suivent les ruptures de la maquette complète (1 180, 900, 600 px) ; seuls le rail (É-4) et la barre basse (É-6) s'y ajoutent.

### 3.4 Composants

Tous dans `components/ui/`, sans dépendance nouvelle. Ceux qui existent sont repris ; les nouveaux sont en gras.

| Composant | Règles |
|---|---|
| Bouton | primaire, secondaire, fantôme, danger ; hauteurs 32, 40, 48 (56 au terrain) ; rayon 9 (maquette complète) ; icône + libellé. Un seul primaire par zone ; actions de ligne en boutons secondaires. |
| Pastille de statut | fond et encre de l'annexe D, texte 12 px, toujours le mot. |
| **Puce de priorité** | P1 rouge, P2 orange, P3 et P4 gris — les tons de la pastille (GR5, décision du 26/09/2026 ; confirmée le 30/09/2026, D144). Dans les listes, P3 et P4 peuvent se taire (planning, 27/09 §5). |
| Tuile (KPI) | barre de couleur à gauche (maquette complète) ; libellé, valeur, détail ; **toujours cliquable**, chevron en haut à droite (É-13, QE-13b) ; une tuile qui n'est qu'un fait devient une ligne de faits. Les décomptes en lecture d'une page (À facturer, Absences) ne sont pas des tuiles : ils résument la page où l'on est ; « Plus ancienne clôture » ouvre la seule intervention qu'il désigne. |
| **Bande de décomptes** | sous les tuiles ; trois décomptes communs — demandes en attente de qualification et techniciens indisponibles aujourd'hui (gardés par D128), interventions sans durée prévue (TABLEAU-1, 23/09) —, puis celui du rôle ; chacun cliquable ; à zéro, un état « à jour », pas une porte. |
| Onglets | avec compteur ; rouge quand il contient une urgence. |
| Filtre en liste déroulante | D122 : libellé au-dessus (« Technicien », « Priorité », « Nature », « Statut », « Suivi »), « Tous » (« Aucun » pour « Suivi ») tant que rien n'est choisi, « Effacer les filtres » ; au registre, au planning, dans les priorités. |
| **Puces de filtre** | dans les listes clients, sites, parc, VGP et imports, selon QE-10 (revient sur D122) : libellé, compteur, état actif en bleu, retrait par la croix ; menu pour les listes longues. |
| Tableau | en-têtes de 12 px, tri visible (↑↓), ligne cliquable, filet rouge + « en retard » = retard, sélection multiple et actions selon l'onglet, densité « Confort · Compact », pied avec total et pagination. |
| **Carte de liste** | la même ligne au téléphone : pastilles en haut, titre, détail, pied. |
| Carte d'entité | référentiels (D123) : titre et état, une à deux lignes muettes, bande de compteurs (ceux que D123 permet ; les autres : QE-13c). |
| Clé / valeur | libellé 12 px au-dessus de la valeur ; « Non renseigné » en gris, jamais une valeur inventée (D126). |
| **Frise d'étapes** | les statuts de D8 ; au téléphone : « Étape 4 sur 6 · En cours » et une jauge. |
| Chronologie | une seule, datée : création, planification, transmission, compteur, pauses, fin, validation, clôture. |
| Message | information, avertissement, danger, réussite ; titre en gras, une ligne, une action à droite. |
| État vide | pourquoi c'est vide, et quoi faire (un bouton). |
| **Volet** (tiroir) | à droite, 440 px, comme le tiroir de la maquette complète et celui du planning (spécification du 27/09, §3.9) ; plein écran au téléphone ; pour lire ou saisir sans quitter la liste (détail d'une intervention au planning, nouvelle demande, déclarer une absence, ajouter un interlocuteur). |
| **Fenêtre de pose** | une fenêtre (dialogue de 880 px), pas un volet ; plein écran au téléphone (spécification du 27/09, §3.10 et §4) : technicien (son état pour la date choisie ; refus d'habilitation affiché), date, durée (choix rapides ; la durée prévue cochée si elle existe), heure (les créneaux libres pour cette durée), valorisation (les trois modes, aucun coché, tant qu'elle n'est pas choisie), contrôles (refus : habilitation, chevauchement, absence, agence fermée ; avertissements non bloquants : « ! Hors des horaires d'accès du site », trajet inconnu), « Qui sera prévenu », Annuler / Planifier. |
| Dialogue | confirmation qui nomme l'objet ; le bouton qui confirme contrôle les champs obligatoires, dit ce qui manque et garde la saisie ; **feuille basse** au téléphone. |
| **Notification** | en bas à droite ; celle qui offre « Annuler » dure le délai de PG-B5 (10 s, QG-6) et l'écriture part à la fin de ce délai — après la pose : « Planifiée — … Le donneur d'ordre sera prévenu dans 10 s » ; la durée des autres est à fixer par Alexis. |
| **Palette de recherche** | Ctrl K ou « / » ; groupes Interventions, Clients, Sites, Machines, Pages ; navigation au clavier (QE-3). |
| Avatar | initiales, couleur stable par technicien, prise dans les jetons (même couleur au planning, au tableau de bord, au terrain). |
| Jauge | charge : bleu ; rouge seulement au-delà de 100 % (`TAUX_PLEIN`, seul seuil existant, 27/09). |
| Champ | libellé au-dessus, « (obligatoire) » (décision du 27/09), aide « ? », erreur sous le champ avec la correction. |
| **Choix visibles** | des boutons à cocher au lieu d'une liste déroulante quand il y a 6 options ou moins (priorité, état) ; la nature (9 valeurs) reste une liste ; **aucun choisi à l'avance** quand le schéma l'imposait sans arbitrage (IN-02, IN-28, PV-28). |
| **Créneau libre** | quand, durée, les refus (habilitation, chevauchement, absence, agence fermée) et les avertissements, qui ne bloquent pas (« ! Hors des horaires d'accès du site » : dans le produit, un avertissement, jamais un blocage, `prisma/schema.prisma:763-764` ; trajet inconnu) ; jamais un choix de technicien, ni le déplacement d'une autre intervention, ni un trajet entre deux sites (D107). |
| **Sélecteur de machine** | les machines du site en choix, avec état, interventions ouvertes et VGP ; « Sans machine » ; « Machine non listée » ; une au plus, facultative (PARCOURS-1, D120). |

### 3.5 Icônes

- 104 icônes au trait (1,8 px, grille de 24) dans la maquette du 28/09 (objet `ICONS`), dessinées pour CODIPLAN, servies par un composant `Icone` et une planche SVG unique (QE-2).
- **Aucune bibliothèque ajoutée** (CLAUDE.md : ajouter une dépendance est une décision).
- Le menu du produit n'a aucune icône (`components/navigation/barre.tsx:327-396`) ; la maquette complète y dessine des glyphes Unicode (⌂ ▦ ≡ ◷…), dont le rendu change selon le système : écart É-2.
- Une icône accompagne toujours un mot, sauf dans un bouton à libellé accessible (« Fermer », « Plus d'actions »).

### 3.6 États de chaque écran

| État | Forme |
|---|---|
| Chargement | squelette de la page (formes grises), jamais un écran blanc ; « Chargement… » annoncé aux lecteurs d'écran. |
| Vide | icône, phrase qui dit pourquoi, bouton qui dit quoi faire (« Nouvelle intervention »). Un vide de recherche n'est pas un vide de données (IN-12). |
| Erreur | message danger en haut de page, la correction à faire, la saisie gardée. |
| Réussite | notification en bas à droite ; la page montre déjà le résultat (ligne mise à jour, statut changé). |
| Réservé | page « … n'est pas ouvert à votre rôle », qui dit qui y a accès (jamais un renvoi silencieux, TR-44). |
| Hors ligne (terrain) | « Pas de réseau : rien n'est enregistré tant qu'il ne revient pas » (D121 ; hors ligne différé le 19/09). |
| Introuvable | « Cette page n'existe pas », recherche et retour. |

### 3.7 Téléphone

- **Bureau** : barre basse (5 entrées) ; bouton « + » flottant, seulement sur les pages qui n'ont pas leur propre bouton de création ; actions de la page collées en bas ; listes en cartes ; dialogues en feuille basse ; le chemin devient un lien de retour « ‹ Parent » et le titre dit où l'on est (la forme du retour reste la décision de l'audit, TP-NAV).
- **Terrain** : bandeau bleu nuit avec l'état du réseau ; barre basse à 4 entrées dont « Scanner » au centre ; cibles de 44 px au moins (CDC §13.4) ; texte de 15 à 16 px. Sans réseau, l'écran le dit et n'enregistre pas (D121).

### 3.8 Impression

- Le bon d'intervention sort de la coque : barre d'outils sombre, page A4, versions client et interne (QT-8).
- L'étiquette QR s'imprime seule, au format de l'étiquette (valeur à fixer, PV-23).
- Le registre VGP s'imprime client par client (MO-12).
- À l'impression, le menu et les boutons disparaissent.

### 3.9 Accessibilité, en critères vérifiables

- Contraste AA : les jetons D124 le tiennent sur fond blanc pour le texte ; sur un fond teinté, l'encre foncée du ton (pastille « Annulée » : `#3f4650` sur `#eef0f2`) ; le gris `--muted` n'est jamais utilisé sous 12 px.
- Focus visible (anneau bleu de 3 px) sur tout élément actif, tuiles comprises ; lien d'évitement « Aller au contenu ».
- Libellé associé à chaque champ (IN-25) ; rôle et nom accessibles sur les boutons d'icône.
- Une zone d'annonce (`role=status`) pour les notifications.
- Les raccourcis clavier ne se déclenchent pas pendant une saisie.

---

## 4. Usage : huit parcours, avant et après

Chaque parcours se rejoue dans la maquette du 28/09 depuis le Sommaire. « Aujourd'hui » décrit l'écran en ligne le 28/09 (audit) ; « Cible » décrit la maquette du 28/09. Les durées réelles se mesureront sur les captures avant/après des tickets : aucune n'est promise ici.

### U1 — Un client appelle pour une panne urgente (ADV)

- **Aujourd'hui**
  - création dans un premier écran, avec une priorité imposée (P3) et un mode de valorisation imposé (IN-01, IN-02) ;
  - planification dans un second écran, la fiche, avec une heure facultative (QG-4) ;
  - aucune transmission au technicien (PG-G14), et le technicien ne peut pas se connecter (§1.1 de l'audit).
- **Cible, sans changer de page** (Nouvelle intervention, puis la fenêtre de pose)
  1. un champ trouve le client, le site ou le n° de série ; le site affiche son adresse, ses horaires d'accès, l'habilitation exigée ;
  2. on choisit la machine parmi celles du site, ou « Sans machine », ou « Machine non listée » (facultative, D120) ; avant d'enregistrer, une alerte dit si la machine a déjà une intervention ouverte (doublon), une autre si c'est un retour : un curatif sur une machine dont un curatif a été clôturé dans les 30 jours (RG-INT-10, D25 ; CDC §16.1) ; nature et priorité se choisissent (rien d'imposé) ; « Machine à l'arrêt » propose P1 (QG-10) ; la durée est facultative, en choix rapides, sans valeur par défaut (PG-B6, QG-12) ; le contact sur place est facultatif ;
  3. un seul bouton, « Créer » ; puis « Planifier maintenant » ouvre la fenêtre de pose (PG-B6) — une fenêtre, pas un volet : l'ADV choisit le technicien et le jour ; la fenêtre montre ses créneaux libres pour cette durée (PG-B2, B3), les refus (habilitation, chevauchement, absence, agence fermée) et l'avertissement « ! Hors des horaires d'accès du site », qui ne bloque pas ; la valorisation s'y choisit (QT-6 a). Aucune proposition de technicien ni de date (D106 ; moteur de tournées différé, D107). « Laisser dans la file » est l'autre choix ;
  4. Après « Planifier », la notification dit « Le donneur d'ordre sera prévenu dans 10 s » et offre « Annuler » : l'écriture part à la fin du délai, et le courriel de planification au donneur d'ordre avec elle (PG-B5, QG-6, PG-E1). Le bloc « Qui sera prévenu » le dit avant. « Transmettre » reste un geste distinct (PG-G14, QG-5), jamais coché d'avance.
- **Dans la maquette du 28/09** : l'appel de Transports du Sud devient INT-2026-0460, créée puis posée avec M. Leroy le 29/09 à 12:30 ; elle reste « Planifiée » jusqu'à « Transmettre ».
- **Repères** : IN-01 à IN-04, PG-B2, PG-B3, PG-B6, PG-G14 (Transmettre), QT-1, QT-6, QG-10, QG-12.

### U2 — Préparer la semaine (ADV, responsable matériel)

- **Aujourd'hui** : couvert par la spécification du planning du 27/09 (lots PG, en file).
- **Cible** : Planning → colonne « À traiter » à onglets (PG-C2 : À planifier · En retard · Sans durée · Suspendues, puis Déplanifiées avec DEPLANIFIEE-1 ; filtre Zone, MO-18) → « Poser » sur une carte (la fenêtre de pose) → « Planifier » → « Transmettre ».
  - Une absence se déclare depuis la ligne du technicien, pré-remplie, avec son impact avant d'enregistrer (MO-31).
  - Le tableau de bord du responsable matériel montre la charge par technicien des 4 prochaines semaines (D111), jamais un pourcentage d'équipe (R2-13).

### U3 — La journée d'un technicien

- **Aujourd'hui** : aucun accès technicien ; la fiche terrain ne montre ni la panne, ni le contact, ni la machine ; pas de « Terminer » (TR-22, IN-14).
- **Cible**
  1. Ma journée : ce que le bureau lui a transmis (QG-5), l'intervention en cours en haut (bandeau du compteur), demain juste en dessous.
  2. « Je suis arrivé · démarrer » ; itinéraire et appel en un geste. Aucune position n'est enregistrée.
  3. Sur la carte du compteur, « Mettre en pause » l'arrête sans changer le statut (acquis du produit, §5.6), « Reprendre le compteur » le relance. En bas, « Suspendre » change le statut : un motif obligatoire (pièce attendue, avec sa référence et sa date ; accès impossible ; autre, à préciser) ; puis « Reprendre ».
  4. « Terminer » ouvre le rapport : prestations en choix, commentaire dicté, suite à donner (facultative), photos.
  5. Signature : nom (obligatoire) et fonction du signataire, ou « client absent » avec motif (QT-5 a).
  6. « Terminer l'intervention » : elle passe « Terminée » ; le bureau valide le rapport, puis clôture.
- Sans réseau, l'écran le dit et n'enregistre pas (D121).
- **Repères** : QT-4, QT-5, TR-14 à TR-25, CDC §13, D121.

### U4 — Contrôler, clôturer, préparer la facture (responsable SAV pour valider ; ADV pour clôturer et facturer)

- **Aujourd'hui** : « Clôturer » est proposé sur une « À planifier » ; la clôture ne vérifie ni rapport ni signature ; aucune file « à facturer » (IN-20, MO-2).
- **Cible**
  1. Registre, onglet « À contrôler » : les terminées, avec l'état du rapport (à valider, validé) et de la signature (signée · client absent, motif tracé).
  2. Fiche, bloc « Avant de clôturer » : « Valider le rapport » (responsables, direction, administrateur ; jamais l'ADV, CDC §5.2) fixe le temps validé, égal au mesuré par défaut (D120) ; « Corriger le temps validé… » est offert aux responsables et à l'ADV (lecture de D120 et sa limite : §5.3, fiche intervention).
  3. « Clôturer… » : la même liste — rapport validé, signature ou motif d'absence, temps mesuré (compteur arrêté), temps validé, montant figé (QT-7) ; clôture refusée tant qu'une ligne manque, et le message dit laquelle.
  4. « À facturer » : trois décomptes en lecture (dont « Plus ancienne clôture », qui ouvre l'intervention), sélection, « Exporter pour la facturation », « Marquer facturées… » avec n° et date de la facture.
- **Repères** : QT-4, QT-5, QT-7, QT-19, MO-2, D8, D120, IN-20.

### U5 — Une réserve VGP devient une intervention (responsable matériel)

- **Aujourd'hui** : les réserves importées ne s'affichent nulle part (§1.3 de l'audit).
- **Cible**
  1. VGP, onglet « Réserves » : à traiter, levée, écartée (QT-9 a) ; l'intervention créée est un lien affiché, pas un état.
  2. « Créer l'intervention », une par une, dans un court dialogue : nature et priorité obligatoires, rien de choisi d'avance ; durée prévue facultative en choix rapides ; description reprise de la réserve. Elle arrive dans « À planifier », et sa fiche porte le lien vers la réserve (pas de champ « Origine ») ; la réserve reste « à traiter » jusqu'à sa levée.
  3. La fiche machine montre les mêmes réserves, et leur suite.
- **Repères** : QT-9, MO-3, D88 §10.

### U6 — Recenser le parc d'un nouveau client (ADV, technicien)

- **Aujourd'hui** : pas de création de machine sur le téléphone ; « Remplacée » et « Ferraillée » proposées à la création (PV-27).
- **Cible**
  1. Nouveau client : détecte un doublon avant de créer, puis enchaîne sur « Nouveau site ».
  2. Nouveau site : adresse, zone, horaires d'accès, consignes.
  3. Sur place, « Machine express » : photo de la plaque, famille, modèle, n° de série, « Créer et suivante ».
  4. Au bureau, la nouvelle machine apparaît au parc avec son étiquette.
- **Repères** : RG-PAR-02, CDC §8.1 et §13.3, QT-10, QT-11. La création express attend le terrain hors ligne (audit §6.5), différé le 19/09.

### U7 — Mettre en route une nouvelle société (administrateur de société)

- **Aujourd'hui** : l'administrateur ne peut ouvrir aucun compte ; les réglages sont dispersés sur onze portes ; les trous de données ne se voient pas (§1.1, PA-07, MO-7).
- **Cible**
  - Premier accès par un lien, puis, sur son tableau de bord, une carte **« Mise en route »** en 8 étapes, chacune ouvrant son écran (PU-1) :
    1. identité de la société (lue seulement) ;
    2. agence, horaires et fériés ;
    3. taux horaire (selon PA-01, D37) ;
    4. trajets et forfaits de déplacement (selon PA-01, D37) ;
    5. référentiel matériel et régimes VGP ;
    6. équipe et liens d'accès (après TP-ACC) ;
    7. clients, sites et machines importés ;
    8. premier planning transmis aux techniciens (après PG-G14).
  - « Données à compléter » reste ouverte tant qu'un trou fausse la charge, la facturation ou les courriels.
- **Repères** : QT-1, MO-1, MO-7, D37, D65.

### U8 — Retrouver n'importe quoi (tous)

- **Aujourd'hui** : une recherche par liste : raison sociale et code seulement, sensible aux accents, sans la commune (CS2) ; référence interne non cherchée (PV-03).
- **Cible** : Ctrl K (ou « / ») depuis n'importe quelle page ; un numéro (« 0452 »), une commune, un n° de série ; résultats groupés ; Entrée ouvre.
- **Autres raccourcis**
  - N : nouvelle intervention ;
  - C : menu « Créer » ;
  - G puis P : planning ;
  - G puis I : registre.

### 4.9 Propositions d'usage (PU)

Ce que l'audit ne proposait pas, ou seulement en creux. Chacune se voit dans la maquette du 28/09.

| # | Proposition | Où | Pourquoi | Condition |
|---|---|---|---|---|
| PU-1 | **Mise en route** : 8 étapes cochées, chacune vers son écran | tableau de bord de l'administrateur | une société qui achète doit savoir ce qui manque avant le premier planning | étape 6 après TP-ACC ; étape 8 après PG-G14 ; étapes 3 et 4 selon PA-01 (D37) ; étape 1 lue seulement |
| PU-2 | **Recherche globale** (Ctrl K, « / ») et raccourcis clavier | bandeau | trouver sans savoir dans quelle liste chercher | QE-3 ; une route de recherche groupée (interventions, clients, sites, machines) |
| PU-3 | **« Créer » partout**, pré-rempli depuis la page, retour à l'origine | bandeau, fiches | on crée là où l'on est | `?client=`, `?site=`, `?machine=`, `?depuis=` lus partout (IN-04) |
| PU-4 | **« Planifier maintenant » juste après « Créer »** : la fenêtre de pose, où l'ADV choisit le technicien et le jour, et voit ses créneaux libres pour la durée | Nouvelle intervention | l'appel devient une intervention posée sans changer de page (U1) | PG-B2, PG-B3, PG-B6 (en file) ; toute proposition au-delà (technicien, date) devient une nouvelle question (D106) |
| PU-5 | **Sélection multiple**, les actions selon l'onglet : transmettre (onglet « Aujourd'hui » : seulement les planifiées du jour cochées dans la liste affichée, dans le dialogue de transmission qui les liste par technicien), exporter (ailleurs) ; la sélection vaut pour l'onglet affiché : en changer la vide ; marquer facturées (À facturer) | registre, À facturer | on transmet une journée ou on reporte une facture groupée d'un geste | droits de chaque geste inchangés ; jamais de pose en lot (D106) |
| PU-6 | **« Annuler » dans la notification** | notifications | on ose agir vite | « Annuler » pour la pose (PG-B5 : 10 s, l'écriture part à la fin du délai) ; pour tout autre geste, une liste close à valider ; une transmission ne s'annule plus une fois le courriel parti |
| PU-7 | **« Qui sera prévenu »** avant chaque geste qui envoie un courriel | nouvelle intervention, fenêtre de pose, fiche site, annulation | plus de courriel parti sans le savoir, ou pas parti faute d'adresse | aucune |
| PU-8 | **Aperçu d'impact avant d'enregistrer** : absence, taux à date passée, désactivation, « Défaire ce lot… » | volets et dialogues | voir la conséquence avant qu'elle arrive | aucune (lectures) |
| PU-9 | **Liste de contrôle de clôture** : rapport validé, signature ou motif, temps validé, montant figé | fiche intervention | clôturer juste du premier coup | QT-4, QT-5, QT-7 ; l'état « rapport validé » est à créer (IN-20) |
| PU-10 | **Filtres dans l'adresse** : une vue se partage par un lien, et se retrouve au retour de fiche | toutes les listes | « regarde les P2 de la semaine » devient un lien | IN-10 |
| PU-11 | **Densité compacte** des tableaux, au choix (« Confort · Compact ») | listes | plus de lignes à l'écran pour l'ADV | préférence gardée sur l'appareil |
| PU-12 | **Centre de notifications** dans l'application, sans notification poussée | bandeau | savoir ce qui a changé depuis le matin | la maquette complète dessine déjà un bouton « Notifications » dans le bandeau, qui n'ouvre qu'un message ; le centre demande une nouvelle table : point d'arrêt (audit §6.2, « plus tard ») |

---

## 5. Page par page

Pour chaque page : **E** ergonomie, **G** graphisme, **U** usage, **T** téléphone, puis les repères. Les routes sont celles du produit ; une page « nouvelle » propose la sienne. « = maquette complète » : sa disposition est tenue ; un écart est renvoyé au §6.

### 5.1 Coque (toutes les pages)

- **E**
  - bandeau : chemin de retour (forme : décision de l'audit, TP-NAV), recherche globale et « Créer » (É-3, QE-3), notifications, aide ;
  - menu à trois domaines (D121), avec les décomptes utiles (É-5, QE-5) : demandes à qualifier, interventions à planifier (rouge s'il y a une P1), réserves VGP à traiter ;
  - bas du menu : la personne, son rôle, sa société ; changer de société ; se déconnecter (TR-38).
- **G** : icônes SVG (É-2) ; menu actif en bleu avec liseré (maquette complète) ; rail replié (É-4).
- **U**
  - raccourcis clavier ;
  - « Données fictives » devient, dans la maquette seulement, le menu de la démonstration (rôle, annotations, aperçu téléphone) ;
  - dans le produit, rien ne la remplace.
- **T** : barre basse, bouton « + » flottant sur les pages sans bouton de création, menu en tiroir (É-6) ; le chemin devient un lien de retour « ‹ Parent » (§3.7).

### 5.2 Accès

**Connexion** — `/connexion` · refondue
- **E** : adresse, mot de passe (« Afficher »), « Mot de passe oublié ? » ; erreur neutre, qui ne dit ni si le compte existe ni combien d'essais restent. « Rester connecté » : question (QE-17 ; CDC §15, sessions expirantes).
- **G** : deux panneaux, la marque et le formulaire ; nom de la société.
- **U** : autocomplétion correcte (TR-33) ; une base injoignable n'est pas « vérifiez vos identifiants » (TR-31).

**Code de vérification** — `/connexion/code` · refondue
- **E** : 6 cases, et « utiliser un code de secours » (TR-34). Un code faux laisse sur la page (TR-39). « Retour à la connexion » (TR-35).

**Mot de passe oublié** — `/mot-de-passe-oublie` · nouvelle
- **U** : dit « Demandez un nouveau lien d'accès à votre administrateur » ; la réémission se fait depuis Équipe (QT-1 a ; TR-32). Pas de formulaire : un formulaire qui prévient l'administrateur ouvrirait une nouvelle porte sans session (QE-18). Changer son mot de passe soi-même reste fermé (D58).

**Activer le second facteur** — `/enrolement` · refondue
- **E** : trois étapes : scanner, vérifier, codes de secours.
- **U**
  - QR affiché (TR-37) ;
  - clé masquée, « Afficher la clé » ;
  - **rien dans l'adresse de la page** (TR-36) ;
  - codes à télécharger ou imprimer.

**Premier accès** — `/premier-acces` · refondue
- **E** : bienvenue nominative, « Lien d'accès envoyé par … », adresse en lecture, mot de passe de 8 caractères au moins (`lib/auth/premier-acces.ts`) avec règles visibles, confirmation (TR-41).
- **U**
  - le lien ne sert qu'une fois et vit une heure (produit : `lib/auth/amorcage.ts` ; changer cette durée est une décision) ;
  - lien expiré, déjà servi ou invalide : un même écran « Ce lien n'est plus valide », qui ne dit rien du compte ;
  - au téléphone, conseil « écran d'accueil ».

**Choisir la société** — `/arrivee` · refondue
- **E** : « Bonjour Camille », les sociétés en cartes avec le rôle ; « ouvrir directement la dernière » (TR-29, TR-30).

### 5.3 Exploitation

**Tableau de bord** — `/tableau-de-bord` · refondue (É-7)
- **E** : 4 tuiles, la bande de décomptes, puis deux colonnes de blocs. Tout chiffre est cliquable (PR-2). Annulées exclues (IN-46).
- **G** : la barre de couleur des KPI de la maquette complète ; en tête, une alerte seulement pour une P1 qui attend (ADV et responsables), avec « Trouver un créneau ».
- **U** : composition selon le rôle (CDC M9) : proposition É-7, question QE-7.

| Rôle | Tuiles | Bande : les trois décomptes communs, plus | Blocs |
|---|---|---|---|
| ADV | À planifier · Aujourd'hui · En retard · À facturer | interventions du jour à transmettre | Priorités opérationnelles, Aujourd'hui par technicien, Interventions sans durée |
| Responsable matériel | À planifier · En retard · Réserves VGP sans intervention · Suspendues | garanties qui finissent (seuil à fixer : question de l'audit, TP-PARC) | Priorités, Aujourd'hui par technicien, Charge des 4 prochaines semaines, Interventions sans durée |
| Responsable SAV | À contrôler · Aujourd'hui · Suspendues · Retours sous 30 jours | interventions sous garantie ouvertes | Priorités, Terminées : valider le rapport puis clôturer, Interventions sans durée |
| Direction | Clôturé du mois · En retard · Parc suivi · À facturer | P1 à planifier | Le mois (créées, clôturées, heures au compteur, clôturées par nature), Priorités, Charge des 4 prochaines semaines, Journal d'aujourd'hui |
| Administrateur | Accès à ouvrir · Données à compléter · Import en contrôle · Parc suivi | habilitations expirées ; habilitations à renouveler à 60 jours ; sites sans trajet connu | Accès à ouvrir, Données à compléter, **Mise en route** (PU-1), Journal d'aujourd'hui |

- La bande de chaque composition : trois décomptes communs — demandes en attente de qualification et techniciens indisponibles aujourd'hui (gardés par D128), interventions sans durée prévue (TABLEAU-1) —, puis le décompte propre au rôle ; chacun ouvre sa liste, avec le même critère (IN-47).
- « Interventions sans durée » remplace « Activité récente », comme dans le produit depuis TABLEAU-1 (23/09). Le journal n'est montré qu'aux rôles qui ont le droit de le lire, direction et administrateur (`consulter_journal_audit`, `lib/auth/habilitations.ts:167`).
- Les alertes du CDC §16.1, telles quelles : rapport non validé depuis plus de 48 h (tuile « À contrôler », priorités), retour sous 30 jours au sens de RG-INT-10 amendée par D25 (§1 ; responsable SAV), habilitation à J-60 (priorités du responsable matériel, bande de l'administrateur), demande non qualifiée après 30 minutes (priorités).
- Aucun pourcentage d'équipe (R2-13) : la charge est celle de chaque technicien (D111), aujourd'hui (« Aujourd'hui, par technicien ») et sur les 4 prochaines semaines, en tableau : une ligne par technicien, une colonne par semaine, « Absent » quand il l'est toute la semaine.
- « Priorités opérationnelles » (bloc de la maquette complète) : filtre en liste déroulante (D122) — « Tous les besoins », puis Urgences, Retards, À planifier ou transmettre, Contrôle, Pièces, Équipe, chacun avec son nombre ; une action directe par ligne (Appeler, Déplacer…, Transmettre…) ou un lien ; nombre de lignes à fixer (IN-49).
- **T** : tuiles sur 2 colonnes (une sous 600 px), priorités en liste.
- **Repères** : IN-46 à IN-49, MO-6, D111, D122, D128, TABLEAU-1, CDC M9, CDC §16.1.

**Indicateurs du mois** — `/indicateurs` · nouvelle (MO-6, QT-20)
- **E** : mois précédent/suivant ; 4 tuiles ; clôturées par nature, temps, chiffre d'affaires (si droit), registre VGP.
- **U** : décomptes seulement, comparés au mois précédent ; export, impression. Aucun objectif, aucun taux consolidé.

**Planning** — `/planning` · refondue
- **La spécification et la maquette du 27/09 font foi.** Cette page les place dans la coque :
  - en tête : « Transmettre demain (N) » (PG-E1, QG-5) et « Intervention » ; vues Jour et Semaine (2 semaines et Mois : spécification du 27/09, non dessinées) ;
  - filtres en listes déroulantes (D122 ; PG-C6) : technicien, priorité, nature, statut, et « Réinitialiser » ;
  - grille techniciens × jours : colonnes de jour de 150 px au moins, défilement horizontal avec un indice visible, jours fermés et fériés à 36 px ; Ducos du lundi au samedi (QG-7) ;
  - la page garde la largeur utile de 1 400 px ; « Plein écran » (QG-1, déjà décidé) replie la barre latérale et la file « À traiter » : ce n'est pas un écart ;
  - colonne « À traiter » à onglets (PG-C2) : À planifier · En retard · Sans durée · Suspendues, puis Déplanifiées avec DEPLANIFIEE-1 ; filtre Zone (MO-18) ;
  - charge par technicien seulement (D111 : le taux sous son nom) ; capacité = heures d'ouverture de l'agence ; rouge au-delà de 100 % ;
  - une carte ouvre le volet de l'intervention (440 px, spécification du 27/09, §3.9) : ouvrir la fiche, l'action principale du statut (« Poser », « Transmettre… », « Déplacer… ») et « ⋯ », qui suit le statut comme celui de la fiche (§5, fiche intervention) : « Déplacer… » pour une planifiée, « Remettre dans la file », « Changer la priorité… », « Annuler l'intervention… » avec motif (PG-C5) ; sur une carte déjà datée de la file (en retard), le bouton dit « Déplacer… », pas « Poser » ;
  - « Poser » (carte de la file) et « Déplacer… » (volet) ouvrent la fenêtre de pose (§3.4 ; PG-B2, B3 ; spécification du 27/09, §3.10) : l'ADV choisit le technicien et le jour ; la fenêtre montre ses créneaux libres pour la durée, les refus (habilitation, chevauchement, absence, agence fermée) et les avertissements non bloquants (« ! Hors des horaires d'accès du site », trajet inconnu) ; la valorisation s'y choisit (trois modes, aucun d'avance : QT-6 a) ;
  - « Absence » sur la ligne d'un technicien (MO-31), légende.
- **T** : les onglets de PG-D4 : Aujourd'hui · À traiter · Semaine ; « Poser » au lieu du glisser.

**Demandes** — `/demandes` · refondue (QT-14 a)
- **E** : onglets « À traiter » (nouvelles et qualifiées, la plus ancienne d'abord ; le compteur passe au rouge quand une demande attend sa qualification depuis plus de 30 minutes, CDC §16.1) et « Traitées » (transformées ou closes sans suite, la plus récente d'abord ; IN-40) ; tableau (transactionnel, D123) : n°, reçue, client · site, demande, source et qui l'a saisie ; à traiter : l'état et « Qualifier » ; traitées : la suite (l'intervention créée, ou le motif de clôture).
- **E, listes closes du produit** : états `StatutDemande` (Nouvelle, Qualifiée, Transformée, Close sans suite) ; sources `SourceDemande` (appel téléphonique, portail client, courriel, échéance contractuelle, seuil de compteur, détection par un technicien) ; motifs `MotifClotureDemande` (4) ; `prisma/schema.prisma` l.2188-2213.
- **U**
  - « + Demande » (le bouton principal) ouvre un volet : source (celles qu'on saisit à la main : appel, courriel, détection par un technicien), client, site, machine (facultative), ce qui est demandé ; la demande attend dans « À traiter » ;
  - le bureau crée aussi une demande depuis la suite à donner d'une intervention (« Créer une demande », un geste : QT-14 a ; le CDC M5 voudrait une création automatique : écart à arbitrer) ; le portail viendra ensuite.

**Qualifier une demande** — `/demandes/:id` · refondue
- **E** : à gauche, ce qui a été signalé (citation), à droite l'intervention d'origine et l'historique de la machine.
- **U**
  - « Transformer en intervention » : nature, priorité (rien d'imposé), description reprise, durée (facultative, choix rapides) ;
  - puis « Créer », et « Planifier maintenant » ou « Laisser dans la file » (PG-B6) ;
  - « Clore sans suite » demande un des quatre motifs de la liste close (`MotifClotureDemande`), aucun choisi à l'avance (IN-44) ;
  - une demande traitée ne sert plus (IN-42).

**Interventions (registre)** — `/interventions` · refondue (É-8)
- **E** : 8 onglets qui répondent chacun à une question, avec leur ordre écrit (IN-09).

| Onglet | Colonnes | Ordre |
|---|---|---|
| À planifier | priorité, intervention, client · site, demande, ancienneté, durée, « Poser » | priorité, puis la plus ancienne |
| Aujourd'hui | heure, intervention, client · site, technicien, statut (« pas démarrée », « pas encore transmise »), « Transmettre… » (planifiée) ou « Contrôler » (terminée) | par heure |
| En retard | prévue, intervention, client · site, technicien, statut, « Déplacer… » | la plus ancienne d'abord |
| En cours | début, intervention, client · site, technicien, compteur | par heure de début |
| Suspendues | depuis, intervention, client · site, motif, pièce attendue et sa date, « Poser » | suspendue depuis le plus longtemps d'abord |
| À contrôler | terminée, intervention, client · site, technicien, rapport et signature, « Contrôler » (ou « Clôturer… » quand le rapport est validé) | terminée depuis le plus longtemps d'abord |
| À facturer | voir la page suivante | |
| Toutes | date, intervention, client · site, technicien, statut, priorité | à planifier en tête, puis la plus récente |

- **U**
  - recherche sur n°, client, site, commune, n° de série ;
  - filtres en listes déroulantes (D122) : Technicien, Priorité, Nature, Statut (onglet « Toutes »), et « Suivi » — retours sous 30 jours (RG-INT-10, D25 : §1), sous garantie ouvertes, sans durée prévue : la même liste que le décompte du tableau de bord qui y mène ; « Effacer les filtres » ;
  - période invalide dite, sans rien vider (IN-07) ;
  - densité « Confort · Compact » ; export de la vue (MO-9) ;
  - sélection multiple selon l'onglet (À planifier, Aujourd'hui, Toutes) : « Transmettre… » sur « Aujourd'hui » (seulement les planifiées), « Exporter » partout ; jamais de pose en lot (D106) ;
  - filtres dans l'adresse (IN-10).
- **T** : cartes.

**À facturer** — `/interventions/a-facturer` · nouvelle (MO-2, QT-19 a)
- **E** : onglet du registre ; trois décomptes en lecture, qui ne filtrent rien : à facturer, montant à facturer (HT), « Plus ancienne clôture » (son âge ; il ouvre cette intervention) ; segment « À facturer · Facturées · Non facturables », chacun avec son nombre (à facturer dès la clôture, sauf garantie, recensement ou contrat forfaitaire : D8, arb l.192).
- **E, colonnes** : clôturée, intervention, client (code externe, alerte s'il manque), temps validé, main-d'œuvre, déplacement, total HT, bon (ou la facture, dans « Facturées »).
- **U**
  - total en pied ;
  - « Exporter pour la facturation » ;
  - sélection : « Marquer facturées… » (n° et date de la facture ; les montants ne changent pas) et « Exporter la sélection » ;
  - réservé aux rôles qui préparent la facturation (CDC §5.2, D37 : direction, responsable matériel, ADV) ;
  - l'écran dit « votre logiciel de facturation » (TR-53) ; un nom de logiciel en champ serait une migration (É-19, QE-15).

**Nouvelle intervention** — `/interventions/nouvelle` · refondue
- **E** : deux sections numérotées — 1. Qui et où ; 2. Ce qui est demandé — et une colonne : « Récapitulatif » (client, site, horaires d'accès, trajet aller et sa source, déplacement facturé ou « aucun forfait pour cette zone », consignes), « Qui sera prévenu » (le donneur d'ordre, par courriel, quand l'intervention est planifiée ; le technicien, quand on transmet : PG-E1), interventions sur ce site.
- **E, champs**
  - Qui et où : un seul champ cherche le client, le site ou le n° de série ; le site choisi affiche adresse, commune et horaires d'accès, et l'habilitation qu'il exige ; la machine : les machines du site en choix (famille, modèle, n° de série, état, interventions ouvertes, VGP dépassée), « Sans machine » (l'intervention porte sur le site), « Machine non listée » (on la décrit, elle entre au parc) — une au plus, facultative (PARCOURS-1, D120).
  - Ce qui est demandé : nature (les 9 valeurs, en liste, rien de choisi) ; « Machine à l'arrêt » (QG-10 : propose P1, la machine passe « En panne » jusqu'à la clôture ; en file, PG-G17) ; priorité (rien de choisi) ; description pour le technicien, avec dictée ; durée prévue facultative, en choix rapides, sans valeur par défaut (PG-B6, QG-12) ; contact sur place (facultatif) ; référence client (facultative).
- **U**
  - avant d'enregistrer : alerte de doublon quand la machine a déjà une intervention ouverte (PR-6) ; alerte de retour quand la nature est « Curatif » et que la machine a eu un curatif clôturé dans les 30 jours calendaires précédents, comptés depuis sa clôture — ni préventif ni garantie (RG-INT-10 amendée par D25 ; CDC §16.1) ;
  - un seul bouton « Créer », puis « Planifier maintenant » (la fenêtre de pose) ou « Laisser dans la file » (PG-B6) ; ni date, ni heure, ni technicien à la création (PARCOURS-1) ;
  - valorisation : rien à la création ; les trois modes de RG-TAR-05, aucun choisi d'avance, se choisissent au geste « Planifier », dans la fenêtre de pose (qualification, QT-6 a du 28/09), modifiables jusqu'à la clôture ;
  - `?client=`, `?site=`, `?machine=`, `?depuis=` pré-remplissent (IN-04, CS13) ; retour vers la page d'origine (IN-21).
- **T** : « Créer » collé en bas.

**Fiche intervention** — `/interventions/:id` · refondue (É-9)
- **E, en-tête**
  - titre : nature · client, pastilles de statut et de priorité ;
  - faits (site, machine, créneau, technicien, créée) ;
  - actions selon la matrice D8 et le rôle : à planifier, « Trouver un créneau » ; planifiée, « Déplacer… » et « Transmettre… » ; affectée, « Déplacer… » ; en cours, « Suspendre… » ; suspendue, « Poser » ; terminée, « Valider le rapport… » tant qu'il ne l'est pas (rôles qui valident) et « Clôturer… » ; clôturée, « Bon d'intervention » ;
  - « ⋯ » : à planifier, « Changer la priorité… » et « Annuler l'intervention… » ; planifiée, affectée et suspendue, les mêmes et « Remettre dans la file » ; en cours, « Changer la priorité… » et « Annuler l'intervention… » (D8 à la lettre : En cours → Annulée est permise ; QT-4 a) ; terminée, « Bon d'intervention (version client) » et « Rouvrir » (elle repasse « En cours » pour correction). « Annuler l'intervention… » demande un motif ; jamais sur une terminée ni sur une clôturée (matrice D8 ; IN-16).
  - Un libellé par geste : « Déplacer… » pour une intervention déjà datée, en retard comprise (jamais « Replanifier ») ; « Remettre dans la file » (jamais « Remettre à planifier »).
  - Au téléphone, la barre collée en bas porte les deux actions du statut **et « ⋯ »** : aucun geste de la fiche n'est réservé au bureau (les libellés passent sur deux lignes plutôt que d'être coupés, jusqu'à 320 px).
- **E, bandeau selon l'état** : à planifier depuis (rouge pour une P1 ; « rendue par une absence »), en retard, compteur en marche, suspendue depuis (motif, pièce et date), clôture pas encore possible (ce qui manque) ou prête à clôturer, reprise de l'archive (IN-23).
- **E, frise D8** : puis 5 onglets.
  - Résumé : sur une terminée, le bloc **« Avant de clôturer »** en tête ; demande (nature, priorité, valorisation, et le lien vers la demande d'origine ou la réserve VGP quand il existe : le schéma n'a pas de champ « Origine », seulement `demande_id` sur l'intervention, `prisma/schema.prisma:1651`, et `intervention_id` sur la réserve, l.2331 ; aucune origine n'est saisie ; pour un retour sous 30 jours, la ligne « Retour sous 30 jours » avec le curatif clôturé qui le précède, RG-INT-10) ; machine (une au plus, PARCOURS-1) ; rapport et « Suite à donner → Créer une demande » (MO-5, QT-14 a) ; sur place ; chronologie unique ; note interne libellée (IN-25).
  - Temps : segments du compteur ; temps mesuré (jamais modifiable) et temps validé (D120).
  - Rapport : prestations, commentaire, suite, photos, signature (nom et fonction du signataire, ou client absent avec motif), validation (par qui, quand). L'état « rapport validé » est à créer (IN-20).
  - Valorisation : les trois modes de RG-TAR-05, aucun choisi d'avance, choisis au geste « Planifier » (qualification, QT-6 a du 28/09), modifiables jusqu'à la clôture ; montant provisoire, ou figé à la clôture (QT-7). Sans forfait pour la zone : « Aucun forfait de déplacement pour cette zone ».
  - Historique.
- **« Avant de clôturer »** (terminée) : rapport validé ; signature du client, ou motif de son absence ; temps mesuré, compteur arrêté ; temps validé ; montant figé à la clôture (rôles qui voient les montants). Chaque ligne qui manque dit la correction à faire. « Clôturer… » reprend la même liste ; « Clôturer » reste désactivé tant qu'une ligne manque (RG-INT-03, RG-INT-04, QT-5) ; ensuite, « À facturer » (sauf garantie, recensement ou contrat forfaitaire, D8) et plus d'annulation. Clôturer : le bureau, et le technicien sur sa propre intervention (D131).
- **Temps validé : la lecture de D120, et sa limite**
  - « Valider le rapport » (responsables, direction, administrateur ; jamais l'ADV, CDC §5.2) fixe le temps validé : le dialogue le propose égal au temps mesuré ; corrigé, il garde l'auteur et la date.
  - « Corriger le temps validé… » est offert, sur une terminée, aux responsables et à l'ADV, parce que D120 dit : « le temps validé, que le responsable ou l'ADV peut corriger à la validation ». La correction garde l'auteur et la date ; après la clôture, rien ne se corrige (montant figé, QT-7).
  - Limite : D120 dit « à la validation », et l'ADV ne valide pas (CDC §5.2). Lui offrir la correction hors de ce geste est une lecture, pas la lettre ; D120 ne nomme pas non plus la direction ni l'administrateur, qui fixent ce temps en validant. Si Alexis lit « à la validation » au pied de la lettre, le bouton de l'ADV disparaît et seule la correction dans le dialogue de validation demeure.
- **U** : « Suspendre… » (bureau) : un motif, rien de choisi — En attente de pièce, Accès impossible, Autre (à préciser) — et une précision ; pour une pièce, sa référence et sa date de disponibilité, obligatoires ensemble (RG-INT-06) ; le compteur s'arrête, l'intervention rejoint « Suspendues » au planning.
- **T** : les deux dernières actions collées en bas ; frise réduite à « Étape n sur 6 ».

**Bon d'intervention** — `/interventions/:id/bon` · refondue
- **E** : hors de la coque (IN-37) ; barre d'outils (retour, version client ou interne, imprimer) ; page A4.
- **E, contenu** : société émettrice (raison sociale et mentions légales : QE-15), intervention, date de réalisation (IN-38), client, site avec adresse et accès (IN-36, QT-18), machine, demande, travaux, suite, signatures (client : nom et fonction ; technicien).
- **U** : version client **sans montant** (QT-8) ; version interne marquée « ne pas remettre au client ».

**Absences** — `/absences` · refondue (É-16)
- **E** : les trois décomptes de la maquette complète et du produit : « Absences ce mois » (et les personnes concernées), « Rupture de service » (une agence sans technicien disponible aujourd'hui), « Demandes à valider : sans objet » (une absence bloque l'agenda dès qu'elle est déclarée ; QT-23 de l'audit la remplacerait par « Absents aujourd'hui ») ; la semaine en calendrier, gardée ; les blocs « Interventions rendues à la file à planifier » et « Rupture de service » (D128) ; puis **les 4 prochaines semaines en bandes**, le seul ajout (É-16, QE-13e) ; enfin le tableau.
  - Tableau : technicien, période, durée, état (à venir, en cours, terminée, lu dans les dates), interventions rendues à la planification, action.
  - Onglets : à venir et en cours ; aujourd'hui ; terminées.
- **U**
  - « Déclarer une absence » en volet : technicien (aucun choisi d'avance, TR-9), du, au, demi-journée ou plage horaire (QG-8, PG-G15). Ni type, ni motif, ni note : arbitrage R3-14 du 14/09 (une nature d'absence est une donnée de santé par déduction) ;
  - **l'impact avant d'enregistrer** : « N interventions repasseront à planifier » (RG-PLA-06 : automatique, sans case à cocher) ;
  - « Écourter » au lieu de « Lever » (QT-15) ; rien sur une absence terminée (TR-2).
- Titre « Absences » partout (PG-G15).

### 5.4 Clients et parc

**Clients** — `/clients` · refondue (= maquette complète : cartes, D123)
- **E** : puces à décompte (Actifs, Inactifs, Sans code externe, Tous ; QE-10) ; tri par raison sociale (et par nombre de machines ou dernière intervention si QE-13c retient ces compteurs).
- **E, carte** : nom, commune, catégorie, état « Actif » (CS1), code externe ; compteur de sites (existant) ; donneur d'ordre et compteurs machines, à planifier, dernière intervention (la dernière datée) : É-14, QE-13c.
- **U** : recherche sur raison sociale, code et commune, sans accents (CS2) ; export.
- Les compteurs nouveaux demandent des fonctions de dépôt groupées (condition de réouverture de D123).

**Nouveau client** — `/clients/nouveau` · refondue
- **E** : un seul champ obligatoire ; alerte de client proche avant de créer ; « Créer et ajouter un site » ; volet « Ensuite » (site, donneur d'ordre, machines).
- **U** : saisie gardée au refus (CS23) ; double clic sans double création (CS24).

**Fiche client** — `/clients/:id` · refondue
- **E** : en-tête (code, état, faits) ; 5 tuiles cliquables (CS12) : sites, machines (vers le parc filtré), interventions ouvertes, prochaine intervention et dernière intervention (la dernière datée, TP-A1 du 28/09 ; I-10) ; onglets.
  - Aperçu : bloc « À traiter », sites en cartes, historique dans l'ordre de TP-A1 (les ouvertes sans date en tête, la plus urgente puis la plus ancienne, puis la plus récente), interlocuteurs avec « qui reçoit quoi », identité.
- **U**
  - « + Intervention » et « + Site » pré-remplis (CS13) ;
  - désactivation refusée s'il reste des interventions ouvertes, avec leur liste (QT-16) ;
  - un client inactif est signalé sur sa fiche (CS15) ;
  - un seul chemin de retour (I-13 ; sa forme : décision de l'audit, TP-NAV).

**Sites** — `/sites` · refondue (= maquette complète : cartes)
- **E** : puces (clients actifs, trajet inconnu, sans zone, clients inactifs ; QE-10) ; « Client — Site » sans répétition (CS26).
- **E, carte** : adresse, zone, agence, habilitation exigée ; trajet (« (zone) » quand il vient de la référence, « ? » inconnu : CS25) ; compteurs machines, ouvertes, VGP dépassées (É-14, QE-13c).

**Nouveau site** — `/sites/nouveau` · refondue
- **E** : client pré-rempli ou cherché (homonymes distingués par commune et code, CS40) ; agence choisie d'office s'il n'y en a qu'une (CS41).
- **E, champs** : adresse en ligne libre (QT-18) ; commune ; zone (sans zone : prévenu) ; trajet (vide = référence de la zone, valeur affichée) ; horaires d'accès ; consignes ; sous contrat.
- **U** : sites existants du client à côté ; plus de promesse de « tournées » (CS34).

**Fiche site** — `/sites/:id` · refondue
- **E** : faits (adresse, horaires d'accès, trajet appliqué et sa source : CS33, zone et agence) ; consignes en tête.
- **E, blocs** : « À traiter » (CS29) ; machines du site avec « + Intervention » par machine ; historique dans l'ordre de TP-A1 ; **« VGP du site »** (CS30) ; **« Qui sera prévenu »** ; habilitations exigées ; interlocuteurs.
- **U** : « Exiger une habilitation » réservé à l'administrateur tant que la décision de l'audit (TP-S : D130 ou D37, CS31) n'est pas prise.

**Parc machines** — `/parc` · refondue (= maquette complète : maître-détail, D125)
- **E** : 3 tuiles (suivies, en panne, garanties qui finissent : seuil à fixer, question de l'audit pour TP-PARC, PV-08) ; puces (dans le parc, en panne, garantie proche, **sorties du parc** : PV-01 ; client, site, famille ; QE-10).
- **E, liste** : famille · marque et modèle, client · site · n° de série, état.
- **E, aperçu** : identité dans l'ordre de D126, fin de garantie, dernières interventions avec statut (PV-05), « Fiche complète » et « + Intervention » (jamais sur une machine sortie, PV-19).
- **U** : recherche sur la référence interne (PV-03).
- **T** : une ligne ouvre la fiche (PV-07).

**Nouvelle machine** — `/parc/nouvelle` · refondue
- **E** : où, quoi, n° de série (RG-PAR-02) ; modèles filtrés par famille ; « Je ne peux pas le lire » (n° provisoire `SN-INCONNU-…` du produit, `lib/machines/saisie.ts`) ; contrôle de doublon avant d'enregistrer ; aperçu de l'étiquette.
- **U** : état limité à En service, En panne, Arrêtée (PV-27) ; criticité sans valeur imposée (PV-28) ; « Créer et en ajouter une autre » garde client et site.

**Fiche machine** — `/parc/:id` · refondue (É-9)
- **E, titre** : la machine elle-même (famille · marque et modèle), pas « Fiche machine » (TR-51, QE-9).
- **E, faits** : client, site, n° de série, année de vente, échéance VGP.
- **E, blocs**
  - identité (D126, avec garantie, criticité, localisation : PV-17) ;
  - historique dans l'ordre de TP-A1, colonne « Statut » (PV-13) ; pas de colonne Machine (une intervention = une machine) ;
  - historique des états et emplacements ;
  - VGP (échéance, dernière information, réserves et leur suite, « Enregistrer ») ;
  - **Gestes** : changer l'état, transférer, remplacer, sortir du parc (MO-8 ; QT-12 a : le bureau seulement, tracé). « Sortir du parc » et « Remplacer » restent possibles quand une intervention est ouverte : le dialogue avertit, liste ces interventions et dit ce qu'elles deviennent ; motif obligatoire. Les refuser tant qu'une intervention est ouverte reste une proposition, à poser avec TP-PARC (une question de lot, pas une QE) ;
  - étiquette QR avec désignation et n° de série (QT-11).
- **U** : une machine sortie du parc le dit et ne propose plus de nouvelle intervention (PV-19) ; le bloc Documents n'apparaît qu'avec un document (MO-26).

**Corriger la fiche** — `/parc/:id/modifier` · refondue
- **E** : les champs de saisie ; à côté, les quatre gestes pour ce qui ne se corrige pas ici. Plus d'impasse (PV-25). Retour à la fiche avec un message (PV-18).

**VGP · Registre** — `/vgp` · refondue (É-15)
- **E** : onglets Registre, Réserves, Familles à déterminer (seulement s'il y en a ; QE-13d) ; 4 tuiles (dépassées, à venir sous un horizon à fixer — question de l'audit pour TP-VGP, PV-35 —, sans information, informations reçues).
- **E, puces** (QE-10) : client, site, état ; « Hors registre » et « Grouper par client » en interrupteurs.
- **E, tableau** : machine, client · site, information (reçue le… · organisme, ou sans information : jamais un verdict de conformité, D88), échéance, réserves, « Enregistrer ».
- **U** : ordre du 25/09 gardé et dit au-dessus (QT-13 a) ; compte et pagination (PV-30) ; clients inactifs hors registre : question de l'audit (TP-VGP, PV-32) ; vue groupée imprimable (MO-12).

**VGP · Réserves** — `/vgp/reserves` · nouvelle (MO-3, QT-9 a)
- **E** : segment (à traiter, levées, écartées, toutes) ; puce « Sans intervention » ; tableau : réserve, vérification, machine, client · site, état, intervention (lien), actions.
- **U** : trois états — à traiter, levée, écartée (QT-9 a) ; l'intervention créée est un lien affiché, pas un état ; « Créer l'intervention », une par une, par un geste humain, dans un court dialogue (nature et priorité obligatoires, rien de choisi d'avance ; durée facultative ; description reprise de la réserve) ; la réserve reste « à traiter » jusqu'à sa levée ; « Écarter… » avec motif. Rien de créé à l'import (22/09). L'état demande une migration (geste d'Alexis).

**VGP · Familles à déterminer** — `/vgp/a-determiner` · fusionnée (MO-29)
- **E** : onglet qui n'existe que s'il y a une famille à décider.
- **U** : « Décider le régime » (soumise : périodicité et référence du texte, obligatoires ensemble, D88 §4 ; ou non soumise ; aucune valeur proposée), puis la campagne s'ouvre.

**Enregistrer une vérification reçue** — `/vgp/enregistrer/:id` · refondue
- **E** : « Ce que l'on sait déjà » à côté (PV-48) ; date future refusée (PV-46 ; décision de l'audit pour TP-A2) ; origine : les quatre valeurs de la liste close (`OrigineInformationVgp`, D114), aucune choisie à l'avance ; organisme obligatoire, comme dans le produit (facultatif pour une déclaration du client : question PV-47).
- **U** : une réserve par ligne, créée « à traiter » ; retour au registre avec un message ; double envoi bloqué (PV-45).

**Scan d'une étiquette** — `/scan/:jeton` · nouvelle (MO-4, QT-10 a)
- **E** : trois états : machine trouvée (« Ouvrir la fiche », « Nouvelle intervention »), connexion exigée, étiquette inconnue (« Rattacher à une machine »).
- **U** : bureau vers la fiche, technicien vers la fiche terrain.

### 5.5 Paramètres, imports, compte

**Paramètres** — `/parametres` · refondue (QT-21, écart É-18)
- **E** : carte « Identité de la société » en lecture, en tête (QT-22 a) ; puis des sections si PA-08 les retient, chaque porte avec son décompte ou son alerte selon la même réponse :
  - Tarifs : taux et forfaits ;
  - Planification : trajets, prestations (durées : D109) ;
  - Organisation : agences, équipe et accès, habilitations ;
  - Référentiels : matériel ;
  - Données : imports, données à compléter, journal.
- Un décompte est un lien à part, qui ouvre la liste exacte qu'il compte ; la carte ouvre l'écran.
- Portes Clients et Sites retirées (MO-27). Direction : selon la réponse à PA-02 (TP-S).

**Identité de la société** — carte en lecture dans le hub (QT-22 a) ; plus de page : `/parametres/societe` renvoie au hub
- **E** : raison sociale, territoire, devise, fuseau horaire, libellé du code externe, mentions légales (pied des documents). Ni adresse, ni téléphone, ni RIDET, ni nom de logiciel en champ (É-19, QE-15). La majoration hors ouverture n'y est pas affichée (qui la lit : PA-01, PA-10). Logo et couleurs au lot 7.

**Agences** — `/parametres/agences` · fusionnée (MO-30)
- **E** : une liste, inactives en fin (PA-27) ; horaires lisibles d'un coup d'œil (PA-31).

**Fiche agence** — `/parametres/agences/:id` · fusionnée
- **E** : horaires dessinés comme une journée (plages, « Fermé » comme état : PA-34), pas des créneaux ; fériés de Nouvelle-Calédonie avec « Travaillé » (RG-PLA-02) ; ponts. Ducos : du lundi au samedi (QG-7).

**Nouvelle agence** — `/parametres/agences/nouvelle` · refondue
- **E** : territoire et fuseau dans des listes (PA-35) ; horaires : « Copier ceux d'une agence » ou « Les régler après la création », rien de choisi d'avance ; aucune plage pré-remplie (PA-34) ; sans horaires, l'agence reste fermée.

**Tarifs** — `/parametres/tarifs` · fusionnée (MO-32, facultatif)
- **E** : taux horaire avec état par ligne (en vigueur, remplacé le… : PA-11) ; forfaits avec « désigné par N interventions » et historique (QT-7) ; zones sans forfait dites en toutes lettres (PA-19) ; plus de case « Cumulable » (PA-20 : décision de l'audit pour TP-ARG).
- **U** : « Poser un nouveau taux » : aucune valeur proposée ; avertit des interventions non clôturées touchées par une date passée (PA-12). Qui lit un tarif : question de l'audit (TP-S, PA-01, D37).

**Trajets par zone** — `/parametres/trajets` · refondue
- **E** : référence, votre valeur, sites, forfait de déplacement ; une durée écrite une fois (PA-24) ; sous le tableau : « Valeurs de référence : décision du 12/09/2026, trajet aller depuis l'agence de départ » (PA-26). Qui règle les trajets : question de l'audit (TP-S, PA-25).

**Prestations** — `/parametres/prestations` · refondue
- **E** : familles, durée type (jamais un prix, D109), utilisation ; modifier en volet (PA-16) ; familles actives seulement (PA-17).

**Référentiel matériel** — `/parametres/materiel` · refondue
- **E** : deux onglets, Familles (régime VGP, « Décider le régime ») et Modèles (recherche, nombre de machines, pagination : PA-43, PA-45).

**Équipe et accès** — `/parametres/equipe` · refondue (QT-1 a, MO-1)
- **E** : alerte « N personnes ne peuvent pas se connecter » ; onglets Techniciens et Comptes de bureau, triés par nom (PA-39) ; filtres ouverts par les décomptes (accès à ouvrir, échéance dépassée ou à J-60, habilitation).
- **E, techniciens** : statut salarié ou patenté (PG-G16), habilitations et échéances (« Renouveler » : PA-40), à venir, état de l'accès.
- **U**
  - « Envoyer le lien d'accès », « Renvoyer le lien », « Tout envoyer » ; le lien vit une heure (produit) ;
  - second facteur exigé pour la direction et l'administrateur (RG-DRO-05) ;
  - **seulement après TP-S** (QT-1 a).

**Habilitations** — `/parametres/habilitations` · refondue
- **E** : une seule liste (A-02) : code, libellé, validité, techniciens, sites qui l'exigent (PA-42) ; échéance signalée à J-60 (CDC §16.1).

**Données à compléter** — `/parametres/donnees` · nouvelle (MO-7)
- **E** : un point par trou (dix définis ; un point à zéro disparaît), chacun avec son décompte, ce qu'il fausse, des exemples, et « Compléter », qui ouvre la liste exacte. Ce n'est pas un tableau de bord : aucun seuil, aucune alerte (AV-14).
- **U** : ouverte aux rôles de « Paramétrer une société » (CDC §5.2 : administrateur ; direction selon PA-02) ; l'ouvrir à l'ADV est une question (QE-19), à poser avec TP-S.

**Journal d'audit** — `/parametres/journal` · nouvelle (audit §6.2, « plus tard »)
- **E** : quand, qui, action, objet (lien) ; filtres ; export. Administrateur et direction ; conservé 5 ans (CDC §15).

**Imports Excel** — `/imports` · refondue
- **E** : les 4 étapes (fichier, contrôle, confirmation, résultat) ; lot en attente mis en avant ; historique ; les dix types du produit, dans son ordre, chacun avec son modèle Excel réellement téléchargeable (PA-48) ; un type réservé à un autre rôle est marqué d'un cadenas (QT-3 a).
- **U** : « Interlocuteurs » appliqué (MO-10).

**Rapport d'import** — `/imports/:id` · refondue
- **E** : état et temps des verbes cohérents : « seront créées » avant, « créées » après (PA-53, PA-54) ; 4 chiffres ; **rejets regroupés par motif** avec la correction à faire et « Télécharger les lignes rejetées » (PA-55).
- **U** : « Appliquer » confirmé ; « Abandonner le lot » avant application (rien n'est écrit ; geste à créer : aujourd'hui un lot contrôlé reste « Contrôlé ») ; « Défaire ce lot… » après, confirmé, qui dit ce qui sera retiré (PA-56) ; lot introuvable = page qui le dit (PA-58).

**Mon compte** — `/compte` · nouvelle (audit §6.2, « plus tard »)
- **E** : rôle, société, courriel, second facteur ; changer son mot de passe soi-même : fermé (D58) — le nouveau lien vient de l'administrateur (QT-1 a). Ni sessions ouvertes, ni « Se déconnecter partout » : rien dans le produit ne les porte.

**App technicien (rôle de bureau)** — `/terrain` ouvert par un rôle de bureau · refondue (QT-24 a)
- **E** : dit ce qu'est l'application et où l'on prépare ce qu'elle montre (le planning), avec un lien vers lui. Plus de renvoi silencieux (TR-44). L'entrée reste au menu des rôles qui ont `saisir_rapport` (D132).

**État de l'installation** — `/sante` · refondue
- **E** : la version servie (commit) et sa date, base, migrations, courriels, stockage ; aucune donnée de société (TR-42, TR-43).

### 5.6 Terrain (téléphone du technicien)

Règles communes :
- en ligne seulement (D121 ; hors ligne différé le 19/09) : « Pas de réseau : rien n'est enregistré tant qu'il ne revient pas » ; un bandeau avec l'état du réseau ;
- ne montre que ce que le bureau a transmis (QG-5) ;
- cibles de 44 px et plus (CDC §13.4), texte de 15 à 16 px ;
- aucun montant (CDC §5.2) ;
- aucune position enregistrée : CDC §15 = point d'arrêt (migration, information du collaborateur), hors TP-UX.

| Écran | Cible | Repères |
|---|---|---|
| **Ma journée** `/terrain` | ce qui est transmis : bandeau du compteur en cours ; aujourd'hui (cartes : heure, priorité, statut, client, nature, machine, site, durée, panne) ; demain ; la semaine ; sans réseau, le message | TR-14 à TR-16, QG-5 |
| **Intervention** `/terrain/:id` | à démarrer : « Je suis arrivé · démarrer », itinéraire, appeler ; en cours : la carte du compteur avec « Mettre en pause » puis « Reprendre le compteur », et en bas « Suspendre » (motif) et « Terminer » ; demande, machine, sur place (adresse, accès, consignes, contact), dernières interventions | TR-19, TR-22, QT-4, D120 ; « Mettre en pause » : produit (ci-dessous) |
| **Rapport** | ouvert par « Terminer » : prestations en choix (filtrées par famille, rien de coché), commentaire avec dictée, suite à donner (facultative : le bureau la lit sur la fiche et peut en créer une demande, QT-14 a), photos | BON-2, CDC §13.4 |
| **Signature et fin** | nom (obligatoire) et fonction du signataire, tracé, ou « Le client est absent » avec motif ; « Terminer l'intervention » reste désactivé tant qu'il manque la signature et le nom, ou le motif | QT-5, CDC M5, 76-BON-4 |
| **Scanner** | viseur, saisie du n° si l'étiquette est abîmée, machines récentes | MO-4 |
| **Fiche machine** | identité, état, garantie, VGP, historique ; hors de son périmètre, la fiche le dit | CDC §13.3 ; « Signaler une panne » seulement si QT-14 l'ajoute (option à ajouter : le technicien crée une demande depuis la fiche machine, CDC §5.2) |
| **Mes machines** | recherche dans le parc permis (RG-DRO-02, D22 : ses interventions, le parc des clients qu'il visite sous 7 jours) ; « Créer une machine sur place » | QT-2 |
| **Machine express** | photo de la plaque, famille et modèle en choix, n° de série, emplacement, « Créer et suivante », compteur de machines créées | CDC §8.1, §13.3 ; attend le hors ligne (différé) |
| **Profil** | habilitations et échéances (J-60, CDC §16.1), ses 7 prochains jours avec sa propre absence (QT-2 a), l'état du réseau, se déconnecter | CDC §13.3 ; déclarer lui-même son absence : question de l'audit (TP-ABS, TR-5) |

**Acquis du produit : « Mettre en pause ».** Le terrain du produit a un seul bouton d'arrêt, « Mettre en pause » (`lib/i18n/fr.ts:1854`, clé `terrain.compteur.pause` ; le refus « Mettez-le en pause avant d'en démarrer un autre », l.1855-1856) : il ferme le segment du compteur et l'intervention reste « En cours » (`app/(mobile)/terrain/[id]/page.tsx:66-67`). Une pause courte (repas) n'est donc pas comptée et ne suspend rien : ce n'est pas une question.
- La maquette le garde sur la carte du compteur (« En pause depuis … · temps mesuré ») et nomme la relance « Reprendre le compteur », qui ouvre un nouveau segment ; le produit réaffiche « Démarrer l'intervention » : un libellé à changer avec TP-UX7.
- « Suspendre » est un autre geste : il change le statut (« Suspendue »), avec un motif obligatoire, et pour une pièce sa référence ET sa date de disponibilité (RG-INT-06) ; puis « Reprendre ».

### 5.7 Hors V1

**Portail client** — `/portail` · aperçu (CDC M8)
- **E** : le parc du client, le prochain passage, les rapports (sans montant), « Demander une intervention ». Dessiné pour montrer où aboutissent les « Demandes ».

---

## 6. Écarts à la maquette complète et aux décisions de forme

La maquette complète fait foi sur les couleurs, la police, le rayon, l'ombre (D124) et sur la disposition des quatorze écrans qu'elle dessine (D125). Voici, nommé, tout ce que la cible fait autrement ; aucun n'est comblé en silence. Les questions sont en tête du document, et détaillées au §7.

| # | Écart | Contre | Pourquoi | Question |
|---|---|---|---|---|
| É-1 | Rien sous **12 px** : pastilles, en-têtes de tableau, groupes du menu et compteurs des cartes passent de 10,5 ou 11 à 12 px | D124 (typographie de la maquette complète) ; huit attentes de tests figent 10,5 ou 11 px | 115 textes sous 12 px relevés en ligne sur le registre (notes du 28/09) ; lisibilité au téléphone | QE-1 |
| É-2 | **Icônes SVG** au trait dans le menu et les boutons ; le menu du produit n'en a aucune, la maquette complète y dessine des glyphes Unicode (⌂ ▦ ≡ ◷ ◎ ⌖ ▣ ✓ ↗ ⚙ ⇧) | D125 (menu dessiné) | les glyphes changent selon le système et la police ; les icônes servent aussi aux boutons | QE-2 |
| É-3 | Bandeau : **recherche globale**, **« Créer »** et aide, au lieu du chemin de la route ; le fil d'Ariane et la forme du retour restent la question de l'audit (TP-NAV) | D122 (fil d'Ariane RETIRÉ, arb l.4462) ; D125 | trouver et créer depuis partout | QE-3 |
| É-4 | Menu **replié en rail** entre 900 et 1 199 px, et « Réduire le menu » à toute largeur | D125 (272 px, tiroir au téléphone) ; D121 (la barre latérale) | à 1 024 px, le planning et les tableaux manquent de place | QE-4 |
| É-5 | **Décomptes au menu** (demandes à qualifier, interventions à planifier, réserves VGP) | D121, D125 | savoir sans ouvrir ; la P1 en attente se voit de toute page | QE-5 |
| É-6 | **Téléphone de bureau** : barre basse (5 entrées), bouton « + » sur les pages sans bouton de création, actions collées en bas, dialogues en feuille basse, listes en cartes | D125 (tiroir seul) ; D121 (la barre latérale) | tout au pouce, sans rouvrir le menu | QE-6 |
| É-7 | **Tableau de bord selon le rôle** : 4 tuiles, la bande de décomptes de D128 plus un décompte propre au rôle, des blocs par rôle ; alerte P1 en tête (ADV, responsables) | D125 (4 KPI fixes, Priorités, Activité) ; D128 ; AV-14 (19/09 : la qualité des données n'est pas une alerte du matin) | chacun voit ce qu'il doit faire (CDC M9). « Interventions sans durée » à la place d'« Activité récente » n'est pas un écart : le produit l'a fait (TABLEAU-1) | QE-7 |
| É-8 | **Registre** : 8 onglets à compteur à la place des 3 KPI et de la liste « Tous les statuts » | D125 (`interventions()`) | une question par onglet, un ordre par onglet (IN-09) | QE-8 |
| É-9 | **Titre = l'objet** : « Pont élévateur 2 colonnes · Talvor T2C-40 », « Curatif · Atelier du Port » au lieu de « Fiche machine » | D125 (`machinePage()`) ; audit du 26/09 (constat M5 : le changer est un écart) | savoir quelle fiche est ouverte (TR-51) | QE-9 |
| É-10 | **Filtres en puces** (avec décomptes) dans les listes clients, sites, parc, VGP et imports ; le registre, le planning et les priorités gardent les listes déroulantes | D122 (pastilles de filtre RETIRÉES : un filtre est un `<select>`, arb l.4461) ; D123 | un clic au lieu de deux ; on voit les filtres actifs et combien ils retiennent | QE-10 |
| É-11 | **Terrain** : barre basse à 4 entrées dont « Scanner » au centre ; journée, intervention, rapport, signature en écrans séparés | D125 (`terrain()` : un écran « Mon intervention ») ; D121 : la barre du terrain reste vide (`ENTREES_TERRAIN`, R5-01, arb l.4317) | un geste par écran, au pouce, avec des gants | QE-11 |
| É-12 | (retiré : nom et fonction existent depuis 76-BON-4, schéma l.2109-2112) | | | |
| É-13 | Tuiles **toujours cliquables**, avec chevron | D125 (KPI inertes dans la maquette complète) | PR-2 | QE-13b |
| É-14 | Cartes clients : ligne **« Donneur d'ordre »** ; compteurs machines, « à planifier » et « dernière intervention » (la maquette complète dessine sites · machines · interventions, jamais la dernière) ; cartes sites : machines, « ouvertes », « VGP dépassées » | D123 (arb l.4529 : compteurs sans fonction de dépôt ; condition de réouverture) | les contacts existent depuis CONTACTS-1 ; savoir sans ouvrir la fiche | QE-13c |
| É-15 | **VGP** : onglets Registre, Réserves, Familles ; interrupteurs « Hors registre » et « Grouper par client » ; titre « Vérifications périodiques (VGP) » | D125 (`vgp()` : 4 KPI et un tableau, « Contrôles VGP ») | les réserves et les familles ont leur place sans nouvelle entrée de menu | QE-13d |
| É-16 | **Absences** : les 4 prochaines semaines ajoutées en bandes, sous la semaine en calendrier, gardée ; décomptes et blocs inchangés (maquette complète, produit, D128) | D125 (`absences()`) | on prévoit le mois sans perdre la semaine (précédent QG-2 : rien de retiré) | QE-13e |
| É-17 | **Écrans que la maquette complète ne dessine pas** (fiche intervention, formulaires, demandes, fiches client et site, paramètres, accès…) : ils suivent la disposition de la maquette du 28/09 | D95 (`CODIPLAN_Maquette.html` fait foi là où la maquette complète est muette) | un seul langage pour toutes les pages | QE-13a |
| É-18 | Hub Paramètres en **sections**, carte « Identité » en tête | D125 (3 cartes et un tableau des forfaits) | déjà posé par l'audit (PA-08, fin du §7 ; QT-22) | question de l'audit, avant TP-NAV |
| É-19 | Société : adresse, téléphone, courriel, RIDET, nom du logiciel de facturation en champs (bon, À facturer, Identité) | schéma (`Societe`, l.95-182 : seulement `libelle_code_externe` et `mentions_legales`) ; migration | un bon et un export qui nomment la société et son logiciel ; la maquette montre la réponse (a) : raison sociale, mentions légales, « votre logiciel de facturation » (TR-53) | QE-15 |

**Gardés tels que la maquette complète les dessine** : les jetons de couleur, la police, le rayon, l'ombre ; la typographie (titre de page 28 px, 24 px sous 600 px ; valeur de tuile 28 px en graisse 860) ; la largeur utile de 1 400 px (D124, D95), planning compris — « Plein écran » (QG-1) n'est pas un écart ; les ruptures de 1 180, 900 et 600 px ; la barre latérale (272 px, groupes, liseré de l'entrée active, bloc de la personne en bas) ; le bandeau de 66 px ; les surtitres bleus ; les tuiles à barre de couleur ; le tiroir de 440 px ; le maître-détail du parc ; les cartes des clients et des sites ; les décomptes et les blocs de la page Absences ; les étapes des imports ; la notification en bas à droite (la pastille « Données fictives » de la maquette n'entre pas dans le produit).

---

## 7. Questions pour Alexis (QE) : détail pour le pilote

Une question = une décision ; la recommandation est en premier ; au plus quatre par envoi. Texte, options et conséquences pour Alexis : section « Ce que je vous demande », en tête du document. Aucun lot TP-UX marqué d'une QE ne part sans sa réponse.

**Ordre** : les séries 1 et 2 de l'audit sont closes (28/09, toutes en (a)) ; la série 3 et les décisions de fin du §7 de l'audit se posent avant leur lot, comme prévu.
- D'abord QE-13a seule ;
- puis QE-1, QE-2 et QE-13b (fondations : QE-13b porte sur un composant de TP-UX1) ;
- puis QE-3 à QE-6 ;
- avant leur lot : QE-7 (après QT-20), QE-8 (après QT-19), QE-9 à QE-11, QE-13c à QE-13e, QE-15, QE-17 à QE-19.

Aucune QE ne repose une question de l'audit.

| # | Écart | Contre (décision, source) | Ce que la réponse (a) change dans le dépôt | Débloque |
|---|---|---|---|---|
| QE-13a | É-17 | D95 (`CODIPLAN_Maquette.html`, source de rang 1 : `docs/constitution/sources.md:16-18`) ; D125 | une décision qui prolonge D125, sans toucher D95 : la maquette du 28/09 fait foi sur la DISPOSITION seulement (jamais sur le contenu ni sur une règle, D128). (b) amende D95 et `docs/constitution/sources.md`, et réoriente quatre tests (`tests/unit/docs/maquette-unique.test.ts`, `tests/unit/navigation/entrees.test.ts`, `tests/unit/theme/apparence.test.ts`, `tests/unit/ui/composants-maquette.test.ts`) | TP-UX3 à TP-UX9 |
| QE-1 | É-1 | D124 (typographie) | amende D124 pour la typographie ; huit attentes de tests passent à 12 px (`composants-maquette.test.ts`, `carte-entite.test.ts`, `ecrans-largeur-utile.spec.ts` : voir TP-UX1) | TP-UX1 |
| QE-2 | É-2 | D125 (menu) ; CLAUDE.md (une dépendance est une décision) | une planche SVG dans `components/ui/icone.tsx` ; (b) serait une dépendance nouvelle, à décider à part | TP-UX1 |
| QE-13b | É-13 | D125 (KPI inertes) | tuile cliquable dans `components/ui/kpi.tsx` ; un test par tuile (chiffre = lignes) | TP-UX1 |
| QE-3 | É-3 | D122 (fil d'Ariane RETIRÉ ; chemin de la route dans la barre du haut) ; D125 | une route de recherche groupée, bornée par société et par rôle ; « Créer » et aide dans le bandeau. La forme du retour attend la décision de l'audit (TP-NAV) | TP-UX2 |
| QE-4 | É-4 | D125 ; D121 | rail de 76 px entre 900 et 1 199 px, préférence gardée sur l'appareil | TP-UX2 |
| QE-5 | É-5 | D121, D125 | trois décomptes au menu, chacun égal à sa liste | TP-UX2 |
| QE-6 | É-6 | D125 ; D121 | barre basse, bouton « + » sur les pages sans bouton de création, actions collées, feuilles basses | TP-UX2 |
| QE-7 | É-7 | D125 ; D128 ; AV-14 | cinq compositions ; dans chacune, la bande de D128 et un décompte propre au rôle ; « Interventions sans durée » à la place d'« Activité récente », comme le produit | TP-UX6 |
| QE-8 | É-8 | D125 (`interventions()`) | 8 onglets ; « À contrôler » après TP-CY, « À facturer » avec TP-MOD | TP-UX3 |
| QE-9 | É-9 | D125 (`machinePage()`) ; audit du 26/09, constat M5 | titre = l'objet sur les quatre fiches | TP-UX4 |
| QE-10 | É-10 | D122 (pastilles RETIRÉES, arb l.4461) ; D123 | puces de filtre dans les listes clients, sites, parc, VGP et imports ; le registre, le planning et les priorités gardent les listes déroulantes de D122 | TP-UX3 |
| QE-11 | É-11 | D125 (`terrain()`) ; D121 (barre du terrain vide) | barre basse du terrain, un écran par étape | TP-UX7 |
| QE-13c | É-14 | D123 (arb l.4529 ; condition de réouverture) | de nouvelles fonctions de dépôt groupées (machines et interventions par client, machines et VGP par site) | TP-UX3 |
| QE-13d | É-15 | D125 (`vgp()`) | trois onglets et le titre | TP-UX3, avec TP-VGP |
| QE-13e | É-16 | D125 (`absences()`) ; précédent QG-2 (ajouts seulement) | les 4 prochaines semaines en bandes, en plus de la semaine ; rien d'autre ne change sur la page | TP-UX3, avec TP-ABS |
| QE-15 | É-19 | schéma (`Societe`, l.95-182) | rien : le bon lit la raison sociale et `mentions_legales`. (b) : une migration (point d'arrêt, geste d'Alexis, RELEASE-1) | TP-ARG, TP-UX9 (bon) |
| QE-17 | — | CDC §15 (sessions expirantes ; session longue du technicien sur appareil enregistré) | rien | TP-S, TP-UX8 (connexion) |
| QE-18 | — | QT-1 (a) ; TR-32 ; D58 | rien. (b) : une route publique sans session (point d'arrêt : cloisonnement, abus) | TP-ACC, TP-UX8 (premier accès) |
| QE-19 | — | CDC §5.2 (« Paramétrer une société ») | un droit d'accès à la page pour l'ADV | TP-S, TP-MOD |

**À ajouter à une question de l'audit** : QT-14 (série 3), option (d) « Signaler une panne » depuis la fiche machine du terrain — le technicien crée une demande ; CDC §5.2 (l.273) le lui permet.

**Numéros laissés vides** : 12 (le nom et la fonction du signataire existent déjà depuis 76-BON-4), 14 (le glossaire et son gardien sont une question de l'audit, TP-NAV) et 16 (la pause courte existe déjà au terrain du produit, « Mettre en pause » : §5.6). Les numéros suivants ne bougent pas : la maquette les cite (QE-18 au Sommaire, sur « Mot de passe oublié » ; QE-19 sur « Données à compléter »).

**Valeurs à fixer par Alexis** (aucune n'est proposée ; la maquette montre un exemple souligné) :
- le nombre de lignes affichées dans « Priorités opérationnelles » (IN-49) ;
- l'horizon « à venir » unique pour la VGP et le seuil « garanties qui finissent » : déjà posées par l'audit (TP-VGP, TP-PARC) ;
- la validité d'un lien d'accès (aujourd'hui une heure, `amorcage.ts:349` ; la changer est une décision) ;
- un verrouillage sur le mot de passe (aucun aujourd'hui ; celui du second facteur existe : D62, D64) ;
- la durée des notifications qui n'offrent pas « Annuler » (celle qui l'offre : 10 s, PG-B5) ;
- la liste close des gestes qui offrent « Annuler » (PU-6) ;
- le format de l'étiquette QR imprimée (PV-23).

---

## 8. Glossaire d'affichage proposé

Un mot par notion, partout : menus, titres, boutons, messages, courriels, bon. L'adopter, puis étendre le gardien du vocabulaire aux synonymes, est une question de l'audit (TP-NAV) ; changer un gardien est une décision.

| Notion | Mot affiché | Ne plus afficher | Remarque |
|---|---|---|---|
| Lieu d'une société d'où partent les techniciens | **Agence** | établissement, calendrier, horaires d'ouverture (comme nom) | D5 ; « horaires » reste un bloc de la fiche agence |
| Lieu chez le client | **Site** | lieu d'intervention, établissement | « Client — Site » quand il faut les deux |
| Objet suivi au parc | **Machine** | équipement, matériel (sauf « Référentiel matériel ») | « Parc machines » |
| Indisponibilité d'un technicien | **Absence** | blocage d'agenda ; toute nature ou tout motif | QG-8, PG-G15 ; R3-14 |
| Travail à faire chez un client | **Intervention** | dossier, job | |
| Signalement à qualifier | **Demande** | | |
| Travail signalé par le technicien | **Suite à donner** | préconisation (à l'écran) | le mot du rapport de terrain |
| Remarque d'un organisme VGP | **Réserve** | observation (à l'écran) | « observation » reste le mot de l'import |
| Contrôle réglementaire reçu | **Vérification** | contrôle (sauf nature « Contrôle réglementaire ») | titre « Vérifications périodiques (VGP) » |
| Temps mesuré sur place | **Compteur** | chrono | |
| Arrêter le compteur, l'intervention restant « En cours » | **Mettre en pause**, puis **Reprendre le compteur** | | le mot du produit (`terrain.compteur.pause`) ; « Suspendre » change le statut |
| Envoyer au téléphone du technicien | **Transmettre** | envoyer, affecter (comme verbe) | statut « Affectée » inchangé (D8) |
| Mettre un autre technicien sur une intervention | **Changer de technicien** | réaffecter | |
| Changer la date, l'heure ou le technicien d'une intervention déjà datée, en retard comprise | **Déplacer…** | replanifier | ouvre la fenêtre de pose ; « Poser » pour une à planifier ou une suspendue |
| Rendre une intervention à la file « À planifier » | **Remettre dans la file** | remettre à planifier | planning (PG-C5) et fiche |
| Fin du travail sur place | **Terminer** | | technicien |
| Fin administrative | **Clôturer** | | bureau, et le technicien sur sa propre intervention (D131) |
| Retirer un lot d'import | **Abandonner** (avant application), **Défaire** (après) | annuler | « Annuler » ferme sans rien faire, ou annule une intervention |
| Contact qui reçoit les courriels | **Donneur d'ordre** | | |
| Code du client dans le logiciel de facturation | **Code externe** | nom du logiciel écrit en dur | TR-53 |
| Réglages de la société | **Paramètres** | Sociétés & tarifs | QT-21 |
| Droit d'entrer | **Accès**, **lien d'accès** | invitation, amorçage (à l'écran) | |

---

## 9. Lots TP-UX et ordre

Détail, gabarit et bloc commun de chaque ticket : `lots-ux.md` (même dossier).

**Règles communes aux lots**
- Chaque ticket photographie les écrans touchés AVANT et APRÈS, à 1 280 et 375 px (plus 1 024 px pour la coque), dans `docs/propositions/<ticket>/captures/`, avec un README : commit photographié et date. Scène de démonstration uniquement, jamais une donnée de production (I9).
- Chaque ticket fait passer le script de mesure : textes, cibles, débordements (§10).
- **Aucun lot ne modifie une règle de gestion.** Un lot qui en rencontre une s'arrête et le dit.

| Lot | Contenu | Attend | Place dans la file (l'ordre de QT-26 a ne change pas) |
|---|---|---|---|
| **TP-UX0** | Déposer cette spécification, la maquette, les lots, les captures (documents seuls, un commit) | — | à la suite de la file, APRÈS 9BK-TP-0-DOCS (il ajoute une ligne à `docs/audit-ergonomie-2026-09-28.md`, que 9BK crée) |
| **TP-UX1** | Fondations : échelle typographique, rien sous 12 px, focus, icônes, composants de base (bouton, pastille, puce de priorité, tuile cliquable, bande de décomptes, message, état vide, onglets à compteur), script de mesure ; 3 tickets | QE-1, QE-2, QE-13b | après TP-I9 et avant DEPLANIFIEE-1 : cela retarde le circuit de trois tickets (le dire à Alexis avant de déposer). Aucun autre TP-UX de code avant lui (TP-UX0 est un lot de documents) |
| **TP-UX2** | Cadre commun : bandeau (recherche globale, Créer, aide ; retour selon la décision de l'audit), menu (rail, décomptes), téléphone (barre basse, bouton + sur les pages sans bouton de création, actions collées, feuilles basses, retour « ‹ Parent »), glossaire à l'écran | QE-3 à QE-6 ; décisions de l'audit pour TP-NAV (retour, glossaire, hub) | avec TP-NAV, à sa place en fin de file. L'avancer serait une autre réponse à QT-26 : poser la question |
| **TP-UX3** | Gabarit de liste : filtres (listes déroulantes de D122 ; puces selon QE-10 dans les listes clients, sites, parc, VGP, imports), résumé et tri écrits, densité « Confort · Compact », sélection multiple et actions selon l'onglet, export, cartes au téléphone, pagination, filtres dans l'adresse ; appliqué au registre, aux demandes, absences, clients, sites, parc, VGP, imports | QE-8, QE-10, QE-13c, QE-13d, QE-13e ; QE-13a (demandes, À facturer, réserves VGP) | listes après TP-UX1 ; registre VGP avec TP-VGP (TP-A2 est déjà passé) ; « À contrôler » après TP-CY ; « À facturer » avec TP-MOD ; absences avec TP-ABS ; demandes avec TP-DEM |
| **TP-UX4** | Gabarit de fiche : en-tête (titre = objet, faits, actions), bandeau d'état, onglets, colonne de contexte, « À traiter », historique à ordre unique, chronologie ; appliqué aux fiches intervention, client, site, machine | QE-9 ; QE-13a | fiches client, site et machine après TP-UX3 ; fiche intervention après TP-CY ; son onglet Valorisation après TP-ARG (d'ici là, la forme seule) |
| **TP-UX5** | Gabarit de formulaire et volets : sections numérotées, « (obligatoire) », aide, choix sans valeur imposée, saisie gardée, double envoi bloqué, pré-remplissage, retour d'origine ; appliqué aux créations (intervention, client, site, machine, absence, vérification, agence) | QE-13a | création d'intervention après TP-UX1, en gardant ce que PG-G7 a livré ; client et site avec TP-CLI ; absence avec PG-G15 et TP-ABS |
| **TP-UX6** | Tableau de bord selon le rôle, « Mise en route » (PU-1), Indicateurs du mois | QE-7 ; QE-13a et QT-20 pour les indicateurs | tableau de bord après TP-UX3 ; Indicateurs du mois avec le reste de TP-MOD, après QT-20 |
| **TP-UX7** | Terrain : navigation, journée, intervention (« Mettre en pause » du produit gardé), rapport, signature, scan, fiche machine, profil | QE-11, QE-13a ; QT-2, QT-4, QT-5 | avec TP-TER (le lot terrain), après TP-CY et avant TP-ACC ; le scan et « Mes machines » (UX7-d) avec TP-PARC |
| **TP-UX8** | Accès : connexion, code (et code de secours), mot de passe oublié, second facteur, premier accès, choix de la société | QE-13a, QE-17, QE-18 ; QT-1 | UX8-a avec TP-S ; UX8-b avec TP-ACC |
| **TP-UX9** | Impression, en trois parties : bon hors coque en deux versions, étiquette seule, registre VGP par client | QE-13a (bon, registre imprimable), QE-15 ; QT-8, QT-10, QT-11 | bon avec TP-ARG ; étiquette avec TP-PARC ; registre imprimable avec TP-VGP |

QE-13a, posée la première, vaut pour tout écran que la maquette complète ne dessine pas : chaque lot de TP-UX3 à TP-UX9 en reconstruit au moins un, et la cite (ici et dans `lots-ux.md`).

**Les règles de l'audit tiennent** : TP-S avant tout compte technicien ; « Terminer » avant la matrice D8 ; « À facturer » après TP-ACC et TP-CY.

**Coordination**
- Tout lot fonctionnel (TP-x, PG-x) qui touche un écran **après TP-UX1** utilise les nouveaux composants, dans son territoire seulement ; il ne refait pas un écran qu'il ne touche pas.
- Rien en parallèle de la file : une seule session Claude Code.

---

## 10. Comment vérifier : critères mesurables

À mesurer par un script, avant et après chaque ticket, sur les pages de la scène.

La maquette du 28/09 est contrôlée de la même façon par `qa.py`, à 390, 1 024, 1 280 et 1 440 px : aucune erreur, aucun débordement, aucun texte sous 12 px, aucun HTML échappé, aucune référence de spécification visible, cibles d'au moins 44 px au terrain, et chaque tuile vérifiée contre sa liste.

| Critère | Seuil | Source du seuil |
|---|---|---|
| Texte le plus petit | 12 px | valeur proposée par QE-1 (aucune norme ; D124 met 11 px) |
| Cibles au téléphone (bureau) | 32 × 32 px, hors liens dans le texte | seuil de travail de l'audit du 28/09 ; WCAG 2.5.8 (AA) exige 24 px ; le bouton de menu vise 44 px (TR-47) |
| Cibles au terrain | 44 px | CDC §13.4 |
| Défilement horizontal de la page | aucun, à 375, 1 024, 1 280, 1 440 px | PR-10 |
| Erreurs de la console | aucune | |
| Tuile = liste | égalité du chiffre et du nombre de lignes, par test | PR-2 |
| Pages très longues (registre, VGP, référentiel matériel, rapport d'import) | hauteur mesurée avant et après ; elle doit baisser, par pagination ou regroupement | GR18, PV-30, PA-43, PA-55 |
| États livrés | vide et erreur photographiés pour chaque page touchée | PR-12 |

---

## 11. Ce que la maquette ne dit pas

**Limites**
- **Aucune écriture** : les gestes montrent ce qui se passerait ; rien n'est enregistré, rien n'est calculé côté serveur.
- **Données fictives** : les montants, durées, trajets, taux et seuils affichés sont des exemples ; les vrais se saisissent dans Paramètres ou sont « à fixer ».
- **Le QR dessiné ne se lit pas** : c'est un motif, sans adresse encodée.
- **Pas de test avec des utilisateurs.** Proposé : une courte séance avec l'ADV sur U1 et U4, et avec un technicien sur U3, dès que TP-UX2 et TP-UX7 existent en préproduction.
- Performances non mesurées ; le chargement est décrit (§3.6), pas dessiné.
- **Planning** : la spécification et la maquette du 27/09 restent la référence détaillée.
- **Hors champ** : contrats (lot 4), console de l'éditeur (lot 7), portail (dessiné en aperçu seulement).

**Hygiène des maquettes du dépôt, à traiter avec TP-I9**
- Des noms de personnes et de lieux réels de la maquette complète et de la maquette du planning, listés dans le prompt (`docs/maquette/codiplan-maquette-complete.html` ; maquette du planning du 27/09) : à remplacer avant de les montrer à un acheteur, sur confirmation d'Alexis. L'un d'eux se retrouve aussi dans `prisma/seed-data.ts`, dans des tests et des commentaires : même règle. Ce document entre dans le dépôt avant TP-I9 ; le prompt du pilote, non : la liste nominative reste dans le prompt.
