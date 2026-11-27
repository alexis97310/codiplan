# 9L53-TERRAIN-TERMINEE-ETAT-HEURE — m3 (partie sans conflit) — passation

Périmètre reçu : audit terrain du 10/11 (B11), point m3. La partie « figer dès terminée »
est en conflit avec D220 et **n'a pas été touchée**. Ce lot ne fait QUE la partie sans
conflit : « afficher l'état et l'heure de fin ».

## 1. Mesure faite avant d'écrire une ligne

Une intervention `TERMINEE` ou `CLOTUREE` affichait déjà son état en clair, sur les deux
écrans :

- `components/terrain/liste-journee.tsx` — badge de statut (`CLASSES_STATUT`), déjà
  traduit par `t('statut.${ligne.statut}')`.
- `app/(mobile)/terrain/[id]/page.tsx:549-556` — même badge, en tête de fiche.

Ce qui MANQUAIT sur les deux écrans : l'heure de fin. La section « Compteur » de la fiche
n'affichait qu'une DURÉE totale (`enDuree(mesure.minutes)`) ou, compteur tournant,
« tourne depuis HH:MM » — jamais l'instant où le dernier segment s'est fermé. Aucune
fonction du dépôt ne calculait cet instant. Donc : lot NON vide, la partie « heure de
fin » restait à faire.

## 2. Ce qui a été ajouté

- `lib/interventions/compteur.ts` — `Mesure` porte un nouveau champ,
  `finDuDernierSegmentFerme: Date | null` : le plus TARDIF des `fin` parmi les segments
  fermés (jamais le dernier de la liste reçue — un renfort peut fermer son segment hors
  ordre). Fonction pure, aucune lecture de base ni d'horloge, cohérent avec le reste du
  fichier.
- `lib/interventions/depot.ts` — `SELECTION_LIGNE_FILE_A_TRAITER` lit désormais, par
  intervention, le SEUL segment fermé le plus récent (`take: 1, orderBy: fin desc`) ;
  `LigneFileATraiter` porte `finDuDernierSegmentFerme: Date | null`, calculé par la
  nouvelle fonction partagée `ligneDepuisSelection` (remplace les deux map() dupliqués de
  `listerPlanning` et `ligneFileATraiter`). Champ ADDITIF : aucun appelant existant
  (`/planning`, `/tableau-de-bord`, `/absences`, le terrain) n'est affecté, tous ignorent
  simplement le nouveau champ sauf le terrain.
  - Choix délibéré de NE PAS toucher `CHAMPS_LIGNE` (partagé par 8+ lecteurs, dont des
    fiches client/site) ni `LignePlanning` : le besoin est scopé au terrain, et
    `SELECTION_LIGNE_FILE_A_TRAITER` est la plus petite porte commune qui le couvre.
- `lib/terrain/projection-journee.ts` — `finDuDernierSegmentFerme` traverse la projection
  (liste FERMÉE de champs) jusqu'à `LigneJourneeAffichee`.
- `components/terrain/liste-journee.tsx` (`Carte`, celle de Ma journée) — une ligne
  « Terminée à HH:MM » sous le nom du client, visible seulement si le statut est
  `terminee`/`cloturee` ET qu'un segment est fermé (sinon rien, jamais un tiret qui ne
  répondrait à rien). `CarteApercu` (« à faire maintenant ») n'est PAS concernée :
  `prochaineAFaire` exclut déjà `terminee`/`cloturee` de cette tuile.
- `app/(mobile)/terrain/[id]/page.tsx` — la même ligne, à côté du badge de statut en tête
  de fiche, au fuseau de l'AGENCE de cette intervention (D5), via `mesure` déjà chargée
  (`mesureDeLIntervention`).
- `lib/i18n/fr.ts` — une seule clé, `terrain.carte.termine_a` (« Terminée à »), partagée
  par les deux écrans.
- Aucun geste retiré, aucun montant ajouté, aucune migration.

## 3. Épreuves

- `tests/unit/interventions/compteur.test.ts` — deux scénarios neufs : la fin la plus
  tardive l'emporte sur l'ordre de la liste ; un segment encore ouvert n'avance pas la
  fin du dernier segment FERMÉ. Le scénario existant « aucun segment » est mis à jour
  (nouveau champ `finDuDernierSegmentFerme: null`).
- `tests/unit/terrain/projection-journee.test.ts` — fixture migrée de `LignePlanning` vers
  `LigneFileATraiter` (le type RÉELLEMENT reçu en production par `projeterLigneJournee`
  depuis `listerPlanning`/`interventionsEnRetard` — `LignePlanning` n'était qu'un
  « superset pratique » pour ce test, jamais le vrai type d'entrée). La garantie « aucun
  champ interdit ne traverse » reste éprouvée à l'identique.
- `tests/e2e/9l53-terrain-terminee-etat-heure.spec.ts` — 375 px, 3 scènes (TERMINÉE sur la
  fiche, TERMINÉE sur Ma journée, CLÔTURÉE sur la fiche) : état en clair ET heure de fin
  exacte (calculée par le MÊME `versLocal`/`fuseauDeLAgence` que la production, jamais une
  valeur en dur). Toutes trois vertes.

## 4. Captures

`docs/propositions/9L53-TERRAIN-TERMINEE-ETAT-HEURE/captures/` — APRÈS seulement
(375 px) :
- `fiche-terminee-apres-375.png`
- `ma-journee-terminee-apres-375.png`

**Pas de capture AVANT** cette fois : un AVANT fidèle demande un build de production sur
l'état précédent (`git show HEAD:...` + reconstruction + redémarrage serveur), hors du
budget de 90 minutes de ce lot. L'état AVANT est documenté textuellement au § 1
ci-dessus (badge déjà présent, heure de fin absente), établi par lecture directe du code
avant toute modification plutôt que deviné — à défaut d'image, une preuve nommée. Je le
signale explicitement plutôt que de l'omettre.

`docs/captures/` (galerie globale) n'a pas été rejouée : ce lot ne change ni `app/`
ni `components/` au sens large de la gallerie sans y ajouter un écran déjà couvert par les
captures e2e ci-dessus, et `scripts/captures.mts` demande une base jetable + un amorçage
de mot de passe, hors budget également. À rejouer au prochain lot qui touche ces écrans
si Alexis le demande.

## 5. Ce qui reste explicitement HORS de ce lot

- « Figer dès terminée » (le reste du point m3 de l'audit) — en conflit avec D220, laissé
  de côté comme demandé.
- Aucune migration, aucune règle métier nouvelle : l'heure de fin existait déjà en base
  (`segment_travail.fin`), ce lot ne fait que la LIRE et l'AFFICHER.

## 6. Numéro d'arbitrage

Aucun posé : ce lot ne change aucune règle de gestion (I1 à I10 intacts, aucune valeur
inventée) — il expose une donnée déjà stockée. `docs/arbitrages.md` non touché.
