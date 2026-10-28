import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  creerCompteDeBureau,
  envoyerLienDAccesBureau,
} from "@/lib/auth/acces-bureau";
import {
  envoyerLienDAcces,
  etatsAccesDesTechniciens,
} from "@/lib/auth/acces-technicien";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";
import { creerTechnicien } from "@/lib/techniciens/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * 9I4-EQUIPE-N-PLUS-UN — l'écran Équipe lit un compte PAR REQUÊTE, en
 * SÉQUENCE, pour chaque technicien ou compte de bureau affiché
 * (`lib/auth/acces-technicien.ts`, `lib/auth/acces-bureau.ts`, constat M4 de
 * l'audit du 28/10/2026).
 *
 * ## CE QUE CE FICHIER MESURE, ET CE QU'IL NE PROUVE PAS
 *
 * Point 1 (mesure) : AVANT ce correctif, la boucle faisait `for (… ) { await
 * designe.compte.findFirst(…) }` — une lecture après l'autre. Le diff du
 * correctif (`git show`) est la preuve la plus directe de la forme
 * SÉQUENTIELLE d'avant ; ce fichier mesure plutôt ce qui en résulte : le
 * TEMPS TOTAL, sous un délai artificiel posé sur `$transaction`, reste PLAT
 * quand N grandit — ce qu'une boucle séquentielle n'aurait jamais permis.
 *
 * Point 3 (ce que ce fichier REFUSE de prouver) : **une lecture UNIQUE,
 * `compte.findMany({ where: { utilisateur_id: { in } } })`, N'A PAS été
 * posée.** `compte` porte une politique RLS self-authored,
 * `utilisateur_id = app.authentification_utilisateur_id`
 * (`lib/auth/lecture-identite.ts`, `CLES_DESIGNATION.compte`) : elle ne
 * désigne QU'UNE identité à la fois, par construction (« une clé trouvée sous
 * un OR ne bornerait rien »). Le test « la lecture batch sous désignation
 * rend zéro ligne » ci-dessous MESURE cette limite — c'est elle qui a écarté
 * la lecture unique, documentée dans
 * `docs/propositions/9I4-EQUIPE-N-PLUS-UN/passation.md`. Le nombre d'APPELS
 * à `compte.findFirst` reste donc O(N) ; c'est leur EXÉCUTION qui n'est plus
 * séquentielle.
 */

const ADMIN_A = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const PREFIXE = "9i4eq-";

function courriel(): string {
  return `${PREFIXE}${Math.floor(Math.random() * 10_000_000)}@codima.test`;
}

async function creerNTechniciensAvecCompte(n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const resultat = await creerTechnicien(
      ADMIN_A,
      {
        nom: `Technicien 9I4 ${i}`,
        email: courriel(),
        agence_id: AGENCE_A,
        actif: true,
        statut_ressource: "salarie",
      },
      clientApp(),
    );
    if (!resultat.accepte) throw new Error("fixture technicien non créée");
    await envoyerLienDAcces(ADMIN_A, resultat.utilisateurId, clientApp(), {});
    ids.push(resultat.utilisateurId);
  }
  return ids;
}

afterEach(async () => {
  const motif = `${PREFIXE}%`;
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE "detail" LIKE $1 OR "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "compte" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE $1)`,
    motif,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE $1`,
    motif,
  );
});

afterAll(fermerClients);

describe("etatsAccesDesTechniciens — les lectures de compte sont DE FRONT, pas l'une après l'autre", () => {
  // Un délai artificiel posé sur `$transaction` : chaque lecture désignée
  // (habilitations, administrateurs, journal, compte) en ouvre une — voir
  // `avecDesignationAuth` / `avecSociete`. Une boucle SÉQUENTIELLE additionne
  // ces délais ; des lectures DE FRONT les superposent. `DELAI_MS` est choisi
  // assez grand pour dominer largement la latence réelle de la base locale.
  const DELAI_MS = 60;

  function poserDelaiSurTransaction(): () => void {
    const client = clientApp();
    const original = client.$transaction.bind(client) as (
      ...args: Parameters<typeof client.$transaction>
    ) => ReturnType<typeof client.$transaction>;
    vi.spyOn(client, "$transaction").mockImplementation(
      ((...args: Parameters<typeof client.$transaction>) =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            original(...args).then(resolve, reject);
          }, DELAI_MS);
        })) as typeof client.$transaction,
    );
    return () => vi.restoreAllMocks();
  }

  it.each([1, 5, 20])(
    "N=%i techniciens — le temps total reste proche d'une poignée de délais, jamais N (M4)",
    async (n) => {
      const ids = await creerNTechniciensAvecCompte(n);
      const restaurer = poserDelaiSurTransaction();
      const debut = Date.now();
      const etats = await etatsAccesDesTechniciens(ADMIN_A, ids, clientApp());
      const duree = Date.now() - debut;
      restaurer();

      expect(etats.size).toBe(n);
      // SÉQUENTIEL (avant ce correctif) aurait coûté environ (3 + N) × DELAI_MS
      // (habilitations, administrateurs, journal, PUIS N lectures de compte
      // l'une après l'autre) — pour N=20 cela dépasse 1 300 ms. DE FRONT, le
      // coût reste proche de 4 × DELAI_MS quel que soit N. Le seuil ci-dessous
      // est à mi-chemin pour N=5 et très loin du cas séquentiel pour N=20.
      expect(duree).toBeLessThan(DELAI_MS * 8);
    },
  );
});

describe("compte — la lecture BATCH, en une seule requête, sous la désignation existante, est IMPOSSIBLE sans toucher RLS", () => {
  it("compte.findMany({ where: { utilisateur_id: { in } } }) rend ZÉRO ligne — la désignation ne lit pas `in` (9I4, point 3)", async () => {
    const ids = await creerNTechniciensAvecCompte(2);

    const designe = avecDesignationAuth(clientApp());
    const lignes = await designe.compte.findMany({
      where: { utilisateur_id: { in: ids } },
      select: { utilisateur_id: true },
    });

    // C'EST LA PREUVE QUI ÉCARTE LA LECTURE UNIQUE PRESCRITE PAR LE TICKET —
    // voir la passation. Si ce test échoue un jour (la désignation a appris à
    // lire `{ in }`, ou la politique RLS a changé), c'est une INFORMATION :
    // la lecture batch promise au point 3 redevient possible, et ce fichier
    // doit être relu avant de le croire acquis.
    expect(lignes).toHaveLength(0);
  });
});

describe("compte — au plus UNE ligne par utilisateur, mesuré sur les chemins de création réels (point 2)", () => {
  it("un compte de bureau et un technicien n'ont chacun qu'UNE ligne `compte`, même émetteur, même `compte_externe_id`", async () => {
    const emailBureau = courriel();
    const bureau = await creerCompteDeBureau(
      ADMIN_A,
      { nom: "Bureau 9I4", courriel: emailBureau, role: Role.adv },
      clientApp(),
    );
    expect(bureau.accepte).toBe(true);
    if (!bureau.accepte) return;

    await envoyerLienDAccesBureau(
      ADMIN_A,
      bureau.utilisateurId,
      clientApp(),
      {},
    );

    const lignes = await clientOwner().$queryRawUnsafe<
      { emetteur: string; compte_externe_id: string }[]
    >(
      `SELECT emetteur, compte_externe_id FROM "compte" WHERE utilisateur_id = $1::uuid`,
      bureau.utilisateurId,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.emetteur).toBe("local:credential");
    expect(lignes[0]?.compte_externe_id).toBe(bureau.utilisateurId);
  });
});
