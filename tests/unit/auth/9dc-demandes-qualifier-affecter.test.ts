import { describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { type SessionServeur } from "@/lib/auth/session";

/**
 * D151 (03/10/2026, décision du 03/10 point 3) — LES QUATRE ACTIONS D'UNE
 * DEMANDE PASSENT SOUS `qualifier_affecter`.
 *
 * `tests/unit/auth/porte.test.ts` (`ROUTE_CAPACITE`) prouve statiquement que
 * les quatre routes (`accuser`, `qualifier`, `transformer`, `clore`)
 * appellent désormais `exigerCapacite("qualifier_affecter")`. Ce fichier
 * prouve l'autre moitié, mesurée par le ticket : un technicien ET un
 * client — les deux rôles qui gardent `creer_demande` sans jamais avoir eu
 * `qualifier_affecter` — sont refusés ; une ADV, qui l'a, passe.
 *
 * **R5 (addendum 9DN, relecture 9DX)** — cette en-tête ne citait que le
 * technicien alors que le cas CLIENT (ci-dessous) a été ajouté depuis : un
 * en-tête qui ne nomme pas tous les rôles mesurés apprend à ne lire que la
 * moitié du fichier.
 */

const SOCIETE = "0192f0a0-1000-7000-8000-0000000009dc";
const UTILISATEUR = "0192f0a0-1000-7000-8000-00000000d9dc";

function contexte(surcharge: Partial<ContexteSession> = {}): ContexteSession {
  return {
    utilisateurId: UTILISATEUR,
    societeId: SOCIETE,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
    ...surcharge,
  };
}

function sessionFabriquee(surcharge: Partial<ContexteSession> = {}) {
  return async (): Promise<SessionServeur> => ({
    jetonSession: "jeton-de-test",
    contexte: contexte(surcharge),
    identite: { nom: "Épreuve", email: "epreuve@codima.test", mfaActif: false },
  });
}

describe("D151 — les quatre actions de la demande exigent `qualifier_affecter`", () => {
  it("un technicien — creer_demande, sans qualifier_affecter — est refusé", async () => {
    const resultat = await exigerCapacite(
      "qualifier_affecter",
      sessionFabriquee({ role: Role.technicien }),
    );
    expect(resultat).toBeNull();
  });

  it("une ADV — qualifier_affecter — est acceptée", async () => {
    const resultat = await exigerCapacite(
      "qualifier_affecter",
      sessionFabriquee({ role: Role.adv }),
    );
    expect(resultat?.role).toBe(Role.adv);
  });

  // R5 (9DX-RETOUCHES-11) — le client a `creer_demande` (il crée SA demande),
  // mais jamais `qualifier_affecter` : les quatre actions (accuser, qualifier,
  // transformer, clore) relèvent du bureau, pas de celui qui a demandé.
  // L'épreuve d'origine ne nommait que le technicien — un second rôle qui a
  // `creer_demande` sans `qualifier_affecter` passait sans être mesuré.
  it("un client — creer_demande, sans qualifier_affecter — est refusé lui aussi", async () => {
    const resultat = await exigerCapacite(
      "qualifier_affecter",
      sessionFabriquee({ role: Role.client }),
    );
    expect(resultat).toBeNull();
  });
});
