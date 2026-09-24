import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { instantDuJour, jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 53-PLANNING-3 — SAV-05 : LA CHARGE INCOMPLÈTE NE SE LIT PLUS COMME UN TAUX.
 *
 * ## Le défaut mesuré (voir la passation du ticket)
 *
 * `app/(back-office)/planning/statistiques.tsx` affichait « Taux 0 % » dès
 * que le calendrier de l'agence était connu, MÊME quand les interventions du
 * technicien n'avaient aucune durée saisie — un chiffre juste (0 minute sur
 * un dénominateur non nul fait bien 0 %) qui fait conclure faux (un
 * technicien débordé, mal saisi, paraît libre).
 *
 * ## Une scène ENTIÈREMENT FORGÉE, prefixée « PL3- »
 *
 * *Piège connu de ce lot* : une épreuve qui compte tout un technicien réel du
 * semis (`guerin@codima.test`, `poigoune@codima.test`) additionnerait ses
 * propres interventions à celles que d'autres fichiers e2e posent sous
 * `fullyParallel` sur le MÊME jour — la ligne cesserait de ne porter QUE ce
 * que cette épreuve a écrit. Ce fichier forge donc son PROPRE technicien
 * (`Utilisateur` + `UtilisateurSociete` + `Technicien`, aucun des trois issu
 * du semis) et sa propre intervention, à un jour hors de portée de toute
 * autre scène (MARDI + 91 jours — cinq multiples de 7 au-delà du plus grand
 * décalage déjà pris par un autre fichier), puis les efface tous les deux à
 * la fin.
 *
 * ## Le statut choisi, et pourquoi
 *
 * `planifiee`/`affectee` exigent une durée prévue depuis PARCOURS-1
 * (`intervention_planifiee_a_sa_duree`) : une intervention SANS durée ne peut
 * pas porter l'un de ces deux statuts. `en_cours` en est libre — c'est aussi
 * le cas réel visé par SAV-05, un technicien qui a commencé et dont la durée
 * n'est pas encore saisie.
 *
 * ## SÉRIE (STABILITE-2, 25/09/2026)
 *
 * `beforeAll` fait un `deleteMany` puis un `create` sur `INTERVENTION_ID`,
 * un identifiant fixe : sous `fullyParallel` sans
 * `test.describe.configure({ mode: "serial" })`, deux workers rejoueraient
 * ce `beforeAll` en même temps et se feraient la course sur la même ligne
 * (`tests/unit/e2e-mise-en-scene.test.ts`, même défaut que
 * `porte-capacites.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

const JOUR_SANS_COLLISION = () =>
  jourSuivant(jourDeLaScene(reperesGlobal, MARDI), 91);

let reperesGlobal: Awaited<ReturnType<typeof reperesDeLaScene>>;

const UTILISATEUR_ID = "01a3f000-0000-7000-8000-0000000000f1";
const UTILISATEUR_SOCIETE_ID = "01a3f000-0000-7000-8000-0000000000f2";
const TECHNICIEN_ID = "01a3f000-0000-7000-8000-0000000000f3";
const INTERVENTION_ID = "01a3f000-0000-7000-8000-0000000000f4";
const EMAIL_TECHNICIEN = "pl3-temoin@codima.test";
// Passe par le dictionnaire comme `equipe.e2e.nom` (L0-11) : cette scène
// n'est jamais vue par un utilisateur réel, mais la requête d'écran qui la
// cherche en est une comme une autre.
const NOM_TECHNICIEN = fr["planning.e2e.nom_technicien"];

test.beforeAll(async () => {
  reperesGlobal = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperesGlobal.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperesGlobal.societeId, agence_id: ducos.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });

    await client.utilisateur.upsert({
      where: { id: UTILISATEUR_ID },
      update: { nom: NOM_TECHNICIEN, actif: true },
      create: {
        id: UTILISATEUR_ID,
        nom: NOM_TECHNICIEN,
        email: EMAIL_TECHNICIEN,
        email_verifie: true,
        actif: true,
      },
    });
    await client.utilisateurSociete.upsert({
      where: { id: UTILISATEUR_SOCIETE_ID },
      update: {},
      create: {
        id: UTILISATEUR_SOCIETE_ID,
        utilisateur_id: UTILISATEUR_ID,
        societe_id: reperesGlobal.societeId,
        role: Role.technicien,
      },
    });
    await client.technicien.upsert({
      where: { id: TECHNICIEN_ID },
      update: { agence_id: ducos.id, actif: true },
      create: {
        id: TECHNICIEN_ID,
        societe_id: reperesGlobal.societeId,
        utilisateur_id: UTILISATEUR_ID,
        agence_id: ducos.id,
        actif: true,
      },
    });

    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperesGlobal.societeId,
        agence_id: ducos.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: UTILISATEUR_ID,
        type: "curatif",
        priorite: "p3",
        // `en_cours`, jamais `planifiee`/`affectee` : ces deux-là exigent une
        // durée prévue (`intervention_planifiee_a_sa_duree`, PARCOURS-1), et
        // c'est justement l'absence de durée que ce scénario éprouve.
        statut: "en_cours",
        date_planifiee: instantDuJour(JOUR_SANS_COLLISION()),
        duree_estimee_min: null,
        temps_valide_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
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
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.technicien.deleteMany({ where: { id: TECHNICIEN_ID } });
    await client.utilisateurSociete.deleteMany({
      where: { id: UTILISATEUR_SOCIETE_ID },
    });
    await client.utilisateur.deleteMany({ where: { id: UTILISATEUR_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("une charge sans durée dit « incomplète », jamais « 0 % »", async ({
  page,
}) => {
  await page.goto(
    `/planning?vue=jour&jour=${cleDeJour(JOUR_SANS_COLLISION())}`,
  );
  await expect(page.locator("main")).toBeVisible();

  // LA LIGNE DE CE TECHNICIEN, ET ELLE SEULE : la section « charge par
  // technicien » regroupe une ligne par (technicien, agence) — un nom qui
  // n'existe que dans cette scène ne peut désigner qu'elle.
  const ligne = page
    .locator("li", { has: page.getByText(NOM_TECHNICIEN, { exact: true }) })
    .first();
  await expect(ligne).toBeVisible();
  const texte = (await ligne.textContent()) ?? "";

  expect(texte).toContain("Charge incomplète");
  expect(texte).not.toContain("0 %");
  expect(texte).not.toContain("Taux");

  await capturer(page, "charge-incomplete");
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/60-PLANNING-3-REPRISE/captures",
);

/** Une seule largeur, 1280 px : la reprise ne re-photographie que le poste de travail. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}
