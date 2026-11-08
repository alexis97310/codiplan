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
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES DE 9K06-PORTAIL-COMPTE-TELEPHONE — trois écrans : « Mon
 * compte » du portail (I5), le formulaire de demande (I7), la fiche
 * intervention (I8). Même recette de scène jetable que
 * `captures-9j08a-portail-bon.spec.ts`.
 *
 * **APRÈS SEULEMENT** (même constat que `captures-9j22-portail-bon-
 * technicien-temps.spec.ts`) : un AVANT fidèle pour `/portail/contacts`,
 * `/portail/demandes` et la fiche intervention exigerait de rejouer le code
 * d'AVANT ce ticket sous un serveur reconstruit — une compilation de
 * production de plus que ce que le budget de 120 minutes laisse. Pour qui
 * reprend ce point : `git checkout` le commit qui précède celui de ce
 * ticket (il porte encore les champs à 13 px, les dépliants sous 44 px, et
 * la fiche sans étiquette ni `/portail/mon-compte`), rejouer `pnpm run
 * build && pnpm exec next start --port 3100`, puis ce même fichier filtré
 * sur « AVANT » — RIEN n'est capturable avant ce ticket pour « Mon compte »
 * du portail, qui n'existait pas (même motif que 9J08A pour `/bon`).
 *
 * **SA PROPRE SCÈNE JETABLE** (compte portail et intervention clôturée),
 * posée dans `beforeAll`, effacée dans `afterAll` — jamais celle de
 * `tests/e2e/setup/scene.ts` (mémoire « e2e-semis-partage-parallele »).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9K06 ?? "";
const EMAIL_PORTAIL = "9k06-captures-portail@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9k06-captures-portail";

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

    interventionId = uuidv7();
    await admin.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "duree_estimee_min", "modifie_le", "cloturee_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'cloturee', 60, now(), now())`,
      interventionId,
      societeId,
      client.id,
      site.id,
      site.agence_id,
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
  test(`capture APRÈS — Mon compte du portail, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto("/portail/mon-compte");
    await expect(
      page.getByRole("heading", { name: fr["mon_compte.titre"] }),
    ).toBeVisible();
    await capturer(page, "mon-compte", largeur);
  });

  test(`capture APRÈS — le formulaire de demande, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto("/portail/demandes");
    await page
      .locator("summary", { hasText: fr["portail.demandes.action.deposer"] })
      .click();
    await capturer(page, "formulaire-demande", largeur);
  });

  test(`capture APRÈS — la fiche intervention, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto(`/portail/interventions/${interventionId}`);
    await expect(
      page.getByText(fr["intervention.statut"], { exact: true }),
    ).toBeVisible();
    await capturer(page, "fiche-intervention", largeur);
  });
}
