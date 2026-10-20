import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { libelleCreerEtAjouterSite } from "@/app/(back-office)/clients/presentation";
import { libelleCreerSite } from "@/app/(back-office)/sites/presentation";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../e2e/setup/base";
import { choisirPriorite } from "../e2e/setup/formulaire-creation";
import { FICHIER_COURRIELS_CAPTURES } from "../e2e/setup/courriel-captures";
import { glisser } from "../e2e/setup/glisser";
import { reperesDeLaScene } from "../e2e/setup/reperes";
import { dialogueOuvert } from "../e2e/setup/saisie-manuelle";
import { choisirResultatParTexte } from "../e2e/setup/selecteur-recherche";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_EPREUVE,
  COMPTE_RM_EPREUVE,
  COMPTE_RS_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../e2e/setup/scene";
import { ouvrirLaSessionSensible } from "../e2e/setup/session";
import {
  EMAIL_DIRECTION_AUDIT,
  fermerCompteDirectionAudit,
  ouvrirCompteDirectionAudit,
} from "./comptes";

/**
 * 9F8-AUDIT-NAVIGATEUR-BOUT-EN-BOUT — audit au navigateur de l'application
 * entière, comme le feraient six vraies personnes.
 *
 * ## CE QUE CE FICHIER FAIT, ET CE QU'IL N'EST PAS
 *
 * Ce n'est PAS une suite d'épreuves de régression : c'est un PARCOURS qui
 * CONSTATE. Chaque geste est enveloppé par `etape()`, qui n'échoue jamais au
 * sens Playwright — une erreur devient un CONSTAT « bloquant » écrit dans
 * `docs/audits/9F8-navigateur/parcours.json` et `rapport.md`, et le parcours
 * continue. C'est délibéré : un `expect` qui lance interromprait tout le
 * reste du fichier (mode série, un seul worker), perdant les constats qui
 * suivent pour la seule raison qu'un écran plus tôt a surpris. L'INTERDICTION
 * du lot porte sur `tests/e2e/` (jamais assoupli) ; ici, un geste qui échoue
 * EST le résultat qu'on cherche à écrire.
 *
 * ## POURQUOI UN SEUL GROS FICHIER
 *
 * Les étapes 0 (comptes) → G (cloisonnement) partagent un même fil : les
 * comptes ZZ ouverts à l'étape 0 sont réutilisés jusqu'à G, et l'étape C a
 * BESOIN que la page du technicien soit ouverte AVANT que B ne transmette
 * (D130) — deux `test()` qui partagent `browser.newPage()` au travers du même
 * worker (`workers: 1`, `fullyParallel: false` du harnais).
 */

// AUCUN DÉLAI GLOBAL ICI — chaque test pose le sien, ci-dessous, à la mesure
// de ce qu'il fait réellement. Un délai de 15 minutes partagé par tous a
// transformé, au premier passage, une page de connexion restée bloquée en
// 15 minutes perdues plutôt qu'en échec rapide et lisible.

const DOSSIER = join(process.cwd(), "docs/audits/9F8-navigateur");
const DOSSIER_CAPTURES = join(DOSSIER, "captures");
const MOT_DE_PASSE_CHOISI = MOT_DE_PASSE_EPREUVE;
const PREFIXE = "ZZ TEST";

type Verdict = "ok" | "anomalie" | "bloquant";

type Constat = {
  readonly numero: number;
  readonly etape: string;
  readonly role: string;
  readonly ecran: string;
  readonly verdict: Verdict;
  readonly dureeMs: number;
  readonly note?: string;
  readonly capture?: string;
};

const CONSTATS: Constat[] = [];
let compteurEtape = 0;

function enregistrer(c: Omit<Constat, "numero">): void {
  compteurEtape += 1;
  CONSTATS.push({ numero: compteurEtape, ...c });
  // eslint-disable-next-line no-console -- relevé volontairement visible dans la sortie de `pnpm audit:fonctionnel`, même recette que 9F5/9F6.
  console.log(
    `9F8 #${compteurEtape} [${c.verdict}] ${c.role} — ${c.ecran} — ${c.etape}${c.note ? " — " + c.note : ""}`,
  );
}

type ResultatEtape = { readonly verdict?: Verdict; readonly note?: string };

async function etape(
  params: {
    readonly etape: string;
    readonly role: string;
    readonly ecran: string;
  },
  action: () => Promise<ResultatEtape | void>,
): Promise<void> {
  const debut = Date.now();
  try {
    const resultat = await action();
    enregistrer({
      ...params,
      verdict: resultat?.verdict ?? "ok",
      note: resultat?.note,
      dureeMs: Date.now() - debut,
    });
  } catch (erreur) {
    enregistrer({
      ...params,
      verdict: "bloquant",
      note: String(erreur).slice(0, 600),
      dureeMs: Date.now() - debut,
    });
  }
}

let compteurCapture = 0;

/** Capture aux DEUX largeurs imposées (375, 1280), jamais `fullPage`. */
async function capturerDouble(page: Page, nom: string): Promise<string> {
  compteurCapture += 1;
  const numero = String(compteurCapture).padStart(2, "0");
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${numero}-${nom}-375.png`),
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${numero}-${nom}-1280.png`),
  });
  return `${numero}-${nom}`;
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

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

function lienPourCourriel(courriel: string): string | undefined {
  const correspondant = courrielsCaptures().find((c) =>
    c.to.includes(courriel),
  );
  return /https?:\/\/\S+/.exec(correspondant?.text ?? "")?.[0];
}

// ─── ÉTAT DES SIX COMPTES ZZ (étape 0) ──────────────────────────────────────

type CleCompte =
  "adv" | "sav" | "materiel" | "direction" | "admin" | "technicien";

type EtatCompte = {
  readonly libelle: string;
  readonly role: Role;
  readonly courriel: string;
  ouvert: boolean;
  utilisateurId: string;
};

const COMPTES: Record<CleCompte, EtatCompte> = {
  adv: {
    libelle: "ZZ TEST ADV",
    role: Role.adv,
    courriel: "zz.adv@9f8.e2e.test",
    ouvert: false,
    utilisateurId: "",
  },
  sav: {
    libelle: "ZZ TEST SAV",
    role: Role.responsable_sav,
    courriel: "zz.sav@9f8.e2e.test",
    ouvert: false,
    utilisateurId: "",
  },
  materiel: {
    libelle: "ZZ TEST Matériel",
    role: Role.responsable_materiel,
    courriel: "zz.materiel@9f8.e2e.test",
    ouvert: false,
    utilisateurId: "",
  },
  direction: {
    libelle: "ZZ TEST Direction",
    role: Role.direction,
    courriel: "zz.direction@9f8.e2e.test",
    ouvert: false,
    utilisateurId: "",
  },
  admin: {
    libelle: "ZZ TEST Admin",
    role: Role.admin_societe,
    courriel: "zz.admin@9f8.e2e.test",
    ouvert: false,
    utilisateurId: "",
  },
  technicien: {
    libelle: "ZZ TEST Technicien",
    role: Role.technicien,
    courriel: "zz.technicien@9f8.e2e.test",
    ouvert: false,
    utilisateurId: "",
  },
};

/** Le compte de repli de la SCÈNE, même rôle — utilisé quand l'ouverture a échoué. */
const REPLI: Record<CleCompte, string> = {
  adv: COMPTE_EPREUVE,
  sav: COMPTE_RS_EPREUVE,
  materiel: COMPTE_RM_EPREUVE,
  direction: EMAIL_DIRECTION_AUDIT,
  admin: COMPTE_ADMIN_SOCIETE_EPREUVE,
  technicien: COMPTE_TECHNICIEN_EPREUVE,
};

