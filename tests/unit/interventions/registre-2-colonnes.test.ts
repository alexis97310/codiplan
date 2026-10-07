import { describe, expect, it } from "vitest";

import {
  ancienneteRegistreAffichee,
  colonnesDuRegistre,
  compteurRegistreAffiche,
  dateLocale,
  dateRegistreAffichee,
  descriptionTronquee,
  dureeRegistreAffichee,
  estDeplanifieeEnAttente,
  motifSuspensionAffiche,
  pieceAttendueAffichee,
  selectionDisponibleSurLOnglet,
  SIGNE_ABSENCE,
  texteRapportColonne,
} from "@/app/(back-office)/interventions/presentation";
import { t } from "@/lib/i18n/fr";
import { VUES_REGISTRE } from "@/lib/interventions/saisie";

const FUSEAU = "Pacific/Noumea";

/**
 * LES COLONNES DU REGISTRE, PAR ONGLET (TP-UX3-1-REGISTRE-2, QE-8 (a) du
 * 03/10/2026) — `colonnesDuRegistre` et les cellules pures qu'elle sert.
 */
describe("colonnesDuRegistre — un jeu de colonnes PAR ONGLET", () => {
  it("« À planifier » : Prio., Intervention, Client · Site, Demande, Ancienneté, Durée, Poser", () => {
    const cles = colonnesDuRegistre("a_planifier").map((c) => c.cle);
    expect(cles).toEqual([
      "prio",
      "intervention",
      "client_site",
      "demande",
      "anciennete",
      "duree",
      "action",
    ]);
  });

  it("« Aujourd'hui » : Heure, Intervention, Client · Site, Technicien, Statut, Transmettre…/Contrôler", () => {
    const cles = colonnesDuRegistre("aujourdhui").map((c) => c.cle);
    expect(cles).toEqual([
      "heure",
      "intervention",
      "client_site",
      "technicien",
      "statut",
      "action",
    ]);
  });

  it("« En retard » : Prévue, Intervention, Client · Site, Technicien, Statut, Déplacer…", () => {
    const cles = colonnesDuRegistre("en_retard").map((c) => c.cle);
    expect(cles).toEqual([
      "prevue",
      "intervention",
      "client_site",
      "technicien",
      "statut",
      "action",
    ]);
  });

  it("« En cours » : Début, Intervention, Client · Site, Technicien, Compteur — AUCUNE action, AUCUN montant", () => {
    const cles = colonnesDuRegistre("en_cours").map((c) => c.cle);
    expect(cles).toEqual([
      "debut",
      "intervention",
      "client_site",
      "technicien",
      "compteur",
    ]);
    expect(cles).not.toContain("action");
  });

  it("« Suspendues » : Depuis, Intervention, Client · Site, Motif, Pièce attendue, Poser", () => {
    const cles = colonnesDuRegistre("bloquees").map((c) => c.cle);
    expect(cles).toEqual([
      "depuis",
      "intervention",
      "client_site",
      "motif",
      "piece_attendue",
      "action",
    ]);
  });

  it("« À contrôler » : Terminée, Intervention, Client · Site, Technicien, Rapport, Contrôler", () => {
    const cles = colonnesDuRegistre("a_controler").map((c) => c.cle);
    expect(cles).toEqual([
      "terminee",
      "intervention",
      "client_site",
      "technicien",
      "rapport",
      "action",
    ]);
  });

  it("« Toutes » : Date, Intervention, Client · Site, Technicien, Statut, Prio. — AUCUNE action, AUCUN montant", () => {
    const cles = colonnesDuRegistre("toutes").map((c) => c.cle);
    expect(cles).toEqual([
      "date",
      "intervention",
      "client_site",
      "technicien",
      "statut",
      "prio",
    ]);
    expect(cles).not.toContain("action");
  });

  it("aucune colonne de montant (aucun en-tête n'évoque un prix), sur AUCUN onglet", () => {
    for (const vue of [...VUES_REGISTRE, "toutes"] as const) {
      for (const colonne of colonnesDuRegistre(vue)) {
        expect(colonne.libelle.toLowerCase()).not.toMatch(
          /\bmontant\b|\bprix\b|\bxpf\b|\beur\b|€/,
        );
      }
    }
  });

  it("« Client · Site » compose le mot imposé « Site », jamais écrit en dur ici", () => {
    const colonne = colonnesDuRegistre("toutes").find(
      (c) => c.cle === "client_site",
    );
    expect(colonne?.libelle).toBe(`${t("intervention.client")} · Site`);
  });
});

