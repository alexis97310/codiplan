import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "../e2e/setup/base";
import {
  dialogueOuvert,
  formulaireDialogue,
  ouvrirSaisieManuelle,
} from "../e2e/setup/saisie-manuelle";
import { choisirPriorite } from "../e2e/setup/formulaire-creation";
import { reperesDeLaScene } from "../e2e/setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "../e2e/setup/scene";
import { choisirResultatParTexte } from "../e2e/setup/selecteur-recherche";
import { ouvrirLaSessionSensible } from "../e2e/setup/session";

/**
 * PARCOURS P1 DE BOUT EN BOUT — SUR UNE MÊME INTERVENTION, EN PLUSIEURS
 * SESSIONS (9F5-AUDIT-FONCTIONNEL-PARCOURS, point 3(a)).
 *
 * ADV crée et planifie → transmet → technicien démarre, compteur, rapport,
 * photo, signature, termine → ADV clôt → bon → « À facturer ».
 *
 * Les épreuves e2e existantes couvrent chaque MAILLON séparément, avec sa
 * propre fixture posée directement en base ; AUCUNE ne fait circuler la
 * MÊME intervention d'un bout à l'autre, écran par écran, comme deux
 * personnes le feraient réellement l'une après l'autre. C'est l'écart que ce
 * fichier vise.
 *
 * `test.describe.configure({ mode: "serial" })` : chaque étape dépend de
 * l'état que la précédente a laissé — un échec à l'étape N rend les
 * suivantes inexécutables de toute façon, et Playwright les saute plutôt
 * que de les faire échouer en cascade pour une raison étrangère.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "zz9F5-P1";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let technicienDucosId = "";
let libelleSiteDucos = "";
let interventionId = "";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  technicienDucosId = reperes.technicienDucos;
  const client = admin();
  try {
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence: { code: "DUCOS" } },
      select: { libelle: true },
      orderBy: { libelle: "asc" },
    });
    libelleSiteDucos = site.libelle;
  } finally {
    await client.$disconnect();
  }
});

test("ADV crée l'intervention et la planifie", async ({ page }) => {
  await ouvrirLaSessionSensible(page, "adv@codima.test");
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(
    page,
    "site",
    libelleSiteDucos,
    libelleSiteDucos,
  );
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page
    .locator('textarea[name="description"]')
    .fill(`${PREFIXE} — panne compresseur, audit de bout en bout`);
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+(\?cree=1)?$/);
  interventionId = new URL(page.url()).pathname.split("/").at(-1) as string;
  expect(interventionId.length).toBeGreaterThan(0);

  const reperes = await reperesDeLaScene();
  const lundiDansDixSemaines = new Date(
    Date.UTC(reperes.lundi.annee, reperes.lundi.mois - 1, reperes.lundi.jour),
  );
  lundiDansDixSemaines.setUTCDate(lundiDansDixSemaines.getUTCDate() + 70);
  const cleJour = lundiDansDixSemaines.toISOString().slice(0, 10);

  await ouvrirSaisieManuelle(page);
  const formulaire = formulaireDialogue(page);
  await formulaire.locator('input[name="date_planifiee"]').fill(cleJour);
  await formulaire.locator('input[name="heure_debut"]').fill("10:00");
  await formulaire.locator('input[name="duree_min"]').fill("60");
  await formulaire
    .locator('select[name="technicien_id"]')
    .selectOption(technicienDucosId);
  await dialogueOuvert(page)
    .getByRole("button", {
      name: fr["intervention.action.planifier_a_la_main"],
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
  ).toBeVisible();
});

test("ADV transmet au technicien", async ({ page }) => {
  await ouvrirLaSessionSensible(page, "adv@codima.test");
  await page.goto(`/interventions/${interventionId}`);
  await page
    .getByRole("button", { name: fr["intervention.action.transmettre"] })
    .click();
  await dialogueOuvert(page)
    .getByRole("button", { name: fr["intervention.action.transmettre"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.affectee"]),
  ).toBeVisible();
});

test("le technicien démarre le compteur, rapporte, photographie et signe", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${interventionId}`);

  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${interventionId}$`));
  await expect(
    page.getByText(
      new RegExp(`${fr["terrain.compteur.tourne_depuis"]} \\d{2}:\\d{2}`),
    ),
  ).toBeVisible();

  // LE COMPTEUR EST LA SEULE SOURCE DU TEMPS (D120) — sans ce recul, le
  // segment ouvert ne porterait que les quelques secondes d'exécution de ce
  // scénario, et « Terminer » refuserait pour « aucun temps mesuré »
  // (mesuré : c'est exactement ce qui s'est produit avant ce recul). Même
  // geste que `tests/e2e/9de-terminer-signature.spec.ts`.
  const clientRecul = admin();
  try {
    await clientRecul.$executeRawUnsafe(
      `UPDATE "segment_travail" SET "debut" = "debut" - interval '70 minutes'
        WHERE "intervention_id" = $1::uuid AND "fin" IS NULL`,
      interventionId,
    );
  } finally {
    await clientRecul.$disconnect();
  }
  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.tourne_depuis"]),
  ).toHaveCount(0);

  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill(`${PREFIXE} — compresseur remplacé`);
  await page
    .getByLabel(fr["terrain.rapport.suite_libelle"])
    .fill(`${PREFIXE} — aucune, intervention close`);
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();
  await expect(page.getByText(fr["terrain.rapport.enregistre"])).toBeVisible();

  const dossierPhoto = mkdtempSync(join(tmpdir(), "codiplan-9f5-p1-"));
  const cheminPhoto = join(dossierPhoto, "zz9f5-photo.png");
  writeFileSync(
    cheminPhoto,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  await page.locator('input[type="file"]').setInputFiles(cheminPhoto);
  await page
    .getByRole("button", { name: fr["terrain.photos.ajouter"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${interventionId}$`));
  await expect(page.locator("img[alt='zz9f5-photo.png']")).toBeVisible();

  await page
    .getByRole("button", { name: fr["terrain.signature.option_signee"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.nom_libelle"])
    .fill(`${PREFIXE} Signataire`);
  await page
    .getByLabel(fr["terrain.signature.qualite_libelle"])
    .fill("Responsable site");
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
    envoyer("pointermove", 100, 80);
    envoyer("pointerup", 100, 80);
  });
  await expect(
    page.getByText(fr["terrain.signature.enregistre"]),
  ).toBeVisible();

  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${interventionId}$`));
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();
});

test("ADV clôture l'intervention", async ({ page }) => {
  await ouvrirLaSessionSensible(page, "adv@codima.test");
  await page.goto(`/interventions/${interventionId}`);
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
});

test("le bon imprime la signature, et la fiche rejoint (ou non) « À facturer »", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, "adv@codima.test");
  const reponseBon = await page.goto(`/interventions/${interventionId}/bon`);
  expect(reponseBon, "aucune réponse rendue par /bon").not.toBeNull();
  expect(reponseBon!.status(), "le bon n'a pas rendu 200").toBe(200);
  await expect(
    page.getByText(
      `${fr["intervention.bon.signe_par"]} ${PREFIXE} Signataire (Responsable site) ${fr["intervention.bon.le"]}`,
      { exact: false },
    ),
  ).toBeVisible();

  // CONSTAT, PAS UNE EXIGENCE — ce fichier TROUVE et DÉCRIT (9F5) : la
  // présence ou l'absence de cette fiche dans « À facturer » juste après la
  // clôture et l'impression du bon est consignée dans le rapport
  // (docs/audits/9F5-fonctionnel/rapport.md), pas assertée ici en dur, pour
  // ne pas transformer une observation en un attendu inventé.
  await page.goto("/interventions/a-facturer");
  const presente = await page.getByText(PREFIXE, { exact: false }).count();
  // eslint-disable-next-line no-console -- relevé volontairement visible dans la sortie de `pnpm audit:fonctionnel`, pour le rapport du point 4
  console.log(
    `9F5-P1 — /interventions/a-facturer ${presente > 0 ? "MONTRE" : "NE MONTRE PAS"} l'intervention ${interventionId} juste après clôture + bon.`,
  );
});

test.afterAll(async () => {
  if (interventionId === "") {
    return;
  }
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      interventionId,
    );
    await client.intervention.deleteMany({ where: { id: interventionId } });
  } finally {
    await client.$disconnect();
  }
});
