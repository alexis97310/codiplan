import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration, urlApplicative } from "./setup/base";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";

/**
 * LES CAPTURES DE 9J22-PORTAIL-BON-TECHNICIEN-TEMPS — le nom du technicien et
 * les segments, sur le bon vu par le portail. Même recette que
 * `captures-9j08a-portail-bon.spec.ts` pour la scène portail et l'ouverture
 * de session.
 *
 * **APRÈS SEULEMENT** (même constat que `captures-9j21-finitions-
 * invitation.spec.ts`, point 7 de ce lot) : un AVANT fidèle exigerait de
 * rejouer le code d'AVANT ce ticket sous un serveur reconstruit — deux
 * compilations de production en plus du budget de 120 minutes. Pour qui
 * reprend ce point : `git checkout` le commit qui précède le point 4 de ce
 * ticket (il porte encore les trois politiques « interne » de
 * `segment_travail`, pas la brèche de filiation — `technicienAffecte` et
 * `segments` y restent vides côté portail), rejouer `pnpm run build &&
 * pnpm exec next start --port 3100`, puis ce même fichier filtré sur
 * « capture ».
 *
 * **REJOUÉ TEL QUEL PAR 9J22A-REPRISE-9J22** (décision d'Alexis du
 * 07/11/2026) : la seule chose qui change sous ce ticket est la PROVENANCE du
 * nom affiché (`segment_travail.nom_technicien_affiche`, recopié, au lieu
 * d'une lecture de `utilisateur` désormais fermée au portail) — jamais ce
 * que l'écran montre. Les captures APRÈS de 9J22A sont donc celles-ci,
 * régénérées, pas un second fichier.
 *
 * **SA PROPRE INTERVENTION JETABLE**, CLÔTURÉE, avec un technicien AFFECTÉ et
 * UN SEGMENT FERMÉ — sans les deux, la capture ne prouverait rien de ce que
 * ce ticket ouvre. Posée dans `beforeAll`, effacée dans `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J22 ?? "";
const EMAIL_PORTAIL = "9j22-portail-bon-technicien-temps@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9j22-portail-bon-technicien-temps";

let interventionId = "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-apres-${largeur}.png`),
    fullPage: true,
  });
}

async function capturerImpression(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-apres-impression.png`),
    fullPage: true,
  });
  await page.emulateMedia({ media: null });
}

/** Même lecture que `captures-9j08a-portail-bon.spec.ts`. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

async function preparerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateur.id },
      select: { societe_id: true },
    });
    const societeId = utilisateurSociete.societe_id;
    const client = await admin.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });
    const site = await admin.site.findFirstOrThrow({
      where: { societe_id: societeId, client_id: client.id },
      select: { id: true, agence_id: true },
    });
    const technicien = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_TECHNICIEN_EPREUVE },
      select: { id: true },
    });

    interventionId = uuidv7();
    await admin.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "duree_estimee_min", "modifie_le", "cloturee_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'cloturee', $6::uuid, 60, now(), now())`,
      interventionId,
      societeId,
      client.id,
      site.id,
      site.agence_id,
      technicien.id,
    );
    await admin.$executeRawUnsafe(
      `INSERT INTO "segment_travail"
         ("id", "societe_id", "intervention_id", "utilisateur_id",
          "nom_technicien_affiche", "debut", "fin", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid,
               (SELECT "nom" FROM "utilisateur" WHERE "id" = $4::uuid),
               TIMESTAMPTZ '2026-11-05T08:00:00.000Z',
               TIMESTAMPTZ '2026-11-05T09:00:00.000Z', now())`,
      uuidv7(),
      societeId,
      interventionId,
      technicien.id,
    );

    const contexteAdmin: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
      role: Role.admin_societe,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };

    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      const invitation = await inviterClientAuPortail(
        contexteAdmin,
        client.id,
        EMAIL_PORTAIL,
        applicatif,
      );
      if (!invitation.accepte) {
        throw new Error(
          `L'invitation du compte de l'épreuve a été refusée : ${invitation.motif}.`,
        );
      }
      if (!invitation.dejaActif) {
        if (invitation.url === null) {
          throw new Error(
            "L'invitation n'a rendu aucun jeton : la scène ne peut pas ouvrir " +
              "le compte portail de l'épreuve.",
          );
        }
        const jeton = jetonDeLUrl(invitation.url);
        if (jeton === null) {
          throw new Error(
            "Le jeton n'a pas pu être extrait de l'URL d'invitation.",
          );
        }
        const issue = await choisirLePremierMotDePasse({
          jeton,
          motDePasse: MOT_DE_PASSE_PORTAIL,
          confirmation: MOT_DE_PASSE_PORTAIL,
        });
        if (issue.issue !== "abouti") {
          throw new Error(
            `Le premier accès du compte portail de l'épreuve a été refusé : ${issue.issue}.`,
          );
        }
      }
    } finally {
      await applicatif.$disconnect();
    }
  } finally {
    await admin.$disconnect();
  }
}

async function effacerLaScene(): Promise<void> {
  if (interventionId === "") return;
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await admin.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      interventionId,
    );
    await admin.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
  } finally {
    await admin.$disconnect();
  }
}

async function ouvrirLaSessionPortail(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_PORTAIL);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_PORTAIL);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForURL(/\/(arrivee|portail)/);
}

test.beforeAll(async () => {
  await preparerLaScene();
});

test.afterAll(async () => {
  await effacerLaScene();
});

for (const largeur of [375, 1280] as const) {
  test(`capture APRÈS — bon du portail avec technicien et segments, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto(`/portail/interventions/${interventionId}/bon`);
    await expect(page).toHaveURL(/\/bon$/);
    await expect(
      page.getByText(fr["intervention.bon.segments_titre"], {
        exact: false,
      }),
    ).toBeVisible();
    await capturer(page, "bon-technicien-temps", largeur);
  });
}

test("capture APRÈS — bon du portail, rendu impression", async ({ page }) => {
  await ouvrirLaSessionPortail(page);
  await page.goto(`/portail/interventions/${interventionId}/bon`);
  await expect(page).toHaveURL(/\/bon$/);
  await page.setViewportSize({ width: 1280, height: 1200 });
  await capturerImpression(page, "bon-technicien-temps");
});
