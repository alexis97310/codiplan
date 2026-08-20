import { describe, expect, it } from "vitest";

import {
  CAPACITES,
  niveau,
  peut,
  peutPleinement,
  type Capacite,
} from "@/lib/auth/habilitations";
import { Role, ROLES } from "@/lib/auth/roles";

/**
 * Un scénario par rôle (ticket L0-06), prouvant ce que le rôle PEUT et ce qu'il
 * NE PEUT PAS.
 *
 * Les deux moitiés comptent autant l'une que l'autre. Un tableau où tout serait
 * interdit passerait tous les tests négatifs sans rien démontrer : chaque
 * scénario doit donc porter au moins une capacité accordée et au moins une
 * refusée, et le test le vérifie explicitement plus bas.
 *
 * Source : matrice du §5.2, à laquelle RG-DRO-03 renvoie, complétée du §22.5
 * pour les trois rôles éditeur, et corrigée par les arbitrages 3.8 et 3.17.
 */
type Scenario = {
  role: Role;
  peut: readonly Capacite[];
  nePeutPas: readonly Capacite[];
};

const SCENARIOS: readonly Scenario[] = [
  {
    // §22.5 — « Tout, y compris la création et la suppression de comptes
    // clients. » C'est aussi la colonne « Admin » de la matrice §5.2.
    role: Role.admin_plateforme,
    peut: [
      "administrer_utilisateurs",
      "parametrer_societe",
      "consulter_journal_audit",
      "gerer_comptes_clients",
      "modifier_referentiel_plateforme",
    ],
    // Le seul refus de la colonne : le parc « propre », qui est la vue du
    // portail client et n'a pas de sens pour un rôle interne.
    nePeutPas: ["consulter_parc_propre"],
  },
  {
    // §22.5 — « Comptes, abonnements, facturation, indicateurs. Aucun accès aux
    // données métier des clients. »
    role: Role.editeur_commercial,
    peut: [
      "gerer_abonnements",
      "consulter_indicateurs_editeur",
      "modifier_referentiel_plateforme",
    ],
    nePeutPas: [
      "consulter_planning",
      "consulter_parc_complet",
      "voir_montants_vente",
      "gerer_comptes_clients",
      "support_technique",
    ],
  },
  {
    // §22.5 — « Consultation technique et connexion en tant que sur demande
    // explicite du client. Aucun accès permanent aux données. »
    role: Role.editeur_support,
    peut: [
      "support_technique",
      "connexion_en_tant_que",
      "modifier_referentiel_plateforme",
    ],
    nePeutPas: [
      "consulter_parc_complet",
      "gerer_abonnements",
      "administrer_utilisateurs",
      "voir_marges",
    ],
  },
  {
    role: Role.direction,
    peut: [
      "valider_rapport",
      "voir_marges",
      "consulter_journal_audit",
      "parametrer_societe",
    ],
    nePeutPas: [
      // La direction valide les rapports, elle ne les saisit pas.
      "saisir_rapport",
      "administrer_utilisateurs",
      "modifier_referentiel_plateforme",
    ],
  },
  {
    role: Role.responsable_materiel,
    peut: [
      "gerer_contrat",
      "voir_marges",
      "preparer_facturation",
      "saisir_rapport",
    ],
    nePeutPas: [
      "administrer_utilisateurs",
      "consulter_journal_audit",
      "parametrer_societe",
      "modifier_referentiel_plateforme",
    ],
  },
  {
    role: Role.responsable_sav,
    peut: ["valider_rapport", "gerer_machine", "voir_marges"],
    nePeutPas: [
      "gerer_contrat",
      "preparer_facturation",
      "consulter_journal_audit",
      "modifier_referentiel_plateforme",
    ],
  },
  {
    role: Role.adv,
    peut: [
      "modifier_planning",
      "preparer_facturation",
      "voir_montants_vente",
      "gerer_contrat",
    ],
    // « L'ADV voit les montants de vente mais pas les marges » (§5.2).
    nePeutPas: [
      "voir_marges",
      "saisir_rapport",
      "valider_rapport",
      "modifier_referentiel_plateforme",
    ],
  },
  {
    role: Role.technicien,
    peut: [
      "saisir_rapport",
      "gerer_machine",
      "creer_demande",
      "consulter_planning",
    ],
    nePeutPas: [
      // « Il ne voit aucun montant de vente : il saisit des temps et des
      // pièces » (§5.2).
      "voir_montants_vente",
      "modifier_planning",
      // Arbitrage 3.17 — le technicien ne clôture pas.
      "cloturer_intervention",
      "valider_rapport",
    ],
  },
  {
    role: Role.client,
    peut: ["consulter_parc_propre", "creer_demande"],
    nePeutPas: [
      "consulter_parc_complet",
      // Arbitrage 3.8 — aucun montant sur le portail client en V1.
      "voir_montants_vente",
      "consulter_planning",
      "gerer_machine",
    ],
  },
];

