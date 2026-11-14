import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L04H-TERRAIN-RECAPITULATIF-SIGNATURE — le récapitulatif ouvert depuis la
 * rubrique Signature (constat de la revue du 13/11/2026 : le technicien ne
 * voit jamais le bon, D221, et le client signait sans avoir rien vu), puis
 * la signature elle-même : nom prérempli avec le contact sur place, qualité
 * en segments.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L04H-TERRAIN-RECAPITULATIF-SIGNATURE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

type Scene = {
  readonly clientId: string;
  readonly siteId: string;
  readonly contactId: string;
  readonly interventionId: string;
  readonly prestationId: string;
  readonly modeleId: string;
};

async function creerScene(client: PrismaClient, prefixe: string): Promise<Scene> {
  const reperes = await reperesDeLaScene();
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: { id: true },
  });

  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: reperes.societeId,
      raison_sociale: `zz${prefixe} client récapitulatif`,
      actif: true,
    },
  });

  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: reperes.societeId,
      client_id: clientId,
      agence_id: agence.id,
      libelle: `zz${prefixe} site récapitulatif`,
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const contactId = uuidv7();
  await client.contact.create({
    data: {
      id: contactId,
      societe_id: reperes.societeId,
      client_id: clientId,
      site_id: null,
      nom: fr["9l04h.e2e.contact_nom"],
      email: "zz9l04h-contact@epreuve.test",
      roles: ["signataire"],
    },
  });

  const prestationId = uuidv7();
  await client.prestation.create({
    data: {
      id: prestationId,
      societe_id: reperes.societeId,
      code: `ZZ${prefixe}-PREST`,
      libelle: fr["9l04h.e2e.prestation_libelle"],
      actif: true,
    },
  });

  const interventionId = uuidv7();
  await client.intervention.create({
    data: {
      id: interventionId,
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      contact_id: contactId,
      technicien_id: reperes.technicienDucos,
      type: "curatif",
      priorite: "p3",
      statut: "en_cours",
      date_planifiee: new Date("2026-11-20T08:00:00Z"),
      creneau_debut: new Date("2026-11-20T08:00:00Z"),
      creneau_fin: new Date("2026-11-20T10:00:00Z"),
      duree_estimee_min: 120,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-recapitulatif-signature`,
      commentaire_technicien: `zz${prefixe} déjà rempli.`,
    },
  });

  await client.interventionPrestation.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      prestation_id: prestationId,
    },
  });

  await client.segmentTravail.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      utilisateur_id: reperes.technicienDucos,
      nom_technicien_affiche: "Technicien de l'épreuve",
      debut: new Date(Date.now() - 2 * 60 * 60_000),
      fin: new Date(),
    },
  });

  const modeleId = uuidv7();
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: reperes.societeId,
      code: `ZZ${prefixe}-L04H`,
      libelle: `zz${prefixe} modèle récapitulatif`,
      actif: false,
    },
  });
  const versionId = uuidv7();
  await client.checklistVersion.create({
    data: {
      id: versionId,
      societe_id: reperes.societeId,
      checklist_modele_id: modeleId,
      numero: 1,
    },
  });
  await client.checklistPoint.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      checklist_version_id: versionId,
      section: fr["9l04h.e2e.section"],
      ordre: 1,
      libelle: fr["9l04h.e2e.point_libelle"],
      obligatoire: false,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  await client.intervention.update({
    where: { id: interventionId },
    data: { checklist_version_id: versionId },
  });

  return { clientId, siteId, contactId, interventionId, prestationId, modeleId };
}

async function nettoyerScene(
  client: PrismaClient,
  scene: Scene | null,
): Promise<void> {
  if (scene !== null) {
    await client.checklistReponse.deleteMany({
      where: { intervention_id: scene.interventionId },
    });
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "checklist_version_id" = NULL WHERE "id" = $1::uuid`,
      scene.interventionId,
    );
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: scene.modeleId },
    });
    await client.checklistModele.deleteMany({ where: { id: scene.modeleId } });
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.interventionPrestation.deleteMany({
      where: { intervention_id: scene.interventionId },
    });
    await client.prestation.deleteMany({ where: { id: scene.prestationId } });
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.contact.deleteMany({ where: { id: scene.contactId } });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

