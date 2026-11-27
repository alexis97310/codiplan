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
 * LES CAPTURES DE 9L50-PORTAIL-PHOTOS-TOUS-CLIENTS — un compte portail
 * rattaché à DEUX clients de la même société voit désormais les photos (et
 * les interventions) des DEUX, jamais seulement du premier.
 *
 * ## La cause, mesurée au point 1 de ce ticket
 *
 * `ContexteSession.clientId` (D70) ne désigne qu'UN client par lecture.
 * Avant ce ticket, CHAQUE écran du portail — la liste des interventions, sa
 * fiche, son bon, et la route des photos — désignait toujours le PREMIER
 * rattachement du compte. `premierSucces` (`lib/portail/depot.ts`) essaie
 * désormais chaque rattachement pour une lecture par identifiant, et la
 * liste interroge chaque client et concatène.
 *
 * **APRÈS SEULEMENT**, même motif que `captures-9l28-portail-bon-
 * photos.spec.ts` (voisin direct) : un AVANT fidèle exigerait de rejouer le
 * code d'avant ce ticket sous un serveur de production reconstruit — hors du
 * budget de 120 minutes. Pour qui reprend ce point : `git checkout` le
 * commit qui précède le point 2 de ce ticket, rejouer `pnpm run build &&
 * pnpm exec next start --port 3100`, puis ce fichier filtré sur « capture ».
 *
 * **UN PIXEL PNG VALIDE** — même raison que le spec voisin : seule une image
 * réelle montre la photo, plutôt qu'une icône de rupture qui prouverait autre
 * chose que ce ticket.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L50 ?? "";
const EMAIL_PORTAIL = "9l50-portail-photos-tous-clients@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9l50-portail-photos-tous-clients";
/** 1×1, transparent — le plus petit PNG valide. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let interventionIdPremierClient = "";
let interventionIdSecondClient = "";
let utilisateurPortailId = "";

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

/** Même lecture que `captures-9l28-portail-bon-photos.spec.ts`. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

async function deposerInterventionCloseAvecPhoto(
  admin: PrismaClient,
  societeId: string,
  clientId: string,
  technicienId: string,
  libellePhoto: string,
): Promise<string> {
  const site = await admin.site.findFirstOrThrow({
    where: { societe_id: societeId, client_id: clientId },
    select: { id: true, agence_id: true },
  });
  const interventionId = uuidv7();
  await admin.$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "duree_estimee_min", "modifie_le", "cloturee_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'cloturee', $6::uuid, 60, now(), now())`,
    interventionId,
    societeId,
    clientId,
    site.id,
    site.agence_id,
    technicienId,
  );
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
      libellePhoto,
      "avant-apres.png",
      "image/png",
      PIXEL_PNG.length,
      empreinte,
      `bd:${empreinte}`,
      PIXEL_PNG,
    ),
  ]);
  return interventionId;
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
    // DEUX clients DISTINCTS de la MÊME société — jamais comptés (L1-02b) :
    // la scène prend les deux premiers qui existent, elle n'exige pas un
    // total précis, que d'autres specs du même semis pourraient faire varier.
    const [premierClient, secondClient] = await admin.client.findMany({
      where: { societe_id: societeId },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (premierClient === undefined || secondClient === undefined) {
      throw new Error(
        "La scène exige DEUX clients sur la société de l'épreuve : le semis " +
          "en porte moins de deux.",
      );
    }
    const technicien = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_TECHNICIEN_EPREUVE },
      select: { id: true },
    });

    interventionIdPremierClient = await deposerInterventionCloseAvecPhoto(
      admin,
      societeId,
      premierClient.id,
      technicien.id,
      "Photo du premier client",
    );
    interventionIdSecondClient = await deposerInterventionCloseAvecPhoto(
      admin,
      societeId,
      secondClient.id,
      technicien.id,
      "Photo du second client",
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
        premierClient.id,
        EMAIL_PORTAIL,
        applicatif,
      );
      if (!invitation.accepte) {
        throw new Error(
          `L'invitation du compte de l'épreuve a été refusée : ${invitation.motif}.`,
        );
      }
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
    } finally {
      await applicatif.$disconnect();
    }

    const comptePortail = await admin.utilisateur.findFirstOrThrow({
      where: { email: EMAIL_PORTAIL },
      select: { id: true },
    });
    utilisateurPortailId = comptePortail.id;

    // LE SECOND RATTACHEMENT, DIRECTEMENT (comme le document plus haut) —
    // JAMAIS une seconde invitation : un compte déjà actif reçoit alors un
    // rattachement EN ATTENTE (D249), qui n'ouvre aucun accès avant une
    // acceptation que cette scène n'a pas besoin d'éprouver (ce point
    // appartient à un autre ticket, D249).
    await admin.$executeRawUnsafe(
      `INSERT INTO "utilisateur_client"
         ("id", "utilisateur_id", "client_id", "societe_id", "actif", "accepte_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, true, now())`,
      utilisateurPortailId,
      secondClient.id,
      societeId,
    );
  } finally {
    await admin.$disconnect();
  }
}

async function effacerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    for (const interventionId of [
      interventionIdPremierClient,
      interventionIdSecondClient,
    ]) {
      if (interventionId === "") continue;
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
    }
    if (utilisateurPortailId !== "") {
      await admin.$executeRawUnsafe(
        `DELETE FROM "utilisateur_client" WHERE "utilisateur_id" = $1::uuid`,
        utilisateurPortailId,
      );
      await admin.$executeRawUnsafe(
        `DELETE FROM "compte" WHERE "utilisateur_id" = $1::uuid`,
        utilisateurPortailId,
      );
      // `inviterClientAuPortail` trace l'invitation dans `journal_acces`
      // (`utilisateur_id` = l'ADMIN qui invite, jamais le compte portail) —
      // mais l'OUVERTURE de session, elle, journalise sous le compte
      // PORTAIL lui-même : sans ce `DELETE`, la clé étrangère refuse celui
      // de `utilisateur` ci-dessous.
      await admin.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE "utilisateur_id" = $1::uuid`,
        utilisateurPortailId,
      );
      await admin.$executeRawUnsafe(
        `DELETE FROM "utilisateur" WHERE "id" = $1::uuid`,
        utilisateurPortailId,
      );
    }
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
  test(`capture APRÈS — la liste des interventions porte les DEUX clients, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto("/portail/interventions");
    await expect(page).toHaveURL(/\/portail\/interventions$/);
    // LES DEUX INTERVENTIONS SONT DES LIENS DE CETTE LISTE — pas seulement
    // celle du premier rattachement, exactement le défaut mesuré (contexte
    // du ticket).
    await expect(
      page.locator(
        `a[href="/portail/interventions/${interventionIdPremierClient}"]`,
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        `a[href="/portail/interventions/${interventionIdSecondClient}"]`,
      ),
    ).toBeVisible();
    await capturer(page, "interventions-deux-clients", largeur);
  });

  test(`capture APRÈS — le bon et la photo du SECOND client sont visibles, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto(`/portail/interventions/${interventionIdSecondClient}/bon`);
    await expect(page).toHaveURL(/\/bon$/);
    await expect(
      page.getByText(fr["intervention.bon.photos_titre"], { exact: true }),
    ).toBeVisible();
    const photo = page.locator("img[src^='/api/documents/']").first();
    await expect(photo).toBeVisible();
    // Même garde que le spec voisin (9L28) : une image cassée reste
    // « visible » au sens de Playwright — c'est sa dimension NATURELLE qui
    // trahirait un 404.
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await capturer(page, "bon-photo-second-client", largeur);
  });
}
