import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/interventions/[id]/deplacer/route";

/**
 * PG-A3a-MESSAGES-POSE (28/09/2026, audit d'ergonomie du 27/09, bugs 2 et 3).
 *
 * ## Le défaut mesuré sur `main` avant ce ticket
 *
 * « Une intervention dure au moins un créneau. Tirez la poignée sous le début
 * du bloc, jamais au-dessus. » (`intervention.refus.duree_invalide`)
 * s'affichait à qui n'avait RIEN tiré :
 *
 * - une carte SANS durée connue, déposée en vue Jour, partait avec
 *   `duree_min=0` — Zod refuse (`positive()`), et la route ne distinguait pas
 *   ce cas de la poignée remontée au-dessus du début.
 * - le formulaire « Déplacer » de la fiche, heure VIDÉE et durée
 *   PRÉ-REMPLIE (99S), échouait sur le même refine (« une heure et une durée,
 *   ou rien ») avec le même message.
 *
 * Ce fichier éprouve la SÉLECTION DE LA CLÉ DE REFUS par la route, sans
 * traverser la base — `deplacerIntervention` n'est jamais atteint puisque la
 * saisie échoue avant.
 */

// Le facteur importe `Role` lui-même, plutôt que de lire une variable de
// portée externe : un `vi.mock` est hoissé au-dessus de tout import de ce
// fichier, et « aucun rôle en chaîne libre » (`lib/auth/roles.ts`) interdit
// d'écrire le nom du rôle entre guillemets ici (gardien
// `roles-sans-chaine-libre`).
vi.mock("@/lib/auth/porte", async () => {
  const { Role } = await import("@/lib/auth/roles");
  return {
    exigerCapacite: vi.fn().mockResolvedValue({
      utilisateurId: "11111111-1111-1111-1111-111111111111",
      societeId: "22222222-2222-2222-2222-222222222222",
      role: Role.adv,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    }),
  };
});

const ID = "33333333-3333-3333-3333-333333333333";
const TECHNICIEN_ID = "44444444-4444-4444-4444-444444444444";

function requete(champs: Readonly<Record<string, string>>): Request {
  const corps = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) {
    corps.set(nom, valeur);
  }
  return new Request(`http://localhost/api/interventions/${ID}/deplacer`, {
    method: "POST",
    body: corps,
    headers: { accept: "application/json" },
  });
}

async function cleDuRefus(
  champs: Readonly<Record<string, string>>,
): Promise<unknown> {
  const reponse = await POST(requete(champs), {
    params: Promise.resolve({ id: ID }),
  });
  const corps: unknown = await reponse.json();
  return (corps as { cle: unknown }).cle;
}

describe("la route /deplacer, sur les trois façons de manquer un créneau", () => {
  it("chemin 1 — une carte SANS durée connue (heure posée, aucun duree_min) : la durée manque, jamais « tirez la poignée »", async () => {
    const cle = await cleDuRefus({
      date_planifiee: "2026-11-02",
      heure_debut: "08:00",
      technicien_id: TECHNICIEN_ID,
    });
    expect(cle).toBe("intervention.refus.planification_duree_manquante");
  });

  it("chemin 2 — « Déplacer » avec l'heure vidée et la durée pré-remplie : l'heure manque, jamais « tirez la poignée »", async () => {
    const cle = await cleDuRefus({
      date_planifiee: "2026-11-02",
      duree_min: "90",
      technicien_id: TECHNICIEN_ID,
    });
    expect(cle).toBe("intervention.refus.heure_obligatoire");
  });

  it("le redimensionnement — une durée à zéro ou négative, heure ET durée présentes — garde « tirez la poignée »", async () => {
    const cle = await cleDuRefus({
      date_planifiee: "2026-11-02",
      heure_debut: "08:00",
      duree_min: "0",
      technicien_id: TECHNICIEN_ID,
    });
    expect(cle).toBe("intervention.refus.duree_invalide");
  });
});
