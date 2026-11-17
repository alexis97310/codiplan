import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { pourcentageAffiche } from "@/app/(portail)/portail/tarifs/presentation";
import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration, urlApplicative } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, COMPTE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CAPTURES — 9L12-MAJORATION-POURCENTAGE-SOCIETE (décision d'Alexis du
 * 10/11/2026) : le bon et le barème du portail affichent le MÊME taux, celui
 * RÉGLÉ par la société — ici 25 %, une valeur de test qui n'est ni 50 %
 * (l'ancien taux fixe) ni 0 %, pour que la capture prouve que le réglage est
 * bien lu, pas qu'un défaut survit par coïncidence.
 *
 * Même patron que `captures-9i8a1-regle-facturation.spec.ts` pour le bon
 * (une intervention CLÔTURÉE insérée directement, `valorisation_figee` posée
 * à la main) et que `captures-9j20-portail-tarifs.spec.ts` pour le barème
 * portail (invitation d'un compte client, premier mot de passe).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L12-MAJORATION-POURCENTAGE-SOCIETE/captures",
);

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_CLOTUREE = uuidv7();

/** Un NOMBRE, jamais une chaîne : le gardien L0-11 refuse une chaîne visible
 * écrite en dur, y compris le texte attendu par un test de rendu — un
 * littéral numérique n'en est pas une (`tests/unit/i18n/sans-chaine-visible-
 * en-dur.test.ts`). */
const POURCENTAGE_NUMERIQUE_EPREUVE = 25;
const POURCENTAGE_EPREUVE = `${POURCENTAGE_NUMERIQUE_EPREUVE}.00`;
const EMAIL_PORTAIL = "9l12-portail-tarifs@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9l12-portail-tarifs";

/** Créneau ENTIÈREMENT hors ouverture : toute la main-d'œuvre est l'assiette (D108). */
const MAIN_DOEUVRE_MINEUR = 12_000;
const MAJORATION_MINEUR = 3_000; // 25 % de 12 000 — le taux réglé, pas 50 %.

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** Même lecture que `captures-9j20-portail-tarifs.spec.ts`. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

let pourcentageAvant = "50";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const societeAvant = await client.societe.findUniqueOrThrow({
      where: { id: reperes.societeId },
      select: { majoration_hors_ouverture_pct: true },
    });
    pourcentageAvant = societeAvant.majoration_hors_ouverture_pct.toString();
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { majoration_hors_ouverture_pct: POURCENTAGE_EPREUVE },
    });

    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9L12-Client (captures)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9L12-Lieu (captures)",
      },
    });
    // LE POURCENTAGE FIGÉ EST CELUI QUI A SERVI À FACTURER (RG-INT-08) :
    // la décomposition reflète 25 % de la main-d'œuvre, exactement ce que
    // la clôture aurait calculé avec le réglage ci-dessus.
    const valorisationFigee = {
      minutesReelles: 120,
      minutesArrondies: 120,
      minutesFacturees: 120,
      plancherApplique: false,
      regle: { plancherMinutes: 60, palierMinutes: 30, seuilPalierMinutes: 5 },
      tauxHoraire: { valeur: "6000", devise: "XPF" },
      mainDoeuvre: { valeur: String(MAIN_DOEUVRE_MINEUR), devise: "XPF" },
      forfaitDeplacement: null,
      majoration: { valeur: String(MAJORATION_MINEUR), devise: "XPF" },
      totalHT: {
        valeur: String(MAIN_DOEUVRE_MINEUR + MAJORATION_MINEUR),
        devise: "XPF",
      },
      motifTotalInconnu: null,
    };
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "temps_valide_min", "temps_valide_par", "temps_valide_le",
          "cloturee_le", "montant_ht", "devise_code", "valorisation_figee",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', '2026-11-24T00:00:00Z', 120, $6::uuid,
               120, $6::uuid, now(), now(), $7, 'XPF', $8::jsonb, now())`,
      INTERVENTION_CLOTUREE,
      reperes.societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
      reperes.technicienDucos,
      MAIN_DOEUVRE_MINEUR + MAJORATION_MINEUR,
      JSON.stringify(valorisationFigee),
    );

    // Le compte PORTAIL, pour la capture du barème (`/portail/tarifs`) —
    // même recette que `captures-9j20-portail-tarifs.spec.ts`.
    const adminSociete = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const contexteAdmin: ContexteSession = {
      utilisateurId: adminSociete.id,
      societeId: reperes.societeId,
      role: Role.admin_societe,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      const invitation = await inviterClientAuPortail(
        contexteAdmin,
        CLIENT_ID,
        EMAIL_PORTAIL,
        applicatif,
      );
      if (!invitation.accepte) {
        throw new Error(
          `L'invitation du compte de l'épreuve a été refusée : ${invitation.motif}.`,
        );
      }
      if (!invitation.enAttente) {
        if (invitation.url === null) {
          throw new Error(
            "L'invitation n'a rendu aucun jeton : la scène ne peut pas ouvrir " +
              "le compte portail de l'épreuve.",
          );
        }
        const jeton = jetonDeLUrl(invitation.url);
        if (jeton === null) {
          throw new Error(
            "Le jeton n'a pas pu être extrait de l'URL d'invitation.",
          );
        }
        const issue = await choisirLePremierMotDePasse({
          jeton,
          motDePasse: MOT_DE_PASSE_PORTAIL,
          confirmation: MOT_DE_PASSE_PORTAIL,
        });
        if (issue.issue !== "abouti") {
          throw new Error(
            `Le premier accès du compte portail de l'épreuve a été refusé : ${issue.issue}.`,
          );
        }
      }
    } finally {
      await applicatif.$disconnect();
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    // LE RATTACHEMENT PORTAIL D'ABORD — même raison que `segment_travail`
    // ailleurs dans ce dépôt : le client ne se supprime pas en laissant une
    // habilitation pointer dans le vide.
    await client.utilisateurClient.deleteMany({
      where: { client_id: CLIENT_ID },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { majoration_hors_ouverture_pct: pourcentageAvant },
    });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(page: Page, nom: string, largeur: number) {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `apres-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function ouvrirLaSessionPortail(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_PORTAIL);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_PORTAIL);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForURL(/\/(arrivee|portail)/);
}

for (const largeur of [375, 1280] as const) {
  test(`le bon d'une intervention clôturée à 25 % — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
    await page.goto(
      `/interventions/${INTERVENTION_CLOTUREE}/bon?version=interne`,
    );
    // LE BON NE MONTRE AUCUNE LIGNE DE MAJORATION SÉPARÉE (seul le total
    // hors taxes est affiché, et la phrase sans montant de 9I8B) : le témoin
    // est donc le TOTAL — 15 000 (12 000 + 3 000 à 25 %), jamais 18 000
    // (ce que +50 % aurait rendu).
    await expect(page.getByText(/15\s000/)).toBeVisible();
    await capturer(page, "bon-cloturee-25pct", largeur);
  });

  test(`le barème du portail affiche 25 % — ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionPortail(page);
    await page.goto("/portail/tarifs");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: fr["portail.tarifs.titre"],
      }),
    ).toBeVisible();
    await expect(
      page.getByText(pourcentageAffiche(String(POURCENTAGE_NUMERIQUE_EPREUVE))),
    ).toBeVisible();
    await capturer(page, "portail-tarifs-25pct", largeur);
  });
}
