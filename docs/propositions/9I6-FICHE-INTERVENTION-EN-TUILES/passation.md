# 9I6-FICHE-INTERVENTION-EN-TUILES — passation

## Reprise 9I6A (29/10/2026, 16:09–…)

9I6 (ci-dessous) était ARRÊTÉ par la file à 150 min sans passation écrite — trace vide. Garde :
branche `9I6-FICHE-INTERVENTION-EN-TUILES-garde`. Vérification indépendante du pilote : 5 des 6
échecs mesurés portaient sur la fiche. Ce lot (9I6A) reprend cette garde sur la branche dédiée
`9I6A-REPRISE-9I6` (partant d'`origin/main`, commit `080fc6d2e` — `main` était extrait ailleurs,
`/home/aplou/codiplan`) et corrige les 5 échecs, sans toucher au territoire hors fiche.

### Les 5 échecs, tuile par tuile

| Tuile / fichier | Ce qui clochait | Correctif | Preuve |
|---|---|---|---|
| Intervention (`page.tsx`) | « Créneau » et le nom du technicien affichés DEUX FOIS (en-tête `EnTeteFiche`, pré-existante, ET la nouvelle tuile) | Retirés de la tuile — l'en-tête (inchangée par 9I6) reste la seule source de ces deux faits | `tests/e2e/fiche-intervention.spec.ts:202`, `tests/e2e/intervention-technicien-select.spec.ts:178,194` — verts |
| Sur place (`page.tsx`) | L'adresse avait quitté « Sur place » vers « Client » SANS y être dupliquée — régression d'information (horaires/tel:/consignes/habilitation étaient en fait déjà là, mesure affinée par exécution réelle) | Adresse RESTAURÉE dans « Sur place » (même donnée qu'en Client, aucun test n'en exige l'unicité, à la différence du contact) | `tests/e2e/fiche-onglets-sur-place.spec.ts` (4 tests) — verts |
| Sur place — sélecteur de test (`fiche-onglets-sur-place.spec.ts`) | Un `hasText` sur TOUTE la section collisionnait avec « Contact sur place » (Client) : `.first()` résolvait sur « Client », jamais « Sur place » — bug de sélecteur découvert en exécutant le test, pas seulement l'ADV du 1er échec | Sélecteur par rôle « heading », exact, dans les 2 tests concernés | même fichier — verts |
| 1280 px, grille (`fiche-375.spec.ts`) | La colonne latérale sticky `1fr/300px` a quitté l'onglet Résumé (demande d'Alexis, grille à deux colonnes) : « Sur place » n'est plus à côté de la 1ʳᵉ tuile | Épreuve ADAPTÉE (disposition changée par CE ticket) : vérifie désormais Client/Machine, le nouveau premier couple adjacent | `tests/e2e/fiche-375.spec.ts` — vert |
| `planning-survol-cases.spec.ts:191` | Suspecté étranger (planning, hors territoire) | MESURÉ vert sur cette branche (pas rouge) — aucune action requise, hors territoire de toute façon | passe, 1/1 |

### Ce que ce lot N'A PAS fait (budget, 35 minutes utilisées sur 120)

Le reste du contrat 9I6 (six tuiles, états vides, autres onglets en tuiles, 375/1280) était déjà
livré par la garde et validé par la batterie de 93 épreuves e2e ci-dessous — aucune reprise
nécessaire. Aucun point ouvert nouveau.

### Vérification large (hors territoire direct, pour écarter toute régression supplémentaire)

93 épreuves e2e du périmètre fiche/intervention (9i6, fiche-*, intervention-*, bon-intervention,
montants-par-role, blocage-agenda-visible) rejouées sur ce lot : 93 passées. Captures APRÈS
régénérées (`CAPTURES_9I6_ETAPE=apres`) pour les deux correctifs visibles (adresse, tuile
Intervention allégée) ; AVANT inchangées (code d'`origin/main` non touché).

---

# 9I6-FICHE-INTERVENTION-EN-TUILES — passation (garde, avant reprise)

Démarré 29/10/2026 11:19 (Nouméa), code et épreuves terminés 12:05 — dans le budget de 150 min, bien
avant la coupure de code neuf à T0+90 (12:49). `pnpm verify:full` tourne après ce commit.

Travaillé sur la branche `9I6-fiche-intervention-en-tuiles` (partant d'`origin/main`, commit
`080fc6d2e`) : `main` était extrait ailleurs (`/home/aplou/codiplan`), ce worktree (`codiplan-voie1`)
était en HEAD détachée.

## 1. Inventaire mesuré (`app/(back-office)/interventions/[id]/page.tsx`, avant ce lot)

Cinq onglets (`VALEURS_ONGLET_FICHE`, inchangés par ce lot) : Résumé, Temps, Rapport, Valorisation,
Historique.

| Onglet | Bloc | Forme avant | Titré ? |
|---|---|---|---|
| Résumé | Avant de clôturer (si `terminee`) | `Carte` | oui |
| Résumé | Panne signalée, Client, Référence client, Motif d'annulation, Origine | **une seule `Carte` SANS titre** | non |
| Résumé | Machine(s) + formulaire « ajouter une machine » | `Carte titre="Machine"`, **absente si aucune machine et aucun droit d'ajout** | oui, conditionnelle |
| Résumé | Habilitations exigées (si `fiche.habilitations !== null`) | `Carte` | oui |
| Résumé (colonne 300 px) | Sur place — adresse, horaires, donneur d'ordre, **contact sur place**, consignes d'accès, habilitations, agence | `Carte titre="Sur place"` dans `ColonneContexte` (sticky) | oui |
| Résumé (colonne 300 px) | Note interne | `Carte` dans `ColonneContexte` | oui |
| Temps | Segments de travail, temps mesuré/validé | `Carte titre="Réalisation"` | oui |
| Temps | Pauses | `Carte titre="Pauses"` | oui |
| Rapport | Prestations, **commentaire technicien**, **suite à donner**, **signature** (texte seul, jamais l'image), clôturée le | `Carte titre="Réalisation"` | oui |
| Valorisation | Mode, forfait | `Carte titre="Valorisation"` | oui |
| Valorisation | Détail du calcul (si accès aux montants) | `Valorisation` (composant), conditionné à `fiche.valorisation !== null && fiche.devise !== null` | — |
| Historique | Chronologie des événements | `Chronologie` | oui |

**Ce qui manquait totalement, mesuré absent de tout l'écran** : les **photos** (visibles seulement sur
le bon imprimable, `[id]/bon/`) et l'**image** de signature (le bureau n'affichait qu'un texte « Signée
le… », jamais le tracé) ; la **durée estimée** (`ligne.duree_estimee_min`, déjà lue par le serveur pour
préremplir les dialogues, jamais affichée en lecture).

