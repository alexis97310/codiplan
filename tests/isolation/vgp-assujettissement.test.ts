import { afterAll, describe, expect, it } from "vitest";

import { clientOwner, fermerClients, sousSociete } from "./setup/db";
import { MACHINE_A1, MODELE_A, SOCIETE_A } from "./setup/fixtures";

/**
 * L'ASSUJETTISSEMENT AUX VGP, TENU PAR LA BASE (L9-03 à L9-06, D88).
 *
 * ## Pourquoi ces règles vivent AUSSI en base
 *
 * La saisie Zod les porte, et elle rend un message lisible. Mais *une règle qui
 * ne vit que dans la couche applicative n'en est pas une* : le seed, une
 * migration et une console passent tous par la base, aucun par Zod. **Ces
 * scénarios mesurent la moitié que Zod ne peut pas garantir.**
 *
 * ## CHAQUE REFUS A SON JUMEAU (§9, 24/08)
 *
 * Un test de refus prouve qu'un verrou mordait le jour où on l'a écrit. Le
 * jumeau retire la contrainte VISÉE — pas une voisine —, dans une transaction
 * annulée, et montre l'écriture fautive passer alors. Et **l'assertion nomme la
 * contrainte** : sans quoi un refus venu d'ailleurs passerait pour le bon.
 */

afterAll(fermerClients);

