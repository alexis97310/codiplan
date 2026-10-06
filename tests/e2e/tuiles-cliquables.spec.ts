import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * TUILES CLIQUABLES AVEC CHEVRON (D140, TP-UX1-3, commit « tuile cliquable »).
 *
 * D140 (`docs/arbitrages.md:5055-5081`) : « Toutes les tuiles de chiffres sont
 * cliquables, avec un chevron » — « Chaque tuile ouvre la liste EXACTE que
 * son chiffre compte ». Ce fichier éprouve la TUILE elle-même — le nouveau
 * `<a>` posé par `Kpi` (`href`, `components/ui/kpi.tsx`) — jamais le lien
 * SECONDAIRE déjà posé sous chaque tuile (`CLASSES_LIEN_TUILE`), déjà
 * éprouvé par `tableau-de-bord-liens-tuiles.spec.ts`.
 *
 * **Deux tuiles cliquables restent — `kpi-bloques` et `kpi-en-retard`
 * (tableau de bord)** — depuis que TP-UX3-1-REGISTRE-1 (QE-8, D174, 06/10/
 * 2026) a retiré les trois tuiles KPI du registre (`kpi-semaine`,
 * `kpi-en-cours`, `kpi-en-attente`), `registre-kpi-liens.spec.ts` avec
 * elles : l'invariant « une tuile = un onglet » n'a plus d'objet sur cet
 * écran, remplacé par le compteur que l'onglet porte lui-même. `kpi-
 * interventions` reste INERTE (voir la passation : la vue jour du planning
 * répartit ses cartes sur trois zones DOM sans convention de comptage
 * commune, condition non remplie avec confiance).
 *
 * **« kpi-en-retard » N'EST CLIQUABLE QU'AU-DESSUS DE ZÉRO** (décision
 * d'Alexis du 30/09/2026, point 13 ; D144, amende D140 sur ce seul cas) —
 * `beforeAll` force donc au moins UNE intervention en retard, préfixe
 * `RET2B-`, même recette que `captures-pg-c1b-en-retard-tableau.spec.ts`
 * (AFFECTÉE, datée d'hier, sur `reperes.technicienDucos`), effacée en
 * `afterAll` : sans cette scène, un semis qui compterait zéro en retard
 * rendrait cette tuile INERTE et ferait rougir le test ci-dessous.
 *
 * ## Écriture, pour « kpi-en-retard » SEULEMENT
 *
 * Le reste du fichier compare deux LECTURES du même instant — la tuile, puis
 * l'onglet qu'elle nomme —, jamais un nombre absolu (Playwright
 * `fullyParallel`, sur la société partagée).
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };

const CLIENT_RET2B = uuidv7();
const SITE_RET2B = uuidv7();
const INTERVENTION_RET2B = uuidv7();

const HIER = new Date(Date.now() - 24 * 60 * 60 * 1000);
const HIER_ISO = HIER.toISOString().slice(0, 10);

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_RET2B,
        societe_id: reperes.societeId,
        raison_sociale: "RET2B — Client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_RET2B,
        societe_id: reperes.societeId,
        client_id: CLIENT_RET2B,
        agence_id: agence.id,
        libelle: "RET2B — Lieu de l'épreuve",
      },
    });
    // AFFECTÉE, datée d'hier, aucun segment de travail — en retard, comme
    // `captures-pg-c1b-en-retard-tableau.spec.ts`.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id",
          "technicien_id", "type", "priorite", "statut", "date_planifiee",
          "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p2', 'affectee'::"StatutIntervention", $7::date,
               60, now())`,
      INTERVENTION_RET2B,
      reperes.societeId,
      CLIENT_RET2B,
      SITE_RET2B,
      agence.id,
      reperes.technicienDucos,
      HIER_ISO,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_RET2B,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_RET2B } });
    await client.client.deleteMany({ where: { id: CLIENT_RET2B } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

/** Le premier nombre isolé sur sa propre ligne, dans un texte rendu multi-lignes. */
function premierNombreIsole(texte: string): number | null {
  const correspondance = /\n(\d+)\n/.exec(`\n${texte}\n`);
  return correspondance === null ? null : Number(correspondance[1]);
}

/**
 * LE TEXTE DE L'ONGLET ACTIF DU REGISTRE, ET SON COMPTE — lu sur
 * `[data-compte]` (TP-UX3-1-REGISTRE-1), jamais parsé depuis un texte rendu
 * « Libellé (N) » : `Onglets` (`components/ui/onglets.tsx`) rend désormais
 * le libellé et le compteur dans deux nœuds distincts.
 */
async function ongletActifEtSonCompte(
  page: Page,
): Promise<{ readonly texte: string; readonly compte: number }> {
  const actif = page.locator(
    'nav[data-nav="onglets-registre"] a[aria-current="page"]',
  );
  const texte = (await actif.innerText()).trim();
  const compteTexte = await actif
    .locator("[data-compte]")
    .getAttribute("data-compte");
  expect(compteTexte).not.toBeNull();
  return { texte, compte: Number(compteTexte) };
}

/** Le lien de LA TUILE elle-même — son premier enfant direct, jamais le lien secondaire. */
function lienDeLaTuile(tuile: Locator): Locator {
  return tuile.locator("> div, > a").first();
}

const TUILES_CLIQUABLES = [
  {
    page: "/tableau-de-bord",
    blocTuile: "kpi-bloques",
    href: "/interventions?vue=bloquees",
    libelleOnglet: "interventions.vue.bloquees" as const,
  },
  {
    page: "/tableau-de-bord",
    blocTuile: "kpi-en-retard",
    href: "/interventions?vue=en_retard",
    libelleOnglet: "interventions.vue.en_retard" as const,
  },
] as const;

for (const {
  page: chemin,
  blocTuile,
  href,
  libelleOnglet,
} of TUILES_CLIQUABLES) {
  test(`la tuile « ${blocTuile} » (${chemin}) est cliquable, mène à ${href}, et compte EXACTEMENT ce que l'onglet montre`, async ({
    page,
  }) => {
    await page.goto(chemin);
    const tuile = page.locator(`[data-bloc="${blocTuile}"]`);
    await expect(tuile).toBeVisible();

    const lien = lienDeLaTuile(tuile);
    await expect(lien).toHaveAttribute("href", href);

    // FOCUS VISIBLE (9BZ-TP-UX1-1-ECHELLE) — la tuile porte l'anneau de
    // focus, comme tout élément actif du produit.
    await lien.focus();
    const anneau = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).boxShadow,
    );
    expect(anneau).toContain("3px");

    // LA VALEUR DE LA TUILE, LUE DANS LE RENDU — comparée deux lignes plus
    // bas à l'onglet qu'elle nomme, lu dans le MÊME passage.
    const valeurTuile = premierNombreIsole(await tuile.innerText());
    expect(valeurTuile).not.toBeNull();

    await lien.click();
    await page.waitForURL(href);
    const { texte: texteOnglet, compte: compteOnglet } =
      await ongletActifEtSonCompte(page);
    expect(texteOnglet).toContain(fr[libelleOnglet]);

    expect(valeurTuile).toBe(compteOnglet);
  });
}

const TUILES_INERTES = [
  { page: "/tableau-de-bord", blocTuile: "kpi-interventions" },
  { page: "/tableau-de-bord", blocTuile: "kpi-occupation" },
  { page: "/tableau-de-bord", blocTuile: "kpi-vgp" },
] as const;

for (const { page: chemin, blocTuile } of TUILES_INERTES) {
  test(`la tuile « ${blocTuile} » (${chemin}) reste INERTE — aucun rôle "link" sur la tuile elle-même`, async ({
    page,
  }) => {
    await page.goto(chemin);
    const tuile = page.locator(`[data-bloc="${blocTuile}"]`);
    await expect(tuile).toBeVisible();
    const premierEnfant = lienDeLaTuile(tuile);
    expect(await premierEnfant.evaluate((element) => element.tagName)).toBe(
      "DIV",
    );
  });
}
