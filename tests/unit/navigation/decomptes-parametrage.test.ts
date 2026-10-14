import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/auth/roles";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import {
  PORTES_PARAMETRAGE,
  type PorteParametrage,
} from "@/lib/navigation/portes-parametrage";

/**
 * `lib/navigation/decomptes-parametrage.ts` (9EWD1-PARAMETRES-HUB-SOLDE).
 *
 * **Pourquoi un mock plutôt qu'une épreuve d'isolation** — même motif que
 * `tests/unit/navigation/decomptes.test.ts` : la fonction testée ici ne fait
 * AUCUNE requête elle-même, elle compose le texte de la pastille à partir de
 * ce que chaque dépôt rend. Les dépôts sont confrontés à la vraie base par
 * leurs propres épreuves d'isolation ; ce fichier n'y revient pas.
 */

const compterAgencesSimulee = vi.fn();
const compterLesLotsSimulee = vi.fn();
const listerLesPrestationsSimulee = vi.fn();
const compterSitesSimulee = vi.fn();
const compterHabilitationsExpireesSimulee = vi.fn();
const pointsDonneesACompleterSimulee = vi.fn();
const techniciensAccesAOuvrirSimulee = vi.fn();
const compterZonesSansForfaitDeDeplacementSimulee = vi.fn();
const tauxEnVigueurSimulee = vi.fn();
const famillesADeterminerSimulee = vi.fn();
const avecContexteApplicatifSimulee = vi.fn();

vi.mock("@/lib/agences/depot", () => ({
  compterAgences: compterAgencesSimulee,
}));
vi.mock("@/lib/imports/depot", () => ({
  compterLesLots: compterLesLotsSimulee,
}));
vi.mock("@/lib/prestations/depot", () => ({
  listerLesPrestations: listerLesPrestationsSimulee,
}));
vi.mock("@/lib/sites/depot", () => ({
  compterSites: compterSitesSimulee,
}));
vi.mock("@/lib/tableau-de-bord/lectures", () => ({
  compterHabilitationsExpirees: compterHabilitationsExpireesSimulee,
  pointsDonneesACompleter: pointsDonneesACompleterSimulee,
  techniciensAccesAOuvrir: techniciensAccesAOuvrirSimulee,
}));
vi.mock("@/lib/tarification/depot-forfaits", () => ({
  compterZonesSansForfaitDeDeplacement:
    compterZonesSansForfaitDeDeplacementSimulee,
}));
vi.mock("@/lib/tarification/taux-horaire", () => ({
  tauxEnVigueur: tauxEnVigueurSimulee,
}));
vi.mock("@/lib/vgp/registre", () => ({
  famillesADeterminer: famillesADeterminerSimulee,
}));
vi.mock("@/lib/db/client", () => ({
  avecContexteApplicatif: avecContexteApplicatifSimulee,
}));

const { decomptesParametrage } =
  await import("@/lib/navigation/decomptes-parametrage");

const CONTEXTE = {
  utilisateurId: "aaaaaaaa-0000-7000-8000-000000000001",
  societeId: "aaaaaaaa-0000-7000-8000-000000000002",
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
} as const;

const FUSEAU = "Pacific/Noumea";

/** Les mocks dont AUCUNE porte ouverte dans un scénario donné ne doit se servir. */
const TOUS_LES_ESPIONS = [
  compterAgencesSimulee,
  compterLesLotsSimulee,
  listerLesPrestationsSimulee,
  compterSitesSimulee,
  compterHabilitationsExpireesSimulee,
  pointsDonneesACompleterSimulee,
  techniciensAccesAOuvrirSimulee,
  compterZonesSansForfaitDeDeplacementSimulee,
  tauxEnVigueurSimulee,
  famillesADeterminerSimulee,
  avecContexteApplicatifSimulee,
];

beforeEach(() => {
  vi.clearAllMocks();
});

function porte(chemin: string): PorteParametrage {
  const trouvee = PORTES_PARAMETRAGE.find((p) => p.chemin === chemin);
  if (trouvee === undefined) {
    throw new Error(`porte introuvable : ${chemin}`);
  }
  return trouvee;
}

