import { afterAll, describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";
import {
  creerPrestationDans,
  modifierPrestationDans,
} from "@/lib/prestations/depot";
import { creerSiteDans, modifierSiteDans } from "@/lib/sites/depot";

import { clientOwner, fermerClients, sousSociete } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_B1,
  SOCIETE_A,
  SOCIETE_B,
  AGENCE_A,
} from "./setup/fixtures";

/**
 * LES ÉCRITURES QUE R6-01 OUVRE DANS UNE TRANSACTION D'APPELANT, ET CE QUE LA
 * BASE GARDE DESSOUS.
 *
 * ## Ce que ce fichier mesure, et pourquoi il ne suffit pas d'avoir mesuré ailleurs
 *
 * R6-01 EXTRAIT `creerSiteDans`, `modifierSiteDans`, `creerPrestationDans` et
 * `modifierPrestationDans` de leurs fonctions publiques, pour qu'un lot entier
 * s'écrive dans UNE transaction. *L'extraction ne change aucun verrou* — c'est
 * le même `tx.site.create` —, **mais elle ouvre un CHEMIN que rien n'empruntait**,
 * et un chemin non emprunté est un chemin non éprouvé (R3-12).
 *
 * ## LES TROIS VERBES, ET POURQUOI `upsert` EST LÀ
 *
 * *`create`, `update` et `upsert` ne compilent pas vers le même SQL*, et
 * `upsert` est le seul à produire un `INSERT … ON CONFLICT DO UPDATE` dont la
 * ligne candidate porte un identifiant NEUF. **C'est lui qui a fait tomber le
 * semis le 14/09/2026**, et le §9 en a tiré la règle : *un gardien de base se
 * lit sur deux axes — quelles lignes regarde-t-il, et par quel VERBE les
 * écrit-il.*
 *
 * **Aucune des quatre fonctions n'emploie `upsert` aujourd'hui.** Il est écrit
 * ici pour la raison exacte de `ecriture-materiel.test.ts` : *une contrainte
 * éprouvée sur deux verbes sur trois est une contrainte dont on ne sait pas ce
 * qu'elle fait sur le troisième.*
 *
 * ## LE TÉMOIN DE CHAQUE JUMEAU PRÉCÈDE LE JUMEAU
 *
 * *Un jumeau devrait montrer le refus avant de retirer le verrou.* PostgreSQL
 * l'interdit dans la même transaction : une violation abandonne la transaction
 * entière (`25P02`). Le témoin est donc l'assertion de refus qui PRÉCÈDE chaque
 * jumeau, par le même chemin et sur la même ligne.
 */

/**
 * **CE FICHIER REND LE SEMIS TEL QU'IL L'A TROUVÉ** — même raison
 * qu'`application-import-types.test.ts` : le harnais ne recrée pas la base
 * entre deux fichiers, et *une fiche laissée derrière soi fait échouer le
 * décompte d'un autre scénario, pour une raison qui n'est pas la sienne.*
 * Tout ce que ce fichier pose porte le préfixe `R6J-`.
 */
afterAll(async () => {
  const owner = clientOwner();
  for (const societe of [SOCIETE_A, SOCIETE_B]) {
    await owner.$executeRawUnsafe(
      `DELETE FROM "site" WHERE "societe_id" = '${societe}' AND "libelle" LIKE 'R6J-%'`,
    );
    await owner.$executeRawUnsafe(
      `DELETE FROM "prestation" WHERE "societe_id" = '${societe}' AND "code" LIKE 'R6J-%'`,
    );
  }
  await fermerClients();
});

let rang = 0;
const suffixe = () => `R6J-${(rang += 1)}`;

const saisieSite = (libelle: string, clientId = CLIENT_A1) => ({
  client_id: clientId,
  agence_id: AGENCE_A,
  libelle,
  adresse: null,
  commune: null,
  zone_geo: null,
  consignes_acces: null,
  horaires: null,
  latitude: null,
  longitude: null,
  temps_trajet_min: null,
  actif: true,
});

const saisiePrestation = (code: string) => ({
  code,
  libelle: `Prestation ${code}`,
  famille_id: null,
  duree_standard_min: null,
  checklist_type: null,
  actif: true,
});

