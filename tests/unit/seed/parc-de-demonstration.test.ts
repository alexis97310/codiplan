import { AssujettissementVgp } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  FAMILLES_MATERIEL_DEMONSTRATION,
  MACHINES_DEMONSTRATION,
  MODELES_MATERIEL_DEMONSTRATION,
  VERIFICATIONS_VGP_DEMONSTRATION,
} from "../../../prisma/seed-data";

/**
 * CE QUE LE PARC DE DÉMONSTRATION DOIT DONNER À VOIR (R3-10).
 *
 * ## POURQUOI UN GARDIEN, ALORS QUE CE SONT DES DONNÉES DE DÉMONSTRATION
 *
 * *Les captures sont le seul moyen pour l'arbitre du projet de juger un écran.*
 * Une ligne retirée du jeu de démonstration fait disparaître une DISTINCTION
 * des images — les quatre valeurs d'assujettissement, les trois états
 * d'information — **sans qu'aucune suite ne rougisse** : les scénarios
 * éprouvent les règles, pas ce que l'œil verra. Ce gardien tient la promesse du
 * ticket, et lui seul.
 *
 * ## LA POPULATION EST DÉRIVÉE DE L'ÉNUMÉRATION, JAMAIS RECOPIÉE
 *
 * Elle vient de `AssujettissementVgp` : *le jour où une cinquième valeur est
 * ajoutée, ce gardien la réclame de lui-même* — c'est la clôture par le schéma
 * de D41, à l'échelle d'un jeu de données. Une liste recopiée ici serait la
 * seconde copie qui devient fausse en silence (§9, 01/09).
 */
