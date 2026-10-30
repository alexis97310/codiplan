import { describe, expect, it } from "vitest";

import type { ContexteActif } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  MENTIONS_LEGALES_MAX,
  enregistrerAfficherMontants,
  enregistrerMentionsLegales,
  sigleDeLaRaisonSociale,
} from "@/lib/societes/identite";

function contexte(role: Role): ContexteActif {
  return {
    utilisateurId: "aaaaaaaa-0000-7000-8000-000000000099",
    societeId: "aaaaaaaa-0000-7000-8000-000000000001",
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

/**
 * LE SIGLE DE LA PASTILLE (9EWD1-PARAMETRES-HUB-SOLDE, M:4358) — dérivé des
 * initiales de la raison sociale, jamais saisi.
 */
describe("sigleDeLaRaisonSociale (carte « Identité » du hub de paramétrage)", () => {
  it("deux mots ou plus : l'initiale des deux premiers", () => {
    expect(sigleDeLaRaisonSociale("CODIMA Nouvelle-Calédonie")).toBe("CN");
  });

  it("un seul mot : ses deux premiers caractères", () => {
    expect(sigleDeLaRaisonSociale("CODIMA")).toBe("CO");
  });

  it("toujours en capitales, même une raison sociale saisie en minuscules", () => {
    expect(sigleDeLaRaisonSociale("acme services")).toBe("AS");
    expect(sigleDeLaRaisonSociale("acme")).toBe("AC");
  });

  it("espaces multiples ou en tête/fin : ignorés, comme un seul séparateur", () => {
    expect(sigleDeLaRaisonSociale("  CODIMA   Nord  ")).toBe("CN");
  });

  it("chaîne vide : un sigle vide, jamais une exception", () => {
    expect(sigleDeLaRaisonSociale("")).toBe("");
    expect(sigleDeLaRaisonSociale("   ")).toBe("");
  });
});

/**
 * `enregistrerMentionsLegales` — REFUS JUGÉS SANS TOUCHER LA BASE (capacité,
 * taille). Le chemin `ok: true`, qui écrit en base sous RLS, est éprouvé par
 * `tests/isolation/mentions-legales-societe.test.ts`, même répartition que
 * `tests/unit/societes/logo.test.ts` / `tests/isolation/logo-societe.test.ts`.
 */
describe("enregistrerMentionsLegales — refuse avant d'écrire quoi que ce soit", () => {
  it("refuse un rôle sans la capacité parametrer_societe", async () => {
    const resultat = await enregistrerMentionsLegales(
      contexte(Role.adv),
      "CODIMA",
    );
    expect(resultat).toEqual({
      ok: false,
      motif: "mentions_legales.refus.droit",
    });
  });

  it("refuse un texte de plus de 1 000 caractères", async () => {
    const trop = "a".repeat(MENTIONS_LEGALES_MAX + 1);
    const resultat = await enregistrerMentionsLegales(
      contexte(Role.admin_societe),
      trop,
    );
    expect(resultat).toEqual({
      ok: false,
      motif: "mentions_legales.refus.taille",
    });
  });

  it("un rôle sans droit l'emporte même sur un texte trop long — le motif le plus utile d'abord", async () => {
    const trop = "a".repeat(MENTIONS_LEGALES_MAX + 1);
    const resultat = await enregistrerMentionsLegales(contexte(Role.adv), trop);
    expect(resultat).toEqual({
      ok: false,
      motif: "mentions_legales.refus.droit",
    });
  });

  // (point 3, 9I7D) — un octet NUL ou un caractère de contrôle refuse,
  // maîtrisé, AVANT toute écriture — jamais l'erreur 500 que PostgreSQL
  // renverrait pour l'octet NUL dans une colonne texte.
  it("refuse un octet NUL", async () => {
    const resultat = await enregistrerMentionsLegales(
      contexte(Role.admin_societe),
      "Avant\u0000Après",
    );
    expect(resultat).toEqual({
      ok: false,
      motif: "mentions_legales.refus.caracteres",
    });
  });

  it("refuse un caractère de contrôle C0 (hors tabulation et retour à la ligne)", async () => {
    const resultat = await enregistrerMentionsLegales(
      contexte(Role.admin_societe),
      "Avant\u0007Après",
    );
    expect(resultat).toEqual({
      ok: false,
      motif: "mentions_legales.refus.caracteres",
    });
  });
});

/**
 * `enregistrerAfficherMontants` — même répartition que ci-dessus : le chemin
 * `ok: true`, qui écrit en base sous RLS, est éprouvé par
 * `tests/isolation/afficher-montants-societe.test.ts`.
 */
describe("enregistrerAfficherMontants — refuse avant d'écrire quoi que ce soit", () => {
  it("refuse un rôle sans la capacité parametrer_societe", async () => {
    const resultat = await enregistrerAfficherMontants(
      contexte(Role.adv),
      false,
    );
    expect(resultat).toEqual({
      ok: false,
      motif: "afficher_montants.refus.droit",
    });
  });

  it("un rôle restreint (technicien) est refusé de la même façon", async () => {
    const resultat = await enregistrerAfficherMontants(
      contexte(Role.technicien),
      true,
    );
    expect(resultat).toEqual({
      ok: false,
      motif: "afficher_montants.refus.droit",
    });
  });
});
