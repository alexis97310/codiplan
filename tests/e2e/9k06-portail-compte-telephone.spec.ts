import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration, urlApplicative } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";

/**
 * 9K06-PORTAIL-COMPTE-TELEPHONE — trois mesures distinctes.
 *
 * **I5** : la pastille « Mon compte » d'un compte client menait à
 * `/mon-compte` (back-office), qui lève avant d'atteindre la moindre
 * politique pour un rôle du portail (`clientId` vaut toujours `null` à la
 * lecture de session, D70). Elle mène désormais à `/portail/mon-compte`.
 *
 * **I7** : les champs du portail, sous 640 px, zooment Safari iOS (police
 * sous 16 px) ; les boutons et dépliants n'atteignaient pas la cible
 * tactile de 44 px.
 *
 * **I8** : la fiche intervention du portail affiche cinq valeurs sans
 * étiquette, et ne dit rien de quand le bon sera disponible.
 *
 * Même recette d'ouverture de session que `9k02-portail-menu-accueil.spec.ts`
 * — invitation + premier accès, jamais un cookie fabriqué —, et même recette
 * de scène jetable que `captures-9j08a-portail-bon.spec.ts` pour les deux
 * interventions.
 */
test.describe.configure({ mode: "serial" });

const EMAIL_PORTAIL = "9k06-portail-compte@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9k06-portail-compte";

