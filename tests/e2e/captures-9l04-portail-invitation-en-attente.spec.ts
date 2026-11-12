import { mkdirSync } from "node:fs";
import { join } from "node:path";

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
 * LES CAPTURES DE 9L04-PORTAIL-INVITATION-EN-ATTENTE (D249) — L'ÉCRAN
 * D'ARRIVÉE MONTRE LES RATTACHEMENTS EN ATTENTE, AVANT TOUT AUTRE ÉCRAN.
 *
 * **APRÈS seulement** (mémoire « captures-avant-apres-e2e ») : cet écran
 * n'existait pas avant ce lot — il n'y a rien à capturer « avant ».
 *
 * Deux comptes par largeur, chacun rattaché à un PREMIER client (accepté,
 * pour que la connexion établisse une société) puis invité à un SECOND
 * client (en attente, D249) :
 *
 *   - `emailAccepte` accepte son invitation → accès immédiat au portail.
 *   - `emailRefuse` refuse la sienne → rattachement laissé inactif (I6).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L04 ?? "";
const MOT_DE_PASSE = "epreuve-9l04-invitation-en-attente";

/**
 * UN COURRIEL PAR LARGEUR (jamais partagé) — le test « accepter » consomme
 * l'invitation en attente d'`emailAccepte`, le test « refuser » celle
 * d'`emailRefuse` : rejouer la MÊME identité pour une largeur suivante la
 * retrouverait déjà traitée, et le test AVANT de cette largeur-là ne verrait
 * plus rien à attendre.
 */
function emailAccepte(largeur: number): string {
  return `9l04-attente-accepte-${largeur}@codima.test`;
}
function emailRefuse(largeur: number): string {
  return `9l04-attente-refuse-${largeur}@codima.test`;
}

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

/** Même recette que `jetonDeLUrl` de `captures-9j04-portail-demandes.spec.ts`. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

/**
 * OUVRE UN COMPTE AVEC UN PREMIER CLIENT ACCEPTÉ, PUIS L'INVITE À UN SECOND
 * — qui reste EN ATTENTE (D249), l'identité étant désormais déjà ouverte.
 *
 * IDEMPOTENT SANS SUPPRESSION entre deux lancements, même recette que
 * `captures-9j04-portail-demandes.spec.ts` : `inviterClientAuPortail`
 * retrouve la même identité par courriel. **MAIS une reprise doit aussi
 * EFFACER tout rattachement précédent au second client** — sans quoi un
 * relancement le retrouverait déjà ACCEPTÉ (de la course précédente) et la
 * scène ne serait plus EN ATTENTE.
 */
