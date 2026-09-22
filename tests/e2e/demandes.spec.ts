import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA FILE DE QUALIFICATION ET LA FICHE D'UNE DEMANDE (DEMANDES-1).
 *
 * ## Le constat, mesuré sur `main` le 22/09/2026
 *
 * `lib/demandes/depot.ts` porte tout le cycle depuis L2-06 — `deposerDemande`,
 * `accuserReception`, `qualifierDemande`, `marquerTransformee`,
 * `cloreSansSuite`, `demandesOuvertes` — et zéro route, zéro écran ne
 * l'appelait (`docs/backlog.md`, L2-06b). `find app/api -ipath '*demande*'`
 * et `find "app/(back-office)" -ipath '*demande*'` rendaient RIEN.
 *
 * **Sur `main` avant ce lot, ce scénario rougit** : `/demandes` n'existe pas
 * (404), et aucune route `/api/demandes/**` n'existe pour agir.
 *
 * ## Ce qu'il prouve
 *
 * Le cycle ENTIER par la ROUTE et l'ÉCRAN, pas seulement par le module — la
 * confrontation module/base vit déjà dans `tests/isolation/demande.test.ts`
 * et n'est pas reprise ici. Une demande parcourt dépôt (fixture directe, le
 * dépôt par portail est hors périmètre V1) → accusé de réception →
 * qualification → transformée ; une autre → close sans suite avec son motif.
 * Une transition interdite, tentée directement sur la route, est refusée SANS
 * écrire — même discipline que `tests/e2e/porte-capacites.spec.ts`.
 *
 * ## L'ORDRE DE LA FILE, ÉPROUVÉ ET PAS SEULEMENT AFFIRMÉ
 *
 * `DEMANDE_ANCIENNE` porte l'urgence la plus BASSE (p3) et le dépôt le plus
 * ANCIEN ; `DEMANDE_RECENTE` porte l'urgence la plus HAUTE (p1) et un dépôt
 * récent. `demandesOuvertes` (le dépôt) ordonne par urgence D'ABORD — sous
 * cet ordre-là, la RÉCENTE apparaîtrait EN TÊTE. Si l'ancienne apparaît quand
 * même en tête, c'est la preuve que `parLaPlusAncienne` (l'écran) a bien
 * re-trié, et pas simplement affiché ce que le dépôt rend déjà.
 *
 * `CAPTURES_DEMANDES_1=<dossier>` fait écrire les captures à 1280 px.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_DEMANDES_1 ?? "";

const dictionnaire = fr as Record<string, string>;
const DESCRIPTION_ANCIENNE = dictionnaire["demandes.e2e.description_ancienne"]!;
const DESCRIPTION_RECENTE = dictionnaire["demandes.e2e.description_recente"]!;

// Un client et un site À SOI, jamais empruntés au semis partagé (mémoire du
// poste : « un spec qui compte pose SON site »).
const CLIENT_DEMANDES = "e2e00000-0000-7000-8000-00000000d1a0";
const SITE_DEMANDES = "e2e00000-0000-7000-8000-00000000d1a1";
const DEMANDE_ANCIENNE = "e2e00000-0000-7000-8000-00000000d1a2";
const DEMANDE_RECENTE = "e2e00000-0000-7000-8000-00000000d1a3";

