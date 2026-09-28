# Planning GMAO de CODIPLAN — spécification cible

*Proposition du 27/09/2026, à valider par Alexis. Rien ici n'est normatif avant ses réponses aux questions QG-1 à QG-12 de l'audit du 27/09 (`docs/audit-ergonomie-2026-09-27.md`, §6). Ce document dit ce qu'on construit **si** elles sont tranchées comme recommandé, et ce qui peut se construire **sans** elles : les lots PG-A à PG-D, sauf PG-A3b (QG-4), PG-C3 (QG-1, QG-2) et PG-D1 (QG-3).*

*Maquette cliquable, données fictives : `maquette-planning-gmao.html` (même dossier). Tickets : `lots.md`.*

**Ce document s'appuie sur :** le cahier des charges (M4 « Planning et dispatch », RG-PLA-01 à 08, annexe D, parcours P1 et P3) ; la maquette complète — D124 pour les jetons, D125 pour la disposition, dont **les ajouts proposés ici sont des écarts nommés** (QG-2) ; D8 (§3.6), D88, D106, D107, D111, R2-15, PARCOURS-1, I7 et le vocabulaire imposé (agence / site). **Il n'invente aucune valeur** (durée, délai, taux, seuil) : ce qui en demanderait une est renvoyé à une question.

---

## 0. En une phrase

**L'ADV voit sur un seul écran ce qui est à faire, qui est libre, et pose un rendez-vous en un geste et une confirmation — sans jamais recevoir un refus après coup.**

## 1. Sept principes

1. **Tout ce qui est à faire remonte à un seul endroit** — la colonne « À traiter ». Rien ne sort de l'écran sans avoir été traité : une intervention en retard ou déplanifiée y revient d'elle-même.
2. **Ce que l'écran montre ouvert, la pose l'accepte.** Pour chaque agence, un jour est montré ouvert si et seulement si `estJourOuvre(calendrier de l'agence, jour)` le rend — le critère même de la pose (`lib/interventions/pose.ts:133`) — et les absences et habilitations bloquantes sont lues par les mêmes fonctions que le dépôt. L'union des calendriers par personne reste un repère, jamais un droit de poser (RG-PLA-07). (§9 du 01/09 : deux lectures d'un même critère divergent en silence.)
3. **Poser = un geste + une confirmation.** Le dépôt ouvre une fenêtre de pose pré-remplie ; les contrôles s'y lisent *avant* l'écriture ; les quatre valeurs de PARCOURS-1 partent ensemble. Le serveur reste juge (R2-19) : l'écran annonce, le serveur tranche.
4. **Techniciens en lignes, temps en colonnes, dans toutes les vues** (cahier M4, maquette complète `weekPlan()` et `dayPlan()`).
5. **La charge se lit là où l'on pose** : le pourcentage sous chaque technicien (D111), 0 % compris, et une barre par jour.
6. **Un clic ne fait pas quitter le planning** : tiroir latéral (maquette complète, `openDrawer`) ; la fiche s'ouvre depuis le tiroir.
7. **Le téléphone a sa propre mise en page** (onglets), pas une réduction du bureau.

---

## 2. Anatomie de l'écran (bureau, ≥ 1280 px)