async function preparerUnCompte(email: string): Promise<{
  clientEnAttenteId: string;
  clientEnAttenteNom: string;
  societeNom: string;
}> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateurAdmin = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateurAdmin.id },
      select: { societe_id: true },
    });
    const societeId = utilisateurSociete.societe_id;
    const contexte: ContexteSession = {
      utilisateurId: utilisateurAdmin.id,
      societeId,
      role: Role.admin_societe,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    const [clientAccepte, clientEnAttente] = await admin.client.findMany({
      where: { societe_id: societeId },
      select: { id: true, raison_sociale: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (clientAccepte === undefined || clientEnAttente === undefined) {
      throw new Error(
        "la société de l'épreuve n'a pas deux clients pour cette scène",
      );
    }
    const societe = await admin.societe.findUniqueOrThrow({
      where: { id: societeId },
      select: { raison_sociale: true },
    });

    // REPRISE — n'efface que le rattachement au SECOND client, jamais le
    // premier : effacer le premier romprait la société déjà établie d'un
    // relancement précédent, et ce n'est pas ce que ce nettoyage doit faire.
    await admin.utilisateurClient.deleteMany({
      where: {
        client_id: clientEnAttente.id,
        utilisateur: { email },
      },
    });

    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      const premiere = await inviterClientAuPortail(
        contexte,
        clientAccepte.id,
        email,
        applicatif,
      );
      if (!premiere.accepte) {
        throw new Error(`première invitation refusée : ${premiere.motif}`);
      }
      if (premiere.url !== null) {
        // IDENTITÉ NOUVELLE — premier accès (D96) : mot de passe choisi UNE
        // SEULE FOIS, un relancement retrouve l'identité déjà servie.
        const jeton = jetonDeLUrl(premiere.url);
        if (jeton === null) {
          throw new Error(
            "jeton introuvable dans l'URL de première invitation",
          );
        }
        const issue = await choisirLePremierMotDePasse({
          jeton,
          motDePasse: MOT_DE_PASSE,
          confirmation: MOT_DE_PASSE,
        });
        if (issue.issue !== "abouti") {
          throw new Error(`premier accès refusé : ${issue.issue}`);
        }
      }

      const seconde = await inviterClientAuPortail(
        contexte,
        clientEnAttente.id,
        email,
        applicatif,
      );
      if (!seconde.accepte) {
        throw new Error(`seconde invitation refusée : ${seconde.motif}`);
      }
      // D249 — LA SECONDE RESTE EN ATTENTE : c'est ce que cette scène mesure.
      expect(seconde.enAttente).toBe(true);
    } finally {
      await applicatif.$disconnect();
    }

    return {
      clientEnAttenteId: clientEnAttente.id,
      clientEnAttenteNom: clientEnAttente.raison_sociale ?? "",
      societeNom: societe.raison_sociale ?? "",
    };
  } finally {
    await admin.$disconnect();
  }
}

async function ouvrirLaSession(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page.getByLabel(fr["connexion.mot_de_passe"]).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForURL(/\/arrivee/);
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    let sceneAcceptee: Awaited<ReturnType<typeof preparerUnCompte>>;
    let sceneRefusee: Awaited<ReturnType<typeof preparerUnCompte>>;

    test.beforeAll(async () => {
      sceneAcceptee = await preparerUnCompte(emailAccepte(largeur));
      sceneRefusee = await preparerUnCompte(emailRefuse(largeur));
    });

    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture — l'arrivée montre l'invitation en attente, AVANT toute redirection, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSession(page, emailAccepte(largeur));
      // RESTE SUR /arrivee — D249 : une société unique mènerait normalement
      // tout droit au portail, mais une invitation en attente le retient.
      await expect(page).toHaveURL(/\/arrivee/);
      await expect(
        page.getByRole("heading", { name: fr["arrivee.attente.titre"] }),
      ).toBeVisible();
      // SCOPÉ À LA LIGNE : le nom de la société apparaît AUSSI dans la carte
      // « Société active », juste à côté — une recherche globale sur la page
      // résout plusieurs éléments (strict mode de Playwright).
      const ligne = page
        .locator("li")
        .filter({ hasText: sceneAcceptee.clientEnAttenteNom });
      await expect(ligne).toBeVisible();
      await expect(
        ligne.getByText(sceneAcceptee.societeNom, { exact: false }),
      ).toBeVisible();
      await expect(
        ligne.getByRole("button", { name: fr["arrivee.attente.accepter"] }),
      ).toBeVisible();
      await expect(
        ligne.getByRole("button", { name: fr["arrivee.attente.refuser"] }),
      ).toBeVisible();
      await capturer(page, "arrivee-invitation-en-attente", largeur);
    });

    test(`capture — accepter ouvre l'accès immédiatement, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSession(page, emailAccepte(largeur));
      await page
        .getByRole("button", { name: fr["arrivee.attente.accepter"] })
        .click();
      // PLUS RIEN EN ATTENTE, ET LA SOCIÉTÉ EST UNIQUE : la redirection de
      // société unique (inchangée par D249) mène directement au portail.
      await page.waitForURL(/\/portail/);
      await capturer(page, "apres-acceptation-portail", largeur);
    });

    test(`capture — refuser laisse le rattachement inactif, jamais ouvert, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSession(page, emailRefuse(largeur));
      const ligne = page
        .locator("li")
        .filter({ hasText: sceneRefusee.clientEnAttenteNom });
      await expect(ligne).toBeVisible();
      await capturer(page, "avant-refus-invitation-en-attente", largeur);

      await ligne
        .getByRole("button", { name: fr["arrivee.attente.refuser"] })
        .click();
      // PLUS RIEN EN ATTENTE, ET LA SOCIÉTÉ EST UNIQUE (le premier client,
      // accepté, reste ouvert) : la redirection de société unique mène
      // directement au portail — exactement comme après une acceptation,
      // mais SANS le second client, jamais rattaché.
      await page.waitForURL(/\/portail/);
      await capturer(page, "apres-refus-portail", largeur);

      const admin = new PrismaClient({
        datasources: { db: { url: urlAdministration() } },
      });
      try {
        const refuse = await admin.utilisateurClient.findFirstOrThrow({
          where: {
            utilisateur: { email: emailRefuse(largeur) },
            client_id: sceneRefusee.clientEnAttenteId,
          },
          select: { actif: true, accepte_le: true },
        });
        expect(refuse.actif).toBe(false);
        expect(refuse.accepte_le).toBeNull();
      } finally {
        await admin.$disconnect();
      }
    });
  });
}
