import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  instantAMinutes,
  jourSuivant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import {
  cleDeJour,
  jourDeLaScene,
  MARDI,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA SUITE DE LA FRISE DU PLANNING — décisions d'Alexis du 30/09/2026,
 * points 3 à 5 (D147) : le libellé « Heure à fixer », le dépôt d'une carte de
 * la file pré-remplissant technicien/date/heure, et les cartes « Heure à
 * fixer » glissables directement sur la frise.
 *
 * **UN JOUR TRÈS ÉLOIGNÉ, POUR ÉVITER TOUTE COLLISION** — `OFFSET_SEMAINES`
 * ci-dessous choisit un mardi à `OFFSET_SEMAINES * 7` jours, hors de portée
 * du semis (qui pose ses démonstrations relativement à AUJOURD'HUI —
 * `planning-jour-frise.spec.ts`) et hors des décalages déjà pris par les
 * autres fichiers de `tests/e2e/` (grep `jourSuivant(` : 21, 35, 49, 63, 70,
 * 77, 84, 91, 92, 98, 99, 126, 161).
 *
 * SA PROPRE SCÈNE (I9), préfixée `PGD1B-`, créée et retirée par ce fichier
 * seul — jamais une fixture `SCENE.*` partagée, jamais une ligne de semis.
 */

test.describe.configure({ mode: "serial" });

const OFFSET_SEMAINES = 420;
/** Même délai que `planning-jour-frise.spec.ts` (PG-B5, QG-6) — voir son docblock. */
const DELAI_DEPLACEMENT_MS = 10_500;

let reperes: ReperesDeScene;
let jour: JourLocal;
let jourCle: string;
let heureKone10 = 10 * 60;
let heureKone14 = 14 * 60;

type Lieu = { agenceId: string; siteId: string; clientId: string };

async function lieu(
  client: PrismaClient,
  societeId: string,
  codeAgence: "KONE" | "DUCOS",
): Promise<Lieu> {
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: societeId, code: codeAgence },
    select: { id: true },
  });
  const site = await client.site.findFirstOrThrow({
    where: { societe_id: societeId, agence_id: agence.id },
    select: { id: true, client_id: true },
    orderBy: { libelle: "asc" },
  });
  return { agenceId: agence.id, siteId: site.id, clientId: site.client_id };
}

/**
 * L'HEURE LIBRE, MESURÉE — jamais supposée. Cherche d'abord `preferee`, puis
 * s'écarte par pas de 30 minutes (dans les deux sens) si une intervention y
 * chevauche déjà pour ce technicien. Échoue bruyamment plutôt que de
 * continuer sur une hypothèse fausse si aucune heure proche n'est libre.
 */
async function heureLibre(
  technicienId: string,
  preferee: number,
): Promise<number> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    for (const decalage of [0, 30, -30, 60, -60, 90, -90, 120, -120]) {
      const minutes = preferee + decalage;
      const debut = instantAMinutes(jour, minutes, reperes.fuseau);
      const fin = instantAMinutes(jour, minutes + 60, reperes.fuseau);
      const conflit = await client.intervention.findFirst({
        where: {
          technicien_id: technicienId,
          statut: { notIn: ["annulee"] },
          creneau_debut: { lt: fin },
          creneau_fin: { gt: debut },
        },
        select: { id: true },
      });
      if (conflit === null) {
        return minutes;
      }
    }
    throw new Error(
      `Aucune heure libre trouvée autour de ${preferee} minutes pour ${technicienId} le ${cleDeJour(jour)}.`,
    );
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  jour = jourSuivant(jourDeLaScene(reperes, MARDI), OFFSET_SEMAINES);
  jourCle = cleDeJour(jour);

  // KONÉ OUVRE 07:30–11:30 ET 13:00–17:00 LE MARDI (`DEMO-KONE`,
  // `prisma/seed-data.ts`) : 10:00 et 14:00 sont TOUJOURS dans l'axe. Seule
  // leur DISPONIBILITÉ pour le technicien est mesurée, jamais supposée.
  heureKone10 = await heureLibre(reperes.technicienKone, 10 * 60);
  heureKone14 = await heureLibre(reperes.technicienKone, 14 * 60);
  if (heureKone10 !== 10 * 60 || heureKone14 !== 14 * 60) {
    console.warn(
      `planning-jour-suite : heure(s) de repli — Koné 10:00→${heureKone10}, 14:00→${heureKone14} (le ${jourCle}).`,
    );
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Une ligne « Heure à fixer » — `planifiee`, datée, SANS créneau. */
async function creerLigneSansHeure(
  codeAgence: "KONE" | "DUCOS",
  technicienId: string,
  dureeEstimeeMin: number,
): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const site = await lieu(client, reperes.societeId, codeAgence);
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: site.agenceId,
        client_id: site.clientId,
        site_id: site.siteId,
        technicien_id: technicienId,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: dureeEstimeeMin,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGD1B- ligne sans heure",
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

/** Une carte « À planifier » — sans technicien ni durée. */
async function creerCarteDeLaFile(
  codeAgence: "KONE" | "DUCOS",
): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const site = await lieu(client, reperes.societeId, codeAgence);
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: site.agenceId,
        client_id: site.clientId,
        site_id: site.siteId,
        technicien_id: null,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "a_planifier",
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGD1B- carte de la file",
      },
    });
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

