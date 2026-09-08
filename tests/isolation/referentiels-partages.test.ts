import { afterAll, describe, expect, it } from "vitest";

import { sousSociete, clientApp, clientOwner, fermerClients } from "./setup/db";

/** Sortie forcée d'une transaction de jumeau : le `ROLLBACK` défait le DDL. */
class Annulation extends Error {}
import {
  FAMILLE_B,
  MODELE_A,
  MODELE_B,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * Référentiels de plateforme, et ce qui n'en est PLUS un (L0-04, D4 AMENDÉ).
 *
 * Les référentiels de plateforme — `devise`, `parite`, `jour_ferie` — sont
 * lisibles par toutes les sociétés. C'est la deuxième catégorie de I1, et elle
 * a perdu trois entrées le 08/09/2026.
 *
 * **Le mécanisme « une copie masque l'original » est RETIRÉ** : D4 le rangeait
 * sous « modifiables par les seuls rôles éditeur » et écrivait dans la même page
 * qu'une société en crée une copie — une société qui ne peut pas écrire ne peut
 * pas créer de copie. `famille_materiel` et `modele_materiel` sont désormais des
 * tables métier cloisonnées, et ce fichier éprouve les deux régimes CÔTE À
 * CÔTE : ce qui est encore partagé, et ce qui ne l'est plus.
 */
describe("référentiels de plateforme", () => {
  afterAll(fermerClients);

  it("`devise` reste lisible sans contexte société (référentiel plateforme)", async () => {
    const devises = await clientApp().devise.findMany({
      select: { code: true },
    });
    const codes = devises.map((d) => d.code).sort();
    expect(codes).toEqual(["EUR", "XPF"]);
  });

  /**
   * REPORTÉ, ET NON SUPPRIMÉ (ticket L1-05).
   *
   * Ce scénario éprouvait le schéma « modèle de plateforme + copie masquante » :
   * la société A voyait la ligne `societe_id NULL` et sa propre surcharge, mais
   * pas celle de B. **L'amendement à D4 du 08/09/2026 retire ce schéma** —
   * `modele_materiel` est une table métier cloisonnée, il n'y a plus de ligne
   * sans société, et rien ne masque rien.
   *
   * Ce qu'il reste à éprouver est donc plus simple, et il est éprouvé ici plutôt
   * que perdu avec le mécanisme : **A voit SES modèles et jamais ceux de B**. Le
   * scénario change de contenu, pas de place — supprimer un fichier de test ne
   * se voit pas dans une revue, le voir changer, si.
   */
  it("un modèle appartient à sa société, et A ne voit jamais celui de B", async () => {
    const modeles = await sousSociete(SOCIETE_A, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "modele_materiel" ORDER BY "id"`,
      ),
    );
    const ids = modeles.map((m) => m.id);
    expect(ids).toContain(MODELE_A);
    expect(
      ids.includes(MODELE_B),
      "la société A lit le modèle de la société B : la forme « société » ne " +
        "mord pas, ou la table est retombée sur la forme « référentiel », dont " +
        "la lecture est USING (true).",
    ).toBe(false);

    // TÉMOIN DE NON-VACUITÉ : le modèle de B EXISTE, et B le voit.
    const chezB = await sousSociete(SOCIETE_B, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "modele_materiel"`,
      ),
    );
    expect(chezB.map((m) => m.id)).toContain(MODELE_B);
  });

  it("et la FAMILLE suit le même régime — le chaînage refuse celle d'une autre société", async () => {
    // La clé étrangère composite `(societe_id, famille_id)` est contrôlée par la
    // base et exempte de RLS par construction : sans la société dans la clé, le
    // verrou serait muet là où le cloisonnement doit mordre.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "modele_materiel" ("id","societe_id","famille_id","marque","reference")
             VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'Atlas', 'GA-22')`,
          SOCIETE_A,
          FAMILLE_B,
        ),
      ),
    ).rejects.toThrow(/modele_materiel_famille_fkey/);
  });

  it("JUMEAU — retirez la SOCIÉTÉ de la clé, et la famille d'autrui passe", async () => {
    // Le jumeau vise LE verrou en cause : la composition de la clé, pas la
    // politique. Une clé sur `famille_id` seul — la forme qu'un correcteur
    // écrirait sans y penser — laisse un modèle désigner la famille d'une AUTRE
    // société, parce que les contrôles d'intégrité référentielle contournent
    // les politiques RLS par construction.
    const passees = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "modele_materiel" DROP CONSTRAINT "modele_materiel_famille_fkey"`,
        );
        await tx.$executeRawUnsafe(
          `ALTER TABLE "modele_materiel"
             ADD CONSTRAINT "modele_materiel_famille_fkey"
             FOREIGN KEY ("famille_id") REFERENCES "famille_materiel"("id")
             ON DELETE RESTRICT ON UPDATE RESTRICT`,
        );
        const n = await tx.$executeRawUnsafe(
          `INSERT INTO "modele_materiel" ("id","societe_id","famille_id","marque","reference")
             VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'Atlas', 'GA-33')`,
          SOCIETE_A,
          FAMILLE_B,
        );
        throw new Annulation(String(n));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // LA VIOLATION A BIEN EU LIEU : sans ce décompte, le jumeau serait creux.
    expect(passees).toBe(1);

    // Et la contrainte composite est bien revenue au ROLLBACK.
    const [contrainte] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n
         FROM information_schema.key_column_usage
        WHERE constraint_name = 'modele_materiel_famille_fkey'
          AND column_name = 'societe_id'`,
    );
    expect(Number(contrainte?.n)).toBe(1);
  });
});
