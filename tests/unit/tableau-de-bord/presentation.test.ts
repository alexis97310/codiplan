import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  compositionDuRole,
  detailAPlanifier,
  detailAujourdhui,
  detailEnAttenteDePiece,
  lienEnRetard,
  pasDemarree,
  prioritesEnRetard,
  prioritesP1APlanifier,
  prioritesPasDemarrees,
  tonEnRetard,
  tuilesRenduesDuRole,
} from "../../../app/(back-office)/tableau-de-bord/presentation";
import { t } from "@/lib/i18n/fr";

/**
 * CE QUE LE TABLEAU DE BORD COMPOSE, SELON LE RÔLE (9EG-TP-UX6-TABLEAU-DE-
 * BORD-1, D185).
 *
 * ## LA PAIRE DU §9 (11/09) EST TENUE PARTOUT ICI
 *
 * *« À côté de chaque cas qui doit rougir, un cas qui doit rester vert POUR SA
 * PROPRE RAISON. »*
 */

const DEBUT = new Date("2026-09-16T00:00:00.000Z");
const APRES = new Date("2026-09-16T10:00:00.000Z");
const SITE = { libelle: "Atelier Ducos" };
const CLIENT = { raison_sociale: "Lagon Maintenance" };
const REFERENCE = (ligne: { id: string; numero: number | null }) =>
  `INT-${ligne.numero}`;

describe("le rôle choisit la composition, jamais un droit", () => {
  it("responsable matériel et responsable SAV ont chacun leur composition", () => {
    expect(compositionDuRole(Role.responsable_materiel)).toBe(
      Role.responsable_materiel,
    );
    expect(compositionDuRole(Role.responsable_sav)).toBe(Role.responsable_sav);
  });

  it("LE CAS QUI DOIT RESTER VERT : l'ADV garde sa propre composition", () => {
    expect(compositionDuRole(Role.adv)).toBe(Role.adv);
  });

  it("direction et administrateur de société ont chacun leur composition (9EG-TP-UX6-TABLEAU-DE-BORD-2, D189)", () => {
    expect(compositionDuRole(Role.direction)).toBe(Role.direction);
    expect(compositionDuRole(Role.admin_societe)).toBe(Role.admin_societe);
  });
});

describe("les tuiles absentes sur main ne sont jamais rendues", () => {
  it("responsable matériel : trois tuiles seulement, « Réserves VGP » absente", () => {
    expect(tuilesRenduesDuRole(Role.responsable_materiel)).toEqual([
      "a_planifier",
      "en_retard",
      "suspendues",
    ]);
  });

  it("responsable SAV : trois tuiles seulement, « Retours sous 30 jours » absente", () => {
    expect(tuilesRenduesDuRole(Role.responsable_sav)).toEqual([
      "a_controler",
      "aujourdhui",
      "suspendues",
    ]);
  });

  it("LE CAS QUI DOIT RESTER VERT : l'ADV garde ses quatre tuiles, « À facturer » comprise dans la table mais absente du rendu", () => {
    expect(tuilesRenduesDuRole(Role.adv)).toEqual([
      "a_planifier",
      "aujourdhui",
      "en_retard",
    ]);
  });
});

describe("« pas démarrée » — affectée, du jour, créneau déjà passé", () => {
  it("une AFFECTÉE dont le créneau est passé compte", () => {
    expect(
      pasDemarree({ statut: "affectee", creneau_debut: DEBUT }, APRES),
    ).toBe(true);
  });

  it("LE CAS QUI DOIT RESTER VERT : une EN_COURS ne compte pas, même créneau passé", () => {
    expect(
      pasDemarree({ statut: "en_cours", creneau_debut: DEBUT }, APRES),
    ).toBe(false);
  });

  it("une affectée sans créneau ne compte pas", () => {
    expect(
      pasDemarree({ statut: "affectee", creneau_debut: null }, APRES),
    ).toBe(false);
  });
});

describe("le détail « Aujourd'hui » — en cours · terminée(s) · pas démarrée(s)", () => {
  it("accorde chaque voie à son propre compte", () => {
    const lignes = [
      { statut: "en_cours", creneau_debut: null },
      { statut: "terminee", creneau_debut: null },
      { statut: "terminee", creneau_debut: null },
      { statut: "affectee", creneau_debut: DEBUT },
    ];
    const detail = detailAujourdhui(lignes, APRES);
    expect(detail).toContain(`1 ${t("tableau_de_bord.jour_en_cours")}`);
    expect(detail).toContain(`2 ${t("tableau_de_bord.jour_terminees")}`);
    expect(detail).toContain(`1 ${t("tableau_de_bord.jour_pas_demarree_une")}`);
  });
});

describe("le détail « À planifier » — dont N P1, la plus ancienne", () => {
  it("nomme les P1 quand il y en a", () => {
    const lignes = [
      { priorite: "p1", cree_le: new Date("2026-09-10T00:00:00.000Z") },
      { priorite: "p3", cree_le: new Date("2026-09-15T00:00:00.000Z") },
    ];
    const detail = detailAPlanifier(lignes, APRES);
    expect(detail).toContain(
      t("tableau_de_bord.tuile_a_planifier_dont_p1_suffixe"),
    );
    expect(detail).toContain("6");
  });

  it("LE CAS QUI DOIT RESTER VERT : sans P1, le préfixe « dont » n'apparaît pas", () => {
    const lignes = [
      { priorite: "p3", cree_le: new Date("2026-09-15T00:00:00.000Z") },
    ];
    const detail = detailAPlanifier(lignes, APRES);
    expect(detail).not.toContain(
      t("tableau_de_bord.tuile_a_planifier_dont_p1_suffixe"),
    );
  });
});