async function declarerAbsence(technicienId: string): Promise<string> {
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

type LigneBase = {
  readonly statut: string;
  readonly technicien_id: string | null;
  readonly creneau_debut: Date | null;
  readonly creneau_fin: Date | null;
  readonly duree_estimee_min: number | null;
};

async function relire(id: string): Promise<LigneBase> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    return await client.intervention.findUniqueOrThrow({
      where: { id },
      select: {
        statut: true,
        technicien_id: true,
        creneau_debut: true,
        creneau_fin: true,
        duree_estimee_min: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
}

function caseDHeure(
  page: Page,
  technicienId: string,
  minutes: number,
): Locator {
  return page.locator(
    `[data-depot-heure="${minutes}"][data-depot-technicien="${technicienId}"]`,
  );
}

function bloc(page: Page, id: string): Locator {
  return page.locator(`[data-bloc="${id}"]`);
}

async function allerAuJour(page: Page): Promise<void> {
  await page.goto(`/planning?vue=jour&jour=${jourCle}`);
}

/* ── 1. LE LIBELLÉ « HEURE À FIXER » (point 3) ───────────────────────────── */

test("la ligne sans heure dit « Heure à fixer », et la carte y est glissable", async ({
  page,
}) => {
  const id = await creerLigneSansHeure("KONE", reperes.technicienKone, 60);
  try {
    await allerAuJour(page);

    const ligneSansHeure = page.locator(
      '[data-maquette-bloc="ligne-jour-sans-heure"]',
    );
    await expect(ligneSansHeure).toBeVisible();
    await expect(ligneSansHeure).toContainText(fr["planning.jour_sans_heure"]);

    const carte = ligneSansHeure.locator(`[data-bloc="${id}"]`);
    await expect(carte).toBeVisible();
    await expect(
      carte.locator(`[data-tiroir-declencheur="${id}"]`),
    ).toBeVisible();
  } finally {
    await retirerIntervention(id);
  }
});

/* ── 2. LE DÉPÔT D'UNE CARTE DE LA FILE, PRÉ-REMPLI (point 4) ────────────── */

test("le dépôt d'une carte de la file sur une case d'heure pré-remplit technicien, date ET heure", async ({
  page,
}) => {
  const id = await creerCarteDeLaFile("KONE");
  try {
    await allerAuJour(page);

    let posteVersDeplacer = false;
    page.on("request", (requete) => {
      if (requete.method() === "POST" && requete.url().includes("/deplacer")) {
        posteVersDeplacer = true;
      }
    });

    const source = bloc(page, id);
    const cible = caseDHeure(page, reperes.technicienKone, heureKone10);
    await expect(source).toBeVisible();
    await expect(cible).toBeVisible();

    await glisser(page, source, cible);

    const fenetre = page.locator(`[data-fenetre-pose="${id}"]`);
    await expect(fenetre).toBeVisible();
    await expect(fenetre).toHaveAttribute("data-jour", jourCle);
    await expect(fenetre).toHaveAttribute(
      "data-technicien",
      reperes.technicienKone,
    );
    await expect(fenetre).toHaveAttribute("data-heure", String(heureKone10));
    expect(posteVersDeplacer).toBe(false);

    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
      .click();

    // LA DURÉE VIENT D'ÊTRE CHOISIE — L'HEURE DE LA CASE SURVIT (D147) : le
    // champ « Autre heure », devenu visible avec la durée, la montre déjà.
    await expect(fenetre).toHaveAttribute("data-heure", String(heureKone10));
    const heureAutre = fenetre.locator('input[type="time"]');
    const heureAttendue = `${String(Math.floor(heureKone10 / 60)).padStart(2, "0")}:${String(heureKone10 % 60).padStart(2, "0")}`;
    await expect(heureAutre).toHaveValue(heureAttendue);
    expect(posteVersDeplacer).toBe(false);

    const boutonPlanifier = fenetre.getByRole("button", {
      name: fr["planning.pose.confirmer"],
      exact: true,
    });
    await expect(boutonPlanifier).toBeEnabled();

    const reponseDeplacer = page.waitForResponse(
      (reponse) =>
        reponse.url().includes("/deplacer") &&
        reponse.request().method() === "POST",
    );
    await boutonPlanifier.click();
    const reponse = await reponseDeplacer;
    expect(reponse.ok()).toBe(true);
    await page.waitForLoadState("load");

    const apres = await relire(id);
    expect(apres.statut).toBe("planifiee");
    expect(apres.technicien_id).toBe(reperes.technicienKone);
    expect(apres.duree_estimee_min).toBe(60);
    expect(apres.creneau_debut).not.toBeNull();
    expect(apres.creneau_fin).not.toBeNull();
    expect(apres.creneau_debut?.getTime()).toBe(
      instantAMinutes(jour, heureKone10, reperes.fuseau).getTime(),
    );
    expect(apres.creneau_fin?.getTime()).toBe(
      instantAMinutes(jour, heureKone10 + 60, reperes.fuseau).getTime(),
    );
  } finally {
    await retirerIntervention(id);
  }
});

/* ── 3. UNE CARTE « HEURE À FIXER » GLISSÉE SUR SA PROPRE LIGNE (point 5) ── */

test("une carte « Heure à fixer », avec sa durée déjà connue, se dépose DIRECTEMENT sur une heure de sa ligne", async ({
  page,
}) => {
  const id = await creerLigneSansHeure("KONE", reperes.technicienKone, 60);
  try {
    await allerAuJour(page);

    const source = bloc(page, id);
    const cible = caseDHeure(page, reperes.technicienKone, heureKone14);
    await expect(source).toBeVisible();
    await expect(cible).toBeVisible();

    await glisser(page, source, cible);

    // AUCUNE FENÊTRE : LA DURÉE EST CONNUE (D147, `glisseDeLaCarteSansHeure`)
    // — c'est un déplacement direct, DIFFÉRÉ comme tout déplacement direct
    // (PG-B5, QG-6).
    await expect(page.locator(`[data-fenetre-pose="${id}"]`)).toHaveCount(0);
    await page.waitForTimeout(DELAI_DEPLACEMENT_MS);

    const apres = await relire(id);
    expect(apres.statut).toBe("planifiee");
    expect(apres.technicien_id).toBe(reperes.technicienKone);
    expect(apres.duree_estimee_min).toBe(60);
    expect(apres.creneau_debut?.getTime()).toBe(
      instantAMinutes(jour, heureKone14, reperes.fuseau).getTime(),
    );
    expect(apres.creneau_fin?.getTime()).toBe(
      instantAMinutes(jour, heureKone14 + 60, reperes.fuseau).getTime(),
    );

    await allerAuJour(page);
    await expect(
      caseDHeure(page, reperes.technicienKone, heureKone14).locator(
        `div:has(> [data-bloc="${id}"])`,
      ),
    ).toHaveAttribute("data-fin-heure", String(heureKone14 + 60));
    // LA CARTE A QUITTÉ LA SECTION « HEURE À FIXER » — elle porte désormais
    // un créneau, `ColonneDeJournee.sansHeure` ne la contient plus.
    await expect(
      page.locator(
        `[data-maquette-bloc="ligne-jour-sans-heure"] [data-bloc="${id}"]`,
      ),
    ).toHaveCount(0);
  } finally {
    await retirerIntervention(id);
  }
});

/* ── 4. LA MÊME CARTE, GLISSÉE SUR UN TECHNICIEN ABSENT — REFUSÉE ────────── */

test("une carte « Heure à fixer » glissée sur un technicien absent : le motif s'affiche, la base ne bouge pas", async ({
  page,
}) => {
  const id = await creerLigneSansHeure("KONE", reperes.technicienKone, 60);
  const absenceId = await declarerAbsence(reperes.technicienDucos);
  try {
    await allerAuJour(page);

    // LA LIGNE DE DUCOS EST BIEN AFFICHÉE CE JOUR-LÀ (calendrier `DEMO-NOUMEA`,
    // ouvert le mardi) — l'absence ne retire pas la ligne, elle bloque le dépôt.
    const caseDucos = caseDHeure(page, reperes.technicienDucos, heureKone10);
    await expect(caseDucos).toBeVisible();

    const source = bloc(page, id);
    await expect(source).toBeVisible();

    await glisser(page, source, caseDucos);

    await page.waitForTimeout(DELAI_DEPLACEMENT_MS);

    const refus = page.locator('[data-refus="intervention.refus.absence"]');
    await expect(refus).toBeVisible();
    await expect(refus).toContainText(fr["intervention.refus.absence"]);

    const apres = await relire(id);
    expect(apres.creneau_debut).toBeNull();
    expect(apres.technicien_id).toBe(reperes.technicienKone);
  } finally {
    await retirerAbsence(absenceId);
    await retirerIntervention(id);
  }
});
