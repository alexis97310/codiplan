import { describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { accesAuxMontants } from "@/lib/interventions/montants-visibles";
import { versionDuBon } from "@/lib/interventions/version-bon";

/**
 * LE CHOIX DE VERSION DU BON — huit rôles de la matrice `voir_montants_vente`
 * (`lib/auth/habilitations.ts:183`) croisés avec six formes que `?version=`
 * peut réellement porter dans un `searchParams` Next.js.
 *
 * Le premier `it.each` est un TÉMOIN (même raison qu'à
 * `montants-visibles.test.ts`) : sans lui, les scénarios suivants
 * resteraient verts même si la matrice citée ici avait divergé de celle que
 * `accesAuxMontants` applique réellement.
 */
const PARAMETRES: readonly (string | string[] | undefined)[] = [
  undefined,
  "interne",
  "client",
  ["interne"],
  "INTERNE",
  "",
];

// « $role » dans les titres ci-dessous imprime la VALEUR de l'enum au moment
// du test, jamais un littéral écrit à la main : le gardien
// `roles-sans-chaine-libre.test.ts` refuse qu'un nom de rôle soit recopié en
// chaîne, et la seule exception close (`client`, `technicien`) ne couvre pas
// les six autres noms de cette matrice.
const ROLES_DE_LA_MATRICE = [
  { role: Role.direction, montre: true },
  { role: Role.responsable_materiel, montre: true },
  { role: Role.responsable_sav, montre: true },
  { role: Role.adv, montre: true },
  { role: Role.admin_societe, montre: false },
  { role: Role.technicien, montre: false },
  { role: Role.client, montre: false },
  { role: null, montre: false },
] as const;

describe("versionDuBon", () => {
  it.each(ROLES_DE_LA_MATRICE)(
    "TÉMOIN — le rôle $role voit les montants de vente = $montre",
    ({ role, montre }) => {
      expect(accesAuxMontants(role).montre).toBe(montre);
    },
  );

  describe.each(ROLES_DE_LA_MATRICE)("rôle $role", ({ montre }) => {
    it.each(PARAMETRES)("version=%j", (parametre) => {
      const attendu = montre && parametre === "interne" ? "interne" : "client";
      expect(versionDuBon(parametre, montre)).toBe(attendu);
    });
  });
});
