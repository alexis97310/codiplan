import { describe, expect, it } from "vitest";

import { resumerLeParc, type LigneDeParc } from "@/lib/machines/depot";

/**
 * LE GARDIEN CENTRAL DU POINT 1 (lot PERF, mesuré sur 4fead41).
 *
 * `resumerLeParcFiltre` lisait `CHAMPS_PARC` (huit colonnes, deux jointures)
 * pour alimenter `resumerLeParc`, qui ne lit jamais que trois champs :
 * `statut`, `complet`, `garantie_fin`. La lecture a été resserrée à ces trois
 * champs (`CHAMPS_RESUME_PARC`) — MÊME `where`, MÊME `take`, colonnes en
 * moins.
 *
 * **Ce test ne fait confiance à aucun raisonnement : il PROUVE, sur des
 * lignes complètes puis sur les trois mêmes lignes réduites aux trois champs
 * lus, que `resumerLeParc` rend EXACTEMENT le même résultat** — chiffre par
 * chiffre, aux bornes de la fenêtre de garantie (90 jours). Si un jour
 * `resumerLeParc` se met à lire un quatrième champ (`numero_serie` pour un
 * nouveau compte, par exemple), ce test rouvrira tout seul : la version
 * réduite n'aura plus ce champ et `resumerLeParc` rendra `undefined` là où il
 * attend une valeur.
 */

const MAINTENANT = new Date("2026-09-19T00:00:00Z");
const JOUR = 24 * 60 * 60 * 1000;

function ligneComplete(
  id: string,
  statut: LigneDeParc["statut"],
  complet: boolean,
  garantieFin: Date | null,
): LigneDeParc {
  return {
    id,
    numero: null,
    numero_serie: `SN-${id}`,
    reference_interne: null,
    statut,
    criticite: "normale",
    complet,
    localisation: null,
    date_mise_en_service: null,
    date_vente: null,
    garantie_fin: garantieFin,
    client_id: "01a0e2e0-0000-7000-8000-00000000000c",
    modele: {
      reference: "CP-500",
      marque: "Kaeser",
      famille: { libelle: "Compresseurs" },
    },
    client: { raison_sociale: "Client démonstration" },
    site: {
      libelle: "Atelier",
      commune: null,
      agence: { libelle: "Ducos" },
    },
  };
}

// LE JEU, AUX BORNES (D6, AT-04) : une due AUJOURD'HUI (borne basse, 0 jour),
// une due DEMAIN, une SUR LA BORNE des 90 jours, une déjà DÉPASSÉE hier, une
// sans garantie du tout, et deux statuts terminaux pour peupler `actives`.
const LIGNES_COMPLETES: readonly LigneDeParc[] = [
  ligneComplete("m1", "en_service", true, MAINTENANT),
  ligneComplete(
    "m2",
    "en_service",
    true,
    new Date(MAINTENANT.getTime() + JOUR),
  ),
  ligneComplete(
    "m3",
    "en_panne",
    true,
    new Date(MAINTENANT.getTime() + 90 * JOUR),
  ),
  ligneComplete("m4", "arretee", false, new Date(MAINTENANT.getTime() - JOUR)),
  ligneComplete("m5", "en_service", true, null),
  ligneComplete("m6", "remplacee", true, null),
  ligneComplete("m7", "ferraillee", true, null),
];

// LA VALEUR FIGÉE, relevée AVANT le resserrement de la sélection — le
// comportement de `resumerLeParc` lui-même n'a pas bougé d'une ligne.
const RESUME_FIGE = {
  total: 7,
  parStatut: {
    en_service: 3,
    en_panne: 1,
    arretee: 1,
    remplacee: 1,
    ferraillee: 1,
  },
  incompletes: 1,
  actives: 5,
  enPanneOuArretees: 2,
  garantieExpirant90j: 3,
};

describe("le résumé du parc résiste au resserrement de la sélection (lot PERF)", () => {
  it("rend la valeur figée sur des lignes COMPLÈTES (CHAMPS_PARC, l'ancienne lecture)", () => {
    expect(resumerLeParc(LIGNES_COMPLETES, MAINTENANT)).toEqual(RESUME_FIGE);
  });

  it("rend EXACTEMENT le même résultat sur les lignes réduites aux trois champs lus (CHAMPS_RESUME_PARC, la nouvelle lecture)", () => {
    const lignesEtroites = LIGNES_COMPLETES.map(
      ({ statut, complet, garantie_fin }) => ({
        statut,
        complet,
        garantie_fin,
      }),
    );
    expect(resumerLeParc(lignesEtroites, MAINTENANT)).toEqual(RESUME_FIGE);
    expect(resumerLeParc(lignesEtroites, MAINTENANT)).toEqual(
      resumerLeParc(LIGNES_COMPLETES, MAINTENANT),
    );
  });
});