/** Le courriel à utiliser pour SE CONNECTER sous ce rôle — ZZ si ouvert, repli sinon. */
function emailDe(cle: CleCompte): string {
  return COMPTES[cle].ouvert ? COMPTES[cle].courriel : REPLI[cle];
}

/** Connexion par l'écran, second facteur compris — toujours `MOT_DE_PASSE_EPREUVE`
 * (le mot de passe choisi au premier accès pour les comptes ZZ est le même). */
async function connecter(page: Page, cle: CleCompte): Promise<void> {
  await ouvrirLaSessionSensible(page, emailDe(cle));
}

// ─── ÉTAPE 0 — COMPTES PAR L'INTERFACE ──────────────────────────────────────

async function traverserPremierAcces(
  browser: Browser,
  courriel: string,
): Promise<{ page: Page; abouti: boolean; note?: string }> {
  const lien = lienPourCourriel(courriel);
  if (lien === undefined) {
    const page = await browser.newPage();
    return {
      page,
      abouti: false,
      note: "aucun lien capté dans le courriel doublé",
    };
  }
  const page = await browser.newPage();
  await page.goto(lien);
  await page
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill(MOT_DE_PASSE_CHOISI);
  await page
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE_CHOISI);
  await page.getByRole("button", { name: fr["premier_acces.valider"] }).click();
  await page.waitForLoadState("networkidle");
  const abouti = /\/connexion/.test(page.url());
  return {
    page,
    abouti,
    note: abouti ? undefined : `atterrit sur ${page.url()}`,
  };
}

async function creerCompteBureauParInterface(
  pageAdmin: Page,
  cle: CleCompte,
): Promise<void> {
  const compte = COMPTES[cle];
  await pageAdmin.goto(
    "/parametres/equipe?onglet=bureau&ajouter=1&type=bureau",
  );
  const formulaire = pageAdmin.locator(
    'form[action="/api/equipe/bureau/creer"]',
  );
  await formulaire.getByLabel(fr["equipe.nom"]).fill(compte.libelle);
  await formulaire.getByLabel(fr["equipe.email"]).fill(compte.courriel);
  await formulaire.locator('select[name="role"]').selectOption(compte.role);
  await formulaire.getByLabel(fr["equipe.volet.envoyer_en_ajoutant"]).check();
  await formulaire
    .getByRole("button", { name: fr["equipe.creer_action"] })
    .click();
  await pageAdmin.waitForLoadState("networkidle");
}

async function creerCompteTechnicienParInterface(
  pageAdmin: Page,
): Promise<void> {
  const compte = COMPTES.technicien;
  await pageAdmin.goto("/parametres/equipe?ajouter=1&type=technicien");
  const formulaire = pageAdmin.locator('form[action="/api/techniciens/creer"]');
  await formulaire.getByLabel(fr["equipe.nom"]).fill(compte.libelle);
  await formulaire.getByLabel(fr["equipe.email"]).fill(compte.courriel);
  const options = formulaire.locator(
    'select[name="agence_id"] option:not([value=""])',
  );
  await expect(options.first()).toBeAttached();
  const valeurAgence = await options.first().getAttribute("value");
  await formulaire
    .locator('select[name="agence_id"]')
    .selectOption(valeurAgence ?? "");
  await formulaire
    .locator('select[name="statut_ressource"]')
    .selectOption("salarie");
  await formulaire
    .getByRole("button", { name: fr["equipe.creer_action"] })
    .click();
  await pageAdmin.waitForLoadState("networkidle");

  // « Envoyer le lien d'accès », depuis la fiche repliée du technicien —
  // même patron que `tests/e2e/acces-technicien.spec.ts`.
  const client = admin();
  let utilisateurId = "";
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: compte.courriel },
      select: { id: true },
    });
    utilisateurId = identite.id;
  } finally {
    await client.$disconnect();
  }
  const fiche = pageAdmin
    .locator("details")
    .filter({ hasText: compte.libelle })
    .filter({ has: pageAdmin.locator("form") });
  await expect(fiche).toBeVisible();
  await fiche.locator("summary").click();
  await fiche
    .locator(`form[action="/api/equipe/${utilisateurId}/envoyer-acces"]`)
    .getByRole("button")
    .click();
  await pageAdmin.waitForLoadState("networkidle");
}

async function ouvrirCompteParInterface(
  pageAdmin: Page,
  browser: Browser,
  cle: CleCompte,
): Promise<void> {
  const compte = COMPTES[cle];
  await etape(
    {
      etape: `créer le compte ${compte.libelle} et envoyer le lien`,
      role: "admin_societe",
      ecran: "/parametres/equipe",
    },
    async () => {
      if (cle === "technicien") {
        await creerCompteTechnicienParInterface(pageAdmin);
      } else {
        await creerCompteBureauParInterface(pageAdmin, cle);
      }
      const client = admin();
      try {
        const identite = await client.utilisateur.findFirst({
          where: { email: compte.courriel },
          select: { id: true },
        });
        if (identite === null) {
          return {
            verdict: "bloquant",
            note: "aucune ligne utilisateur créée",
          };
        }
        compte.utilisateurId = identite.id;
      } finally {
        await client.$disconnect();
      }
      return undefined;
    },
  );

  if (compte.utilisateurId === "") {
    return;
  }

  await etape(
    {
      etape: `premier accès et connexion de ${compte.libelle}`,
      role: compte.role,
      ecran: "/premier-acces",
    },
    async () => {
      const { page, abouti, note } = await traverserPremierAcces(
        browser,
        compte.courriel,
      );
      try {
        if (!abouti) {
          return { verdict: "bloquant", note };
        }
        // JAMAIS `connecter(page, cle)` ICI : `emailDe` lirait `compte.ouvert`,
        // encore `false` à cet instant précis (il ne devient vrai qu'après ce
        // bloc), et retomberait sur le compte de REPLI de la scène plutôt que
        // sur le compte ZZ qu'on est précisément en train de vérifier — bogue
        // mesuré au premier passage : les cinq rôles « réussissaient » en
        // ouvrant en réalité leur compte de scène, jamais le compte ZZ.
        await ouvrirLaSessionSensible(page, compte.courriel);
        const arrivee = page.url();
        compte.ouvert = true;
        await capturerDouble(page, `00-arrivee-${cle}`);
        return { note: `arrivée sur ${new URL(arrivee).pathname}` };
      } finally {
        await page.close();
      }
    },
  );
}

test("Étape 0 — les six comptes ZZ, ouverts par l'écran Équipe", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  if (existsSync(FICHIER_COURRIELS_CAPTURES)) {
    writeFileSync(FICHIER_COURRIELS_CAPTURES, "");
  }
  await connecter(page, "admin"); // le compte de scène, pour CRÉER les six — la scène a bien admin_societe.

  for (const cle of [
    "adv",
    "sav",
    "materiel",
    "direction",
    "admin",
    "technicien",
  ] as const) {
    await ouvrirCompteParInterface(page, browser, cle);
  }

  // LE REPLI « DIRECTION » N'EXISTE PAS DANS LA SCÈNE (D199) — si l'ouverture
  // ZZ a échoué, `ouvrirCompteDirectionAudit` (9F5, réutilisée telle quelle)
  // pose l'identité que `REPLI.direction` nomme, pour que la suite du
  // parcours ait quand même un compte direction utilisable.
  if (!COMPTES.direction.ouvert) {
    await etape(
      {
        etape: "repli — ouvrir le compte direction de l'audit (9F5)",
        role: "direction",
        ecran: "(base)",
      },
      async () => {
        await ouvrirCompteDirectionAudit();
      },
    );
  }
});

