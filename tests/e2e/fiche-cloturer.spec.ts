import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99R-GR3-CLOTURE — LA CLÔTURE DIT QUE LE TEMPS SE FIGE, ET CONFIRME EN
 * HEURES.
 *
 * ## Le constat (audit GR du 26/09/2026, constat G5)
 *
 * Le temps se validait dans « Clôturer » sans qu'aucune aide ne dise que ce
 * chiffre ne se corrigerait plus, et le bouton se soumettait d'un clic, sans
 * confirmation — la clôture fige déjà le temps en base (trigger
 * `intervention_cycle_de_vie`) ; ce chantier le DIT avant le geste.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ERGO3-`
 *
 * Une intervention `terminee`, un temps mesuré de 90 minutes (« 1 h 30 ») —
 * créée en `beforeAll`, supprimée en `afterAll`, aucune ligne ajoutée au
 * semis (même discipline que `tests/e2e/fiche-annuler.spec.ts`).
 *
 * ## SÉRIE : LES TROIS ÉPREUVES PROGRESSENT SUR LA MÊME LIGNE
 *
 * L'aide visible (1), une confirmation refusée qui ne change rien (2), puis
 * une confirmation acceptée qui clôture (3) — `mode: "serial"` le garantit.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ERGO3 = uuidv7();
const SITE_ERGO3 = uuidv7();
const INTERVENTION_ERGO3 = uuidv7();

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
        id: CLIENT_ERGO3,
        societe_id: reperes.societeId,
        raison_sociale: fr["ergo3.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ERGO3,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO3,
        agence_id: agence.id,
        libelle: fr["ergo3.e2e.site"],
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ERGO3,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO3,
        site_id: SITE_ERGO3,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-09-24T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
    // LE SEGMENT D'ABORD, LA SOMME ENSUITE — le déclencheur
    // `intervention_temps_mesure_est_celui_du_compteur` vérifie que
    // `temps_mesure_min` est la somme des segments FERMÉS déjà présents ;
    // l'écrire avant qu'aucun segment n'existe le refuserait (même ordre que
    // `tests/e2e/bon-intervention.spec.ts`).
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now() - interval '90 minutes', now(), now())`,
      reperes.societeId,
      INTERVENTION_ERGO3,
      reperes.technicienDucos,
    );
    await client.intervention.update({
      where: { id: INTERVENTION_ERGO3 },
      data: { temps_mesure_min: 90 },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // LE SEGMENT D'ABORD : `segment_travail.intervention` est `onDelete:
    // Restrict` (schema.prisma) — supprimer l'intervention avant lui échoue.
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_ERGO3,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ERGO3,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ERGO3 } });
    await client.client.deleteMany({ where: { id: CLIENT_ERGO3 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/99R-GR3-CLOTURE/captures",
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

// BASCULE (9ES-TP-UX4-3-FICHE-GESTES-1) — le champ et son aide vivent
// désormais dans le dialogue « Clôturer <réf> », pas dans un bloc toujours
// déplié de la carte Actions : il faut l'ouvrir avant de les mesurer.
test("l'aide « ce temps ne se corrige plus » est visible sous le champ, dans le dialogue", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_ERGO3}`);

  await page
    .getByRole("button", { name: fr["intervention.action.cloturer"] })
    .click();
  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  await expect(
    dialogue.getByLabel(fr["intervention.cloture.temps_valide_saisie"]),
  ).toHaveValue("90");
  await expect(
    dialogue.getByText(fr["intervention.cloture.aide_figee"]),
  ).toBeVisible();

  await capturer(page, "bloc-cloturer-apres", 1280);
  await capturer(page, "bloc-cloturer-apres", 375);
});

// BASCULE (9ES-TP-UX4-3-FICHE-GESTES-1) — le dialogue générique ne recompose
// plus la phrase « Clôturer avec … validées ? » (ancien `BoutonCloturer`,
// `texteConfirmationCloture`) : il montre le champ ACTUEL, pré-rempli, et
// son aide — le dialogue EST la confirmation, il n'y en a plus une seconde
// par-dessus. Son pied dit « Fermer », jamais « Revenir » (générique à tout
// `Dialogue`, pas propre à la clôture).
test("« Clôturer » ouvre le dialogue avec la durée, et « Fermer » ne change rien", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_ERGO3}`);

  const bouton = page.getByRole("button", {
    name: fr["intervention.action.cloturer"],
  });
  await bouton.click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();
  await expect(
    dialogue.getByLabel(fr["intervention.cloture.temps_valide_saisie"]),
  ).toHaveValue("90");
  await expect(
    dialogue.getByText(fr["intervention.cloture.aide_figee"]),
  ).toBeVisible();

  await capturer(page, "dialogue-cloturer", 1280);
  await capturer(page, "dialogue-cloturer", 375);

  await dialogue
    .getByRole("button", { name: fr["ui.dialogue.fermer"] })
    .click();
  await expect(dialogue).toBeHidden();

  // RIEN N'A ÉTÉ ENVOYÉ — ni la page (toujours la fiche, non rechargée), ni
  // la base : le statut reste `terminee`.
  await expect(page).toHaveURL(`/interventions/${INTERVENTION_ERGO3}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.terminee"]),
  ).toBeVisible();

  const client = admin();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_ERGO3 },
      select: { statut: true, temps_valide_min: true },
    });
    expect(ligne.statut).toBe("terminee");
    expect(ligne.temps_valide_min).toBeNull();
  } finally {
    await client.$disconnect();
  }
});

// BASCULE (9ES-TP-UX4-3-FICHE-GESTES-1) — le pied du dialogue reprend le même
// libellé que le déclencheur (« Clôturer »), jamais « Confirmer la clôture » :
// le dialogue EST la confirmation, un second verbe n'ajouterait rien.
test("une confirmation acceptée clôture l'intervention avec le temps validé", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_ERGO3}`);

  await page
    .getByRole("button", { name: fr["intervention.action.cloturer"] })
    .click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();
  await dialogue
    .getByRole("button", { name: fr["intervention.action.cloturer"] })
    .click();

  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.cloturee"]),
  ).toBeVisible();

  const client = admin();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_ERGO3 },
      select: { statut: true, temps_valide_min: true },
    });
    expect(ligne.statut).toBe("cloturee");
    expect(ligne.temps_valide_min).toBe(90);
  } finally {
    await client.$disconnect();
  }
});
