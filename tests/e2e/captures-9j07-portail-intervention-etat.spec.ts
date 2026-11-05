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
 * LES CAPTURES ET L'ÉPREUVE DE NON-FUITE DE 9J07-PORTAIL-INTERVENTION-ETAT
 * (CLI-2.5, CLI-2.7) — même recette que `captures-9j06-portail-fiche-
 * machine.spec.ts` (mémoire « captures-avant-apres-e2e »).
 *
 * **AVANT NON CAPTURÉ** (même motif que 9J04, voir la passation) : ni
 * `/portail/interventions` ni `/portail/interventions/[id]` n'existaient
 * avant ce ticket — il n'y a pas d'écran antérieur à rejouer, seulement une
 * absence. Seul l'APRÈS est versé.
 *
 * **UNE INTERVENTION DÉDIÉE**, posée dans `beforeAll` et effacée dans
 * `afterAll` — même patron que `INTERVENTION_COMMENTAIRES` du scénario
 * d'isolation 9J05 : elle porte TROIS valeurs distinctes
 * (`note_interne`/`commentaire_technicien`/`suite_a_donner`) pour que
 * l'épreuve de non-fuite ait quelque chose à mesurer, et pour que les deux
 * commentaires apparaissent dans la capture APRÈS de la fiche.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J07 ?? "";
const EMAIL_PORTAIL = "9j07-portail-intervention-etat@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9j07-portail-intervention-etat";
const NOTE_INTERNE_TEMOIN = "9J07 — réservée au back-office, jamais au portail";
const COMMENTAIRE_TECHNICIEN_TEMOIN = "9J07 — commentaire visible côté portail";
const SUITE_A_DONNER_TEMOIN = "9J07 — suite à donner visible côté portail";

let interventionId = "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/** Même lecture que `tests/e2e/setup/scene.ts` : l'URL est relative, et la
 * bibliothèque met le jeton tantôt en paramètre, tantôt en segment de chemin. */
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
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "note_interne", "commentaire_technicien", "suite_a_donner", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'terminee', NULL, $6, $7, $8, now())`,
      interventionId,
      societeId,
      client.id,
      site.id,
      site.agence_id,
      NOTE_INTERNE_TEMOIN,
      COMMENTAIRE_TECHNICIEN_TEMOIN,
      SUITE_A_DONNER_TEMOIN,
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

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture APRÈS — liste des interventions, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page.goto("/portail/interventions");
      await expect(page).toHaveURL(/\/portail\/interventions$/);
      await capturer(page, "liste-interventions", largeur);
    });

    test(`capture APRÈS — fiche intervention ouverte, avec ses commentaires, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page.goto(`/portail/interventions/${interventionId}`);
      await expect(page).toHaveURL(/\/portail\/interventions\/[0-9a-f-]+/);
      // `.innerText()` + comparaison de chaîne, jamais `getByText` — c'est de
      // la DONNÉE de test (le commentaire technicien saisi en base), pas une
      // copie produit (même distinction que `captures-9i7a-mentions-legales-
      // modifiables.spec.ts`).
      const texteDeLaFiche = await page.locator("main").innerText();
      expect(texteDeLaFiche).toContain(COMMENTAIRE_TECHNICIEN_TEMOIN);
      await capturer(page, "fiche-intervention", largeur);
    });
  });
}

/**
 * L'ÉPREUVE DE NON-FUITE, RÉPÉTÉE À L'ÉCRAN (le ticket l'exige ICI, pas
 * seulement dans `tests/unit/portail/intervention-colonnes-fermees.test.ts`
 * ni dans l'épreuve unitaire de 9J05) : le HTML RENDU de la fiche ne porte
 * `note_interne` SOUS AUCUNE FORME, alors même que les deux commentaires
 * destinés au client, eux, y sont — témoin de non-vacuité, sans lequel
 * l'absence de la note interne pourrait signifier « rien ne s'affiche ».
 */
test("non-fuite — note_interne n'apparaît NULLE PART dans le HTML rendu de la fiche", async ({
  page,
}) => {
  await ouvrirLaSessionPortail(page);
  await page.goto(`/portail/interventions/${interventionId}`);
  await expect(page).toHaveURL(/\/portail\/interventions\/[0-9a-f-]+/);

  const html = await page.content();
  expect(html).not.toContain(NOTE_INTERNE_TEMOIN);

  // TÉMOIN — les deux commentaires DESTINÉS au client, eux, sont bien rendus.
  expect(html).toContain(COMMENTAIRE_TECHNICIEN_TEMOIN);
  expect(html).toContain(SUITE_A_DONNER_TEMOIN);
});