// ─── ÉTAPE A — ADMIN ─────────────────────────────────────────────────────────

test("Étape A — ZZ TEST Admin : paramètres, équipe, habilitations, tableau de bord", async ({
  page,
}) => {
  await etape(
    { etape: "connexion", role: "admin_societe", ecran: "/connexion" },
    async () => {
      await connecter(page, "admin");
    },
  );

  for (const [chemin, nom] of [
    ["/parametres/societe", "parametres-societe"],
    ["/parametres/equipe", "equipe"],
    ["/parametres/habilitations", "habilitations"],
    ["/tableau-de-bord", "tableau-de-bord"],
  ] as const) {
    await etape(
      { etape: `lecture de ${chemin}`, role: "admin_societe", ecran: chemin },
      async () => {
        await page.goto(chemin);
        await page.waitForLoadState("networkidle");
        const capture = await capturerDouble(page, nom);
        return { note: capture };
      },
    );
  }
});

// ─── ÉTAT PARTAGÉ POUR B + C + D ─────────────────────────────────────────────

let clientId = "";
let siteId = "";
let machineId = "";
let interventionId = "";
let demandeId = "";
let technicienDucosId = "";
let libelleSiteDucos = "";
let pageTechnicien: Page | null = null;
let instantTransmission = 0;
let delaiAnnonceMs: number | null = null;

// ─── ÉTAPE B+C — LE FIL ADV → TECHNICIEN ────────────────────────────────────

