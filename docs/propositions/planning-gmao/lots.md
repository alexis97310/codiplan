# Planning GMAO — découpage en tickets

*27/09/2026. Accompagne `docs/audit-ergonomie-2026-09-27.md` et `specification.md`. Destiné au **pilote** (la conversation Cowork qui écrit les tickets de la file) : chaque ligne devient un ticket au gabarit habituel (`<!-- limite 150m -->`, « OBLIGATOIRE : TU COMMITES » en tête, LE CONSTAT mesuré, CE QUE TU FAIS, Territoire, bloc commun « INTERDITS » → « POUR FINIR », captures AVANT/APRÈS, passation).*

*Noms : les lots s'appellent PG-0 et PG-A à PG-E, les questions QG-1 à QG-12 — pour ne se confondre ni avec les décisions (`D8`…), ni avec les priorités (`P1`…), ni avec les lots du backlog (`L3`…).*

**Trois règles avant d'écrire un ticket :**
1. **Remesurer sur `main`** (clone cloud, `git pull`) chaque fait cité : les `fichier:ligne` datent de `e2b8421`. *Un rapport lu n'est pas une mesure.*
2. **Un ticket = un écran ou une route, une preuve.** Aucun test n'écrit dans une fixture `SCENE.*` partagée.
3. **Un ticket marqué ⚠ QG-x n'est écrit qu'après la réponse d'Alexis.**

**Bugs « déduits du code » (1, 2, 3, 4, 9, I-17)** : le ticket COMMENCE par un test qui reproduit le défaut ; s'il ne rougit pas, le ticket s'arrête et le dit. *Exception, bug 4 :* une ligne « planifiée sans durée » ne peut pas être insérée (la contrainte s'applique aussi à l'insertion) — la reproduction se fait par une fonction pure (le verdict qui manque) et par un compte en lecture seule sur la base.

**Captures, toujours :** chaque ticket qui touche un écran dépose `docs/propositions/<ticket>/captures/` — AVANT et APRÈS, à 1280 et 375 px, avec l'empreinte du commit photographié et la date dans un `README.md` du dossier. Scène de démonstration uniquement (I9).

**Ordre global proposé** (à confirmer par Alexis) : fin du lot ERGO → AGENCE-ACTIVE → **PG-0** → **PG-A** → **PG-B** → **PG-C** → DEPLANIFIEE-1 → **PG-D** (PG-D4 remplace C-B1) → **PG-E** (après décisions).

---

## PG-0 — Les documents dans le dépôt (1 ticket, sans code)

| Ticket | Contenu | Preuve |
|---|---|---|
| **PG-0-DOCS** | Copier depuis le dossier `audit-ergonomie-27-09/` du PC : `audit-ergonomie-2026-09-27.md` → `docs/` ; `specification.md`, `lots.md`, `maquette-planning-gmao.html` → `docs/propositions/planning-gmao/`. Commit seul. | `git show --stat` : 4 fichiers, aucun fichier de code. |

## PG-A — Ce qui trompe (9 tickets, aucune migration)

