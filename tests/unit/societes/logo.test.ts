import { describe, expect, it } from "vitest";

import type { ContexteActif } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  TAILLE_MAX_LOGO_OCTETS,
  enregistrerLogo,
  retirerLogo,
} from "@/lib/societes/logo";

/**
 * Les refus qui se jugent SANS toucher la base — capacité, vide, taille,
 * type — sont éprouvés ici. Le dépôt RÉEL (le chemin `ok: true`, qui écrit en
 * base sous RLS) est éprouvé par `tests/isolation/logo-societe.test.ts`.
 */

const PNG_MINIMAL = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

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

describe("enregistrerLogo — refuse avant d'écrire quoi que ce soit", () => {
  it("refuse un rôle sans la capacité parametrer_societe", async () => {
    const resultat = await enregistrerLogo(contexte(Role.adv), PNG_MINIMAL);
    expect(resultat).toEqual({ ok: false, motif: "logo.refus.droit" });
  });

  it("refuse un fichier vide", async () => {
    const resultat = await enregistrerLogo(
      contexte(Role.admin_societe),
      Buffer.alloc(0),
    );
    expect(resultat).toEqual({ ok: false, motif: "logo.refus.vide" });
  });

  it("refuse un fichier au-delà de 300 Ko", async () => {
    const trop = Buffer.concat([
      PNG_MINIMAL,
      Buffer.alloc(TAILLE_MAX_LOGO_OCTETS),
    ]);
    const resultat = await enregistrerLogo(contexte(Role.admin_societe), trop);
    expect(resultat).toEqual({ ok: false, motif: "logo.refus.taille" });
  });

  it("refuse un type non reconnu à ses octets — un SVG, par exemple", async () => {
    const svg = Buffer.from("<svg></svg>");
    const resultat = await enregistrerLogo(contexte(Role.admin_societe), svg);
    expect(resultat).toEqual({ ok: false, motif: "logo.refus.type" });
  });

  it("refuse un texte renommé .png — l'extension ne suffit pas", async () => {
    const fauxPng = Buffer.from("ceci n'est pas une image");
    const resultat = await enregistrerLogo(
      contexte(Role.admin_societe),
      fauxPng,
    );
    expect(resultat).toEqual({ ok: false, motif: "logo.refus.type" });
  });
});

describe("retirerLogo — même garde de capacité", () => {
  it("refuse un rôle sans la capacité parametrer_societe", async () => {
    const resultat = await retirerLogo(contexte(Role.adv));
    expect(resultat).toEqual({ ok: false, motif: "logo.refus.droit" });
  });
});