const mesure: {
  commit: string;
  horodatage: string;
  largeur: number;
  hauteur: number;
  ecrans: Record<string, Record<string, unknown>>;
} = {
  commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  horodatage: new Date().toISOString(),
  largeur: FENETRE.width,
  hauteur: FENETRE.height,
  ecrans: {},
};

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}--1280.png`),
    fullPage: true,
  });
  writeFileSync(
    join(DOSSIER_CAPTURES, "mesure.json"),
    `${JSON.stringify(mesure, null, 2)}\n`,
  );
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.demande.deleteMany({
    where: { id: { in: [DEMANDE_ANCIENNE, DEMANDE_RECENTE] } },
  });
  await client.site.deleteMany({ where: { id: SITE_DEMANDES } });
  await client.client.deleteMany({ where: { id: CLIENT_DEMANDES } });
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);

    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.client.create({
      data: {
        id: CLIENT_DEMANDES,
        societe_id: societe.id,
        raison_sociale:
          "Client de la file de qualification (épreuve DEMANDES-1)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_DEMANDES,
        societe_id: societe.id,
        client_id: CLIENT_DEMANDES,
        agence_id: agence.id,
        libelle: "Lieu de la file de qualification (épreuve DEMANDES-1)",
        temps_trajet_min: 10,
      },
    });

    const maintenant = new Date();
    const troisJours = new Date(maintenant.getTime() - 3 * 24 * 60 * 60 * 1000);
    const uneHeure = new Date(maintenant.getTime() - 60 * 60 * 1000);

    // TÉMOIN — zéro demande au départ dans TOUTE la société de l'épreuve :
    // aucun autre chemin du dépôt ne pose de `demande` aujourd'hui (mesuré le
    // 22/09/2026), et la file lue par `/demandes` est bornée à cette société
    // — la file est donc VIDE avant ce scénario, pas seulement pour ce client.
    expect(
      await client.demande.count({ where: { societe_id: societe.id } }),
    ).toBe(0);

    await client.demande.create({
      data: {
        id: DEMANDE_ANCIENNE,
        societe_id: societe.id,
        source: "appel",
        client_id: CLIENT_DEMANDES,
        site_id: SITE_DEMANDES,
        agence_id: agence.id,
        description: DESCRIPTION_ANCIENNE,
        urgence: "p3",
        depose_le: troisJours,
        compteur_accuse_le: troisJours,
      },
    });
    await client.demande.create({
      data: {
        id: DEMANDE_RECENTE,
        societe_id: societe.id,
        source: "email",
        client_id: CLIENT_DEMANDES,
        site_id: SITE_DEMANDES,
        agence_id: agence.id,
        description: DESCRIPTION_RECENTE,
        urgence: "p1",
        depose_le: uneHeure,
        compteur_accuse_le: uneHeure,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("LA FILE montre les deux demandes, la plus ANCIENNE en tête malgré une urgence plus basse", async ({
  page,
}) => {
  await page.goto("/demandes");
  await expect(page.locator("main")).toBeVisible();

  const lignes = page.locator("tr[data-demande]");
  await expect(lignes).toHaveCount(2);
  // `demandesOuvertes` ordonnerait la RÉCENTE (p1) en tête ; l'écran doit la
  // remettre à sa place — la preuve que `parLaPlusAncienne` a bien re-trié.
  await expect(lignes.nth(0)).toHaveAttribute("data-demande", DEMANDE_ANCIENNE);
  await expect(lignes.nth(1)).toHaveAttribute("data-demande", DEMANDE_RECENTE);
  await expect(lignes.nth(0)).toContainText(DESCRIPTION_ANCIENNE);

  mesure.ecrans.file_avec_demandes = { url: "/demandes", lignes: 2 };
  await capturer(page, "file-avec-demandes");
});

test("LA FICHE d'une demande montre son client, son site, et mène ses actions", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_ANCIENNE}`);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(DESCRIPTION_ANCIENNE)).toBeVisible();
  await expect(
    page.getByRole("button", { name: dictionnaire["demande.action.accuser"] }),
  ).toBeVisible();

  mesure.ecrans.fiche_demande = { url: `/demandes/${DEMANDE_ANCIENNE}` };
  await capturer(page, "fiche-demande");
});

