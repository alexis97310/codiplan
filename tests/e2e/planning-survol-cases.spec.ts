import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MERCREDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE SURVOL D'UNE CASE D'ABSENCE (PG-B4-SURVOL-CASES, §3.11) — pendant un
 * glisser, AVANT tout dépôt, la case teinte en refus et affiche « Absent ».
 *
 * *Sa propre scène, préfixée `PGB4-`* : une intervention « À planifier » et
 * une absence, toutes deux forgées par ce test et retirées en fin de test —
 * jamais une fixture `SCENE.*` partagée (même raison que
 * `planning-fenetre-pose.spec.ts`).
 *
 * **Le glissé s'ARRÊTE avant le dépôt** — `mouse.up` a lieu HORS de toute
 * case (`page.mouse.up` après un déplacement vers un point neutre), pour
 * observer le survol sans jamais écrire : cette fonction est un INDICE, elle
 * ne remplace pas le serveur (voir `lib/interventions/survol.ts`).
 */

async function creerInterventionAPlanifier(
  reperes: ReperesDeScene,
): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "KONE" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p3',
               'a_planifier', NULL, NULL, NULL, 60, 'temps_passe', 'XPF', now())`,
      id,
      reperes.societeId,
      agence.id,
      site.client_id,
      site.id,
    );
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerIntervention(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

async function declarerAbsence(
  reperes: ReperesDeScene,
  technicienId: string,
  jour: { annee: number; mois: number; jour: number },
): Promise<string> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const date = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
    const absence = await client.absence.create({
      data: {
        societe_id: reperes.societeId,
        utilisateur_id: technicienId,
        du: date,
        au: date,
      },
      select: { id: true },
    });
    return absence.id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerAbsence(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.absence.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test("survoler la case d'un technicien absent la teinte en refus et affiche « Absent », sans rien écrire", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const jour = jourDeLaScene(reperes, MERCREDI);
  const jourCle = cleDeJour(jour);
  const interventionId = await creerInterventionAPlanifier(reperes);
  const absenceId = await declarerAbsence(
    reperes,
    reperes.technicienKone,
    jour,
  );

  try {
    let posteVersDeplacer = false;
    page.on("request", (requete) => {
      if (requete.method() === "POST" && requete.url().includes("/deplacer")) {
        posteVersDeplacer = true;
      }
    });

    await ouvrirUneSession(page);
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    const source = page.locator(`[data-bloc="${interventionId}"]`);
    const cible = page.locator(
      `[data-depot-jour="${jourCle}"][data-depot-technicien="${reperes.technicienKone}"]`,
    );
    await expect(source).toBeVisible();
    await expect(cible).toBeVisible();

    const depart = await source.boundingBox();
    const arrivee = await cible.boundingBox();
    if (depart === null || arrivee === null) {
      throw new Error("source ou cible sans boîte visible");
    }

    // UN GLISSÉ QUI NE SE DÉPOSE JAMAIS — les mouvements intermédiaires ne
    // sont pas une précaution : Chromium n'engage un glissé HTML5 natif
    // qu'après un déplacement franchissant son seuil (même mesure que
    // `tests/e2e/setup/glisser.ts`).
    await page.mouse.move(
      depart.x + depart.width / 2,
      depart.y + depart.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      arrivee.x + arrivee.width / 2,
      arrivee.y + arrivee.height / 2,
      { steps: 20 },
    );

    await expect(cible).toHaveAttribute("data-survol", "absent");
    await expect(cible.getByText(fr["planning.survol.absent"])).toBeVisible();
    await expect(
      page.locator('[aria-live="polite"]', {
        hasText: fr["planning.survol.absent"],
      }),
    ).toBeAttached();

    // FIN DU GLISSÉ HORS DE TOUTE CASE — `mouse.up` sur un point neutre
    // n'engage aucun dépôt : cette fonction est un indice, jamais une
    // décision (voir l'entête).
    await page.mouse.move(20, 20, { steps: 5 });
    await page.mouse.up();

    expect(posteVersDeplacer).toBe(false);
  } finally {
    await retirerAbsence(absenceId);
    await retirerIntervention(interventionId);
  }
});
