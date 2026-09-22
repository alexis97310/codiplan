import { uuidv7 } from "@/lib/db/uuid";
import { cleJour, jourExige } from "@/lib/calendar";

import { feriesDuTerritoire } from "../prisma/seed-data";
import {
  clientHorizon,
  ligneEtat,
  lireAgences,
  lireHorizons,
} from "./lib/feries";

/**
 * EXTENSION de l'horizon des jours fériés (ticket L0-08 ; D46, complément 3).
 *
 * Le pendant de `scripts/horizon-feries.mts` : celui-là constate et échoue,
 * celui-ci corrige. « Le seed couvre un horizon glissant — année en cours plus
 * deux — et un script versionné permet de l'étendre. »
 *
 * **Ce que le script fait, et ce qu'il ne fait pas.** Il ajoute les années
 * manquantes pour les territoires déjà présents dans la table `agence`, à
 * partir des règles de `prisma/seed-data.ts` — fériés fixes du territoire et
 * fêtes mobiles adossées à Pâques. Il ne modifie ni ne supprime aucune ligne
 * existante : un libellé corrigé à la main en base le reste. Il ne crée pas non
 * plus de territoire : un territoire inconnu de `FERIES_FIXES` est SIGNALÉ, pas
 * deviné — les fériés d'un nouveau territoire sont une décision, pas une
 * extrapolation.
 *
 * Usage : `pnpm feries:etendre`, avec `HORIZON_DATABASE_URL`,
 * `MIGRATION_DATABASE_URL` ou `DATABASE_URL` en environnement. Le rôle doit
 * pouvoir écrire dans `jour_ferie` — c'est-à-dire être le propriétaire ou un
 * rôle éditeur (D46).
 *
 * **Et il doit pouvoir LIRE les agences par-dessus le cloisonnement** — être
 * exempté des politiques (`SUPERUSER`, `BYPASSRLS`) ou membre d'un rôle qui
 * l'est et lit les tables. `agence` porte `FORCE ROW LEVEL SECURITY` : un rôle
 * qui n'a rien de tout cela voit ZÉRO agence, sans erreur. Jusqu'à FERIES-1
 * (22/09/2026), ce script concluait alors « aucun territoire » sur une base qui
 * en portait — mesuré sur la base de production. Il ne suppose plus le rôle :
 * `lireAgences` le VÉRIFIE au premier geste et refuse en nommant le rôle, la
 * base et la variable à alimenter (`scripts/lib/feries.ts`, où l'arbitrage est
 * écrit ; mécanisme partagé avec l'inventaire, `scripts/lib/identite-exemptee.ts`).
 * Le refus « Aucun territoire n'est rattaché à une agence » n'a donc plus
 * qu'UNE cause : la table est réellement vide.
 *
 * Idempotent : la clé naturelle est le couple (territoire, date).
 */

/** Nombre d'années ajoutées au-delà de ce que l'horizon exige déjà. */
const MARGE_ANNEES = 1;

const prisma = clientHorizon();

try {
  const agences = await lireAgences(prisma);
  const etats = await lireHorizons(prisma, agences);

  // Zéro ici est un ZÉRO LU SOUS IDENTITÉ EXEMPTÉE : `lireAgences` aurait
  // refusé plutôt que de rendre un zéro filtré. La table est vide, et il n'y a
  // qu'une chose à faire — créer une agence dans l'application.
  if (etats.length === 0) {
    throw new Error(
      "Aucun territoire n'est rattaché à une agence : il n'y a rien à " +
        "étendre. Renseigner `agence.territoire` avant d'étendre l'horizon.",
    );
  }

  process.stdout.write(
    [
      "── Horizon avant extension ───────────────",
      ...etats.map(ligneEtat),
      "",
    ].join("\n"),
  );

  let ajoutees = 0;
  const inconnus: string[] = [];

  for (const etat of etats) {
    // On couvre au moins l'année du jour exigé, plus une marge : étendre
    // jusqu'au minimum strict ferait réapparaître l'alerte le mois suivant.
    // L'année de départ est celle du jour de référence du territoire, déjà
    // calculée dans le fuseau de ses agences par `lireHorizons` : aucun fuseau
    // n'est écrit ici, et aucune date courante n'y est relue.
    const derniereAnneeUtile = jourExige(etat).annee + MARGE_ANNEES;

    for (
      let annee = etat.aujourdhui.annee;
      annee <= derniereAnneeUtile;
      annee += 1
    ) {
      let feries;
      try {
        feries = feriesDuTerritoire(etat.territoire, annee);
      } catch {
        if (!inconnus.includes(etat.territoire)) {
          inconnus.push(etat.territoire);
        }
        break;
      }

      for (const ferie of feries) {
        const date = new Date(`${ferie.date}T00:00:00.000Z`);
        const existe = await prisma.jourFerie.findUnique({
          where: { territoire_date: { territoire: etat.territoire, date } },
          select: { id: true },
        });

        if (existe !== null) {
          continue;
        }

        await prisma.jourFerie.create({
          data: {
            id: uuidv7(),
            territoire: etat.territoire,
            date,
            libelle: ferie.libelle,
            mobile: ferie.mobile,
          },
        });
        ajoutees += 1;
      }
    }
  }

  const apres = await lireHorizons(prisma, agences);
  process.stdout.write(
    [
      `${ajoutees} jour(s) férié(s) ajouté(s).`,
      "── Horizon après extension ───────────────",
      ...apres.map(ligneEtat),
      "",
    ].join("\n"),
  );

  if (inconnus.length > 0) {
    throw new Error(
      `Territoires sans règles de fériés : ${inconnus.join(", ")}. ` +
        "Les fériés d'un territoire sont une DÉCISION, pas une " +
        "extrapolation : les ajouter à FERIES_FIXES dans " +
        "`prisma/seed-data.ts`, et non les deviner ici. " +
        `Jour le plus tardif exigé : ${cleJour(jourExige(etats[0]!))}.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
