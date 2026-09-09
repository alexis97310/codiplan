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
const CLIENT = "0192f0a0-1000-7000-8000-0000000000c3";

function contexte(surcharge: Partial<ContexteSession> = {}): ContexteSession {
  return {
    utilisateurId: UTILISATEUR,
    societeId: SOCIETE,
    role: Role.adv,
    secondFacteurValide: false,
    adresseIp: null,
    clientId: null,
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
   * CES SCÉNARIOS RETOURNENT UNE ASSERTION ÉCRITE À L0-06, et il faut le dire.
   *
   * La boucle ci-dessus portait `Role.client` et exigeait `null` : « le rôle du
   * portail n'appelle aucune exigence de plus ». C'était vrai de ce que L0-06
   * regardait — le second facteur —, et faux de ce que D10 avait posé un ticket
   * plus tôt. La ligne n'est pas retirée pour faire passer la vérification :
   * **l'appariement rôle ↔ client est délibéré, mesuré, et il FERME.**
   *
   * Ce qu'il ferme (D70) : `app.client_id` est le discriminant de la forme
   * « parc » ET de la forme « habilitation ». Vide sur un compte portail, il
   * ouvre le parc entier de la société — mesuré à 2 machines d'un client dont
   * ce compte n'est pas habilité, contre 0 quand la variable est posée. Posé
   * sur un rôle interne, il déplace en silence ce que la forme
   * « habilitation » discrimine.
   */
  it("REFUSE le rôle du portail SANS client désigné", () => {
    const motif = motifRefusContexte(
      contexte({ role: Role.client, clientId: null }),
    );
    expect(motif).toContain("app.client_id");
    expect(motif).toContain("parc ENTIER");
    // Le second facteur n'y change rien : ce n'est pas une question de force
    // d'authentification, c'est une variable que personne ne renseignait.
    expect(
      motifRefusContexte(
        contexte({
          role: Role.client,
          clientId: null,
          secondFacteurValide: true,
        }),
      ),
    ).toContain("app.client_id");
  });

  it("ACCEPTE le rôle du portail QUAND un client est désigné", () => {
    // Sans ce scénario, le refus ci-dessus pourrait être total et personne ne
    // le verrait : un verrou qui ferme tout n'est pas un verrou, c'est une
    // panne. C'est le témoin de non-vacuité du refus.
    expect(
      motifRefusContexte(contexte({ role: Role.client, clientId: CLIENT })),
    ).toBeNull();
  });

  it("REFUSE un client désigné par un rôle qui n'est pas celui du portail", () => {
    const motif = motifRefusContexte(
      contexte({ role: Role.adv, clientId: CLIENT }),
    );
    expect(motif).toContain("n'est pas un rôle du portail");
  });

  /**
   * TÉMOIN DE NON-VACUITÉ, et il vise le sens qui compte : l'appariement doit
   * être ÉTROIT. Un refus qui tomberait sur tous les rôles fermerait
   * l'application entière et passerait les assertions ci-dessus sans rien
   * prouver.
   */
  it("et l'appariement ne concerne QU'UN rôle sur les dix, dans les deux sens", () => {
    const sansClient = ROLES.filter(
      (role) =>
        motifRefusContexte(
          contexte({ role, clientId: null, secondFacteurValide: true }),
        )?.includes("app.client_id") === true,
    );
    const avecClient = ROLES.filter(
      (role) =>
        motifRefusContexte(
          contexte({ role, clientId: CLIENT, secondFacteurValide: true }),
        )?.includes("rôle du portail") === true,
    );
    expect(sansClient).toEqual([Role.client]);
    expect(avecClient).toEqual(ROLES.filter((role) => role !== Role.client));
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