test("Étape B+C — ADV crée et planifie, le technicien traite, en deux sessions", async ({
  page,
  browser,
}) => {
  test.setTimeout(600_000);
  const reperes = await reperesDeLaScene();
  technicienDucosId = COMPTES.technicien.ouvert
    ? COMPTES.technicien.utilisateurId
    : reperes.technicienDucos;

  // 1. LE TECHNICIEN EST DÉJÀ SUR « MA JOURNÉE », AVANT TOUTE TRANSMISSION (D130).
  await etape(
    {
      etape: "ouvrir Ma journée AVANT la transmission",
      role: "technicien",
      ecran: "/terrain",
    },
    async () => {
      pageTechnicien = await browser.newPage();
      await connecter(pageTechnicien, "technicien");
      await pageTechnicien.goto("/terrain");
      await pageTechnicien.waitForLoadState("networkidle");
      await capturerDouble(pageTechnicien, "c00-ma-journee-avant");
    },
  );

  // 2. ADV — CLIENT, SITE, MACHINE.
  await etape(
    { etape: "connexion ADV", role: "adv", ecran: "/connexion" },
    async () => {
      await connecter(page, "adv");
    },
  );

  const raisonSociale = `${PREFIXE} ${uuidv7().slice(0, 8)}`;
  await etape(
    {
      etape: "créer le client ZZ TEST",
      role: "adv",
      ecran: "/clients/nouveau",
    },
    async () => {
      await page.goto("/clients/nouveau");
      await page.locator('input[name="raison_sociale"]').fill(raisonSociale);
      await page
        .getByRole("button", { name: libelleCreerEtAjouterSite() })
        .click();
      await page.waitForLoadState("networkidle");
      const url = page.url();
      const idDepuisUrl = /\/clients\/([0-9a-f-]{36})/.exec(url)?.[1];
      if (idDepuisUrl !== undefined) {
        clientId = idDepuisUrl;
      } else {
        const client = admin();
        try {
          const cree = await client.client.findFirstOrThrow({
            where: { raison_sociale: raisonSociale },
            select: { id: true },
          });
          clientId = cree.id;
        } finally {
          await client.$disconnect();
        }
      }
      await capturerDouble(page, "b01-client-cree");
      return { note: `client ${clientId}` };
    },
  );

  await etape(
    {
      etape: "créer le site ZZ TEST Atelier",
      role: "adv",
      ecran: "/sites/nouveau",
    },
    async () => {
      if (!/\/sites\/nouveau/.test(page.url())) {
        await page.goto(`/sites/nouveau?client=${clientId}`);
      }
      await page.locator('select[name="agence_id"]').selectOption({ index: 1 });
      const libelleSite = `${PREFIXE} Atelier`;
      await page.locator('input[name="libelle"]').fill(libelleSite);
      await page.getByRole("button", { name: libelleCreerSite() }).click();
      await page.waitForLoadState("networkidle");
      const idDepuisUrl = /\/sites\/([0-9a-f-]{36})/.exec(page.url())?.[1];
      if (idDepuisUrl !== undefined) {
        siteId = idDepuisUrl;
      } else {
        const client = admin();
        try {
          const site = await client.site.findFirstOrThrow({
            where: { libelle: libelleSite, client_id: clientId },
            select: { id: true },
          });
          siteId = site.id;
        } finally {
          await client.$disconnect();
        }
      }
      libelleSiteDucos = libelleSite;
      await capturerDouble(page, "b02-site-cree");
      return { note: `site ${siteId}` };
    },
  );

  await etape(
    { etape: "créer la machine ZZ", role: "adv", ecran: "/parc/nouvelle" },
    async () => {
      await page.goto(`/parc/nouvelle?client=${clientId}&site=${siteId}`);
      const familles = page.locator(
        '[data-champ="famille"] select option:not([value=""])',
      );
      if ((await familles.count()) > 0) {
        const valeur = await familles.first().getAttribute("value");
        await page
          .locator('[data-champ="famille"] select')
          .selectOption(valeur ?? "");
      }
      // `modele_id` EST OBLIGATOIRE côté serveur (lib/machines/saisie.ts:114,
      // `z.uuid()`) — n'importe quel modèle proposé convient, le premier
      // résultat du sélecteur suffit.
      await page
        .locator('[data-selecteur="modele_id"] input[type="text"]')
        .click();
      const premierModele = page
        .locator(
          '[data-selecteur="modele_id"] ul[role="listbox"] li[role="option"]',
        )
        .first();
      await expect(premierModele).toBeVisible();
      await premierModele.click();
      await page
        .locator('input[name="numero_serie"]')
        .fill(`SN-${PREFIXE}-${uuidv7().slice(0, 8)}`);
      await page
        .getByRole("button", { name: fr["machine.action.creer_la_machine"] })
        .click();
      await page.waitForLoadState("networkidle");
      const idDepuisUrl = /\/parc\/([0-9a-f-]{36})/.exec(page.url())?.[1];
      if (idDepuisUrl !== undefined) {
        machineId = idDepuisUrl;
      }
      await capturerDouble(page, "b03-machine-cree");
      if (machineId === "") {
        return {
          verdict: "anomalie",
          note: `machine non créée, url=${page.url()}`,
        };
      }
      return { note: `machine ${machineId}` };
    },
  );

  // 3. UNE DEMANDE, QUALIFIÉE PUIS TRANSFORMÉE EN INTERVENTION.
  await etape(
    { etape: "créer une demande", role: "adv", ecran: "/demandes" },
    async () => {
      await page.goto("/demandes?nouvelle=1");
      const source = page.locator('label:has(input[name="source"])').first();
      await source.click();
      await choisirResultatParTexte(
        page,
        "client_id",
        raisonSociale,
        raisonSociale,
      );
      await choisirResultatParTexte(
        page,
        "site_id",
        libelleSiteDucos,
        libelleSiteDucos,
      );
      await page
        .locator('textarea[name="description"]')
        .fill(`${PREFIXE} — demande d'audit de bout en bout`);
      await page
        .getByRole("button", { name: fr["demandes.volet.valider"] })
        .click();
      await page.waitForLoadState("networkidle");
      // Succès → `/demandes?creee={id}` (app/api/demandes/creer/route.ts:71),
      // jamais `/demandes/{id}` — un refus reste sur `/demandes?...` SANS ce
      // paramètre.
      demandeId = new URL(page.url()).searchParams.get("creee") ?? "";
      await capturerDouble(page, "b04-demande-creee");
      if (demandeId === "") {
        return {
          verdict: "anomalie",
          note: `demande non créée, url=${page.url()}`,
        };
      }
      return { note: `demande ${demandeId}` };
    },
  );

  await etape(
    {
      etape: "qualifier puis transformer la demande en intervention",
      role: "adv",
      ecran: `/demandes/${demandeId}`,
    },
    async () => {
      if (demandeId === "") {
        return { verdict: "bloquant", note: "pas de demande à qualifier" };
      }
      await page.goto(`/demandes/${demandeId}`);
      await page
        .locator('form[action="/api/demandes/' + demandeId + '/qualifier"]')
        .getByRole("button")
        .click();
      await page.waitForLoadState("networkidle");
      await page.locator('select[name="type"]').selectOption("curatif");
      await choisirPriorite(page, "p2");
      await page
        .locator('textarea[name="description"]')
        .fill(`${PREFIXE} — intervention née de la demande`);
      await page
        .getByRole("button", { name: fr["demandes.fiche.creer_intervention"] })
        .click();
      await page.waitForLoadState("networkidle");
      interventionId =
        /\/interventions\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
      await capturerDouble(page, "b05-demande-transformee");
      return { note: `intervention ${interventionId || "(id non lu)"}` };
    },
  );

  // Repli : si la demande n'a pas abouti à une intervention, on en crée une
  // directement — le reste du fil (planifier, transmettre, terrain) en a besoin.
  if (interventionId === "") {
    await etape(
      {
        etape: "repli — créer l'intervention directement",
        role: "adv",
        ecran: "/interventions/nouvelle",
      },
      async () => {
        await page.goto("/interventions/nouvelle");
        await choisirResultatParTexte(
          page,
          "site",
          libelleSiteDucos,
          libelleSiteDucos,
        );
        await page.locator('select[name="type"]').selectOption("curatif");
        await choisirPriorite(page, "p2");
        await page
          .locator('textarea[name="description"]')
          .fill(`${PREFIXE} — intervention créée directement (repli)`);
        await page
          .locator("#contenu")
          .getByRole("button", { name: fr["intervention.action.creer"] })
          .click();
        await page.waitForLoadState("networkidle");
        interventionId =
          /\/interventions\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
        return { note: `intervention ${interventionId || "(id non lu)"}` };
      },
    );
  }

  // 4. PLANIFIER, EN GLISSANT SUR UN JOUR FUTUR.
  await etape(
    {
      etape: "planifier en glissant sur un jour futur",
      role: "adv",
      ecran: "/planning",
    },
    async () => {
      if (interventionId === "") {
        return { verdict: "bloquant", note: "pas d'intervention à planifier" };
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      const dansDixJours = new Date();
      dansDixJours.setUTCDate(dansDixJours.getUTCDate() + 10);
      const lundiVise = new Date(dansDixJours);
      lundiVise.setUTCDate(lundiVise.getUTCDate() - lundiVise.getUTCDay() + 1);
      const cleLundi = lundiVise.toISOString().slice(0, 10);
      await page.goto(`/planning?vue=semaine&semaine=${cleLundi}`);
      const carte = page.locator(`[data-bloc="${interventionId}"]`);
      await expect(carte).toBeVisible({ timeout: 15_000 });
      const caseCible = page
        .locator(
          `td[data-depot-jour][data-depot-technicien="${technicienDucosId}"]`,
        )
        .first();
      if ((await caseCible.count()) === 0) {
        return {
          verdict: "anomalie",
          note: "aucune case de dépôt pour le technicien ZZ",
        };
      }
      await glisser(page, carte, caseCible);
      const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
      if (!(await fenetre.isVisible().catch(() => false))) {
        return {
          verdict: "anomalie",
          note: "la fenêtre de pose ne s'est pas ouverte",
        };
      }
      // DEUX CHOIX PAR PASTILLES, PAS DES CHAMPS (`components/planning/
      // fenetre-pose.tsx`) : une durée d'abord — ce qui fait apparaître le
      // bloc « Heure » — puis un créneau proposé.
      const dureeFieldset = fenetre
        .locator("fieldset")
        .filter({ hasText: fr["planning.pose.duree"] });
      await dureeFieldset.locator('button[type="button"]').first().click();
      const heureFieldset = fenetre
        .locator("fieldset")
        .filter({ hasText: fr["planning.pose.heure"] });
      await heureFieldset
        .locator('button[type="button"][aria-pressed]')
        .first()
        .click({ timeout: 10_000 })
        .catch(async () => {
          // Aucun créneau proposé — saisie manuelle de l'heure.
          await heureFieldset.locator('input[type="time"]').fill("10:00");
        });
      const boutonConfirmer = fenetre.getByRole("button", {
        name: fr["planning.pose.confirmer"],
        exact: true,
      });
      await capturerDouble(page, "b06-fenetre-pose");
      if (await boutonConfirmer.isDisabled().catch(() => true)) {
        return {
          verdict: "anomalie",
          note: "« Planifier » reste inactif après le glisser",
        };
      }
      await boutonConfirmer.click();
      await page.waitForLoadState("networkidle");
      return undefined;
    },
  );

  // 5. TRANSMETTRE AU TECHNICIEN ZZ.
  await etape(
    {
      etape: "transmettre au technicien",
      role: "adv",
      ecran: `/interventions/${interventionId}`,
    },
    async () => {
      if (interventionId === "") {
        return {
          verdict: "bloquant",
          note: "pas d'intervention à transmettre",
        };
      }
      await page.goto(`/interventions/${interventionId}`);
      const boutonTransmettre = page.getByRole("button", {
        name: fr["intervention.action.transmettre"],
      });
      if (!(await boutonTransmettre.isVisible().catch(() => false))) {
        return {
          verdict: "anomalie",
          note: "pas de bouton Transmettre — l'intervention n'est peut-être pas planifiée",
        };
      }
      await boutonTransmettre.click();
      const confirmer = dialogueOuvert(page).getByRole("button", {
        name: fr["intervention.action.transmettre"],
      });
      await confirmer.click();
      await page.waitForLoadState("networkidle");
      instantTransmission = Date.now();
      await capturerDouble(page, "b07-transmise");
      return undefined;
    },
  );

  // 6. REGISTRE ET RECHERCHE GLOBALE — lecture seule.
  await etape(
    { etape: "lecture du registre", role: "adv", ecran: "/interventions" },
    async () => {
      await page.goto("/interventions?vue=toutes");
      await page.waitForLoadState("networkidle");
      await capturerDouble(page, "b08-registre");
    },
  );

  await etape(
    { etape: "recherche globale", role: "adv", ecran: "/interventions" },
    async () => {
      const champRecherche = page.locator(
        'input[type="search"], [data-recherche-globale] input',
      );
      if ((await champRecherche.count()) === 0) {
        return {
          verdict: "anomalie",
          note: "aucun champ de recherche globale trouvé sur l'écran",
        };
      }
      await champRecherche.first().fill(PREFIXE);
      await page.waitForTimeout(500);
      await capturerDouble(page, "b09-recherche-globale");
      return undefined;
    },
  );

  // ─── C — LE TECHNICIEN, DANS LE SECOND CONTEXTE, À 375 px ─────────────────

  const pt = pageTechnicien;
  if (pt === null) {
    await etape(
      { etape: "constat C annulé", role: "technicien", ecran: "/terrain" },
      async () => ({
        verdict: "bloquant",
        note: "la page technicien n'a jamais été ouverte",
      }),
    );
    return;
  }

  await pt.setViewportSize({ width: 375, height: 812 });

  // C1 — L'ANNONCE, SANS JAMAIS RECHARGER LA PAGE.
  await etape(
    {
      etape: "l'annonce arrive seule, sans recharger (D130)",
      role: "technicien",
      ecran: "/terrain",
    },
    async () => {
      if (interventionId === "" || instantTransmission === 0) {
        return {
          verdict: "bloquant",
          note: "pas d'intervention transmise à observer",
        };
      }
      const carteCible = pt.locator(`a[href="/terrain/${interventionId}"]`);
      const badge = carteCible.getByText(fr["terrain.badge_nouveau"]);
      const debut = Date.now();
      const PLAFOND_MS = 180_000;
      let vue = false;
      while (Date.now() - debut < PLAFOND_MS) {
        if (await badge.isVisible().catch(() => false)) {
          vue = true;
          break;
        }
        await pt.waitForTimeout(5_000);
      }
      delaiAnnonceMs = Date.now() - instantTransmission;
      await capturerDouble(pt, "c01-annonce");
      if (!vue) {
        // Le ticket nomme lui-même ce seuil « anomalie chiffrée », pas un
        // bloquant — la minuterie de `RafraichissementAutomatique`
        // (`components/terrain/rafraichissement-auto.tsx`) exige
        // `document.visibilityState === "visible"`, et une page SECONDAIRE
        // ouverte par `browser.newPage()` peut rester « hidden » tout du
        // long sous Playwright sans qu'un humain, lui, n'ait jamais quitté
        // l'onglet — à vérifier manuellement avant de le tenir pour acquis.
        return {
          verdict: "anomalie",
          note: `aucune apparition en ${Math.round(PLAFOND_MS / 1000)} s (sans jamais recharger la page) — possible artefact de visibilité d'onglet sous Playwright (RafraichissementAutomatique exige document.visibilityState === "visible"), à vérifier manuellement`,
        };
      }
      return {
        note: `annonce visible après ${Math.round(delaiAnnonceMs / 1000)} s, sans rechargement`,
      };
    },
  );

  // C2 — DÉMARRER, LE COMPTEUR À +5s / +65s / +125s.
  function hmsVersSecondes(texte: string): number | null {
    const m = /(\d{2}):(\d{2}):(\d{2})/.exec(texte);
    if (m === null) return null;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }

  let instantDemarrage = 0;
  await etape(
    {
      etape: "démarrer l'intervention",
      role: "technicien",
      ecran: `/terrain/${interventionId}`,
    },
    async () => {
      if (interventionId === "")
        return { verdict: "bloquant", note: "pas d'intervention" };
      await pt.goto(`/terrain/${interventionId}`);
      await pt.waitForLoadState("networkidle");
      const boutonDemarrer = pt.getByRole("button", {
        name: fr["terrain.compteur.demarrer"],
      });
      if (!(await boutonDemarrer.isVisible().catch(() => false))) {
        return {
          verdict: "bloquant",
          note: "pas de bouton Démarrer sur la fiche",
        };
      }
      await boutonDemarrer.click();
      instantDemarrage = Date.now();
      await pt.waitForLoadState("networkidle");
      await capturerDouble(pt, "c02-demarre");
    },
  );

  const releves: string[] = [];
  for (const cible of [5, 65, 125]) {
    await etape(
      {
        etape: `compteur affiché à +${cible}s (constat D130)`,
        role: "technicien",
        ecran: `/terrain/${interventionId}`,
      },
      async () => {
        if (instantDemarrage === 0)
          return { verdict: "bloquant", note: "compteur jamais démarré" };
        const aAttendre = instantDemarrage + cible * 1000 - Date.now();
        if (aAttendre > 0) await pt.waitForTimeout(aAttendre);
        const compteurVivant = pt.locator("p.tabular-nums.font-extrabold");
        const texte =
          (await compteurVivant
            .first()
            .textContent()
            .catch(() => null)) ?? "(absent)";
        releves.push(`+${cible}s → ${texte}`);
        const secondes = hmsVersSecondes(texte);
        const ecouleReel = Math.round((Date.now() - instantDemarrage) / 1000);
        if (secondes === null) {
          return {
            verdict: "anomalie",
            note: `affichage « ${texte} » illisible en HH:MM:SS`,
          };
        }
        if (secondes === 0) {
          return {
            verdict: "bloquant",
            note: `l'affichage reste à 0 alors que ${ecouleReel}s se sont écoulées (constat D130)`,
          };
        }
        return {
          note: `affiche ${texte} pour ${ecouleReel}s écoulées réellement`,
        };
      },
    );
  }
  await capturerDouble(pt, "c03-compteur-releves");

  await etape(
    {
      etape: "pause puis reprise du compteur",
      role: "technicien",
      ecran: `/terrain/${interventionId}`,
    },
    async () => {
      const boutonPause = pt.getByRole("button", {
        name: fr["terrain.compteur.pause"],
      });
      if (!(await boutonPause.isVisible().catch(() => false))) {
        return { verdict: "anomalie", note: "pas de bouton Pause" };
      }
      await boutonPause.click();
      await pt.waitForLoadState("networkidle");
      const boutonReprendre = pt.getByRole("button", {
        name: fr["terrain.compteur.reprendre"],
      });
      const pausee = await boutonReprendre.isVisible().catch(() => false);
      if (!pausee) {
        return {
          verdict: "anomalie",
          note: "pas de bouton Reprendre après la pause",
        };
      }
      await boutonReprendre.click();
      await pt.waitForLoadState("networkidle");
      const repris = await pt
        .getByRole("button", { name: fr["terrain.compteur.pause"] })
        .isVisible()
        .catch(() => false);
      await capturerDouble(pt, "c04-pause-reprise");
      return repris
        ? undefined
        : { verdict: "anomalie", note: "le compteur ne semble pas reprendre" };
    },
  );

  await etape(
    {
      etape: "saisir le rapport",
      role: "technicien",
      ecran: `/terrain/${interventionId}`,
    },
    async () => {
      const commentaire = pt.getByLabel(
        fr["terrain.rapport.commentaire_libelle"],
      );
      if ((await commentaire.count()) === 0) {
        return { verdict: "anomalie", note: "champ commentaire absent" };
      }
      await commentaire.fill(
        `${PREFIXE} — rapport saisi pendant l'audit navigateur`,
      );
      await pt
        .getByLabel(fr["terrain.rapport.suite_libelle"])
        .fill(`${PREFIXE} — aucune suite`);
      await commentaire.blur();
      await capturerDouble(pt, "c05-rapport");
    },
  );

  await etape(
    {
      etape: "ajouter une photo",
      role: "technicien",
      ecran: `/terrain/${interventionId}`,
    },
    async () => {
      const champFichier = pt.locator('input[type="file"]');
      if ((await champFichier.count()) === 0) {
        return { verdict: "anomalie", note: "pas de champ d'ajout de photo" };
      }
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      );
      const chemin = join(DOSSIER_CAPTURES, "zz9f8-photo.png");
      writeFileSync(chemin, png);
      await champFichier.setInputFiles(chemin);
      const boutonAjouter = pt.getByRole("button", {
        name: fr["terrain.photos.ajouter"],
      });
      if (await boutonAjouter.isVisible().catch(() => false)) {
        await boutonAjouter.click();
      }
      await pt.waitForLoadState("networkidle");
      await capturerDouble(pt, "c06-photo");
    },
  );

  await etape(
    {
      etape: "signer",
      role: "technicien",
      ecran: `/terrain/${interventionId}`,
    },
    async () => {
      const optionSignee = pt.getByRole("button", {
        name: fr["terrain.signature.option_signee"],
      });
      if (await optionSignee.isVisible().catch(() => false)) {
        await optionSignee.click();
      }
      const nomSignataire = pt.getByLabel(fr["terrain.signature.nom_libelle"]);
      if ((await nomSignataire.count()) > 0) {
        await nomSignataire.fill(`${PREFIXE} Signataire`);
        await pt
          .getByLabel(fr["terrain.signature.qualite_libelle"])
          .fill("Responsable ZZ");
        const canevas = pt.locator("canvas");
        if ((await canevas.count()) > 0) {
          await canevas.first().evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const envoyer = (type: string, x: number, y: number): void => {
              element.dispatchEvent(
                new PointerEvent(type, {
                  bubbles: true,
                  clientX: rect.left + x,
                  clientY: rect.top + y,
                  pointerId: 1,
                }),
              );
            };
            envoyer("pointerdown", 10, 10);
            envoyer("pointermove", 60, 40);
            envoyer("pointerup", 60, 40);
          });
        }
      } else {
        return { verdict: "anomalie", note: "pas de formulaire de signature" };
      }
      await capturerDouble(pt, "c07-signature");
    },
  );

  await etape(
    {
      etape: "terminer l'intervention",
      role: "technicien",
      ecran: `/terrain/${interventionId}`,
    },
    async () => {
      const boutonTerminer = pt.getByRole("button", {
        name: fr["terrain.terminer.bouton"],
      });
      if (!(await boutonTerminer.isVisible().catch(() => false))) {
        return { verdict: "anomalie", note: "pas de bouton Terminer" };
      }
      await boutonTerminer.click();
      await pt.waitForLoadState("networkidle");
      await capturerDouble(pt, "c08-terminee");
      const termine = await pt
        .getByText(fr["statut.terminee"], { exact: true })
        .isVisible()
        .catch(() => false);
      return termine
        ? undefined
        : {
            verdict: "anomalie",
            note: "le statut « Terminée » n'apparaît pas",
          };
    },
  );

  await etape(
    { etape: "profil", role: "technicien", ecran: "/terrain/profil" },
    async () => {
      await pt.goto("/terrain/profil");
      await pt.waitForLoadState("networkidle");
      await capturerDouble(pt, "c09-profil");
    },
  );

  await etape(
    {
      etape: "déconnexion avec une saisie non envoyée → confirmation attendue",
      role: "technicien",
      ecran: "/terrain",
    },
    async () => {
      await pt.goto("/terrain");
      await pt.waitForLoadState("networkidle");
      await pt.context().setOffline(true);
      try {
        await pt.goto(`/terrain/${interventionId}`);
        const suite = pt.getByLabel(fr["terrain.rapport.suite_libelle"]);
        if ((await suite.count()) > 0) {
          await suite.fill(
            `${PREFIXE} — note non envoyée (hors réseau, exprès)`,
          );
          await suite.blur();
          await pt.waitForTimeout(1_000);
        }
        const lienDeconnexion = pt.getByRole("button", {
          name: fr["nav.deconnexion"],
        });
        if ((await lienDeconnexion.count()) === 0) {
          return {
            verdict: "anomalie",
            note: "pas de bouton de déconnexion trouvé",
          };
        }
        await lienDeconnexion.first().click();
        const confirmation = pt.getByRole("alertdialog");
        const vue = await confirmation
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        await capturerDouble(pt, "c10-deconnexion-confirmation");
        if (!vue) {
          return {
            verdict: "anomalie",
            note: "aucune confirmation posée malgré la saisie non envoyée",
          };
        }
        await pt
          .getByRole("button", {
            name: fr["terrain.deconnexion.deconnecter_quand_meme"],
          })
          .click();
        return { note: "confirmation posée, comme attendu" };
      } finally {
        await pt.context().setOffline(false);
      }
    },
  );

  await pt.close();
});

