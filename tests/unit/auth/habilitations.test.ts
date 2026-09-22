import { describe, expect, it } from "vitest";

import {
  CAPACITES,
  niveau,
  peut,
  peutPleinement,
  type Capacite,
} from "@/lib/auth/habilitations";
import { estRoleEditeur, estRoleInterne, Role, ROLES } from "@/lib/auth/roles";

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
 * pour les trois rôles éditeur, et corrigée par les arbitrages 3.8, 3.17 et
 * D37. C'est D37 qui scinde la colonne « Admin » : les lignes du §5.2, toutes
 * de portée société, reviennent à `admin_societe` ; `admin_plateforme` ne garde
 * que ce qui est de portée plateforme, énuméré au §22.5.
 */
type Scenario = {
  role: Role;
  peut: readonly Capacite[];
  nePeutPas: readonly Capacite[];
};

/**
 * Les lignes du §5.2 — toutes de portée SOCIÉTÉ (D37). Les lignes de portée
 * plateforme sont celles du §22.5, plus les référentiels de plateforme de I1 ;
 * elles n'en font pas partie.
 */
const CAPACITES_SOCIETE: readonly Capacite[] = [
  "consulter_planning",
  "modifier_planning",
  "creer_demande",
  "qualifier_affecter",
  "saisir_rapport",
  "valider_rapport",
  "cloturer_intervention",
  // D131 (23/09/2026, DROITS-1) — absentes du §5.2, arbitrées avec « clôturer ».
  "annuler_intervention",
  "suspendre_reprendre_intervention",
  "enregistrer_vgp",
  "gerer_contrat",
  "gerer_machine",
  "gerer_client_site",
  "consulter_parc_complet",
  "voir_montants_vente",
  "voir_marges",
  "preparer_facturation",
  "importer_exporter",
  "parametrer_societe",
  "administrer_utilisateurs",
  "administrer_agences",
  "consulter_journal_audit",
];

