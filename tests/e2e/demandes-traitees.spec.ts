import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * L'ONGLET « TRAITÉES » ET LA RÉUTILISATION D'UNE DEMANDE (TP-DEM, IN-40,
 * IN-42, IN-44 ; D164).
 *
 * ## Ce que ce fichier confronte, et qui n'est éprouvé nulle part ailleurs
 *
 * `tests/e2e/demandes.spec.ts` confronte le cycle de vie complet par la
 * route et l'écran, mais SANS onglet (il mesure `main` avant ce lot). Celui-ci
 * confronte : les DEUX onglets par la route (« À traiter » seul dans le DOM
 * par défaut, « Traitées » qui montre les demandes transformées/closes avec
 * leur colonne « Suite »), le refus IN-42 affiché par l'écran de création
 * plutôt que le silence, et le refus IN-44 — motif de clôture vide — tenu par
 * la route quand on la force (le formulaire, lui, ne permet plus de l'envoyer
 * vide : voir ci-dessous).
 *
 * ## Scène À SOI (mémoire du poste : « un spec qui compte pose SON site »)
 *
 * Un client et un site dédiés, jamais empruntés au semis partagé ni à
 * `demandes.spec.ts` qui tourne en parallèle (`fullyParallel`) et transforme/
 * clôt SES PROPRES demandes — aucune épreuve ci-dessous ne compte un total
 * de société, seulement ses propres identifiants (même famille que
 * `porte-capacites.spec.ts`).
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };

const dictionnaire = fr as Record<string, string>;

const CLIENT_TRAITEES = "e2e00000-0000-7000-8000-00000000d2a0";
const SITE_TRAITEES = "e2e00000-0000-7000-8000-00000000d2a1";
const DEMANDE_TRANSFORMEE = "e2e00000-0000-7000-8000-00000000d2a2";
const DEMANDE_CLOSE = "e2e00000-0000-7000-8000-00000000d2a3";
const DEMANDE_NOUVELLE = "e2e00000-0000-7000-8000-00000000d2a4";
const DEMANDE_QUALIFIEE = "e2e00000-0000-7000-8000-00000000d2a5";
const INTERVENTION_ISSUE = "e2e00000-0000-7000-8000-00000000d2a6";

const DESCRIPTION_TRANSFORMEE =
  dictionnaire["demandes.e2e.description_ancienne"]!;
const DESCRIPTION_CLOSE = dictionnaire["demandes.e2e.description_recente"]!;

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({
    where: { id: INTERVENTION_ISSUE },
  });
  await client.demande.deleteMany({
    where: {
      id: {
        in: [
          DEMANDE_TRANSFORMEE,
          DEMANDE_CLOSE,
          DEMANDE_NOUVELLE,
          DEMANDE_QUALIFIEE,
        ],
      },
    },
  });
  await client.site.deleteMany({ where: { id: SITE_TRAITEES } });
  await client.client.deleteMany({ where: { id: CLIENT_TRAITEES } });
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
        id: CLIENT_TRAITEES,
        societe_id: societe.id,
        raison_sociale: "Client de l'onglet Traitées (épreuve TP-DEM)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_TRAITEES,
        societe_id: societe.id,
        client_id: CLIENT_TRAITEES,
        agence_id: agence.id,
        libelle: "Lieu de l'onglet Traitées (épreuve TP-DEM)",
        temps_trajet_min: 10,
      },
    });

    const maintenant = new Date();
    const troisJours = new Date(maintenant.getTime() - 3 * 24 * 60 * 60 * 1000);

    // POSÉES DIRECTEMENT AU STATUT VISÉ — le déclencheur `demande_cycle_de_vie`
    // ne garde que l'`UPDATE` (migration `20260913140000_demande_l2_06`), une
    // ligne neuve peut donc naître `transformee`/`close_sans_suite` sans
    // emprunter les quatre transitions légales.
    await client.$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
       VALUES ('${DEMANDE_TRANSFORMEE}', '${societe.id}', 'appel', '${CLIENT_TRAITEES}',
         '${SITE_TRAITEES}', '${agence.id}', '${DESCRIPTION_TRANSFORMEE}', 'transformee',
         '${troisJours.toISOString()}', now(), now())`,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "motif_cloture", "depose_le",
         "compteur_accuse_le", "close_le", "modifie_le")
       VALUES ('${DEMANDE_CLOSE}', '${societe.id}', 'appel', '${CLIENT_TRAITEES}',
         '${SITE_TRAITEES}', '${agence.id}', '${DESCRIPTION_CLOSE}', 'close_sans_suite', 'doublon',
         '${maintenant.toISOString()}', now(), now(), now())`,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
       VALUES ('${DEMANDE_NOUVELLE}', '${societe.id}', 'appel', '${CLIENT_TRAITEES}',
         '${SITE_TRAITEES}', '${agence.id}', 'Épreuve TP-DEM — nouvelle', 'nouvelle',
         now(), now(), now())`,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
         "agence_id", "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
       VALUES ('${DEMANDE_QUALIFIEE}', '${societe.id}', 'appel', '${CLIENT_TRAITEES}',
         '${SITE_TRAITEES}', '${agence.id}', 'Épreuve TP-DEM — qualifiée', 'qualifiee',
         now(), now(), now())`,
    );

    // L'INTERVENTION ISSUE DE LA DEMANDE TRANSFORMÉE — ce que la colonne
    // « Suite » doit lier.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ISSUE,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: CLIENT_TRAITEES,
        site_id: SITE_TRAITEES,
        demande_id: DEMANDE_TRANSFORMEE,
        type: "curatif",
        priorite: "p3",
        statut: "a_planifier",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "Épreuve TP-DEM — intervention issue",
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

