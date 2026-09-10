/**
 * Le lecteur du schéma Prisma a DÉMÉNAGÉ dans `scripts/lib/schema-prisma.ts`
 * le 10/09/2026.
 *
 * Ce fichier n'est plus qu'une porte : les gardiens statiques continuent de
 * l'importer d'ici, et les scripts d'exploitation lisent la même source. Une
 * seconde implémentation du lecteur serait exactement la faute du §9
 * (01/09) — deux lectures d'un même critère, qui divergent en silence.
 */
export {
  FICHIER_SCHEMA,
  champsDuModele,
  corpsDuModele,
  declarationsDuModele,
  lireSchema,
  modelesDuSchema,
  observeesDuSchema,
  type ModelePrisma,
} from "../../../scripts/lib/schema-prisma";