describe("matrice des rôles — un scénario par rôle", () => {
  it("couvre les neuf rôles canoniques, sans oubli ni doublon", () => {
    expect(SCENARIOS.map((scenario) => scenario.role)).toEqual([...ROLES]);
  });

  for (const scenario of SCENARIOS) {
    describe(scenario.role, () => {
      it("porte à la fois du positif et du négatif", () => {
        // Sans cette garde, un scénario vide côté positif passerait au vert en
        // ne prouvant rien.
        expect(scenario.peut.length).toBeGreaterThan(0);
        expect(scenario.nePeutPas.length).toBeGreaterThan(0);
      });

      it("peut ce que la matrice lui accorde", () => {
        for (const capacite of scenario.peut) {
          expect(
            peut(scenario.role, capacite),
            `${scenario.role} devrait pouvoir ${capacite}`,
          ).toBe(true);
        }
      });

      it("ne peut pas ce que la matrice lui refuse", () => {
        for (const capacite of scenario.nePeutPas) {
          expect(
            niveau(scenario.role, capacite),
            `${scenario.role} ne devrait pas pouvoir ${capacite}`,
          ).toBe("aucun");
        }
      });
    });
  }
});

describe("degrés d'accès", () => {
  it("distingue le ● du ○ — l'accès restreint n'est pas l'accès complet", () => {
    // §5.2 : l'ADV a un accès restreint aux contrats, le responsable matériel
    // un accès complet.
    expect(niveau(Role.adv, "gerer_contrat")).toBe("restreint");
    expect(peut(Role.adv, "gerer_contrat")).toBe(true);
    expect(peutPleinement(Role.adv, "gerer_contrat")).toBe(false);

    expect(peutPleinement(Role.responsable_materiel, "gerer_contrat")).toBe(
      true,
    );
  });

  it("le technicien n'a qu'un accès restreint au parc (RG-DRO-02, D22)", () => {
    expect(niveau(Role.technicien, "consulter_parc_complet")).toBe("restreint");
    expect(niveau(Role.adv, "consulter_parc_complet")).toBe("complet");
  });

  it("aucune capacité n'est refusée à tout le monde", () => {
    // Une ligne où personne n'aurait rien serait une transcription fautive.
    for (const capacite of CAPACITES) {
      const porteurs = ROLES.filter((role) => peut(role, capacite));
      expect(porteurs.length, `personne ne peut ${capacite}`).toBeGreaterThan(
        0,
      );
    }
  });

  it("seuls les rôles éditeur modifient les référentiels de plateforme (I1)", () => {
    const porteurs = ROLES.filter((role) =>
      peut(role, "modifier_referentiel_plateforme"),
    );
    expect(porteurs).toEqual([
      Role.admin_plateforme,
      Role.editeur_commercial,
      Role.editeur_support,
    ]);
  });
});
