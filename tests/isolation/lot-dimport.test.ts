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
  LIGNE_LOT_A,
  LIGNE_LOT_B,
  LOT_A,
  LOT_B,
  SERIE_DANS_LE_LOT_A,
  SITE_A1_S1,
  SOCIETE_A,
  VAR_CLIENT,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * LE LOT D'IMPORT EST FERMÉ AU PORTAIL (L1-08e, D100).
 *
 * **Ce fichier existe parce qu'une table de forme « société » est lisible par
 * un compte de portail** — sa clause ne lit pas `app.client_id`. Or
 * `import_lot_ligne.valeurs` porte la ligne du fichier telle qu'elle a été lue,
 * et *un fichier d'import de parc contient TOUTES les machines de la société :
 * aucun périmètre de sites ne l'a jamais filtré.* Sous la clause de société
 * seule, un compte restreint à un atelier y aurait lu le parc entier — par une
 * table que personne n'aurait pensé à regarder.
 *
 * C'est la fuite que D94 ferme sur le bac de réception, un étage plus loin : là
 * un NOM DE FICHIER révélait le parc ; ici c'est le parc lui-même.
 */

afterAll(fermerClients);

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

describe("le TÉMOIN PRÉALABLE — les politiques sont en vigueur et elles mordent", () => {
  it("les DEUX drapeaux RLS sont posés sur les deux tables", async () => {
    // `FORCE ROW LEVEL SECURITY` ne concerne que le PROPRIÉTAIRE : il ne se
    // prouve pas par une lecture faite sous le rôle applicatif (§9, 31/08).
    const etats = await observerSousProprietaire(
      "lire pg_class : les deux drapeaux, jamais un seul.",
    ).$queryRawUnsafe<
      Array<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>
    >(
      `SELECT "relname", "relrowsecurity", "relforcerowsecurity" FROM "pg_class"
        WHERE "relname" IN ('import_lot', 'import_lot_ligne')
          AND "relnamespace" = 'public'::regnamespace
        ORDER BY "relname"`,
    );
    expect(etats.map((e) => e.relname)).toEqual([
      "import_lot",
      "import_lot_ligne",
    ]);
    for (const etat of etats) {
      expect(etat.relrowsecurity, etat.relname).toBe(true);
      expect(etat.relforcerowsecurity, etat.relname).toBe(true);
    }
  });

  it("sans contexte, rien n'est rendu — et il y a bien des lignes", async () => {
    const vus = await sousSociete("", (tx) =>
      tx.importLot.findMany({ select: { id: true } }),
    );
    expect(vus).toEqual([]);
    // Zéro contre zéro n'est pas un résultat, c'est une absence de mesure
    // (§9, 10/09). Le décompte réel est lu sous le propriétaire.
    //
    // **Il est MINORÉ et non exact**, et c'est une réparation : *d'autres
    // fichiers de ce répertoire écrivent de vrais lots par le chemin de
    // production* — `chaine-import` et `application-import` —, et vitest ne
    // garantit pas leur ordre. Un décompte exact faisait de ce témoin une
    // assertion sur l'ORDRE D'EXÉCUTION, c'est-à-dire un rouge qui ne parle
    // pas du cloisonnement. Ce qu'il doit dire est « la table n'est pas
    // vide », et il le dit.
    const [reel] = await observerSousProprietaire(
      "compter les lots réellement présents.",
    ).$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "import_lot"`,
    );
    expect(Number(reel?.n)).toBeGreaterThanOrEqual(2);
  });
});

describe("LA FORME « INTERNE » sur les deux tables", () => {
  // **Les assertions portent sur les FIXTURES NOMMÉES, jamais sur le contenu
  // entier de la table.** D'autres fichiers de ce répertoire y écrivent de
  // vrais lots par le chemin de production, et vitest ne garantit pas l'ordre :
  // une liste exacte mesurerait alors l'ordre d'exécution plutôt que le
  // cloisonnement. *Ce qui doit être vrai est « je vois la mienne, je ne vois
  // pas la sienne », et cela se dit sans compter le reste.*

  it("un utilisateur interne lit le lot de SA société, et pas celui de l'autre", async () => {
    const vus = await sousSociete(SOCIETE_A, (tx) =>
      tx.importLot.findMany({ select: { id: true } }),
    );
    const ids = vus.map((l) => l.id);
    expect(ids).toContain(LOT_A);
    expect(ids).not.toContain(LOT_B);
  });

  it("un utilisateur interne lit les LIGNES de SA société, et pas celles de l'autre", async () => {
    const vues = await sousSociete(SOCIETE_A, (tx) =>
      tx.importLotLigne.findMany({ select: { id: true } }),
    );
    const ids = vues.map((l) => l.id);
    expect(ids).toContain(LIGNE_LOT_A);
    expect(ids).not.toContain(LIGNE_LOT_B);
  });

  it("un compte portail n'en lit RIEN — ni le lot, ni ses lignes", async () => {
    const perimetre = {
      societeId: SOCIETE_A,
      clientId: CLIENT_A1,
      perimetreSites: [SITE_A1_S1],
    };

    const lots = await avecPortail(perimetre, (tx) =>
      tx.importLot.findMany({ select: { id: true } }),
    );
    expect(lots).toEqual([]);

    const lignes = await avecPortail(perimetre, (tx) =>
      tx.importLotLigne.findMany({ select: { id: true } }),
    );
    expect(lignes).toEqual([]);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : le MÊME
    // compte, au MÊME instant, lit bien SON parc. Ce n'est donc pas la session
    // qui est muette, ce sont les deux tables qui sont fermées.
    const machines = await avecPortail(perimetre, (tx) =>
      tx.machine.findMany({ select: { id: true } }),
    );
    expect(machines.length).toBeGreaterThan(0);
  });

  it("JUMEAU — la clause de société seule, et le portail lit le PARC dans le lot", async () => {
    // La faute TELLE QU'ELLE SE COMMETTRAIT : quelqu'un « aligne » ces tables
    // sur les autres tables de forme « société ». Tout reste vert, et le parc
    // entier part chez le client — y compris ce qui est hors de son périmètre.
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "cloisonnement_interne" ON "import_lot_ligne"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "cloisonnement_societe" ON "import_lot_ligne"
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
        const vues = await tx.$queryRawUnsafe<Array<{ cle: string }>>(
          `SELECT "cle" FROM "import_lot_ligne"`,
        );
        // LA FUITE, MESURÉE : le compte portail lit un numéro de série qui
        // n'est pas dans son périmètre de sites.
        expect(vues.map((v) => v.cle)).toContain(SERIE_DANS_LE_LOT_A);
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
      (tx) => tx.importLotLigne.findMany({ select: { id: true } }),
    );
    expect(apres).toEqual([]);
  });
});

describe("CE QUE LA BASE REFUSE, et ce qu'elle refuserait sans ses contraintes", () => {
  /** Écrit sous le propriétaire, et rend le nom de la contrainte qui refuse. */
  async function ecrireLigne(
    valeurs: string,
  ): Promise<{ readonly refuse: boolean; readonly message: string }> {
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "import_lot_ligne" ("id", "societe_id", "import_lot_id", "rang", "action", ${valeurs}`,
        );
        throw new Annulation();
      });
      return { refuse: false, message: "" };
    } catch (erreur) {
      if (erreur instanceof Annulation) {
        return { refuse: false, message: "" };
      }
      return { refuse: true, message: String(erreur) };
    }
  }

  const NEUF = "aaaaaaaa-0000-7000-8000-00000000f0ff";

  it("un GABARIT qui porterait une clé est refusé, et la contrainte est nommée", async () => {
    // La propriété que L1-08c avait PROUVÉE en mémoire, tenue par la base :
    // *un gabarit et une ligne vide ne désignent rien, et leur inventer une
    // clé les ferait entrer dans l'espace des clés réelles, où deux lignes
    // muettes deviendraient la même machine.*
    const resultat = await ecrireLigne(
      `"cle", "complete", "valeurs") VALUES ('${NEUF}', '${SOCIETE_A}', '${LOT_A}', 9, 'gabarit', 'SN-FANTOME', true, '{}'::jsonb)`,
    );
    expect(resultat.refuse).toBe(true);
    expect(resultat.message).toContain("import_lot_ligne_muette_sans_cle");
  });

  it("un REJET sans motif est refusé — et un motif sans rejet aussi", async () => {
    // L'équivalence, dans les DEUX sens. *Le second est celui qu'on oublie* :
    // un motif posé sur une ligne qui passera dit qu'elle est refusée.
    const sansMotif = await ecrireLigne(
      `"cle", "complete", "valeurs") VALUES ('${NEUF}', '${SOCIETE_A}', '${LOT_A}', 9, 'rejet', 'SN-X', true, '{}'::jsonb)`,
    );
    expect(sansMotif.refuse).toBe(true);
    expect(sansMotif.message).toContain("import_lot_ligne_rejet_a_son_motif");

    const motifSansRejet = await ecrireLigne(
      `"cle", "complete", "rejet_motif", "valeurs") VALUES ('${NEUF}', '${SOCIETE_A}', '${LOT_A}', 9, 'creation', 'SN-X', true, 'motif', '{}'::jsonb)`,
    );
    expect(motifSansRejet.refuse).toBe(true);
    expect(motifSansRejet.message).toContain(
      "import_lot_ligne_rejet_a_son_motif",
    );
  });

  it("une ligne SAINE passe — le cas qui doit rester vert pour sa propre raison", async () => {
    // §9 (11/09). Sans lui, une écriture qui échouerait pour n'importe quelle
    // autre raison — un chaînage, un type — ferait passer les deux refus
    // ci-dessus pour des verrous éprouvés.
    const saine = await ecrireLigne(
      `"cle", "complete", "valeurs") VALUES ('${NEUF}', '${SOCIETE_A}', '${LOT_A}', 9, 'creation', 'SN-NEUVE', true, '{}'::jsonb)`,
    );
    expect(saine.refuse).toBe(false);
  });
});
