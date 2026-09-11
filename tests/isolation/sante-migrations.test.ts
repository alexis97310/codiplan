import { afterAll, afterEach, describe, expect, it } from "vitest";

import { lireSante } from "@/lib/db/sante";
import { MIGRATIONS_ATTENDUES } from "@/lib/db/migrations-attendues";

import { clientOwner, fermerClients } from "./setup/db";

/**
 * LE SCÉNARIO QUI AURAIT ATTRAPÉ LA PANNE DU 11/09/2026.
 *
 * ## Ce qui s'est passé
 *
 * Sept migrations n'étaient pas appliquées à la base de démonstration. Le code
 * déployé sélectionnait quatre colonnes qui n'existaient donc pas, et
 * `/planning` rendait *« Application error: a server-side exception has
 * occurred »*. **`/sante` répondait quatre oui.**
 *
 * ## Pourquoi rien ne l'a vu
 *
 * Le contrôle cherchait une ligne EN ÉCHEC dans `_prisma_migrations` :
 *
 * ```ts
 * const manquante = attendues.find((m) => !m.applique);
 * ```
 *
 * *Une migration jamais appliquée n'a pas de ligne.* La recherche ne trouvait
 * rien, et la réponse était « oui ».
 *
 * **Et le seul test qui existait portait sur un GESTE** : il vérifiait que le
 * module *mentionne* `_prisma_migrations`. C'est la distinction du §9 (09/09) —
 * *un gardien écrit sur un geste est satisfait par un geste vide* : le module
 * interrogeait bien la table, et il en tirait la mauvaise conclusion.
 *
 * ## Ce que ce fichier mesure, et que l'unitaire ne peut pas mesurer
 *
 * **L'état réel d'une base à qui il manque une migration.** Il retire une ligne
 * de `_prisma_migrations` — la forme exacte d'une migration jamais appliquée —
 * et exige que la réponse soit « non », avec le nom.
 *
 * **Le retrait n'est PAS dans une transaction annulée, et c'est une mesure**
 * (§9, 07/09 — la divergence entre deux chemins est un instrument) : la
 * première écriture l'a fait, et les deux scénarios sont restés VERTS.
 * *`lireSante` ouvre sa PROPRE connexion — elle le doit, elle répond même quand
 * le client partagé ne se construit pas —, et une connexion ne voit pas une
 * suppression non validée.* Le jumeau ne violait donc rien : il mesurait une
 * base intacte. La ligne est désormais retirée, relue, puis **remise en place
 * dans un `finally`**.
 */

afterAll(fermerClients);

/** La dernière migration attendue — celle dont l'absence casse le plus. */
const DERNIERE = MIGRATIONS_ATTENDUES[MIGRATIONS_ATTENDUES.length - 1];

let urlAvant: string | undefined;

afterEach(() => {
  if (urlAvant === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = urlAvant;
  }
});

/**
 * Lit la santé en pointant `DATABASE_URL` sur la base jetable.
 *
 * *`lireSante` construit son propre client* — c'est voulu, elle doit répondre
 * même quand le client partagé ne se construit pas —, et elle lit donc
 * l'environnement plutôt qu'un paramètre.
 */
async function santeSurLaBaseJetable() {
  urlAvant = process.env.DATABASE_URL;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  return lireSante();
}

/**
 * Retire des lignes de `_prisma_migrations`, lit, puis les REMET.
 *
 * **Le retrait est validé, et il le doit** : `lireSante` ouvre sa propre
 * connexion, qui ne verrait pas une suppression en transaction. La remise en
 * place est donc dans un `finally` — *une épreuve qui laisse la base abîmée
 * fait échouer ses voisines, et on cherche alors le défaut au mauvais endroit.*
 *
 * **Et le retrait est MESURÉ** : `DELETE` rend le nombre de lignes touchées, et
 * un retrait qui n'aurait rien supprimé rendrait le scénario vert sur une base
 * intacte (§9, 30/08 — la violation a-t-elle bien eu lieu ?).
 */
