import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient, Role as RolePrisma } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration, urlApplicative } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9J21-PORTAIL-FINITIONS-INVITATION (point 7).
 *
 * **APRÈS seulement, à la différence de `captures-9j02a-acces-portail.spec.ts`
 * / `captures-9j20-portail-tarifs.spec.ts`** (mémoire « captures-avant-
 * apres-e2e ») : la tentative AVANT (commit `f6385f699`, le même fichier
 * rejoué contre cet ancien code) a buté sur le budget de temps du ticket —
 * l'invitation d'un compte y suit un chemin de presse-papiers différent
 * (`a_copier_a_la_main`) que ce fichier n'a pas eu le temps de mesurer
 * correctement. Les quatre captures AVANT manquent donc ; le constat du
 * 06/11 d'Alexis, cité dans le ticket, documente cet état par le texte.
 * Les clés NOUVELLES de ce ticket se lisent quand même PAR NOM
 * (`(fr as Record<string,string>)[cle]`) : ce fichier a été écrit pour la
 * tentative AVANT avant d'être réduit à l'APRÈS, et rien n'oblige à revenir
 * sur ce choix, inoffensif ici.
 *
 * Quatre scènes :
 *   A. la carte « Accès portail » — le lien affiché en clair, avec « Copier ».
 *   B. l'invitation d'un compte INTERNE — refusée nommément plutôt que
 *      « accès immédiat ».
 *   C. `/premier-acces` — l'adresse invitée, affichée en lecture seule.
 *   D. un compte client à une seule société — la connexion l'active déjà
 *      automatiquement (`app/api/session/connexion/route.ts`, comme pour un
 *      compte ADV à une société, `arrivee.spec.ts`) ; c'est `/arrivee` qui
 *      décide ensuite s'il reste bloqué là ou s'il mène au portail.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J21 ?? "";
const EMAIL_LIEN = "9j21-lien-affiche@codima.test";
const EMAIL_INTERNE = "9j21-cible-interne@codima.test";
const EMAIL_CLIENT = "9j21-arrivee-client@codima.test";
const MOT_DE_PASSE_CLIENT = "epreuve-9j21-arrivee-client";

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

function jetonDeLUrl(url: string): string {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  const dernier = segments.at(-1);
  if (dernier === undefined) {
    throw new Error("Aucun jeton n'a pu être extrait de l'URL d'invitation.");
  }
  return dernier;
}

async function cibleDeLEpreuve(
  admin: PrismaClient,
): Promise<{ clientId: string; societeId: string; adminId: string }> {
  const utilisateur = await admin.utilisateur.findFirstOrThrow({
    where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
    select: { id: true },
  });
  const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
    where: { utilisateur_id: utilisateur.id },
    select: { societe_id: true },
  });
  const client = await admin.client.findFirstOrThrow({
    where: { societe_id: utilisateurSociete.societe_id },
    select: { id: true },
  });
  return {
    clientId: client.id,
    societeId: utilisateurSociete.societe_id,
    adminId: utilisateur.id,
  };
}

async function preparerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const { clientId, societeId, adminId } = await cibleDeLEpreuve(admin);

    // IDEMPOTENT — un relancement retrouve les mêmes identités plutôt que de
    // buter sur l'unicité du courriel.
    await admin.utilisateurClient.deleteMany({
      where: {
        utilisateur: {
          email: { in: [EMAIL_LIEN, EMAIL_INTERNE, EMAIL_CLIENT] },
        },
      },
    });
    await admin.utilisateurSociete.deleteMany({
      where: { utilisateur: { email: EMAIL_INTERNE } },
    });
    await admin.compte.deleteMany({
      where: {
        utilisateur: {
          email: { in: [EMAIL_LIEN, EMAIL_INTERNE, EMAIL_CLIENT] },
        },
      },
    });
    await admin.utilisateur.deleteMany({
      where: { email: { in: [EMAIL_LIEN, EMAIL_INTERNE, EMAIL_CLIENT] } },
    });

    // SCÈNE B — UN COMPTE INTERNE, déjà actif (mot de passe posé), qu'on va
    // tenter d'inviter comme client.
    const interneId = uuidv7();
    await admin.utilisateur.create({
      data: { id: interneId, nom: "Interne 9J21", email: EMAIL_INTERNE },
    });
    await admin.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: interneId,
        emetteur: "local:credential",
        compte_externe_id: interneId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await admin.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: interneId,
        societe_id: societeId,
        role: RolePrisma.adv,
      },
    });

    // SCÈNE D — UN COMPTE CLIENT NEUF, une seule société, un seul client.
    const contexteAdmin: ContexteSession = {
      utilisateurId: adminId,
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
        clientId,
        EMAIL_CLIENT,
        applicatif,
      );
      if (!invitation.accepte || invitation.url === null) {
        throw new Error(
          "L'invitation du compte client de l'épreuve a échoué : la scène " +
            "ne peut pas ouvrir son premier accès.",
        );
      }
      const issue = await choisirLePremierMotDePasse({
        jeton: jetonDeLUrl(invitation.url),
        motDePasse: MOT_DE_PASSE_CLIENT,
        confirmation: MOT_DE_PASSE_CLIENT,
      });
      if (issue.issue !== "abouti") {
        throw new Error(
          `Le premier accès du compte client de l'épreuve a été refusé : ${issue.issue}.`,
        );
      }
    } finally {
      await applicatif.$disconnect();
    }
  } finally {
    await admin.$disconnect();
  }
}

