import { describe, expect, it } from "vitest";

import {
  estContexteActif,
  exigerContexteActif,
  motifRefusContexte,
  schemaContexteSession,
  type ContexteSession,
} from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";

/**
 * Contexte de session (ticket L0-06, point 2) : « une session sans société ne
 * doit rien pouvoir lire ».
 *
 * La base le garantit déjà — sans `app.societe_id`, les politiques renvoient
 * zéro ligne (L0-04, prouvé à L0-05). Ces scénarios couvrent la marche du
 * dessus : l'application refuse d'ouvrir la transaction, plutôt que de la
 * laisser rendre une liste vide qu'un écran présenterait comme « aucun
 * résultat ».
 */
const SOCIETE = "0192f0a0-1000-7000-8000-0000000000a1";
const UTILISATEUR = "0192f0a0-1000-7000-8000-0000000000b2";

function contexte(surcharge: Partial<ContexteSession> = {}): ContexteSession {
  return {
    utilisateurId: UTILISATEUR,
    societeId: SOCIETE,
    role: Role.adv,
    secondFacteurValide: false,
    ...surcharge,
  };
}

describe("contexte de session", () => {
  it("accepte une session portant société et rôle", () => {
    expect(motifRefusContexte(contexte())).toBeNull();
    expect(estContexteActif(contexte())).toBe(true);
  });

  it("refuse une session sans société active", () => {
    const motif = motifRefusContexte(contexte({ societeId: null }));
    expect(motif).toContain("Aucune société active");
  });

  it("refuse une société sans rôle — `app.role` resterait vide", () => {
    const motif = motifRefusContexte(contexte({ role: null }));
    expect(motif).toContain("sans rôle");
  });

  it("refuse `direction` sans second facteur", () => {
    const motif = motifRefusContexte(
      contexte({ role: Role.direction, secondFacteurValide: false }),
    );
    expect(motif).toContain("second facteur");
  });

  it("accepte `direction` avec second facteur", () => {
    expect(
      motifRefusContexte(
        contexte({ role: Role.direction, secondFacteurValide: true }),
      ),
    ).toBeNull();
  });

  it("refuse `admin_plateforme` sans second facteur, l'accepte avec", () => {
    expect(
      motifRefusContexte(contexte({ role: Role.admin_plateforme })),
    ).toContain("second facteur");
    expect(
      motifRefusContexte(
        contexte({
          role: Role.admin_plateforme,
          secondFacteurValide: true,
        }),
      ),
    ).toBeNull();
  });

  it("n'exige rien de plus des rôles opérationnels", () => {
    for (const role of [Role.adv, Role.technicien, Role.client]) {
      expect(
        motifRefusContexte(contexte({ role, secondFacteurValide: false })),
      ).toBeNull();
    }
  });

  it("`exigerContexteActif` lève avec le motif, et renvoie le contexte sinon", () => {
    expect(() => exigerContexteActif(contexte({ societeId: null }))).toThrow(
      /Aucune société active/,
    );
    expect(exigerContexteActif(contexte()).societeId).toBe(SOCIETE);
  });

  it("le schéma refuse un identifiant qui n'est pas un UUID", () => {
    expect(
      schemaContexteSession.safeParse({
        ...contexte(),
        societeId: "pas-un-uuid",
      }).success,
    ).toBe(false);

    expect(schemaContexteSession.safeParse(contexte()).success).toBe(true);
  });
});
