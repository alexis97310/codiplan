import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille } from "@/lib/excel/controle";
import { appliquerLeLotDeClients } from "@/lib/imports/application";
import {
  allersRetoursApplication,
  DUREE_MAXIMALE_MS,
  LATENCE_PESSIMISTE_MS,
} from "@/lib/imports/delais";
import { enregistrerLeControle } from "@/lib/imports/depot";
import { MODELE_CLIENTS, marqueurDu } from "@/lib/imports/modeles";
import { indexerLeParcClients } from "@/lib/imports/parc-clients";
import { DEVISES, SOCIETES } from "@/prisma/seed-data";

/**
 * IMPORT-2 — LE PLAFOND EST UN BUDGET, JAMAIS UNE MESURE.
 *
 * Ce script mesure — il ne change AUCUNE constante de `lib/imports/delais.ts`
 * ni de `lib/imports/application.ts`. Il rejoue le chemin de PRODUCTION,
 * traversé jusqu'à l'écriture, exactement comme
 * `tests/isolation/application-import.test.ts` : contrôle → enregistrement du
 * lot → `appliquerLeLotDeClients`, sous le rôle applicatif restreint
 * (`codiplan_app`), sur une base PostgreSQL locale et jetable — jamais Neon.
 *
 * **Pourquoi « clients » et pas « historique » ou « VGP », qui sont les
 * imports RÉELS d'Alexis** : `appliquerLeLotDeHistorique`,
 * `appliquerLeLotDeVgp` et `appliquerLeLotDeVgp_observations` ne savent QUE
 * créer (`preparerModification: () => ({ prete: false })`, mesuré dans
 * `lib/imports/application.ts`). « clients » est la seule entité simple à
 * amorcer (aucune clé étrangère hors société) qui traverse le MÊME moteur
 * générique (`appliquerLesLignes`) dans SES DEUX RÉGIMES — créations groupées
 * (`createMany`) et modifications ligne à ligne. Voir
 * `docs/propositions/23-IMPORT-2/mesure.md`, section « CE QUE CETTE MESURE NE
 * DIT PAS », pour ce que ce choix ne couvre pas.
 *
 * Usage : `TEST_DATABASE_URL=postgresql://... tsx scripts/mesure-delais-import.mts`
 * — la base doit déjà porter les migrations (`pnpm exec prisma migrate deploy`
 * contre cette URL), un cluster PostgreSQL local jetable au sens de
 * `scripts/postgres-jetable.sh`.
 */

const ROLE_APP = "codiplan_app";

function urlProprietaire(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL est requis — une base PostgreSQL locale et jetable, " +
        "jamais Neon (même garde-fou que tests/isolation/setup/global.ts).",
    );
  }
  if (/neon\.tech/i.test(url)) {
    throw new Error(
      "TEST_DATABASE_URL pointe vers Neon. Cette mesure exige une base locale " +
        "jetable : une mesure faite hors des conditions réelles ne mesure rien " +
        "(et une mesure faite CONTRE la production la met en danger).",
    );
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error(
      "TEST_DATABASE_URL est identique à DATABASE_URL — ce doit être une base " +
        "de test distincte.",
    );
  }
  return url;
}

function urlApplicative(urlProprietaireStr: string): string {
  const u = new URL(urlProprietaireStr);
  u.username = ROLE_APP;
  u.password = "";
  return u.toString();
}

// ── Fixtures minimales, déterministes et idempotentes (I9) ──────────────────
const SOCIETE_MESURE = "00000000-0000-7000-8000-00000fe50001";
const UTILISATEUR_MESURE = "00000000-0000-7000-8000-00000fe50002";
const UTILISATEUR_SOCIETE_MESURE = "00000000-0000-7000-8000-00000fe50003";

/**
 * Devise et société de RÉFÉRENCE, jamais réinventées ici : `decimales` (I3) et
 * `fuseau_horaire` (I7) sont des propriétés du référentiel, pas des littéraux
 * qu'un script écrirait de son côté — même règle que
 * `tests/unit/money/sans-decimales-en-dur.test.ts` et
 * `tests/unit/calendar/sans-fuseau-en-dur.test.ts`, qui exemptent
 * `prisma/seed-data.ts` et lui seul.
 */
