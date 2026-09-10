import { afterAll, describe, expect, it } from "vitest";

import {
  avecPortail,
  sousSociete,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import {
  CLIENT_A1,
  EMPREINTE_RECU,
  RECU_A,
  RECU_B,
  SITE_A1_S1,
  SOCIETE_A,
  VAR_CLIENT,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * LE BAC DE RÉCEPTION, ET LA TREIZIÈME FORME (L8-07, D94).
 *
 * **Ce fichier existe parce que la fuite que D93 ferme par la porte principale
 * pouvait rentrer par la porte de service, dans le ticket même qui la ferme.**
 * Le bac nomme des FICHIERS : `notice-KPX-337.pdf` dit qu'un pont élévateur
 * existe quelque part dans la société. Or une table de forme « société » est
 * lisible par un compte portail — sa clause ne lit pas `app.client_id`.
 *
 * Les scénarios mesurent donc deux choses distinctes : que le bac est fermé au
 * portail, et que la déduplication est tenue par la BASE et non par une lecture.
 */

afterAll(fermerClients);

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

const NEUF = "aaaaaaaa-0000-7000-8000-00000000e0ff";

describe("le TÉMOIN PRÉALABLE — la politique est en vigueur et elle mord", () => {
  it("les DEUX drapeaux RLS sont posés sur `document_recu`", async () => {
    const [etat] = await observerSousProprietaire(
      "lire pg_class : `FORCE ROW LEVEL SECURITY` ne concerne que le " +
        "propriétaire et ne se prouve pas par une lecture faite sous le rôle " +
        "applicatif (§9, 31/08).",
    ).$queryRawUnsafe<
      Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >(
      `SELECT "relrowsecurity", "relforcerowsecurity" FROM "pg_class"
        WHERE "relname" = 'document_recu' AND "relnamespace" = 'public'::regnamespace`,
    );
    expect(etat?.relrowsecurity).toBe(true);
    expect(etat?.relforcerowsecurity).toBe(true);
  });

  it("sans contexte, la table ne rend AUCUNE ligne — et il y en a deux", async () => {
    const vues = await sousSociete("", (tx) =>
      tx.documentRecu.findMany({ select: { id: true } }),
    );
    expect(vues).toEqual([]);
    const [reel] = await observerSousProprietaire(
      "compter les lignes réellement présentes : zéro contre zéro n'est pas " +
        "un résultat, c'est une absence de mesure (§9, 10/09).",
    ).$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "document_recu"`,
    );
    expect(Number(reel?.n)).toBe(2);
  });
});

describe("LA FORME « INTERNE » — le bac est fermé au portail", () => {
  it("un utilisateur interne lit le bac de SA société, et lui seul", async () => {
    const vus = await sousSociete(SOCIETE_A, (tx) =>
      tx.documentRecu.findMany({ select: { id: true, nom_fichier: true } }),
    );
    expect(vus.map((r) => r.id)).toEqual([RECU_A]);
    expect(vus.map((r) => r.id)).not.toContain(RECU_B);
  });

  it("un compte portail n'en lit RIEN — pas même le nom d'un fichier", async () => {
    // *`notice-KPX-337.pdf` dit qu'un pont élévateur existe quelque part.*
    // C'est exactement la fuite que D93 ferme sur `modele_materiel`, et elle
    // serait rentrée par ici sous la forme « société ».
    const vus = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tx.documentRecu.findMany({ select: { id: true } }),
    );
    expect(vus).toEqual([]);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : le MÊME
    // compte, au MÊME instant, lit bien SES documents. Ce n'est donc pas la
    // session qui est muette, c'est le bac qui est fermé.
    const documents = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tx.document.findMany({ select: { id: true } }),
    );
    expect(documents.length).toBeGreaterThan(0);
  });

  it("JUMEAU — la clause de société seule, et le portail lit le bac", async () => {
    // La faute TELLE QU'ELLE SE COMMETTRAIT : quelqu'un « aligne » le bac sur
    // les onze autres tables de forme « société ». Tout reste vert, et le nom
    // du fichier part chez le client.
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "cloisonnement_interne" ON "document_recu"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "cloisonnement_societe" ON "document_recu"
             USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
             WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)`,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_CLIENT,
          CLIENT_A1,
        );
        const vus = await tx.$queryRawUnsafe<Array<{ nom_fichier: string }>>(
          `SELECT "nom_fichier" FROM "document_recu"`,
        );
        // LA FUITE, MESURÉE : le compte portail lit le nom du fichier.
        expect(vus.map((r) => r.nom_fichier)).toContain("notice-KPX-337.pdf");
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }

    // LE VERROU EST REVENU au `ROLLBACK`.
    const apres = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A1 },
      (tx) => tx.documentRecu.findMany({ select: { id: true } }),
    );
    expect(apres).toEqual([]);
  });
});

