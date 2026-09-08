import { describe, expect, it } from "vitest";

import {
  estContexteActif,
  exigerContexteActif,
  motifRefusContexte,
  schemaContexteSession,
  type ContexteSession,
} from "@/lib/auth/contexte";
import { ROLES, Role } from "@/lib/auth/roles";

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
    adresseIp: null,
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

  it("n'exige rien de plus des rôles opérationnels INTERNES", () => {
    for (const role of [Role.adv, Role.technicien]) {
      expect(
        motifRefusContexte(contexte({ role, secondFacteurValide: false })),
      ).toBeNull();
    }
  });

  /**
   * CE SCÉNARIO RETOURNE UNE ASSERTION ÉCRITE À L0-06, et il faut le dire.
   *
   * La boucle ci-dessus portait `Role.client` et exigeait `null` : « le rôle du
   * portail n'appelle aucune exigence de plus ». C'était vrai de ce que L0-06
   * regardait — le second facteur —, et faux de ce que D10 avait posé un ticket
   * plus tôt. La ligne n'est pas retirée pour faire passer la vérification :
   * **le refus qu'elle interdisait est délibéré, mesuré, et il FERME.**
   *
   * Ce qu'il ferme : `app.client_id` n'a aucun poseur de production, et la forme
   * « parc » lit une valeur vide comme « utilisateur interne ». Un compte
   * portail qui atteindrait ce chemin lirait le parc entier de sa société —
   * mesuré à 2 machines d'un client dont il n'est pas habilité, contre 0 quand
   * la variable est posée (voir `tests/isolation/portail-sans-client.test.ts`,
   * qui le montre en base ET le montre revenir quand on retire ce refus).
   */
  it("REFUSE le rôle du portail : `app.client_id` n'a aucun poseur", () => {
    const motif = motifRefusContexte(
      contexte({ role: Role.client, secondFacteurValide: false }),
    );
    expect(motif).toContain("app.client_id");
    expect(motif).toContain("parc ENTIER");
    // Et le second facteur n'y change rien : ce n'est pas une question de
    // force d'authentification, c'est une variable que personne ne renseigne.
    expect(
      motifRefusContexte(
        contexte({ role: Role.client, secondFacteurValide: true }),
      ),
    ).toContain("app.client_id");
    expect(() => exigerContexteActif(contexte({ role: Role.client }))).toThrow(
      /app\.client_id/,
    );
  });

  /**
   * TÉMOIN DE NON-VACUITÉ, et il vise le sens qui compte : le refus doit être
   * ÉTROIT. Un refus qui tomberait sur tous les rôles fermerait l'application
   * entière et passerait l'assertion ci-dessus sans rien prouver.
   */
  it("et ce refus ne touche QU'UN rôle sur les dix", () => {
    const refuses = ROLES.filter(
      (role) =>
        motifRefusContexte(
          contexte({ role, secondFacteurValide: true }),
        )?.includes("app.client_id") === true,
    );
    expect(refuses).toEqual([Role.client]);
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
