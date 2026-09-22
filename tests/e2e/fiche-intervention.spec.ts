import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { heureDuCreneau } from "@/app/(back-office)/interventions/presentation";
import { fr } from "@/lib/i18n";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * FICHE-INTERVENTION-1 — LA FICHE SE LIT EN UN COUP D'ŒIL.
 *
 * ## Le constat mesuré le 23/09/2026 sur `main`
 *
 * Quatre défauts, sur `app/(back-office)/interventions/[id]/page.tsx` :
 * la date et l'heure planifiées n'apparaissaient nulle part dans
 * l'identification ; le retour était TOUJOURS « Retour au planning », quel
 * que soit l'écran d'origine ; sur une intervention clôturée ou annulée,
 * quatre blocs répétaient le même refus de statut, et « Ajouter une
 * machine » restait proposé avec sa liste entière ; le sous-titre
 * `intervention.sans_numero` était un jargon d'implémentation, pas une
 * phrase d'exploitant.
 *
 * Ce fichier pose SES PROPRES lignes, à des identifiants fixes, plutôt que
 * de viser une ligne du semis — même raison que `scene.ts` : une épreuve dont
 * la cible se déplace au prochain ticket de démonstration n'est pas une
 * épreuve.
 */

const FICHE_DATEE = "01a0f001-0000-7000-8000-000000000001";
const FICHE_SANS_DATE = "01a0f001-0000-7000-8000-000000000002";
const FICHE_CLOTUREE = "01a0f001-0000-7000-8000-000000000003";
const FICHE_ANNULEE = "01a0f001-0000-7000-8000-000000000004";

/** Trois semaines après aujourd'hui, en jour civil — comme `date_planifiee`
 * le veut (`@db.Date`, minuit UTC). Loin de toute fenêtre qu'un autre
 * scénario borne (§9, 22/09 : une fixture qui déborde sur un écran qu'elle
 * n'éprouve pas est mal posée). */
function dansTroisSemaines(): Date {
  const aujourdhui = new Date();
  return new Date(
    Date.UTC(
      aujourdhui.getUTCFullYear(),
      aujourdhui.getUTCMonth(),
      aujourdhui.getUTCDate() + 21,
    ),
  );
}

let societeId: string;
let ducosId: string;
let siteId: string;
let clientId: string;
let machineDuSiteId: string;
let autreMachineId: string;
/** L'heure du créneau de `FICHE_DATEE`, MESURÉE par la même fonction que
 * l'écran (`heureDuCreneau`) — jamais une chaîne écrite en dur (L0-11). */