```
┌─ En-tête (maquette complète) ──────────────────────────────────────────────────┐
│ EXPLOITATION                                                                   │
│ Planning des techniciens                          [Transmettre demain (QG-5)]  │
│ Semaine 39 — du 21 au 26/09/2026 · 4 techniciens · 1 absent   [+ Intervention] │
├─ Barre d'outils ───────────────────────────────────────────────────────────────┤
│ [Jour|Semaine|2 sem.|Mois]  [‹] [Aujourd'hui] [›] [📅]      Légende · Plein écran │
│ FILTRES  Technicien▾ Priorité▾ Nature▾ Client▾ Statut▾ · 2 filtres · Réinitialiser │
├─ Encadré (maquette) + repères cliquables ──────────────────────────────────────┤
│ ⓘ Calendriers d'agence respectés — Ducos : lun.–ven. 07:00–17:00               │
│   [Férié jeu. 24] [2 en retard] [1 absent sur la période] [3 sans durée]        │
├──────────────────┬─────────────────────────────────────────────────────────────┤
│ À TRAITER        │ TECHNICIEN        LUN 21   MAR 22   MER 23  24  VEN 25  26    │
│ [À planifier 4]  │ Non affectées     … (seulement s'il y en a)                   │
│ [En retard 2]    │ Technicien 1      │ carte │ carte │       │▨│ carte  │▨│     │
│ [Sans durée 3]   │ Salarié · 34 % ▓▓░│ ▁▁▁▁  │ ▁▁▁   │       │▨│ ▁      │▨│     │
│ [Suspendues 1]   │ Technicien 2      │ Absent (aplat violet)   │▨│        │▨│     │
│ [Déplanifiées]   │ …                                                            │
│ cartes…          │ barre de charge du jour en pied de chaque case                │
└──────────────────┴─────────────────────────────────────────────────────────────┘
  Tiroir latéral (440 px) au clic sur une carte · Fenêtre de pose au dépôt
```

---

## 3. Les blocs, un par un

### 3.1 En-tête

- Sourcil « Exploitation », titre **« Planning des techniciens »** (maquette complète ; l'écran vivant dit « Planning des interventions » — un seul des deux, au choix d'Alexis).
- Sous-titre : période, puis ce qui compte : « 4 techniciens · 1 absent ».
- À droite : **« + Intervention »** (maquette : bouton principal en haut à droite), et, après QG-5, **« Transmettre demain (n) »**.

### 3.2 Barre d'outils

| Élément | Comportement |
|---|---|
| Vue | Jour · Semaine (défaut) · 2 semaines · Mois. |
| Navigation | ‹ précédent · **Aujourd'hui** · suivant › · sélecteur de date. « Aujourd'hui » est toujours présent, dans toutes les vues — *82-PLANNING-6 l'a caché sur la semaine courante et en vue Jour ; ce retour est à nommer dans le ticket.* Un jour fermé (dimanche, férié) ouvre sur le **prochain jour ouvré**. |
| Filtres | Technicien, Priorité, Nature, Client, Statut ; Agence quand plusieurs agences seront actives. Compteur « 2 filtres » + « Réinitialiser ». |
| URL | Vue, date et filtres vivent dans l'URL (l'écran le fait déjà pour `vue` et `jour`) : un lien se partage. |
| Plein écran | Replie la barre latérale (272 px) pendant la planification. |

### 3.3 Encadré et repères

L'encadré **« Calendriers d'agence respectés »** de la maquette reste (D125), réduit à une ligne, **agences actives seulement** (AGENCE-ACTIVE). Dessous, des **repères cliquables** qui n'apparaissent que s'ils sont vrais : « Férié jeu. 24 — Fête de la citoyenneté », « 2 en retard », « 1 absent sur la période », « 3 sans durée ». Chacun ouvre l'onglet ou la date concernés.

### 3.4 Colonne « À traiter » (255 px, repliable)

La maquette l'appelle « À affecter » et la dessine à 255 px avec des cartes à liseré (`.queue-card`). Elle devient une colonne **à onglets**, chacun avec son compteur :

| Onglet | Population (lecture, rien de stocké) | Tri |
|---|---|---|
| **À planifier** | statut `a_planifier` | priorité, puis ancienneté (L3-03, existant) |
| **En retard** | statut `planifiee` ou `affectee`, date planifiée < aujourd'hui (fuseau de l'agence), **aucun segment de travail** | la plus ancienne d'abord |
| **Sans durée** | statut ∉ {terminée, clôturée, annulée}, `duree_estimee_min` nulle — dates passées comprises | date, puis priorité |
| **Suspendues** | statut `suspendue` (annexe D : « hors planning actif » — elles n'ont pas d'autre place) | date de suspension |
| **Déplanifiées** | repassées en file par une absence — **n'existe qu'après DEPLANIFIEE-1** (cause et ancienne date conservées) | date perdue |