// ─── ÉTAPE D — SAV PUIS ADV ──────────────────────────────────────────────────

test("Étape D — SAV valide, ADV clôture et facture, montants selon le rôle", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  if (interventionId === "") {
    await etape(
      {
        etape: "étape D annulée",
        role: "responsable_sav",
        ecran: "/interventions",
      },
      async () => ({
        verdict: "bloquant",
        note: "aucune intervention issue du fil B+C",
      }),
    );
    return;
  }

  // UNE PAGE FRAÎCHE PAR IDENTITÉ, TOUJOURS — jamais la même page pour deux
  // rôles différents : `/connexion`, déjà authentifiée, redirige sans jamais
  // montrer le formulaire, et `.fill()` attend alors un champ qui ne viendra
  // jamais jusqu'au bout du délai du test (mesuré : 15 minutes perdues sur
  // CE défaut précis lors du premier passage).
  const pageSav = await browser.newPage();
  await etape(
    { etape: "connexion SAV", role: "responsable_sav", ecran: "/connexion" },
    async () => {
      await connecter(pageSav, "sav");
    },
  );

  await etape(
    {
      etape: "temps validé, rapport visible",
      role: "responsable_sav",
      ecran: `/interventions/${interventionId}`,
    },
    async () => {
      await pageSav.goto(`/interventions/${interventionId}`);
      await pageSav.waitForLoadState("networkidle");
      await capturerDouble(pageSav, "d01-sav-fiche");
    },
  );
  await pageSav.close();

  // Les montants, vus par CHAQUE rôle du fil — constat, pas un verdict en dur
  // (la matrice, `lib/auth/habilitations.ts`, donne `voir_montants_vente`
  // complet à DIR/RM/RS/ADV, pas seulement ADV : voir le rapport).
  for (const cle of [
    "adv",
    "sav",
    "materiel",
    "technicien",
    "admin",
  ] as const) {
    await etape(
      {
        etape: `montants de l'onglet valorisation, vus par ${COMPTES[cle].libelle}`,
        role: cle,
        ecran: `/interventions/${interventionId}?onglet=valorisation`,
      },
      async () => {
        const p = await browser.newPage();
        try {
          await connecter(p, cle);
          await p.goto(`/interventions/${interventionId}?onglet=valorisation`);
          await p.waitForLoadState("networkidle");
          const voitLeTotal = await p
            .getByText(fr["intervention.cloture.total"], { exact: true })
            .isVisible()
            .catch(() => false);
          const voitLeMotif = await p
            .getByText(fr["intervention.valorisation.sans_droit"])
            .isVisible()
            .catch(() => false);
          await capturerDouble(p, `d02-montants-${cle}`);
          return {
            note: `total visible: ${voitLeTotal} — motif « pas pour vous »: ${voitLeMotif}`,
          };
        } finally {
          await p.close();
        }
      },
    );
  }

  const pageAdv = await browser.newPage();
  await etape(
    {
      etape: "clôturer l'intervention",
      role: "adv",
      ecran: `/interventions/${interventionId}`,
    },
    async () => {
      await connecter(pageAdv, "adv");
      await pageAdv.goto(`/interventions/${interventionId}`);
      const boutonCloturer = pageAdv.getByRole("button", {
        name: fr["intervention.action.cloturer"],
      });
      if (!(await boutonCloturer.isVisible().catch(() => false))) {
        return {
          verdict: "anomalie",
          note: "pas de bouton Clôturer — statut probablement pas encore Terminée",
        };
      }
      await boutonCloturer.click();
      const dialogue = pageAdv.locator("dialog[open]");
      await dialogue
        .getByRole("button", { name: fr["intervention.action.cloturer"] })
        .click();
      await pageAdv.waitForLoadState("networkidle");
      await capturerDouble(pageAdv, "d03-cloturee");
    },
  );

  await etape(
    {
      etape: "le bon (client et interne)",
      role: "adv",
      ecran: `/interventions/${interventionId}/bon`,
    },
    async () => {
      const reponse = await pageAdv.goto(
        `/interventions/${interventionId}/bon`,
      );
      const statut = reponse?.status() ?? 0;
      await capturerDouble(pageAdv, "d04-bon");
      if (statut !== 200) {
        return { verdict: "bloquant", note: `le bon rend ${statut}` };
      }
      return { note: `bon rendu (${statut})` };
    },
  );

  await etape(
    { etape: "À facturer", role: "adv", ecran: "/interventions/a-facturer" },
    async () => {
      await pageAdv.goto("/interventions/a-facturer");
      await pageAdv.waitForLoadState("networkidle");
      const presente =
        (await pageAdv.locator("body").textContent())?.includes(PREFIXE) ??
        false;
      await capturerDouble(pageAdv, "d05-a-facturer");
      return {
        note: presente
          ? "l'intervention ZZ apparaît dans À facturer"
          : "l'intervention ZZ n'apparaît pas (peut être normal selon l'état du bon)",
      };
    },
  );
  await pageAdv.close();
});

