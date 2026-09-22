import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { dateCivile, jourSuivant, type JourLocal } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, MERCREDI, type ReperesDeScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE BLOCAGE D'AGENDA SE VOIT AVANT TOUTE TENTATIVE D'AFFECTATION
 * (PLANNING-1, RG-PLA-06, 22/09/2026).
 *
 * ## Le défaut mesuré
 *
 * RG-PLA-06 — *« Une absence validée bloque le créneau »* — refusait
 * l'affectation d'un technicien absent, mais seulement APRÈS la tentative :
 * le dépôt (`verdictALaPose`) et le déclencheur `intervention_pas_sur_blocage_agenda`
 * rendaient le refus, et rien sur le planning ni dans le sélecteur ne disait
 * le blocage avant. Le planificateur choisissait, se faisait refuser,
 * recommençait. La règle ne change pas — le dépôt refuse toujours — ; ce
 * fichier éprouve que l'information arrive AVANT le geste, sur les trois
 * surfaces qui le précèdent : la vue semaine, la vue jour, et le sélecteur
 * « Affecter » de la fiche.
 *
 * ## Ce que les gardiens unitaires ne prouvent pas
 *
 * `tests/unit/interventions/blocage-agenda-visible.test.ts` éprouve les
 * rangements (`construireGrille`, `construireJournee`, `optionsDAffectation`)
 * sur des tableaux. Il ne prouve rien de l'ÉCRAN : que la page LISE bien les
 * blocages sous le contexte cloisonné, les donne aux rangements, et rende la
 * pastille là où la case est. C'est la frontière que ce fichier traverse.
 *
 * ## La scène : Wamytan, JEUDI, QUATORZE SEMAINES PLUS LOIN
 *
 * Le blocage est posé sur `wamytan@codima.test` (Dolbeau), un JEUDI — une
 * personne et un jour que les scénarios du glisser-déposer ne visent pas
 * (`SCENE` : Koné et Ducos, mardi, mercredi, samedi), pour qu'aucun dépôt
 * parallèle ne tombe sur une case que ce fichier vient de bloquer. Il est
 * écrit par le PROPRIÉTAIRE, comme la scène : une fixture s'écrit avant
 * qu'aucune session n'existe, et ce que les scénarios mesurent passe ensuite
 * entièrement par le rôle applicatif et par les politiques.
 *
 * **Et il est posé HORS de la fenêtre de `/absences`** (−30 / +90 jours,
 * `JOURS_A_VENIR` de `app/(back-office)/absences/page.tsx`). *Mesuré le
 * 22/09/2026, au premier `verify:full`* : posé dans la semaine courante, il
 * donnait à `/absences` une ligne de tableau et une pastille, et
 * `tests/e2e/ecrans-largeur-utile.spec.ts` — qui exige cet écran COURT
 * comme témoin de sa mesure — rougissait à 918 px. Une fixture qui déborde
 * sur un écran qu'elle n'éprouve pas est une fixture mal posée ; le
 * planning, lui, se rend à n'importe quelle semaine par `?semaine=`. Le
 * jour où `/absences` élargirait sa fenêtre au-delà de quatorze semaines,
 * c'est ce scénario-là qui le dirait, et c'est ici qu'il faudrait reculer.
 *
 * Le TÉMOIN, à chaque assertion : la même personne la VEILLE (mercredi), et
 * une autre personne le MÊME jour — sans eux, une page qui marquerait tout
 * passerait pour juste (§9, 11/09).
 */

/** Jeudi — le rang depuis le lundi, comme `MARDI`, `MERCREDI` et `SAMEDI`. */
const JEUDI = 3;
/** Au-delà des 90 jours que `/absences` affiche — voir l'en-tête. */
const SEMAINES_DE_DECALAGE = 14;

const BLOCAGE_WAMYTAN = "01a0e2e0-0000-7000-8000-0000000000ab";
/** Une intervention DATÉE du jeudi, sans technicien : la fiche qui affecte. */
const INTERVENTION_DU_JEUDI = "01a0e2e0-0000-7000-8000-0000000000ac";

