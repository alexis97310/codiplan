import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../setup/base";
import { reperesDeLaScene } from "../setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../setup/scene";

/**
 * 9F4H6B-FILE-ANCIEN-FORMAT — DE BOUT EN BOUT, DEUX POINTS.
 *
 * ## POINT 3 — COCHER PUIS DÉCOCHER HORS RÉSEAU
 *
 * Avant ce correctif, `envoyerPrestations` (`rapport-automatique.tsx`)
 * rendait « accepté » dès que les prestations voulues retrouvaient la
 * dernière base connue, SANS jamais retirer une entrée déjà en file pour ce
 * même retour en arrière — cocher puis décocher, tous les deux hors réseau,
 * laissait donc une saisie `{ajouter:[C]}` prête à être rejouée à tort.
 *
 * ## POINT 4 — LE REJEU DEPUIS LA FILE, DE BOUT EN BOUT
 *
 * Ni la route ni `corpsDe` n'étaient exercées de bout en bout par une
 * épreuve avant ce lot (9F4H6A) — seule la fonction de dépôt l'était, sous
 * `tests/isolation/`. Ce scénario coche UNE prestation hors réseau, laisse
 * un COLLÈGUE en ajouter une AUTRE en ligne pendant la coupure, renvoie la
 * file au retour du réseau, et REJOUE la même requête : les deux
 * prestations doivent rester présentes, rien ne doit doubler.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9F4H6B-` — même discipline que 9F4H3/9F4H6A
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H6B = uuidv7();
const SITE_9F4H6B = uuidv7();
const INTERVENTION_COCHER_DECOCHER = uuidv7();
const INTERVENTION_REJEU = uuidv7();
const PRESTATION_P1 = uuidv7();
const PRESTATION_P2_COLLEGUE = uuidv7();

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9F4H6B,
        societe_id: societeId,
        raison_sociale: "9F4H6B client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H6B,
        societe_id: societeId,
        client_id: CLIENT_9F4H6B,
        agence_id: agence.id,
        libelle: "9F4H6B site",
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_P1,
        societe_id: societeId,
        code: "9F4H6B-P1",
        libelle: fr["terrain.e2e.prestation_libelle"],
        actif: true,
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_P2_COLLEGUE,
        societe_id: societeId,
        code: "9F4H6B-P2",
        libelle: "9F4H6B — prestation du collègue",
        actif: true,
      },
    });
    const commun = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: CLIENT_9F4H6B,
      site_id: SITE_9F4H6B,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9F4H6B — intervention forgée par l'épreuve",
      statut: "affectee" as const,
      // SANS DATE (9F2B) — évite toute dépendance à la fenêtre
      // [aujourd'hui, J+8[ de « Ma journée », qui dépend du jour courant.
      date_planifiee: null,
    };
    await client.intervention.create({
      data: { id: INTERVENTION_COCHER_DECOCHER, ...commun },
    });
    await client.intervention.create({
      data: { id: INTERVENTION_REJEU, ...commun },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [INTERVENTION_COCHER_DECOCHER, INTERVENTION_REJEU],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9F4H6B,
    );
    await client.prestation.deleteMany({
      where: { id: { in: [PRESTATION_P1, PRESTATION_P2_COLLEGUE] } },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H6B } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H6B } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

type EntreeFileBrute = {
  readonly id: string;
  readonly interventionId: string;
  readonly geste: {
    readonly type: string;
    readonly ajouterIds?: readonly string[];
    readonly retirerIds?: readonly string[];
  };
};

async function entreesPrestationsEnFile(
  page: Page,
  interventionId: string,
): Promise<readonly EntreeFileBrute[]> {
  const toutes = await page.evaluate(
    () =>
      new Promise<readonly EntreeFileBrute[]>((resolve, reject) => {
        const requete = indexedDB.open("codiplan-terrain");
        requete.onerror = () => reject(requete.error);
        requete.onsuccess = () => {
          const base = requete.result;
          const lecture = base
            .transaction("file", "readonly")
            .objectStore("file")
            .getAll();
          lecture.onsuccess = () => {
            base.close();
            resolve(lecture.result);
          };
          lecture.onerror = () => reject(lecture.error);
        };
      }),
  );
  return toutes.filter(
    (e) =>
      e.geste.type === "prestations" && e.interventionId === interventionId,
  );
}

test("point 3 — cocher puis décocher hors réseau ne laisse plus l'ajout en file", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_COCHER_DECOCHER}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  await context.setOffline(true);

  const caseAPrestation = page.getByRole("checkbox", {
    name: fr["terrain.e2e.prestation_libelle"],
  });
  await caseAPrestation.check();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  const apresCoche = await entreesPrestationsEnFile(
    page,
    INTERVENTION_COCHER_DECOCHER,
  );
  expect(apresCoche).toHaveLength(1);
  expect(apresCoche[0].geste.ajouterIds).toEqual([PRESTATION_P1]);

  await caseAPrestation.uncheck();
  // RIEN DE NOUVEAU À ATTENDRE À L'ÉCRAN — `envoyerPrestations` retire
  // l'entrée en silence (point 3), et aucun bouton « Envoyer » n'existe
  // tant que la file est vide (voir `BoutonEnvoyer`). Seule la file,
  // directement, le mesure.
  await expect
    .poll(() => entreesPrestationsEnFile(page, INTERVENTION_COCHER_DECOCHER))
    .toHaveLength(0);

  await context.setOffline(false);
});

test("point 4 — le rejeu depuis la file conserve l'ajout d'un collègue, et ne double rien", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_REJEU}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  await context.setOffline(true);

  await page
    .getByRole("checkbox", { name: fr["terrain.e2e.prestation_libelle"] })
    .check();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  const enFile = await entreesPrestationsEnFile(page, INTERVENTION_REJEU);
  expect(enFile).toHaveLength(1);
  expect(enFile[0].geste.ajouterIds).toEqual([PRESTATION_P1]);

  // ── UN COLLÈGUE AJOUTE P2 EN LIGNE, PENDANT LA COUPURE DE CET APPAREIL ──
  const bureau = admin();
  try {
    await bureau.interventionPrestation.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        intervention_id: INTERVENTION_REJEU,
        prestation_id: PRESTATION_P2_COLLEGUE,
      },
    });
  } finally {
    await bureau.$disconnect();
  }

  await context.setOffline(false);
  const boutonEnvoyer = page.getByRole("button", {
    name: /^Envoyer \(\d+\)$/,
  });
  await expect(boutonEnvoyer).toBeVisible();
  await boutonEnvoyer.click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  const verif = admin();
  try {
    const lignes = await verif.interventionPrestation.findMany({
      where: { intervention_id: INTERVENTION_REJEU },
      select: { prestation_id: true },
    });
    expect(new Set(lignes.map((l) => l.prestation_id))).toEqual(
      new Set([PRESTATION_P1, PRESTATION_P2_COLLEGUE]),
    );
    expect(lignes).toHaveLength(2);
  } finally {
    await verif.$disconnect();
  }

  // ── REJEU FORCÉ DE LA MÊME REQUÊTE (retransmission réseau) ──────────────
  const reponseRejeu = await page.request.post(
    `/api/terrain/${INTERVENTION_REJEU}/prestations`,
    {
      form: {
        depuis_file: "1",
        ajouter_id: PRESTATION_P1,
      },
      headers: { Accept: "application/json" },
    },
  );
  const corpsRejeu = (await reponseRejeu.json()) as {
    readonly ok: boolean;
    readonly motif: string | null;
  };
  expect(corpsRejeu.ok).toBe(true);

  const rejoueur = admin();
  try {
    const lignesApres = await rejoueur.interventionPrestation.findMany({
      where: { intervention_id: INTERVENTION_REJEU },
    });
    // TOUJOURS DEUX LIGNES — le rejeu n'a rien ajouté de plus.
    expect(lignesApres).toHaveLength(2);
  } finally {
    await rejoueur.$disconnect();
  }
});