// ─── ÉTAPE E — MATÉRIEL ──────────────────────────────────────────────────────

test("Étape E — ZZ TEST Matériel : parc, fiche machine, VGP, familles à déterminer", async ({
  page,
}) => {
  await etape(
    { etape: "connexion", role: "responsable_materiel", ecran: "/connexion" },
    async () => {
      await connecter(page, "materiel");
    },
  );

  await etape(
    { etape: "lecture du parc", role: "responsable_materiel", ecran: "/parc" },
    async () => {
      await page.goto("/parc");
      await page.waitForLoadState("networkidle");
      await capturerDouble(page, "e01-parc");
    },
  );

  await etape(
    {
      etape: "fiche de la machine ZZ",
      role: "responsable_materiel",
      ecran: `/parc/${machineId}`,
    },
    async () => {
      if (machineId === "")
        return { verdict: "bloquant", note: "pas de machine ZZ créée" };
      await page.goto(`/parc/${machineId}`);
      await page.waitForLoadState("networkidle");
      await capturerDouble(page, "e02-fiche-machine");
    },
  );

  await etape(
    {
      etape: "enregistrer une vérification VGP sur la machine ZZ",
      role: "responsable_materiel",
      ecran: `/vgp/enregistrer/${machineId}`,
    },
    async () => {
      if (machineId === "")
        return { verdict: "bloquant", note: "pas de machine ZZ créée" };
      await page.goto(`/vgp/enregistrer/${machineId}`);
      await page.waitForLoadState("networkidle");
      const formulaire = page.locator('form[action*="/api/vgp/enregistrer/"]');
      if ((await formulaire.count()) === 0) {
        return {
          verdict: "anomalie",
          note: "pas de formulaire d'enregistrement VGP sur cette machine",
        };
      }
      const aujourdHui = new Date().toISOString().slice(0, 10);
      await formulaire
        .locator('input[name="date_verification"]')
        .fill(aujourdHui);
      await formulaire
        .locator('select[name="origine"]')
        .selectOption({ index: 1 });
      await formulaire
        .locator('input[name="organisme"]')
        .fill(`${PREFIXE} Organisme`);
      await formulaire
        .locator('input[name="reference_rapport"]')
        .fill(`${PREFIXE}-RAPPORT`);
      await capturerDouble(page, "e03-vgp-formulaire");
      await formulaire
        .getByRole("button", { name: fr["vgp.verifier.enregistrer"] })
        .click();
      await page.waitForLoadState("networkidle");
      await capturerDouble(page, "e04-vgp-enregistre");
    },
  );

  await etape(
    {
      etape: "familles à déterminer",
      role: "responsable_materiel",
      ecran: "/vgp/a-determiner",
    },
    async () => {
      await page.goto("/vgp/a-determiner");
      await page.waitForLoadState("networkidle");
      await capturerDouble(page, "e05-familles-a-determiner");
    },
  );
});

