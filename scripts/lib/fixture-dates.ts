/**
 * CE QUE LA FIXTURE DE DATES CONTIENT — écrit UNE FOIS (9L00 ; I9).
 *
 * ## Pourquoi cette fixture a changé de nature
 *
 * `tests/fixtures/dates-excel.xlsx` a longtemps été *« tirée PAR RETRAIT »* du
 * classeur réel de l'exploitation (D90) : la structure survivait, et avec elle
 * — mesuré le 10/11/2026 — environ 4 390 dates réelles et les volumes du
 * classeur réel (293 lignes sur l'onglet du parc). I9 ne distingue pas la
 * donnée métier de la donnée de structure : une date d'intervention réelle est
 * une donnée de production, retrait ou non. **Décision d'Alexis du
 * 10/11/2026 (D244)** : la fixture est désormais entièrement INVENTÉE, comme
 * `scripts/lib/classeur-epreuve.ts` l'est déjà pour les classeurs clients.
 *
 * ## Ce que cette décision NE garde PAS
 *
 * L'ancienne fixture avait une seconde vertu, documentée dans
 * `scripts/lib/archive-zip.ts` : être un fichier qu'Excel a réellement produit,
 * et que ce dépôt ne contrôle pas — un TÉMOIN indépendant pour le lecteur
 * d'archive strict. Une fixture CALCULÉE n'a aucune provenance : elle ne peut
 * plus servir ce second rôle, et `tests/unit/imports/classeur-fabrique.test.ts`
 * ne le lui demande plus. *C'est la contradiction de ce ticket, écrite plutôt
 * que cachée* : I9 l'exige pour un dépôt public, au prix de ce témoin.
 *
 * ## Pourquoi ces valeurs vivent ici et non dans le script qui les écrit
 *
 * Deux lecteurs en ont besoin : le script qui fabrique le classeur, et les
 * épreuves qui vérifient ce qu'il contient. *Deux recopies de la même donnée,
 * et rien ne les confronterait* (§9, 01/09).
 *
 * ## LES DATES SONT INVENTÉES, ET DÉLIBÉRÉMENT PETITES
 *
 * Elles couvrent les mêmes cas que l'ancienne mesure sans en reprendre une
 * seule valeur : une date ancienne, deux dates portées sur deux feuilles à la
 * fois (comme un événement du parc répété à l'historique), une date récente, et
 * une cellule à ZÉRO — le cas qui n'est pas une date (D31, `lireDate`).
 */

export const CHEMIN_FIXTURE_DATES = "tests/fixtures/dates-excel.xlsx";

/** Les cinq feuilles de la fixture — deux sont vides, par construction. */
export const FEUILLES_FIXTURE_DATES = [
  "1-Demandes SAV",
  "2-Divers",
  "3-Parc machines",
  "5-Observations VGP",
  "6-Historique",
] as const;

/** Les deux feuilles qui ne portent AUCUNE cellule — la forme la plus simple. */
export const FEUILLES_VIDES: readonly string[] = ["1-Demandes SAV", "2-Divers"];

/**
 * LES CELLULES RELEVÉES, chacune vérifiée plutôt que recalculée.
 *
 * Deux serials sont portés par DEUX feuilles à la fois — « 3-Parc machines » et
 * « 6-Historique » —, comme l'ancienne mesure le faisait pour un événement du
 * parc répété à l'historique ; un serial n'est porté qu'une fois, sur la feuille
 * la plus ancienne ; un dernier n'est porté qu'une fois, sur la plus récente.
 */
export const RELEVE_FIXTURE_DATES = [
  {
    serie: 42053,
    feuille: "5-Observations VGP",
    ref: "B2",
    jour: "2015-02-18",
  },
  { serie: 43534, feuille: "3-Parc machines", ref: "C3", jour: "2019-03-10" },
  { serie: 43534, feuille: "6-Historique", ref: "D3", jour: "2019-03-10" },
  { serie: 44399, feuille: "3-Parc machines", ref: "C4", jour: "2021-07-22" },
  { serie: 44399, feuille: "6-Historique", ref: "D4", jour: "2021-07-22" },
  { serie: 47427, feuille: "3-Parc machines", ref: "C5", jour: "2029-11-05" },
] as const;

/** La cellule à ZÉRO — une ABSENCE, jamais le 30 décembre 1899. */
export const REF_ZERO = { feuille: "3-Parc machines", ref: "C2" } as const;

/**
 * Les cellules à écrire par feuille, dérivées de `RELEVE_FIXTURE_DATES` et de
 * `REF_ZERO` — jamais recopiées à côté. `lignes` est le plus grand numéro de
 * ligne écrit sur la feuille, pour que le script sache jusqu'où compter.
 */
export function cellulesParFeuille(
  feuille: string,
): ReadonlyArray<{ readonly ref: string; readonly serie: number }> {
  const cellules: { ref: string; serie: number }[] = [];
  if (REF_ZERO.feuille === feuille) {
    cellules.push({ ref: REF_ZERO.ref, serie: 0 });
  }
  for (const releve of RELEVE_FIXTURE_DATES) {
    if (releve.feuille === feuille) {
      cellules.push({ ref: releve.ref, serie: releve.serie });
    }
  }
  return cellules;
}
