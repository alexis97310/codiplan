import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration, urlApplicative } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";

/**
 * « SIGNALER UNE PANNE » DEPUIS LA FICHE MACHINE, « MACHINE À L'ARRÊT »
 * (9K03-PORTAIL-MACHINES-PANNE) — même recette d'ouverture de session que
 * `captures-9j04-portail-demandes.spec.ts`.
 *
 * **AUCUNE FIXTURE DE PARC N'EST CRÉÉE** : le premier client de la société de
 * l'épreuve porte déjà, par le semis de démonstration, plusieurs machines
 * (`prisma/seed-data.ts`) — même raison que `captures-9j06-portail-fiche-
 * machine.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const EMAIL_PORTAIL = "9k03-portail-machines-panne@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9k03-portail-machines-panne";

type SceneMachinesPanne = {
  readonly societeId: string;
};

async function preparerLaScene(): Promise<SceneMachinesPanne> {
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

    return { societeId };
  } finally {
    await admin.$disconnect();
  }
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

async function ouvrirLaSessionPortail(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_PORTAIL);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_PORTAIL);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForURL(/\/(arrivee|portail)/);
  await page.goto("/portail");
  await expect(page).toHaveURL(/\/portail/);
}

async function lireDemandeParDescription(
  societeId: string,
  description: string,
): Promise<{
  readonly id: string;
  readonly machine_id: string | null;
  readonly machine_arretee: boolean;
  readonly urgence: string;
  readonly numero: number | null;
} | null> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    return await admin.demande.findFirst({
      where: { societe_id: societeId, description },
      select: {
        id: true,
        machine_id: true,
        machine_arretee: true,
        urgence: true,
        numero: true,
      },
    });
  } finally {
    await admin.$disconnect();
  }
}

let scene: SceneMachinesPanne;
// La seule épreuve de ce fichier qui dépose réellement une demande (celle de
// « machine à l'arrêt ») la laisse en base, ouverte, dans la société de
// l'épreuve — exactement ce que `demandes.spec.ts` compte SANS filtre pour
// « LA FILE EST VIDE ». Un identifiant par largeur testée (1280px, 375px).
const idsDemandesCreees: string[] = [];

test.beforeAll(async () => {
  scene = await preparerLaScene();
});

test.afterAll(async () => {
  if (idsDemandesCreees.length === 0) return;
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await admin.demande.deleteMany({
      where: { id: { in: idsDemandesCreees } },
    });
  } finally {
    await admin.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`« Signaler une panne » depuis la fiche machine pré-choisit CETTE machine, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page
        .getByText(fr["portail.machine.serie"], { exact: false })
        .first()
        .click();
      await expect(page).toHaveURL(/\/portail\/machines\/[0-9a-f-]+/);
      const urlFiche = page.url();
      const idMachine = urlFiche.split("/").at(-1) ?? "";

      await page
        .getByRole("link", {
          name: fr["portail.machine.action.signaler_panne"],
        })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/portail/demandes\\?machine_id=${idMachine}$`),
      );

      // LE FORMULAIRE EST DÉJÀ OUVERT (`<details open>`), LA MACHINE
      // DÉJÀ CHOISIE — jamais un second geste pour la retrouver.
      const selecteurMachine = page.getByLabel(
        fr["portail.demandes.champ.machine"],
      );
      await expect(selecteurMachine).toBeVisible();
      await expect(selecteurMachine).toHaveValue(idMachine);
    });

    test(`déclarer une panne « machine à l'arrêt » depuis sa fiche, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page
        .getByText(fr["portail.machine.serie"], { exact: false })
        .first()
        .click();
      await expect(page).toHaveURL(/\/portail\/machines\/[0-9a-f-]+/);
      const idMachine = page.url().split("/").at(-1) ?? "";

      await page
        .getByRole("link", {
          name: fr["portail.machine.action.signaler_panne"],
        })
        .click();

      const description = `9K03 — machine à l'arrêt (${largeur}px, ${Date.now()})`;
      await page
        .getByLabel(fr["portail.demandes.champ.machine_arretee"])
        .check();
      await page
        .getByLabel(fr["portail.demandes.champ.description"])
        .fill(description);
      await page
        .getByRole("button", { name: fr["portail.demandes.action.deposer"] })
        .click();

      await expect(page).toHaveURL(/\/portail\/demandes\?motif=/);
      await expect(page.getByRole("status")).toContainText(
        fr["portail.demandes.cree.avant"],
      );

      const ligne = await lireDemandeParDescription(
        scene.societeId,
        description,
      );
      if (ligne !== null) idsDemandesCreees.push(ligne.id);
      expect(ligne?.machine_id).toBe(idMachine);
      expect(ligne?.machine_arretee).toBe(true);
      // L'URGENCE RESTE FIXÉE CÔTÉ SERVEUR (décision d'Alexis du 08/11/2026) —
      // un client ne la choisit jamais, même en cochant « à l'arrêt ».
      expect(ligne?.urgence).toBe("p3");
      expect(ligne?.numero).not.toBeNull();
    });
  });
}
