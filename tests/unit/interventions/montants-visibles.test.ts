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
 *
 * Tous les scénarios de rôle appellent `accesAuxMontants(role, true)` — le
 * réglage de société ACTIVÉ, pour isoler la matrice de rôle du réglage,
 * éprouvé séparément plus bas (9I8-AFFICHAGE-DES-MONTANTS).
 */
describe("l'accès aux montants de vente", () => {
  it("TÉMOIN — la matrice distingue réellement deux groupes de rôles", () => {
    // Sans ce témoin, les deux scénarios suivants seraient verts sur une
    // matrice qui accorderait tout à tout le monde, ou rien à personne : un
    // ensemble vide passe n'importe quelle assertion universelle.
    const montrent = ROLES.filter((r) => accesAuxMontants(r, true).montre);
    const refuses = ROLES.filter((r) => !accesAuxMontants(r, true).montre);
    expect(montrent.length).toBeGreaterThan(0);
    expect(refuses.length).toBeGreaterThan(0);
  });

  it("REFUSE `admin_societe` — c'est la ligne que D37 lui retire", () => {
    const acces = accesAuxMontants(Role.admin_societe, true);
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
    expect(accesAuxMontants(Role.direction, true).montre).toBe(true);
    expect(niveau(Role.direction, "voir_montants_vente")).not.toBe("aucun");
  });

  it("REFUSE le compte de PORTAIL — arbitrage 3.8, aucun montant en V1", () => {
    expect(accesAuxMontants(Role.client, true).montre).toBe(false);
  });

  it("REFUSE le technicien — la matrice ne lui donne pas cette ligne", () => {
    expect(accesAuxMontants(Role.technicien, true).montre).toBe(false);
  });

  it("REFUSE un rôle ABSENT — « elle ne dit rien » ne se lit pas « elle autorise »", () => {
    expect(accesAuxMontants(null, true).montre).toBe(false);
  });

  it.each(ROLES)(
    "%s — le module dit EXACTEMENT ce que la matrice dit, jamais une recopie",
    (role) => {
      // *Deux lectures d'un même critère divergent en silence* (§9, 01/09).
      // Celle-ci est la seule, et ce scénario le prouve rôle par rôle plutôt
      // que de l'affirmer : si quelqu'un écrivait ici `role === admin_societe`,
      // il tomberait au premier rôle que la matrice change.
      expect(accesAuxMontants(role, true).montre).toBe(
        niveau(role, "voir_montants_vente") !== "aucun",
      );
    },
  );
});

/**
 * LE RÉGLAGE DE SOCIÉTÉ PASSE AVANT LE RÔLE (9I8-AFFICHAGE-DES-MONTANTS,
 * demande d'Alexis du 28/10/2026, option A) — un interrupteur général, pas
 * une ligne de plus dans la matrice.
 */
describe("accesAuxMontants — le réglage de société désactivé l'emporte sur tout rôle", () => {
  it.each(ROLES)(
    "%s — désactivé, le motif est « désactivé par société », jamais « sans droit »",
    (role) => {
      const acces = accesAuxMontants(role, false);
      expect(acces.montre).toBe(false);
      if (acces.montre) return;
      expect(acces.cle).toBe("intervention.valorisation.desactive_par_societe");
    },
  );

  it("désactivé, même la direction — qui a le droit — ne voit rien", () => {
    expect(accesAuxMontants(Role.direction, false)).toEqual({
      montre: false,
      cle: "intervention.valorisation.desactive_par_societe",
    });
  });

  it("désactivé ET un rôle absent : le motif reste celui du réglage, pas « sans droit »", () => {
    expect(accesAuxMontants(null, false)).toEqual({
      montre: false,
      cle: "intervention.valorisation.desactive_par_societe",
    });
  });

  it("réactivé, un rôle sans droit retrouve SON motif (sans_droit), pas celui du réglage", () => {
    expect(accesAuxMontants(Role.admin_societe, true)).toEqual({
      montre: false,
      cle: "intervention.valorisation.sans_droit",
    });
  });
});
