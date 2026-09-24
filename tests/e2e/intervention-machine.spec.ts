import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA MACHINE, DE BOUT EN BOUT (chantier INT-MACHINE 2, 20/09/2026).
 *
 * ## Le défaut que ce fichier mesure
 *
 * `app/api/interventions/creer/route.ts` figeait `machine_ids: []` — aucune
 * intervention ne pouvait porter de machine, ni à la création (le formulaire
 * n'avait aucun champ) ni après coup (aucun chemin n'existait). Le DÉPÔT,
 * lui, savait déjà écrire `intervention_machine` depuis L2-08a : c'était
 * l'écran qui manquait, pas la donnée.
 *
 * ## Les deux chemins, dans un seul fichier
 *
 * 1. Choisir une machine DÈS LA CRÉATION, dans la liste — filtrée au SITE
 *    choisi — que `components/interventions/site-et-machines.tsx` propose.
 * 2. En rattacher une APRÈS COUP depuis la fiche, par le mini-formulaire
 *    de `app/api/interventions/[id]/machine/route.ts`.
 *
 * Le site utilisé est celui du semis qui porte le PLUS de machines — trouvé
 * dynamiquement, jamais un identifiant fixe : `prisma/seed-data.ts` n'est pas
 * le territoire de ce lot, et une machine y est ajoutée ou retirée sans que
 * ce fichier ait à le savoir.
 */

type MachineDeSite = {
  readonly id: string;
  readonly libelle: string;
};

async function siteAvecLePlusDeMachines(): Promise<{
  readonly siteId: string;
  readonly clientId: string;
  readonly siteLibelle: string;
  readonly machines: readonly MachineDeSite[];
}> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const machines = await client.machine.findMany({
      where: { societe_id: societe.id },
      select: {
        id: true,
        site_id: true,
        client_id: true,
        modele: { select: { marque: true, reference: true } },
      },
    });
    const parSite = new Map<
      string,
      { clientId: string; machines: MachineDeSite[] }
    >();
    for (const machine of machines) {
      const groupe = parSite.get(machine.site_id) ?? {
        clientId: machine.client_id,
        machines: [],
      };
      groupe.machines.push({
        id: machine.id,
        libelle: `${machine.modele.marque} ${machine.modele.reference}`,
      });
      parSite.set(machine.site_id, groupe);
    }
    let meilleur: {
      siteId: string;
      clientId: string;
      machines: MachineDeSite[];
    } | null = null;
    for (const [siteId, groupe] of parSite) {
      if (
        meilleur === null ||
        groupe.machines.length > meilleur.machines.length
      ) {
        meilleur = {
          siteId,
          clientId: groupe.clientId,
          machines: groupe.machines,
        };
      }
    }
    if (meilleur === null) {
      throw new Error(
        "aucune machine dans le semis : ce scénario ne peut rien choisir",
      );
    }
    const site = await client.site.findUniqueOrThrow({
      where: { id: meilleur.siteId },
      select: { libelle: true },
    });
    return { ...meilleur, siteLibelle: site.libelle };
  } finally {
    await client.$disconnect();
  }
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("choisir une machine À LA CRÉATION la fait apparaître sur la fiche", async ({
  page,
}) => {
  const { siteLibelle, machines } = await siteAvecLePlusDeMachines();
  const machine = machines[0];

  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", siteLibelle, siteLibelle);

  const optionMachine = page.locator(
    `select[name="machine_ids"] option[value="${machine.id}"]`,
  );
  await expect(optionMachine).toBeAttached();
  await page.locator('select[name="machine_ids"]').selectOption([machine.id]);
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve — machine à la création");

  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
  // Scopé au `<dd>` de la fiche — le MÊME libellé apparaît aussi dans le
  // `<option>` du mini-formulaire « Ajouter une machine » juste en dessous
  // (chantier 2.2), et `getByText` seul violerait le mode strict.
  await expect(
    page.locator("dd").filter({ hasText: machine.libelle }),
  ).toBeVisible();
});

test("ajouter une machine APRÈS COUP depuis la fiche la fait apparaître", async ({
  page,
}) => {
  const { siteLibelle, machines } = await siteAvecLePlusDeMachines();
  const machine = machines[0];

  // UNE INTERVENTION SANS MACHINE, d'abord — le cas ordinaire du dépannage à
  // l'aveugle (voir `schemaCreation`).
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", siteLibelle, siteLibelle);
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve — machine après coup");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
  // Le `<dd>` « Machine » porte le TIRET, pas le libellé — même scope que
  // l'assertion positive ci-dessous, pour la même raison (`<option>` du
  // mini-formulaire).
  await expect(
    page.locator("dd").filter({ hasText: machine.libelle }),
  ).not.toBeVisible();

  const formulaireMachine = page.locator('form[action$="/machine"]');
  await expect(formulaireMachine).toBeVisible();
  await formulaireMachine
    .locator('select[name="machine_id"]')
    .selectOption(machine.id);
  await formulaireMachine
    .getByRole("button", { name: fr["intervention.machine.ajouter_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  // Aucun refus, et la machine apparaît désormais sur la fiche.
  await expect(page.locator("[role='status']")).toHaveCount(0);
  await expect(
    page.locator("dd").filter({ hasText: machine.libelle }),
  ).toBeVisible();
});