async function sansCesMigrations<T>(
  noms: readonly string[],
  travail: () => Promise<T>,
): Promise<T> {
  const sauvegarde = await clientOwner().$queryRawUnsafe<
    Array<Record<string, unknown>>
  >(
    `SELECT * FROM "_prisma_migrations" WHERE "migration_name" = ANY($1::text[])`,
    noms,
  );
  expect(sauvegarde).toHaveLength(noms.length);

  const retirees = await clientOwner().$executeRawUnsafe(
    `DELETE FROM "_prisma_migrations" WHERE "migration_name" = ANY($1::text[])`,
    noms,
  );
  expect(retirees).toBe(noms.length);

  try {
    return await travail();
  } finally {
    for (const ligne of sauvegarde) {
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations"
           ("id", "checksum", "finished_at", "migration_name", "logs",
            "rolled_back_at", "started_at", "applied_steps_count")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ligne.id,
        ligne.checksum,
        ligne.finished_at,
        ligne.migration_name,
        ligne.logs,
        ligne.rolled_back_at,
        ligne.started_at,
        ligne.applied_steps_count,
      );
    }
  }
}

/**
 * AJOUTE une tentative ANNULÉE, ANTÉRIEURE à celle qui a réussi — la forme
 * exacte que `_prisma_migrations` porte après un déblocage.
 *
 * **La forme n'est pas inventée, elle est MESURÉE** *(11/09/2026, PostgreSQL
 * jetable)* : la panne a été rejouée avec la version d'avant D104, puis
 * `migrate resolve --rolled-back`, puis `migrate deploy` avec D104. La table
 * portait alors deux lignes pour le même nom —
 *
 * ```
 * 20260913160000_suspension_l2_10 | 22:32:06 | fini=f | annulee=t | etapes=0
 * 20260913160000_suspension_l2_10 | 22:32:09 | fini=t | annulee=f | etapes=1
 * ```
 *
 * — et c'est la première que la sonde trouvait. *Rejouer un `resolve` puis un
 * `deploy` réels ici coûterait deux invocations de la CLI Prisma pour produire
 * ces deux lignes ; la forme étant mesurée, on les pose.*
 *
 * L'ajout est VALIDÉ — `lireSante` ouvre sa propre connexion et ne verrait pas
 * une écriture en transaction (leçon écrite en tête de ce fichier) — et il est
 * défait dans un `finally`.
 */
async function avecUneTentativeAnnuleeAvant<T>(
  nom: string,
  travail: () => Promise<T>,
): Promise<T> {
  const [reussie] = await clientOwner().$queryRawUnsafe<
    Array<{ checksum: string; started_at: Date }>
  >(
    `SELECT "checksum", "started_at" FROM "_prisma_migrations"
      WHERE "migration_name" = $1`,
    nom,
  );
  // TÉMOIN : sans la tentative réussie, l'ajout ci-dessous décrirait une
  // migration simplement annulée — l'autre cas, et le scénario mesurerait
  // alors le contraire de ce qu'il annonce.
  expect(reussie, `${nom} n'est pas appliquée`).toBeDefined();

  const identifiant = "00000000-0000-4000-8000-0000000000aa";
  const posees = await clientOwner().$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations"
       ("id", "checksum", "finished_at", "migration_name", "logs",
        "rolled_back_at", "started_at", "applied_steps_count")
     VALUES ($1, $2, NULL, $3, 'échec rejoué', $4, $4, 0)`,
    identifiant,
    reussie.checksum,
    nom,
    new Date(reussie.started_at.getTime() - 3000),
  );
  expect(posees).toBe(1);

  try {
    return await travail();
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "_prisma_migrations" WHERE "id" = $1`,
      identifiant,
    );
  }
}

/**
 * POSE une ligne ANNULÉE et RIEN D'AUTRE — l'état d'une migration débloquée
 * mais pas encore rejouée.
 *
 * C'est le jumeau du helper ci-dessus : la même ligne, privée de la tentative
 * réussie. *Sans lui, le scénario « annulée puis réappliquée » resterait vert
 * sur une sonde qui aurait cessé de lire `_prisma_migrations` en entier* —
 * la direction permissive, celle qui n'émet aucun signal (§9, 11/09).
 */