**Les annulées n'apparaissent dans aucun onglet** (annexe D : « masqué par défaut » ; audit I-17).

**Carte de la file :**

```
┃ P1 · Client A                         2 h ┃   ← liseré : couleur de la priorité
┃ Curatif · Pont 2 colonnes (Marque M)      ┃
┃ Site Magenta — Nouméa                     ┃
┃ créée il y a 5 j · Demande      [Poser ▸] ┃   ← ancienneté, origine, action
```

- Ligne 1 : priorité (puce P1 rouge, P2 orange ; P3 et P4 sans puce), client (gras, deux lignes au plus), durée prévue ou puce orange **« durée ? »**.
- Ligne 2 : nature · machine (famille, marque, modèle).
- Ligne 3 : site — commune.
- Ligne 4 : **ancienneté** (« créée il y a 5 j ») — le « risque de dépassement » du cahier M4 se lit d'abord ainsi ; l'**échéance** ne s'affichera que quand une règle la donnera (L3-03a : contrat et SLA ; QG-11) ; origine (« Demande », « Observation VGP » — D88 point 10) ; bouton **« Poser »** (ouvre la fenêtre de pose, sans glisser — c'est aussi le chemin du clavier et du téléphone).
- Recherche en tête de colonne (client, site, machine, numéro).

### 3.5 Grille Semaine (défaut)