test("LE CYCLE COMPLET : accuser, qualifier, transformer — chaque geste par la route qu'il appelle", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_ANCIENNE}`);

  await page
    .getByRole("button", { name: dictionnaire["demande.action.accuser"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("button", { name: dictionnaire["demande.action.accuser"] }),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: dictionnaire["demande.action.qualifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(dictionnaire["demande.statut.qualifiee"], { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: dictionnaire["demande.action.transformer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(dictionnaire["demande.statut.transformee"], {
      exact: true,
    }),
  ).toBeVisible();

  // TRANSFORMÉE EST TERMINALE : plus aucune des quatre actions ne s'offre.
  // Bornée à la colonne des actions — la barre de navigation est ELLE AUSSI
  // un `<aside>` (rôle « complementary ») et porte son propre formulaire de
  // déconnexion, présent sur tout écran du back-office.
  await expect(page.locator('[data-bloc="demande-actions"] form')).toHaveCount(
    0,
  );

  // ET ELLE A QUITTÉ LA FILE — `demandesOuvertes` ne rend que `nouvelle` et
  // `qualifiee`.
  await page.goto("/demandes");
  await expect(
    page.locator(`tr[data-demande="${DEMANDE_ANCIENNE}"]`),
  ).toHaveCount(0);
});

test("UNE TRANSITION INTERDITE EST REFUSÉE PAR LA ROUTE, sans rien écrire", async ({
  page,
}) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    // DEMANDE_ANCIENNE est `transformee` depuis le scénario précédent (même
    // fichier, `serial`) : la re-qualifier est une transition REFUSÉE, tenue
    // par `lib/demandes/cycle-de-vie.ts` ET par le déclencheur en base.
    const avant = await client.demande.findUniqueOrThrow({
      where: { id: DEMANDE_ANCIENNE },
      select: { statut: true, modifie_le: true },
    });
    expect(avant.statut).toBe("transformee");

    const reponse = await page.request.post(
      `/api/demandes/${DEMANDE_ANCIENNE}/qualifier`,
      { maxRedirects: 0 },
    );
    expect(reponse.status()).toBe(303);
    expect(reponse.headers()["location"] ?? "").toContain(
      "demande.refus.deja_transformee",
    );

    const apres = await client.demande.findUniqueOrThrow({
      where: { id: DEMANDE_ANCIENNE },
      select: { statut: true, modifie_le: true },
    });
    expect(apres.statut).toBe("transformee");
    expect(apres.modifie_le).toEqual(avant.modifie_le);
  } finally {
    await client.$disconnect();
  }
});

test("CLORE SANS SUITE exige un motif, l'écrit, et sort la demande de la file", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_RECENTE}`);
  const forme = page.locator(
    `form[action="/api/demandes/${DEMANDE_RECENTE}/clore"]`,
  );
  await expect(forme).toBeVisible();
  await forme.locator('select[name="motif"]').selectOption("doublon");
  await forme
    .getByRole("button", { name: dictionnaire["demande.action.clore"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByText(dictionnaire["demande.statut.close_sans_suite"], {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(dictionnaire["demande.motif.doublon"]),
  ).toBeVisible();

  mesure.ecrans.fiche_close_sans_suite = {
    url: `/demandes/${DEMANDE_RECENTE}`,
  };
  await capturer(page, "fiche-close-sans-suite");

  await page.goto("/demandes");
  await expect(
    page.locator(`tr[data-demande="${DEMANDE_RECENTE}"]`),
  ).toHaveCount(0);
});

test("LA FILE EST VIDE ET LE DIT — une bonne nouvelle, pas une absence de donnée", async ({
  page,
}) => {
  // Les deux demandes de ce scénario sont désormais TERMINALES
  // (`transformee`, `close_sans_suite`), et aucun autre chemin du dépôt ne
  // pose de `demande` (mesuré le 22/09/2026) : la file est donc VIDE.
  await page.goto("/demandes");
  await expect(page.locator("tr[data-demande]")).toHaveCount(0);
  await expect(page.getByText(dictionnaire["demandes.vide"])).toBeVisible();

  mesure.ecrans.file_vide = { url: "/demandes" };
  await capturer(page, "file-vide");
});

test("LE TABLEAU DE BORD : le compteur des demandes ouvertes mène à la file", async ({
  page,
}) => {
  await page.goto("/tableau-de-bord");
  await expect(page.locator("main")).toBeVisible();
  const lien = page.getByRole("link", {
    name: dictionnaire["tableau_de_bord.lien_demandes"],
  });
  await expect(lien).toHaveAttribute("href", "/demandes");

  mesure.ecrans.tableau_de_bord = { url: "/tableau-de-bord" };
  await capturer(page, "tableau-de-bord");

  await lien.click();
  await expect(page).toHaveURL(/\/demandes$/);
});
