import { z } from "zod";

/** Un identifiant d'URL, valide ou non — jamais transmis tel quel à la base. */
export function estUuid(valeur: string): boolean {
  return z.uuid().safeParse(valeur).success;
}