// ─── ÉTAPE F — DIRECTION ─────────────────────────────────────────────────────

let techniciensAbsenceId = "";
let absencePoseeId = "";

test("Étape F — ZZ TEST Direction : tableau de bord, indicateurs, absences", async ({
  page,
}) => {
  await etape(
    { etape: "connexion", role: "direction", ecran: "/connexion" },
    async () => {
      await connecter(page, "direction");
    },
  );

  for (const [chemin, nom] of [
    ["/tableau-de-bord", "f01-tableau-de-bord"],
    ["/indicateurs", "f02-indicateurs"],
  ] as const) {
    await etape(
      { etape: `lecture de ${chemin}`, role: "direction", ecran: chemin },
      async () => {
        await page.goto(chemin);
        await page.waitForLoadState("networkidle");
        await capturerDouble(page, nom);
      },
    );
  }

  techniciensAbsenceId = technicienDucosId;

  await etape(
    {
      etape: "déclarer une absence du technicien ZZ",
      role: "direction",
      ecran: "/absences",
    },
    async () => {
      if (techniciensAbsenceId === "")
        return { verdict: "bloquant", note: "pas de technicien ZZ identifié" };
      await page.goto("/absences");
      await page.waitForLoadState("networkidle");
      const lienDeclarer = page.getByRole("link", {
        name: fr["absences.declarer_entete"],
      });
      if (await lienDeclarer.isVisible().catch(() => false)) {
        await lienDeclarer.click();
      }
      const select = page.locator('select[name="utilisateur_id"]').first();
      if ((await select.count()) === 0) {
        return {
          verdict: "anomalie",
          note: "pas de formulaire de déclaration d'absence",
        };
      }
      await select.selectOption(techniciensAbsenceId);
      const dansDixJours = new Date();
      dansDixJours.setUTCDate(dansDixJours.getUTCDate() + 10);
      const cle = dansDixJours.toISOString().slice(0, 10);
      await page.locator('input[name="du"]').first().fill(cle);
      await page.locator('input[name="au"]').first().fill(cle);
      await capturerDouble(page, "f03-absence-formulaire");
      await page
        .locator('form[action="/api/absences/declarer"]')
        .getByRole("button", { name: fr["absences.declarer_action"] })
        .click();
      await page.waitForLoadState("networkidle");
      await capturerDouble(page, "f04-absence-declaree");
      const client = admin();
      try {
        const absence = await client.absence.findFirst({
          where: { utilisateur_id: techniciensAbsenceId },
          orderBy: { id: "desc" },
          select: { id: true },
        });
        absencePoseeId = absence?.id ?? "";
      } finally {
        await client.$disconnect();
      }
      return {
        note:
          absencePoseeId === ""
            ? "absence non retrouvée en base"
            : `absence ${absencePoseeId}`,
      };
    },
  );

  await etape(
    {
      etape: "supprimer l'absence du technicien ZZ",
      role: "direction",
      ecran: "/absences",
    },
    async () => {
      if (absencePoseeId === "")
        return { verdict: "bloquant", note: "pas d'absence à supprimer" };
      await page.goto("/absences");
      const formulaire = page
        .locator('form[action="/api/absences/lever"]')
        .filter({ has: page.locator(`input[value="${absencePoseeId}"]`) });
      if ((await formulaire.count()) === 0) {
        return {
          verdict: "anomalie",
          note: "pas de formulaire de suppression trouvé pour cette absence",
        };
      }
      await formulaire
        .getByRole("button", { name: fr["absences.lever"] })
        .click();
      const confirmer = page.getByRole("button", {
        name: fr["absences.levee_confirmer"],
      });
      if (await confirmer.isVisible().catch(() => false)) {
        await confirmer.click();
      }
      await page.waitForLoadState("networkidle");
      await capturerDouble(page, "f05-absence-supprimee");
    },
  );
});

