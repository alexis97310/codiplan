import { afterAll, describe, expect, it } from "vitest";

import { INSTRUCTION_LECTURE_SEULE } from "../../scripts/veille-hebergee.mjs";
import { clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * La VEILLE de la base hébergée est en LECTURE SEULE — mesuré, pas promis.
 *
 * **Pourquoi ce scénario existe.** `scripts/veille-hebergee.mts` tourne chaque
 * nuit contre la base RÉELLE, avec le rôle de MIGRATION — parce que
 * `information_schema.role_table_grants` n'est lisible que pour les droits dont
 * le rôle connecté est bénéficiaire ou concédant, et que sous un autre rôle la
 * requête rendrait zéro ligne, un vide qui ressemble trop à la conformité
 * (D38). Faire tourner un rôle privilégié à échéance fixe sur la production
 * n'est acceptable que si son incapacité à écrire est un VERROU DE LA BASE, pas
 * une propriété du code qu'on relit.
 *
 * **Ce que le verrou couvre**, et c'est plus large qu'on ne l'écrirait à la
 * main : `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` refuse les
 * quatre verbes d'écriture ET tout le DDL. Une veille qui aurait, par accident
 * ou par une dépendance mal choisie, émis un `DROP TRIGGER` ne le ferait pas.
 *
 * **La limite, annoncée** : le verrou est posé par la première instruction de
 * la session. Il ne protège pas de ce qui la précéderait — d'où l'ordre du
 * script, où rien ne vient avant. C'est vérifié par lecture du fichier dans
 * `tests/unit/outils`, et ici c'est l'effet du verrou qui est mesuré.
 */
describe("la veille de la base hébergée n'écrit rien (D55)", () => {
  afterAll(fermerClients);

  it("le verrou refuse les QUATRE verbes d'écriture", async () => {
    for (const fautif of [
      `INSERT INTO "client" ("id", "societe_id", "raison_sociale")
         VALUES (gen_random_uuid(), '${SOCIETE_A}'::uuid, 'Écriture de veille')`,
      `UPDATE "client" SET "raison_sociale" = 'Renommée par la veille'`,
      `DELETE FROM "client"`,
      `TRUNCATE TABLE "client"`,
    ]) {
      await expect(
        clientOwner().$transaction(async (tx) => {
          await tx.$executeRawUnsafe(INSTRUCTION_LECTURE_SEULE);
          await tx.$executeRawUnsafe(fautif);
        }),
        fautif,
      ).rejects.toThrow(/read-only transaction/i);
    }
  });

  it("le verrou refuse aussi le DDL — c'est là qu'il est le plus large", async () => {
    // Les gestes que la veille EXISTE pour attraper sont précisément du DDL :
    // un `DROP TRIGGER`, un `DROP POLICY`, un `ALTER TABLE … DISABLE ROW LEVEL
    // SECURITY`. Il serait absurde qu'elle puisse les commettre.
    for (const fautif of [
      `DROP TRIGGER "journal_audit" ON "client"`,
      `DROP POLICY "cloisonnement_parc" ON "client"`,
      `ALTER TABLE "client" DISABLE ROW LEVEL SECURITY`,
      `GRANT UPDATE ON "journal_audit" TO "codiplan_app"`,
    ]) {
      await expect(
        clientOwner().$transaction(async (tx) => {
          await tx.$executeRawUnsafe(INSTRUCTION_LECTURE_SEULE);
          await tx.$executeRawUnsafe(fautif);
        }),
        fautif,
      ).rejects.toThrow(/read-only transaction/i);
    }
  });

  it("mais il laisse LIRE — sans quoi la veille ne verrait rien", async () => {
    // Témoin de non-vacuité, et il n'est pas décoratif : un verrou qui
    // refuserait aussi les lectures rendrait les scénarios précédents verts
    // pour la mauvaise raison — la veille échouerait en production sans que
    // personne ne sache pourquoi.
    let vues = -1;

    await clientOwner().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(INSTRUCTION_LECTURE_SEULE);
      const lignes = await tx.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM pg_catalog.pg_policies WHERE schemaname = 'public'`,
      );
      vues = Number(lignes[0]?.n ?? -1);
    });

    expect(vues).toBeGreaterThan(0);
  });

  it("ÉPREUVE PAR RETRAIT : sans le verrou, la même écriture PASSE", async () => {
    // Le jumeau. Sans lui, « l'écriture a été refusée » et « cette écriture ne
    // marche pas de toute façon » se ressemblent trait pour trait (§9).
    //
    // **Le jumeau portait `DELETE FROM "client"` jusqu'au ticket L1-02, et il
    // a cessé d'éprouver ce qu'il croyait éprouver le jour où `site` et
    // `utilisateur_client` ont reçu leur clé étrangère vers `client`.** Le
    // `DELETE` échouait alors sur un verrou VOISIN — `violates foreign key
    // constraint` — et non sur le verrou visé. C'est la troisième exigence du
    // 24/08, mot pour mot : le jumeau doit placer le scénario dans la
    // configuration où le défaut RÉUSSIT, jamais dans celle où il échoue
    // autrement. L'`UPDATE` est repris de la même liste de verbes refusés
    // ci-dessus, et rien d'autre que le verrou ne peut le retenir.
    let touchees = -1;

    class Annulation extends Error {}
    try {
      await clientOwner().$transaction(async (tx) => {
        // MÊME instruction, verrou NON posé.
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          SOCIETE_A,
        );
        touchees = await tx.$executeRawUnsafe(
          `UPDATE "client" SET "raison_sociale" = 'Renommée par la veille'`,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }

    expect(touchees).toBeGreaterThan(0);
  });
});