function exiger<T>(valeur: T | undefined, message: string): T {
  if (valeur === undefined) {
    throw new Error(message);
  }
  return valeur;
}

const XPF = exiger(
  DEVISES.find((devise) => devise.code === "XPF"),
  "XPF est absent de DEVISES (prisma/seed-data.ts)",
);
const REFERENTIEL = exiger(
  SOCIETES[0],
  "SOCIETES est vide (prisma/seed-data.ts)",
);

async function amorcerLesFixtures(proprietaire: PrismaClient): Promise<void> {
  await proprietaire.devise.upsert({
    where: { code: XPF.code },
    update: {},
    create: { ...XPF },
  });
  await proprietaire.societe.upsert({
    where: { id: SOCIETE_MESURE },
    update: {},
    create: {
      id: SOCIETE_MESURE,
      code: "MESURE-IMPORT-2",
      raison_sociale: "Société de mesure — IMPORT-2 (données synthétiques)",
      pays: REFERENTIEL.pays,
      territoire: REFERENTIEL.territoire,
      fuseau_horaire: REFERENTIEL.fuseau_horaire,
      devise_code: REFERENTIEL.devise_code,
      majoration_hors_ouverture_pct: REFERENTIEL.majoration_hors_ouverture_pct,
      couleur_primaire: REFERENTIEL.couleur_primaire,
      couleur_secondaire: REFERENTIEL.couleur_secondaire,
      langue: REFERENTIEL.langue,
    },
  });
  await proprietaire.utilisateur.upsert({
    where: { id: UTILISATEUR_MESURE },
    update: {},
    create: {
      id: UTILISATEUR_MESURE,
      nom: "Compte de mesure IMPORT-2",
      email: "mesure-import-2@codiplan.invalid",
    },
  });
  await proprietaire.utilisateurSociete.upsert({
    where: { id: UTILISATEUR_SOCIETE_MESURE },
    update: {},
    create: {
      id: UTILISATEUR_SOCIETE_MESURE,
      utilisateur_id: UTILISATEUR_MESURE,
      societe_id: SOCIETE_MESURE,
      role: Role.adv,
    },
  });
}