describe("`creerSiteDans` écrit SOUS les politiques, pas à côté", () => {
  it("CREATE — un site pour le client d'une AUTRE société est refusé", async () => {
    // **La clé étrangère est COMPOSITE `(societe_id, client_id)`**, et c'est
    // elle qui refuse : sous le contexte de A, le client B1 n'existe pas.
    // *Écrire un contrôle en TypeScript au-dessus ferait une seconde lecture du
    // même critère* (§9, 01/09).
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        creerSiteDans(tx, SOCIETE_A, saisieSite(suffixe(), CLIENT_B1)),
      ),
    ).rejects.toThrow();
  });

  it("CREATE — le cas qui doit rester VERT pour sa propre raison", async () => {
    // §9, 11/09 : *à côté de chaque cas qui doit rougir, un cas qui doit rester
    // vert POUR SA PROPRE RAISON.* Un verrou qui refuserait TOUTE création par
    // ce chemin passerait le scénario ci-dessus sans qu'on s'en aperçoive.
    const libelle = suffixe();
    const fiche = await sousSociete(SOCIETE_A, (tx) =>
      creerSiteDans(tx, SOCIETE_A, saisieSite(libelle)),
    );
    expect(fiche.libelle).toBe(libelle);
  });

  it("CREATE — JUMEAU : la clé étrangère retirée, l'écriture fautive PASSE", async () => {
    const libelle = suffixe();
    // LE TÉMOIN : par le même chemin, sur la même ligne, le refus a bien lieu.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        creerSiteDans(tx, SOCIETE_A, saisieSite(libelle, CLIENT_B1)),
      ),
    ).rejects.toThrow();

    // Le DDL est transactionnel en PostgreSQL : la contrainte revient au
    // `ROLLBACK`, et le jumeau se rejoue à chaque `pnpm verify`.
    await expect(
      clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "site" DROP CONSTRAINT "site_client_fkey"`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "site" ("id","societe_id","client_id","agence_id","libelle")
           VALUES ('${uuidv7()}','${SOCIETE_A}','${CLIENT_B1}','${AGENCE_A}','${libelle}')`,
        );
        throw new Error("ROLLBACK VOULU");
      }),
    ).rejects.toThrow("ROLLBACK VOULU");
  });

  it("UPDATE — un site d'une AUTRE société n'est pas atteint", async () => {
    const libelle = suffixe();
    const fiche = await sousSociete(SOCIETE_A, (tx) =>
      creerSiteDans(tx, SOCIETE_A, saisieSite(libelle)),
    );
    // Sous B, la politique cache la ligne : `update` lève `P2025`. *C'est la
    // politique qui refuse, jamais une comparaison écrite au-dessus.*
    await expect(
      sousSociete(SOCIETE_B, (tx) =>
        modifierSiteDans(tx, fiche.id, { commune: "Depuis B" }),
      ),
    ).rejects.toThrow();
    // ET LE TÉMOIN : sous SA société, la même écriture passe.
    const rendue = await sousSociete(SOCIETE_A, (tx) =>
      modifierSiteDans(tx, fiche.id, { commune: "Depuis A" }),
    );
    expect(rendue.commune).toBe("Depuis A");
  });

  it("UPSERT — la branche CREATE est jugée par la clé étrangère composite", async () => {
    // **LE VERBE QUE LE DÉPÔT N'EMPLOIE PAS, ET QUE L'IMPORT EMPLOIERA.** La
    // ligne n'existe pas : c'est le bloc `create` qui s'exécute, et son
    // `client_id` est celui d'une autre société. *Le `where` dit quelle ligne,
    // la clé étrangère dit à qui elle est.*
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.site.upsert({
          where: { id: uuidv7() },
          create: {
            id: uuidv7(),
            societe_id: SOCIETE_A,
            client_id: CLIENT_B1,
            agence_id: AGENCE_A,
            libelle: suffixe(),
          },
          update: { commune: "jamais écrite" },
        }),
      ),
    ).rejects.toThrow();
  });

  it("DEUX SITES DE MÊME LIBELLÉ chez le même client sont ACCEPTÉS — mesuré", async () => {
    // **CE SCÉNARIO NE GARDE PAS UN VERROU : IL GARDE SON ABSENCE.** La
    // première rédaction de `parc-cibles.ts` prêtait à `site` un
    // `@@unique([societe_id, client_id, libelle])` — *mesuré le 16/09/2026,
    // `pg_indexes` n'en porte aucun*, là où `modele_materiel` et `prestation`
    // en ont un. La clé d'un site PEUT donc être ambiguë au sens de RG-IMP-05,
    // et c'est ce qui rend la détection d'`indexer()` nécessaire plutôt que
    // décorative.
    //
    // *Le jour où cet index sera posé, ce scénario rougira* — et ce sera la
    // bonne nouvelle, pas une panne : il faudra alors relire le paragraphe de
    // `parc-cibles.ts` qu'il tient.
    const libelle = suffixe();
    await sousSociete(SOCIETE_A, (tx) =>
      creerSiteDans(tx, SOCIETE_A, saisieSite(libelle)),
    );
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        creerSiteDans(tx, SOCIETE_A, saisieSite(libelle)),
      ),
    ).resolves.toBeDefined();

    const [compte] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "site"
        WHERE "societe_id" = '${SOCIETE_A}' AND "libelle" = '${libelle}'`,
    );
    expect(Number(compte.n)).toBe(2);
  });

  it("UPSERT sans conflit — le cas qui doit rester vert pour sa propre raison", async () => {
    const id = uuidv7();
    const libelle = suffixe();
    const posee = await sousSociete(SOCIETE_A, (tx) =>
      tx.site.upsert({
        where: { id },
        create: {
          id,
          societe_id: SOCIETE_A,
          client_id: CLIENT_A1,
          agence_id: AGENCE_A,
          libelle,
        },
        update: { commune: "jamais écrite" },
      }),
    );
    expect(posee.libelle).toBe(libelle);
  });
});

describe("`creerPrestationDans` écrit SOUS les politiques, pas à côté", () => {
  it("CREATE — le code est unique PAR SOCIÉTÉ, jamais globalement", async () => {
    const code = suffixe();
    await sousSociete(SOCIETE_A, (tx) =>
      creerPrestationDans(tx, SOCIETE_A, uuidv7(), saisiePrestation(code)),
    );
    // Le MÊME code chez B passe : *l'unicité est cloisonnée, et un import chez
    // l'une ne doit jamais refuser à cause de l'autre.*
    await expect(
      sousSociete(SOCIETE_B, (tx) =>
        creerPrestationDans(tx, SOCIETE_B, uuidv7(), saisiePrestation(code)),
      ),
    ).resolves.toBeUndefined();
    // Et le doublon chez A est refusé.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        creerPrestationDans(tx, SOCIETE_A, uuidv7(), saisiePrestation(code)),
      ),
    ).rejects.toThrow(/Unique constraint|code/);
  });

  it("UPDATE — zéro ligne touchée est ce que la POLITIQUE rend, pas une erreur", async () => {
    const id = uuidv7();
    await sousSociete(SOCIETE_A, (tx) =>
      creerPrestationDans(tx, SOCIETE_A, id, saisiePrestation(suffixe())),
    );
    // **`updateMany` ne lève pas** : sous B la ligne est invisible, et le
    // décompte vaut zéro. *C'est ce décompte que l'application lit pour laisser
    // la ligne en l'état plutôt que de croire l'avoir écrite.*
    const depuisB = await sousSociete(SOCIETE_B, (tx) =>
      modifierPrestationDans(tx, id, saisiePrestation(suffixe())),
    );
    expect(depuisB).toBe(0);
    // LE TÉMOIN : sous A, la même écriture touche bien une ligne.
    const depuisA = await sousSociete(SOCIETE_A, (tx) =>
      modifierPrestationDans(tx, id, saisiePrestation(suffixe())),
    );
    expect(depuisA).toBe(1);
  });

  it("UPSERT avec conflit — la branche UPDATE est jugée, et elle est refusée", async () => {
    const code = suffixe();
    await sousSociete(SOCIETE_A, (tx) =>
      creerPrestationDans(tx, SOCIETE_A, uuidv7(), saisiePrestation(code)),
    );
    const autre = uuidv7();
    await sousSociete(SOCIETE_A, (tx) =>
      creerPrestationDans(tx, SOCIETE_A, autre, saisiePrestation(suffixe())),
    );
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.prestation.upsert({
          where: { id: autre },
          create: {
            id: autre,
            societe_id: SOCIETE_A,
            code,
            libelle: "Jamais écrite",
          },
          update: { code },
        }),
      ),
    ).rejects.toThrow(/Unique constraint|code/);
  });

  it("UPSERT sans conflit — le cas qui doit rester vert pour sa propre raison", async () => {
    const id = uuidv7();
    const code = suffixe();
    const posee = await sousSociete(SOCIETE_A, (tx) =>
      tx.prestation.upsert({
        where: { id },
        create: {
          id,
          societe_id: SOCIETE_A,
          code,
          libelle: `Prestation ${code}`,
        },
        update: { code },
      }),
    );
    expect(posee.code).toBe(code);
  });
});
