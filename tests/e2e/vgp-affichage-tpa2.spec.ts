import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { decompte, libellePage } from "@/app/(back-office)/presentation";
import { cleJourDeDate } from "@/lib/calendar/agence";
import {
  instantDuJour,
  jourDe,
  maintenant,
  type Fuseau,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9BS-TP-A2-VGP-REGISTRE — L'AFFICHAGE : échéance dépassée sur la fiche site,
 * registre compté et paginé, « Enregistrer » selon le régime, date future
 * refusée.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `TPA2`, JAMAIS LE SEMIS (piège connu du lot)
 *
 * Deux sites, un seul client, quatre familles et quatre modèles — créés en
 * `beforeAll`, supprimés en `afterAll`. Le premier site porte le parc paginé
 * (51 machines soumises sans information, une « à déterminer », une « non
 * soumise ») ; le second porte une seule machine soumise, en retard.
 *
 * **Les identifiants du second site EVITENT la sous-chaîne « TPA2- »** (avec
 * le trait d'union) : la recherche `?q=TPA2-` du premier test doit retrouver
 * EXACTEMENT 53 machines, et une cinquième aurait faussé ce compte si son
 * modèle ou son numéro de série avait porté ce trait d'union (voir les clés
 * `tpa2.e2e.*` de `lib/i18n/fr.ts`).
 */

test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const FUSEAU_NOUMEA: Fuseau = "Pacific/Noumea";

/** Le jour civil de la société, calculé comme le fait le serveur (DATES-1). */
function dateCivileDuJour(): string {
  return cleJourDeDate(instantDuJour(jourDe(maintenant(FUSEAU_NOUMEA).local)));
}

/** `cle` (AAAA-MM-JJ) plus `n` jours, en arithmétique UTC pure. */
function dansNJours(cle: string, n: number): string {
  const date = new Date(`${cle}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return cleJourDeDate(date);
}

const CLIENT_TPA2 = uuidv7();
const SITE_PAGINATION = uuidv7();
const SITE_DEPASSEE = uuidv7();
const FAMILLE_SOUMISE = uuidv7();
const FAMILLE_A_DETERMINER = uuidv7();
const FAMILLE_NON_SOUMISE = uuidv7();
const FAMILLE_DEPASSEE = uuidv7();
const MODELE_SOUMIS = uuidv7();
const MODELE_A_DETERMINER = uuidv7();
const MODELE_NON_SOUMIS = uuidv7();
const MODELE_DEPASSEE = uuidv7();
const MACHINE_A_DETERMINER = uuidv7();
const MACHINE_NON_SOUMISE = uuidv7();
const MACHINE_DEPASSEE = uuidv7();
const VERIFICATION_DEPASSEE = uuidv7();

const NOMBRE_SOUMISES = 51;
const MACHINES_SOUMISES = Array.from({ length: NOMBRE_SOUMISES }, () =>
  uuidv7(),
);

function numeroSoumise(index: number): string {
  return `TPA2-${String(index + 1).padStart(3, "0")}`;
}

const SN_A_DETERMINER = fr["tpa2.e2e.numero_serie_a_determiner"];
const SN_NON_SOUMISE = fr["tpa2.e2e.numero_serie_non_soumise"];
const SN_DEPASSEE = fr["tpa2.e2e.numero_serie_depassee"];

const TOUS_LES_IDS_MACHINE = [
  ...MACHINES_SOUMISES,
  MACHINE_A_DETERMINER,
  MACHINE_NON_SOUMISE,
  MACHINE_DEPASSEE,
];

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_TPA2,
        societe_id: societeId,
        raison_sociale: fr["tpa2.e2e.client"],
        actif: true,
      },
    });
    await client.site.createMany({
      data: [
        {
          id: SITE_PAGINATION,
          societe_id: societeId,
          client_id: CLIENT_TPA2,
          agence_id: agence.id,
          libelle: fr["tpa2.e2e.site_pagination"],
        },
        {
          id: SITE_DEPASSEE,
          societe_id: societeId,
          client_id: CLIENT_TPA2,
          agence_id: agence.id,
          libelle: fr["tpa2.e2e.site_depassee"],
        },
      ],
    });

    await client.familleMateriel.createMany({
      data: [
        {
          id: FAMILLE_SOUMISE,
          societe_id: societeId,
          code: "TPA2-SOUMISE",
          libelle: fr["tpa2.e2e.famille_soumise"],
          assujettissement_vgp: "soumis",
          vgp_periodicite_mois: 1,
          vgp_reference_texte: fr["tpa2.e2e.reference_texte"],
        },
        {
          id: FAMILLE_A_DETERMINER,
          societe_id: societeId,
          code: "TPA2-A-DET",
          libelle: fr["tpa2.e2e.famille_a_determiner"],
          assujettissement_vgp: "a_determiner",
        },
        {
          id: FAMILLE_NON_SOUMISE,
          societe_id: societeId,
          code: "TPA2-NON-SOU",
          libelle: fr["tpa2.e2e.famille_non_soumise"],
          assujettissement_vgp: "non_soumis",
        },
        {
          id: FAMILLE_DEPASSEE,
          societe_id: societeId,
          code: "TPA2-DEPASSEE",
          libelle: fr["tpa2.e2e.famille_depassee"],
          assujettissement_vgp: "soumis",
          vgp_periodicite_mois: 1,
          vgp_reference_texte: fr["tpa2.e2e.reference_texte"],
        },
      ],
    });

    await client.modeleMateriel.createMany({
      data: [
        {
          id: MODELE_SOUMIS,
          societe_id: societeId,
          famille_id: FAMILLE_SOUMISE,
          marque: "TPA2",
          reference: fr["tpa2.e2e.modele_soumis"],
        },
        {
          id: MODELE_A_DETERMINER,
          societe_id: societeId,
          famille_id: FAMILLE_A_DETERMINER,
          marque: "TPA2",
          reference: fr["tpa2.e2e.modele_a_determiner"],
        },
        {
          id: MODELE_NON_SOUMIS,
          societe_id: societeId,
          famille_id: FAMILLE_NON_SOUMISE,
          marque: "TPA2",
          reference: fr["tpa2.e2e.modele_non_soumis"],
        },
        {
          id: MODELE_DEPASSEE,
          societe_id: societeId,
          famille_id: FAMILLE_DEPASSEE,
          marque: "TPA2",
          reference: fr["tpa2.e2e.modele_depassee"],
        },
      ],
    });

    await client.machine.createMany({
      data: [
        ...MACHINES_SOUMISES.map((id, index) => ({
          id,
          societe_id: societeId,
          modele_id: MODELE_SOUMIS,
          client_id: CLIENT_TPA2,
          site_id: SITE_PAGINATION,
          numero_serie: numeroSoumise(index),
          qr_token: engendrerJetonQr(),
        })),
        {
          id: MACHINE_A_DETERMINER,
          societe_id: societeId,
          modele_id: MODELE_A_DETERMINER,
          client_id: CLIENT_TPA2,
          site_id: SITE_PAGINATION,
          numero_serie: SN_A_DETERMINER,
          qr_token: engendrerJetonQr(),
        },
        {
          id: MACHINE_NON_SOUMISE,
          societe_id: societeId,
          modele_id: MODELE_NON_SOUMIS,
          client_id: CLIENT_TPA2,
          site_id: SITE_PAGINATION,
          numero_serie: SN_NON_SOUMISE,
          qr_token: engendrerJetonQr(),
        },
        {
          id: MACHINE_DEPASSEE,
          societe_id: societeId,
          modele_id: MODELE_DEPASSEE,
          client_id: CLIENT_TPA2,
          site_id: SITE_DEPASSEE,
          numero_serie: SN_DEPASSEE,
          qr_token: engendrerJetonQr(),
        },
      ],
    });

    // LA MACHINE DU SECOND SITE, VÉRIFIÉE IL Y A TROIS MOIS SOUS UNE
    // PÉRIODICITÉ D'UN MOIS — largement au-delà d'une périodicité, donc
    // dépassée sans ambiguïté de fuseau.
    const echeanceDepassee = new Date();
    echeanceDepassee.setUTCMonth(echeanceDepassee.getUTCMonth() - 3);
    await client.vgpVerification.create({
      data: {
        id: VERIFICATION_DEPASSEE,
        societe_id: societeId,
        machine_id: MACHINE_DEPASSEE,
        date_verification: echeanceDepassee,
        organisme: "Organisme d'épreuve TP-A2",
        origine: "rapport_organisme",
      },
    });
    // Les 51 machines soumises, la « à déterminer » et la « non soumise »
    // n'ont AUCUNE ligne `vgpVerification` : c'est exactement ce que ce lot
    // éprouve — 51 sans information, deux hors registre.
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.vgpVerification.deleteMany({
      where: { id: VERIFICATION_DEPASSEE },
    });
    await client.machine.deleteMany({
      where: { id: { in: TOUS_LES_IDS_MACHINE } },
    });
    await client.modeleMateriel.deleteMany({
      where: {
        id: {
          in: [
            MODELE_SOUMIS,
            MODELE_A_DETERMINER,
            MODELE_NON_SOUMIS,
            MODELE_DEPASSEE,
          ],
        },
      },
    });
    await client.familleMateriel.deleteMany({
      where: {
        id: {
          in: [
            FAMILLE_SOUMISE,
            FAMILLE_A_DETERMINER,
            FAMILLE_NON_SOUMISE,
            FAMILLE_DEPASSEE,
          ],
        },
      },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_PAGINATION, SITE_DEPASSEE] } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_TPA2 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le registre compte et pagine — 53 machines, deux pages, « TPA2- » les retrouve toutes", async ({
  page,
}) => {
  await page.goto(`/vgp?q=${encodeURIComponent("TPA2-")}`);

  const TOTAL = NOMBRE_SOUMISES + 2;
  await expect(
    page.getByText(decompte(TOTAL, fr["parc.total_un"], fr["parc.total"]), {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(libellePage(1, 2), { exact: true }),
  ).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(50);

  // LA MACHINE DU SECOND SITE N'Y EST PAS : son numéro et son modèle évitent
  // délibérément la sous-chaîne « TPA2- ».
  await expect(page.getByText(SN_DEPASSEE)).toHaveCount(0);

  await page.getByRole("link", { name: fr["pagination.suivant"] }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("table tbody tr")).toHaveCount(3);
  await expect(
    page.getByText(libellePage(2, 2), { exact: true }),
  ).toBeVisible();
});

test("le filtre « sans information » retrouve les 51 soumises, ni l'à-déterminer ni la non-soumise", async ({
  page,
}) => {
  await page.goto(
    `/vgp?etat=sans_information&q=${encodeURIComponent("TPA2-")}`,
  );
  await expect(
    page.getByText(fr["vgp.filtre_sans_information_actif"], { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      decompte(NOMBRE_SOUMISES, fr["parc.total_un"], fr["parc.total"]),
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(SN_A_DETERMINER)).toHaveCount(0);
  await expect(page.getByText(SN_NON_SOUMISE)).toHaveCount(0);

  // LA TUILE « SANS INFORMATION » MÈNE AU MÊME FILTRE.
  await page.goto(`/vgp?q=${encodeURIComponent("TPA2-")}`);
  const tuile = page.locator('[data-bloc="kpi-sans-information"]');
  await expect(tuile).toBeVisible();
  await tuile.getByRole("link").click();
  await expect(page).toHaveURL(/etat=sans_information/);
});

test("« Enregistrer » selon le régime — proposé avec avertissement pour « à déterminer », masqué pour « non soumise »", async ({
  page,
}) => {
  await page.goto(`/vgp?q=${encodeURIComponent("TPA2-")}`);

  const ligneADeterminer = page.locator("tr", { hasText: SN_A_DETERMINER });
  await expect(
    ligneADeterminer.getByRole("link", { name: fr["vgp.action_enregistrer"] }),
  ).toBeVisible();
  await expect(
    ligneADeterminer.getByText(fr["vgp.enregistrer_a_determiner"]),
  ).toBeVisible();

  const ligneNonSoumise = page.locator("tr", { hasText: SN_NON_SOUMISE });
  await expect(
    ligneNonSoumise.getByRole("link", { name: fr["vgp.action_enregistrer"] }),
  ).toHaveCount(0);
});

test("la date de vérification future est refusée, côté formulaire ET côté serveur", async ({
  page,
}) => {
  const aujourdHui = dateCivileDuJour();

  await page.goto(`/vgp/enregistrer/${MACHINE_A_DETERMINER}`);
  await expect(page.locator('input[name="date_verification"]')).toHaveAttribute(
    "max",
    aujourdHui,
  );

  // UN POST DIRECT — le navigateur bloquerait le formulaire à cause de
  // `max`, mais rien n'empêche un client de l'ignorer : la route doit juger
  // la même règle.
  const demain = dansNJours(aujourdHui, 2);
  const client = admin();
  let avant: number;
  try {
    avant = await client.vgpVerification.count({
      where: { machine_id: MACHINE_A_DETERMINER },
    });
  } finally {
    await client.$disconnect();
  }

  const reponse = await page.request.post(
    `/api/vgp/enregistrer/${MACHINE_A_DETERMINER}`,
    {
      form: {
        date_verification: demain,
        organisme: "Organisme d'épreuve TP-A2",
        origine: "rapport_organisme",
      },
      maxRedirects: 0,
    },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "motif=vgp.verifier.refus.date_future",
  );

  const clientApres = admin();
  try {
    const apres = await clientApres.vgpVerification.count({
      where: { machine_id: MACHINE_A_DETERMINER },
    });
    expect(apres).toBe(avant);
  } finally {
    await clientApres.$disconnect();
  }

  await page.goto((reponse.headers()["location"] ?? "") as string);
  await expect(
    page.getByText(fr["vgp.verifier.refus.date_future"]),
  ).toBeVisible();
});

test("la fiche du site en retard porte le badge « Échéance dépassée » ; le site à 51 machines dit « sans information »", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_DEPASSEE}`);
  const synthese = page.locator('[data-compteur="vgp-prochaine"]');
  await expect(
    synthese.getByText(fr["vgp.information.recue_echeance_depassee"]),
  ).toBeVisible();

  await page.goto(`/sites/${SITE_PAGINATION}`);
  const syntheseSansInfo = page.locator('[data-compteur="vgp-prochaine"]');
  await expect(
    syntheseSansInfo.getByText(
      `${NOMBRE_SOUMISES} ${fr["sites.fiche.synthese.vgp_sans_information"]}`,
      { exact: true },
    ),
  ).toBeVisible();
});
