import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DE 9I6-FICHE-INTERVENTION-EN-TUILES.
 *
 * **Recette** (mémoire de session « captures-avant-apres-e2e ») : ce fichier
 * tourne une fois dans un worktree sur le commit D'AVANT ce lot
 * (`CAPTURES_9I6_ETAPE=avant`), une fois ici, sur le code livré (APRÈS —
 * `CAPTURES_9I6_ETAPE=apres`). Rien n'est écrit sans `CAPTURES_9I6` (le
 * dossier), pour que `pnpm test:e2e` ordinaire n'écrive jamais de fichier.
 *
 * **Aucune assertion de contenu** : ce fichier doit passer SANS modification
 * sur le code D'AVANT, qui ne connaît ni les six tuiles, ni la grille à deux
 * colonnes. Seule la navigation et la capture comptent (même discipline que
 * `zz-captures-9dn.spec.ts`) — les chaînes de la fixture sont donc écrites en
 * dur, comme chez lui, puisqu'aucune n'est reprise dans une assertion de
 * rendu.
 *
 * **SA PROPRE SCÈNE, préfixée `9I6-CAPT-`** — une seule intervention,
 * CLÔTURÉE et SIGNÉE, avec machine, commentaire, suite à donner et photo :
 * de quoi remplir les six tuiles pour la capture. Créée en `beforeAll`,
 * supprimée en `afterAll`, jamais `SCENE.*`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I6 ?? "";
const ETAPE = process.env.CAPTURES_9I6_ETAPE ?? "avant";

// SANS CAPTURES_9I6, CE FICHIER NE CRÉE RIEN (même convention que
// `zz-captures-9dn.spec.ts`).
test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9I6");

const CLIENT_9I6 = "01a0f300-0000-7000-8000-000000000001";
const SITE_9I6 = "01a0f300-0000-7000-8000-000000000002";
const CONTACT_9I6 = "01a0f300-0000-7000-8000-000000000003";
const INTERVENTION_9I6 = "01a0f300-0000-7000-8000-000000000004";
const DOCUMENT_9I6 = "01a0f300-0000-7000-8000-000000000005";
const SIGNATURE_9I6 = "01a0f300-0000-7000-8000-000000000006";

/** Un PNG 1×1 minimal mais DÉCODABLE — la capture montre une vraie
 * vignette, jamais une icône d'image cassée. */
const PHOTO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.document.deleteMany({ where: { id: DOCUMENT_9I6 } });
  await client.$executeRawUnsafe(
    `DELETE FROM "intervention_signature" WHERE "id" = $1::uuid`,
    SIGNATURE_9I6,
  );
  await client.$executeRawUnsafe(
    `DELETE FROM "intervention_machine" WHERE "intervention_id" = $1::uuid`,
    INTERVENTION_9I6,
  );
  await client.intervention.deleteMany({ where: { id: INTERVENTION_9I6 } });
  await client.contact.deleteMany({ where: { id: CONTACT_9I6 } });
  await client.site.deleteMany({ where: { id: SITE_9I6 } });
  await client.client.deleteMany({ where: { id: CLIENT_9I6 } });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    const technicien = await client.technicien.findFirstOrThrow({
      where: { societe_id: societe.id, actif: true },
      select: { utilisateur_id: true },
    });
    const machine = await client.machine.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9I6,
        societe_id: societe.id,
        raison_sociale: "9I6-CAPT-Client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9I6,
        societe_id: societe.id,
        client_id: CLIENT_9I6,
        agence_id: agence.id,
        libelle: "9I6-CAPT-Lieu",
        commune: "Nouméa",
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_9I6,
        societe_id: societe.id,
        client_id: CLIENT_9I6,
        site_id: SITE_9I6,
        nom: "9I6-CAPT-Contact sur place",
        telephone: "687000011",
        roles: ["donneur_ordre"],
        canaux: ["telephone"],
        actif: true,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9I6,
        societe_id: societe.id,
        client_id: CLIENT_9I6,
        site_id: SITE_9I6,
        agence_id: agence.id,
        contact_id: CONTACT_9I6,
        technicien_id: technicien.utilisateur_id,
        type: "curatif",
        priorite: "p1",
        statut: "cloturee",
        date_planifiee: new Date("2026-01-15T00:00:00Z"),
        duree_estimee_min: 90,
        description: "9I6-CAPT-Panne signalée",
        reference_client: "9I6-CAPT-BC-0001",
        commentaire_technicien: "9I6-CAPT-Commentaire du technicien",
        suite_a_donner: "9I6-CAPT-Suite à donner",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now())`,
      societe.id,
      INTERVENTION_9I6,
      machine.id,
    );
    await client.interventionSignature.create({
      data: {
        id: SIGNATURE_9I6,
        societe_id: societe.id,
        intervention_id: INTERVENTION_9I6,
        issue: "signee",
        image_base64: `data:image/png;base64,${PHOTO_BASE64}`,
        signataire_nom: "9I6-CAPT-Signataire",
        signataire_qualite: "Responsable technique",
      },
    });
    const octetsPhoto = Buffer.from(PHOTO_BASE64, "base64");
    const empreinte = createHash("sha256").update(octetsPhoto).digest("hex");
    await client.document.create({
      data: {
        id: DOCUMENT_9I6,
        societe_id: societe.id,
        intervention_id: INTERVENTION_9I6,
        classe: "client",
        libelle: "9I6-CAPT-Photo",
        nom_fichier: "9i6-capt-photo.png",
        type_mime: "image/png",
        taille_octets: octetsPhoto.length,
        empreinte,
        objet_cle: `bd:${empreinte}`,
        octets: octetsPhoto,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
  pleinePage: boolean,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  const suffixe = pleinePage ? "plein" : "viewport";
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETAPE}-${largeur}-${suffixe}.png`),
    fullPage: pleinePage,
  });
}

const ONGLETS = [
  "resume",
  "temps",
  "rapport",
  "valorisation",
  "historique",
] as const;

for (const largeur of [1280, 375] as const) {
  for (const onglet of ONGLETS) {
    test(`fiche intervention, onglet ${onglet}, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await page.goto(`/interventions/${INTERVENTION_9I6}?onglet=${onglet}`);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, `fiche-intervention-${onglet}`, largeur, false);
      await capturer(page, `fiche-intervention-${onglet}`, largeur, true);
    });
  }
}
