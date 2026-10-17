# 9F2-TERRAIN-JOURS-MAQUETTE — passation

Mesuré sur origin/main a65a7de9 au départ (décision n° 92 d'Alexis, 13/10/2026, D210).
Trois commits livrés : fonction pure + page, épreuve de bout en bout + captures,
documentation.

## Ce que j'ai changé

- **La fenêtre lue par `/terrain` s'étend d'aujourd'hui à J+7 inclus** (borne haute J+8,
  exclusive, posée par l'appelant à `listerPlanning` — même convention que les autres
  appelants). Le filtre D141 14C (`inclurePlanifiees: false, inclureAnnulees: false`) ne
  change pas : le terrain ne voit toujours que le transmis.
- **`repartirJourneeTechnicien`** (fonction pure, `lib/interventions/journee-technicien.ts`)
  range les lignes lues par jour civil : `enRetard`, `aujourdHui`, `demain`,
  `suite` (`{ nombre, dates }`, J+2 à J+7), `sansDate`. Elle ne refiltre rien : le filtrage
  (transmis, en retard = affectée seule) est déjà fait par l'appelant. `jourCivilDeDatePlanifiee`
  (`lib/interventions/retard.ts`) est exportée pour cette seule raison — une seconde
  écriture du même critère aurait divergé en silence (§9, 01/09).
- **Le retard reste lu à part**, par `interventionsEnRetard` (même critère que le registre
  du bureau, PG-C1a), filtré sur `statut === "affectee"` — le terrain ne montre jamais de
  `planifiee`, même en retard.
- **Page** (`app/(mobile)/terrain/page.tsx`) : cinq sections dans l'ordre de la maquette —
  En retard (si non vide), Aujourd'hui, Demain · \<jour long\>, Les jours suivants (résumé
  sans lien), Affectées sans date (gardée, en dernier — écart nommé, D210). Le bandeau
  « compteur en cours » (QE-11) ne se calcule plus que sur En retard + Aujourd'hui +
  Sans date. La carte d'une ligne En retard porte sa propre date (« En retard · prévue
  jeu. 25/09 »).
