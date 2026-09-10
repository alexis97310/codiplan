import { describe, expect, it } from "vitest";

import {
  COMPTES_PORTAIL,
  DEVISES,
  FAMILLES_HABILITATION,
  HABILITATIONS_AMORCAGE,
  INTERVENTIONS_DEMONSTRATION,
  PARITES,
  SOCIETES,
  UTILISATEURS_INTERNES,
  identifiantIntervention,
} from "@/prisma/seed-data";
import { Role } from "@prisma/client";

/**
 * Critères d'acceptation du ticket L0-03 : le seed crée deux sociétés — l'une
 * en XPF avec trois agences (Ducos, Koné, Dolbeau), l'autre en EUR — et au
 * moins un compte portail rattaché à un client (D5, D10).
 *
 * Le test porte sur les données pures, indépendamment de la base : il vérifie
 * l'intention du seed, que `pnpm db:seed` matérialise ensuite via Prisma.
 */
describe("jeu de données du socle multi-société", () => {
  it("déclare XPF sans décimale et sans symbole, EUR à deux décimales (I3, D19)", () => {
    const xpf = DEVISES.find((d) => d.code === "XPF");
    const eur = DEVISES.find((d) => d.code === "EUR");

    expect(xpf).toBeDefined();
    expect(xpf?.decimales).toBe(0);
    expect(xpf?.symbole).toBeNull();

    expect(eur).toBeDefined();
    expect(eur?.decimales).toBe(2);
    expect(eur?.symbole).toBe("€");
  });

  it("crée exactement deux sociétés, l'une en XPF, l'autre en EUR", () => {
    expect(SOCIETES).toHaveLength(2);

    const parDevise = SOCIETES.filter((s) => s.devise_code === "XPF");
    expect(parDevise).toHaveLength(1);
    expect(SOCIETES.filter((s) => s.devise_code === "EUR")).toHaveLength(1);
  });

  it("dote la société XPF de trois agences : Ducos, Koné, Dolbeau (D5)", () => {
    const societeXpf = SOCIETES.find((s) => s.devise_code === "XPF");
    expect(societeXpf).toBeDefined();

    const codes = societeXpf?.agences.map((a) => a.code).sort();
    expect(codes).toEqual(["DOLBEAU", "DUCOS", "KONE"]);
  });

  it("rattache toute devise de société à une devise déclarée", () => {
    const codesDevise = new Set(DEVISES.map((d) => d.code));
    for (const societe of SOCIETES) {
      expect(codesDevise.has(societe.devise_code)).toBe(true);
    }
  });

  it("crée au moins un compte portail rattaché à un client (D10)", () => {
    expect(COMPTES_PORTAIL.length).toBeGreaterThanOrEqual(1);

    const codesSociete = new Set(SOCIETES.map((s) => s.code));
    for (const compte of COMPTES_PORTAIL) {
      expect(compte.client_id.length).toBeGreaterThan(0);
      expect(codesSociete.has(compte.societe_code)).toBe(true);
    }
  });

  it("amorce la parité légale fixe : 1 EUR = 119,331740 XPF (D20)", () => {
    const parite = PARITES.find((p) => p.devise_code === "XPF");
    expect(parite).toBeDefined();
    // Taux porté par la ligne XPF, lu « XPF pour 1 EUR » (base EUR).
    expect(parite?.taux).toBe("119.331740");
    // Date d'effet de la parité légale (introduction de l'euro).
    expect(parite?.date_effet).toBe("1999-01-01");
    expect(parite?.source).toBe("parité légale fixe");

    // Toute parité pointe une devise déclarée du référentiel.
    const codesDevise = new Set(DEVISES.map((d) => d.code));
    for (const p of PARITES) {
      expect(codesDevise.has(p.devise_code)).toBe(true);
    }
  });

  it("garde les comptes portail exclusifs des habilitations internes (D10)", () => {
    const emailsInternes = new Set(UTILISATEURS_INTERNES.map((u) => u.email));
    for (const compte of COMPTES_PORTAIL) {
      expect(emailsInternes.has(compte.email)).toBe(false);
    }
  });
});

/**
 * L'AMORÇAGE DES HABILITATIONS COUVRE LES TROIS FAMILLES SUIVIES (L1-04b).
 *
 * **Ce que ce gardien attrape, et il ne l'attrape que parce que la famille est
 * écrite.** Une liste amorcée sur l'électrique seul se lit comme un catalogue
 * complet : elle n'est pas vide, aucun décompte ne rougit, et personne ne
 * s'aperçoit que deux tiers du métier manquent. *Un décompte non nul ressemble
 * beaucoup trop à des données justes* (§9, 21/08). La famille n'existe donc pas
 * pour classer — elle existe pour rendre l'incomplétude VISIBLE.
 *
 * **Et les durées de validité restent NULLES, par décision.** La périodicité de
 * recyclage est une pratique d'entreprise, pas un chiffre de la norme (D60,
 * CLAUDE.md §8). Le gardien l'exige plutôt que de la subir : le jour où une
 * session « rendrait service » en écrivant douze ou vingt-quatre mois, elle
 * inventerait une valeur métier que personne n'a arbitrée, et RG-PLA-04
 * refuserait des affectations sur une expiration fabriquée.
 */
