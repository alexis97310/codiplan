import { describe, expect, it } from "vitest";

import { Role, ROLES } from "@/lib/auth/roles";
import { niveau } from "@/lib/auth/habilitations";
import { accesAuxMontants } from "@/lib/interventions/montants-visibles";
import { estCleTraduction } from "@/lib/i18n/fr";

/**
 * LA LIGNE « VOIR LES MONTANTS DE VENTE », ENFIN LUE PAR UN ÉCRAN.
 *
 * Ce fichier éprouve les DEUX directions du prédicat (§9, 11/09) : il refuse à
 * qui doit être refusé, et **il reste vert POUR SA PROPRE RAISON** sur qui doit
 * passer. La seconde est celle qui ne produit jamais de signal, et c'est elle
 * qu'on oublie d'écrire.
 *
 * La population est DÉRIVÉE de l'énumération des rôles et de la matrice, jamais
 * d'une liste tenue à la main : un onzième rôle écrit demain y entre de
 * lui-même, et le scénario qui compte — *le module dit exactement ce que la
 * matrice dit* — ne peut pas se périmer en silence.
 */
describe("l'accès aux montants de vente", () => {
  it("TÉMOIN — la matrice distingue réellement deux groupes de rôles", () => {
    // Sans ce témoin, les deux scénarios suivants seraient verts sur une
    // matrice qui accorderait tout à tout le monde, ou rien à personne : un
    // ensemble vide passe n'importe quelle assertion universelle.
    const montrent = ROLES.filter((r) => accesAuxMontants(r).montre);
    const refuses = ROLES.filter((r) => !accesAuxMontants(r).montre);
    expect(montrent.length).toBeGreaterThan(0);
    expect(refuses.length).toBeGreaterThan(0);
  });

  it("REFUSE `admin_societe` — c'est la ligne que D37 lui retire", () => {
    const acces = accesAuxMontants(Role.admin_societe);
    expect(acces.montre).toBe(false);
    if (acces.montre) return;
    // Le motif est une CLÉ du dictionnaire et non une phrase : ce qu'un humain
    // lit ne s'écrit qu'à `lib/i18n/fr.ts` (§5 de CLAUDE.md, L0-11).
    expect(estCleTraduction(acces.cle)).toBe(true);
  });

  it("MONTRE à la direction — le cas qui doit rester vert, et pour SA raison", () => {
    // *Et c'est la moitié qui compte pour la démonstration* : si ce scénario
    // tombait, les montants auraient disparu de l'application pour tout le
    // monde, ce qui n'a été demandé par personne.
    expect(accesAuxMontants(Role.direction).montre).toBe(true);
    expect(niveau(Role.direction, "voir_montants_vente")).not.toBe("aucun");
  });

  it("REFUSE le compte de PORTAIL — arbitrage 3.8, aucun montant en V1", () => {
    expect(accesAuxMontants(Role.client).montre).toBe(false);
  });

  it("REFUSE le technicien — la matrice ne lui donne pas cette ligne", () => {
    expect(accesAuxMontants(Role.technicien).montre).toBe(false);
  });

  it("REFUSE un rôle ABSENT — « elle ne dit rien » ne se lit pas « elle autorise »", () => {
    expect(accesAuxMontants(null).montre).toBe(false);
  });

  it.each(ROLES)(
    "%s — le module dit EXACTEMENT ce que la matrice dit, jamais une recopie",
    (role) => {
      // *Deux lectures d'un même critère divergent en silence* (§9, 01/09).
      // Celle-ci est la seule, et ce scénario le prouve rôle par rôle plutôt
      // que de l'affirmer : si quelqu'un écrivait ici `role === admin_societe`,
      // il tomberait au premier rôle que la matrice change.
      expect(accesAuxMontants(role).montre).toBe(
        niveau(role, "voir_montants_vente") !== "aucun",
      );
    },
  );
});
