import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * QT-3 (audit du 28/09/2026, D150) — L'IMPORT SUIT LES DROITS DE L'ÉCRAN DE
 * SON TYPE, MESURÉ SUR LES TROIS ROUTES QUI ÉCRIVENT.
 *
 * `tests/unit/imports/droits-import.test.ts` éprouve `peutImporterLeType`
 * contre les dix rôles et les dix types, hors base — c'est la matrice. Ce
 * fichier traverse les ROUTES elles-mêmes, où D150 mord réellement : la
 * porte (`exigerCapacite`) est fabriquée pour un rôle donné (même patron que
 * `tests/unit/interventions/motifs-in22.test.ts`), et tout le reste — base
 * réelle, politique RLS, `avecContexteApplicatif` — est le chemin de
 * PRODUCTION.
 *
 * Trois faits mesurés, nommés par le ticket :
 *   1. un responsable matériel REFUSÉ sur un classeur de CLIENTS →
 *      **aucun lot n'est créé** (le refus est posé avant `enregistrerLeControle`) ;
 *   2. l'ADV REFUSÉ à l'application d'un lot de FAMILLES →
 *      **aucune famille n'est créée**, le lot reste `controle` ;
 *   3. l'ADV REFUSÉ à l'annulation du même lot, une fois appliqué par
 *      l'administrateur de société → **la famille créée par l'application
 *      reste intacte**.
 * Et le jumeau qui doit rester vert pour sa propre raison : l'administrateur
 * de société traverse les trois gestes sans encombre, inchangé par ce lot.
 */

/**
 * LA PORTE EST FABRIQUÉE, JAMAIS LA BASE (même patron que `motifs-in22.test.ts`).
 * `exigerCapacite` ne rend ici QUE ce qu'un `mockResolvedValueOnce` lui donne —
 * chaque test en pose un avant d'appeler une route, pour UN rôle précis — si
 * bien que l'implémentation réelle (qui lirait `headers()`, hors de toute
 * requête Next) n'est jamais atteinte.
 */
vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

/**
 * CE FICHIER TRAVERSE LES VRAIES ROUTES, ET ELLES N'ACCEPTENT AUCUN CLIENT
 * DE SUBSTITUTION — à la différence de `enregistrerLeControle(…, clientApp())`
 * plus bas. Elles passent par `avecContexteApplicatif` SANS client fourni,
 * donc par le singleton de `lib/db/client.ts`, qui lit `DATABASE_URL` au
 * premier import et refuse toute connexion qui ne soit pas le rôle
 * applicatif restreint (`garantirRoleApplicatif`). **`DATABASE_URL` doit donc
 * pointer vers LA MÊME base jetable que `TEST_DATABASE_URL`, sous le rôle
 * `codiplan_app`** — posé ici, AVANT que `lib/db/client.ts` ne soit importé
 * par les routes ci-dessous : `vi.hoisted` place ce bloc au-dessus de tout
 * import, comme `vi.mock`.
 */
vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/droits-import-par-type.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { Role } from "@/lib/auth/roles";
import { exigerCapacite } from "@/lib/auth/porte";
import { type ContexteActif } from "@/lib/auth/contexte";
import { controlerFeuille } from "@/lib/excel/controle";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { enregistrerLeControle } from "@/lib/imports/depot";
import {
  COLONNES_FAMILLES,
  MODELE_FAMILLES,
  marqueurDu,
} from "@/lib/imports/modeles";

import { POST as postControler } from "@/app/api/imports/controler/route";
import { POST as postAppliquer } from "@/app/api/imports/[id]/appliquer/route";
import { POST as postAnnuler } from "@/app/api/imports/[id]/annuler/route";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

function contexte(role: Role): ContexteActif {
  return {
    utilisateurId: UTILISATEUR_INTERNE_A,
    societeId: SOCIETE_A,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
}

function lotIdDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  const chemin = new URL(location, "http://localhost").pathname;
  const trouve = chemin.match(/^\/imports\/([0-9a-f-]{36})$/i);
  return trouve?.[1] ?? null;
}

/** Les lots créés par ce fichier, nettoyés en fin (I9) — jamais laissés en base. */
const LOTS_A_NETTOYER: string[] = [];

describe("CONTRÔLER — un responsable matériel ne crée aucun lot de CLIENTS (D130)", () => {
  const FIXTURE = join(process.cwd(), "tests/fixtures/clients-fabrique.xlsx");

  function requeteDeTeleversement(nom: string): Request {
    const corps = new FormData();
    corps.set(
      "classeur",
      new File([readFileSync(FIXTURE)], "clients-fabrique.xlsx"),
    );
    corps.set("nom", nom);
    return new Request("http://localhost/api/imports/controler", {
      method: "POST",
      body: corps,
    });
  }

  it("responsable matériel → imports.refus.type_reserve, aucun lot créé", async () => {
    const nom = "9DA-epreuve-rm-clients.xlsx";
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(Role.responsable_materiel),
    );
    const reponse = await postControler(requeteDeTeleversement(nom));
    expect(motifDeLaRedirection(reponse)).toBe("imports.refus.type_reserve");

    const compte = await clientOwner().importLot.count({
      where: { societe_id: SOCIETE_A, nom_fichier: nom },
    });
    expect(compte).toBe(0);
  });

  it("LE JUMEAU — l'administrateur de société, inchangé, contrôle normalement", async () => {
    const nom = "9DA-epreuve-adms-clients.xlsx";
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(Role.admin_societe),
    );
    const reponse = await postControler(requeteDeTeleversement(nom));
    const lotId = lotIdDeLaRedirection(reponse);
    expect(lotId).not.toBeNull();
    if (lotId !== null) LOTS_A_NETTOYER.push(lotId);

    const compte = await clientOwner().importLot.count({
      where: { societe_id: SOCIETE_A, nom_fichier: nom },
    });
    expect(compte).toBe(1);
  });
});

