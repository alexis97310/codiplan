import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9G9E-FINITIONS-CARTES — même recette que
 * `captures-9br-tpa4b-messages.spec.ts` (mémoire « captures-avant-apres-e2e »).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois dans
 * un `git worktree` posé sur le commit qui précède ce lot, une fois sur le
 * code livré. Aucune clé `fr[...]` nouvelle n'est lue ici (ce lot n'en ajoute
 * aucune), aucun import d'un module que ce lot a créé : `next build`
 * type-vérifie ce fichier contre le code qu'il capture.
 *
 * Chaque scène est une NAVIGATION ou une lecture de fixture créée par ce
 * fichier lui-même (jamais une écriture qui dépendrait du code touché).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G9E ?? "";
const PHASE = process.env.CAPTURES_9G9E_PHASE ?? "apres";
const PREFIXE = "9G9ECAP-";

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

type Scene = {
  siteId: string;
  clientId: string;
  machineId: string;
  demandeId: string;
  importLotId: string;
  interventionBonId: string;
};

let scene: Scene;

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    // UN SITE QUI PORTE AU MOINS UNE MACHINE — l'encadré « Équipements du
    // site » (sites/[id]) n'est intéressant à capturer que non vide.
    const machineExistante = await client.machine.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true, site_id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { id: machineExistante.site_id },
      select: { id: true, client_id: true },
    });
    const cliente = await client.client.findFirstOrThrow({
      where: { id: site.client_id },
      select: { id: true },
    });

    // UN CONTACT — pour la carte « Contacts » (doubles encadrés, 9G9E).
    await client.contact.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        client_id: cliente.id,
        site_id: null,
        nom: `${PREFIXE}Contact`,
        email: `${PREFIXE.toLowerCase()}@codima.test`,
        roles: ["donneur_ordre"],
      },
    });

    // UNE DEMANDE DÉJÀ ACCUSÉE — l'action « Accuser réception » s'y refuse
    // (`peutAccuser`, lib/demandes/cycle-de-vie.ts), rendant la boîte rouge
    // du refus que ce lot répare.
    const maintenant = new Date();
    const demande = await client.demande.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        source: "portail",
        client_id: cliente.id,
        site_id: site.id,
        agence_id: agence.id,
        description: `${PREFIXE}Demande`,
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
        accuse_le: maintenant,
      },
    });

    const importLot = await client.importLot.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    const interventionBon = await client.intervention.findFirstOrThrow({
      where: {
        societe_id: societe.id,
        statut: { in: ["terminee", "cloturee"] },
      },
      select: { id: true },
    });

    scene = {
      siteId: site.id,
      clientId: cliente.id,
      machineId: machineExistante.id,
      demandeId: demande.id,
      importLotId: importLot.id,
      interventionBonId: interventionBon.id,
    };
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.demande.deleteMany({ where: { id: scene.demandeId } });
    await client.contact.deleteMany({
      where: { client_id: scene.clientId, nom: `${PREFIXE}Contact` },
    });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`captures — fiche site, fiche client, contacts, demande refusée, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1400 });
    await ouvrirUneSession(page);

    await page.goto(`/sites/${scene.siteId}`);
    await capturer(page, "fiche-site", largeur);

    await page.goto(`/clients/${scene.clientId}`);
    await capturer(page, "fiche-client", largeur);

    await page.goto(`/clients/${scene.clientId}?onglet=contacts`);
    await capturer(page, "contacts", largeur);

    await page.goto(`/demandes/${scene.demandeId}`);
    await capturer(page, "demande-refusee", largeur);

    await page.goto(`/imports/${scene.importLotId}`);
    await capturer(page, "imports-detail", largeur);

    await page.goto(`/parc/${scene.machineId}`);
    await capturer(page, "fiche-machine", largeur);

    await page.goto("/vgp");
    await capturer(page, "registre-vgp", largeur);

    await page.goto(`/vgp?groupe=client`);
    await capturer(page, "registre-vgp-groupe-client", largeur);

    await page.goto(`/interventions/${scene.interventionBonId}/bon`);
    await capturer(page, "bon", largeur);
  });
}

test("rendu imprimé — le bon et l'étiquette QR", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  // `window.print()` ouvrirait une vraie boîte de dialogue native — stub,
  // comme les autres épreuves qui pilotent ce même geste
  // (`ActionsBonIntervention`/`ActionsQrMachine`).
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await ouvrirUneSession(page);

  await page.goto(`/interventions/${scene.interventionBonId}/bon`);
  await page.locator('[data-bloc="bon-imprimer"]').click();
  await page.emulateMedia({ media: "print" });
  await capturer(page, "bon-impression", 1280);
  await page.emulateMedia({ media: "screen" });

  await page.goto(`/parc/${scene.machineId}`);
  await page.locator('[data-bloc="qr-imprimer"]').click();
  await page.emulateMedia({ media: "print" });
  await capturer(page, "qr-impression", 1280);
});
