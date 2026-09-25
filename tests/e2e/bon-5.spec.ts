import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 83-BON-5 — LE BON IMPRIME POUR LE CLIENT : SANS SECTIONS VIDES, SANS
 * MESSAGE INTERNE, EN A4, AVEC RETOUR À LA FICHE.
 *
 * ## Le constat
 *
 * L'audit du 25/09 mesurait jusqu'à neuf sections vides sur la zone imprimée
 * (« Aucune prestation… », « Aucune photo… », etc.) et, pour un rôle sans
 * accès aux montants, la phrase INTERNE « Votre rôle ne donne pas accès aux
 * montants de vente » imprimée sur un document destiné au client.
 * `tests/unit/*` ne peut pas prouver ce qu'un `@media print` réel rend — c'est
 * ce que ce fichier joue, à travers le navigateur, avec
 * `page.emulateMedia({ media: "print" })`.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `BON5-`
 *
 * Un client, un site, une intervention `terminee` — SANS photo, SANS
 * commentaire, SANS suite, SANS segment, SANS prestation, SANS signature —
 * créés en `beforeAll`, supprimés en `afterAll`, aucune ligne ajoutée au
 * semis (même discipline que `tests/e2e/bon-4.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_BON5 = uuidv7();
const SITE_BON5 = uuidv7();
const INTERVENTION_BON5 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_BON5,
        societe_id: reperes.societeId,
        raison_sociale: fr["bon5.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_BON5,
        societe_id: reperes.societeId,
        client_id: CLIENT_BON5,
        agence_id: agence.id,
        libelle: fr["bon5.e2e.site"],
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_BON5,
        societe_id: reperes.societeId,
        client_id: CLIENT_BON5,
        site_id: SITE_BON5,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-09-24T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // CASCADE efface l'intervention avec elle-même — aucun segment, aucune
    // photo, aucune signature n'ont été posés par cette scène.
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_BON5,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_BON5 } });
    await client.client.deleteMany({ where: { id: CLIENT_BON5 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/83-BON-5/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function seConnecterTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  // Retouché par 99A-ARRIVEE : ce compte n'a qu'UNE société, donc `/arrivee`
  // redirige d'emblée au terrain plutôt que de s'y arrêter.
  await expect(page).toHaveURL(/\/terrain$/);
}

test("à l'impression, les sections vides disparaissent — l'identification reste", async ({
  page,
}) => {
  await seConnecterTechnicien(page);
  await page.goto(`/interventions/${INTERVENTION_BON5}/bon`);

  // À L'ÉCRAN — comme aujourd'hui, le bureau voit ce qui manque.
  await expect(
    page.getByText(fr["intervention.bon.aucune_photo"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucun_commentaire"]),
  ).toBeVisible();

  await capturer(page, "bon5-ecran", 1280);

  // À L'IMPRESSION — les sections sans contenu ne sont plus là.
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByText(fr["intervention.bon.aucune_photo"]),
  ).not.toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucun_commentaire"]),
  ).not.toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_suite"]),
  ).not.toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucun_segment"]),
  ).not.toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_prestation"]),
  ).not.toBeVisible();

  // La section client/machine, elle, reste imprimée.
  await expect(
    page.getByText(fr["bon5.e2e.client"], { exact: true }),
  ).toBeVisible();

  await capturer(page, "bon5-impression", 1280);
});

test("le lien de retour mène à la fiche", async ({ page }) => {
  await seConnecterTechnicien(page);
  await page.goto(`/interventions/${INTERVENTION_BON5}/bon`);

  const lien = page.getByRole("link", { name: /Fiche/ });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute(
    "href",
    `/interventions/${INTERVENTION_BON5}`,
  );

  // Ce lien n'existe qu'à l'écran — jamais sur le papier.
  await page.emulateMedia({ media: "print" });
  await expect(lien).not.toBeVisible();
});

test("`admin_societe` — la phrase de droits sur les montants n'est jamais imprimée", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_BON5}/bon`);

  // À L'ÉCRAN — le motif reste affiché (D88 : « ce n'est pas pour vous »,
  // jamais un vide muet).
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).not.toBeVisible();

  await page.pdf({
    path: join(DOSSIER_CAPTURES, "bon5-impression-a4.pdf"),
    format: "A4",
  });
});