test("PAR DÉFAUT, « À traiter » est seul dans le DOM : aucune de nos demandes traitées n'y apparaît", async ({
  page,
}) => {
  await page.goto("/demandes");
  await expect(page.locator("main")).toBeVisible();

  // SCOPÉ À LA NAVIGATION DES ONGLETS (`aria-label`, `demande.titre`) — sans
  // quoi « Traitées » recoupe aussi le nom de NOTRE PROPRE client (« Client
  // de l'onglet Traitées »), posé par ce fichier lui-même.
  const navigationOnglets = page.getByRole("navigation", {
    name: dictionnaire["demande.titre"],
  });
  const ongletATraiter = navigationOnglets.getByRole("link", {
    name: new RegExp(dictionnaire["demandes.onglet.a_traiter"]),
  });
  await expect(ongletATraiter).toHaveAttribute("aria-current", "page");

  await expect(
    page.locator(`tr[data-demande="${DEMANDE_TRANSFORMEE}"]`),
  ).toHaveCount(0);
  await expect(page.locator(`tr[data-demande="${DEMANDE_CLOSE}"]`)).toHaveCount(
    0,
  );
});

test("L'ONGLET « TRAITÉES » montre nos deux demandes, la plus RÉCENTE d'abord, avec leur « Suite »", async ({
  page,
}) => {
  await page.goto("/demandes?onglet=traitees");
  await expect(page.locator("main")).toBeVisible();

  const navigationOnglets = page.getByRole("navigation", {
    name: dictionnaire["demande.titre"],
  });
  const ongletTraitees = navigationOnglets.getByRole("link", {
    name: new RegExp(dictionnaire["demandes.onglet.traitees"]),
  });
  await expect(ongletTraitees).toHaveAttribute("aria-current", "page");

  const ligneTransformee = page.locator(
    `tr[data-demande="${DEMANDE_TRANSFORMEE}"]`,
  );
  const ligneClose = page.locator(`tr[data-demande="${DEMANDE_CLOSE}"]`);
  await expect(ligneTransformee).toHaveCount(1);
  await expect(ligneClose).toHaveCount(1);

  // LA PLUS RÉCENTE D'ABORD — `DEMANDE_CLOSE` (déposée maintenant) précède
  // `DEMANDE_TRANSFORMEE` (déposée il y a trois jours) dans le DOM.
  const lignes = page.locator(
    `tr[data-demande="${DEMANDE_CLOSE}"], tr[data-demande="${DEMANDE_TRANSFORMEE}"]`,
  );
  await expect(lignes.nth(0)).toHaveAttribute("data-demande", DEMANDE_CLOSE);
  await expect(lignes.nth(1)).toHaveAttribute(
    "data-demande",
    DEMANDE_TRANSFORMEE,
  );

  // LA COLONNE « SUITE » — un lien vers l'intervention issue pour la
  // transformée, le motif de clôture pour la close.
  await expect(
    ligneTransformee.getByRole("link", {
      name: new RegExp(`Local-|INT-`),
    }),
  ).toBeVisible();
  await expect(ligneClose).toContainText(dictionnaire["demande.motif.doublon"]);

  // AUCUN STATUT « À TRAITER » NE S'Y GLISSE.
  await expect(
    page.locator(`tr[data-demande="${DEMANDE_NOUVELLE}"]`),
  ).toHaveCount(0);
  await expect(
    page.locator(`tr[data-demande="${DEMANDE_QUALIFIEE}"]`),
  ).toHaveCount(0);
});

test("IN-42 — UNE DEMANDE PAS ENCORE QUALIFIÉE affiche le refus plutôt que de préremplir en silence", async ({
  page,
}) => {
  await page.goto(`/interventions/nouvelle?demande=${DEMANDE_NOUVELLE}`);
  await expect(
    page.getByText(dictionnaire["intervention.refus.demande_non_qualifiee"]),
  ).toBeVisible();
});

test("IN-42 — UNE DEMANDE DÉJÀ TRANSFORMÉE affiche le refus plutôt que de préremplir en silence", async ({
  page,
}) => {
  await page.goto(`/interventions/nouvelle?demande=${DEMANDE_TRANSFORMEE}`);
  await expect(
    page.getByText(dictionnaire["intervention.refus.demande_deja_traitee"]),
  ).toBeVisible();
});

test("IN-44 — un motif de clôture VIDE est refusé par la route, sans rien écrire", async ({
  page,
}) => {
  const avant = await page.request
    .get(`/demandes/${DEMANDE_QUALIFIEE}`)
    .then((r) => r.status());
  expect(avant).toBe(200);

  const reponse = await page.request.post(
    `/api/demandes/${DEMANDE_QUALIFIEE}/clore`,
    {
      form: {},
      maxRedirects: 0,
    },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "demande.cloture.motif_requis",
  );

  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const demande = await client.demande.findUniqueOrThrow({
      where: { id: DEMANDE_QUALIFIEE },
      select: { statut: true, motif_cloture: true },
    });
    expect(demande.statut).toBe("qualifiee");
    expect(demande.motif_cloture).toBeNull();
  } finally {
    await client.$disconnect();
  }
});
