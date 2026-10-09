import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import {
  cleJour,
  chargerCalendrierAgence,
  jourDe,
  jourSuivant,
  lundiDeLaSemaine,
  maintenant,
  prochainJourOuvert,
  type Calendrier,
  type JourLocal,
} from "@/lib/calendar";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";
import { urlAdministration } from "./setup/base";

/**
 * LES CAPTURES DE PG-A6-LIBELLE-SANS-DUREE (28/09/2026) — I-5 de l'audit
 * d'ergonomie du 27/09/2026 : la tuile du tableau de bord et le lien du
 * panneau de charge du planning disaient tous deux « sans durée » pour deux
 * POPULATIONS différentes. Même recette que
 * `captures-pg-a3a-messages-pose.spec.ts` : AVANT sur le code d'avant ce
 * ticket (`git worktree`), APRÈS sur le code livré.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGA6-` — une intervention `a_planifier`, posée
 * sur le PROCHAIN JOUR OUVERT de l'agence DUCOS à partir d'aujourd'hui à
 * Nouméa (jamais le jour UTC : le dimanche à Nouméa, minuit UTC est déjà
 * passé, et une date UTC sortirait de la semaine ouverte par `/planning` —
 * 9D0-E2E-PGA6-DIMANCHE), affectée à un technicien du semis, sans créneau ni
 * durée estimée : elle compte à la fois dans la tuile du tableau de bord
 * (date `>= aujourd'hui`) et dans le panneau de charge de LA SEMAINE DE CE
 * JOUR du planning, ouverte explicitement par `?semaine=` (`sansDuree` de
 * `occupationTechnicien`).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_A6 ?? "";

const CLIENT_PGA6 = uuidv7();
const SITE_PGA6 = uuidv7();
const INTERVENTION_PGA6 = uuidv7();

/**
 * Le lundi de la semaine du jour visé — ouvert explicitement par `?semaine=`
 * au test 2, puisque le dimanche à Nouméa, la semaine COURANTE (sans
 * paramètre) retomberait sur la précédente (9D0-E2E-PGA6-DIMANCHE).
 */
let LUNDI_SEMAINE: JourLocal;

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
    const aujourdhui = jourDe(maintenant(reperes.fuseau).local);
    const horizonJours = 15;
    const calendrier: Calendrier | null = await chargerCalendrierAgence(
      client,
      {
        societeId: reperes.societeId,
        agenceId: agence.id,
        fenetre: { du: aujourdhui, au: jourSuivant(aujourdhui, horizonJours) },
      },
    );
    const jourIntervention = prochainJourOuvert(
      calendrier === null ? [] : [calendrier],
      aujourdhui,
      horizonJours,
    );
    LUNDI_SEMAINE = lundiDeLaSemaine(jourIntervention);
    await client.client.create({
      data: {
        id: CLIENT_PGA6,
        societe_id: reperes.societeId,
        raison_sociale: "PGA6",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGA6,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGA6,
        agence_id: agence.id,
        libelle: "PGA6",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee",
         "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'a_planifier', $7::date, 'temps_passe', 'XPF', now())`,
      INTERVENTION_PGA6,
      reperes.societeId,
      agence.id,
      CLIENT_PGA6,
      SITE_PGA6,
      reperes.technicienDucos,
      cleJour(jourIntervention),
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
      CLIENT_PGA6,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGA6 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGA6 } });
  } finally {
    await client.$disconnect();
  }
});

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

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — tuile « sans durée » du tableau de bord, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/tableau-de-bord");
      await expect(
        page
          .locator('[data-bloc="activite"]')
          .getByText(fr["tableau_de_bord.interventions_sans_duree_titre"]),
      ).toBeVisible();
      await capturer(page, "tuile-sans-duree", largeur);
    });

    test(`capture — lien « sans durée » du panneau de charge du planning, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/planning?semaine=${cleJour(LUNDI_SEMAINE)}`);
      await expect(
        page
          .getByRole("link", {
            name: fr["statistiques.charge_incomplete_lien"],
          })
          .first(),
      ).toBeVisible();
      await capturer(page, "lien-sans-duree-planning", largeur);
    });
  });
}
