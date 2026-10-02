import { describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { CAPACITE_DU_TYPE, peutImporterLeType } from "@/lib/imports/droits";
import { APPLICATIONS, SANS_APPLICATION } from "@/lib/imports/types-dimport";

import { TYPES_DIMPORT } from "../../../app/(back-office)/imports/types";

/**
 * QT-3 (audit du 28/09/2026, D150) — L'IMPORT SUIT LES DROITS DE L'ÉCRAN DE
 * SON TYPE.
 *
 * ## Ce que ce gardien tient
 *
 * **`CAPACITE_DU_TYPE` est fermée dans les DEUX sens** contre trois sources
 * qu'elle ne contrôle pas — `APPLICATIONS`, `SANS_APPLICATION` (ce qu'on sait
 * ÉCRIRE ou pas, `lib/imports/types-dimport.ts`) et `TYPES_DIMPORT` (ce que
 * l'écran publie, `app/(back-office)/imports/types.ts`) : un type ajouté
 * demain à l'une des trois sans entrée de droits fait rougir ce gardien le
 * jour même, et une entrée de droits qui ne correspond plus à aucun type
 * publié fait rougir la même assertion dans l'autre sens.
 *
 * **La matrice rôle × type est ÉCRITE EN CLAIR**, comme
 * `tests/unit/imports/types-dimport.test.ts` écrit « importerApres » : ce
 * n'est pas une dérivation, c'est ce que D150 a décidé, confronté à la
 * fonction pure qui l'applique.
 */

describe("CAPACITE_DU_TYPE est fermée dans les deux sens", () => {
  it("couvre exactement les types que lib/imports/ connaît", () => {
    const connus = [
      ...Object.keys(APPLICATIONS),
      ...Object.keys(SANS_APPLICATION),
    ].sort();
    expect(Object.keys(CAPACITE_DU_TYPE).sort()).toEqual(connus);
  });

  it("couvre exactement les types que l'écran publie", () => {
    const publies = TYPES_DIMPORT.map((type) => type.cle).sort();
    expect(Object.keys(CAPACITE_DU_TYPE).sort()).toEqual(publies);
  });
});

/**
 * LA MATRICE DE D150 — dix rôles, dix types.
 *
 * `clients` et `sites` exigent `gerer_client_site` (D130) ; `familles`,
 * `modeles` et `prestations` exigent `parametrer_societe` (le droit de leur
 * écran, ○ de la direction compris, PA-02 non tranché) ; les cinq autres
 * n'exigent rien de plus que `importer_exporter`.
 */
const MATRICE_ATTENDUE: Readonly<
  Record<Role, Readonly<Record<string, boolean>>>
> = {
  [Role.admin_plateforme]: toutFaux(),
  [Role.editeur_commercial]: toutFaux(),
  [Role.editeur_support]: toutFaux(),
  [Role.admin_societe]: toutVrai(),
  [Role.direction]: toutVrai(),
  [Role.responsable_materiel]: {
    clients: false,
    sites: false,
    familles: false,
    modeles: false,
    prestations: false,
    equipements: true,
    historique: true,
    vgp: true,
    vgp_observations: true,
    contacts: true,
  },
  [Role.responsable_sav]: {
    clients: false,
    sites: false,
    familles: false,
    modeles: false,
    prestations: false,
    equipements: true,
    historique: true,
    vgp: true,
    vgp_observations: true,
    contacts: true,
  },
  [Role.adv]: {
    clients: true,
    sites: true,
    familles: false,
    modeles: false,
    prestations: false,
    equipements: true,
    historique: true,
    vgp: true,
    vgp_observations: true,
    contacts: true,
  },
  [Role.technicien]: toutFaux(),
  [Role.client]: toutFaux(),
};

function toutVrai(): Readonly<Record<string, boolean>> {
  return Object.fromEntries(TYPES_DIMPORT.map((type) => [type.cle, true]));
}

function toutFaux(): Readonly<Record<string, boolean>> {
  return Object.fromEntries(TYPES_DIMPORT.map((type) => [type.cle, false]));
}

describe("peutImporterLeType suit exactement la matrice de D150", () => {
  for (const role of Object.values(Role)) {
    const attendu = MATRICE_ATTENDUE[role];
    for (const type of TYPES_DIMPORT.map((t) => t.cle)) {
      it(`${role} × ${type} → ${attendu[type]}`, () => {
        expect(peutImporterLeType(role, type)).toBe(attendu[type]);
      });
    }
  }

  it("un type inconnu de la table est refusé, quel que soit le rôle", () => {
    expect(peutImporterLeType(Role.admin_societe, "inexistant")).toBe(false);
  });
});

describe("notamment (rappel explicite, QT-3)", () => {
  it("RM et RS sont refusés sur clients et sites (D130)", () => {
    expect(peutImporterLeType(Role.responsable_materiel, "clients")).toBe(
      false,
    );
    expect(peutImporterLeType(Role.responsable_materiel, "sites")).toBe(false);
    expect(peutImporterLeType(Role.responsable_sav, "clients")).toBe(false);
    expect(peutImporterLeType(Role.responsable_sav, "sites")).toBe(false);
  });

  it("RM, RS et ADV sont refusés sur familles, modèles et prestations", () => {
    for (const role of [
      Role.responsable_materiel,
      Role.responsable_sav,
      Role.adv,
    ]) {
      expect(peutImporterLeType(role, "familles")).toBe(false);
      expect(peutImporterLeType(role, "modeles")).toBe(false);
      expect(peutImporterLeType(role, "prestations")).toBe(false);
    }
  });

  it("la direction accepte partout où importer_exporter l'accepte", () => {
    for (const type of TYPES_DIMPORT.map((t) => t.cle)) {
      expect(peutImporterLeType(Role.direction, type)).toBe(true);
    }
  });

  it("le technicien et le client sont refusés partout", () => {
    for (const type of TYPES_DIMPORT.map((t) => t.cle)) {
      expect(peutImporterLeType(Role.technicien, type)).toBe(false);
      expect(peutImporterLeType(Role.client, type)).toBe(false);
    }
  });
});