let reperes: ReperesDeScene;
/** Le lundi de la semaine visée — `reperes.lundi` décalé, jamais lui. */
let lundiVise: JourLocal;
let wamytan: string;
let dateDuJeudi: Date;

/** Le jour d'un rang depuis le lundi VISÉ — le pendant de `jourDeLaScene`. */
function jourVise(rang: number): JourLocal {
  return jourSuivant(lundiVise, rang);
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  lundiVise = jourSuivant(reperes.lundi, 7 * SEMAINES_DE_DECALAGE);
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    wamytan = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: "wamytan@codima.test" },
        select: { id: true },
      })
    ).id;
    const jeudi = jourVise(JEUDI);
    dateDuJeudi = new Date(Date.UTC(jeudi.annee, jeudi.mois - 1, jeudi.jour));

    // `INSERT … ON CONFLICT DO NOTHING`, et non `delete` puis `create` comme
    // la scène : ce `beforeAll` tourne dans CHAQUE worker (`fullyParallel`),
    // et deux workers qui écrivent le même identifiant se font la course —
    // mesuré deux fois, `Unique constraint failed on the fields: (id)`, y
    // compris sous `upsert`, que Prisma ne rend pas atomique ici. L'écriture
    // est la même quel que soit le gagnant ; la base étant recréée à chaque
    // exécution, il n'y a pas d'état ancien à défaire. **Sans cible** après
    // `ON CONFLICT` : `intervention` porte aussi l'unicité `(societe_id, id)`,
    // et sous concurrence c'est elle qui lève la première — mesuré, `23505`
    // sur cette clé avec `ON CONFLICT ("id")`, qui ne l'arbitrait pas.
    await client.$executeRawUnsafe(
      `INSERT INTO "absence" ("id", "societe_id", "utilisateur_id", "du", "au", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $4::date, now())
       ON CONFLICT DO NOTHING`,
      BLOCAGE_WAMYTAN,
      reperes.societeId,
      wamytan,
      dateDuJeudi,
    );

    // L'intervention du jeudi, sur un site DUCOS d'un client ACTIF (RG-PLA-08
    // — le site de Dolbeau appartient au client inactif du semis, et la
    // fiche n'en a de toute façon pas besoin : le sélecteur « Affecter »
    // annote À LA DATE, quel que soit le lieu). Sans technicien : le scénario
    // de refus, plus bas, n'en pose jamais — le dépôt refuse avant d'écrire.
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client: { actif: true },
      },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "duree_estimee_min",
         "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'a_planifier', $6::date, 60, 'temps_passe', 'XPF', now())
       ON CONFLICT DO NOTHING`,
      INTERVENTION_DU_JEUDI,
      reperes.societeId,
      ducos.id,
      site.client_id,
      site.id,
      dateDuJeudi,
    );
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

function caseDeSemaine(
  page: import("@playwright/test").Page,
  technicienId: string,
  rang: number,
) {
  return page.locator(
    `[data-depot-jour="${cleDeJour(jourVise(rang))}"][data-depot-technicien="${technicienId}"]`,
  );
}

test("la VUE SEMAINE marque la case du jeudi de Wamytan — et elle seule", async ({
  page,
}) => {
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(lundiVise)}`);

  const bloquee = caseDeSemaine(page, wamytan, JEUDI);
  await expect(bloquee).toBeAttached();
  await expect(bloquee.locator("[data-agenda-bloque]")).toHaveCount(1);
  await expect(bloquee.locator("[data-agenda-bloque]")).toHaveText(
    fr["planning.agenda_bloque"],
  );

  // LES TÉMOINS : la veille de la même personne, et une autre personne le
  // même jour. La page ne marque pas tout.
  await expect(
    caseDeSemaine(page, wamytan, MERCREDI).locator("[data-agenda-bloque]"),
  ).toHaveCount(0);
  await expect(
    caseDeSemaine(page, reperes.technicienDucos, JEUDI).locator(
      "[data-agenda-bloque]",
    ),
  ).toHaveCount(0);

  // ET LA LÉGENDE LE DIT — la case reste une cible, le dépôt sera refusé.
  await expect(
    page.getByText(fr["planning.legende.agenda_bloque"]).first(),
  ).toBeVisible();
});

