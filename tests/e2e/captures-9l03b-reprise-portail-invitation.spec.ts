import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LA CAPTURE DE 9L03B-REPRISE-PORTAIL-INVITATION — LA CARTE « ACCÈS PORTAIL »
 * MONTRE LES DEUX LIGNES CÔTE À CÔTE : une identité EN ATTENTE (mot de passe
 * déjà posé ailleurs, D249 inchangée) et une identité JAMAIS ACTIVÉE (aucun
 * mot de passe nulle part, D250 — « Copier un nouveau lien » reste proposé).
 *
 * **APRÈS seulement** (mémoire « captures-avant-apres-e2e ») : cette
 * distinction n'existait pas avant ce lot — rien à capturer « avant ». Les
 * deux autres captures de 9L04 (l'écran d'acceptation, l'arrivée en attente)
 * restent celles déjà prises par `captures-9l04-portail-invitation-en-attente.spec.ts` ;
 * ce fichier n'en reprend aucune.
 *
 * Scène propre à ce fichier (préfixe `9l03b-`), postée directement en base —
 * même recette que `captures-9k14-portail-copier-nouveau-lien.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L03B ?? "";
const EMAIL_EN_ATTENTE = "9l03b-en-attente@codima.test";
const EMAIL_JAMAIS_ACTIVEE = "9l03b-jamais-activee@codima.test";

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
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

let clientId = "";
const utilisateurIds: string[] = [];

test.beforeAll(async () => {
  const { societeId } = await reperesDeLaScene();
  const base = admin();
  try {
    const client = await base.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });
    clientId = client.id;

    // IDEMPOTENT — même recette que 9K14/9J21 : un relancement retrouve les
    // mêmes identités plutôt que de buter sur l'unicité du courriel.
    const emails = [EMAIL_EN_ATTENTE, EMAIL_JAMAIS_ACTIVEE];
    await base.journalAcces.deleteMany({
      where: { utilisateur: { email: { in: emails } } },
    });
    await base.utilisateurClient.deleteMany({
      where: { utilisateur: { email: { in: emails } } },
    });
    await base.compte.deleteMany({
      where: { utilisateur: { email: { in: emails } } },
    });
    await base.utilisateur.deleteMany({ where: { email: { in: emails } } });

    // ── LIGNE « EN ATTENTE » — mot de passe déjà posé AILLEURS (D249) ───────
    const idEnAttente = uuidv7();
    await base.utilisateur.create({
      data: {
        id: idEnAttente,
        nom: "En attente 9L03B",
        email: EMAIL_EN_ATTENTE,
      },
    });
    await base.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: idEnAttente,
        emetteur: "local:credential",
        compte_externe_id: idEnAttente,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-test",
      },
    });
    await base.utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: idEnAttente,
        client_id: clientId,
        societe_id: societeId,
        actif: true,
        accepte_le: null,
        nom_client_invitation: "Client de la scène 9L03B",
      },
    });
    utilisateurIds.push(idEnAttente);

    // ── LIGNE « JAMAIS ACTIVÉE » — aucun mot de passe nulle part (D250) ─────
    const idJamaisActivee = uuidv7();
    await base.utilisateur.create({
      data: {
        id: idJamaisActivee,
        nom: "Jamais activée 9L03B",
        email: EMAIL_JAMAIS_ACTIVEE,
      },
    });
    await base.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: idJamaisActivee,
        emetteur: "local:credential",
        compte_externe_id: idJamaisActivee,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
    await base.utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: idJamaisActivee,
        client_id: clientId,
        societe_id: societeId,
        actif: true,
        accepte_le: null,
      },
    });
    utilisateurIds.push(idJamaisActivee);
  } finally {
    await base.$disconnect();
  }
});

test.afterAll(async () => {
  if (utilisateurIds.length === 0) return;
  const base = admin();
  try {
    await base.journalAcces.deleteMany({
      where: { utilisateur_id: { in: utilisateurIds } },
    });
    await base.utilisateurClient.deleteMany({
      where: { utilisateur_id: { in: utilisateurIds } },
    });
    await base.compte.deleteMany({
      where: { utilisateur_id: { in: utilisateurIds } },
    });
    await base.utilisateur.deleteMany({
      where: { id: { in: utilisateurIds } },
    });
  } finally {
    await base.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`capture — la carte « Accès portail » montre une ligne en attente et une ligne jamais activée, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto(`/clients/${clientId}?onglet=identite`);

    const ligneEnAttente = page
      .locator("li")
      .filter({ hasText: EMAIL_EN_ATTENTE });
    await expect(ligneEnAttente).toBeVisible();
    await expect(
      ligneEnAttente.getByText(fr["clients.acces.etat.en_attente"]),
    ).toBeVisible();
    await expect(
      ligneEnAttente.getByRole("button", {
        name: fr["clients.acces.copier_nouveau_lien"],
      }),
    ).toHaveCount(0);

    const ligneJamaisActivee = page
      .locator("li")
      .filter({ hasText: EMAIL_JAMAIS_ACTIVEE });
    await expect(ligneJamaisActivee).toBeVisible();
    await expect(
      ligneJamaisActivee.getByText(fr["clients.acces.etat.actif"]),
    ).toBeVisible();
    await expect(
      ligneJamaisActivee.getByRole("button", {
        name: fr["clients.acces.copier_nouveau_lien"],
        exact: true,
      }),
    ).toBeVisible();

    await capturer(
      page,
      "apres-acces-portail-en-attente-et-jamais-activee",
      largeur,
    );
  });
}