- **Colonne technicien 170 px** (maquette) : nom, badge **Salarié / Patenté** (après QG-9), agence, et **le pourcentage seul** de la semaine avec sa barre (D111 : « le pourcentage, et rien d'autre ») — **0 % compris** ; « ≥ 34 % » avec l'icône « durées manquantes » quand des durées manquent (clic → onglet « Sans durée » filtré sur ce technicien). Les deux termes restent dans le panneau de charge (§3.14).
- **Colonnes de jour ≥ 150 px** (maquette : `minmax(150px,1fr)`), défilement horizontal au-delà **avec un indice de défilement visible** — *QG-1 : c'est revenir sur 82-PLANNING-6, qui a retiré ce minimum parce que vendredi et samedi disparaissaient sans indice.* « Plein écran » et le repli de la file donnent la place d'éviter le défilement. En-tête : « Lun. 21 » ; **aujourd'hui** surligné.
- **Jour fermé ou férié : colonne réduite à 36 px, tramée** (R2-15 : la trame dit « fermé » et rien d'autre), numéro du jour et « Férié » ou « Fermé » en vertical. Un férié travaillé par l'agence (RG-PLA-02) reste ouvert.
- **Ligne « Non affectées »** en tête, seulement si des interventions datées n'ont pas de technicien.
- **Case** : cartes triées par heure ; en pied, **barre de charge du jour** (les termes « 4 h / 10 h » en infobulle).
- **Absence** : aplat violet « Absent » sur la case (pas de trame — R2-15) ; après QG-8, sur la seule plage horaire.

**Carte de la grille :**

```
┃ 08:00–10:00                          P1 ┃   ← liseré + fond : statut (annexe D, jetons existants)
┃ Client A                                ┃
┃ Curatif · Pont 2 colonnes               ┃
┃ Magenta                     ✓ transmise ┃
```

- Statut = liseré gauche + fond (§5).
- **En retard** : contour pointillé rouge + mention « En retard ».
- **Sans durée** : puce orange « durée ? ».
- **Transmise** (après QG-5) : « ✓ transmise » ; **vue par le technicien** : « vu » (`vue_technicien_le`, existant).
- Clic : tiroir. Double-clic : fiche.

### 3.6 Grille Jour (frise horizontale — QG-3)

- **Techniciens en lignes** (hauteur 64 à 78 px), **heures en colonnes** : axe des heures d'ouverture de l'agence, au pas de l'agence (30 min aujourd'hui), à l'échelle de la largeur disponible (la journée tient sans défiler à 1440 px).
- Blocs **à l'échelle** (début → fin) : « 08:00 Client A — Curatif » ; P1 marquée ; texte complet en infobulle.
- **Hors ouverture** : aplat gris plein (pas de trame, R2-15). **Férié ou fermé** : frise tramée + libellé. **Absence** : aplat violet.
- **Trajet** (D107) : barre fine avant le premier rendez-vous (aller depuis l'agence) et après le dernier (retour) ; pointillés quand il est inconnu ; les minutes sous le nom du technicien ; **aucun trajet entre deux sites** — l'écran le dit, il ne l'approxime pas.
- Ligne « Heure à fixer » pour les interventions datées sans heure (héritage ; disparaît quand il n'y en a plus).
- Gestes : glisser horizontalement = changer l'heure ; verticalement = changer de technicien ; poignée de fin = durée (existant).

### 3.7 Vue 2 semaines

Comme la semaine, colonnes ≥ 118 px, cartes compactes (heure de début + client). Sert à préparer la semaine suivante.

### 3.8 Vue Mois — la charge

Technicien × jours (28 à 31 colonnes). Chaque case : le **taux de charge du jour** en teinte **proportionnelle** (plus c'est chargé, plus c'est foncé), **rouge au-delà de 100 %** — le seul seuil qui existe (`TAUX_PLEIN`) ; aucun palier inventé. Le chiffre de la case = nombre d'interventions ; fériés et fermés tramés ; absence en violet. Clic → vue Jour de ce jour.

### 3.9 Tiroir (440 px, maquette `.detail-drawer`)

- En-tête : statut, numéro, « En retard » si besoin.
- **Quoi** : nature, panne signalée, machine (famille, marque, modèle, n° de série), priorité.
- **Où** : client, site, commune, trajet, contact sur place (lien `tel:`).
- **Quand / qui** : créneau « mar. 22/09 · 08:00–10:00 (2 h) », technicien, suivi (préparée / transmise / vue / démarrée).
- **À savoir** : en retard, durée manquante, trajet inconnu, déplanifiée.
- **Actions** : Ouvrir la fiche · Déplacer… (fenêtre de pose) · Transmettre (après QG-5) · Remettre dans la file · Annuler l'intervention (motif obligatoire, existant).
- L'URL porte `?intervention=<id>` : le tiroir se partage ; Échap le ferme.

### 3.10 Fenêtre de pose

S'ouvre au **dépôt** (depuis la file ou une carte dont l'heure ne tient pas à l'arrivée), au bouton **« Poser »** d'une carte de la file, à **« Trouver un créneau »** de la fiche, et à **« Déplacer… »** du tiroir.

```
Poser — Client A · Curatif · P1
Technicien   Technicien 1 — libre · 7 h disponibles          (sélectionné)
             Technicien 2 — absent · Technicien 3 — habilitation manquante (bloquante)
Date         [mar. 22/09]
Durée        (30 min) (1 h) (1 h 30) (2 h) (3 h) (4 h) [autre]   ← la durée prévue si elle existe ; sinon rien de coché
Heure        (07:00) (11:00) (11:30) (12:00) …  [autre ▾]   ← créneaux libres de ce technicien ce jour-là, POUR CETTE DURÉE
Contrôles    ✓ Agence ouverte ce jour-là       ✓ Dans les heures d'ouverture
             ✓ Pas de chevauchement            ✓ Technicien disponible
             ✓ Habilitations bloquantes        ! Trajet inconnu pour ce site (non bloquant)
                                                   [Annuler]  [Planifier]
```

- **Pré-rempli** : ce que le geste a donné (date et technicien de la case ; heure de la ligne en vue Jour), la durée prévue si elle existe. **Aucune valeur inventée** : sans durée prévue, aucune puce n'est cochée (§8 du dépôt ; QG-12 pour des durées types).
- **La durée avant l'heure** : les créneaux proposés sont ceux où **cette durée** tient sans chevauchement ; aujourd'hui, les créneaux déjà passés ne sont pas proposés. Chaque technicien affiche son état pour la date choisie : « libre · 7 h disponibles », « aucun créneau de 2 h », « absent », « habilitation manquante (bloquante) ».
- **Ces créneaux ne sont pas une proposition au sens de D106** : la fenêtre ne choisit ni le technicien ni la date, elle montre les trous de celui que l'ADV a choisi ; le report groupé après une absence reste rendu à la file sans créneau, et l'onglet « Déplanifiées » ne propose rien en lot.
- **Contrôles en direct** : un point d'entrée **en lecture seule** rend le verdict en appelant **les mêmes fonctions que le dépôt** (`peutPlanifier`, `verdictALaPose`, habilitations, absences, chevauchement) — sans rien écrire. Bloquant = ✕ rouge et bouton inactif, motif en clair ; non bloquant = « ! ».
- **Planifier** écrit par la route existante (`/api/interventions/[id]/deplacer`), qui re-contrôle tout (R2-19). Ensuite : message « Planifiée — technicien 1, mar. 22/09 à 08:00 ». Le bouton « Annuler » de ce message dépend de QG-6 (courriels).

### 3.11 Glisser-déposer

- **Pendant le glissé**, chaque case survolée se teinte **vert** (possible) ou **rouge** avec le motif (« Absent », « Férié », « Agence fermée », « Habilitation manquante ») — calculé dans la page à partir des données déjà chargées ; le serveur reste juge.
- **Au dépôt** :
  - carte déjà planifiée, heure et durée connues, case verte → **déplacement direct, heure et durée conservées** (audit, bug 9 : aujourd'hui l'heure est effacée) ;
  - carte de la file, durée ou heure manquante, ou heure qui ne tient pas à l'arrivée → **fenêtre de pose** pré-remplie. **Aucune requête d'écriture avant « Planifier ».**
- Clavier et téléphone : le bouton « Poser » remplace le glisser.

### 3.12 Créer depuis une case

Clic sur une case vide (ou une plage en vue Jour) → « + Créer ici » → **formulaire de création inchangé** (PARCOURS-1 : ni date, ni heure, ni technicien à la création) → à l'enregistrement, **la fenêtre de pose s'ouvre**, pré-remplie avec la date, l'heure et le technicien de la case. (Cahier M4 : « création par sélection d'une plage ».)

### 3.13 Transmettre (après QG-5)

- Bouton d'en-tête **« Transmettre demain (5) »** → liste par technicien des interventions planifiées du prochain jour ouvré, à cocher → Planifiée → Affectée (transition déjà écrite dans la matrice D8).
- Sur la fiche : action principale « Transmettre au technicien » (remplace « Affecter un technicien », qui ne fait pas avancer le statut — audit, bug 7).
- **Le courriel au technicien** part aujourd'hui à la planification et à chaque déplacement (AVERTISSEMENTS-1) ; selon QG-5, il part à la transmission.
- Déplacer une intervention transmise la repasse en Planifiée (le technicien doit recevoir la nouvelle version) — à confirmer avec QG-5.

### 3.14 Charge

Formules existantes conservées (D107, D111 : par technicien **et** agence). Ce qui change : le pourcentage pour **chaque** technicien actif, 0 % compris ; « ≥ » quand des durées manquent ; la barre par jour. **Le panneau de charge reste** (repliable) avec les deux termes et la formule de D111, et la phrase de D107 sur le trajet entre sites reste visible — il ne devient pas une infobulle.

---

## 4. Téléphone (< 900 px)

Trois onglets fixes : **Aujourd'hui · À traiter (n) · Semaine**. Cibles ≥ 44 px.

- **Aujourd'hui** : sélecteur de jour (‹ lun. 21/09 ›) ; par technicien, cartes dans l'ordre des heures (heure, client, nature, site) ; absence en bandeau violet ; trajet aller en tête.
- **À traiter** : les onglets du bureau en liste déroulante ; **la P1 en tête, visible sans défiler** ; chaque carte a **« Poser »** → fenêtre de pose plein écran, mêmes contrôles. Pas de glisser au téléphone.
- **Semaine** : par jour puis par technicien (la liste actuelle, N-02, améliorée).
- **Remplace le chantier C-B1** (vue Jour en liste au téléphone) : même besoin, une seule construction.

---

## 5. Couleurs et signes

*Jetons existants uniquement (maquette complète, D124 ; `lib/theme/statuts.ts`). Une trame ne dit que « fermé » (R2-15).*

| Signe | Rendu |
|---|---|
| Planifiée | fond `bleu-fond` (#e8f1fb), liseré bleu (#0053a1) — `CLASSES_BLOC` actuel |
| Affectée (transmise) | même bloc que Planifiée (`CLASSES_BLOC` actuel) + pastille « ✓ transmise » en `bleu-plein` (#0053a1, encre blanche) — aucune couleur nouvelle |
| En cours | fond `rouge-fond` (#fdebed), liseré rouge (#e30613) |
| Suspendue | hors grille (onglet « Suspendues »), pastille `orange-fond` |
| Terminée | fond `vert-fond` (#e5f5ec), liseré vert (#12824b) |
| Clôturée | même bloc + pastille `vert-plein` |
| Annulée | masquée ; filtre « Afficher les annulées » : gris barré (annexe D) |
| En retard | contour pointillé rouge + mention « En retard » |
| Priorité | puce **P1** rouge pleine (#e30613), **P2** orange (`orange-fond`, encre #8a5600) ; P3 et P4 sans puce sur la grille ; liseré de la carte de file = couleur de la priorité |
| Absence | aplat violet (#f0eafe, encre #6941c6 — jetons de la maquette), mot « Absent » |
| Fermé / férié | trame grise, libellé |
| Hors ouverture (vue Jour) | aplat gris plein (`gris-fond`), sans trame |

La légende « En cours / P1 » de l'écran actuel (même rouge pour un statut et une priorité) disparaît : **le statut est un fond, la priorité une puce.**

---

## 6. Données

**Lots PG-A à PG-D : aucune donnée nouvelle, aucune migration.** Tout existe : date, créneau, durée prévue, technicien, statut, priorité, nature, site (zone, trajet), absences, calendriers (jours, heures, fériés, ponts, exceptions), habilitations, `cree_le`, `vue_technicien_le`, segments de travail.

« En retard », « ancienneté », « sans durée » et la charge sont des **lectures**, calculées dans `lib/` (une fonction par notion, un test chacune), jamais stockées.

**Après décision seulement :** Déplanifiées (DEPLANIFIEE-1, migration déjà prévue), transmission (QG-5 : pas de migration — le statut existe — mais un changement de ce que voit le terrain et de l'envoi des courriels), salarié / patenté (QG-9), absence à l'heure (QG-8), machine à l'arrêt (QG-10), délais cibles (QG-11), durées types (QG-12).

---

## 7. Règles appliquées — aucune nouvelle

RG-PLA-01 et 02 (calendriers et fériés par agence) · RG-PLA-03 (chevauchement refusé, amendée par D99) · RG-PLA-04 (habilitation bloquante) · RG-PLA-05 (trajet aller/retour, D107) · RG-PLA-06 (absence ; report groupé sans créneau proposé, D106) · RG-PLA-07 (poser dans le calendrier de l'agence ; l'union affichée est un repère) · RG-PLA-08 (client inactif hors planning) · PARCOURS-1 (quatre valeurs ; création sans date) · D8 (transitions) · D88 (une VGP n'est pas du travail à planifier ; une observation d'organisme l'est) · D111 (le taux seul sous le nom ; charge par technicien et agence) · annexe D (annulée masquée par défaut).

*Le cahier M4 dit « alerte sans blocage » pour le chevauchement : D99 l'a amendé en refus. Cette spécification suit D99.*

---

## 8. Critères d'acceptation (chacun devient un test)

| # | Critère |
|---|---|
| CA-1 | Pour chaque agence et chaque jour d'une année de test (calendrier avec férié chômé, férié travaillé, pont, exception), la grille Semaine, la vue Jour et la vue Mois montrent le jour ouvert **si et seulement si** `estJourOuvre(calendrier de l'agence, jour)` le rend. |
| CA-2 | Les techniciens apparaissent dans le même ordre dans toutes les vues. |
| CA-3 | Glisser une carte « À planifier » sur une case Semaine ouvre la fenêtre de pose pré-remplie (date, technicien) ; **aucune requête d'écriture** ne part avant « Planifier ». |
| CA-4 | « Tirez la poignée… » n'apparaît que sur un redimensionnement. Chemins éprouvés : dépôt d'une carte sans durée, heure vidée avec durée remplie, durée 0 saisie, poignée remontée — seul le dernier affiche ce message. |
| CA-5 | Une intervention planifiée la veille, sans segment de travail, apparaît dans « En retard » (planning, tableau de bord, registre) avec son contour ; elle en sort dès qu'elle est démarrée, déplacée ou annulée. |
| CA-6 | Chaque technicien actif a son pourcentage sous son nom, 0 % compris ; un taux incomplet porte « ≥ ». |
| CA-7 | Après QG-1 : à 1280 px, chaque colonne de jour ouvert mesure ≥ 150 px, le défilement est signalé ; une carte montre heure, client (≤ 2 lignes), nature et commune. |
| CA-8 | Clic sur une carte : tiroir, `?intervention=` dans l'URL, Échap ferme, le planning ne se recharge pas. |
| CA-9 | À 375 px : trois onglets ; dans « À traiter », la première P1 est visible sans défiler. |
| CA-10 | Chaque ticket livre ses captures AVANT/APRÈS à 1280 et 375 px dans `docs/propositions/<ticket>/captures/`. |
| CA-11 | Un déplacement en vue Semaine d'une carte planifiée à 08:00 la garde à 08:00 avec sa durée. |
| CA-12 | Une intervention annulée n'apparaît ni dans la file ni sur la grille, sauf filtre « Afficher les annulées ». |

---

## 9. Ce que ce document ne décide pas

Les questions QG-1 à QG-12 de l'audit du 27/09 (§6). **Plus tard, hors de ce document :** tournées (ordre des visites, carte), astreinte, optimisation — le cahier les décrit ; Alexis les a placées après la stabilisation.

## 10. Références

- Cahier des charges : `docs/cahier-des-charges.md` §M4 (l. 433-447), RG-PLA-01 à 08 (l. 719-726), parcours P1 et P3 (l. 606-637), annexe D (l. 1724-1735).
- Maquette complète : `docs/maquette/codiplan-maquette-complete.html` — `planning()`, `weekPlan()`, `dayPlan()`, `openDrawer()`, classes `.planning-shell`, `.plan-grid`, `.queue-card`, `.event`, `.detail-drawer`.
- Décisions : `docs/arbitrages.md` D8 (l. 161, §3.6 l. 528), D88, D106, D107, D111 (l. 3770), D125, D128 ; `docs/backlog.md` R2-14, R2-15, L3-03, L3-03a ; passations PARCOURS-1, 82-PLANNING-6, AVERTISSEMENTS-1.
- Pratiques du métier : [Dynamics 365 Field Service — tableau de répartition](https://learn.microsoft.com/en-us/dynamics365/field-service/work-with-schedule-board) (ressources en lignes, vues heure/jour/semaine/mois, volet des besoins non planifiés, « trouver une disponibilité ») ; [Salesforce Field Service — Gantt de la console de répartition](https://help.salesforce.com/s/articleView?id=sf.pfs_gantt.htm&language=en_US&type=5) et [violations de règles](https://help.salesforce.com/s/articleView?id=service.pfs_violations.htm&language=en_US&type=5).