test("la VUE JOUR marque la colonne de Wamytan en tête, le jeudi", async ({
  page,
}) => {
  const jeudi = cleDeJour(jourVise(JEUDI));
  await page.goto(`/planning?vue=jour&jour=${jeudi}`);

  // La pastille est dans l'EN-TÊTE de la colonne — un `<th>` — et il n'y en
  // a qu'une pour toute la page : Wamytan seul est bloqué ce jour-là.
  const pastilles = page.locator("th [data-agenda-bloque]");
  await expect(pastilles).toHaveCount(1);
  // Ses cellules n'offrent aucun dépôt lisible comme libre : toutes celles
  // qui ne portent pas une occupation portent l'aplat du blocage
  // (`bg-app-violet-fond`) — une occupation posée avant le blocage, s'il y
  // en a une au semis, reste occupée (I5). La colonne voisine, elle, n'en
  // porte aucune.
  const cellulesDeWamytan = page.locator(
    `td[data-depot-technicien="${wamytan}"][data-depot-heure]`,
  );
  await expect(cellulesDeWamytan.first()).toBeAttached();
  const total = await cellulesDeWamytan.count();
  const occupees = await cellulesDeWamytan
    .filter({ has: page.locator("a") })
    .count();
  const violettes = await page
    .locator(
      `td.bg-app-violet-fond[data-depot-technicien="${wamytan}"][data-depot-heure]`,
    )
    .count();
  expect(total).toBeGreaterThan(0);
  expect(violettes).toBe(total - occupees);
  await expect(
    page.locator(
      `td.bg-app-violet-fond[data-depot-technicien="${reperes.technicienDucos}"][data-depot-heure]`,
    ),
  ).toHaveCount(0);

  // LE TÉMOIN — la veille, la même vue ne porte AUCUNE pastille.
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(jourVise(MERCREDI))}`);
  await expect(page.locator("th [data-agenda-bloque]")).toHaveCount(0);
});

test("le sélecteur « Affecter » de la fiche DIT le blocage avant le choix", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_DU_JEUDI}`);

  // Le formulaire « Affecter » est le premier `<select name="technicien_id">`
  // de la page ; « Déplacer », plus bas, garde la liste nue.
  const affecter = page.locator('select[name="technicien_id"]').first();
  const optionWamytan = affecter.locator(`option[value="${wamytan}"]`);
  await expect(optionWamytan).toHaveAttribute("data-agenda-bloque", "");
  // Le suffixe porte la DATE du blocage, en clair — la fiche ne l'affiche
  // nulle part ailleurs.
  await expect(optionWamytan).toHaveText(
    new RegExp(
      `${fr["intervention.technicien_agenda_bloque_le"]} ${dateCivile(dateDuJeudi)}$`,
    ),
  );
  // Elle reste PROPOSÉE — la règle ne change pas, c'est le dépôt qui tranche.
  await expect(optionWamytan).toBeEnabled();

  // LES TÉMOINS : une autre personne, le même jour, n'est pas annotée…
  const optionGuerin = affecter.locator(
    `option[value="${reperes.technicienDucos}"]`,
  );
  await expect(optionGuerin).not.toHaveAttribute("data-agenda-bloque", "");
  // … et « Déplacer », dont la date se saisit dans le formulaire, ne dit rien
  // « à cette date » — il n'a pas de date à laquelle le dire.
  const deplacer = page.locator('select[name="technicien_id"]').nth(1);
  await expect(deplacer.locator("option[data-agenda-bloque]")).toHaveCount(0);
});

test("et RG-PLA-06 refuse toujours — l'information ne remplace pas la règle", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_DU_JEUDI}`);
  const affecter = page.locator('select[name="technicien_id"]').first();
  await affecter.selectOption(wamytan);
  await page
    .getByRole("button", { name: fr["intervention.action.affecter"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(
    new RegExp(`/interventions/${INTERVENTION_DU_JEUDI}\\?motif=`),
  );
  await expect(
    page.getByText(fr["intervention.refus.absence"]).first(),
  ).toBeVisible();
});