let heureAttendue: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    ducosId = ducos.id;
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: societeId,
        agence_id: ducosId,
        client: { actif: true },
      },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    siteId = site.id;
    clientId = site.client_id;
    // DEUX MACHINES DE LA SOCIÉTÉ, JAMAIS DEVINÉES DU MÊME SITE — seule LA
    // PREMIÈRE est rattachée à `FICHE_DATEE` (par écriture directe de
    // `intervention_machine`, hors de l'application) ; la seconde ne sert
    // qu'à ÉPROUVER le repli quand `depuis_id` ne désigne PAS une machine de
    // cette intervention.
    const machines = await client.machine.findMany({
      where: { societe_id: societeId },
      select: { id: true },
      take: 2,
      orderBy: { id: "asc" },
    });
    if (machines[0] === undefined || machines[1] === undefined) {
      throw new Error("le semis n'a posé aucune paire de machines");
    }
    machineDuSiteId = machines[0].id;
    autreMachineId = machines[1].id;

    const jour = dansTroisSemaines();
    // `creneau_debut` est un `TIMESTAMP(3)` SANS fuseau — Prisma le lit comme
    // un INSTANT UTC (L0-08). 08:00 à Nouméa (UTC+11, sans heure d'été) est
    // donc 21:00 UTC la VEILLE du jour civil.
    const creneauDebut = new Date(jour.getTime() + (8 - 11) * 3_600_000);
    // L'HEURE ATTENDUE, MESURÉE PAR LA MÊME FONCTION QUE L'ÉCRAN — jamais
    // « 08:00 » recopié en dur dans le scénario (L0-11).
    const heure = heureDuCreneau(
      { creneau_debut: creneauDebut },
      reperes.fuseau,
    );
    if (heure === null) {
      throw new Error("le créneau posé devrait produire une heure lisible");
    }
    heureAttendue = heure;

    // FICHE DATÉE — un créneau à 08:00 locale.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'planifiee', $6::date, $7::timestamp, 60,
               'temps_passe', 'XPF', now())
       ON CONFLICT DO NOTHING`,
      FICHE_DATEE,
      societeId,
      ducosId,
      clientId,
      siteId,
      jour,
      creneauDebut,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now())
       ON CONFLICT DO NOTHING`,
      societeId,
      FICHE_DATEE,
      machineDuSiteId,
    );

    // FICHE SANS DATE — la file d'attente ordinaire.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "duree_estimee_min",
         "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'a_planifier', 60, 'temps_passe', 'XPF', now())
       ON CONFLICT DO NOTHING`,
      FICHE_SANS_DATE,
      societeId,
      ducosId,
      clientId,
      siteId,
    );

    // FICHE CLÔTURÉE — statut posé directement : `intervention_cycle_de_vie`
    // ne garde que les TRANSITIONS (`BEFORE UPDATE`), jamais la naissance.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee",
         "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'cloturee', $6::date, 60, 'temps_passe', 'XPF', now())
       ON CONFLICT DO NOTHING`,
      FICHE_CLOTUREE,
      societeId,
      ducosId,
      clientId,
      siteId,
      jour,
    );

    // FICHE ANNULÉE.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "motif_annulation",
         "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'annulee', $6::date, 'épreuve', 60, 'temps_passe', 'XPF', now())
       ON CONFLICT DO NOTHING`,
      FICHE_ANNULEE,
      societeId,
      ducosId,
      clientId,
      siteId,
      jour,
    );
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la date et l'heure planifiées sont dans l'en-tête, et l'absence se nomme", async ({
  page,
}) => {
  await page.goto(`/interventions/${FICHE_DATEE}`);
  const ligneDate = page.locator("dt", { hasText: fr["intervention.date"] });
  await expect(ligneDate).toBeVisible();
  const valeur = ligneDate.locator("xpath=following-sibling::dd[1]");
  // L'heure locale (Pacific/Noumea, UTC+11) du créneau posé pour ce jour,
  // MESURÉE dans `beforeAll` par `heureDuCreneau` — jamais recopiée en dur.
  await expect(valeur).toContainText(heureAttendue);

  await page.goto(`/interventions/${FICHE_SANS_DATE}`);
  await expect(
    page.locator("dd", { hasText: fr["statut.a_planifier"] }).first(),
  ).toBeVisible();
});

test("le sous-titre ne cite plus le mécanisme d'attribution du numéro", async ({
  page,
}) => {
  await page.goto(`/interventions/${FICHE_DATEE}`);
  await expect(page.getByText(fr["intervention.sans_numero"])).toBeVisible();
});

test("sur une intervention CLÔTURÉE, aucun bloc refusé ne s'affiche — seule l'annulation reste possible", async ({
  page,
}) => {
  await page.goto(`/interventions/${FICHE_CLOTUREE}`);

  await expect(page.locator('form[action$="/affecter"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/deplacer"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/cloturer"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/suspendre"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/reprendre"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/machine"]')).toHaveCount(0);

  await expect(
    page.getByText(fr["intervention.refus.cloturee_figee"]),
  ).toBeVisible();

  // LE RÔLE DE L'ÉPREUVE (`adv`) PEUT ANNULER (D131, matrice complète) : le
  // seul bloc qui reste POSSIBLE est un formulaire plein, pas une ligne.
  await expect(page.locator('form[action$="/annuler"]')).toBeVisible();
});

test("sur une intervention ANNULÉE, aucune action ne reste possible", async ({
  page,
}) => {
  await page.goto(`/interventions/${FICHE_ANNULEE}`);

  await expect(page.locator('form[action$="/affecter"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/deplacer"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/cloturer"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/suspendre"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/reprendre"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/annuler"]')).toHaveCount(0);
  await expect(page.locator('form[action$="/machine"]')).toHaveCount(0);

  await expect(
    page.getByText(fr["intervention.refus.annulee_figee"]),
  ).toBeVisible();
});

test("le retour mène à l'écran d'origine que `depuis` désigne, et au planning par défaut", async ({
  page,
}) => {
  await page.goto(`/interventions/${FICHE_DATEE}`);
  const retourParDefaut = page.getByRole("link", {
    name: fr["planning.retour_fleche"],
  });
  await expect(retourParDefaut).toBeVisible();
  await expect(retourParDefaut).toHaveAttribute("href", /^\/planning/);

  await page.goto(`/interventions/${FICHE_DATEE}?depuis=interventions`);
  await expect(
    page.getByRole("link", { name: fr["intervention.retour.interventions"] }),
  ).toHaveAttribute("href", "/interventions");

  await page.goto(`/interventions/${FICHE_DATEE}?depuis=client`);
  await expect(
    page.getByRole("link", { name: fr["intervention.retour.client"] }),
  ).toHaveAttribute("href", `/clients/${clientId}`);

  await page.goto(`/interventions/${FICHE_DATEE}?depuis=site`);
  await expect(
    page.getByRole("link", {
      name: `${fr["intervention.retour.site_prefixe"]} ${motDansUnePhrase("site")}`,
    }),
  ).toHaveAttribute("href", `/sites/${siteId}`);

  // LA MACHINE VALIDE — rattachée à CETTE intervention.
  await page.goto(
    `/interventions/${FICHE_DATEE}?depuis=machine&depuis_id=${machineDuSiteId}`,
  );
  await expect(
    page.getByRole("link", { name: fr["intervention.retour.machine"] }),
  ).toHaveAttribute("href", `/parc/${machineDuSiteId}`);

  // UNE MACHINE ÉTRANGÈRE À CETTE INTERVENTION — jamais recopiée telle
  // quelle dans le lien (redirection ouverte) : repli sur le planning.
  await page.goto(
    `/interventions/${FICHE_DATEE}?depuis=machine&depuis_id=${autreMachineId}`,
  );
  await expect(
    page.getByRole("link", { name: fr["planning.retour_fleche"] }),
  ).toHaveAttribute("href", /^\/planning/);

  // UNE VALEUR HORS DE LA LISTE FERMÉE — même repli.
  await page.goto(`/interventions/${FICHE_DATEE}?depuis=un-site-invente`);
  await expect(
    page.getByRole("link", { name: fr["planning.retour_fleche"] }),
  ).toHaveAttribute("href", /^\/planning/);
});