- **Composition déplacée hors du fichier JSX** (`components/terrain/presentation.ts`) :
  `libelleJourLong`, `libelleTitreDemain`, `libelleJoursSuivantsVide`, `libelleDatesSuite`.
  Pas une préférence de style — le gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`
  pré-scanne les `const` de niveau module d'un fichier JSX SANS connaître les accesseurs du
  dictionnaire (voir sa fonction `constantesLitterales`, contexte vide intentionnel) : un
  gabarit composé dans une `const` puis rendu via `{identifiant}` est donc vu comme du texte
  en dur, même s'il n'appelle que `t(...)`. Un appel de FONCTION direct dans le JSX
  (`{libelleTitreDemain(aujourdHui)}`) échappe à ce pré-scan — c'est déjà comme ça que
  `heureOuTiret`/`jourEtDateAbregee` passaient avant ce ticket. Le séparateur « · » passe
  par la clé existante `ponctuation.point_median`, jamais un caractère en dur (même
  précédent que `parc/[id]/page.tsx`).
- **`jourEtDateAbregee`** (`app/(back-office)/interventions/presentation.ts`) est exportée
  (elle ne l'était pas) — la carte « En retard » du terrain en a besoin de la même forme
  « jeu. 25/09 » que la colonne « À traiter » du bureau.
- **Clés i18n neuves** (`lib/i18n/fr.ts`) : `terrain.en_retard`,
  `terrain.carte.en_retard_prevue`, `terrain.demain`, `terrain.demain.vide`,
  `terrain.jours_suivants.titre`, `terrain.jours_suivants.vide_prefixe`,
  `terrain.jours_suivants.intervention_singulier`/`interventions_pluriel`, et les fixtures
  `terrain9f2.e2e.*` (préfixe `zz9F2-`).

## Ce que j'ai mesuré

- **Unitaire** (`tests/unit/interventions/journee-technicien.test.ts`, 8 scénarios) : les
  bornes J, J+1, J+2, J+7, J+8 exclu ; une ligne sans date ; les jours distincts de
  « la suite » comptés une fois et triés ; le retard passé tel quel, trié par date.
- **Bout en bout** (`tests/e2e/9f2-terrain-jours-maquette.spec.ts`) : deux `describe`
  indépendants (hooks propres), `mode: "serial"` au niveau du fichier.
  - **« remplie »** forge sa propre scène (`zz9F2-`, 6 sites/interventions) : une affectée
    hier (en retard), une aujourd'hui, une demain, une à J+4 (jours suivants), une à J+9
    (hors fenêtre — **mesuré absente**) et une PLANIFIÉE demain (**mesurée absente**, D141
    14C même sous la fenêtre étendue). L'ordre des quatre sections est vérifié par la
    position verticale de leurs titres (`boundingBox().y`), pas par un décompte. Aucun
    débordement horizontal à 375 px (`scrollWidth <= clientWidth`).
  - **« vide »** ne forge RIEN : le semis partagé pose déjà, pour
    `COMPTE_TECHNICIEN_EPREUVE` (le seul technicien loginable en e2e), plusieurs lignes en
    retard réelles — **mesuré en exécutant l'épreuve** : 5 cartes « En retard » déjà
    présentes avant même ma propre scène. Une fenêtre de 8 jours sur un semis partagé n'a
    donc aucune garantie d'être vide ; l'épreuve MESURE d'abord (requête Prisma en lecture
    seule, même critère que `critereEnRetard`/la fenêtre de la page) et se retire
    elle-même (`test.skip`) si elle l'est. **Mesuré à l'exécution : elle s'est retirée** —
    la capture « vide » n'a donc PAS été prise ; seule `journee-remplie-{375,1280}.png`
    existe dans `captures/`. Reprendre cette capture suppose soit un semis sans ligne en
    retard pour ce technicien, soit un second compte technicien loginable dédié — aucun des
    deux n'existe aujourd'hui (seul `garnier@codima.test` porte un mot de passe partagé en
    e2e).
  - Épreuves voisines rejouées (`grep -rl "/terrain" tests/e2e`, celles nommées par le
    ticket) : `9dd-pg-g14c-terrain-transmises`, `9di-tp-ter1-journee-fiche`,
    `avertissements-1`, `terrain-largeur`, `terrain`, `arrivee`, `navigation-app-technicien`
    — toutes vertes. Un échec isolé d'`avertissements-1` (décompte de courriels capturés)
    **mesuré non lié** : vert en isolation (4/4), rouge seulement sous 12 workers en
    parallèle avec d'autres specs — contention sur un état de capture d'e-mails partagé
    entre specs, pas une régression de ce ticket.
  - **Deux captures régénérées par effet de bord** (AVERTISSEMENTS-1 et 99A-ARRIVEE,
    relancées par la session pour vérifier la non-régression) **restaurées** à leur état
    commité avant ce lot, comme l'exige le gabarit.

## Ce qui reste ouvert

- La capture « Ma journée » vide (375/1280) n'a pas pu être prise contre un compte
  technicien réellement loginable en e2e — voir ci-dessus. **Voir 9F2B** : repris par
  9F2B-TERRAIN-JOURS-EPREUVES (isolation sous un technicien, état vide sans `test.skip`,
  cartes sous le bon titre, bascule de jour, captures en viewport).
- Une ligne `en_cours`/`suspendue`/`terminee`/`cloturee` restée datée dans le passé
  n'apparaît dans aucune section de ce ticket (ni « en retard », qui ne porte que les
  `affectee` ; ni aucune section datée, hors fenêtre). Nommé en condition de réouverture de
  D210 : aucune règle de gestion ne le spécifie aujourd'hui.

## Fin de lot

`git grep -l "/terrain" tests/e2e` rejoué (liste ci-dessus) ; `pnpm format` + `pnpm typecheck`
+ `pnpm lint` + `pnpm test` + `pnpm test:isolation` + `pnpm build` verts avant chaque commit.
`CI=1 pnpm verify:full` lancé en entier avant de rendre la main — voir ses 15 dernières
lignes et le `HEAD` associé plus bas dans cette passation (ou dans le message du commit
suivant si le budget de temps a coupé avant).