describe("l'amorçage des habilitations (L1-04b, D60)", () => {
  it("les TROIS familles sont peuplées — aucune ne peut rester vide", () => {
    for (const famille of FAMILLES_HABILITATION) {
      const entrees = HABILITATIONS_AMORCAGE.filter(
        (habilitation) => habilitation.famille === famille,
      );
      expect(
        entrees.length,
        `la famille « ${famille} » n'est pas amorcée : une société qui s'ouvre ` +
          "recevrait un catalogue qui a l'air complet et ne l'est pas.",
      ).toBeGreaterThan(0);
    }
  });

  it("et aucune famille inconnue ne s'y glisse — la liste est close des deux côtés", () => {
    const connues = new Set<string>(FAMILLES_HABILITATION);
    const inconnues = HABILITATIONS_AMORCAGE.filter(
      (habilitation) => !connues.has(habilitation.famille),
    );
    expect(inconnues).toEqual([]);
  });

  it("les codes sont uniques — la clé (societe_id, code) le refuserait", () => {
    const codes = HABILITATIONS_AMORCAGE.map(
      (habilitation) => habilitation.code,
    );
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("aucune entrée ne porte de durée de validité — on n'invente pas un délai", () => {
    // Le type ne PORTE pas ce champ, et c'est la forme la plus forte du refus :
    // il n'y a pas de valeur à mettre à `null`, il n'y a rien du tout. Ce test
    // le constate sur les objets réels, pour que le retirer du type ne suffise
    // pas à faire passer un ajout par une autre porte.
    for (const habilitation of HABILITATIONS_AMORCAGE) {
      expect(Object.keys(habilitation).sort()).toEqual([
        "code",
        "famille",
        "libelle",
      ]);
    }
  });

  it("le gardien a bien regardé quelque chose — témoin de non-vacuité", () => {
    expect(HABILITATIONS_AMORCAGE.length).toBeGreaterThanOrEqual(
      FAMILLES_HABILITATION.length * 2,
    );
  });
});

describe("la démonstration garnit le planning de CHAQUE société", () => {
  /**
   * **Décision d'exploitation du 10/09/2026.** Les identifiants des
   * interventions de démonstration étaient FIXES : la première société les
   * prenait tous, la seconde trouvait chaque ligne écrite et s'abstenait —
   * *« 0 écrite(s) sur 6 prévue(s) »*, à chaque exécution du flux de migration,
   * dans un journal que personne n'a lu comme un défaut.
   *
   * Ce que ce gardien tient, et que le refus posé dans le seed ne tient pas
   * seul : il rougit **sans base**, donc au moment où quelqu'un écrit la
   * collision, et non le jour où il fait tourner une migration.
   */
  it("donne à chaque société une plage d'identifiants qui n'en rencontre aucune autre", () => {
    const tous = SOCIETES.flatMap((_, index) =>
      INTERVENTIONS_DEMONSTRATION.map((modele) =>
        identifiantIntervention(index + 1, modele.rang),
      ),
    );
    expect(tous).toHaveLength(
      SOCIETES.length * INTERVENTIONS_DEMONSTRATION.length,
    );
    expect(new Set(tous).size).toBe(tous.length);
    // Témoin : deux sociétés au moins, sinon la propriété est vide de sens.
    expect(SOCIETES.length).toBeGreaterThanOrEqual(2);
  });

  it("laisse à la PREMIÈRE société ses identifiants historiques", () => {
    // Sans cette continuité, la base hébergée porterait douze lignes de
    // démonstration : six anciennes devenues orphelines et six nouvelles.
    expect(identifiantIntervention(1, 1)).toBe(
      "0192f0a0-6000-7000-8000-000000000001",
    );
    expect(identifiantIntervention(1, 6)).toBe(
      "0192f0a0-6000-7000-8000-000000000006",
    );
    // …et la seconde n'en approche pas.
    expect(identifiantIntervention(2, 1)).toBe(
      "0192f0a0-6000-7000-8000-000000000101",
    );
  });

  it("donne à chaque société de quoi accrocher ses six interventions", () => {
    // Le seed rattache l'intervention de rang N au site N modulo le nombre de
    // sites : une société sans site n'en reçoit aucune, et son planning reste
    // vide. C'est la moitié du défaut que le compte fixe masquait.
    for (const societe of SOCIETES) {
      const sites = societe.clients.flatMap((client) => client.sites);
      expect(sites.length).toBeGreaterThan(0);
      expect(societe.clients.length).toBeGreaterThan(0);
    }
  });

  it("donne un technicien à chaque société — un planning sans personne ne démontre rien", () => {
    for (const societe of SOCIETES) {
      const techniciens = UTILISATEURS_INTERNES.filter((utilisateur) =>
        utilisateur.habilitations.some(
          (habilitation) =>
            habilitation.societe_code === societe.code &&
            habilitation.role === Role.technicien,
        ),
      );
      expect(techniciens.length).toBeGreaterThan(0);
    }
  });
});
