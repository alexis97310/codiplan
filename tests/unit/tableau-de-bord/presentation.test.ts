import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  barresParNature,
  compositionDuRole,
  detailAccesAOuvrir,
  detailAPlanifier,
  detailAujourdhui,
  detailEnAttenteDePiece,
  etapesMiseEnRoute,
  libelleActionJournal,
  libelleClotureEnMois,
  libelleCompteJournal,
  libelleEntiteJournal,
  libelleHabilitationsARenouveler,
  libelleHabilitationsExpirees,
  libelleJauge,
  lienEcritureJournal,
  lienEnRetard,
  pasDemarree,
  pourcentageJauge,
  prioritesEnRetard,
  prioritesP1APlanifier,
  prioritesPasDemarrees,
  titreBlocMois,
  tonEnRetard,
  tuilesRenduesDuRole,
  type FaitsMiseEnRoutePourPresentation,
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

// ═══ 9EG-TP-UX6-TABLEAU-DE-BORD-2 (D189) ═══════════════════════════════

describe("les tuiles de la direction et de l'administrateur (D189)", () => {
  it("direction : trois tuiles, « À facturer » absente", () => {
    expect(tuilesRenduesDuRole(Role.direction)).toEqual([
      "cloture_en_mois",
      "en_retard",
      "parc_suivi",
    ]);
  });

  it("administrateur : ses quatre tuiles, aucune absente", () => {
    expect(tuilesRenduesDuRole(Role.admin_societe)).toEqual([
      "acces_a_ouvrir",
      "donnees_a_completer",
      "import_en_controle",
      "parc_suivi",
    ]);
  });
});

describe("« Clôturé en <mois> » (direction)", () => {
  it("compose le mois en toutes lettres, en minuscule", () => {
    expect(libelleClotureEnMois(9)).toBe(
      `${t("tableau_de_bord.tuile_cloture_prefixe")} ${t("mois.9").toLowerCase()}`,
    );
  });
});

describe("« Clôturées par nature » — barres triées, zéro masqué", () => {
  it("masque les natures à zéro et trie décroissant", () => {
    const comptes = new Map([
      ["curatif" as const, 2],
      ["preventif_contrat" as const, 0],
      ["installation" as const, 5],
    ]);
    expect(barresParNature(comptes)).toEqual([
      { type: "installation", compte: 5 },
      { type: "curatif", compte: 2 },
    ]);
  });

  it("LE CAS QUI DOIT RESTER VERT : une carte sans aucune clôture rend une liste vide", () => {
    expect(barresParNature(new Map())).toEqual([]);
  });
});

describe("« Accès à ouvrir » — détail « N liens envoyés · N sans lien »", () => {
  it("compte chaque état séparément", () => {
    const lignes = [
      { etat: { etat: "lien_envoye" } },
      { etat: { etat: "lien_envoye" } },
      { etat: { etat: "aucun" } },
    ];
    const detail = detailAccesAOuvrir(lignes);
    expect(detail).toContain(
      `2 ${t("tableau_de_bord.acces_detail_lien_envoye")}`,
    );
    expect(detail).toContain(
      `1 ${t("tableau_de_bord.acces_detail_sans_lien")}`,
    );
  });

  it("LE CAS QUI DOIT RESTER VERT : un seul lien envoyé accorde le singulier", () => {
    const detail = detailAccesAOuvrir([{ etat: { etat: "lien_envoye" } }]);
    expect(detail).toContain(
      `1 ${t("tableau_de_bord.acces_detail_lien_envoye_un")}`,
    );
  });
});

describe("la bande de l'administrateur — habilitations expirées / à renouveler", () => {
  it("accorde le singulier à un seul élément", () => {
    expect(libelleHabilitationsExpirees(1)).toBe(
      t("tableau_de_bord.bande_habilitation_expiree_un"),
    );
    expect(libelleHabilitationsARenouveler(1)).toBe(
      t("tableau_de_bord.bande_habilitation_renouveler_un"),
    );
  });

  it("LE CAS QUI DOIT RESTER VERT : zéro ou plusieurs accordent le pluriel", () => {
    expect(libelleHabilitationsExpirees(0)).toBe(
      t("tableau_de_bord.bande_habilitation_expiree"),
    );
    expect(libelleHabilitationsARenouveler(3)).toBe(
      t("tableau_de_bord.bande_habilitation_renouveler"),
    );
  });
});

