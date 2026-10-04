import { describe, expect, it } from "vitest";

import { deduiteDuSite } from "@/app/(back-office)/interventions/presentation";
import { estCleTraduction, fr, t } from "@/lib/i18n/fr";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

/**
 * GR16 (audit d'ergonomie du 26/09/2026, constat G18) — neuf textes
 * réécrits, sans changement de règle de gestion. Chaque scénario ci-dessous
 * couvre un point du lot.
 */
describe("GR16 — clients.nouveau.sous_titre supprimé", () => {
  it("la clé n'existe plus dans le dictionnaire", () => {
    expect(estCleTraduction("clients.nouveau.sous_titre")).toBe(false);
    expect(Object.keys(fr)).not.toContain("clients.nouveau.sous_titre");
  });
});

describe("GR16 — demande.sans_numero", () => {
  it("reprend le texte déjà en usage pour une intervention sans numéro", () => {
    expect(t("demande.sans_numero")).toBe("Numéro provisoire");
    expect(t("demande.sans_numero")).toBe(t("intervention.sans_numero"));
  });
});

describe("GR16 — absences.sous_titre", () => {
  it("dit une consigne, pas une justification", () => {
    expect(t("absences.sous_titre")).not.toContain("médecine");
  });
});

describe("GR16 — imports.appliquer_aide", () => {
  it("dit ce que fait « Appliquer »", () => {
    expect(t("imports.appliquer_aide")).toBe(
      "Importe les lignes nouvelles et modifiées ; les rejets ne sont pas importés.",
    );
  });
});

describe("GR16 — « Afficher la clé »", () => {
  it("aucune valeur enrolement.* ne contient « révél »", () => {
    for (const [cle, valeur] of Object.entries(fr)) {
      if (cle.startsWith("enrolement.")) {
        expect(valeur.toLowerCase(), `la clé ${cle}`).not.toContain("révél");
      }
    }
  });
});

describe("GR16 — fiche machine : aucun code de règle à l'écran", () => {
  it("aucune valeur machine.* ne contient « RG-PAR »", () => {
    for (const [cle, valeur] of Object.entries(fr)) {
      if (cle.startsWith("machine.")) {
        expect(valeur, `la clé ${cle}`).not.toContain("RG-PAR");
      }
    }
  });
});

describe("GR16 — refus sur une intervention clôturée", () => {
  // BASCULE (D160, QT-4, 28/09/2026, 9DF-TP-CY2-MATRICE-D8) : CLOTUREE est
  // désormais terminale au sens plein — l'ancien texte promettait « Seule
  // l'annulation reste possible », ce qui n'est plus vrai depuis que la
  // matrice D8 retire cette flèche (voir `lib/interventions/cycle-de-vie.ts`,
  // `peutAnnuler`).
  it("nomme ce qui est figé, sans plus promettre une annulation possible", () => {
    expect(t("intervention.refus.cloturee_figee")).toBe(
      "Clôturée : elle ne se modifie plus, y compris pour être annulée.",
    );
  });
});

describe("GR16 — « Déduite du site »", () => {
  it("compose le mot imposé, jamais écrit en dur", () => {
    expect(deduiteDuSite()).toContain(motDansUnePhrase("site"));
    expect(deduiteDuSite()).toBe("Déduite du site.");
  });

  it("la clé intervention.deduit_du_lieu n'existe plus", () => {
    expect(estCleTraduction("intervention.deduit_du_lieu")).toBe(false);
    expect(Object.keys(fr)).not.toContain("intervention.deduit_du_lieu");
  });
});

describe("GR16 — « (obligatoire) » sur les champs requis", () => {
  it("libelleChampObligatoire reprend le suffixe déjà en usage", () => {
    expect(libelleChampObligatoire("N° de série")).toBe(
      `N° de série ${t("intervention.creation.obligatoire_suffixe")}`,
    );
  });
});

describe("GR16 — prestations : la checklist en une phrase", () => {
  it("dit ce qui manque, en une phrase courte", () => {
    expect(t("prestations.sans_checklist")).toBe(
      "La checklist type arrivera plus tard.",
    );
  });
});

describe("GR16 — enrôlement : clair et définitif", () => {
  it("dit que le second facteur ne se désactive pas", () => {
    expect(t("enrolement.definitif")).toContain("ne se désactive pas");
  });
});