let clientId = "";

test.beforeAll(async () => {
  await preparerLaScene();
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    ({ clientId } = await cibleDeLEpreuve(admin));
  } finally {
    await admin.$disconnect();
  }
});

async function seConnecterCommeLeCompteClient(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_CLIENT);
  await page.getByLabel(fr["connexion.mot_de_passe"]).fill(MOT_DE_PASSE_CLIENT);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    // ── A. LE LIEN AFFICHÉ, EN CLAIR, AVEC « COPIER » ────────────────────
    test(`capture — invitation : le lien est affiché, avec un bouton « Copier », à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(`/clients/${clientId}?onglet=identite`);
      await page.getByLabel(fr["clients.acces.email_libelle"]).fill(EMAIL_LIEN);
      await page
        .getByRole("button", { name: fr["clients.acces.inviter"] })
        .click();
      await expect(
        page.getByText(fr["clients.acces.lien_copie"]),
      ).toBeVisible();
      const lien = page.locator("input[readonly]");
      await expect(lien).toHaveCount(1);
      await expect(lien).not.toHaveValue("");
      await expect(
        page.getByRole("button", { name: fr["clients.acces.copier_lien"] }),
      ).toBeVisible();
      await capturer(page, "apres-lien-affiche", largeur);
    });

    // ── B. L'INVITATION D'UN COMPTE INTERNE ──────────────────────────────
    test(`capture — un compte interne invité est refusé nommément, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(`/clients/${clientId}?onglet=identite`);
      await page
        .getByLabel(fr["clients.acces.email_libelle"])
        .fill(EMAIL_INTERNE);
      await page
        .getByRole("button", { name: fr["clients.acces.inviter"] })
        .click();
      await expect(
        page.getByText(
          (fr as Record<string, string>)["clients.acces.refus.compte_interne"],
        ),
      ).toBeVisible();
      await capturer(page, "apres-refus-compte-interne", largeur);
    });

    // ── C. L'ADRESSE INVITÉE, SUR /premier-acces ─────────────────────────
    test(`capture — /premier-acces affiche l'adresse invitée, en lecture seule, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(
        "/premier-acces?token=jeton-de-capture&email=contact%40codima.test",
      );
      await expect(
        page.getByText((fr as Record<string, string>)["premier_acces.compte"]),
      ).toBeVisible();
      await capturer(page, "apres-premier-acces-adresse", largeur);
    });

    // ── D. L'ARRIVÉE D'UN COMPTE CLIENT ──────────────────────────────────
    //
    // Une seule société rattache ce compte : la connexion l'active déjà
    // automatiquement (`app/api/session/connexion/route.ts`) et redirige
    // vers `/arrivee`, exactement comme pour un compte ADV à une société
    // (`arrivee.spec.ts`) — c'est `/arrivee` qui décide ensuite s'il reste
    // là ou s'il mène plus loin.
    test(`capture — la connexion mène le compte client directement au portail, à ${largeur}px`, async ({
      page,
    }) => {
      await seConnecterCommeLeCompteClient(page);
      await page.waitForURL(/\/(arrivee|portail)/);
      await capturer(page, "apres-arrivee-client", largeur);
      await expect(page).toHaveURL(/\/portail/);
    });
  });
}