describe("« Mise en route » — huit étapes, un choix du pilote validé par Alexis le 05/10/2026 (décision 29)", () => {
  const TOUT_FAIT: FaitsMiseEnRoutePourPresentation = {
    agenceAvecHoraires: true,
    tauxHoraire: true,
    trajetsEtForfaits: true,
    familleMateriel: true,
    famillesADeterminerCompte: 0,
    equipePosee: true,
    accesAOuvrirCompte: 0,
    clientsSitesMachines: true,
    planningTransmis: true,
  };

  it("une société neuve (rien n'est fait, sauf l'identité toujours vraie) montre une seule étape faite sur huit", () => {
    const rien: FaitsMiseEnRoutePourPresentation = {
      agenceAvecHoraires: false,
      tauxHoraire: false,
      trajetsEtForfaits: false,
      familleMateriel: false,
      famillesADeterminerCompte: 0,
      equipePosee: false,
      accesAOuvrirCompte: 0,
      clientsSitesMachines: false,
      planningTransmis: false,
    };
    const etapes = etapesMiseEnRoute(rien);
    expect(etapes).toHaveLength(8);
    expect(etapes.filter((e) => e.fait)).toHaveLength(1);
    expect(etapes[0]?.fait).toBe(true);
  });

  it("LE CAS QUI DOIT RESTER VERT : tout fait montre huit étapes faites sur huit", () => {
    const etapes = etapesMiseEnRoute(TOUT_FAIT);
    expect(etapes.filter((e) => e.fait)).toHaveLength(8);
  });

  it.each([
    ["agenceAvecHoraires", 1],
    ["tauxHoraire", 2],
    ["trajetsEtForfaits", 3],
    ["familleMateriel", 4],
    ["equipePosee", 5],
    ["clientsSitesMachines", 6],
    ["planningTransmis", 7],
  ] as const)(
    "chaque critère seul manquant laisse SEULEMENT son étape %s (index %i) non faite",
    (cle, index) => {
      const faits: FaitsMiseEnRoutePourPresentation = {
        ...TOUT_FAIT,
        [cle]: false,
      };
      const etapes = etapesMiseEnRoute(faits);
      const nonFaites = etapes
        .map((e, i) => ({ fait: e.fait, i }))
        .filter((e) => !e.fait)
        .map((e) => e.i);
      expect(nonFaites).toEqual([index]);
    },
  );

  it("« familleMateriel » seul manquant, ou des familles à déterminer, laissent l'étape 4 non faite", () => {
    expect(
      etapesMiseEnRoute({
        ...TOUT_FAIT,
        famillesADeterminerCompte: 2,
      })[4]?.fait,
    ).toBe(false);
  });

  it("« equipePosee » vrai mais des accès à ouvrir laissent l'étape 5 non faite", () => {
    expect(
      etapesMiseEnRoute({ ...TOUT_FAIT, accesAOuvrirCompte: 3 })[5]?.fait,
    ).toBe(false);
  });

  it("l'étape 1, « Identité de la société », est TOUJOURS faite", () => {
    expect(
      etapesMiseEnRoute({
        agenceAvecHoraires: false,
        tauxHoraire: false,
        trajetsEtForfaits: false,
        familleMateriel: false,
        famillesADeterminerCompte: 0,
        equipePosee: false,
        accesAOuvrirCompte: 0,
        clientsSitesMachines: false,
        planningTransmis: false,
      })[0]?.fait,
    ).toBe(true);
  });
});

describe("« N sur 8 » — la jauge montre toujours le numérateur ET le dénominateur (D56)", () => {
  it("compose le libellé depuis le compte réel d'étapes faites", () => {
    const etapes = etapesMiseEnRoute({
      agenceAvecHoraires: true,
      tauxHoraire: false,
      trajetsEtForfaits: false,
      familleMateriel: false,
      famillesADeterminerCompte: 0,
      equipePosee: false,
      accesAOuvrirCompte: 0,
      clientsSitesMachines: false,
      planningTransmis: false,
    });
    expect(libelleJauge(etapes)).toBe(
      `2 ${t("tableau_de_bord.mise_en_route_sur")} 8`,
    );
    expect(pourcentageJauge(etapes)).toBe(25);
  });
});

describe("le journal d'aujourd'hui (I8, D32, décision 27 d'Alexis du 05/10/2026)", () => {
  it("une entité connue affiche son libellé en clair", () => {
    expect(libelleEntiteJournal("intervention")).toBe(
      t("journal.entite.intervention"),
    );
  });

  it("LE CAS QUI DOIT RESTER VERT : une entité inconnue s'affiche par son nom de table brut", () => {
    expect(libelleEntiteJournal("une_table_inconnue")).toBe(
      "une_table_inconnue",
    );
  });

  it("une action connue affiche son libellé en clair, une action inconnue s'affiche telle quelle", () => {
    expect(libelleActionJournal("creation")).toBe(t("journal.action.creation"));
    expect(libelleActionJournal("une_action_inconnue")).toBe(
      "une_action_inconnue",
    );
  });

  it("le lien de fiche ne porte que l'intervention et la demande", () => {
    expect(
      lienEcritureJournal({
        entite: "intervention",
        entiteId: "i1",
        action: "creation",
        horodatage: DEBUT,
      }),
    ).toBe("/interventions/i1?depuis=tableau_de_bord");
    expect(
      lienEcritureJournal({
        entite: "demande",
        entiteId: "d1",
        action: "creation",
        horodatage: DEBUT,
      }),
    ).toBe("/demandes/d1");
  });

  it("LE CAS QUI DOIT RESTER VERT : une autre entité n'a aucun lien", () => {
    expect(
      lienEcritureJournal({
        entite: "client",
        entiteId: "c1",
        action: "modification",
        horodatage: DEBUT,
      }),
    ).toBeUndefined();
  });

  it("« N écritures aujourd'hui » accorde le singulier à une seule écriture", () => {
    expect(libelleCompteJournal(1)).toBe(
      `1 ${t("tableau_de_bord.journal_compte_une")}`,
    );
    expect(libelleCompteJournal(6)).toBe(
      `6 ${t("tableau_de_bord.journal_compte")}`,
    );
  });
});

describe("le titre du bloc du mois — « <Mois Année>, au JJ/MM » (direction)", () => {
  it("compose le mois en toutes lettres, l'année, et le jour courant", () => {
    const titre = titreBlocMois({ annee: 2026, mois: 9, jour: 9 });
    expect(titre).toContain(t("mois.9"));
    expect(titre).toContain("2026");
    expect(titre).toContain("09/09");
  });
});