describe("LA DÉDUPLICATION est tenue par la BASE (L8-07)", () => {
  /** Écrit un reçu sous le propriétaire, et rend le motif du refus s'il y en a un. */
  async function deposer(
    societeId: string,
    empreinte: string,
  ): Promise<string> {
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          societeId,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "document_recu" ("id", "societe_id", "empreinte",
             "nom_fichier", "type_mime", "taille_octets", "objet_cle", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3, 'redepose.pdf', 'application/pdf', 1,
             'bac/redepose.pdf', now())`,
          NEUF,
          societeId,
          empreinte,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (erreur instanceof Annulation) {
        return "";
      }
      return String(erreur);
    }
    return "";
  }

  it("le MÊME fichier redéposé dans la MÊME société est refusé, et l'index est NOMMÉ", async () => {
    const motif = await deposer(SOCIETE_A, EMPREINTE_RECU);
    // L'ASSERTION NOMME LE VERROU, et il faut dire COMMENT. Mesuré : par ce
    // chemin, PostgreSQL rend `Code: 23505` et
    // `Key (societe_id, empreinte)=(…) already exists` — il nomme les COLONNES
    // de l'index et non son nom. C'est ce couple qui identifie le verrou visé,
    // et l'exiger vaut mieux que d'exiger un nom que le message ne porte pas :
    // un refus venu d'ailleurs passerait pour le bon (§9, 24/08).
    expect(motif).toContain("23505");
    expect(motif).toContain("(societe_id, empreinte)");
  });

  it("le MÊME fichier dans une AUTRE société passe — et c'est voulu", async () => {
    // Deux sociétés qui exploitent le même matériel déposent légitimement la
    // même notice. Une unicité globale ferait de la seconde un doublon de la
    // première : un cloisonnement franchi par un index.
    //
    // La société B porte déjà cette empreinte ; on éprouve donc sur une
    // troisième valeur dans B, et sur l'empreinte de B dans A.
    const motif = await deposer(SOCIETE_A, "d".repeat(64));
    expect(motif).toBe("");
  });

  it("JUMEAU — l'index retiré, le redépôt PASSE", async () => {
    let ecrite = 0;
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP INDEX "document_recu_societe_empreinte_key"`,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        ecrite = await tx.$executeRawUnsafe(
          `INSERT INTO "document_recu" ("id", "societe_id", "empreinte",
             "nom_fichier", "type_mime", "taille_octets", "objet_cle", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3, 'redepose.pdf', 'application/pdf', 1,
             'bac/redepose.pdf', now())`,
          NEUF,
          SOCIETE_A,
          EMPREINTE_RECU,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }
    // LA VIOLATION A BIEN EU LIEU (§9, 30/08).
    expect(ecrite).toBe(1);
  });
});

describe("LES DEUX ÉTATS TERMINAUX portent chacun leur preuve", () => {
  /** Tente une mise à jour du reçu de A, et rend le motif du refus. */
  async function muter(donnees: string): Promise<string> {
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "document_recu" SET ${donnees} WHERE "id" = $1::uuid`,
          RECU_A,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (erreur instanceof Annulation) {
        return "";
      }
      return String(erreur);
    }
    return "";
  }

  it("classé SANS fiche est refusé, et écarté SANS motif aussi", async () => {
    expect(await muter(`"statut" = 'classe'`)).toContain(
      "document_recu_classe_a_sa_fiche",
    );
    expect(await muter(`"statut" = 'ecarte'`)).toContain(
      "document_recu_ecarte_a_son_motif",
    );
  });

  it("LE SECOND SENS, celui qu'on oublie : un motif SANS écartement est refusé", async () => {
    // *Une exception sans motif est refusée, et un motif sans exception aussi.*
    // C'est la leçon de D88, rejouée ici — et c'est le sens qui manque presque
    // toujours quand on n'écrit qu'une implication.
    expect(await muter(`"ecarte_motif" = 'illisible'`)).toContain(
      "document_recu_ecarte_a_son_motif",
    );
  });

  it("un motif VIDE ne vaut pas un motif", async () => {
    expect(
      await muter(`"statut" = 'ecarte', "ecarte_motif" = '   '`),
    ).toContain("document_recu_ecarte_a_son_motif");
  });
});