const SCENARIOS: readonly Scenario[] = [
  {
    // §22.5 — « Tout, y compris la création et la suppression de comptes
    // clients. » D37 : « tout » s'entend AU NIVEAU PLATEFORME. La colonne
    // « Admin » du §5.2 ne lui appartient plus — elle est de portée société et
    // revient à `admin_societe`. Sans quoi créer un compte chez un client
    // passerait par l'éditeur, ce qui est intenable dès la première vente.
    role: Role.admin_plateforme,
    peut: [
      "gerer_comptes_clients",
      "gerer_abonnements",
      "consulter_indicateurs_editeur",
      "support_technique",
      "connexion_en_tant_que",
      "modifier_referentiel_plateforme",
    ],
    nePeutPas: [
      "administrer_utilisateurs",
      "administrer_agences",
      "parametrer_societe",
      "consulter_journal_audit",
      "consulter_parc_complet",
      "voir_marges",
      "consulter_parc_propre",
    ],
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
    // D37 — le dixième rôle. « Il administre comptes, agences et habilitations
    // de SA société ; il ne lit pas les données financières, qui restent à
    // direction. » Les habilitations sont des lignes d'`utilisateur_societe` :
    // elles relèvent d'« administrer les utilisateurs ».
    role: Role.admin_societe,
    peut: [
      "administrer_utilisateurs",
      "administrer_agences",
      "parametrer_societe",
      "consulter_journal_audit",
      "consulter_planning",
      // D130 — créer/modifier un client ou un site.
      "gerer_client_site",
    ],
    nePeutPas: [
      // Les données financières restent à la direction (D37).
      "voir_montants_vente",
      "voir_marges",
      "preparer_facturation",
      // Il administre SA société, pas la plateforme : ni les référentiels de
      // plateforme (I1), ni les comptes clients de l'éditeur (§22.5).
      "modifier_referentiel_plateforme",
      "gerer_comptes_clients",
      "consulter_parc_propre",
    ],
  },
  {
    role: Role.direction,
    peut: [
      "valider_rapport",
      "voir_marges",
      "consulter_journal_audit",
      "parametrer_societe",
      // D130 — créer/modifier un client ou un site.
      "gerer_client_site",
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
      // D130 — la fiche client et la fiche site sont du référentiel
      // commercial, pas de l'exploitation, malgré l'accès complet à la
      // machine.
      "gerer_client_site",
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
      // D130 — même raison que le responsable matériel.
      "gerer_client_site",
    ],
  },
  {
    role: Role.adv,
    peut: [
      "modifier_planning",
      "preparer_facturation",
      "voir_montants_vente",
      "gerer_contrat",
      // D130 — créer/modifier un client ou un site.
      "gerer_client_site",
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
      // D131 (23/09/2026, DROITS-1) — rétablit le ○ que l'arbitrage 3.17
      // avait retiré, mais SCOPÉ à SA PROPRE intervention affectée : `peut`
      // rend `true` pour un ○ (le périmètre est jugé par le dépôt, jamais
      // par la matrice — voir `perimetre-technicien.test.ts`).
      "cloturer_intervention",
      "suspendre_reprendre_intervention",
      // D131 — absente du §5.2, même ○ scopé aux interventions du technicien.
      "enregistrer_vgp",
    ],
    nePeutPas: [
      // « Il ne voit aucun montant de vente : il saisit des temps et des
      // pièces » (§5.2).
      "voir_montants_vente",
      "modifier_planning",
      "valider_rapport",
      // D131 — le technicien n'annule jamais : une décision commerciale du
      // bureau, aucun ○.
      "annuler_intervention",
      // D130 — même raison que le responsable matériel et le responsable SAV.
      "gerer_client_site",
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
  it("couvre les dix rôles canoniques, sans oubli ni doublon", () => {
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

  it("D131 — le technicien est restreint sur clôturer/suspendre-reprendre/VGP, jamais sur annuler", () => {
    expect(niveau(Role.technicien, "cloturer_intervention")).toBe("restreint");
    expect(niveau(Role.technicien, "suspendre_reprendre_intervention")).toBe(
      "restreint",
    );
    expect(niveau(Role.technicien, "enregistrer_vgp")).toBe("restreint");
    expect(niveau(Role.technicien, "annuler_intervention")).toBe("aucun");
    expect(niveau(Role.adv, "annuler_intervention")).toBe("complet");
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

describe("scission de la colonne « Admin » (D37)", () => {
  it("aucune ligne du §5.2 ne revient à `admin_plateforme`", () => {
    // Le principe du §22.5 : « un salarié de l'éditeur n'a aucun accès par
    // défaut aux données d'un client ». La colonne « Admin » du §5.2 le
    // contredisait ; elle est désormais celle d'`admin_societe`.
    for (const capacite of CAPACITES_SOCIETE) {
      expect(
        niveau(Role.admin_plateforme, capacite),
        `${capacite} est de portée société, elle ne revient pas à l'éditeur`,
      ).toBe("aucun");
    }
  });

  it("`admin_societe` reprend les lignes du §5.2, sauf les données financières", () => {
    const financieres: readonly Capacite[] = [
      "voir_montants_vente",
      "voir_marges",
      "preparer_facturation",
    ];

    for (const capacite of CAPACITES_SOCIETE) {
      const attendu = financieres.includes(capacite) ? "aucun" : "complet";
      expect(niveau(Role.admin_societe, capacite), capacite).toBe(attendu);
    }
  });

  it("`admin_societe` reste un rôle interne, jamais un rôle éditeur", () => {
    expect(estRoleInterne(Role.admin_societe)).toBe(true);
    expect(estRoleEditeur(Role.admin_societe)).toBe(false);
    // I1 — les référentiels de plateforme restent aux seuls rôles éditeur.
    expect(peut(Role.admin_societe, "modifier_referentiel_plateforme")).toBe(
      false,
    );
  });

  it("le seul chemin de l'éditeur vers les données d'un client reste la « connexion en tant que »", () => {
    expect(peut(Role.admin_plateforme, "connexion_en_tant_que")).toBe(true);
    expect(niveau(Role.editeur_support, "connexion_en_tant_que")).toBe(
      "restreint",
    );
  });
});
