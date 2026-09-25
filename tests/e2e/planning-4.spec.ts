import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import {
  cleJour,
  dateCivile,
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 66-PLANNING-4 — « PLANIFIER » ET « DÉPLACER » DISENT QU'UN TECHNICIEN EST
 * ABSENT À LA DATE CHOISIE, AVANT L'ENVOI (SAV-05).
 *
 * « Affecter » marquait déjà les techniciens bloqués, parce que sa date —
 * `ligne.date_planifiee` — est connue au rendu serveur. « Planifier » et
 * « Déplacer » saisissent la date DANS le même formulaire : leur sélecteur
 * technicien restait nu, et RG-PLA-06 ne refusait qu'APRÈS l'envoi. Ce
 * fichier éprouve que `DisponibiliteTechnicien` (composant client local à
 * `app/(back-office)/interventions/[id]/`) recalcule le libellé de l'option
 * AU CHANGEMENT du champ date, sur ces deux formulaires.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `PL4-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien FORGÉ, un client et un site à soi, deux interventions — l'une
 * `a_planifier` (le bloc « Planifier »), l'autre `planifiee` (le bloc
 * « Déplacer », à côté d'« Affecter ») — et un blocage d'agenda sur UNE seule
 * journée. Les identifiants sont engendrés par `uuidv7()`, jamais écrits en
 * dur (I10, même geste que `absences-3.spec.ts`).
 *
 * **Les deux journées visées sont calculées depuis AUJOURD'HUI, dans le
 * fuseau de la SOCIÉTÉ** — jamais `CURRENT_DATE`, la leçon du lot 54 — et
 * choisies à dix et onze jours, loin de toute fenêtre qu'un autre fichier
 * pourrait mesurer sous `fullyParallel` (même piège que
 * `blocage-agenda-visible.spec.ts`).
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";

let utilisateurPl4 = "";
let utilisateurSocietePl4 = "";
let technicienPl4 = "";
let clientPl4 = "";
let sitePl4 = "";
let interventionAPlanifier = "";
let interventionADeplacer = "";
let absencePl4 = "";

let jourBloque: JourLocal;
let jourLibre: JourLocal;

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurPl4 === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.absence.deleteMany({ where: { id: absencePl4 } });
    await client.intervention.deleteMany({
      where: { id: { in: [interventionAPlanifier, interventionADeplacer] } },
    });
    await client.site.deleteMany({ where: { id: sitePl4 } });
    await client.client.deleteMany({ where: { id: clientPl4 } });
    await client.technicien.deleteMany({ where: { id: technicienPl4 } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocietePl4 },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurPl4 } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurPl4 = uuidv7();
  utilisateurSocietePl4 = uuidv7();
  technicienPl4 = uuidv7();
  clientPl4 = uuidv7();
  sitePl4 = uuidv7();
  interventionAPlanifier = uuidv7();
  interventionADeplacer = uuidv7();
  absencePl4 = uuidv7();

  const client = await nouveauClientAdministration();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true, fuseau_horaire: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    const aujourdhui = jourDe(maintenant(societe.fuseau_horaire).local);
    // DIX ET ONZE JOURS — dans la fenêtre de 90 jours
    // (`JOURS_DISPONIBILITE_TECHNICIEN`, `interventions/[id]/page.tsx`), loin
    // du semis et de toute autre scène du dépôt.
    jourBloque = jourSuivant(aujourdhui, 10);
    jourLibre = jourSuivant(aujourdhui, 11);

    await client.utilisateur.create({
      data: {
        id: utilisateurPl4,
        nom: "Technicien PL4- (épreuve PLANNING-4)",
        email: "pl4-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocietePl4,
        utilisateur_id: utilisateurPl4,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienPl4,
        societe_id: societe.id,
        utilisateur_id: utilisateurPl4,
        agence_id: agence.id,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: clientPl4,
        societe_id: societe.id,
        raison_sociale: "Client PL4- (épreuve PLANNING-4)",
      },
    });
    await client.site.create({
      data: {
        id: sitePl4,
        societe_id: societe.id,
        client_id: clientPl4,
        agence_id: agence.id,
        libelle: "Lieu PL4- (épreuve PLANNING-4)",
        temps_trajet_min: 10,
      },
    });

    const base = {
      societe_id: societe.id,
      agence_id: agence.id,
      client_id: clientPl4,
      site_id: sitePl4,
      type: "curatif" as const,
      priorite: "p3" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
    };

    // SANS DATE ET SANS TECHNICIEN (constat du ticket) : c'est ce couple qui
    // fait rendre le bloc « Planifier », unique sur cette fiche.
    await client.intervention.create({
      data: {
        id: interventionAPlanifier,
        ...base,
        statut: "a_planifier",
      },
    });
    // DÉJÀ DATÉE, SANS TECHNICIEN : rend « Affecter » ET « Déplacer », côte à
    // côte — la date qu'elle porte n'a aucune incidence sur ce que ce fichier
    // éprouve, « Déplacer » saisissant la sienne dans le même formulaire.
    await client.intervention.create({
      data: {
        id: interventionADeplacer,
        ...base,
        statut: "planifiee",
        date_planifiee: instantDuJour(jourSuivant(aujourdhui, 5)),
      },
    });

    await client.absence.create({
      data: {
        id: absencePl4,
        societe_id: societe.id,
        utilisateur_id: utilisateurPl4,
        du: instantDuJour(jourBloque),
        au: instantDuJour(jourBloque),
      },
    });

    const enBase = await client.intervention.count({
      where: { id: { in: [interventionAPlanifier, interventionADeplacer] } },
    });
    expect(enBase).toBe(2);
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/66-PLANNING-4/captures",
);

test("« Planifier » dit l'agenda bloqué du technicien avant l'envoi", async ({
  page,
}) => {
  await page.goto(`/interventions/${interventionAPlanifier}`);
  await page.waitForLoadState("networkidle");

  // UN SEUL sélecteur technicien sur cette fiche : le bloc « Planifier »
  // remplace « Affecter » et « Déplacer » tant que le statut est
  // `a_planifier`.
  const selectTechnicien = page.locator('select[name="technicien_id"]');
  await expect(selectTechnicien).toHaveCount(1);
  const optionTechnicien = selectTechnicien.locator(
    `option[value="${utilisateurPl4}"]`,
  );
  const libelleInitial = (await optionTechnicien.textContent())?.trim();
  expect(libelleInitial).toBeTruthy();
  await expect(optionTechnicien).not.toHaveAttribute("data-agenda-bloque", "");

  const champDate = page.locator('input[name="date_planifiee"]');
  await expect(champDate).toHaveCount(1);

  // LA DATE BLOQUÉE, AVANT TOUT ENVOI — le libellé le dit dès le changement
  // de champ, sans qu'aucun formulaire n'ait été soumis.
  await champDate.fill(cleJour(jourBloque));
  await expect(optionTechnicien).toHaveAttribute("data-agenda-bloque", "");
  // Le séparateur entre le nom et le suffixe n'est pas du dictionnaire
  // (`disponibilite-technicien.tsx` le compose) : cette regex n'ancre que la
  // fin, comme `blocage-agenda-visible.spec.ts` le fait déjà pour « Affecter ».
  await expect(optionTechnicien).toHaveText(
    new RegExp(
      `${fr["intervention.technicien_agenda_bloque_le"]} ${dateCivile(instantDuJour(jourBloque))}$`,
    ),
  );
  // La note qui borne l'affirmation à 90 jours est visible sous le champ.
  await expect(
    page.getByText(fr["intervention.disponibilite_technicien.fenetre"]),
  ).toBeVisible();

  // LA CAPTURE MONTRE LA MENTION, PAS SEULEMENT SA PRÉSENCE DANS LE DOM —
  // le sélecteur choisit ce technicien pour que son libellé, suffixé, soit
  // ce qu'un œil lit sur le champ fermé.
  await selectTechnicien.selectOption(utilisateurPl4);
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "planifier-agenda-bloque-1280.png"),
    fullPage: true,
  });

  // UNE AUTRE DATE, SANS BLOCAGE — la mention disparaît, le témoin qui dit
  // que la page ne marque pas tout.
  await champDate.fill(cleJour(jourLibre));
  await expect(optionTechnicien).not.toHaveAttribute("data-agenda-bloque", "");
  await expect(optionTechnicien).toHaveText(libelleInitial ?? "");
});

test("« Déplacer » dit l'agenda bloqué du technicien avant l'envoi", async ({
  page,
}) => {
  await page.goto(`/interventions/${interventionADeplacer}`);
  await page.waitForLoadState("networkidle");

  // « Déplacer » n'est l'action PRINCIPALE d'aucun statut
  // (93-FICHE-ACTIONS, constat 19) : replié dans un `<details>`, son
  // `<summary>` s'ouvre avant que ses champs ne deviennent visibles.
  await page
    .locator("details", {
      has: page.locator("summary", {
        hasText: fr["intervention.action.deplacer"],
      }),
    })
    .locator("summary")
    .click();

  // « Affecter » est le premier sélecteur, « Déplacer » le second — même
  // convention que `blocage-agenda-visible.spec.ts`.
  const selectTechnicien = page.locator('select[name="technicien_id"]').nth(1);
  const optionTechnicien = selectTechnicien.locator(
    `option[value="${utilisateurPl4}"]`,
  );
  const libelleInitial = (await optionTechnicien.textContent())?.trim();
  expect(libelleInitial).toBeTruthy();
  await expect(optionTechnicien).not.toHaveAttribute("data-agenda-bloque", "");

  // Un seul champ `date_planifiee` sur cette fiche : « Affecter » n'en porte
  // pas.
  const champDate = page.locator('input[name="date_planifiee"]');
  await expect(champDate).toHaveCount(1);

  await champDate.fill(cleJour(jourBloque));
  await expect(optionTechnicien).toHaveAttribute("data-agenda-bloque", "");
  await expect(optionTechnicien).toHaveText(
    new RegExp(
      `${fr["intervention.technicien_agenda_bloque_le"]} ${dateCivile(instantDuJour(jourBloque))}$`,
    ),
  );

  await champDate.fill(cleJour(jourLibre));
  await expect(optionTechnicien).not.toHaveAttribute("data-agenda-bloque", "");
  await expect(optionTechnicien).toHaveText(libelleInitial ?? "");
});
