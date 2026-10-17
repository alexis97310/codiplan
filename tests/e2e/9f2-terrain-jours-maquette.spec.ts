import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";
import {
  cleJour,
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { avecSociete, avecSocieteEtRole } from "@/lib/db/rls";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
  ouvrirLeCompteDeLEpreuve,
} from "./setup/scene";

/**
 * 9F2-TERRAIN-JOURS-MAQUETTE (décision n° 92 d'Alexis, D210) — « MA JOURNÉE »
 * MONTRE EN RETARD, AUJOURD'HUI, DEMAIN, LES JOURS SUIVANTS ET SANS DATE.
 *
 * ## Ce que l'épreuve prouve, de bout en bout
 *
 * `tests/unit/interventions/journee-technicien.test.ts` éprouve la
 * répartition PURE, par jour civil. Il ne peut pas prouver que la PAGE RÉELLE
 * place une ligne en retard sous le bon titre, qu'une AFFECTÉE à J+9 reste
 * invisible (hors fenêtre) ou qu'une PLANIFIÉE de demain ne traverse jamais
 * le filtre D141 14C même sous la fenêtre étendue — c'est ce que ce fichier
 * joue, à travers l'écran.
 *
 * ## DEUX SCÈNES DISTINCTES, DEUX `describe`
 *
 * « remplie » forge ses propres lignes, préfixées `zz9F2-`, posées et retirées
 * par SES PROPRES crochets — jamais `SCENE.*` (I9).
 *
 * « vide » ne partage plus `COMPTE_TECHNICIEN_EPREUVE` (9F2B-TERRAIN-JOURS-
 * EPREUVES, point 2) : **mesuré** que même sans aucune ligne `zz9F2-`, le
 * seul semis de démonstration (`prisma/seed.ts`) pose déjà une ligne pour ce
 * technicien dans la fenêtre `[J+1, J+7]` — un `test.skip` qui se retirait
 * lui-même sur cette pollution ne s'EXÉCUTAIT donc jamais en pratique, et
 * `terrain.demain.vide`/`terrain.jours_suivants.vide_prefixe` n'étaient
 * exercées par aucune épreuve. « vide » ouvre désormais SON PROPRE technicien
 * (préfixe `zz9f2b-`, `beforeAll`/`afterAll`) : né sans la moindre
 * intervention, son état vide est un FAIT de construction, jamais une
 * mesure optimiste. `mode: "serial"` au niveau du fichier n'a plus besoin de
 * protéger cette scène de l'autre — il reste pour l'ordre de lecture.
 *
 * ## LES ASSERTIONS NE COMPTENT QUE CE QUI A ÉTÉ FORGÉ ICI
 *
 * Jamais un décompte total de cartes — toujours le libellé de site unique de
 * CETTE scène, ou l'ordre relatif des titres de section.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F2-TERRAIN-JOURS-MAQUETTE/captures",
);

/** Les deux largeurs demandées par le ticket, téléphone puis bureau. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

/** La hauteur du document ne dépasse jamais sa largeur visible, à 375 px. */
async function verifierAucunDebordement(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/terrain");
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe("« Ma journée » remplie — en retard, aujourd'hui, demain, les jours suivants", () => {
  const CLIENT_ID = uuidv7();
  const SITE_RETARD_ID = uuidv7();
  const SITE_AUJOURDHUI_ID = uuidv7();
  const SITE_DEMAIN_ID = uuidv7();
  const SITE_SUITE_ID = uuidv7();
  const SITE_HORS_FENETRE_ID = uuidv7();
  const SITE_PLANIFIEE_DEMAIN_ID = uuidv7();

  const INTERVENTION_RETARD_ID = uuidv7();
  const INTERVENTION_AUJOURDHUI_ID = uuidv7();
  const INTERVENTION_DEMAIN_ID = uuidv7();
  const INTERVENTION_SUITE_ID = uuidv7();
  const INTERVENTION_HORS_FENETRE_ID = uuidv7();
  const INTERVENTION_PLANIFIEE_DEMAIN_ID = uuidv7();

  const SITE_LIBELLE_RETARD = fr["terrain9f2.e2e.site_retard"];
  const SITE_LIBELLE_AUJOURDHUI = fr["terrain9f2.e2e.site_aujourdhui"];
  const SITE_LIBELLE_DEMAIN = fr["terrain9f2.e2e.site_demain"];
  const SITE_LIBELLE_SUITE = fr["terrain9f2.e2e.site_suite"];
  const SITE_LIBELLE_HORS_FENETRE = fr["terrain9f2.e2e.site_hors_fenetre"];
  const SITE_LIBELLE_PLANIFIEE_DEMAIN =
    fr["terrain9f2.e2e.site_planifiee_demain"];

  test.beforeAll(async () => {
    const reperes = await reperesDeLaScene();
    const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
    const hier = jourSuivant(aujourdHui, -1);
    const demain = jourSuivant(aujourdHui, 1);
    const jPlus4 = jourSuivant(aujourdHui, 4);
    const jPlus9 = jourSuivant(aujourdHui, 9);

    const creneauDe = (
      jour: ReturnType<typeof jourDe>,
    ): { readonly creneau_debut: Date; readonly creneau_fin: Date } => {
      const cle = cleJour(jour);
      return {
        creneau_debut: new Date(`${cle}T20:00:00.000Z`),
        creneau_fin: new Date(`${cle}T21:00:00.000Z`),
      };
    };

    const client = admin();
    try {
      const agence = await client.agence.findFirstOrThrow({
        where: { societe_id: reperes.societeId, code: "DUCOS" },
        select: { id: true },
      });

      await client.client.create({
        data: {
          id: CLIENT_ID,
          societe_id: reperes.societeId,
          raison_sociale: fr["terrain9f2.e2e.client"],
          actif: true,
        },
      });
      await client.site.createMany({
        data: [
          {
            id: SITE_RETARD_ID,
            societe_id: reperes.societeId,
            client_id: CLIENT_ID,
            agence_id: agence.id,
            libelle: SITE_LIBELLE_RETARD,
          },
          {
            id: SITE_AUJOURDHUI_ID,
            societe_id: reperes.societeId,
            client_id: CLIENT_ID,
            agence_id: agence.id,
            libelle: SITE_LIBELLE_AUJOURDHUI,
          },
          {
            id: SITE_DEMAIN_ID,
            societe_id: reperes.societeId,
            client_id: CLIENT_ID,
            agence_id: agence.id,
            libelle: SITE_LIBELLE_DEMAIN,
          },
          {
            id: SITE_SUITE_ID,
            societe_id: reperes.societeId,
            client_id: CLIENT_ID,
            agence_id: agence.id,
            libelle: SITE_LIBELLE_SUITE,
          },
          {
            id: SITE_HORS_FENETRE_ID,
            societe_id: reperes.societeId,
            client_id: CLIENT_ID,
            agence_id: agence.id,
            libelle: SITE_LIBELLE_HORS_FENETRE,
          },
          {
            id: SITE_PLANIFIEE_DEMAIN_ID,
            societe_id: reperes.societeId,
            client_id: CLIENT_ID,
            agence_id: agence.id,
            libelle: SITE_LIBELLE_PLANIFIEE_DEMAIN,
          },
        ],
      });

      const commun = {
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif" as const,
        priorite: "p3" as const,
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe" as const,
        devise_code: "XPF",
        description: "9F2 — intervention forgée par l'épreuve",
      };

      await client.intervention.create({
        data: {
          id: INTERVENTION_RETARD_ID,
          site_id: SITE_RETARD_ID,
          statut: "affectee",
          date_planifiee: instantDuJour(hier),
          ...creneauDe(hier),
          ...commun,
        },
      });
      await client.intervention.create({
        data: {
          id: INTERVENTION_AUJOURDHUI_ID,
          site_id: SITE_AUJOURDHUI_ID,
          statut: "affectee",
          date_planifiee: instantDuJour(aujourdHui),
          ...creneauDe(aujourdHui),
          ...commun,
        },
      });
      await client.intervention.create({
        data: {
          id: INTERVENTION_DEMAIN_ID,
          site_id: SITE_DEMAIN_ID,
          statut: "affectee",
          date_planifiee: instantDuJour(demain),
          ...creneauDe(demain),
          ...commun,
        },
      });
      await client.intervention.create({
        data: {
          id: INTERVENTION_SUITE_ID,
          site_id: SITE_SUITE_ID,
          statut: "affectee",
          date_planifiee: instantDuJour(jPlus4),
          ...creneauDe(jPlus4),
          ...commun,
        },
      });
      await client.intervention.create({
        data: {
          id: INTERVENTION_HORS_FENETRE_ID,
          site_id: SITE_HORS_FENETRE_ID,
          statut: "affectee",
          date_planifiee: instantDuJour(jPlus9),
          ...creneauDe(jPlus9),
          ...commun,
        },
      });
      await client.intervention.create({
        data: {
          id: INTERVENTION_PLANIFIEE_DEMAIN_ID,
          site_id: SITE_PLANIFIEE_DEMAIN_ID,
          statut: "planifiee",
          date_planifiee: instantDuJour(demain),
          ...creneauDe(demain),
          ...commun,
        },
      });
    } finally {
      await client.$disconnect();
    }
  });

  test.afterAll(async () => {
    const client = admin();
    try {
      await client.intervention.deleteMany({
        where: {
          id: {
            in: [
              INTERVENTION_RETARD_ID,
              INTERVENTION_AUJOURDHUI_ID,
              INTERVENTION_DEMAIN_ID,
              INTERVENTION_SUITE_ID,
              INTERVENTION_HORS_FENETRE_ID,
              INTERVENTION_PLANIFIEE_DEMAIN_ID,
            ],
          },
        },
      });
      await client.site.deleteMany({
        where: {
          id: {
            in: [
              SITE_RETARD_ID,
              SITE_AUJOURDHUI_ID,
              SITE_DEMAIN_ID,
              SITE_SUITE_ID,
              SITE_HORS_FENETRE_ID,
              SITE_PLANIFIEE_DEMAIN_ID,
            ],
          },
        },
      });
      await client.client.deleteMany({ where: { id: CLIENT_ID } });
    } finally {
      await client.$disconnect();
    }
  });

  test("en retard, aujourd'hui, demain et les jours suivants apparaissent dans cet ordre — J+9 et une planifiée demain restent invisibles", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionDuTerrain(page);
    await page.goto("/terrain");

    // ── PRÉSENCE, PAR SECTION ────────────────────────────────────────────────
    // Le semis PARTAGÉ (I9) pose déjà d'autres lignes en retard pour ce même
    // technicien : `.first()` sur le texte générique, jamais sur le libellé
    // de site unique de cette scène, qui lui ne se répète jamais.
    await expect(page.getByText(SITE_LIBELLE_RETARD)).toBeVisible();
    await expect(
      page.getByText(fr["terrain.carte.en_retard_prevue"]).first(),
    ).toBeVisible();
    await expect(page.getByText(SITE_LIBELLE_AUJOURDHUI)).toBeVisible();
    await expect(page.getByText(SITE_LIBELLE_DEMAIN)).toBeVisible();

    // ── « LES JOURS SUIVANTS » EST UN RÉSUMÉ, JAMAIS UNE CARTE AVEC LE SITE ──
    // Le compte exact (singulier ou pluriel) dépend du semis partagé en plus
    // de cette scène : les deux formes sont acceptées, jamais une seule.
    await expect(page.getByText(SITE_LIBELLE_SUITE)).toHaveCount(0);
    await expect(
      page
        .getByText(fr["terrain.jours_suivants.intervention_singulier"])
        .or(page.getByText(fr["terrain.jours_suivants.interventions_pluriel"]))
        .first(),
    ).toBeVisible();

    // ── CE QUI RESTE INVISIBLE, PARTOUT SUR LA PAGE ──────────────────────────
    await expect(page.getByText(SITE_LIBELLE_HORS_FENETRE)).toHaveCount(0);
    await expect(page.getByText(SITE_LIBELLE_PLANIFIEE_DEMAIN)).toHaveCount(0);

    // ── L'ORDRE DES SECTIONS SUIT LA MAQUETTE DU 28/09 ───────────────────────
    const yDe = async (nom: string): Promise<number> => {
      const box = await page
        .getByRole("heading", { name: nom, exact: false })
        .first()
        .boundingBox();
      if (box === null) {
        throw new Error(`Titre de section introuvable : « ${nom} »`);
      }
      return box.y;
    };
    const yRetard = await yDe(fr["terrain.en_retard"]);
    const yAujourdhui = await yDe(fr["terrain.aujourdhui"]);
    const yDemain = await yDe(fr["terrain.demain"]);
    const ySuite = await yDe(fr["terrain.jours_suivants.titre"]);
    expect(yRetard).toBeLessThan(yAujourdhui);
    expect(yAujourdhui).toBeLessThan(yDemain);
    expect(yDemain).toBeLessThan(ySuite);

    await capturer(page, "journee-remplie");
  });

  test("aucun débordement horizontal à 375 px", async ({ page }) => {
    await ouvrirLaSessionDuTerrain(page);
    await verifierAucunDebordement(page);
  });
});