describe("le détail « en attente de pièce » sous la tuile « Suspendues » (99V-GR6-TUILES)", () => {
  it("est ABSENT quand la file est vide — même règle que le détail « non affectée(s) » (§9, 06/09)", () => {
    expect(detailEnAttenteDePiece([])).toBeUndefined();
  });

  it("NOMME le compte de la file reçue, quel qu'il soit", () => {
    const detail = detailEnAttenteDePiece([{}, {}, {}]);
    expect(detail).toContain("3");
    expect(detail).toContain(
      t("tableau_de_bord.en_attente_detail_suffixe_piece"),
    );
  });
});

describe("« Priorités opérationnelles » : P1 à planifier (décision 47 d'Alexis)", () => {
  it("chaque P1 de la file devient une ligne « urgent »", () => {
    const lignes = [
      {
        id: "a",
        numero: 1,
        priorite: "p1",
        description: null,
        type: "curatif" as const,
        client: CLIENT,
        site: SITE,
      },
    ];
    const elements = prioritesP1APlanifier(lignes, REFERENCE);
    expect(elements).toHaveLength(1);
    expect(elements[0]?.type).toBe("urgent");
    expect(elements[0]?.titre).toContain(CLIENT.raison_sociale);
  });

  it("LE CAS QUI DOIT RESTER VERT : une P3 n'entre pas dans « P1 à planifier »", () => {
    const lignes = [
      {
        id: "b",
        numero: 2,
        priorite: "p3",
        description: null,
        type: "curatif" as const,
        client: CLIENT,
        site: SITE,
      },
    ];
    expect(prioritesP1APlanifier(lignes, REFERENCE)).toEqual([]);
  });
});

describe("« Priorités opérationnelles » : Pas démarrée", () => {
  it("une affectée du jour, créneau passé, devient une ligne « urgent »", () => {
    const lignes = [
      {
        id: "c",
        numero: 3,
        description: null,
        type: "curatif" as const,
        client: CLIENT,
        site: SITE,
        statut: "affectee",
        creneau_debut: DEBUT,
      },
    ];
    const elements = prioritesPasDemarrees(lignes, APRES, REFERENCE);
    expect(elements).toHaveLength(1);
    expect(elements[0]?.titre).toContain(
      t("tableau_de_bord.priorite_pas_demarree_titre"),
    );
  });
});

describe("« Priorités opérationnelles » : En retard — action « Déplacer… »", () => {
  it("chaque ligne porte le bouton « Déplacer… » vers le volet du planning", () => {
    const lignes = [
      {
        id: "d",
        numero: 4,
        description: null,
        type: "curatif" as const,
        client: CLIENT,
        site: SITE,
      },
    ];
    const elements = prioritesEnRetard(lignes, REFERENCE);
    expect(elements[0]?.actionLibelle).toBe(
      t("tableau_de_bord.priorite_action_deplacer"),
    );
    expect(elements[0]?.href).toBe("/planning?intervention=d");
  });
});

describe("« En retard » n'a de lien qu'au-dessus de zéro (décision du 30/09/2026, point 13 ; D144)", () => {
  it("À ZÉRO : aucun lien — « 0 » est la bonne nouvelle, pas une liste à ouvrir", () => {
    expect(lienEnRetard(0)).toBeUndefined();
  });

  it("LE CAS QUI DOIT RESTER VERT : au-dessus de zéro, le chemin de l'onglet « En retard »", () => {
    expect(lienEnRetard(1)).toBe("/interventions?vue=en_retard");
    expect(lienEnRetard(7)).toBe("/interventions?vue=en_retard");
  });
});

describe("« En retard » passe au vert à zéro (décision du 02/10/2026, point 4 ; D148)", () => {
  it("À ZÉRO : vert — même ton que la maquette (:2873, « good »)", () => {
    expect(tonEnRetard(0)).toBe("vert");
  });

  it("LE CAS QUI DOIT RESTER VERT : au-dessus de zéro, le ton reste rouge — non décidé (orange non repris)", () => {
    expect(tonEnRetard(1)).toBe("rouge");
    expect(tonEnRetard(7)).toBe("rouge");
  });

  it("la tuile du tableau de bord passe bien ce ton à `Kpi` (D185)", () => {
    const page = readFileSync(
      join(process.cwd(), "app/(back-office)/tableau-de-bord/page.tsx"),
      "utf8",
    );
    const indexBloc = page.indexOf('data-bloc="kpi-en-retard"');
    expect(indexBloc).toBeGreaterThan(-1);
    const indexKpi = page.indexOf("<Kpi", indexBloc);
    const finKpi = page.indexOf("/>", indexKpi);
    const baliseKpi = page.slice(indexKpi, finKpi);
    expect(baliseKpi).toMatch(/ton=\{tonEnRetard\(/);
  });
});
