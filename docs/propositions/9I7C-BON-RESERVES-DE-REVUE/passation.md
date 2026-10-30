# 9I7C-BON-RESERVES-DE-REVUE — passation

Revue (lecture seule) de 9I7-BON-INTERVENTION-EN-TUILES, publié le 30/10 à
00:27 (`665b2b47`). Quatre réserves mesurées sur ce commit, corrigées ici,
une par commit.

## Point 1 — la date dans l'en-tête

`lib/interventions/bon.ts` lit désormais `cloturee_le` (déjà en base, aucune
colonne nouvelle) et le retourne dans `BonIntervention.clotureeLe`.
`bon/page.tsx` calcule `dateDocumentAffichee` : la date de clôture quand elle
existe (convertie dans le fuseau de l'agence par `dateLocale` — jamais
`dateCivile`, réservée aux colonnes `@db.Date`, L0-08), sinon la date
planifiée. Affichée sous le titre et la référence, avec `data-bloc="bon-date"`
pour que l'épreuve la distingue de la « Date planifiée » de la tuile
Intervention, qui continue de s'afficher à côté, inchangée.

**Choix fait, à confirmer si besoin** : « date de réalisation » n'existe pas
comme colonne distincte en base (seules `date_planifiee` et `cloturee_le`
existent sur `intervention`) — l'en-tête retombe donc sur `cloturee_le` ou,
à défaut, `date_planifiee`, jamais une troisième source.

## Point 2 — le technicien, même sans segment

`lib/interventions/bon.ts` résout `technicien_id` (déjà sélectionné par
`CHAMPS_LIGNE`) via le même mécanisme d'annuaire que les segments, et
l'ajoute à l'annuaire interrogé. `BonIntervention.technicienAffecte` est
`null` quand aucun technicien n'est affecté — la tuile Intervention n'affiche
alors AUCUNE ligne (jamais un « — » qui inventerait une absence).

## Point 3 — la tuile signataire vide ne s'imprime plus

Régression mesurée : `5032af9e` posait `print:hidden` sur la section
signature quand `bon.signature === null` ; 9I7 a perdu cette règle en
passant aux tuiles `Carte`, à la différence des tuiles commentaires /
prestations / suite, qui l'ont gardée. Restaurée à l'identique : la classe
posée sur la `Carte` elle-même, rien ne change à l'écran.

## Point 4 — les preuves manquantes

`tests/e2e/9i7c-bon-reserves-de-revue.spec.ts`, deux scénarios (bon clôturé /
bon terminé), sous `page.emulateMedia({ media: "print" })` :
- mentions légales en pied de document, présentes puis absentes ;
- logo visible et borné à 15 mm à l'impression (mesuré, pas supposé) ;
- date de l'en-tête (clôture, puis planifiée à défaut) ;
- technicien affecté même sans segment, puis son absence.

Gardien L0-11 (`sans-chaine-visible-en-dur`) : les dates et le nom de
technicien ne passent jamais par `getByText`/`getByAltText` avec un
littéral — lus via `.innerText()` et comparés en JS (même réserve que
`toHaveText("0")` dans [[captures-avant-apres-e2e]]).

## Point 5 — captures AVANT/APRÈS

AVANT = `3b6163ac9` (le commit juste avant ce lot), rejoué dans un worktree
temporaire (`/tmp/9i7c-avant`, créé puis supprimé) avec le même spec de
capture — recette du « AVANT déjà committé » de [[captures-avant-apres-e2e]].
APRÈS = ce lot, points 1 à 4 inclus. `tests/e2e/captures-9i7c-bon-reserves-de-revue.spec.ts`
pilote la phase par `CAPTURE_PHASE` (`avant`/`apres`, défaut `apres`).

Fichiers, dans `docs/propositions/9I7C-BON-RESERVES-DE-REVUE/captures/` :

| Fichier | Octets |
|---|---|
| bon-non-signe-avant-375-viewport.png | 48 772 |
| bon-non-signe-apres-375-viewport.png | 50 090 |
| bon-non-signe-avant-1280-viewport.png | 103 869 |
| bon-non-signe-apres-1280-viewport.png | 106 971 |
| bon-non-signe-avant-impression.png | 84 345 |
| bon-non-signe-apres-impression.png | 83 457 |
| bon-signe-avant-375-viewport.png | 49 221 |
| bon-signe-apres-375-viewport.png | 49 828 |
| bon-signe-avant-1280-viewport.png | 104 367 |
| bon-signe-apres-1280-viewport.png | 106 784 |
| bon-signe-avant-impression.png | 86 907 |
| bon-signe-apres-impression.png | 90 028 |

L'écart se lit déjà dans la taille des rendus imprimés : le bon NON SIGNÉ
PERD des octets à l'impression (la tuile signataire vide ne s'imprime plus,
point 3) ; le bon SIGNÉ en GAGNE (la date de l'en-tête et la ligne
« Technicien » s'y ajoutent, points 1 et 2).

## Points ouverts

Aucun. Le territoire du ticket (`bon/page.tsx`, `lib/interventions/bon.ts`,
`lib/i18n/fr.ts`, leurs épreuves, `docs/propositions/9I7C-BON-RESERVES-DE-REVUE/`)
est intégralement couvert ; rien n'a débordé sur `lib/interventions/profil-bon.ts`
(ordre des tuiles inchangé) ni sur la fiche intervention.

**Un écart à la discipline « un commit par point »**, signalé plutôt que
caché : les points 1 et 2 sont entrelacés dans `bon.ts`/`bon/page.tsx` (mêmes
fonctions, mêmes blocs) et sont partis dans UN SEUL commit
(`41414fb93`) plutôt que deux ; le point 3, lui, est bien séparé
(`da8197ec0`).
