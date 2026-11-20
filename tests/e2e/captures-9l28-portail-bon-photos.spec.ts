import { createHash } from "node:crypto";
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
 * LES CAPTURES DE 9L28-PORTAIL-PHOTOS-BORNES-D236, point 5 — les photos du
 * bon, désormais visibles au portail (décision d'Alexis du 10/11/2026). Même
 * recette que `captures-9j22-portail-bon-technicien-temps.spec.ts` pour la
 * scène portail, l'ouverture de session et l'intervention jetable close.
 *
 * **APRÈS SEULEMENT** (même constat, pour la MÊME PAGE, que
 * `captures-9j22-portail-bon-technicien-temps.spec.ts` et
 * `captures-9k06-portail-compte-telephone.spec.ts`) : un AVANT fidèle
 * exigerait de rejouer le code d'AVANT ce ticket sous un serveur reconstruit
 * — deux compilations de production en plus du budget de 120 minutes. Pour
 * qui reprend ce point : `git checkout` le commit qui précède le point 1 de
 * ce ticket (`/api/documents/[id]/octets` n'y tente alors qu'un seul chemin,
 * celui de `consulter_planning` — le portail n'a jamais cette capacité, et
 * la photo y rend une image cassée, 404), rejouer `pnpm run build && pnpm
 * exec next start --port 3100`, puis ce même fichier filtré sur « capture ».
 *
 * **UN PIXEL PNG VALIDE**, pas un texte quelconque : `formatImageReconnu`
 * (`lib/documents/formats-image.ts`) décide du type servi sur les octets
 * eux-mêmes, et seule une image réelle montre, à la capture, la photo plutôt
 * qu'une icône de rupture qui prouverait autre chose que ce ticket.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L28 ?? "";
const EMAIL_PORTAIL = "9l28-portail-bon-photos@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9l28-portail-bon-photos";
/** 1×1, transparent — le plus petit PNG valide. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

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

/** Même lecture que `captures-9j22-portail-bon-technicien-temps.spec.ts`. */
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
      // POSÉE DIRECTEMENT, SOUS L'EXEMPTION « fixture_isolation »
      // (9L14-FIGE-A-LA-CLOTURE), PLUTÔT QUE PAR `deposerPhotoIntervention` —
      // cette intervention JETABLE naît déjà `cloturee` ; depuis ce ticket,
      // la fonction applicative refuse (et garde à part) tout dépôt sur une
      // intervention déjà figée, ce que cette scène ne veut PAS éprouver :
      // elle veut une intervention close qui A une photo, posée avant.
      const documentId = uuidv7();
      const empreinte = createHash("sha256").update(PIXEL_PNG).digest("hex");
      await admin.$transaction([
        admin.$executeRawUnsafe(
          `SET LOCAL "fige_a_la_cloture.exemption" = 'fixture_isolation'`,
        ),
        admin.$executeRawUnsafe(
          `INSERT INTO "document"
             ("id", "societe_id", "intervention_id", "classe", "libelle", "nom_fichier", "type_mime", "taille_octets", "empreinte", "objet_cle", "octets", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'client', $4, $5, $6, $7, $8, $9, $10, now())`,
          documentId,
          societeId,
          interventionId,
          "Avant/après — joint démonté",
          "avant-apres.png",
          "image/png",
          PIXEL_PNG.length,
          empreinte,
          `bd:${empreinte}`,
          PIXEL_PNG,
        ),
      ]);

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
      if (!invitation.enAttente) {
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
    // SOUS L'EXEMPTION « fixture_isolation » — le document cible une
    // intervention `cloturee` figée (9L14-FIGE-A-LA-CLOTURE), et le
    // déclencheur refuse aussi le `DELETE`.
    await admin.$transaction([
      admin.$executeRawUnsafe(
        `SET LOCAL "fige_a_la_cloture.exemption" = 'fixture_isolation'`,
      ),
      admin.$executeRawUnsafe(
        `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
        interventionId,
      ),
    ]);
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
  test(`capture APRÈS — bon du portail, photo visible, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto(`/portail/interventions/${interventionId}/bon`);
    await expect(page).toHaveURL(/\/bon$/);
    await expect(
      page.getByText(fr["intervention.bon.photos_titre"], { exact: true }),
    ).toBeVisible();
    const photo = page.locator("img[src^='/api/documents/']").first();
    await expect(photo).toBeVisible();
    // Une image CASSÉE reste « visible » au sens de Playwright (l'élément
    // existe) : c'est sa dimension NATURELLE qui trahirait un 404 — une
    // icône de rupture ne porte jamais de largeur intrinsèque.
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await capturer(page, "bon-photos", largeur);
  });
}
