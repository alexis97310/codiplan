import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n";
import { type EtatInformation } from "@/lib/vgp/information";
import { libelleEcheance } from "@/lib/vgp/libelles";

/**
 * L'ÉCHÉANCE DÉDUITE SE MONTRE, ET ELLE NE DEVIENT JAMAIS UN VERDICT (R3-11).
 *
 * ## LE DÉFAUT, MESURÉ SUR UNE IMAGE
 *
 * *Le 13/09/2026*, dès que le parc de démonstration a donné au registre de quoi
 * s'afficher : `NUS-SPL-2022-0007` portait « Information reçue — 13/07/2025 »
 * et une périodicité de **six mois précisée au modèle**. Son échéance était
 * passée depuis huit mois, **et rien à l'écran ne le disait** — un œil qui lit
 * cette ligne voit une machine renseignée. *La valeur était déjà calculée par
 * `etatDeLInformation` et rendue par `listerLeRegistre` ; seule la colonne
 * manquait.*
 *
 * ## LA FRONTIÈRE QUE CE TICKET NE FRANCHIT PAS
 *
 * **Aucune durée nouvelle n'est écrite** : ni seuil, ni tolérance, ni
 * « bientôt » (L9-05). Ce qui s'affiche est la DATE déduite d'une périodicité
 * SAISIE, et le nombre de jours d'écart — une soustraction, jamais un jugement.
 * Et jamais « à jour » : *CODIPLAN n'affirme pas la conformité* (D88).
 */
const LE_15_JANVIER = new Date("2026-01-15T00:00:00.000Z");

describe("l'échéance déduite devient du texte à un seul endroit", () => {
  it("une échéance À VENIR se dit, avec sa date", () => {
    const etat: EtatInformation = {
      etat: "information_recue",
      derniereInformation: new Date("2025-07-15T00:00:00.000Z"),
      prochaineEcheance: LE_15_JANVIER,
      joursAvantEcheance: 30,
    };
    const texte = libelleEcheance(etat);
    expect(texte).not.toBeNull();
    expect(texte).toContain("15/01/2026");
  });

  it("une échéance DÉPASSÉE se distingue, et le nombre de jours est une soustraction", () => {
    const etat: EtatInformation = {
      etat: "information_recue",
      derniereInformation: new Date("2025-07-15T00:00:00.000Z"),
      prochaineEcheance: LE_15_JANVIER,
      joursAvantEcheance: -243,
    };
    const texte = libelleEcheance(etat) ?? "";
    expect(texte).toContain("15/01/2026");
    expect(texte).toContain("243");
    // *La distinction doit se lire*, sans quoi la ligne dépassée ressemble à
    // la ligne renseignée — le défaut que ce ticket répare.
    expect(texte).not.toBe(
      libelleEcheance({ ...etat, joursAvantEcheance: 30 }),
    );
  });

  it("SANS PÉRIODICITÉ DÉCLARÉE, elle dit qu'il n'y a rien à déduire — jamais « à jour »", () => {
    const texte = libelleEcheance({
      etat: "information_recue",
      derniereInformation: new Date("2025-07-15T00:00:00.000Z"),
      prochaineEcheance: null,
      joursAvantEcheance: null,
    });
    expect(texte).not.toBeNull();
    expect((texte ?? "").length).toBeGreaterThan(0);
  });

  it("les deux états SANS information reçue ne rendent RIEN à afficher", () => {
    // Il n'y a pas d'échéance à déduire de ce qu'on ne nous a pas dit. `null`
    // dit « cette colonne n'a rien à montrer ici » ; l'écran, lui, écrit un
    // signe et jamais une phrase.
    expect(
      libelleEcheance({ etat: "hors_registre", assujettissement: "soumis" }),
    ).toBeNull();
    expect(
      libelleEcheance({
        etat: "sans_information",
        depuis: new Date("2024-01-01T00:00:00.000Z"),
        joursSansInformation: 500,
      }),
    ).toBeNull();
  });

  it("AUCUN VERDICT DE CONFORMITÉ dans les libellés qu'elle peut rendre", () => {
    // La population vient du dictionnaire, jamais d'une liste recopiée : une
    // clé ajoutée demain est jugée le jour même.
    const interdits = ["conforme", "à jour", "en règle", "valide"];
    for (const [cle, valeur] of Object.entries(fr)) {
      if (!cle.startsWith("vgp.echeance")) {
        continue;
      }
      for (const mot of interdits) {
        expect(
          valeur.toLowerCase().includes(mot),
          `${cle} porte « ${mot} » : CODIPLAN n'affirme jamais la conformité (D88).`,
        ).toBe(false);
      }
    }
    // TÉMOIN : la boucle a bien vu des clés — sans lui, zéro clé passerait.
    expect(
      Object.keys(fr).filter((cle) => cle.startsWith("vgp.echeance")).length,
    ).toBeGreaterThan(0);
  });
});