async function avecUneLigneAnnuleeSeule<T>(
  nom: string,
  travail: () => Promise<T>,
): Promise<T> {
  const identifiant = "00000000-0000-4000-8000-0000000000bb";
  const posees = await clientOwner().$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations"
       ("id", "checksum", "finished_at", "migration_name", "logs",
        "rolled_back_at", "started_at", "applied_steps_count")
     VALUES ($1, 'empreinte-rejouee', NULL, $2, 'annulée, pas rejouée',
             now(), now(), 0)`,
    identifiant,
    nom,
  );
  expect(posees).toBe(1);

  try {
    return await travail();
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "_prisma_migrations" WHERE "id" = $1`,
      identifiant,
    );
  }
}

describe("la page de santé et les migrations", () => {
  it("TÉMOIN — sur une base à jour, elle répond OUI", async () => {
    // *Sans lui, le scénario suivant serait vert sur une sonde qui dit « non »
    // à tout* — et un contrôle qui refuse toujours ne vaut pas mieux qu'un
    // contrôle qui accepte toujours.
    const etat = await santeSurLaBaseJetable();
    expect(etat.baseJointe.ok).toBe(true);
    expect(etat.migrations).toEqual({ ok: true, detail: null });
  });

  it("UNE MIGRATION ABSENTE rend « non », et le motif la NOMME", async () => {
    // **C'est la panne du 11/09, reproduite.** Une migration jamais appliquée
    // n'a pas de ligne : c'est exactement ce que ce retrait fabrique.
    const lu = await sansCesMigrations([DERNIERE], santeSurLaBaseJetable);
    expect(lu.migrations.ok).toBe(false);
    expect(lu.migrations.detail).toContain(DERNIERE);
  });

  it("et le motif dit COMBIEN il en manque — la première est celle par laquelle la base a décroché", async () => {
    // *Sept migrations manquaient, et le geste à jouer était le même pour les
    // sept.* Le nombre dit l'ampleur ; le nom dit par où commencer à lire.
    const deux = MIGRATIONS_ATTENDUES.slice(-2);
    const lu = await sansCesMigrations(deux, santeSurLaBaseJetable);
    expect(lu.migrations.ok).toBe(false);
    // La PREMIÈRE des deux, dans l'ordre du dépôt — pas la dernière.
    expect(lu.migrations.detail).toContain(deux[0]);
    expect(lu.migrations.detail).toContain("2");
  });

  // ── LE DÉFAUT DU 12/09 : LA SONDE RÉPARÉE CRIAIT AU LOUP ──────────────────

  it("ANNULÉE PUIS RÉAPPLIQUÉE rend « à jour » — deux lignes, un seul état", async () => {
    // **Mesuré en ligne avant d'être réparé** : après le déblocage de
    // `20260913160000_suspension_l2_10` et sa réapplication, `/sante` répondait
    // *« Les migrations sont à jour : non — Une migration a échoué ou a été
    // annulée »* sur une base parfaitement à jour. La contrainte que cette
    // migration pose mordait au même instant, ce qui prouvait qu'elle était là.
    const lu = await avecUneTentativeAnnuleeAvant(
      DERNIERE,
      santeSurLaBaseJetable,
    );

    expect(lu.migrations).toEqual({ ok: true, detail: null });
  });

  // LE JUMEAU, et il est indispensable : sans lui, le scénario ci-dessus
  // resterait vert sur une sonde qui ignorerait `_prisma_migrations` en entier.
  // Ici la MÊME ligne annulée est posée sur une migration qui n'a PAS de
  // tentative réussie — et la réponse doit basculer.
  it("ANNULÉE SANS RÉAPPLICATION rend « non » — le jumeau du cas ci-dessus", async () => {
    const lu = await sansCesMigrations([DERNIERE], () =>
      avecUneLigneAnnuleeSeule(DERNIERE, santeSurLaBaseJetable),
    );

    expect(lu.migrations.ok).toBe(false);
    expect(lu.migrations.detail).toContain(DERNIERE);
  });
});
