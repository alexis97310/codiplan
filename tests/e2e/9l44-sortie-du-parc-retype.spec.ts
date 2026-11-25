import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9L44-STATUT-MACHINE-SIMULTANE-SORTIE, DE BOUT EN BOUT — la sortie du parc
 * retape le code de la machine avant que la confirmation ne s'active.
 *
 * `tests/isolation/changer-statut-machine.test.ts` prouve déjà que
 * `decisionDepuisLaFiche` exige une confirmation ; il ne prouve pas que
 * l'ÉCRAN bloque réellement le bouton tant que le code n'est pas retapé à
 * l'identique — exactement ce que ce spec éprouve.
 *
 * **Fixture À SOI** (préfixe `9L44-`), jamais le jeu partagé — même
 * discipline que `tests/e2e/9l20-deplacer-machine.spec.ts` : ce spec ÉCRIT
 * le statut d'une machine. SÉRIEL aux deux largeurs, qui rejouent la même
 * scène sur la même fixture, remise à `en_service` entre les deux.
 *
 * **CAPTURES (consigne permanente d'Alexis)** — `CAPTURES_9L44` pose le
 * dossier de sortie ; absent, aucune capture n'est prise. Seul l'APRÈS est
 * versé : le champ de retype est NEUF, il n'existe nulle part dans l'arbre
 * d'avant ce lot pour qu'un AVANT le montre — même raisonnement déjà
 * documenté par `9l20-deplacer-machine.spec.ts` (« AVANT NON REPRODUCTIBLE
 * SUR CET ARBRE »). Le dialogue de confirmation SIMPLE (sans retype), lui,
 * est inchangé et déjà capturé par les lots précédents (9I8F1-REPRISE-9I8F).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L44 ?? "";

const CLIENT_9L44 = uuidv7();
const SITE_9L44 = uuidv7();
const MACHINE_9L44 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** Même calcul que `referenceMachine` (`app/(back-office)/parc/[id]/page.tsx`) — jamais partagé, D5/D47. */
function codeAttendu(id: string): string {
  return `Local-${id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.machine.deleteMany({ where: { id: MACHINE_9L44 } });
  await client.site.deleteMany({ where: { id: SITE_9L44 } });
  await client.client.deleteMany({ where: { id: CLIENT_9L44 } });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-apres-${largeur}.png`),
    fullPage: true,
  });
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
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9L44,
        societe_id: societe.id,
        raison_sociale: "Client 9L44 — sortie du parc, retype",
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L44,
        societe_id: societe.id,
        client_id: CLIENT_9L44,
        agence_id: agence.id,
        libelle: "Lieu 9L44 — sortie du parc, retype",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_9L44,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT_9L44,
        site_id: SITE_9L44,
        numero_serie: "9L44-SN-RETYPE",
        qr_token: uuidv7(),
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

for (const largeur of [1280, 375]) {
  test(`sortir « remplacee » du parc exige de retaper le code — ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(`/parc/${MACHINE_9L44}`);
    await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();

    const formulaire = page.locator(
      `form[action="/api/machines/${MACHINE_9L44}/changer-statut"]`,
    );
    await formulaire.locator('select[name="statut"]').selectOption("remplacee");
    await formulaire
      .getByRole("button", { name: fr["machine.changer_etat.bouton"] })
      .click();

    const dialogue = page.locator("dialog[open]");
    await expect(dialogue).toBeVisible();
    const boutonConfirmer = dialogue.getByRole("button", {
      name: fr["machine.changer_etat.confirmer"],
    });

    // SANS RIEN TAPER : le bouton reste désactivé.
    await expect(boutonConfirmer).toBeDisabled();

    // UN CODE FAUX : toujours désactivé.
    await dialogue.getByRole("textbox").fill("MAC-999999");
    await expect(boutonConfirmer).toBeDisabled();

    // LE CODE EXACT : le bouton s'active.
    await dialogue.getByRole("textbox").fill(codeAttendu(MACHINE_9L44));
    await expect(boutonConfirmer).toBeEnabled();
    await capturer(page, "9l44-dialogue-retype-rempli", largeur);

    await boutonConfirmer.click();
    await page.waitForURL((url) => url.pathname === `/parc/${MACHINE_9L44}`);
    await expect(
      page.locator("h1").getByText(fr["statut_machine.remplacee"]),
    ).toBeVisible();
    await capturer(page, "9l44-fiche-sortie-confirmee", largeur);

    // Remise dans son état initial — fixture SÉRIELLE, rejouée aux deux
    // largeurs. Un retour n'est pas une sortie : pas de retype à refaire,
    // seule la confirmation simple (déjà couverte ailleurs) s'applique —
    // l'écriture directe évite ici de rejouer ce que ce spec ne mesure pas.
    const client = admin();
    try {
      await client.machine.update({
        where: { id: MACHINE_9L44 },
        data: { statut: "en_service" },
      });
    } finally {
      await client.$disconnect();
    }
  });
}