const SESSION: ContexteSession = {
  utilisateurId: UTILISATEUR_MESURE,
  societeId: SOCIETE_MESURE,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

// ── Construction d'un classeur synthétique « clients » ──────────────────────

function construireFeuille(lignes: readonly (readonly string[])[]): FeuilleLue {
  return {
    nom: "Clients",
    lignes: [
      [{ texte: marqueurDu(MODELE_CLIENTS) }],
      MODELE_CLIENTS.colonnes.map((colonne) => ({ texte: colonne.nom })),
      ...lignes.map((ligne) => ligne.map((valeur) => ({ texte: valeur }))),
    ],
  };
}

/**
 * `nombreDeLignes` codes neufs, plus une densité de rejets réaliste (~2 %,
 * raison sociale vide — le motif de rejet le plus fréquent d'un tableur mal
 * rempli). `prefixe` isole chaque lot des autres lots du même passage.
 */
function lignesDeCreation(
  prefixe: string,
  nombreDeLignes: number,
): (readonly string[])[] {
  const rejets = Math.round(nombreDeLignes * 0.02);
  const lignes: (readonly string[])[] = [];
  for (let i = 0; i < nombreDeLignes; i += 1) {
    lignes.push([`${prefixe}-${i}`, `Client synthétique ${prefixe}-${i}`]);
  }
  for (let i = 0; i < rejets; i += 1) {
    lignes.push([`${prefixe}-REJET-${i}`, "   "]);
  }
  return lignes;
}

/** Les MÊMES codes, avec une raison sociale changée — de vraies modifications. */
function lignesDeModification(
  prefixe: string,
  nombreDeLignes: number,
): (readonly string[])[] {
  const lignes: (readonly string[])[] = [];
  for (let i = 0; i < nombreDeLignes; i += 1) {
    lignes.push([
      `${prefixe}-${i}`,
      `Client synthétique ${prefixe}-${i} — modifié`,
    ]);
  }
  return lignes;
}

async function controlerEtEnregistrer(
  lignes: readonly (readonly string[])[],
  client: PrismaClient,
): Promise<string> {
  const parc = await indexerLeParcClients(SESSION, client);
  const controle = controlerFeuille(
    construireFeuille(lignes),
    MODELE_CLIENTS,
    parc,
  );
  if (!controle.lisible) {
    throw new Error(
      "la feuille synthétique est illisible : " + JSON.stringify(controle),
    );
  }
  const { lotId } = await enregistrerLeControle(
    SESSION,
    {
      nom: "mesure-import-2.xlsx",
      type: MODELE_CLIENTS.type,
      version: MODELE_CLIENTS.version,
    },
    controle.lignes,
    client,
  );
  return lotId;
}

/** Applique un lot et rend sa durée en millisecondes — SEULE la transaction d'application est chronométrée. */
async function chronometrerApplication(
  lotId: string,
  client: PrismaClient,
): Promise<{
  readonly ms: number;
  readonly creations: number;
  readonly modifications: number;
}> {
  const debut = process.hrtime.bigint();
  const resultat = await appliquerLeLotDeClients(SESSION, lotId, client);
  const fin = process.hrtime.bigint();
  if (!resultat.applique) {
    throw new Error(`l'application a été refusée : ${resultat.motif}`);
  }
  return {
    ms: Number(fin - debut) / 1e6,
    creations: resultat.creations,
    modifications: resultat.modifications,
  };
}

type Mesure = {
  readonly regime: "creation" | "modification";
  readonly lignesRetenues: number;
  readonly ms: number;
};

async function mesurerCreation(
  runTag: string,
  taille: number,
  appClient: PrismaClient,
): Promise<Mesure> {
  const prefixe = `MES-${runTag}-C${taille}`;
  const lotId = await controlerEtEnregistrer(
    lignesDeCreation(prefixe, taille),
    appClient,
  );
  const { ms, creations } = await chronometrerApplication(lotId, appClient);
  if (creations !== taille) {
    throw new Error(
      `attendu ${taille} créations, obtenu ${creations} — le jeu d'essai est faux`,
    );
  }
  return { regime: "creation", lignesRetenues: taille, ms };
}

async function mesurerModification(
  runTag: string,
  taille: number,
  appClient: PrismaClient,
): Promise<Mesure> {
  const prefixe = `MES-${runTag}-M${taille}`;
  // Amorçage NON CHRONOMÉTRÉ : ce lot crée les fiches que le second va modifier.
  const lotCreation = await controlerEtEnregistrer(
    lignesDeCreation(prefixe, taille),
    appClient,
  );
  await appliquerLeLotDeClients(SESSION, lotCreation, appClient);

  const lotModification = await controlerEtEnregistrer(
    lignesDeModification(prefixe, taille),
    appClient,
  );
  const { ms, modifications } = await chronometrerApplication(
    lotModification,
    appClient,
  );
  if (modifications !== taille) {
    throw new Error(
      `attendu ${taille} modifications, obtenu ${modifications} — le jeu d'essai est faux`,
    );
  }
  return { regime: "modification", lignesRetenues: taille, ms };
}

// ── Extrapolation — PAS une mesure, une lecture de la pente mesurée ─────────

function extrapoler(mesures: readonly Mesure[]): {
  readonly msParLigne: number;
  readonly msSocle: number;
} {
  const tries = [...mesures].sort(
    (a, b) => a.lignesRetenues - b.lignesRetenues,
  );
  const premiere = tries[0];
  const derniere = tries[tries.length - 1];
  if (!premiere || !derniere || premiere === derniere) {
    return { msParLigne: 0, msSocle: derniere?.ms ?? 0 };
  }
  const msParLigne =
    (derniere.ms - premiere.ms) /
    (derniere.lignesRetenues - premiere.lignesRetenues);
  const msSocle = premiere.ms - msParLigne * premiere.lignesRetenues;
  return { msParLigne, msSocle };
}

function ligneDeCasse(msParLigne: number, msSocle: number): number | null {
  if (msParLigne <= 0) return null;
  return Math.ceil((DUREE_MAXIMALE_MS - msSocle) / msParLigne);
}

/**
 * Sépare les milliers par un espace, sans `toLocaleString` ni `Intl` — les
 * deux sont bannis d'un fichier applicatif par les gardiens monétaires et
 * calendaires (I3, I7), qui ne savent pas distinguer un nombre de lignes d'un
 * montant ou d'une date à la seule lecture du texte source.
 */
function formaterMillier(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Même raison que `formaterMillier` : `.toFixed` est banni (I3), même hors montant. */
function formaterDecimal(n: number, decimales: number): string {
  const facteur = 10 ** decimales;
  const arrondi = Math.round(n * facteur) / facteur;
  if (decimales === 0) return arrondi.toString();
  const [entier = "0", fraction = ""] = arrondi.toString().split(".");
  return `${entier}.${fraction.padEnd(decimales, "0").slice(0, decimales)}`;
}

/** Même calcul que le gardien de `tests/unit/imports/delais-application.test.ts`. */
function casseTheorique(): number {
  let capacite = 0;
  while (
    allersRetoursApplication(capacite + 1) * LATENCE_PESSIMISTE_MS <=
    DUREE_MAXIMALE_MS
  ) {
    capacite += 1;
  }
  return capacite;
}

async function main(): Promise<void> {
  const proprietaireUrl = urlProprietaire();
  const applicativeUrl = urlApplicative(proprietaireUrl);
  const proprietaire = new PrismaClient({
    datasources: { db: { url: proprietaireUrl } },
  });
  const app = new PrismaClient({
    datasources: { db: { url: applicativeUrl } },
  });

  // Un nonce, pas un instant : seule l'unicité entre deux exécutions compte,
  // jamais l'heure qu'il désignerait (I7, gardien « sans-date-courante-implicite »).
  const runTag = randomBytes(4).toString("hex");
  const TAILLES = [100, 300, 600, 1000, 2000, 4000, 8000];

  try {
    await amorcerLesFixtures(proprietaire);

    const mesures: Mesure[] = [];
    for (const taille of TAILLES) {
      const creation = await mesurerCreation(runTag, taille, app);
      mesures.push(creation);
      process.stdout.write(
        `créations   ${String(taille).padStart(5)} lignes — ${formaterDecimal(creation.ms, 1)} ms\n`,
      );
    }
    for (const taille of TAILLES) {
      const modification = await mesurerModification(runTag, taille, app);
      mesures.push(modification);
      process.stdout.write(
        `modifications ${String(taille).padStart(5)} lignes — ${formaterDecimal(modification.ms, 1)} ms\n`,
      );
    }

    const creations = mesures.filter((m) => m.regime === "creation");
    const modifications = mesures.filter((m) => m.regime === "modification");
    const extraCreation = extrapoler(creations);
    const extraModification = extrapoler(modifications);
    const casseCreation = ligneDeCasse(
      extraCreation.msParLigne,
      extraCreation.msSocle,
    );
    const casseModification = ligneDeCasse(
      extraModification.msParLigne,
      extraModification.msSocle,
    );

    const uname = execSync("uname -a").toString().trim();
    const nodeVersion = process.version;
    let psqlVersion = "inconnue";
    try {
      psqlVersion = execSync("psql --version").toString().trim();
    } catch {
      // psql client absent : la mesure reste valide, seule la légende manque.
    }
    // Un instant UTC explicite, lu par l'OS — jamais `new Date()` (I7, gardien
    // « sans-date-courante-implicite » : ce fichier n'a pas à interpréter
    // l'heure, seulement à la dater sans ambiguïté).
    const horodatage = execSync("date -u +%Y-%m-%dT%H:%M:%SZ")
      .toString()
      .trim();

    const lignesMd: string[] = [];
    lignesMd.push("# Mesure IMPORT-2 — délai d'application d'un lot d'import");
    lignesMd.push("");
    lignesMd.push(
      `Mesuré le ${horodatage}, sur \`${uname}\`, Node ${nodeVersion}, ${psqlVersion}.`,
    );
    lignesMd.push("");
    lignesMd.push(
      "Chemin mesuré : `appliquerLeLotDeClients` (lib/imports/application.ts), " +
        "sous le rôle applicatif restreint `codiplan_app`, sur une base PostgreSQL " +
        "locale jetable (jamais Neon). Seule la transaction d'application est " +
        "chronométrée — pas le contrôle préalable ni l'enregistrement du lot, " +
        "qui ne comptent pas dans `DUREE_MAXIMALE_MS`.",
    );
    lignesMd.push("");
    lignesMd.push(
      "| régime | lignes retenues | durée mesurée (ms) | marge sous DUREE_MAXIMALE_MS |",
    );
    lignesMd.push("|---|---|---|---|");
    for (const m of mesures) {
      const marge = DUREE_MAXIMALE_MS - m.ms;
      lignesMd.push(
        `| ${m.regime} | ${m.lignesRetenues} | ${formaterDecimal(m.ms, 1)} | ${formaterDecimal(marge, 0)} ms |`,
      );
    }
    lignesMd.push("");
    lignesMd.push(
      "## Pente mesurée, et extrapolation — PAS une mesure directe",
    );
    lignesMd.push("");
    lignesMd.push(
      `- créations : ${formaterDecimal(extraCreation.msParLigne, 4)} ms/ligne, socle ${formaterDecimal(extraCreation.msSocle, 1)} ms. ` +
        (casseCreation === null
          ? "pente non exploitable (mesures trop plates)."
          : `casserait DUREE_MAXIMALE_MS vers ${formaterMillier(casseCreation)} lignes (extrapolé, jamais atteint par cette mesure).`),
    );
    lignesMd.push(
      `- modifications : ${formaterDecimal(extraModification.msParLigne, 4)} ms/ligne, socle ${formaterDecimal(extraModification.msSocle, 1)} ms. ` +
        (casseModification === null
          ? "pente non exploitable (mesures trop plates)."
          : `casserait DUREE_MAXIMALE_MS vers ${formaterMillier(casseModification)} lignes (extrapolé, jamais atteint par cette mesure).`),
    );
    lignesMd.push("");
    lignesMd.push(
      `Pour comparaison, ce que le BUDGET théorique de \`allersRetoursApplication\` ` +
        `(lib/imports/delais.ts) prévoit, sous \`LATENCE_PESSIMISTE_MS\` = ${LATENCE_PESSIMISTE_MS} ms : ` +
        `casse au-delà de ${formaterMillier(casseTheorique())} ` +
        `lignes retenues (\`allersRetoursApplication(n) × LATENCE_PESSIMISTE_MS ≤ DUREE_MAXIMALE_MS\`).`,
    );
    lignesMd.push("");
    lignesMd.push("## Ce que cette mesure NE dit PAS");
    lignesMd.push("");
    lignesMd.push(
      "- **Mesuré en LOCAL, sur un PostgreSQL du poste, pas sur la base hébergée.** " +
        "La production tourne sur Neon (`ap-southeast-2`), avec une latence réseau " +
        "et une mise en veille que `LATENCE_PESSIMISTE_MS` (500 ms) majore — cette " +
        "mesure locale ne l'éprouve PAS : le rapport entre les deux (probablement " +
        "un facteur de plusieurs centaines, la latence locale se mesurant en " +
        "fractions de milliseconde) n'est pas mesuré par ce lot.",
    );
    lignesMd.push(
      "- **Entité mesurée : « clients », pas « historique » / « VGP » / « VGP " +
        "observations » — les imports RÉELS d'Alexis.** Ces trois-là ne savent que " +
        "créer ; le régime « création » ci-dessus traverse le MÊME moteur générique " +
        "(`appliquerLesLignes`) et transfère donc directement. Le coût SPÉCIFIQUE " +
        "de leurs validations (rapprochement de machine par rang, résolution " +
        "client/site/agence) n'est PAS mesuré ici.",
    );
    lignesMd.push(
      "- **Pas de rapprochement de fiche complexe.** Les lignes synthétiques ne " +
        "portent que deux colonnes (code externe, raison sociale) ; un fichier réel " +
        "en porte davantage, sans que cela change le nombre d'allers-retours (la " +
        "lecture et l'écriture restent groupées par lot, jamais par colonne).",
    );
    lignesMd.push(
      "- **Aucune concurrence.** Une seule transaction à la fois ; la production " +
        "peut voir plusieurs lots s'appliquer en même temps sur la même base.",
    );
    lignesMd.push("");

    mkdirSync("docs/propositions/23-IMPORT-2", { recursive: true });
    writeFileSync(
      "docs/propositions/23-IMPORT-2/mesure.md",
      lignesMd.join("\n") + "\n",
    );
    process.stdout.write(
      "\nÉcrit dans docs/propositions/23-IMPORT-2/mesure.md\n",
    );
  } finally {
    await proprietaire.$disconnect();
    await app.$disconnect();
  }
}

main().catch((erreur: unknown) => {
  console.error(erreur);
  process.exitCode = 1;
});
