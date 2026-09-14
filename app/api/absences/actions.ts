import { champ } from "../interventions/actions";

/**
 * LE SOCLE DES DEUX ROUTES D'ABSENCE (R3-14).
 *
 * ## Ce que le retour porte, et pourquoi il le porte
 *
 * Valider une absence **rend des interventions à la file** et peut **rompre le
 * service** d'une agence. `deciderAbsence` le dit dans la transaction qui l'a
 * fait, **nommément** — et cette réponse doit atteindre l'écran.
 *
 * Elle voyage donc dans l'URL de retour, sous la forme d'identifiants. **Ce ne
 * sont pas des noms** : l'écran les résout sous le contexte cloisonné, et un
 * identifiant forgé qui désignerait autre chose ne rend simplement aucune ligne.
 * *Recalculer le verdict à l'affichage aurait été la vraie faute* — deux
 * lectures d'un même critère, dont la seconde sans l'effectif sous les yeux
 * (§9, 01/09).
 */

/** Ce que l'écran doit afficher après une décision. */
export type Retombees = {
  readonly rendues: readonly string[];
  readonly rompues: readonly string[];
};

const SEPARATEUR = ",";

/** Retour vers l'écran des absences, avec son motif et ses retombées. */
export function versLesAbsences(cle?: string, retombees?: Retombees): Response {
  const parametres = new URLSearchParams();
  if (cle !== undefined) {
    parametres.set("motif", cle);
  }
  if (retombees !== undefined && retombees.rendues.length > 0) {
    parametres.set("rendues", retombees.rendues.join(SEPARATEUR));
  }
  if (retombees !== undefined && retombees.rompues.length > 0) {
    parametres.set("rompues", retombees.rompues.join(SEPARATEUR));
  }
  const suffixe = parametres.size === 0 ? "" : `?${parametres.toString()}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/absences${suffixe}` },
  });
}

/** Une liste d'identifiants lue depuis l'URL — vide plutôt que devinée. */
export function identifiants(brut: string | undefined): readonly string[] {
  if (brut === undefined || brut.trim().length === 0) {
    return [];
  }
  return brut
    .split(SEPARATEUR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Une journée civile lue depuis un `<input type="date">`, en UTC.
 *
 * **Jamais par un `Date` local** : sous UTC+11 le jour se décale d'un cran, et
 * une absence déclarée le 14 se rangerait au 13 (L0-08). C'est la même règle que
 * celle de la grammaire d'import, pour la même raison.
 */
export function jourCivil(formulaire: FormData, nom: string): Date | null {
  const brut = champ(formulaire, nom);
  if (brut === null) {
    return null;
  }
  const forme = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(brut);
  if (forme === null) {
    return null;
  }
  const jour = new Date(`${brut}T00:00:00.000Z`);
  return Number.isNaN(jour.getTime()) ? null : jour;
}
