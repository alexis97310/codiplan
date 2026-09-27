import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient, Role } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { reemettreJetonPremierAcces } from "@/lib/auth/amorcage";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { COLONNES_CLIENTS, marqueurDu } from "@/lib/imports/modeles";

import { urlAdministration } from "./setup/base";
import { MOT_DE_PASSE_EPREUVE, SCENE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AL-GR16-TEXTES — même recette que
 * `captures-gr15-motif-rejet.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier. AVANT/APRÈS se prend en rejouant ce même
 * fichier deux fois, une fois sur le commit qui précède le lot, une fois sur
 * le code livré (voir la passation du lot pour la marche suivie).
 *
 * Sept écrans, chacun sa propre scène prefixée `GR16CAP-`, jamais la scène
 * partagée en écriture — seule `SCENE.deplacable` (fixe, écrite par
 * `ecrireLaScene`) est LUE, jamais modifiée.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_GR16_TEXTES ?? "";

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

// Des identifiants forgés, propres à la scène de ce fichier.
const CLIENT_DEMANDE_ID = "9a160000-0000-7000-8000-000000000001";
const SITE_DEMANDE_ID = "9a160000-0000-7000-8000-000000000002";
const DEMANDE_SANS_NUMERO_ID = "9a160000-0000-7000-8000-000000000003";

const CODE_EXTERNE_IMPORT = "GR16CAP-1";
const NOM_FICHIER_IMPORT = "clients-capture-gr16.xlsx";
const EMAIL_ENROLEMENT = "gr16cap.enrolement@codima.test";
const UTILISATEUR_ENROLEMENT_ID = "9a160000-0000-7000-8000-0000000000e1";

/** Même lecture que `tests/e2e/setup/scene.ts` : l'URL est relative, et la
 * bibliothèque met le jeton tantôt en paramètre, tantôt en segment de
 * chemin. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

async function fabriquerLeClasseurClient(): Promise<Buffer> {
  const donnees: SheetData = [
    [{ value: marqueurDu({ type: "clients", version: 1 }) }],
    Object.values(COLONNES_CLIENTS).map((nom) => ({ value: nom })),
    [
      { value: CODE_EXTERNE_IMPORT },
      { value: "Client de la capture GR16 (épreuve)" },
    ],
  ];
  return writeXlsxFile(donnees).toBuffer();
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    // ── Une demande sans numéro (GR16b) ────────────────────────────────────
    await client.client.create({
      data: {
        id: CLIENT_DEMANDE_ID,
        societe_id: societe.id,
        raison_sociale: "Client de la capture GR16 — demande",
      },
    });
    await client.site.create({
      data: {
        id: SITE_DEMANDE_ID,
        societe_id: societe.id,
        client_id: CLIENT_DEMANDE_ID,
        agence_id: agence.id,
        libelle: "Lieu de la capture GR16",
        temps_trajet_min: 10,
      },
    });
    const maintenant = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_SANS_NUMERO_ID,
        societe_id: societe.id,
        source: "appel",
        client_id: CLIENT_DEMANDE_ID,
        site_id: SITE_DEMANDE_ID,
        agence_id: agence.id,
        description: "Capture GR16 — demande sans numéro",
        urgence: "p3",
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });

    // ── Un compte requérant l'enrôlement (GR16e), jamais celui du semis ────
    await client.utilisateur.create({
      data: {
        id: UTILISATEUR_ENROLEMENT_ID,
        nom: "Capture GR16 — enrôlement",
        email: EMAIL_ENROLEMENT,
        email_verifie: true,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: "9a160000-0000-7000-8000-0000000000e2",
        utilisateur_id: UTILISATEUR_ENROLEMENT_ID,
        societe_id: societe.id,
        role: Role.admin_societe,
      },
    });
    // LE MOYEN DE CONNEXION « AU REPOS » (D65) — même geste que
    // `poserLeMoyenDeConnexionAuRepos` de `prisma/seed.ts` : la réémission
    // exige un `Compte` déjà posé, sans mot de passe, et refuse de poursuivre
    // sur une identité qu'elle ne comprend pas.
    await avecDesignationAuth(client).compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: UTILISATEUR_ENROLEMENT_ID,
        emetteur: "local:credential",
        compte_externe_id: UTILISATEUR_ENROLEMENT_ID,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
    const reemission = await reemettreJetonPremierAcces(client, {
      societeId: societe.id,
      email: EMAIL_ENROLEMENT,
    });
    const jeton = jetonDeLUrl(reemission.urlPremierAcces);
    if (jeton === null) {
      throw new Error("La réémission n'a pas rendu de jeton exploitable.");
    }
    const issue = await choisirLePremierMotDePasse({
      jeton,
      motDePasse: MOT_DE_PASSE_EPREUVE,
      confirmation: MOT_DE_PASSE_EPREUVE,
    });
    if (issue.issue !== "abouti") {
      throw new Error(
        `Le premier accès du compte de capture a été refusé : ${issue.issue}.`,
      );
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.demande.deleteMany({
      where: { id: DEMANDE_SANS_NUMERO_ID },
    });
    await client.site.deleteMany({ where: { id: SITE_DEMANDE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_DEMANDE_ID } });

    await client.journalAcces.deleteMany({
      where: { utilisateur_id: UTILISATEUR_ENROLEMENT_ID },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: UTILISATEUR_ENROLEMENT_ID },
    });
    await client.utilisateur.deleteMany({
      where: { id: UTILISATEUR_ENROLEMENT_ID },
    });

    // `ImportLotLigne` est en CASCADE sur `ImportLot` (onDelete: Cascade) :
    // effacer le lot suffit.
    await client.importLot.deleteMany({
      where: { nom_fichier: NOM_FICHIER_IMPORT },
    });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test(`capture — /clients/nouveau à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/clients/nouveau");
    await expect(
      page.getByRole("heading", { name: fr["clients.nouveau.titre"] }),
    ).toBeVisible();
    await capturer(page, "clients-nouveau", largeur);
  });

  test(`capture — une demande sans numéro à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/demandes/${DEMANDE_SANS_NUMERO_ID}`);
    await expect(page.getByText(fr["demande.sans_numero"])).toBeVisible();
    await capturer(page, "demande-sans-numero", largeur);
  });

  test(`capture — /absences à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/absences");
    await expect(
      page.getByRole("heading", { name: fr["absences.titre"] }),
    ).toBeVisible();
    await capturer(page, "absences", largeur);
  });

  test(`capture — le rapport d'un lot contrôlé à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/imports");
    await page.locator('input[name="classeur"]').setInputFiles({
      name: NOM_FICHIER_IMPORT,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await fabriquerLeClasseurClient(),
    });
    await page.getByRole("button", { name: fr["imports.controler"] }).click();
    await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
    await expect(page.getByText(fr["imports.appliquer_aide"])).toBeVisible();
    await capturer(page, "imports-rapport", largeur);
  });

  test(`capture — /enrolement, première étape, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto("/connexion");
    await page.getByLabel(fr["connexion.email"]).fill(EMAIL_ENROLEMENT);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/enrolement/);
    await expect(page.getByText(fr["enrolement.definitif"])).toBeVisible();
    await capturer(page, "enrolement-premiere-etape", largeur);
  });

  test(`capture — /parc/nouvelle à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/parc/nouvelle");
    await expect(
      page.getByRole("heading", { name: fr["machine.nouvelle.titre"] }),
    ).toBeVisible();
    await capturer(page, "parc-nouvelle", largeur);
  });

  test(`capture — une fiche intervention, note « Déduite du site », à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${SCENE.deplacable}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "intervention-deduite-du-site", largeur);
  });
}
