import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9IA — RÉINITIALISER LE SECOND FACTEUR D'UN COMPTE (téléphone perdu,
 * décision d'Alexis du 28/10/2026, réponse « A et B »).
 *
 * Modèle : `tests/e2e/acces-bureau.spec.ts` et `tests/e2e/captures-9cw-tp-s6-
 * second-facteur.spec.ts` — aucun raccourci, le sujet s'enrôle et se
 * reconnecte comme une personne le ferait.
 *
 * **A (admin_plateforme) n'est pas éprouvé ici.** Mesuré
 * (`docs/propositions/9IA-REINITIALISER-SECOND-FACTEUR/mesure.md`) :
 * `admin_plateforme` n'a jamais de société active, donc jamais accès à
 * `/parametres/equipe` — aucun écran ne mène A à ce geste dans ce lot. Sa
 * réussite est éprouvée à la base, directement, par
 * `tests/isolation/reinitialisation-second-facteur.test.ts`.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

function urlApplicative(): string {
  const url = new URL(urlAdministration());
  url.username = "codiplan_app";
  url.password = "";
  return url.toString();
}

const identitesCreees: string[] = [];

/** Ouvre une identité jetable — même patron que `nouveauCompte` (9CW). */
async function nouveauCompte(
  etiquette: string,
  societeCode: string,
  role: Role,
): Promise<{ email: string; utilisateurId: string }> {
  const proprietaire = admin();
  let societeId = "";
  try {
    const societe = await proprietaire.societe.findFirstOrThrow({
      where: { code: societeCode },
      select: { id: true },
    });
    societeId = societe.id;
  } finally {
    await proprietaire.$disconnect();
  }

  const email = `9ia.${etiquette}@codima.test`;
  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: {
        email,
        password: MOT_DE_PASSE_EPREUVE,
        name: `9IA ${etiquette}`,
      },
    });
    identitesCreees.push(cree.user.id);
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          cree.user.id,
          societeId,
          role,
        ),
    );
    return { email, utilisateurId: cree.user.id };
  } finally {
    await applicatif.$disconnect();
  }
}

test.afterAll(async () => {
  if (identitesCreees.length === 0) return;
  const client = admin();
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: { in: identitesCreees } },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: { in: identitesCreees } },
    });
    await client.utilisateur.deleteMany({
      where: { id: { in: identitesCreees } },
    });
  } finally {
    await client.$disconnect();
  }
});

test("B réinitialise un autre membre de SA société ; la connexion du sujet mène ensuite à l'enrôlement", async ({
  page,
  browser,
}) => {
  const sujet = await nouveauCompte(
    "sujet-reussite",
    "CODIMA-NC",
    Role.direction,
  );

  // ── 1. LE SUJET S'ENRÔLE, COMME UNE PERSONNE LE FERAIT ──────────────────
  const pageSujet = await browser.newPage();
  await ouvrirLaSessionSensible(pageSujet, sujet.email);
  await pageSujet.close();

  // ── 2. L'ADMINISTRATEUR DE LA SOCIÉTÉ RÉINITIALISE LE SUJET ─────────────
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  const reponse = await page.request.post(
    `/api/equipe/bureau/${sujet.utilisateurId}/reinitialiser-second-facteur`,
    { maxRedirects: 0 },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "motif=equipe.bureau.second_facteur.reinitialise",
  );

  // ── 3. LE SUJET SE RECONNECTE : L'ENRÔLEMENT, PAS LE CODE ───────────────
  const pageSujetApres = await browser.newPage();
  await pageSujetApres.goto("/connexion");
  await pageSujetApres.getByLabel(fr["connexion.email"]).fill(sujet.email);
  await pageSujetApres
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await pageSujetApres
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await pageSujetApres.waitForLoadState("networkidle");
  await expect(pageSujetApres).toHaveURL(/\/enrolement$/);
  await pageSujetApres.close();
});

test("B ne se réinitialise jamais lui-même", async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  const client = admin();
  let soiMemeId = "";
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    soiMemeId = identite.id;
  } finally {
    await client.$disconnect();
  }

  const reponse = await page.request.post(
    `/api/equipe/bureau/${soiMemeId}/reinitialiser-second-facteur`,
    { maxRedirects: 0 },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "motif=equipe.bureau.refus.introuvable",
  );
});

test("B sur un compte d'une AUTRE société est refusé — y compris par requête forgée", async ({
  page,
}) => {
  const autreSociete = await nouveauCompte(
    "autre-societe",
    "CODIMA-EU",
    Role.adv,
  );
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  // REQUÊTE FORGÉE : l'identifiant d'un compte réel, d'une AUTRE société,
  // posté directement — jamais choisi depuis l'écran, qui ne le propose pas.
  const reponse = await page.request.post(
    `/api/equipe/bureau/${autreSociete.utilisateurId}/reinitialiser-second-facteur`,
    { maxRedirects: 0 },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "motif=equipe.bureau.refus.introuvable",
  );
});