describe("selectionDisponibleSurLOnglet — trois onglets seulement (TP-UX3-1-REGISTRE-2, partie B)", () => {
  it("À planifier, Aujourd'hui et Toutes offrent la sélection", () => {
    expect(selectionDisponibleSurLOnglet("a_planifier")).toBe(true);
    expect(selectionDisponibleSurLOnglet("aujourdhui")).toBe(true);
    expect(selectionDisponibleSurLOnglet("toutes")).toBe(true);
  });

  it("les cinq autres onglets n'offrent PAS la sélection — jamais de pose en lot (D106)", () => {
    for (const vue of [
      "en_retard",
      "en_cours",
      "bloquees",
      "a_controler",
      "a_venir",
      "historique",
    ] as const) {
      expect(selectionDisponibleSurLOnglet(vue)).toBe(false);
    }
  });
});

describe("ancienneteRegistreAffichee — « aujourd'hui »/« N jours », et « le JJ/MM » dessous", () => {
  const AUJOURDHUI_LOCAL = { annee: 2026, mois: 10, jour: 7 };

  it("créée AUJOURD'HUI (même jour civil) rend « aujourd'hui »", () => {
    const creeLe = new Date("2026-10-07T03:00:00.000Z"); // ~14h locale UTC+11
    const resultat = ancienneteRegistreAffichee(
      creeLe,
      FUSEAU,
      AUJOURDHUI_LOCAL,
    );
    expect(resultat.texte).toBe(t("interventions.anciennete.aujourdhui"));
    expect(resultat.depuisLe).toBe(
      `${t("interventions.anciennete.le_prefixe")} 07/10`,
    );
  });

  it("créée il y a PLUSIEURS jours rend « N jours », au pluriel", () => {
    const creeLe = new Date("2026-10-02T03:00:00.000Z");
    const resultat = ancienneteRegistreAffichee(
      creeLe,
      FUSEAU,
      AUJOURDHUI_LOCAL,
    );
    expect(resultat.texte).toBe(`5 ${t("interventions.anciennete.jours")}`);
  });

  it("créée EXACTEMENT un jour civil plus tôt rend « 1 jour », au singulier", () => {
    const creeLe = new Date("2026-10-06T03:00:00.000Z");
    const resultat = ancienneteRegistreAffichee(
      creeLe,
      FUSEAU,
      AUJOURDHUI_LOCAL,
    );
    expect(resultat.texte).toBe(`1 ${t("interventions.anciennete.jour_un")}`);
  });
});

describe("dureeRegistreAffichee — `duree_estimee_min`, ou « à estimer »", () => {
  it("une durée connue se formate, et n'est jamais « manquante »", () => {
    const resultat = dureeRegistreAffichee(90);
    expect(resultat.manquante).toBe(false);
    expect(resultat.texte).not.toBe(t("interventions.duree_a_estimer"));
  });

  it("`null` rend « à estimer », marquée MANQUANTE (pour l'habillage orange)", () => {
    const resultat = dureeRegistreAffichee(null);
    expect(resultat.manquante).toBe(true);
    expect(resultat.texte).toBe(t("interventions.duree_a_estimer"));
  });
});

describe("dateRegistreAffichee — Prévue/Date/Terminée, UNE SEULE lecture de `date_planifiee`", () => {
  it("`null` rend le texte de la file d'attente", () => {
    expect(dateRegistreAffichee(null)).toBe(t("planning.file_attente"));
  });

  it("une date posée se formate", () => {
    const rendu = dateRegistreAffichee(new Date("2026-10-07T00:00:00.000Z"));
    expect(rendu).not.toBe(t("planning.file_attente"));
    expect(rendu.length).toBeGreaterThan(0);
  });
});