/** Une famille jetable, pour n'écrire sur aucune fixture partagée. */
async function familleJetable(): Promise<string> {
  const [ligne] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "famille_materiel" (id, societe_id, code, libelle, actif)
     VALUES (gen_random_uuid(), $1::uuid, 'VGP-' || substr(gen_random_uuid()::text, 1, 8), 'Famille jetable', true)
     RETURNING "id"`,
    SOCIETE_A,
  );
  if (ligne === undefined) {
    throw new Error("la famille jetable n'a pas été créée");
  }
  return ligne.id;
}

describe("L9-03 — la naissance est `a_determiner`, et personne ne l'a demandée", () => {
  it("une famille créée sans rien dire porte l'état « on n'a pas regardé »", async () => {
    const id = await familleJetable();
    const [ligne] = await clientOwner().$queryRawUnsafe<
      { assujettissement_vgp: string }[]
    >(
      `SELECT "assujettissement_vgp"::text FROM "famille_materiel" WHERE "id" = $1::uuid`,
      id,
    );
    // *Une case décochée est indiscernable d'une famille jamais examinée.* Le
    // DÉFAUT porte la règle : rien dans l'insertion ci-dessus ne l'a demandé.
    expect(ligne?.assujettissement_vgp).toBe("a_determiner");

    // TÉMOIN — la colonne sait porter autre chose : sans cela, l'assertion
    // ci-dessus serait vraie d'une colonne qui ne prendrait qu'une valeur.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "famille_materiel" SET "assujettissement_vgp" = 'non_soumis' WHERE "id" = $1::uuid`,
      id,
    );
    const [apres] = await clientOwner().$queryRawUnsafe<
      { assujettissement_vgp: string }[]
    >(
      `SELECT "assujettissement_vgp"::text FROM "famille_materiel" WHERE "id" = $1::uuid`,
      id,
    );
    expect(apres?.assujettissement_vgp).toBe("non_soumis");

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "famille_materiel" WHERE "id" = $1::uuid`,
      id,
    );
  });
});

describe("L9-04 — la base REFUSE `soumis` sans sa base", () => {
  const declarer = (
    id: string,
    periodicite: number | null,
    texte: string | null,
  ) =>
    clientOwner().$executeRawUnsafe(
      `UPDATE "famille_materiel"
          SET "assujettissement_vgp" = 'soumis',
              "vgp_periodicite_mois" = $2,
              "vgp_reference_texte"  = $3
        WHERE "id" = $1::uuid`,
      id,
      periodicite,
      texte,
    );

  it("sans périodicité, et sans texte : le refus NOMME la contrainte", async () => {
    const id = await familleJetable();
    await expect(declarer(id, null, "Code du travail NC")).rejects.toThrow(
      /famille_vgp_soumis_exige_sa_base/,
    );
    await expect(declarer(id, 12, null)).rejects.toThrow(
      /famille_vgp_soumis_exige_sa_base/,
    );
    // LE CAS QUI DOIT RESTER VERT, et pour sa propre raison : avec les deux,
    // la déclaration passe. Sans lui, une contrainte qui refuserait TOUT
    // passerait les deux assertions ci-dessus.
    await expect(declarer(id, 12, "Code du travail NC")).resolves.toBe(1);
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "famille_materiel" WHERE "id" = $1::uuid`,
      id,
    );
  });

  it("JUMEAU — la contrainte RETIRÉE, la déclaration incomplète passe", async () => {
    const id = await familleJetable();
    await expect(
      clientOwner().$transaction(async (tx) => {
        // Le verrou VISÉ, et lui seul : la contrainte de positivité reste en
        // place, si bien qu'un refus venu d'elle ne pourrait pas se faire
        // passer pour celui-ci.
        await tx.$executeRawUnsafe(
          `ALTER TABLE "famille_materiel" DROP CONSTRAINT "famille_vgp_soumis_exige_sa_base"`,
        );
        const touchees = await tx.$executeRawUnsafe(
          `UPDATE "famille_materiel"
              SET "assujettissement_vgp" = 'soumis',
                  "vgp_periodicite_mois" = NULL,
                  "vgp_reference_texte"  = NULL
            WHERE "id" = $1::uuid`,
          id,
        );
        // C'EST ICI QUE LE JUMEAU PROUVE : la violation a bien EU LIEU. Sans
        // ce décompte, une mise à jour qui n'aurait touché aucune ligne
        // ressemblerait trait pour trait à un succès (§9, 30/08).
        expect(touchees).toBe(1);
        throw new Error("annulation volontaire du jumeau");
      }),
    ).rejects.toThrow(/annulation volontaire/);

    // Et le verrou est REVENU avec le `ROLLBACK`.
    await expect(declarer(id, null, null)).rejects.toThrow(
      /famille_vgp_soumis_exige_sa_base/,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "famille_materiel" WHERE "id" = $1::uuid`,
      id,
    );
  });
});

describe("L9-06 — une exception sans sa raison est refusée par la base", () => {
  const poser = (exception: string | null, motif: string | null) =>
    clientOwner().$executeRawUnsafe(
      `UPDATE "machine"
          SET "vgp_exception" = $2::"AssujettissementVgp",
              "vgp_exception_motif" = $3
        WHERE "id" = $1::uuid`,
      MACHINE_A1,
      exception,
      motif,
    );

  it("les DEUX sens sont tenus, et le second est celui qu'on oublie", async () => {
    await expect(poser("non_soumis", null)).rejects.toThrow(
      /machine_vgp_exception_exige_son_motif/,
    );
    // Un motif orphelin survivrait au retrait de l'exception qu'il expliquait.
    await expect(poser(null, "usage particulier")).rejects.toThrow(
      /machine_vgp_exception_exige_son_motif/,
    );
    // …et un motif fait D'ESPACES n'est pas un motif : sans cette moitié, la
    // contrainte se contourne en appuyant sur la barre d'espace.
    await expect(poser("non_soumis", "   ")).rejects.toThrow(
      /machine_vgp_exception_exige_son_motif/,
    );

    // LES DEUX CAS QUI DOIVENT RESTER VERTS, chacun pour sa raison.
    await expect(poser("non_soumis", "modifiée pour lever")).resolves.toBe(1);
    await expect(poser(null, null)).resolves.toBe(1);
  });
});

describe("le modèle PRÉCISE, et son chiffre exige son texte lui aussi", () => {
  it("une périodicité de modèle sans référence est refusée", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "modele_materiel"
            SET "vgp_periodicite_mois" = 6, "vgp_reference_texte" = NULL
          WHERE "id" = $1::uuid`,
        MODELE_A,
      ),
    ).rejects.toThrow(/modele_vgp_periodicite_exige_son_texte/);

    // LE CAS QUI RESTE VERT : ne rien préciser du tout est légitime — l'absence
    // n'est pas « aucune périodicité », c'est « rien à préciser ».
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "modele_materiel"
            SET "vgp_periodicite_mois" = NULL, "vgp_reference_texte" = NULL
          WHERE "id" = $1::uuid`,
        MODELE_A,
      ),
    ).resolves.toBe(1);
  });
});

describe("ces colonnes sont AUDITÉES sans qu'on l'ait demandé (L9-07)", () => {
  it("une déclaration laisse sa trace, avec ses valeurs avant et après", async () => {
    const id = await familleJetable();
    // Sous contexte : le déclencheur d'audit lit `app.societe_id` et
    // `app.utilisateur_id`. C'est le périmètre INVERSÉ de D55 en acte — la
    // table est auditée parce qu'elle est métier, pas parce qu'un ticket l'a
    // ajoutée à une liste.
    await sousSociete(SOCIETE_A, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE "famille_materiel"
            SET "assujettissement_vgp" = 'soumis',
                "vgp_periodicite_mois" = 12,
                "vgp_reference_texte"  = 'Code du travail NC, art. Lp. 261-1'
          WHERE "id" = $1::uuid`,
        id,
      ),
    );

    const traces = await clientOwner().$queryRawUnsafe<
      { apres: Record<string, unknown> }[]
    >(
      `SELECT "valeurs_apres" AS "apres" FROM "journal_audit"
        WHERE "entite" = 'famille_materiel' AND "entite_id" = $1::uuid
        ORDER BY "horodatage" DESC LIMIT 1`,
      id,
    );
    expect(traces).toHaveLength(1);
    // « SUR QUELLE BASE » (L9-07) est la référence du texte de L9-04 : elle est
    // dans la trace parce qu'elle est une colonne, sans qu'aucune ligne de ce
    // lot n'ait eu à l'y mettre.
    expect(traces[0]?.apres.vgp_reference_texte).toBe(
      "Code du travail NC, art. Lp. 261-1",
    );
    expect(traces[0]?.apres.assujettissement_vgp).toBe("soumis");

    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "famille_materiel" WHERE "id" = $1::uuid`,
      id,
    );
  });
});