| Ticket | Constat (audit) | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|---|
| **PG-A1-FERIES-GRILLE** | Bug 5 : un férié s'affiche ouvert (« 60 créneaux libres » le 24/09), la pose le refuse, la charge le retire. La page ne charge que le paramétrage hebdomadaire ; `grille.ts:259-267` et `journee.ts:390-392` ne lisent que le jour de semaine. | Pour chaque agence, la grille Semaine et la vue Jour montrent un jour ouvert **si et seulement si** `estJourOuvre(calendrier de l'agence, jour)` le rend (`lib/calendar/ouverture.ts`) — le critère de la pose (`pose.ts:133`). En-tête « férié » + libellé ; un férié **travaillé** par l'agence reste ouvert (RG-PLA-02). L'union par personne reste un repère (RG-PLA-07). | `app/(back-office)/planning/page.tsx`, `lib/interventions/grille.ts`, `lib/interventions/journee.ts`, `lib/i18n/fr.ts` | Test unitaire neuf : sur 365 jours d'un calendrier de test (férié chômé, férié travaillé, pont, exception), « ouvert » à la grille ⇔ `estJourOuvre`. Captures d'un férié de la scène. |
| **PG-A2-ORDRE-TECHNICIENS** | Bug 6 : Semaine trie par nom (`grille.ts:282-293`), Jour par UUID (`journee.ts:499-506`). | Un comparateur unique (par libellé, « Non affectées » en tête), exporté, utilisé par les deux vues. | `lib/interventions/grille.ts`, `lib/interventions/journee.ts` | Test : trois techniciens dont les UUID sont dans l'ordre inverse des noms → même ordre dans les deux vues. |
| **PG-A3a-MESSAGES-POSE** | Bugs 2 et 3 : « Tirez la poignée… » affiché pour un dépôt sans durée, pour une heure vidée, pour une durée 0 saisie. | (1) `pose.tsx` n'envoie jamais `duree_min=0` : une carte sans durée part sans durée ; (2) la route nomme ce qui manque (clés `fr.ts` : « Cette intervention n'a pas de durée prévue : indiquez-la pour la poser. », « L'heure de début est obligatoire. », « La durée doit être d'au moins un créneau. ») ; `duree_invalide` ne sert plus qu'au redimensionnement ; le champ durée porte un minimum. | `components/planning/pose.tsx`, `app/api/interventions/[id]/deplacer/route.ts`, `lib/i18n/fr.ts` | Les quatre chemins (dépôt sans durée, heure vidée avec durée remplie, durée 0 saisie, poignée remontée) : **seul le dernier** affiche « Tirez la poignée ». |
| **PG-A3b-LIBELLE-HEURE** ⚠ QG-4 | Bug 3 : « (laisser vide pour une journée sans heure) » est posé sous « Les quatre valeurs se donnent ensemble » dans « Planifier ». | Retirer la parenthèse du bloc « Planifier » ; dans « Déplacer », selon QG-4 : (a) heure obligatoire ; (b) texte exact « Heure et durée vidées ensemble : journée sans heure ». | `lib/i18n/fr.ts`, `app/(back-office)/interventions/[id]/page.tsx` | Test de rendu des libellés ; e2e « Déplacer » sans heure → refus nommé (a) ou journée sans heure (b). |
| **PG-A4-SANS-DUREE-AVANT-ECRITURE** | Bug 4 : sur une « Planifiée » héritée sans durée, toute écriture finit en exception 23514 → « réessayez » : déplacer, affecter, note interne ; et `/terrain/[id]` réécrit la ligne pour marquer « vu ». | Refus nommé **avant l'écriture** dans les dépôts concernés (« Cette intervention planifiée n'a pas de durée prévue : complétez-la — Déplacer, avec heure et durée ») ; l'ouverture de `/terrain/[id]` ne dépend pas de l'écriture du « vu » (elle ne doit jamais échouer pour lui). **Ne pas toucher** à la contrainte `intervention_planifiee_a_sa_duree` (D104, §8). | `lib/interventions/depot.ts`, `lib/interventions/cycle-de-vie.ts`, `app/(mobile)/terrain/[id]/page.tsx`, `lib/i18n/fr.ts` | Test pur du verdict (ligne planifiée sans durée → refus nommé) ; compte en lecture seule des lignes concernées en passation. |
| **PG-A5-FICHE-CRENEAU** | La durée prévue n'apparaît pas dans le résumé de la fiche (« 25/09/2026 08:00 »). | Résumé : « jeu. 25/09 · 08:00–10:00 (2 h) » ; « durée non renseignée » si absente. **Après GR14** (9AE→9AI, format des durées). | `app/(back-office)/interventions/[id]/page.tsx`, `lib/i18n/fr.ts` | Test de rendu (avec et sans durée). Captures. |
| **PG-A6-LIBELLE-SANS-DUREE** | I-5 : la tuile « Planifiées sans durée prévue : 3 » compte les 3 **À planifier** ; le lien du panneau de charge mène à une autre population que son chiffre. | Libellés exacts des populations actuelles ; aucun calcul changé (l'onglet « Sans durée » de PG-C2 unifiera). | `lib/i18n/fr.ts`, `app/(back-office)/planning/statistiques.tsx` | Test de rendu des libellés. |
| **PG-A7-SEMAINE-GARDE-HEURE** | Bug 9 : en vue Semaine, déplacer une carte planifiée à 08:00 efface son heure (`pose.tsx:249` → `depot.ts:717-735`, `:1015-1016`) ; le seul scénario e2e part d'une carte sans heure. | En vue Semaine, le dépôt d'une carte qui a une heure et une durée les renvoie telles quelles ; la route les re-contrôle (chevauchement, ouverture) et nomme le refus si l'heure ne tient pas à l'arrivée. | `components/planning/pose.tsx` | e2e : carte à 08:00 déplacée au lendemain → toujours 08:00, même durée. |
| **PG-A8-ANNULEES-MASQUEES** | I-17 : les annulées restent dans la file (barrées) et sur la grille ; l'annexe D les veut « masquées par défaut ». | `listerPlanning` (ou la lecture de la page) écarte les annulées par défaut ; filtre « Afficher les annulées ». Commencer par reproduire. | `lib/interventions/depot.ts` ou `lib/interventions/affichage.ts`, `app/(back-office)/planning/page.tsx` | Test d'isolation : une annulée sans date et une annulée datée n'apparaissent ni dans la file ni sur la grille. |

## PG-B — Poser sans échec (6 tickets, aucune migration)

| Ticket | Ce que tu fais | Territoire | Preuve | Dépend de |
|---|---|---|---|---|
| **PG-B1-VERDICT-LECTURE** | Route **en lecture seule** `GET /api/interventions/[id]/verdict-pose?technicien&date&heure&duree` : rend les verdicts que rendrait `deplacerIntervention` (`peutPlanifier`, `verdictALaPose`, habilitations, absences, chevauchement) **sans rien écrire**, et les créneaux libres d'un technicien pour une date et une durée (hors créneaux passés). Les fonctions de jugement sont **les mêmes** que celles du dépôt (extraites si besoin, jamais recopiées). | nouvelle route, `lib/interventions/pose.ts`, `lib/interventions/creneaux.ts` (neuf) | Test d'isolation : sur un jeu de cas (férié, absence, chevauchement, habilitation bloquante, hors heures, sans durée, accepté), verdict de lecture ⇔ issue de l'écriture réelle (transaction annulée). | PG-A1, PG-A4 |
| **PG-B2-FENETRE-POSE** | Fenêtre de pose (spécification §3.10) : au dépôt d'une carte de la file (Semaine et Jour) et au bouton « Poser » des cartes de la file. Technicien avec son état, date, **durée puis heure** (créneaux libres pour cette durée), contrôles de PG-B1 ; « Planifier » inactif tant qu'un contrôle bloque ; écrit par la route `/deplacer` existante. | `components/planning/fenetre-pose.tsx` (neuf), `components/planning/pose.tsx`, `app/(back-office)/planning/page.tsx`, `lib/i18n/fr.ts` | e2e : glisser une carte « À planifier » sur une case Semaine → la fenêtre s'ouvre pré-remplie, **aucun POST avant « Planifier »** ; choisir → planifiée. Captures. | PG-B1 |
| **PG-B3-TROUVER-CRENEAU-FICHE** | Bloc « Planifier » de la fiche : bouton « Trouver un créneau » qui ouvre la même fenêtre ; le formulaire reste en repli. | `app/(back-office)/interventions/[id]/page.tsx` | e2e sur la fiche. | PG-B2 |
| **PG-B4-SURVOL-CASES** | Pendant le glissé : case verte ou rouge + motif (absent, férié, agence fermée, habilitation manquante) — calculé à partir des données déjà chargées par la page ; le serveur reste juge. | `components/planning/pose.tsx`, fonction pure testable | Test unitaire de la fonction pure ; e2e : survol d'une case d'absence → état « refus » + motif. | PG-A1 |
| **PG-B5-ANNULER-DEPLACEMENT** ⚠ QG-6 | Après un déplacement réussi : « Déplacée — … · Annuler » (10 s), qui rejoue `/deplacer` avec l'état d'avant **que la page connaît avant le dépôt** (date, heure, durée, technicien) — la route ne le renvoie pas, et son `etatAvant` ne porte pas la durée. Traitement des courriels selon QG-6. | `components/planning/pose.tsx`, `lib/i18n/fr.ts` (+ avertissements selon QG-6) | e2e : déplacer puis « Annuler » → état initial ; courriels conformes à QG-6. | QG-6 |
| **PG-B6-DUREE-A-LA-CREATION** | « Créer une intervention » : champ « Durée prévue » **facultatif** (choix rapides, aucune valeur par défaut) — la création reste sans date, heure ni technicien (PARCOURS-1) ; après « Créer » : « Planifier maintenant » (fenêtre de pose) ou « Laisser dans la file ». | `app/(back-office)/interventions/nouvelle/`, route de création, `lib/interventions/saisie.ts`, `lib/i18n/fr.ts` | e2e : créer avec 2 h → la carte de la file porte « 2 h » et se pose en vue Jour. | PG-B2 |

## PG-C — Voir ce qui compte (8 tickets, aucune migration)

| Ticket | Ce que tu fais | Territoire | Preuve | Dépend de |
|---|---|---|---|---|
| **PG-C1a-EN-RETARD-PLANNING** | `lib/interventions/retard.ts` (neuf, pur) : `enRetard(ligne, aujourdhui)` = planifiée ou affectée, date < aujourd'hui dans le fuseau de l'agence, **aucun segment de travail**. Carte : contour pointillé rouge + « En retard ». | `lib/interventions/retard.ts`, `app/(back-office)/planning/page.tsx` | Tests unitaires (veille, aujourd'hui, démarrée, reprise après un segment, annulée, fuseau UTC+11 entre 0 h et 11 h — la leçon `CURRENT_DATE`). | — |
| **PG-C1b-EN-RETARD-TABLEAU** | Tuile « En retard » au tableau de bord → planning, onglet « En retard ». | `app/(back-office)/tableau-de-bord/` | Test de rendu + e2e du lien. | PG-C1a |
| **PG-C1c-EN-RETARD-REGISTRE** | Onglets « À venir » et « En retard » au registre (`VUES_REGISTRE`, `lib/interventions/saisie.ts:101`) ; la tuile « Planifiées cette semaine » ouvre « À venir ». | `lib/interventions/saisie.ts`, `lib/interventions/depot.ts`, `app/(back-office)/interventions/page.tsx` | Test d'isolation des deux populations. | PG-C1a |
| **PG-C2-FILE-ONGLETS** | Colonne « À traiter » à onglets et compteurs : À planifier · En retard · Sans durée · Suspendues (Déplanifiées après DEPLANIFIEE-1) ; ancienneté sur chaque carte ; recherche. Les populations hors fenêtre (retard, sans durée, suspendues) sont lues à part, jamais en élargissant `listerPlanning`. | `app/(back-office)/planning/page.tsx`, `lib/interventions/affichage.ts`, `lib/interventions/depot.ts` | Test des populations (la partition « À planifier » / grille reste vraie) ; e2e des onglets. Captures. | PG-C1a, PG-A8 |
| **PG-C3-CARTES-COLONNES** ⚠ QG-1, QG-2 | Colonnes de jour ≥ 150 px avec défilement horizontal **et indice visible** (retour sur 82-PLANNING-6, à nommer), jours fermés et fériés à 36 px ; carte normalisée (heure–fin, client sur 2 lignes, nature · machine, commune) ; statut = liseré + fond (jetons existants), priorité = puce P1/P2 ; légende unifiée. Coordonner avec 99Y (publié) et 99UA-GR5 (en file). | `app/(back-office)/planning/page.tsx`, `lib/theme/statuts.ts` | Mesure e2e à 1280 px : chaque colonne ouverte ≥ 150 px, indice de défilement présent. Captures. | QG-1, QG-2, PG-A1 |
| **PG-C4-CHARGE** | Chaque technicien actif a **son pourcentage** sous son nom, 0 % compris (D111 : le taux seul) ; « ≥ » quand des durées manquent ; barre par jour dans les cases (termes en infobulle). **Le panneau de charge reste**, repliable, avec les deux termes et la formule de D111 et la phrase de D107. Formules inchangées. **Après GR14.** | `app/(back-office)/planning/page.tsx`, `statistiques.tsx` | Test : technicien sans intervention → « 0 % ». | — |
| **PG-C5-TIROIR** | Clic sur une carte : tiroir latéral (maquette complète `openDrawer`), `?intervention=<id>` dans l'URL, Échap ferme ; actions : ouvrir la fiche, déplacer (fenêtre de pose), remettre dans la file, annuler (motif). | `components/planning/tiroir.tsx` (neuf), `app/(back-office)/planning/page.tsx` | e2e : clic → tiroir, URL, Échap. Captures. | PG-B2 |
| **PG-C6-FILTRES-AUJOURDHUI** | Filtres (technicien, nature, priorité, client, statut) dans l'URL ; « Aujourd'hui » **étendu** (le bouton existe en vue Semaine hors semaine courante — 82-PLANNING-6 — il devient permanent, dans toutes les vues ; retour à nommer) ; sélecteur de date ; un jour fermé ouvre sur le prochain jour ouvré ; « Plein écran » replie la barre. | `app/(back-office)/planning/page.tsx` | Test des paramètres d'URL ; e2e « Aujourd'hui » un dimanche. | — |

## PG-D — Vues GMAO (5 tickets, aucune migration)

| Ticket | Ce que tu fais | Dépend de |
|---|---|---|
| **PG-D1-JOUR-FRISE** ⚠ QG-3 | Vue Jour en frise horizontale : techniciens en lignes, heures en colonnes à l'échelle de la largeur, glisser horizontal = heure, vertical = technicien, poignée = durée ; trajet aller/retour (D107) ; ligne « Heure à fixer » pour l'héritage. | QG-3, PG-C3 |
| **PG-D2-DEUX-SEMAINES** | Vue 2 semaines (cahier M4), cartes compactes (heure de début + client). | PG-C3 |
| **PG-D3-MOIS-CHARGE** | Vue Mois : taux de charge par technicien et par jour en teinte **proportionnelle**, rouge au-delà de 100 % (`TAUX_PLEIN`, seul seuil existant — aucun palier inventé) ; fériés et fermés tramés, absences ; clic → Jour. | PG-C4 |
| **PG-D4-TELEPHONE-ONGLETS** | < 900 px : onglets Aujourd'hui · À traiter · Semaine ; « Poser » au lieu du glisser ; la P1 visible sans défiler. **Remplace C-B1.** | PG-B2, PG-C2 |
| **PG-D5-CREER-ICI** | Clic sur une case vide → « Créer ici » → formulaire de création **inchangé** (PARCOURS-1) → la fenêtre de pose s'ouvre pré-remplie avec la date, l'heure et le technicien de la case. | PG-B6 |

## PG-E — Après décisions (rien avant la réponse d'Alexis)

| Ticket | Question | Migration |
|---|---|---|
| **PG-E1-TRANSMETTRE** | QG-5 : Planifiée → Affectée (D8 §3.6) ; « Transmettre au technicien » (action principale d'une Planifiée, remplace « Affecter un technicien ») ; « Transmettre demain (n) » ; ce que voit le terrain avant transmission ; moment du courriel (AVERTISSEMENTS-1). | non (le statut existe) — changement côté terrain et courriels |
| **PG-E2-STATUT-RESSOURCE** | QG-9 : salarié / patenté, champ de la fiche technicien, badge et filtre. | oui |
| **PG-E3-ABSENCE-HEURES** | QG-8 : un mot (« Absence »), et absence à la demi-journée ou à la plage. | oui |
| **PG-E4-MACHINE-A-L-ARRET** | QG-10 : case à la création → propose P1, machine « En panne » jusqu'à la clôture. | selon conception |
| **PG-E5-DELAIS-CIBLES** | QG-11 : délais par priorité saisis par Alexis → « échéance » et « risque de dépassement » (nouvelle règle au chapitre 10 ; sinon attendre les contrats, L3-03a). | oui (paramètre) |
| **PG-E6-DUREES-TYPES** | QG-12 : durées types par nature → pré-remplissage de la fenêtre de pose. | oui (paramètre) |

---

## Ce qui NE doit PAS arriver

- Une session Claude Code lancée **à côté** de la file : un seul dépôt, un seul jeu de ports de test, la file est séquentielle.
- Un ticket qui « améliore aussi » un écran hors de son territoire.
- Une valeur inventée (durée par défaut, délai, taux, seuil) : §8 du dépôt.
- La contrainte `intervention_planifiee_a_sa_duree` assouplie ou un test modifié pour faire passer un ticket (D104, §5, §8).
- Une donnée de production dans une capture, un test ou un document (I9) : captures sur la scène de démonstration uniquement.
