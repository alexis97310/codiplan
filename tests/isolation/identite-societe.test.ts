import { afterAll, describe, expect, it } from "vitest";

import { lireIdentiteCloisonnee } from "@/lib/societes/identite";

import { fermerClients, sousSociete, sousSocieteEtRole } from "./setup/db";
import {
  FUSEAU_SOCIETE_A,
  FUSEAU_SOCIETE_B,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * LA CARTE « IDENTITÉ » DU HUB DE PARAMÉTRAGE N'ÉCHAPPE PAS À I1 (QT-22,
 * D167, 05/10/2026, TP-NAV1) — même discipline que `tests/isolation/
 * theme-societe.test.ts` : le cloisonnement est tenu par les deux barrières,
 * dans l'ordre — filtre applicatif, puis politique RLS `id = app.societe_id`
 * (D42) —, et le scénario s'exécute sous le rôle applicatif restreint.
 */
describe("l'identité suit la société active, et rien d'autre (QT-22, I1)", () => {
  afterAll(fermerClients);

  it("chaque société lit SA PROPRE identité", async () => {
    const identiteA = await sousSociete(SOCIETE_A, (tx) =>
      lireIdentiteCloisonnee(tx, SOCIETE_A),
    );
    const identiteB = await sousSociete(SOCIETE_B, (tx) =>
      lireIdentiteCloisonnee(tx, SOCIETE_B),
    );

    expect(identiteA).not.toBeNull();
    expect(identiteB).not.toBeNull();
    expect(identiteA?.fuseau_horaire).toBe(FUSEAU_SOCIETE_A);
    expect(identiteB?.fuseau_horaire).toBe(FUSEAU_SOCIETE_B);
  });

  it("une session active sur A n'obtient PAS l'identité de B, même en la demandant", async () => {
    // Le défaut visé : un identifiant de société qui viendrait d'ailleurs — un
    // paramètre d'URL, un en-tête, une reprise de code. La politique ne laisse
    // voir que la société du contexte : la lecture rend zéro ligne.
    const vol = await sousSociete(SOCIETE_A, (tx) =>
      lireIdentiteCloisonnee(tx, SOCIETE_B),
    );

    expect(vol).toBeNull();
  });

  it("sans société active, aucune identité n'est lisible", async () => {
    // `app.societe_id` non posé : la politique ne laisse passer aucune ligne,
    // quel que soit l'identifiant demandé — même motif que
    // `theme-societe.test.ts`.
    const identite = await sousSocieteEtRole(null, null, (tx) =>
      lireIdentiteCloisonnee(tx, SOCIETE_A),
    );

    expect(identite).toBeNull();
  });
});