La disposition : `grid lg:grid-cols-[1fr_300px]` (mesure R2-08 de la maquette, 11/09/2026) — une colonne
principale et une colonne de contexte **vide sur les quatre onglets autres que Résumé**.

## 2. Ce que ce lot a fait

Six tuiles neuves sur l'onglet Résumé, dans l'ordre de lecture demandé : **Client** (raison sociale,
site, adresse, contact — adresse et contact quittent « Sur place », qui ne les répète plus),
**Machine** (ex-« Machine », toujours rendue désormais — état vide honnête), **Intervention** (numéro,
nature, priorité, statut, créneau, créée le, technicien, **durée estimée** [nouveau], panne signalée,
référence client, motif d'annulation, origine), **Commentaires et photos** (nouveau : texte + galerie,
lecture `photosDeLIntervention`), **Suite à donner** (nouvelle tuile, même donnée que Rapport),
**Signataire** (nouveau : nom, date, **image** si signée).

Les blocs restants de Résumé (Habilitations exigées, Sur place écourtée, Note interne) et les quatre
autres onglets (déjà des `Carte`) rejoignent une **grille unique, deux colonnes égales**
(`grid-cols-1 lg:grid-cols-2`), à la place du `1fr 300px` mesuré sur la maquette — **écart nommé**,
licencié par la consigne du ticket (« la demande prime sur la maquette pour cet écran »). Conséquence
assumée : `ColonneContexte` (positionnement `sticky`) n'est plus utilisée sur cette fiche — une colonne
de 300 px sticky n'a plus de sens une fois les deux colonnes égales.

**Écart signalé (vocabulaire imposé, D172)** : la demande d'Alexis dit « Matériel » ; c'est un synonyme
FERMÉ de *Machine*, refusé partout hors du domaine `materiel.*` (le catalogue des familles/modèles,
tenu par `tests/unit/i18n/vocabulaire-impose.test.ts`). La tuile garde le mot imposé « Machine ». Signalé
en commentaire au point d'usage, dans le commit, et ici.

## 3. Ce que ce lot n'a pas touché

`Valorisation` garde sa condition de montage (`fiche.valorisation !== null && fiche.devise !== null`),
réservée à 9I8. Le bon d'intervention (`[id]/bon/`) n'a pas été ouvert. Aucune migration.

## 4. Épreuves

- `tests/e2e/9i6-fiche-intervention-tuiles.spec.ts` — les six tuiles, par rôle de titre (`exact: true`,
  nécessaire : le nom du client de la fixture contenait le mot « client » et collisionnait avec le titre
  de la tuile en correspondance par sous-chaîne), sur une intervention CLÔTURÉE et SIGNÉE (données
  réelles) et sur une `a_planifier` sans aucune donnée (états vides honnêtes), à 375 et 1280 px, sans
  débordement horizontal (`scrollWidth`). 4 passent.
- `tests/e2e/zz-captures-9i6.spec.ts` — inerte sans `CAPTURES_9I6` ; capture les cinq onglets × deux
  largeurs × (plein écran + viewport), rejouée sur `080fc6d2e` (AVANT) et sur ce lot (APRÈS). 40 PNG
  dans `docs/propositions/9I6-FICHE-INTERVENTION-EN-TUILES/captures/`.
- `pnpm test`, `pnpm test:isolation` verts (voir `verify-final.txt`).

**Non couvert par une épreuve automatisée, vérifié seulement par capture visuelle** : l'absence de
débordement horizontal sur les quatre AUTRES onglets (Temps, Rapport, Valorisation, Historique), qui
rejoignent eux aussi la grille à deux colonnes. Les captures 375 px ne montrent aucun débordement, mais
aucune assertion `scrollWidth` ne le fige pour eux — un point ouvert, si un prochain lot y touche.

## 5. Points ouverts

- Le débordement horizontal des onglets Temps/Rapport/Valorisation/Historique n'est vérifié que
  visuellement (voir ci-dessus).
- La tuile « Machine » (mot imposé, §2) peut mériter une relecture d'Alexis si « Matériel » était un choix
  délibéré plutôt qu'un raccourci de langage — la doctrine D172 est claire, mais c'est sa demande qui
  nommait l'autre mot.
