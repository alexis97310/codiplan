import { schemaTerritoire } from "@/lib/calendar";

export { SOCIETES } from "@/prisma/seed-data";

/** Le territoire est-il un code ISO 3166-1 alpha-2 bien formé ? */
export function schemaTerritoireValide(valeur: string): boolean {
  return schemaTerritoire.safeParse(valeur).success;
}
