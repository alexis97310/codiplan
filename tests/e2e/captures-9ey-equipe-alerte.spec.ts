import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9EY-EQUIPE-ALERTE-TOUT-ENVOYER (point 5) — l'alerte, le
 * dialogue « Tout envoyer », le dialogue « Renouveler <CODE> », la vue
 * `?acces=a-ouvrir`.
 *
 * **EN VIEWPORT, SANS `fullPage`** — même discipline que
 * `captures-9exb-equipe.spec.ts`.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `zz9EYCAPT-` — un technicien sans accès (fait
 * exister l'alerte et la vue filtrée) et un second, porteur d'une
 * habilitation EXPIRÉE (fait exister « Renouveler <CODE> »). Tout est
 * supprimé en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EY ?? "";
const PREFIXE = "zz9EYCAPT-";
const NOM_SANS_ACCES = `${PREFIXE}Technicien sans accès`;
const EMAIL_SANS_ACCES = `${PREFIXE.toLowerCase()}sans-acces@codima.test`;
const NOM_RENOUVELER = `${PREFIXE}Technicien à renouveler`;
const EMAIL_RENOUVELER = `${PREFIXE.toLowerCase()}renouveler@codima.test`;
const CODE_HABILITATION = `${PREFIXE}REN`;

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
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}-${largeur}.png`) });
}

let societeId = "";
let agenceId = "";
let utilisateurIdSansAcces = "";
let utilisateurIdRenouveler = "";
let habilitationId = "";
let attributionId = "";

async function creerTechnicien(
  client: PrismaClient,
  nom: string,
  email: string,
): Promise<string> {
  const utilisateur = await client.utilisateur.create({
    data: { id: uuidv7(), nom, email },
    select: { id: true },
  });
  await client.utilisateurSociete.create({
    data: {
      id: uuidv7(),
      utilisateur_id: utilisateur.id,
      societe_id: societeId,
      role: Role.technicien,
    },
  });
  await client.technicien.create({
    data: {
      id: uuidv7(),
      societe_id: societeId,
      utilisateur_id: utilisateur.id,
      agence_id: agenceId,
      actif: true,
      statut_ressource: "salarie",
    },
  });
  return utilisateur.id;
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, actif: true },
      select: { id: true },
    });
    agenceId = agence.id;

    utilisateurIdSansAcces = await creerTechnicien(
      client,
      NOM_SANS_ACCES,
      EMAIL_SANS_ACCES,
    );
    utilisateurIdRenouveler = await creerTechnicien(
      client,
      NOM_RENOUVELER,
      EMAIL_RENOUVELER,
    );

    const hier = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ilYA2Ans = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    const habilitation = await client.habilitation.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        code: CODE_HABILITATION,
        libelle: `Habilitation ${CODE_HABILITATION}`,
        actif: true,
      },
      select: { id: true },
    });
    habilitationId = habilitation.id;
    const attribution = await client.technicienHabilitation.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        utilisateur_id: utilisateurIdRenouveler,
        habilitation_id: habilitationId,
        date_obtention: ilYA2Ans,
        date_expiration: hier,
      },
      select: { id: true },
    });
    attributionId = attribution.id;
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    if (attributionId !== "") {
      await client.technicienHabilitation.deleteMany({
        where: { id: attributionId },
      });
    }
    if (habilitationId !== "") {
      await client.habilitation.deleteMany({ where: { id: habilitationId } });
    }
    for (const utilisateurId of [
      utilisateurIdSansAcces,
      utilisateurIdRenouveler,
    ]) {
      if (utilisateurId === "") continue;
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.technicien.deleteMany({
        where: { utilisateur_id: utilisateurId },
      });
      await client.utilisateurSociete.deleteMany({
        where: { utilisateur_id: utilisateurId },
      });
      await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
    }
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto("/parametres/equipe");
      await expect(
        page.getByRole("heading", { name: fr["equipe.titre_ecran"] }),
      ).toBeVisible();
    });

    test(`capture — alerte « accès à ouvrir », à ${largeur}px`, async ({
      page,
    }) => {
      // L'ALERTE EST APRÈS LE TABLEAU/LES CARTES DANS LE DOM (voir le
      // commentaire de `page.tsx` à son sujet) — `scrollIntoViewIfNeeded`
      // avant la capture, pour qu'elle entre dans le cadre SANS `fullPage`.
      const alerte = page.getByText(/ne peu(t|vent) pas encore se connecter\./);
      await expect(alerte).toBeVisible();
      await alerte.scrollIntoViewIfNeeded();
      await capturer(page, "equipe-alerte-acces-a-ouvrir", largeur);
    });

    test(`capture — dialogue « Tout envoyer », à ${largeur}px`, async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: fr["equipe.alerte.tout_envoyer"] })
        .click();
      const dialogue = page.getByRole("dialog");
      await expect(
        dialogue.locator("li", { hasText: NOM_SANS_ACCES }),
      ).toBeVisible();
      await capturer(page, "equipe-dialogue-tout-envoyer", largeur);
    });

    test(`capture — dialogue « Renouveler <CODE> », à ${largeur}px`, async ({
      page,
    }) => {
      // SOUS 900 PX, LE TABLEAU EST MASQUÉ (CSS) — la même ligne existe deux
      // fois dans le DOM (tableau ET carte, même piège que `GesteAccesTechnicien`) ;
      // seule la carte est cliquable à 375 px.
      const ligne =
        largeur < 900
          ? page.locator("li", { hasText: NOM_RENOUVELER })
          : page.locator("tr", { hasText: NOM_RENOUVELER });
      await ligne
        .locator("button", { hasText: `Renouveler ${CODE_HABILITATION}` })
        .click();
      const dialogue = page.getByRole("dialog");
      await expect(dialogue).toBeVisible();
      await capturer(page, "equipe-dialogue-renouveler", largeur);
    });

    test(`capture — vue « accès à ouvrir » filtrée, à ${largeur}px`, async ({
      page,
    }) => {
      await page.getByRole("link", { name: /^Voir/ }).first().click();
      await page.waitForURL(/acces=a-ouvrir/);
      const barreFiltre = page.getByText(fr["equipe.filtre.acces_a_ouvrir"]);
      await expect(barreFiltre).toBeVisible();
      await barreFiltre.scrollIntoViewIfNeeded();
      await capturer(page, "equipe-vue-acces-a-ouvrir", largeur);
    });
  });
}