/**
 * « Ma journée » VIDE — UN TECHNICIEN DÉDIÉ, NÉ SANS AUCUNE LIGNE (9F2B-
 * TERRAIN-JOURS-EPREUVES, point 2).
 *
 * Un `test.skip` auto-mesuré précédait ce bloc : il se retirait lui-même
 * dès que la fenêtre `[aujourd'hui, J+7]` de `COMPTE_TECHNICIEN_EPREUVE`
 * portait une ligne — **mesuré** que c'est systématiquement le cas, le seul
 * semis de démonstration en posant une pour ce technicien. L'épreuve ne
 * s'exécutait donc jamais, et les trois clés d'état vide n'étaient exercées
 * par rien.
 *
 * La correction n'est pas un filtre plus fin : c'est une IDENTITÉ qui ne
 * porte structurellement aucune intervention — ni du semis, ni d'un autre
 * scénario, puisqu'elle n'existait pas avant `beforeAll` et disparaît en
 * `afterAll`. Son « vide » n'est plus mesuré, il est construit.
 */
test.describe("« Ma journée » vide — un technicien sans aucune ligne", () => {
  const PREFIXE = "zz9f2b-";
  const EMAIL_SANS_LIGNE = `${PREFIXE}technicien-vide@codima.test`;
  const NOM_SANS_LIGNE = "zz9F2B — Technicien sans ligne";

  let societeId = "";
  let utilisateurId = "";

  test.beforeAll(async () => {
    const reperes = await reperesDeLaScene();
    societeId = reperes.societeId;

    const client = admin();
    try {
      const utilisateur = await avecSocieteEtRole(
        client,
        societeId,
        Role.admin_societe,
        (tx) =>
          tx.utilisateur.create({
            data: {
              id: uuidv7(),
              nom: NOM_SANS_LIGNE,
              email: EMAIL_SANS_LIGNE,
            },
            select: { id: true },
          }),
      );
      utilisateurId = utilisateur.id;

      const designe = avecDesignationAuth(client);
      await designe.compte.create({
        data: {
          id: uuidv7(),
          utilisateur_id: utilisateurId,
          emetteur: "local:credential",
          compte_externe_id: utilisateurId,
          fournisseur_id: "credential",
          mot_de_passe: null,
        },
      });

      await avecSociete(client, societeId, (tx) =>
        tx.utilisateurSociete.create({
          data: {
            id: uuidv7(),
            utilisateur_id: utilisateurId,
            societe_id: societeId,
            role: Role.technicien,
          },
        }),
      );
    } finally {
      await client.$disconnect();
    }

    // Le même chemin de premier accès que les quatre autres comptes de la
    // scène (`tests/e2e/setup/global.ts`) — jamais un mot de passe écrit en
    // base par un raccourci de harnais.
    await ouvrirLeCompteDeLEpreuve(societeId, EMAIL_SANS_LIGNE);
  });

  test.afterAll(async () => {
    if (utilisateurId === "") {
      return;
    }
    const client = admin();
    try {
      // `journal_acces` (I8, traçabilité) porte une ligne par connexion —
      // même méthode que `tests/e2e/9exb-equipe-techniciens.spec.ts`.
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await avecSociete(client, societeId, (tx) =>
        tx.utilisateurSociete.deleteMany({
          where: { utilisateur_id: utilisateurId, societe_id: societeId },
        }),
      );
      await avecSocieteEtRole(client, societeId, Role.admin_societe, (tx) =>
        tx.utilisateur.delete({ where: { id: utilisateurId } }),
      );
    } finally {
      await client.$disconnect();
    }
  });

  test("les messages « rien de transmis » s'affichent", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel(fr["connexion.email"]).fill(EMAIL_SANS_LIGNE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/terrain$/);

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/terrain");

    await expect(
      page.getByRole("heading", { name: fr["terrain.en_retard"] }),
    ).toHaveCount(0);
    await expect(
      page.getByText(fr["terrain.rien_aujourdhui"]).first(),
    ).toBeVisible();
    await expect(page.getByText(fr["terrain.demain.vide"])).toBeVisible();
    await expect(
      page.getByText(fr["terrain.jours_suivants.vide_prefixe"]),
    ).toBeVisible();

    // Les captures DE CE TECHNICIEN VIDE vivent dans
    // `docs/propositions/9F2B-TERRAIN-JOURS-EPREUVES/captures/` (point 5) —
    // jamais dans le dossier de 9F2, qu'il ne faut pas régénérer.
  });
});