describe("descriptionTronquee — la première ligne de `description`, proprement tronquée", () => {
  it("une description courte sur une seule ligne n'est pas touchée", () => {
    expect(descriptionTronquee("Fuite d'huile sur le pont 2")).toBe(
      "Fuite d'huile sur le pont 2",
    );
  });

  it("seule la PREMIÈRE ligne est gardée", () => {
    expect(descriptionTronquee("Première ligne\nDeuxième ligne")).toBe(
      "Première ligne",
    );
  });

  it("une ligne plus longue que la borne est tronquée avec une ellipse", () => {
    const longue = "x".repeat(80);
    const rendu = descriptionTronquee(longue, 60);
    expect(rendu.length).toBe(60);
    expect(rendu.endsWith("…")).toBe(true);
  });
});

describe("pieceAttendueAffichee — colonne « Pièce attendue » (onglet Suspendues)", () => {
  it("`null` (aucune pièce attendue) rend `null`", () => {
    expect(
      pieceAttendueAffichee({
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      }),
    ).toBeNull();
  });

  it("une référence sans date connue ne porte pas de « disponible le »", () => {
    const rendu = pieceAttendueAffichee({
      piece_attendue_ref: "REF-42",
      date_dispo_prevue: null,
    });
    expect(rendu).toEqual({ reference: "REF-42", disponibleLe: null });
  });

  it("une référence ET une date rendent « disponible le JJ/MM »", () => {
    const rendu = pieceAttendueAffichee({
      piece_attendue_ref: "REF-42",
      date_dispo_prevue: new Date("2026-11-03T00:00:00.000Z"),
    });
    expect(rendu?.disponibleLe).toBe(
      `${t("interventions.piece_attendue.disponible_le_prefixe")} 03/11`,
    );
  });
});

describe("estDeplanifieeEnAttente — la pastille « rendue par une absence » (colonne Demande)", () => {
  it("une ligne a_planifier avec une trace de déplanification est en attente", () => {
    expect(
      estDeplanifieeEnAttente({
        statut: "a_planifier",
        deplanifiee_date: new Date("2026-10-01T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("sans trace de déplanification, jamais en attente", () => {
    expect(
      estDeplanifieeEnAttente({
        statut: "a_planifier",
        deplanifiee_date: null,
      }),
    ).toBe(false);
  });

  it("une trace mais un AUTRE statut (reposée depuis) n'est plus en attente", () => {
    expect(
      estDeplanifieeEnAttente({
        statut: "planifiee",
        deplanifiee_date: new Date("2026-10-01T00:00:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("motifSuspensionAffiche / compteurRegistreAffiche — le signe d'absence partagé", () => {
  it("un motif absent rend le signe d'absence", () => {
    expect(motifSuspensionAffiche(null)).toBe(SIGNE_ABSENCE);
  });

  it("un motif présent se rend tel quel", () => {
    expect(motifSuspensionAffiche("Attente pièce")).toBe("Attente pièce");
  });

  it("un temps mesuré absent rend le signe d'absence", () => {
    expect(compteurRegistreAffiche(null)).toBe(SIGNE_ABSENCE);
  });

  it("un temps mesuré connu se formate, jamais le signe d'absence", () => {
    expect(compteurRegistreAffiche(45)).not.toBe(SIGNE_ABSENCE);
  });
});

describe("texteRapportColonne — colonne « Rapport » (onglet À contrôler)", () => {
  it("aucune issue connue rend le signe d'absence", () => {
    expect(texteRapportColonne(null)).toBe(SIGNE_ABSENCE);
  });

  it("« signee » rend un texte dédié, jamais le signe d'absence", () => {
    const rendu = texteRapportColonne({ issue: "signee" });
    expect(rendu).not.toBe(SIGNE_ABSENCE);
    expect(rendu).toBe(t("interventions.colonne.rapport_signee"));
  });

  it("« client_absent » et « refus_signature » reprennent les textes déjà existants de la fiche", () => {
    expect(texteRapportColonne({ issue: "client_absent" })).toBe(
      t("intervention.realisation.signature_absente"),
    );
    expect(texteRapportColonne({ issue: "refus_signature" })).toBe(
      t("intervention.realisation.signature_refusee"),
    );
  });
});

describe("dateLocale — le même jour que `dateHeureLocale`, sans l'heure", () => {
  it("compose JJ/MM/AAAA", () => {
    expect(dateLocale(new Date("2026-10-07T12:00:00.000Z"), FUSEAU)).toBe(
      "07/10/2026",
    );
  });
});
