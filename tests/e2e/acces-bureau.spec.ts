import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9ET-COMPTES-BUREAU-1 (D196) — CRÉER UN COMPTE DE BUREAU ET LUI DONNER
 * L'ACCÈS, DE BOUT EN BOUT.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * Modèle : `tests/e2e/acces-technicien.spec.ts`. Les épreuves d'isolation
 * (`tests/isolation/acces-bureau.test.ts`) prouvent que les fonctions de
 * `lib/auth/acces-bureau.ts` écrivent les bonnes lignes sous les bonnes
 * politiques. Elles ne peuvent pas prouver qu'un administrateur qui POSTE
 * réellement sur les deux routes de ce lot obtient un courriel exploitable,
 * ni que le lien qu'il porte mène, pour de vrai, un compte ADV jusqu'à SA
 * session — sous SON rôle, et non celui d'un technicien ou d'un client.
 *
 * ## AUCUN ÉCRAN : DES REQUÊTES DIRECTES (D196)
 *
 * L'écran d'Équipe passe à la maquette au lot SUIVANT
 * (9ET-COMPTES-BUREAU-2). Les deux gestes de l'administrateur — créer le
 * compte, lui envoyer le lien — passent donc par `page.request.post`
 * directement sur les routes, jamais par un formulaire rempli.
 *
 * ## LE COURRIEL EST DOUBLÉ, AU NIVEAU DU SERVEUR
 *
 * Même mécanique que le fichier modèle : `double-courriel.cjs` intercepte
 * les appels vers `api.resend.com` et consigne chaque corps dans
 * `FICHIER_COURRIELS_CAPTURES`.
 */
test.describe.configure({ mode: "serial" });

const NOM_COMPTE = fr["bureau9et.e2e.nom"];
// Jamais `@codima.test` ici : cette adresse ne traverse aucune requête
// d'écran, et le gardien de D29 (`tests/unit/i18n/sans-nom-de-societe.test.ts`)
// ferme son exclusion à `equipe.e2e.courriel` — même précaution que
// `acces-technicien.spec.ts`.
const COURRIEL_COMPTE = "compte.bureau@9etbureau.e2e.test";
const MOT_DE_PASSE_CHOISI = "mot-de-passe-9etbureau-epreuve";

let utilisateurId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  if (existsSync(FICHIER_COURRIELS_CAPTURES)) {
    writeFileSync(FICHIER_COURRIELS_CAPTURES, "");
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    if (utilisateurId !== "") {
      // DEUX TRACES NOMMENT CETTE IDENTITÉ : celle de l'ADMINISTRATEUR, qui
      // la nomme dans `detail` (D196), et celle que SA PROPRE connexion
      // écrit (bascule de société) — auteur le compte lui-même.
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1`,
        utilisateurId,
      );
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
      await client.utilisateurSociete.deleteMany({
        where: { utilisateur_id: utilisateurId },
      });
      await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
    }
  } finally {
    await client.$disconnect();
  }
});

/** Un corps de requête Resend, tel que `double-courriel.cjs` le consigne. */
type CorpsIntercepte = {
  readonly to: readonly string[];
  readonly text: string;
};

function courrielsCaptures(): CorpsIntercepte[] {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map((ligne) => JSON.parse(ligne) as CorpsIntercepte);
}

test("l'administrateur crée un compte ADV, le lien part, la personne se connecte sous ce rôle", async ({
  page,
  browser,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  // ── 1. CRÉATION DU COMPTE DE BUREAU, PAR REQUÊTE DIRECTE ─────────────────
  const creation = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_COMPTE, courriel: COURRIEL_COMPTE, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creation.status()).toBe(303);
  expect(creation.headers()["location"]).toBe(
    "/parametres/equipe?onglet=bureau",
  );

  const client = admin();
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: COURRIEL_COMPTE },
      select: { id: true },
    });
    utilisateurId = identite.id;

    const habilitation = await client.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateurId },
      select: { role: true },
    });
    expect(habilitation.role).toBe(Role.adv);
  } finally {
    await client.$disconnect();
  }

  // ── 2. « ENVOYER LE LIEN D'ACCÈS », PAR REQUÊTE DIRECTE ──────────────────
  const envoi = await page.request.post(
    `/api/equipe/bureau/${utilisateurId}/envoyer-acces`,
    { maxRedirects: 0 },
  );
  expect(envoi.status()).toBe(303);
  expect(envoi.headers()["location"] ?? "").toContain(
    "motif=equipe.acces.envoye",
  );

  // ── 3. LE LIEN, RELU DANS LE FICHIER DES COURRIELS INTERCEPTÉS ───────────
  const correspondant = courrielsCaptures().find((courriel) =>
    courriel.to.includes(COURRIEL_COMPTE),
  );
  expect(correspondant).toBeDefined();
  const urlPremierAcces = /https?:\/\/\S+/.exec(correspondant?.text ?? "")?.[0];
  expect(urlPremierAcces).toBeDefined();

  // ── 4. LA PERSONNE, SUR SA PROPRE PAGE ───────────────────────────────────
  //
  // Jamais la page de l'administrateur : un cookie écraserait l'autre (même
  // raison que `acces-technicien.spec.ts`).
  const pageCompte = await browser.newPage();
  await pageCompte.goto(urlPremierAcces ?? "");
  await pageCompte
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageCompte
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageCompte
    .getByRole("button", { name: fr["premier_acces.valider"] })
    .click();
  await pageCompte.waitForLoadState("networkidle");
  await expect(pageCompte).toHaveURL(/\/connexion/);
  await expect(pageCompte.getByText(fr["premier_acces.abouti"])).toBeVisible();

  // ── 5. CONNEXION, SOUS LE RÔLE ADV ───────────────────────────────────────
  await pageCompte.getByLabel(fr["connexion.email"]).fill(COURRIEL_COMPTE);
  await pageCompte
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await pageCompte
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  // L'ADV n'est pas un rôle du terrain ni du portail : l'arrivée se fait sur
  // /planning, jamais /terrain (réservé au technicien) ni /portail (réservé
  // au client) — c'est la preuve que la session porte bien le rôle ADV.
  await expect(pageCompte).toHaveURL(/\/planning/);

  await pageCompte.close();
});
