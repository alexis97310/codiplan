import { describe, expect, it } from "vitest";

import {
  COLONNES_CLIENTS,
  COLONNES_CONTACTS,
  DETAIL_DE_SAISIE,
  MOTIF_SAISIE_REFUSEE,
  colonneEnCause,
} from "@/lib/imports/modeles";

/**
 * LA COLONNE ET LA VALEUR D'UNE SAISIE REFUSÉE (9AK-GR15-MOTIF-REJET, gain
 * GR15b). `colonneEnCause` rejoue la MÊME lecture que le contrôle — jamais une
 * seconde règle — et rend `null` quand rien n'est attribuable à une colonne du
 * gabarit (une ligne saine, ou un rejet dont la seule cause est un parent
 * résolu).
 */
describe("colonneEnCause nomme la colonne et la valeur d'une saisie refusée", () => {
  it("clients sans raison sociale : la colonne et une valeur vide", () => {
    const detail = DETAIL_DE_SAISIE.clients!;
    const trouve = colonneEnCause(
      { [COLONNES_CLIENTS.raisonSociale]: "   " },
      detail.champs,
      detail.schema,
    );
    expect(trouve).toEqual({
      colonne: COLONNES_CLIENTS.raisonSociale,
      valeur: "",
    });
  });

  it("une ligne saine ne met rien en cause", () => {
    const detail = DETAIL_DE_SAISIE.clients!;
    const trouve = colonneEnCause(
      { [COLONNES_CLIENTS.raisonSociale]: "Garage Dupont" },
      detail.champs,
      detail.schema,
    );
    expect(trouve).toBeNull();
  });

  it("un autre gabarit : un courriel mal formé rend SA colonne et SA valeur", () => {
    // `schemaCreationContact` exige aussi `client_id` et `roles`, absents ici
    // parce qu'ils sont résolus, jamais saisis (I10) — leurs issues ne
    // désignent aucune colonne de `CHAMPS_CONTACTS` et sont donc ignorées.
    const detail = DETAIL_DE_SAISIE.contacts!;
    const trouve = colonneEnCause(
      {
        [COLONNES_CONTACTS.nom]: "Jean Dupont",
        [COLONNES_CONTACTS.email]: "pas-un-courriel",
      },
      detail.champs,
      detail.schema,
    );
    expect(trouve).toEqual({
      colonne: COLONNES_CONTACTS.email,
      valeur: "pas-un-courriel",
    });
  });

  it("un rejet dont la seule cause est un parent résolu rend null", () => {
    // Aucune colonne de `CHAMPS_CONTACTS` n'est en cause : seuls `client_id` et
    // `roles`, résolus, manquent. Ce n'est pas le rôle de cette fonction — voir
    // `MOTIF_PARENT_INTROUVABLE`.
    const detail = DETAIL_DE_SAISIE.contacts!;
    const trouve = colonneEnCause(
      { [COLONNES_CONTACTS.nom]: "Jean Dupont", [COLONNES_CONTACTS.email]: "" },
      detail.champs,
      detail.schema,
    );
    expect(trouve).toBeNull();
  });

  it("un type absent de la table n'a AUCUNE entrée", () => {
    // L'historique, la VGP, ses observations et le second schéma des familles
    // mélangent colonnes brutes et valeurs calculées : mesuré non établi (voir
    // le docblock de `DETAIL_DE_SAISIE`).
    expect(Object.hasOwn(DETAIL_DE_SAISIE, "historique")).toBe(false);
    expect(Object.hasOwn(DETAIL_DE_SAISIE, "vgp")).toBe(false);
    expect(Object.hasOwn(DETAIL_DE_SAISIE, "vgp_observations")).toBe(false);
  });

  it("le code du motif générique reste inchangé", () => {
    expect(MOTIF_SAISIE_REFUSEE).toBe("saisie_refusee");
  });
});
