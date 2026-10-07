import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { choisirMachine, choisirPriorite } from "./setup/formulaire-creation";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EI-TP-UX5-1-FORMULAIRES/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

/**
 * 9EI-TP-UX5-1-FORMULAIRES (07/10/2026) — `/interventions/nouvelle` AU
 * GABARIT DE LA MAQUETTE DU 28/09, EN DEUX SECTIONS.
 *
 * ## Ce que les tests unitaires ne peuvent pas prouver
 *
 * `tests/unit/ui/choix.test.tsx` éprouve `Choix` (ui), pur ; `tests/unit/
 * interventions/creer-retour-formulaire.test.ts` éprouve `motifDuRefusDeSaisie`,
 * pur. Aucun des deux ne prouve qu'un ÉCRAN RÉEL rend les deux sections, que
 * la machine arrive en choix visibles (jusqu'à `SEUIL_CHOIX_VISIBLES`), que
 * le navigateur bloque réellement « Créer » sans priorité, ni que la colonne
 * de droite nomme le bon donneur d'ordre une fois le site choisi — c'est ce
 * que ce fichier joue, à travers le navigateur.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `TPUX5-`
 *
 * Un client, un site, DEUX machines (sous le seuil des choix visibles) et un
 * contact donneur d'ordre AVEC courriel — créés en `beforeAll`, supprimés en
 * `afterAll`. Aucune ligne ajoutée au semis (`prisma/seed.ts`,
 * `prisma/seed-data.ts`).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_TPUX5 = uuidv7();
const SITE_TPUX5 = uuidv7();
const MACHINE_1 = uuidv7();
const MACHINE_2 = uuidv7();
const CONTACT_DONNEUR_ORDRE = uuidv7();
const DEMANDE_QUALIFIEE = uuidv7();
const COURRIEL_DONNEUR_ORDRE = "donneur-ordre@tpux5.e2e.test";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_TPUX5,
        societe_id: societe.id,
        raison_sociale: fr["tpux5.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_TPUX5,
        societe_id: societe.id,
        client_id: CLIENT_TPUX5,
        agence_id: agence.id,
        libelle: fr["tpux5.e2e.lieu"],
      },
    });
    for (const [id, numeroSerie] of [
      [MACHINE_1, "TPUX5-SERIE-1"],
      [MACHINE_2, "TPUX5-SERIE-2"],
    ] as const) {
      await client.machine.create({
        data: {
          id,
          societe_id: societe.id,
          modele_id: modele.id,
          client_id: CLIENT_TPUX5,
          site_id: SITE_TPUX5,
          numero_serie: numeroSerie,
          qr_token: engendrerJetonQr(),
        },
      });
    }
    await client.contact.create({
      data: {
        id: CONTACT_DONNEUR_ORDRE,
        societe_id: societe.id,
        client_id: CLIENT_TPUX5,
        site_id: SITE_TPUX5,
        nom: fr["tpux5.e2e.donneur_ordre"],
        roles: ["donneur_ordre"],
        canaux: ["email"],
        email: COURRIEL_DONNEUR_ORDRE,
        actif: true,
      },
    });
    const maintenant = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_QUALIFIEE,
        societe_id: societe.id,
        source: "portail",
        client_id: CLIENT_TPUX5,
        site_id: SITE_TPUX5,
        machine_id: MACHINE_1,
        agence_id: agence.id,
        description: "TPUX5-demande-qualifiee",
        urgence: "p1",
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
        statut: "qualifiee",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { client_id: CLIENT_TPUX5 },
    });
    await client.demande.deleteMany({ where: { id: DEMANDE_QUALIFIEE } });
    await client.contact.deleteMany({ where: { client_id: CLIENT_TPUX5 } });
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_1, MACHINE_2] } },
    });
    await client.site.deleteMany({ where: { id: SITE_TPUX5 } });
    await client.client.deleteMany({ where: { id: CLIENT_TPUX5 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirUneSession(page);
});

function groupeMachine(page: Page) {
  return page
    .getByRole("radiogroup")
    .filter({ has: page.locator('input[name="machine_ids"]') });
}

function groupePriorite(page: Page) {
  return page
    .getByRole("radiogroup")
    .filter({ has: page.locator('input[name="priorite"]') });
}

test("deux sections numérotées, la machine en choix visibles, rien de coché", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  await expect(
    page.getByRole("heading", {
      name: fr["intervention.creation.section_lieu"],
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: fr["intervention.creation.section_demande"],
    }),
  ).toBeVisible();
  await capturer(page, "formulaire-vide");

  await choisirResultatParTexte(
    page,
    "site",
    fr["tpux5.e2e.lieu"],
    fr["tpux5.e2e.lieu"],
  );

  // LA MACHINE — deux exemplaires, sous le seuil des choix visibles : un
  // groupe de boutons radio, « Sans machine » compris. AUCUNE VRAIE machine
  // n'est préchoisie — « Sans machine » reste cochée par défaut, exactement
  // comme l'option vide du `<select>` qu'elle remplace (le dépannage à
  // l'aveugle est le cas ordinaire, PARCOURS-1).
  const machine = groupeMachine(page);
  await expect(machine).toBeVisible();
  await expect(
    machine.locator(`input[value="${MACHINE_1}"]`),
  ).not.toBeChecked();
  await expect(
    machine.locator(`input[value="${MACHINE_2}"]`),
  ).not.toBeChecked();
  await expect(
    machine.getByText(fr["intervention.machine.aucune_choisie"]),
  ).toBeVisible();
  await expect(machine.locator('input[value=""]')).toBeChecked();

  // LA PRIORITÉ — aucune valeur imposée.
  const priorite = groupePriorite(page);
  for (const valeur of ["p1", "p2", "p3", "p4"]) {
    await expect(
      priorite.locator(`input[value="${valeur}"]`),
    ).not.toBeChecked();
  }
  await capturer(page, "site-choisi-machines-en-choix");
});

test("« Créer » sans priorité ne part pas — le navigateur bloque la soumission", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(
    page,
    "site",
    fr["tpux5.e2e.lieu"],
    fr["tpux5.e2e.lieu"],
  );
  await page.locator('select[name="type"]').selectOption("curatif");
  await page
    .locator('textarea[name="description"]')
    .fill("TPUX5-panne-sans-priorite");

  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  // AUCUNE NAVIGATION — le groupe « Priorité », `required`, bloque la
  // soumission avant qu'elle n'atteigne le serveur.
  await expect(page).toHaveURL(/\/interventions\/nouvelle$/);
});

test("P2 + nature + description créent l'intervention, machine et priorité enregistrées", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(
    page,
    "site",
    fr["tpux5.e2e.lieu"],
    fr["tpux5.e2e.lieu"],
  );
  await choisirMachine(page, MACHINE_1);
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page
    .locator('textarea[name="description"]')
    .fill("TPUX5-panne-creation-complete");

  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+\?cree=1$/);

  // LE BANDEAU « PLANIFIER MAINTENANT / LAISSER DANS LA FILE » (PG-B6) —
  // « Planifier maintenant » est un BOUTON (ouvre `TrouverCreneau`), jamais
  // un lien.
  await expect(
    page.getByRole("button", {
      name: fr["intervention.creation.planifier_maintenant"],
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: fr["intervention.creation.laisser_dans_la_file"],
    }),
  ).toBeVisible();

  const id = new URL(page.url()).pathname.split("/").pop();
  const client = admin();
  try {
    const fiche = await client.intervention.findUniqueOrThrow({
      where: { id },
      select: {
        priorite: true,
        machines: { select: { machine_id: true } },
      },
    });
    expect(fiche.priorite).toBe("p2");
    expect(fiche.machines.map((m) => m.machine_id)).toEqual([MACHINE_1]);
  } finally {
    await client.$disconnect();
  }
});

test("`?machine=` coche la carte de la machine préremplie", async ({
  page,
}) => {
  await page.goto(
    `/interventions/nouvelle?site=${SITE_TPUX5}&machine=${MACHINE_2}`,
  );
  const machine = groupeMachine(page);
  await expect(machine.locator(`input[value="${MACHINE_2}"]`)).toBeChecked();
  await expect(
    machine.locator(`input[value="${MACHINE_1}"]`),
  ).not.toBeChecked();
});

test("« Qui sera prévenu » nomme le donneur d'ordre une fois le site choisi", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  const colonne = page.locator('[data-bloc="qui-sera-prevenu"]');
  await expect(
    colonne.getByText(fr["intervention.creation.prevenu_titre"]),
  ).toBeVisible();

  await choisirResultatParTexte(
    page,
    "site",
    fr["tpux5.e2e.lieu"],
    fr["tpux5.e2e.lieu"],
  );
  await expect(colonne.getByText(fr["tpux5.e2e.donneur_ordre"])).toBeVisible();
});

test("un refus de saisie garde ce qui a été saisi, et l'erreur apparaît sous le champ Priorité", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(
    page,
    "site",
    fr["tpux5.e2e.lieu"],
    fr["tpux5.e2e.lieu"],
  );
  await page.locator('select[name="type"]').selectOption("curatif");
  await page
    .locator('textarea[name="description"]')
    .fill("TPUX5-panne-refus-priorite");

  // LA PRIORITÉ RESTE VIDE, exprès — `required` retiré pour atteindre le
  // refus SERVEUR, pas seulement celui du navigateur (même geste que
  // `nature-obligatoire.spec.ts`).
  await page
    .locator('form[action="/api/interventions/creer"]')
    .evaluate((form) => {
      for (const bouton of form.querySelectorAll('[name="priorite"]')) {
        bouton.removeAttribute("required");
      }
    });

  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/interventions\/nouvelle\?/);
  await expect(page.getByRole("status")).toContainText(
    fr["intervention.refus.priorite_manquante"],
  );
  // L'ERREUR APPARAÎT AUSSI SOUS LE GROUPE « PRIORITÉ » (TP-UX5-1-FORMULAIRES).
  const priorite = groupePriorite(page);
  await expect(priorite).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText(fr["intervention.refus.priorite_manquante"]),
  ).toHaveCount(2);

  // LA SAISIE EST GARDÉE — nature et panne reportées.
  await expect(page.locator('select[name="type"]')).toHaveValue("curatif");
  await expect(page.locator('textarea[name="description"]')).toHaveValue(
    "TPUX5-panne-refus-priorite",
  );
  await capturer(page, "refus-erreur-sous-le-champ-priorite");
});

test("depuis une demande qualifiée, le lieu, la machine et l'urgence préremplissent le formulaire", async ({
  page,
}) => {
  await page.goto(`/interventions/nouvelle?demande=${DEMANDE_QUALIFIEE}`);
  await expect(
    page.locator('[data-selecteur="site"] input[type="text"]'),
  ).toHaveValue(new RegExp(fr["tpux5.e2e.lieu"]));
  await expect(
    groupeMachine(page).locator(`input[value="${MACHINE_1}"]`),
  ).toBeChecked();
  await expect(groupePriorite(page).locator('input[value="p1"]')).toBeChecked();
  await capturer(page, "depuis-une-demande-qualifiee");
});
