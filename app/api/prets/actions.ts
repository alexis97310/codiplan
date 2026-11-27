import { champ } from "../interventions/actions";

export { champ };

/**
 * LE SOCLE COMMUN AUX DEUX ROUTES DU PRÊT (sortie, retour) — un jour civil
 * `@db.Date`, lu en UTC, jamais par un `Date` local (L0-08) : même pattern
 * que `app/api/absences/actions.ts#jourCivil`, propre à ce module pour la
 * même raison que ses autres copies (§9, 01/09 : une abstraction partagée ne
 * vaudrait pas trois lignes).
 */
export function jourCivilPret(formulaire: FormData, nom: string): Date | null {
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