describe("le parc de démonstration montre ce qu'il promet de montrer", () => {
  it("les QUATRE valeurs d'assujettissement sont représentées, pas trois", () => {
    // Le ticket annonçait « les trois régimes ». `AssujettissementVgp` en porte
    // QUATRE depuis L9-04 — `verifie` étant « examiné, et le texte ne tranche
    // pas ». *Une démonstration qui en couvrirait trois laisserait la
    // quatrième invisible, et personne ne saurait qu'elle existe.*
    const couvertes = new Set(
      FAMILLES_MATERIEL_DEMONSTRATION.map((f) => f.assujettissement),
    );
    for (const valeur of Object.values(AssujettissementVgp)) {
      expect(
        couvertes.has(valeur),
        `aucune famille de démonstration ne porte « ${valeur} » : cette ` +
          "valeur n'apparaîtra sur aucune capture, et l'arbitre du projet ne " +
          "pourra pas juger ce que l'écran en fait.",
      ).toBe(true);
    }
  });

  it("une famille SOUMISE porte sa périodicité ET son texte — la base le refuse autrement", () => {
    const soumises = FAMILLES_MATERIEL_DEMONSTRATION.filter(
      (f) => f.assujettissement === AssujettissementVgp.soumis,
    );
    // TÉMOIN : sans cette ligne, une liste sans aucune famille soumise
    // passerait la boucle suivante sans rien regarder (§9, 30/08).
    expect(soumises.length).toBeGreaterThan(0);
    for (const famille of soumises) {
      expect(famille.vgpPeriodiciteMois).not.toBeNull();
      expect(famille.vgpReferenceTexte).not.toBeNull();
    }
  });

  it("LA CASCADE EST VISIBLE : un modèle PRÉCISE un rythme que sa famille dit autrement", () => {
    // Sans un tel modèle, l'origine « modèle » ne s'afficherait jamais, et la
    // cascade de D56 — *un nombre ne voyage pas sans son référentiel* — serait
    // une règle qu'aucune image ne montre.
    const precisions = MODELES_MATERIEL_DEMONSTRATION.filter(
      (m) => m.vgpPeriodiciteMois !== null,
    );
    expect(precisions.length).toBeGreaterThan(0);
    for (const modele of precisions) {
      const famille = FAMILLES_MATERIEL_DEMONSTRATION.find(
        (f) => f.code === modele.familleCode,
      );
      expect(famille).toBeDefined();
      expect(modele.vgpReferenceTexte).not.toBeNull();
    }
  });

  it("LES TROIS ÉTATS D'INFORMATION ont chacun au moins une machine", () => {
    const familleDuModele = new Map(
      MODELES_MATERIEL_DEMONSTRATION.map((m) => [m.rang, m.familleCode]),
    );
    const assujettissementDeLaFamille = new Map(
      FAMILLES_MATERIEL_DEMONSTRATION.map((f) => [f.code, f.assujettissement]),
    );
    const avecInformation = new Set(
      VERIFICATIONS_VGP_DEMONSTRATION.map((v) => v.machineRang),
    );

    const regime = (machine: (typeof MACHINES_DEMONSTRATION)[number]) =>
      machine.vgpException ??
      assujettissementDeLaFamille.get(
        familleDuModele.get(machine.modeleRang) ?? "",
      );

    const soumises = MACHINES_DEMONSTRATION.filter(
      (m) => regime(m) === AssujettissementVgp.soumis,
    );

    // `hors_registre` — la question ne se pose pas.
    expect(
      MACHINES_DEMONSTRATION.some(
        (m) => regime(m) !== AssujettissementVgp.soumis,
      ),
      "aucune machine hors registre : l'écran ne montrerait jamais la " +
        "différence entre « la question ne se pose pas » et « elle se pose et " +
        "nous n'avons pas la réponse ».",
    ).toBe(true);

    // `sans_information` — elle se pose, et nous n'avons rien reçu. **C'est la
    // moitié que D88 protège** : un registre à moitié rempli ressemble à un
    // registre complet.
    expect(
      soumises.some((m) => !avecInformation.has(m.rang)),
      "toutes les machines soumises portent une information : « sans " +
        "information depuis X » n'apparaîtrait sur aucune capture.",
    ).toBe(true);

    // `information_recue` — le TÉMOIN de la précédente : sans lui, l'assertion
    // ci-dessus serait verte sur un jeu qui ne porte AUCUNE vérification.
    expect(
      soumises.some((m) => avecInformation.has(m.rang)),
      "aucune machine soumise ne porte d'information reçue : la colonne " +
        "serait uniformément vide, et « sans information » se lirait comme " +
        "l'état normal.",
    ).toBe(true);
  });

  it("UNE FICHE INCOMPLÈTE, et son numéro n'est JAMAIS nul (D6)", () => {
    const incompletes = MACHINES_DEMONSTRATION.filter((m) => !m.complet);
    expect(incompletes.length).toBeGreaterThan(0);
    for (const machine of incompletes) {
      // *Deux `NULL` sont distincts pour un index unique* : le numéro illisible
      // se saisit `SN-INCONNU-<référence>`, jamais `NULL`.
      expect(machine.numeroSerie.startsWith("SN-INCONNU-")).toBe(true);
    }
    // ET LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : les fiches
    // COMPLÈTES ne portent pas ce préfixe. Sans lui, un jeu où toutes les
    // machines seraient marquées incomplètes passerait pour juste.
    for (const machine of MACHINES_DEMONSTRATION.filter((m) => m.complet)) {
      expect(machine.numeroSerie.startsWith("SN-INCONNU-")).toBe(false);
    }
  });

  it("UNE EXCEPTION D'EXEMPLAIRE, et jamais sans sa raison (L9-06)", () => {
    const exceptions = MACHINES_DEMONSTRATION.filter(
      (m) => m.vgpException !== undefined,
    );
    expect(exceptions.length).toBeGreaterThan(0);
    for (const machine of exceptions) {
      expect(machine.vgpExceptionMotif).toBeDefined();
    }
    // Les deux sens : un motif sans exception est une trace qui ne se rattache
    // à rien, et la base le refuse aussi.
    for (const machine of MACHINES_DEMONSTRATION.filter(
      (m) => m.vgpException === undefined,
    )) {
      expect(machine.vgpExceptionMotif).toBeUndefined();
    }
  });

  it("les rangs sont uniques — deux lignes de même rang partageraient un identifiant", () => {
    const rangs = MACHINES_DEMONSTRATION.map((m) => m.rang);
    expect(new Set(rangs).size).toBe(rangs.length);
    const rangsFamilles = FAMILLES_MATERIEL_DEMONSTRATION.map((f) => f.rang);
    expect(new Set(rangsFamilles).size).toBe(rangsFamilles.length);
    const rangsModeles = MODELES_MATERIEL_DEMONSTRATION.map((m) => m.rang);
    expect(new Set(rangsModeles).size).toBe(rangsModeles.length);
  });
});