test("375 px — le récapitulatif se lit avant la signature, sans aucun montant ; le nom du signataire est prérempli avec le contact, la qualité se choisit en segments", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9L04HA");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await expect(
      page.getByRole("heading", { name: fr["terrain.signature.titre"] }),
    ).toBeVisible();
    await capturer(page, "fiche-avant-recapitulatif-avant");

    // LE RÉCAPITULATIF S'OUVRE DEPUIS LA RUBRIQUE SIGNATURE (point 1-2).
    await page
      .getByRole("button", { name: fr["terrain.recapitulatif.ouvrir"] })
      .click();
    const recapitulatif = page.getByRole("dialog", {
      name: fr["terrain.recapitulatif.titre"],
    });
    await expect(recapitulatif).toBeVisible();
    await expect(
      recapitulatif.getByText(fr["terrain.recapitulatif.sous_titre"]),
    ).toBeVisible();
    await expect(
      recapitulatif.getByText(fr["9l04h.e2e.prestation_libelle"]),
    ).toBeVisible();
    await capturer(page, "recapitulatif-ouvert-apres");

    // AUCUN MONTANT NULLE PART DANS LE RÉCAPITULATIF (I3/D176).
    const texteRecapitulatif = (await recapitulatif.textContent()) ?? "";
    expect(texteRecapitulatif).not.toMatch(/XPF|FCFP|€/i);
    expect(texteRecapitulatif).not.toMatch(/\d[\d\s]*(?:XPF|FCFP|€)/i);

    await page
      .getByRole("button", { name: fr["terrain.recapitulatif.fermer"] })
      .click();
    await expect(recapitulatif).toBeHidden();

    // LE NOM EST PRÉREMPLI AVEC LE CONTACT SUR PLACE (point 2) — modifiable.
    await page
      .getByRole("button", { name: fr["terrain.signature.option_signee"] })
      .click();
    const nom = page.getByLabel(fr["terrain.signature.nom_libelle"]);
    await expect(nom).toHaveValue(fr["9l04h.e2e.contact_nom"]);

    // LA QUALITÉ EN SEGMENTS — « Resp. atelier ».
    await page
      .getByRole("radio", { name: fr["terrain.signature.qualite.resp_atelier"] })
      .click();
    await capturer(page, "signature-qualite-segments-apres");

    // Voir `bon-4.spec.ts` : dispatch direct, la simulation matérielle de
    // Playwright s'étant révélée peu fiable sur des coordonnées calculées.
    await page.locator("canvas").evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      const envoyer = (type: string, x: number, y: number): void => {
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: rectangle.left + x,
            clientY: rectangle.top + y,
            pointerId: 1,
          }),
        );
      };
      envoyer("pointerdown", 20, 20);
      envoyer("pointermove", 60, 60);
      envoyer("pointerup", 60, 60);
    });

    await page
      .getByRole("button", { name: fr["terrain.signature.valider"] })
      .click();
    await expect(
      page.getByText(fr["terrain.signature.enregistre"]),
    ).toBeVisible();
    await capturer(page, "signature-validee-apres");

    const signature = await client.$queryRawUnsafe<
      { signataire_nom: string; signataire_qualite: string }[]
    >(
      `SELECT signataire_nom, signataire_qualite FROM "intervention_signature" WHERE "intervention_id" = $1::uuid ORDER BY "cree_le" DESC LIMIT 1`,
      scene.interventionId,
    );
    expect(signature[0]?.signataire_nom).toBe(fr["9l04h.e2e.contact_nom"]);
    expect(signature[0]?.signataire_qualite).toBe(
      fr["terrain.signature.qualite.resp_atelier"],
    );
  } finally {
    await nettoyerScene(client, scene);
  }
});