describe("APPLIQUER puis ANNULER — l'ADV n'écrit aucune FAMILLE (le droit de Paramètres)", () => {
  async function lotDeFamilleAEprouver(): Promise<string> {
    const feuille: FeuilleLue = {
      nom: "Familles",
      lignes: [
        [{ texte: marqueurDu(MODELE_FAMILLES) }],
        [
          { texte: COLONNES_FAMILLES.code },
          { texte: COLONNES_FAMILLES.libelle },
        ],
        [{ texte: "FAM-9DA-EPREUVE" }, { texte: "Famille d'épreuve 9DA" }],
      ],
    };
    const controle = controlerFeuille(feuille, MODELE_FAMILLES, {
      cles: new Set<string>(),
      ambigues: new Set<string>(),
    });
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) throw new Error("témoin : feuille illisible");
    expect(controle.lignes.length).toBe(1);

    const { lotId } = await enregistrerLeControle(
      contexte(Role.admin_societe),
      {
        nom: "9da-epreuve-familles.xlsx",
        type: MODELE_FAMILLES.type,
        version: MODELE_FAMILLES.version,
      },
      controle.lignes,
      clientApp(),
    );
    LOTS_A_NETTOYER.push(lotId);
    return lotId;
  }

  it("ADV refusé à l'application → imports.refus.type_reserve, aucune famille créée", async () => {
    const lotId = await lotDeFamilleAEprouver();
    const params = { params: Promise.resolve({ id: lotId }) };

    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));
    const reponse = await postAppliquer(
      new Request(`http://localhost/api/imports/${lotId}/appliquer`, {
        method: "POST",
      }),
      params,
    );
    expect(motifDeLaRedirection(reponse)).toBe("imports.refus.type_reserve");

    const lot = await clientOwner().importLot.findUniqueOrThrow({
      where: { id: lotId },
      select: { statut: true },
    });
    expect(lot.statut).toBe("controle");
    const famille = await clientOwner().familleMateriel.findFirst({
      where: { societe_id: SOCIETE_A, code: "FAM-9DA-EPREUVE" },
    });
    expect(famille).toBeNull();

    // LE JUMEAU : l'administrateur de société applique ce MÊME lot sans
    // encombre — sinon la ligne ci-dessus ne prouverait rien de D150, elle
    // prouverait un lot cassé par ailleurs.
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(Role.admin_societe),
    );
    const applique = await postAppliquer(
      new Request(`http://localhost/api/imports/${lotId}/appliquer`, {
        method: "POST",
      }),
      params,
    );
    expect(motifDeLaRedirection(applique)).toBe("imports.applique");
    const familleCreee = await clientOwner().familleMateriel.findFirst({
      where: { societe_id: SOCIETE_A, code: "FAM-9DA-EPREUVE" },
    });
    expect(familleCreee).not.toBeNull();

    // ANNULER — même garde, mesurée APRÈS l'écriture : l'ADV refusé ne défait
    // rien de ce que l'administrateur de société vient d'écrire.
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));
    const refusAnnuler = await postAnnuler(
      new Request(`http://localhost/api/imports/${lotId}/annuler`, {
        method: "POST",
      }),
      params,
    );
    expect(motifDeLaRedirection(refusAnnuler)).toBe(
      "imports.refus.type_reserve",
    );
    const familleIntacte = await clientOwner().familleMateriel.findFirst({
      where: { societe_id: SOCIETE_A, code: "FAM-9DA-EPREUVE" },
    });
    expect(familleIntacte).not.toBeNull();

    // LE JUMEAU : l'administrateur de société annule ce lot sans encombre.
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(Role.admin_societe),
    );
    const annule = await postAnnuler(
      new Request(`http://localhost/api/imports/${lotId}/annuler`, {
        method: "POST",
      }),
      params,
    );
    expect(motifDeLaRedirection(annule)).toBe("imports.annule");
    const familleDefaite = await clientOwner().familleMateriel.findFirst({
      where: { societe_id: SOCIETE_A, code: "FAM-9DA-EPREUVE" },
    });
    expect(familleDefaite).toBeNull();
  });
});

afterAll(async () => {
  // NETTOYAGE (I9) avant de fermer les connexions — dans ce SEUL hook, pour
  // ne jamais dépendre de l'ordre d'exécution relatif de deux `afterAll`.
  if (LOTS_A_NETTOYER.length > 0) {
    await clientOwner().importLot.deleteMany({
      where: { id: { in: LOTS_A_NETTOYER } },
    });
  }
  await fermerClients();
});