// ─── ÉTAPE G — CLOISONNEMENT VU DU NAVIGATEUR ───────────────────────────────

test("Étape G — cloisonnement : chaque rôle tente un écran hors de sa portée", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const bureauVersTerrain: readonly CleCompte[] = [
    "adv",
    "sav",
    "materiel",
    "direction",
    "admin",
  ];
  for (const cle of bureauVersTerrain) {
    await etape(
      {
        etape: `${COMPTES[cle].libelle} tente /terrain (réservé au technicien)`,
        role: cle,
        ecran: "/terrain",
      },
      async () => {
        // UNE PAGE FRAÎCHE PAR IDENTITÉ — voir la note de tête de l'étape D.
        const page = await browser.newPage();
        try {
          await connecter(page, cle);
          const reponse = await page.goto("/terrain");
          const statut = reponse?.status() ?? 0;
          await page.waitForLoadState("networkidle");
          const refusNomme = await page
            .getByRole("status")
            .filter({ hasText: fr["terrain.reserve.titre"] })
            .isVisible()
            .catch(() => false);
          await capturerDouble(page, `g-${cle}-vers-terrain`);
          if (statut >= 500) {
            return {
              verdict: "bloquant",
              note: `réponse ${statut} — une erreur serveur, pas un refus propre`,
            };
          }
          return refusNomme
            ? { note: "refus propre (ReserveAuxTechniciens)" }
            : {
                verdict: "anomalie",
                note: "pas de refus nommé visible, à vérifier manuellement",
              };
        } finally {
          await page.close();
        }
      },
    );
  }

  await etape(
    {
      etape: `${COMPTES.technicien.libelle} tente /parametres/equipe (réservé à l'administration)`,
      role: "technicien",
      ecran: "/parametres/equipe",
    },
    async () => {
      const page = await browser.newPage();
      try {
        await connecter(page, "technicien");
        const reponse = await page.goto("/parametres/equipe");
        const statut = reponse?.status() ?? 0;
        await page.waitForLoadState("networkidle");
        const voitUnCompte = await page
          .getByText(COMPTES.adv.courriel)
          .isVisible()
          .catch(() => false);
        await capturerDouble(page, "g-technicien-vers-equipe");
        if (statut >= 500 || voitUnCompte) {
          return {
            verdict: "bloquant",
            note: voitUnCompte
              ? "une donnée d'équipe est visible !"
              : `réponse ${statut}`,
          };
        }
        return {
          note: "pas de donnée d'équipe visible — refus présumé propre",
        };
      } finally {
        await page.close();
      }
    },
  );
});

// ─── RAPPORT FINAL ───────────────────────────────────────────────────────────

test("Rapport — écrit parcours.json et rapport.md", async () => {
  await fermerCompteDirectionAudit().catch(() => undefined);

  mkdirSync(DOSSIER, { recursive: true });
  writeFileSync(
    join(DOSSIER, "parcours.json"),
    JSON.stringify(CONSTATS, null, 2),
    "utf8",
  );

  const bloquants = CONSTATS.filter((c) => c.verdict === "bloquant");
  const anomalies = CONSTATS.filter((c) => c.verdict === "anomalie");

  const lignes: string[] = [];
  lignes.push("# 9F8-AUDIT-NAVIGATEUR-BOUT-EN-BOUT — rapport");
  lignes.push("");
  lignes.push(
    `Généré par \`pnpm audit:fonctionnel\` (\`tests/audit-fonctionnel/parcours-navigateur-9f8.spec.ts\`). ${CONSTATS.length} étapes, ${bloquants.length} bloquant(s), ${anomalies.length} anomalie(s).`,
  );
  lignes.push("");
  lignes.push("## Constats D130 (mesures chiffrées)");
  lignes.push("");
  lignes.push(
    `- **Annonce sans recharger** : délai mesuré = ${delaiAnnonceMs === null ? "non mesuré" : `${Math.round(delaiAnnonceMs / 1000)} s`}.`,
  );
  const releveCompteur = CONSTATS.filter((c) =>
    c.etape.includes("compteur affiché"),
  );
  for (const c of releveCompteur) {
    lignes.push(`- **Compteur** — ${c.etape} : [${c.verdict}] ${c.note ?? ""}`);
  }
  const deco = CONSTATS.find((c) => c.etape.includes("saisie non envoyée"));
  lignes.push(
    `- **Déconnexion avec saisie non envoyée** : [${deco?.verdict ?? "non parcouru"}] ${deco?.note ?? ""}`,
  );
  lignes.push("");

  lignes.push(
    "## Constat — montants de vente par rôle (D37, lib/auth/habilitations.ts:198)",
  );
  lignes.push("");
  lignes.push(
    "Le ticket attendait « montants visibles pour ADV seulement ». La matrice (`lib/auth/habilitations.ts`, " +
      "`voir_montants_vente: { complet: [DIR, RM, RS, ADV] }`, ligne ~198) donne ce droit à QUATRE rôles, pas un seul : " +
      "direction, responsable matériel, responsable SAV et ADV le voient tous ; seuls `admin_societe` et `technicien` " +
      "lisent le motif « pas pour vous » à la place. Un montant vu par RM ou RS est donc CONFORME à la règle de rang 2 " +
      "(chapitre 10 via la matrice), pas un bloquant — signalé ici plutôt que classé à tort.",
  );
  lignes.push("");
  for (const c of CONSTATS.filter((c) =>
    c.etape.startsWith("montants de l'onglet"),
  )) {
    lignes.push(`- ${c.etape} : [${c.verdict}] ${c.note ?? ""}`);
  }
  lignes.push("");

  lignes.push("## Toutes les étapes");
  lignes.push("");
  lignes.push("| # | Rôle | Écran | Étape | Verdict | Durée (ms) | Note |");
  lignes.push("|---|---|---|---|---|---|---|");
  for (const c of CONSTATS) {
    lignes.push(
      `| ${c.numero} | ${c.role} | \`${c.ecran}\` | ${c.etape} | ${c.verdict} | ${c.dureeMs} | ${(c.note ?? "").replace(/\|/g, "\\|").slice(0, 200)} |`,
    );
  }
  lignes.push("");

  lignes.push("## Bloquants");
  lignes.push("");
  if (bloquants.length === 0) {
    lignes.push("Aucun.");
  } else {
    for (const c of bloquants) {
      lignes.push(
        `- **#${c.numero}** (${c.role}, \`${c.ecran}\`) — ${c.etape} : ${c.note ?? "(sans détail)"}`,
      );
    }
  }
  lignes.push("");

  lignes.push("## Anomalies");
  lignes.push("");
  if (anomalies.length === 0) {
    lignes.push("Aucune.");
  } else {
    for (const c of anomalies) {
      lignes.push(
        `- **#${c.numero}** (${c.role}, \`${c.ecran}\`) — ${c.etape} : ${c.note ?? "(sans détail)"}`,
      );
    }
  }
  lignes.push("");

  lignes.push("## Comptes ZZ ouverts par l'interface");
  lignes.push("");
  for (const [cle, compte] of Object.entries(COMPTES)) {
    lignes.push(
      `- ${compte.libelle} (${cle}) : ${compte.ouvert ? "ouvert par l'interface" : `ÉCHEC — repli sur le compte de la scène (${REPLI[cle as CleCompte]})`}`,
    );
  }
  lignes.push("");

  writeFileSync(join(DOSSIER, "rapport.md"), lignes.join("\n") + "\n", "utf8");
});