let interventionTermineeId = "";
let interventionClotureeId = "";

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

    interventionTermineeId = uuidv7();
    await admin.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'terminee', 60, now())`,
      interventionTermineeId,
      societeId,
      client.id,
      site.id,
      site.agence_id,
    );

    interventionClotureeId = uuidv7();
    await admin.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "duree_estimee_min", "modifie_le", "cloturee_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'cloturee', 60, now(), now())`,
      interventionClotureeId,
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
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    for (const id of [interventionTermineeId, interventionClotureeId]) {
      if (id !== "") {
        await admin.$executeRawUnsafe(
          `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
          id,
        );
      }
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

/** La taille de police CALCULÉE d'un élément, en pixels (I7). */
async function tailleDePolice(locator: Locator): Promise<number> {
  const valeur = await locator.evaluate(
    (element) => getComputedStyle(element).fontSize,
  );
  return Number.parseFloat(valeur);
}

/** La hauteur hors-tout (bordure comprise) d'un élément, en pixels (I7). */
async function hauteur(locator: Locator): Promise<number> {
  const boite = await locator.boundingBox();
  if (boite === null) {
    throw new Error("L'élément mesuré n'a pas de boîte visible.");
  }
  return boite.height;
}

test.beforeAll(async () => {
  await preparerLaScene();
});

test.afterAll(async () => {
  await effacerLaScene();
});

test.describe("I5 — « Mon compte » du portail", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
  });

  test("la pastille « Mon compte » mène à un écran utilisable, sans erreur serveur", async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.getByRole("link", { name: fr["nav.mon_compte"] }).click();
    await expect(page).toHaveURL(/\/portail\/mon-compte/);
    await expect(
      page.getByRole("heading", { name: fr["mon_compte.titre"] }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["mon_compte.identite.courriel"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["mon_compte.identite.adresse"]),
    ).toBeVisible();
    await expect(
      page.getByLabel(fr["mon_compte.mot_de_passe.actuel"], { exact: false }),
    ).toBeVisible();
    await expect(
      page
        .locator("#contenu")
        .getByRole("button", { name: fr["nav.deconnexion"] }),
    ).toBeVisible();
  });

  test("un rôle du portail ne retombe jamais sur /mon-compte", async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto("/mon-compte");
    await expect(page).toHaveURL(/\/portail\/mon-compte/);
  });

  test("le changement de mot de passe, refusé ou non, revient sur /portail/mon-compte", async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto("/portail/mon-compte");
    await page
      .getByLabel(fr["mon_compte.mot_de_passe.actuel"], { exact: false })
      .fill("ce-n-est-pas-le-bon-mot-de-passe");
    await page
      .getByLabel(fr["mon_compte.mot_de_passe.nouveau"], { exact: false })
      .fill("tentative-9k06-sans-effet");
    await page
      .getByLabel(fr["mon_compte.mot_de_passe.confirmation"], {
        exact: false,
      })
      .fill("tentative-9k06-sans-effet");
    await page
      .getByRole("button", { name: fr["mon_compte.mot_de_passe.valider"] })
      .click();
    await expect(page).toHaveURL(/\/portail\/mon-compte/);
    await expect(
      page.getByText(fr["mon_compte.mot_de_passe.actuel_incorrect"]),
    ).toBeVisible();
  });
});

test.describe("I7 — 16 px et 44 px, à 375 px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
  });

  test("le formulaire des interlocuteurs : champs en 16 px, téléphone en tel", async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto("/portail/contacts");
    const depliant = page.locator("summary", {
      hasText: fr["contacts.action.creer"],
    });
    await depliant.click();
    expect(await hauteur(depliant)).toBeGreaterThanOrEqual(44);

    const nom = page.getByLabel(fr["contact.nom"], { exact: false });
    expect(await tailleDePolice(nom)).toBeGreaterThanOrEqual(16);

    const telephone = page.getByLabel(fr["contact.telephone"], {
      exact: false,
    });
    expect(await tailleDePolice(telephone)).toBeGreaterThanOrEqual(16);
    await expect(telephone).toHaveAttribute("type", "tel");

    const mobile = page.getByLabel(fr["contact.mobile"], { exact: false });
    await expect(mobile).toHaveAttribute("type", "tel");
  });

  test("un numéro de téléphone affiché est un lien tel:", async ({ page }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto("/portail/contacts");
    await page
      .locator("summary", { hasText: fr["contacts.action.creer"] })
      .click();
    await page
      .getByLabel(fr["contact.nom"], { exact: false })
      .fill("9K06 — interlocuteur de l'épreuve");
    await page
      .getByLabel(fr["contact.telephone"], { exact: false })
      .fill("+687 00 00 00");
    await page
      .getByLabel(fr["contact.email"], { exact: false })
      .fill("9k06-interlocuteur@codima.test");
    await page.getByLabel(fr["contact.role.contact_technique"]).check();
    await page
      .getByRole("button", { name: fr["contacts.action.creer"] })
      .click();
    await expect(
      page.getByRole("link", { name: "+687 00 00 00" }),
    ).toHaveAttribute("href", "tel:+687 00 00 00");
  });

  test("le formulaire des demandes : champs en 16 px, bouton ≥ 44 px", async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto("/portail/demandes");
    await page
      .locator("summary", { hasText: fr["portail.demandes.action.deposer"] })
      .click();

    const description = page.getByLabel(
      fr["portail.demandes.champ.description"],
      { exact: false },
    );
    expect(await tailleDePolice(description)).toBeGreaterThanOrEqual(16);

    const bouton = page.getByRole("button", {
      name: fr["portail.demandes.action.deposer"],
    });
    expect(await hauteur(bouton)).toBeGreaterThanOrEqual(44);
  });
});

test.describe("I8 — la fiche intervention, étiquetée", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
  });

  test("une intervention terminée mais non clôturée dit quand le bon sera disponible", async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto(`/portail/interventions/${interventionTermineeId}`);
    await expect(
      page.getByText(fr["intervention.statut"], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.type"], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.date"], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.numero"], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["portail.interventions.bon.refus_non_cloturee"]),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: fr["portail.interventions.bon.lien"] }),
    ).toHaveCount(0);
  });

  test("une intervention clôturée propose le bon en bouton d'au moins 44 px", async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto(`/portail/interventions/${interventionClotureeId}`);
    await expect(
      page.getByText(fr["intervention.statut"], { exact: true }),
    ).toBeVisible();
    const lien = page.getByRole("link", {
      name: fr["portail.interventions.bon.lien"],
    });
    await expect(lien).toBeVisible();
    expect(await hauteur(lien)).toBeGreaterThanOrEqual(44);
  });
});
