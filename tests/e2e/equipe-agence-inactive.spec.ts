import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * AGENCE-ACTIVE (AA-3-EQUIPE) — UN TECHNICIEN DÉJÀ RATTACHÉ À UNE AGENCE
 * DÉSACTIVÉE APRÈS COUP GARDE SON RATTACHEMENT AU MENU DE MODIFICATION.
 *
 * ## Le constat
 *
 * `/parametres/equipe` propose désormais, pour CHAQUE technicien, les agences
 * proposables AUTOUR de son rattachement actuel (`agencesProposablesPourTechnicien`,
 * `lib/techniciens/depot.ts`) — même précédent, même piège fermé, que
 * `/sites/[id]` (`agences-choix-sites.spec.ts`) : sans lui, un technicien
 * rattaché à une agence désactivée perdrait son option, le navigateur
 * retomberait sur la première agence du menu, et le prochain « Enregistrer »
 * d'un tout autre champ déraperait son rattachement sans que personne ne
 * l'ait demandé.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `AA3-`
 *
 * Une agence inactive et un technicien déjà rattaché à elle — créés
 * directement en base en `beforeAll` (même discipline que
 * `agences-choix-sites.spec.ts`) : le rattachement est un FAIT antérieur à la
 * désactivation, pas un geste que ce scénario rejoue. Supprimés en
 * `afterAll`. Aucune ligne du semis ni de `tests/e2e/setup/scene.ts` n'est
 * touchée — seule l'identité déjà activée `COMPTE_ADMIN_SOCIETE_EPREUVE` est
 * empruntée pour ouvrir une session, comme le fait déjà `equipe.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "AA3-";
const CODE_AGENCE_INACTIVE = `${PREFIXE}INACTIVE`;
const NOM_TECHNICIEN = `${PREFIXE}Technicien`;
const COURRIEL_TECHNICIEN = `${PREFIXE.toLowerCase()}technicien@codima.test`;

const AGENCE_INACTIVE_ID = randomUUID();
const UTILISATEUR_ID = randomUUID();
const UTILISATEUR_SOCIETE_ID = randomUUID();
const TECHNICIEN_ID = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.technicien.deleteMany({ where: { id: TECHNICIEN_ID } });
  await client.utilisateurSociete.deleteMany({
    where: { id: UTILISATEUR_SOCIETE_ID },
  });
  await client.utilisateur.deleteMany({ where: { id: UTILISATEUR_ID } });
  await client.agence.deleteMany({ where: { id: AGENCE_INACTIVE_ID } });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);

    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });

    await client.agence.create({
      data: {
        id: AGENCE_INACTIVE_ID,
        societe_id: societe.id,
        code: CODE_AGENCE_INACTIVE,
        libelle: CODE_AGENCE_INACTIVE,
        territoire: "NC",
        actif: false,
      },
    });
    await client.utilisateur.create({
      data: {
        id: UTILISATEUR_ID,
        nom: NOM_TECHNICIEN,
        email: COURRIEL_TECHNICIEN,
        email_verifie: true,
        actif: true,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: UTILISATEUR_SOCIETE_ID,
        utilisateur_id: UTILISATEUR_ID,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    // LE FAIT ANTÉRIEUR : ce technicien est rattaché à l'agence AVANT que ce
    // scénario ne commence — la désactivation ne le déloge jamais.
    await client.technicien.create({
      data: {
        id: TECHNICIEN_ID,
        societe_id: societe.id,
        utilisateur_id: UTILISATEUR_ID,
        agence_id: AGENCE_INACTIVE_ID,
        actif: true,
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
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
});

function sectionDuTechnicien(page: Page) {
  return page
    .locator("details")
    .filter({ hasText: NOM_TECHNICIEN })
    .filter({ has: page.locator("form") });
}

test("UN TECHNICIEN DÉJÀ RATTACHÉ GARDE SON AGENCE INACTIVE SÉLECTIONNÉE, MARQUÉE « (INACTIVE) », ET ENREGISTRER UN AUTRE CHAMP NE CHANGE PAS SON RATTACHEMENT", async ({
  page,
}) => {
  await page.goto("/parametres/equipe");

  const section = sectionDuTechnicien(page);
  await expect(section).toBeVisible();
  await section.locator("summary").click();

  const selecteur = section.locator('select[name="agence_id"]');
  await expect(selecteur).toHaveValue(AGENCE_INACTIVE_ID);

  const optionGardee = section.locator(
    `select[name="agence_id"] option[value="${AGENCE_INACTIVE_ID}"]`,
  );
  await expect(optionGardee).toContainText(fr["agence.option.inactive"]);

  // Un tout autre champ — la case d'activité —, jamais le rattachement.
  await section.getByLabel(fr["equipe.actif"]).uncheck();
  await section.getByRole("button", { name: fr["equipe.enregistrer"] }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/parametres\/equipe(\?|$)/);

  // LE LIVRABLE : rechargée, la fiche montre le MÊME rattachement — jamais
  // celui que le navigateur aurait retenu par défaut si l'option avait
  // manqué.
  await page.goto("/parametres/equipe?etat=tous");
  const sectionApres = sectionDuTechnicien(page);
  await sectionApres.locator("summary").click();
  await expect(sectionApres.locator('select[name="agence_id"]')).toHaveValue(
    AGENCE_INACTIVE_ID,
  );
});