describe("decomptesParametrage — une lecture ne se déclenche que pour une porte OUVERTE", () => {
  it("une seule porte ouverte (Prestations) : SEULE sa lecture est appelée", async () => {
    listerLesPrestationsSimulee.mockResolvedValueOnce([{}, {}]);

    const decomptes = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/prestations")],
      FUSEAU,
    );

    expect(decomptes.get("/parametres/prestations")?.texte).toBe(
      `2 ${t("parametres.decompte_prestation")}`,
    );
    expect(listerLesPrestationsSimulee).toHaveBeenCalledTimes(1);
    for (const espion of TOUS_LES_ESPIONS) {
      if (espion !== listerLesPrestationsSimulee) {
        expect(espion).not.toHaveBeenCalled();
      }
    }
  });

  it("aucune porte ouverte : aucune lecture n'est appelée", async () => {
    const decomptes = await decomptesParametrage(CONTEXTE, [], FUSEAU);

    expect(decomptes.size).toBe(0);
    for (const espion of TOUS_LES_ESPIONS) {
      expect(espion).not.toHaveBeenCalled();
    }
  });
});

describe("decomptesParametrage — une règle de mise en forme par cas", () => {
  it("prestations : singulier à 1, pluriel sinon", async () => {
    listerLesPrestationsSimulee.mockResolvedValueOnce([{}]);
    const unSeul = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/prestations")],
      FUSEAU,
    );
    expect(unSeul.get("/parametres/prestations")?.texte).toBe(
      `1 ${t("parametres.decompte_prestation_un")}`,
    );

    listerLesPrestationsSimulee.mockResolvedValueOnce([{}, {}, {}]);
    const plusieurs = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/prestations")],
      FUSEAU,
    );
    expect(plusieurs.get("/parametres/prestations")?.texte).toBe(
      `3 ${t("parametres.decompte_prestation")}`,
    );
  });

  it("agences : aucun suffixe quand toutes sont actives, « , dont » sinon", async () => {
    compterAgencesSimulee.mockResolvedValueOnce({ total: 3, actives: 3 });
    const toutesActives = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/agences")],
      FUSEAU,
    );
    expect(toutesActives.get("/parametres/agences")?.texte).toBe(
      `3 ${motDansUnePhrase("agence", true)}`,
    );

    compterAgencesSimulee.mockResolvedValueOnce({ total: 3, actives: 1 });
    const uneSeuleActive = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/agences")],
      FUSEAU,
    );
    expect(uneSeuleActive.get("/parametres/agences")?.texte).toBe(
      `3 ${motDansUnePhrase("agence", true)}${t("parametres.decompte_agence_active_suffixe")}1 ${t("parametres.decompte_agence_active_un")}`,
    );
  });

  it("données à compléter : « À jour » quand rien ne manque, un décompte alerte sinon", async () => {
    pointsDonneesACompleterSimulee.mockResolvedValueOnce([]);
    const aJour = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/donnees")],
      FUSEAU,
    );
    expect(aJour.get("/parametres/donnees")).toEqual({
      texte: t("parametres.decompte_a_jour"),
      ton: "neutre",
    });

    pointsDonneesACompleterSimulee.mockResolvedValueOnce([{}, {}]);
    const aReprendre = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/donnees")],
      FUSEAU,
    );
    expect(aReprendre.get("/parametres/donnees")?.ton).toBe("alerte");
    expect(aReprendre.get("/parametres/donnees")?.texte).toBe(
      `2 ${t("parametres.decompte_point_a_reprendre")}`,
    );
  });

  it("équipe : « Tous les accès sont ouverts » quand rien n'attend, un décompte alerte sinon", async () => {
    techniciensAccesAOuvrirSimulee.mockResolvedValueOnce([]);
    const toutOuvert = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/equipe")],
      FUSEAU,
    );
    expect(toutOuvert.get("/parametres/equipe")).toEqual({
      texte: t("parametres.decompte_tous_acces_ouverts"),
      ton: "neutre",
    });

    techniciensAccesAOuvrirSimulee.mockResolvedValueOnce([{}]);
    const unAOuvrir = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/equipe")],
      FUSEAU,
    );
    expect(unAOuvrir.get("/parametres/equipe")?.ton).toBe("alerte");
    expect(unAOuvrir.get("/parametres/equipe")?.href).toBe(
      "/parametres/equipe?acces=a-ouvrir",
    );
  });

  it("habilitations expirées : AUCUN décompte affiché à zéro — rien n'est pire qu'un faux zéro visible", async () => {
    compterHabilitationsExpireesSimulee.mockResolvedValueOnce(0);
    const rien = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/habilitations")],
      FUSEAU,
    );
    expect(rien.has("/parametres/habilitations")).toBe(false);

    compterHabilitationsExpireesSimulee.mockResolvedValueOnce(1);
    const une = await decomptesParametrage(
      CONTEXTE,
      [porte("/parametres/habilitations")],
      FUSEAU,
    );
    expect(une.get("/parametres/habilitations")?.texte).toBe(
      `1 ${t("parametres.decompte_habilitation_expiree_un")}`,
    );
  });
});
