import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BS-TP-A2-VGP-REGISTRE — même recette que
 * `captures-tpa4a-messages.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * **AVANT/APRÈS se prend en rejouant ce même fichier deux fois** — une fois
 * dans un `git worktree` posé sur le commit qui précède ce lot, une fois sur
 * le code livré — jamais en changeant ce fichier entre les deux. Aucune clé
 * `fr[...]` n'est lue ici, à dessein : sur le code AVANT, les clés neuves de
 * ce lot n'existent pas encore. Chaque scène navigue par URL (recherche,
 * filtre, `motif`), jamais par une écriture réelle — le motif de date future
 * voyage par le même paramètre que la route poserait elle-même après un
 * refus, ce qui permet de capturer les deux états sans jamais soumettre de
 * formulaire.
 *
 * La FIXTURE, elle, est directe (Prisma), jamais par l'application — le
 * schéma ne change pas dans ce lot (« Pas de migration »), donc la même
 * écriture vaut sur les deux commits.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_TPA2 ?? "";
const PHASE = process.env.CAPTURES_TPA2_PHASE ?? "apres";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: true,
  });
}

const CLIENT_ID = uuidv7();
const SITE_PAGINATION = uuidv7();
const SITE_DEPASSEE = uuidv7();
const FAMILLE_SOUMISE = uuidv7();
const FAMILLE_A_DETERMINER = uuidv7();
const FAMILLE_NON_SOUMISE = uuidv7();
const FAMILLE_DEPASSEE = uuidv7();
const MODELE_SOUMIS = uuidv7();
const MODELE_A_DETERMINER = uuidv7();
const MODELE_NON_SOUMIS = uuidv7();
const MODELE_DEPASSEE = uuidv7();
const MACHINE_A_DETERMINER = uuidv7();
const MACHINE_NON_SOUMISE = uuidv7();
const MACHINE_DEPASSEE = uuidv7();
const VERIFICATION_DEPASSEE = uuidv7();

const NOMBRE_SOUMISES = 51;
const MACHINES_SOUMISES = Array.from({ length: NOMBRE_SOUMISES }, () =>
  uuidv7(),
);

function numeroSoumise(index: number): string {
  return `TPA2CAP-${String(index + 1).padStart(3, "0")}`;
}

const SN_A_DETERMINER = "TPA2CAP-A-DETERMINER";
const SN_NON_SOUMISE = "TPA2CAP-NON-SOUMISE";
const SN_DEPASSEE = "TPA2CAPX-DEPASSEE";

const TOUS_LES_IDS_MACHINE = [
  ...MACHINES_SOUMISES,
  MACHINE_A_DETERMINER,
  MACHINE_NON_SOUMISE,
  MACHINE_DEPASSEE,
];

test.beforeAll(async () => {
  if (DOSSIER === "") return;
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: "TPA2 — Client des captures",
        actif: true,
      },
    });
    await client.site.createMany({
      data: [
        {
          id: SITE_PAGINATION,
          societe_id: societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: "TPA2 — Lieu des captures (pagination)",
        },
        {
          id: SITE_DEPASSEE,
          societe_id: societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: "TPA2 — Lieu des captures (dépassée)",
        },
      ],
    });

    await client.familleMateriel.createMany({
      data: [
        {
          id: FAMILLE_SOUMISE,
          societe_id: societeId,
          code: "TPA2CAP-SOUMISE",
          libelle: "TPA2 — Famille soumise (captures)",
          assujettissement_vgp: "soumis",
          vgp_periodicite_mois: 1,
          vgp_reference_texte: "TPA2 — Texte des captures",
        },
        {
          id: FAMILLE_A_DETERMINER,
          societe_id: societeId,
          code: "TPA2CAP-A-DET",
          libelle: "TPA2 — Famille à déterminer (captures)",
          assujettissement_vgp: "a_determiner",
        },
        {
          id: FAMILLE_NON_SOUMISE,
          societe_id: societeId,
          code: "TPA2CAP-NON-SOU",
          libelle: "TPA2 — Famille non soumise (captures)",
          assujettissement_vgp: "non_soumis",
        },
        {
          id: FAMILLE_DEPASSEE,
          societe_id: societeId,
          code: "TPA2CAP-DEPASSEE",
          libelle: "TPA2 — Famille dépassée (captures)",
          assujettissement_vgp: "soumis",
          vgp_periodicite_mois: 1,
          vgp_reference_texte: "TPA2 — Texte des captures",
        },
      ],
    });

    await client.modeleMateriel.createMany({
      data: [
        {
          id: MODELE_SOUMIS,
          societe_id: societeId,
          famille_id: FAMILLE_SOUMISE,
          marque: "TPA2",
          reference: "TPA2CAP-MODELE-SOUMIS",
        },
        {
          id: MODELE_A_DETERMINER,
          societe_id: societeId,
          famille_id: FAMILLE_A_DETERMINER,
          marque: "TPA2",
          reference: "TPA2CAP-MODELE-A-DETERMINER",
        },
        {
          id: MODELE_NON_SOUMIS,
          societe_id: societeId,
          famille_id: FAMILLE_NON_SOUMISE,
          marque: "TPA2",
          reference: "TPA2CAP-MODELE-NON-SOUMIS",
        },
        {
          id: MODELE_DEPASSEE,
          societe_id: societeId,
          famille_id: FAMILLE_DEPASSEE,
          marque: "TPA2",
          reference: "TPA2CAP MODELE DEPASSEE",
        },
      ],
    });

    await client.machine.createMany({
      data: [
        ...MACHINES_SOUMISES.map((id, index) => ({
          id,
          societe_id: societeId,
          modele_id: MODELE_SOUMIS,
          client_id: CLIENT_ID,
          site_id: SITE_PAGINATION,
          numero_serie: numeroSoumise(index),
          qr_token: engendrerJetonQr(),
        })),
        {
          id: MACHINE_A_DETERMINER,
          societe_id: societeId,
          modele_id: MODELE_A_DETERMINER,
          client_id: CLIENT_ID,
          site_id: SITE_PAGINATION,
          numero_serie: SN_A_DETERMINER,
          qr_token: engendrerJetonQr(),
        },
        {
          id: MACHINE_NON_SOUMISE,
          societe_id: societeId,
          modele_id: MODELE_NON_SOUMIS,
          client_id: CLIENT_ID,
          site_id: SITE_PAGINATION,
          numero_serie: SN_NON_SOUMISE,
          qr_token: engendrerJetonQr(),
        },
        {
          id: MACHINE_DEPASSEE,
          societe_id: societeId,
          modele_id: MODELE_DEPASSEE,
          client_id: CLIENT_ID,
          site_id: SITE_DEPASSEE,
          numero_serie: SN_DEPASSEE,
          qr_token: engendrerJetonQr(),
        },
      ],
    });

    const echeanceDepassee = new Date();
    echeanceDepassee.setUTCMonth(echeanceDepassee.getUTCMonth() - 3);
    await client.vgpVerification.create({
      data: {
        id: VERIFICATION_DEPASSEE,
        societe_id: societeId,
        machine_id: MACHINE_DEPASSEE,
        date_verification: echeanceDepassee,
        organisme: "Organisme des captures TP-A2",
        origine: "rapport_organisme",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (DOSSIER === "") return;
  const client = admin();
  try {
    await client.vgpVerification.deleteMany({
      where: { id: VERIFICATION_DEPASSEE },
    });
    await client.machine.deleteMany({
      where: { id: { in: TOUS_LES_IDS_MACHINE } },
    });
    await client.modeleMateriel.deleteMany({
      where: {
        id: {
          in: [
            MODELE_SOUMIS,
            MODELE_A_DETERMINER,
            MODELE_NON_SOUMIS,
            MODELE_DEPASSEE,
          ],
        },
      },
    });
    await client.familleMateriel.deleteMany({
      where: {
        id: {
          in: [
            FAMILLE_SOUMISE,
            FAMILLE_A_DETERMINER,
            FAMILLE_NON_SOUMISE,
            FAMILLE_DEPASSEE,
          ],
        },
      },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_PAGINATION, SITE_DEPASSEE] } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`captures — fiche site en retard, et à 51 sans information, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    await page.goto(`/sites/${SITE_DEPASSEE}`);
    await capturer(page, "fiche-site-depassee", largeur);

    await page.goto(`/sites/${SITE_PAGINATION}`);
    await capturer(page, "fiche-site-sans-information", largeur);
  });

  test(`captures — registre paginé, filtre sans information, régimes, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    await page.goto(`/vgp?q=${encodeURIComponent("TPA2CAP-")}`);
    await capturer(page, "registre-page-1", largeur);
    await page.goto(`/vgp?q=${encodeURIComponent("TPA2CAP-")}&page=2`);
    await capturer(page, "registre-page-2", largeur);

    await page.goto(
      `/vgp?etat=sans_information&q=${encodeURIComponent("TPA2CAP-")}`,
    );
    await capturer(page, "registre-filtre-sans-information", largeur);

    await page.goto(`/vgp?q=${encodeURIComponent(SN_A_DETERMINER)}`);
    await capturer(page, "registre-ligne-a-determiner", largeur);

    await page.goto(`/vgp?q=${encodeURIComponent(SN_NON_SOUMISE)}`);
    await capturer(page, "registre-ligne-non-soumise", largeur);
  });

  test(`captures — refus de date future, fiche machine (QR), correction, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    await page.goto(`/vgp/enregistrer/${MACHINE_A_DETERMINER}`);
    await capturer(page, "enregistrer-formulaire", largeur);
    await page.goto(
      `/vgp/enregistrer/${MACHINE_A_DETERMINER}?motif=vgp.verifier.refus.date_future`,
    );
    await capturer(page, "enregistrer-refus-date-future", largeur);

    await page.goto(`/parc/${MACHINE_A_DETERMINER}`);
    await capturer(page, "fiche-machine-qr", largeur);

    await page.goto(`/parc/${MACHINE_A_DETERMINER}/modifier`);
    await capturer(page, "fiche-machine-modifier", largeur);
  });
}
