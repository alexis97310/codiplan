import { afterAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import {
  ecartsPrivilegesJournal,
  PRIVILEGES_ATTENDUS,
  ROLE_APPLICATIF,
  SQL_PRIVILEGES_JOURNAL,
  TABLE_JOURNAL_AUDIT,
  versPrivilegesJournal,
  type LignePrivilegeJournal,
} from "../../scripts/lib/privileges-journal";
import {
  avecContexteComplet,
  sousSociete,
  sousSocieteEtRole,
  clientOwner,
  fermerClients,
} from "./setup/db";
import {
  AGENCE_A,
  CALENDRIER_A,
  SOCIETE_A,
  SOCIETE_B,
  SURCHARGE_FERIE_A,
  TERRITOIRE_A,
  UTILISATEUR_PAR_ROLE,
  VAR_ROLE,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * **Le journal d'audit** (ticket L0-10 ; invariant I8 ; arbitrages D32 et D50).
 *
 * Quatre propriétés y sont éprouvées contre un vrai PostgreSQL, et aucune ne se
 * prouve en lisant du code :
 *
 *   1. **L'écriture du journal n'est pas facultative.** Elle vient d'un
 *      déclencheur, donc du point de passage obligé : une écriture faite en SQL
 *      brut, hors de tout modèle Prisma, laisse la même ligne qu'une écriture
 *      applicative. Un scénario le montre, et son jumeau retire réellement le
 *      déclencheur pour montrer que c'est bien LUI qui écrit.
 *   2. **Le journal est en ajout seul.** Les privilèges sont lus dans
 *      `information_schema` — la même requête que joue
 *      `scripts/controle-cloisonnement.mts` contre la base hébergée —, et les
 *      refus sont éprouvés par retrait, en DEUX temps : les privilèges d'abord,
 *      la politique ensuite. Deux verrous indépendants, et le jumeau montre
 *      lequel mord quand.
 *   3. **La lecture est cloisonnée, et par rôle.** Une société ne lit pas le
 *      journal d'une autre ; et dans sa propre société, seuls `admin_societe`
 *      et `direction` le lisent (matrice §5.2). Le principe de D50 s'applique
 *      ici comme ailleurs : une lecture d'audit n'apprend rien d'une autre
 *      société.
 *   4. **Le périmètre est tenu par la base, pas par une intention.** Poser le
 *      déclencheur sur une table sans société — un référentiel de plateforme —
 *      fait échouer la première écriture, en nommant la table. C'est la mesure
 *      de la voie retenue au point 4 du ticket ; voir
 *      `docs/decisions/2026-08-29-journal-audit-par-declencheur.md`.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/** Forme d'une ligne d'audit, telle que les scénarios la relisent. */
type LigneAudit = {
  entite: string;
  entite_id: string;
  action: string;
  utilisateur_id: string | null;
  adresse_ip: string | null;
  valeurs_avant: Record<string, unknown> | null;
  valeurs_apres: Record<string, unknown> | null;
};

/**
 * Exécute `travail` dans une transaction ANNULÉE, sous le PROPRIÉTAIRE et avec
 * le contexte société posé. Les écritures d'essai ne survivent pas au scénario,
 * et la fixture ressort intacte.
 */
async function dansUneTransactionAnnulee(
  travail: (tx: PrismaClient) => Promise<void>,
  societeId: string = SOCIETE_A,
  role: string = Role.direction,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        societeId,
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_ROLE,
        role,
      );
      await travail(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }
}

/**
 * Le journal d'une ligne précise, lu SANS politique (propriétaire) : les
 * scénarios d'écriture veulent savoir ce que le déclencheur a produit, pas ce
 * qu'un rôle a le droit d'en voir. Le cloisonnement de la LECTURE a ses propres
 * scénarios, plus bas, et ils passent bien par le rôle applicatif.
 */
function journalDe(
  tx: PrismaClient,
  entite: string,
  entiteId: string,
): Promise<LigneAudit[]> {
  return tx.$queryRawUnsafe<LigneAudit[]>(
    `SELECT "entite", "entite_id"::text AS "entite_id", "action"::text AS "action",
            "utilisateur_id"::text AS "utilisateur_id", "adresse_ip",
            "valeurs_avant", "valeurs_apres"
       FROM "journal_audit"
      WHERE "entite" = $1 AND "entite_id" = $2::uuid
      ORDER BY "horodatage", "action"`,
    entite,
    entiteId,
  );
}

/** Une agence d'essai, créée puis défaite dans la transaction du scénario. */
function agenceEssai(): { id: string; code: string } {
  return { id: uuidv7(), code: `AUDIT-${Date.now()}` };
}

describe("le journal d'audit est écrit par la base (L0-10, I8, D32)", () => {
  afterAll(fermerClients);

  it("création, modification et suppression laissent chacune leur ligne", async () => {
    await dansUneTransactionAnnulee(async (tx) => {
      const agence = agenceEssai();

      await tx.$executeRawUnsafe(
        `INSERT INTO "agence" ("id", "societe_id", "code", "libelle", "territoire")
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
        agence.id,
        SOCIETE_A,
        agence.code,
        "Agence d'essai",
        TERRITOIRE_A,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "agence" SET "libelle" = $2 WHERE "id" = $1::uuid`,
        agence.id,
        "Agence d'essai renommée",
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "agence" WHERE "id" = $1::uuid`,
        agence.id,
      );

      const lignes = await journalDe(tx, "agence", agence.id);

      expect(lignes.map((ligne) => ligne.action)).toEqual([
        "creation",
        "modification",
        "suppression",
      ]);

      // Création : rien avant, tout après.
      expect(lignes[0]?.valeurs_avant).toBeNull();
      expect(lignes[0]?.valeurs_apres).toMatchObject({
        code: agence.code,
        libelle: "Agence d'essai",
      });

      // Modification : les deux états, et l'ancien est bien l'ancien.
      expect(lignes[1]?.valeurs_avant).toMatchObject({
        libelle: "Agence d'essai",
      });
      expect(lignes[1]?.valeurs_apres).toMatchObject({
        libelle: "Agence d'essai renommée",
      });

      // Suppression : tout avant, rien après. La ligne survit à ce qu'elle
      // décrit — c'est pour cela qu'aucune clé étrangère ne la retient.
      expect(lignes[2]?.valeurs_avant).toMatchObject({ code: agence.code });
      expect(lignes[2]?.valeurs_apres).toBeNull();
    });
  });

  it("L'USAGE RÉEL : qui a changé cet état, et DEPUIS QUELLE VALEUR", async () => {
    // Le ticket demande de répondre à « qui a changé ce statut d'intervention,
    // et depuis quelle valeur ». `intervention` arrive au lot 2 ; la question
    // se pose déjà, telle quelle, sur une décision d'agence : ce férié est-il
    // travaillé ? La requête ci-dessous est celle que la console jouera, et
    // elle ne changera pas de forme — seule l'entité changera.
    const auteur = UTILISATEUR_PAR_ROLE[Role.responsable_sav];

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.utilisateur_id', $1, true)",
        auteur,
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.adresse_ip', $1, true)",
        "203.0.113.42",
      );

      await tx.$executeRawUnsafe(
        `UPDATE "calendrier_ferie" SET "travaille" = false WHERE "id" = $1::uuid`,
        SURCHARGE_FERIE_A,
      );

      // La DERNIÈRE ligne : l'écart existe depuis l'amorçage, il porte donc
      // déjà sa ligne de création. C'est bien un historique qu'on relit, pas
      // une table vide.
      const lignes = await journalDe(tx, "calendrier_ferie", SURCHARGE_FERIE_A);
      const ligne = lignes[lignes.length - 1];

      expect(lignes[0]?.action).toBe("creation");
      expect(ligne?.action).toBe("modification");
      expect(ligne?.utilisateur_id).toBe(auteur);
      expect(ligne?.adresse_ip).toBe("203.0.113.42");
      // « depuis quelle valeur » : l'état d'AVANT, lisible champ par champ.
      expect(ligne?.valeurs_avant?.travaille).toBe(true);
      expect(ligne?.valeurs_apres?.travaille).toBe(false);
    });
  });

  it("D52 : ACCORDER UN DROIT est journalisé — qui, quand, depuis quelle valeur", async () => {
    // **L'acte le plus lourd de conséquences du système** : `utilisateur_societe`
    // est la table par laquelle on se donne un accès. Accorder `admin_societe`
    // à un compte, c'est lui donner le droit d'ouvrir des comptes chez le
    // client. La question de l'auditeur — « qui a accordé ce droit, quand,
    // depuis quelle valeur » — est celle qui rend VÉRIFIABLE la procédure de
    // déblocage de D40 (ticket L7-01) : sans cette ligne, la procédure
    // existerait sans preuve qu'elle a été suivie.
    const auteur = UTILISATEUR_PAR_ROLE[Role.admin_societe];
    const beneficiaire = uuidv7();
    const habilitation = uuidv7();

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.utilisateur_id', $1, true)",
        auteur,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO "utilisateur" ("id", "nom", "email", "modifie_le")
         VALUES ($1::uuid, 'Nouvelle recrue', 'recrue-audit@iso.test', now())`,
        beneficiaire,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
        habilitation,
        beneficiaire,
        SOCIETE_A,
        Role.adv,
      );
      // L'ESCALADE : d'un rôle ordinaire à celui qui administre les comptes.
      // Les rôles passent par l'énumération, jamais par une chaîne libre —
      // `tests/unit/auth/roles-sans-chaine-libre.test.ts` (L0-06) l'exige, et
      // la valeur est liée puis castée vers le type PostgreSQL « Role ».
      await tx.$executeRawUnsafe(
        `UPDATE "utilisateur_societe" SET "role" = $2::"Role"
          WHERE "id" = $1::uuid`,
        habilitation,
        Role.admin_societe,
      );

      const lignes = await journalDe(tx, "utilisateur_societe", habilitation);

      expect(lignes.map((ligne) => ligne.action)).toEqual([
        "creation",
        "modification",
      ]);
      // QUI a accordé le droit.
      expect(lignes[1]?.utilisateur_id).toBe(auteur);
      // À QUI.
      expect(lignes[1]?.valeurs_apres?.utilisateur_id).toBe(beneficiaire);
      // DEPUIS QUELLE VALEUR — la moitié de la question, et celle qu'un
      // journal qui n'enregistrerait que l'état courant ne saurait pas rendre.
      expect(lignes[1]?.valeurs_avant?.role).toBe(Role.adv);
      expect(lignes[1]?.valeurs_apres?.role).toBe(Role.admin_societe);
    });
  });

  it("D52 : RETIRER un droit l'est tout autant", async () => {
    // La suppression d'une habilitation est le geste par lequel on efface une
    // trace d'accès. Elle laisse la ligne entière AVANT, donc le rôle retiré.
    const habilitation = uuidv7();
    const beneficiaire = uuidv7();

    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "utilisateur" ("id", "nom", "email", "modifie_le")
         VALUES ($1::uuid, 'Départ', 'depart-audit@iso.test', now())`,
        beneficiaire,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
        habilitation,
        beneficiaire,
        SOCIETE_A,
        Role.direction,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "utilisateur_societe" WHERE "id" = $1::uuid`,
        habilitation,
      );

      const lignes = await journalDe(tx, "utilisateur_societe", habilitation);

      expect(lignes.map((ligne) => ligne.action)).toEqual([
        "creation",
        "suppression",
      ]);
      expect(lignes[1]?.valeurs_avant?.role).toBe(Role.direction);
      expect(lignes[1]?.valeurs_apres).toBeNull();
    });
  });

  it("l'auteur vient de la session — et vaut NULL quand il n'y en a pas", async () => {
    // Deux moitiés, et la seconde compte autant : une écriture sans session —
    // le seed, une tâche planifiée, une correction manuelle — est journalisée
    // QUAND MÊME, avec un auteur nul. Le journal dit qu'il ne sait pas, plutôt
    // que d'inventer un compte (CLAUDE.md §8).
    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "calendrier" SET "libelle" = 'Sans auteur' WHERE "id" = $1::uuid`,
        CALENDRIER_A,
      );

      const lignes = await journalDe(tx, "calendrier", CALENDRIER_A);
      const ligne = lignes[lignes.length - 1];
      expect(ligne?.action).toBe("modification");
      expect(ligne?.utilisateur_id).toBeNull();
      expect(ligne?.adresse_ip).toBeNull();
    });
  });

  it("le module de production pose bien l'auteur : `lib/db/rls.ts`", async () => {
    // Le scénario précédent pose la variable à la main. Celui-ci passe par
    // `avecContexteRls`, c'est-à-dire par le SEUL module qui la posera en
    // production : ce qu'on éprouve n'est pas que la base sache lire une
    // variable, c'est que l'application la pose.
    const auteur = UTILISATEUR_PAR_ROLE[Role.direction];

    const lignes = await avecContexteComplet(
      {
        societeId: SOCIETE_A,
        role: Role.direction,
        auteurId: auteur,
        adresseIp: "198.51.100.7",
      },
      async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE "agence" SET "libelle" = 'Ducos (audit)' WHERE "id" = $1::uuid`,
          AGENCE_A,
        );
        const vues = await tx.$queryRawUnsafe<LigneAudit[]>(
          `SELECT "entite", "entite_id"::text AS "entite_id",
                  "action"::text AS "action",
                  "utilisateur_id"::text AS "utilisateur_id", "adresse_ip",
                  "valeurs_avant", "valeurs_apres"
             FROM "journal_audit"
            WHERE "entite" = 'agence' AND "entite_id" = $1::uuid
            ORDER BY "horodatage" DESC
            LIMIT 1`,
          AGENCE_A,
        );
        // La transaction d'`avecContexteRls` s'engage : on rétablit le libellé
        // dans la même transaction, pour que la fixture ressorte intacte.
        await tx.$executeRawUnsafe(
          `UPDATE "agence" SET "libelle" = 'Ducos' WHERE "id" = $1::uuid`,
          AGENCE_A,
        );
        return vues;
      },
    );

    expect(lignes[0]?.utilisateur_id).toBe(auteur);
    expect(lignes[0]?.adresse_ip).toBe("198.51.100.7");
  });

  it("une écriture EN SQL BRUT est journalisée comme les autres", async () => {
    // Le cœur du ticket, et la raison pour laquelle un intercepteur Prisma ne
    // suffisait pas (D32) : aucun chemin d'écriture n'échappe au déclencheur —
    // ni un script, ni un import, ni un `psql` d'un soir de production. Toutes
    // les écritures de ce fichier sont d'ailleurs en SQL brut : c'est le
    // chemin le plus hostile, et c'est celui qu'on éprouve.
    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "societe" SET "mentions_legales" = 'Correction manuelle'
          WHERE "id" = $1::uuid`,
        SOCIETE_A,
      );

      const lignes = await journalDe(tx, "societe", SOCIETE_A);
      const derniere = lignes[lignes.length - 1];

      expect(derniere?.action).toBe("modification");
      expect(derniere?.valeurs_apres?.mentions_legales).toBe(
        "Correction manuelle",
      );
    });
  });

  it("ÉPREUVE PAR RETRAIT : sans le déclencheur, l'écriture ne laisse rien", async () => {
    // Le jumeau du §9 : il retire LE verrou visé — le déclencheur, pas un
    // voisin — et place le scénario là où le défaut RÉUSSIT. Sans lui, le
    // scénario précédent resterait vert même si la ligne venait d'ailleurs.
    await dansUneTransactionAnnulee(async (tx) => {
      await tx.$executeRawUnsafe('DROP TRIGGER "journal_audit" ON "societe"');
      await tx.$executeRawUnsafe(
        `UPDATE "societe" SET "mentions_legales" = 'Écriture non tracée'
          WHERE "id" = $1::uuid`,
        SOCIETE_A,
      );

      const lignes = await journalDe(tx, "societe", SOCIETE_A);
      const derniere = lignes[lignes.length - 1];

      expect(derniere?.valeurs_apres?.mentions_legales).not.toBe(
        "Écriture non tracée",
      );
    });
  });

  it("une écriture qui ne change RIEN n'écrit rien", async () => {
    // Ce n'est pas une dispense accordée à un chemin d'écriture : « valeurs
    // avant » et « valeurs après » seraient identiques, et la ligne ne dirait
    // rien. Le cas est réel — le seed est idempotent et réécrit ses agences à
    // chaque exécution.
    await dansUneTransactionAnnulee(async (tx) => {
      const avant = await journalDe(tx, "agence", AGENCE_A);

      await tx.$executeRawUnsafe(
        `UPDATE "agence" SET "libelle" = "libelle" WHERE "id" = $1::uuid`,
        AGENCE_A,
      );

      const apres = await journalDe(tx, "agence", AGENCE_A);
      expect(apres.length).toBe(avant.length);
    });
  });
});

describe("le journal d'audit est en AJOUT SEUL (L0-10, I8)", () => {
  afterAll(fermerClients);

  /** Les privilèges réellement accordés, lus sous le propriétaire. */
  async function privilegesObserves() {
    const lignes = await clientOwner().$queryRawUnsafe<LignePrivilegeJournal[]>(
      SQL_PRIVILEGES_JOURNAL,
      ROLE_APPLICATIF,
      TABLE_JOURNAL_AUDIT,
    );
    return versPrivilegesJournal(lignes);
  }

  it("le rôle applicatif ne détient que SELECT et INSERT — observé, pas déclaré", async () => {
    // Même requête et même règle que `scripts/controle-cloisonnement.mts` joue
    // contre la base hébergée : les deux éprouvent la MÊME observation.
    const observes = await privilegesObserves();

    expect(observes.map((accorde) => accorde.privilege).sort()).toEqual([
      ...PRIVILEGES_ATTENDUS,
    ]);
    expect(ecartsPrivilegesJournal(observes)).toEqual([]);
  });

  it("le contrôle voit quelque chose — sinon il serait aveugle", async () => {
    // Zéro ligne ressemblerait à la conformité. Sans ce scénario, une table
    // absente rendrait le précédent vert pour la mauvaise raison.
    expect((await privilegesObserves()).length).toBeGreaterThan(0);
  });

  it("UPDATE et DELETE sont refusés au rôle applicatif", async () => {
    const [cible] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id"::text AS "id" FROM "journal_audit"
        WHERE "societe_id" = $1::uuid LIMIT 1`,
      SOCIETE_A,
    );
    // Le seul fait qu'il existe une ligne prouve déjà quelque chose : elle a
    // été écrite par le déclencheur pendant l'amorçage, sans que le harnais
    // n'écrive jamais dans cette table.
    expect(cible?.id).toBeDefined();

    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.direction, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "journal_audit" SET "adresse_ip" = 'falsifiée'
            WHERE "id" = $1::uuid`,
          cible?.id,
        ),
      ),
    ).rejects.toThrow(/permission denied|droit/i);

    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.direction, (tx) =>
        tx.$executeRawUnsafe(
          `DELETE FROM "journal_audit" WHERE "id" = $1::uuid`,
          cible?.id,
        ),
      ),
    ).rejects.toThrow(/permission denied|droit/i);
  });

  /**
   * L'épreuve par retrait, en DEUX TEMPS — parce qu'il y a DEUX verrous.
   *
   * Le privilège (`REVOKE UPDATE`) et la politique (aucune politique `UPDATE`
   * sous `FORCE ROW LEVEL SECURITY`) tiennent la même propriété, séparément.
   * Un jumeau qui les retirerait tous les deux d'un coup prouverait seulement
   * que « quelque chose » bloquait. On les retire donc l'un après l'autre, et
   * on mesure ce qui reste.
   *
   * `SET LOCAL ROLE` plutôt qu'une seconde connexion : le DDL et l'écriture
   * fautive doivent vivre dans LA MÊME transaction pour que le `ROLLBACK` les
   * défasse ensemble. Sous `SET ROLE`, PostgreSQL applique les privilèges et
   * les politiques du rôle endossé — y compris au propriétaire.
   */
  async function sousLeRoleApplicatif(
    retrait: readonly string[],
    ecriture: (tx: PrismaClient) => Promise<number>,
  ): Promise<number> {
    let affectees = -1;
    try {
      await clientOwner().$transaction(async (tx) => {
        for (const instruction of retrait) {
          await tx.$executeRawUnsafe(instruction);
        }
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_ROLE,
          Role.direction,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APPLICATIF}"`);
        affectees = await ecriture(tx as unknown as PrismaClient);
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }
    return affectees;
  }

  function reecrire(tx: PrismaClient): Promise<number> {
    return tx.$executeRawUnsafe(
      `UPDATE "journal_audit" SET "adresse_ip" = 'falsifiée'
        WHERE "societe_id" = $1::uuid`,
      SOCIETE_A,
    );
  }

  it("ÉPREUVE 1/2 : le privilège rendu, la POLITIQUE mord encore", async () => {
    // Verrou retiré : `GRANT UPDATE`. Il ne reste que la politique — aucune
    // politique `UPDATE` n'existe, et sous FORCE RLS son absence vaut refus.
    // Aucune erreur n'est levée : la ligne est simplement invisible à
    // l'écriture. C'est bien ZÉRO ligne réécrite qu'il faut assertionner, et
    // non un message.
    const affectees = await sousLeRoleApplicatif(
      [`GRANT UPDATE ON "journal_audit" TO "${ROLE_APPLICATIF}"`],
      reecrire,
    );

    expect(affectees).toBe(0);
  });

  it("ÉPREUVE 2/2 : les deux verrous retirés, la réécriture PASSE", async () => {
    // Le scénario est placé là où le défaut RÉUSSIT — sans quoi le jumeau ne
    // prouverait rien. Il montre du même coup que les deux verrous nommés sont
    // bien LE verrou : rien d'autre ne retenait la réécriture.
    const affectees = await sousLeRoleApplicatif(
      [
        `GRANT UPDATE ON "journal_audit" TO "${ROLE_APPLICATIF}"`,
        `CREATE POLICY "reecriture_provisoire" ON "journal_audit"
           FOR UPDATE USING (true) WITH CHECK (true)`,
      ],
      reecrire,
    );

    expect(affectees).toBeGreaterThan(0);
  });
});

describe("la lecture du journal est cloisonnée, et par rôle (L0-10, D50)", () => {
  afterAll(fermerClients);

  function lignesVues(
    societeId: string,
    role: Role | null,
  ): Promise<{ societe_id: string }[]> {
    return sousSocieteEtRole(societeId, role, (tx) =>
      tx.$queryRawUnsafe<{ societe_id: string }[]>(
        `SELECT DISTINCT "societe_id"::text AS "societe_id" FROM "journal_audit"`,
      ),
    );
  }

  it("`direction` lit le journal de SA société, et de la sienne seulement", async () => {
    const vuesDeA = await lignesVues(SOCIETE_A, Role.direction);
    expect(vuesDeA.length).toBeGreaterThan(0);
    expect(vuesDeA.map((ligne) => ligne.societe_id)).toEqual([SOCIETE_A]);

    const vuesDeB = await lignesVues(SOCIETE_B, Role.direction);
    expect(vuesDeB.map((ligne) => ligne.societe_id)).toEqual([SOCIETE_B]);
  });

  it("`admin_societe` le lit aussi — la matrice §5.2 en nomme deux", async () => {
    const vues = await lignesVues(SOCIETE_A, Role.admin_societe);
    expect(vues.map((ligne) => ligne.societe_id)).toEqual([SOCIETE_A]);
  });

  it("les autres rôles n'en lisent RIEN, même dans leur société", async () => {
    // La matrice du §5.2 n'accorde « Consulter le journal d'audit » qu'à
    // `admin_societe` et `direction`. `lib/auth/habilitations.ts` la transcrit ;
    // la base la dit une seconde fois — c'est la deuxième barrière du §12.2.
    for (const role of [Role.adv, Role.technicien, Role.responsable_sav]) {
      expect(await lignesVues(SOCIETE_A, role), role).toEqual([]);
    }
  });

  it("sans rôle, et sans société, rien du tout", async () => {
    expect(await lignesVues(SOCIETE_A, null)).toEqual([]);
    expect(
      await sousSociete(SOCIETE_A, (tx) =>
        tx.$queryRawUnsafe<unknown[]>('SELECT 1 FROM "journal_audit"'),
      ),
    ).toEqual([]);
  });
});

describe("le périmètre du journal est tenu par la base (L0-10, point 4)", () => {
  afterAll(fermerClients);

  it("posé sur un référentiel de plateforme, le déclencheur REFUSE d'écrire", async () => {
    // **La mesure de la voie retenue.** Le journal porte `societe_id NOT NULL`
    // et ne couvre donc pas `devise`, `parite` ni `jour_ferie`, qui n'ont
    // aucune société à porter. Ce n'est pas une intention : le déclencheur
    // lève, en nommant la table et la colonne manquante. Quiconque l'y poserait
    // par mégarde casserait la première écriture, immédiatement.
    let message = "";
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE TRIGGER "journal_audit"
             AFTER INSERT OR UPDATE OR DELETE ON "jour_ferie"
             FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"()`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "jour_ferie" ("id", "territoire", "date", "libelle", "mobile")
           VALUES ($1::uuid, $2, DATE '2099-01-01', 'Férié d''essai', false)`,
          uuidv7(),
          TERRITOIRE_A,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (erreur instanceof Annulation) {
        throw new Error(
          "Le déclencheur a accepté d'écrire une ligne d'audit pour une table " +
            "sans société : le périmètre ne tient plus qu'à une intention.",
        );
      }
      message = erreur instanceof Error ? erreur.message : String(erreur);
    }

    // L'assertion NOMME le refus visé, sans quoi une erreur venue d'ailleurs
    // passerait pour celui-ci.
    expect(message).toContain("jour_ferie");
    expect(message).toContain("societe_id");
    expect(message).toContain("journal_audit");
  });

  it("le refus est LISIBLE sans être INFORMATIF (D50)", async () => {
    // Un refus dit ce qui bloque et la marche à suivre ; il ne compte ni ne
    // nomme ce que son destinataire n'a pas le droit de lire. Celui-ci ne parle
    // que de la table qu'on vient d'écrire.
    let message = "";
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE TRIGGER "journal_audit"
             AFTER INSERT OR UPDATE OR DELETE ON "devise"
             FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"()`,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "devise" SET "libelle" = 'Euro (essai)' WHERE "code" = 'EUR'`,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (erreur instanceof Annulation) {
        throw new Error("Le déclencheur n'a pas refusé l'écriture sur devise.");
      }
      message = erreur instanceof Error ? erreur.message : String(erreur);
    }

    expect(message).toContain("devise");
    expect(message).toContain("Marche à suivre");
    // Aucun décompte, aucun nom de société : le message est le même pour tout
    // le monde, et n'apprend rien de personne.
    expect(message).not.toContain(SOCIETE_A);
    expect(message).not.toContain(SOCIETE_B);
  });

  it("TOUTE table auditée expose une colonne `id` — sinon elle est INÉCRIVABLE", async () => {
    // **LA FAUTE QUE CE SCÉNARIO EXISTE POUR ATTRAPER A EU LIEU** (mesurée le
    // 11/09/2026, au ticket L3-01a). `journal_audit_tracer` désigne la ligne
    // journalisée par sa clé technique (I10) et **lève** quand la table
    // n'expose aucune colonne `id`. `technicien_calendrier` portait le
    // déclencheur depuis le paramétrage par agence **sans avoir cette
    // colonne** : tout `INSERT` y échouait en `P0001`.
    //
    // *Personne ne l'avait vu parce que personne n'écrivait dans cette table* —
    // le §9 du 08/09, un défaut invisible parce que ce qu'il casse n'existe pas
    // encore. Le périmètre d'audit, lui, était vert : il vérifie que le
    // déclencheur EST POSÉ, pas qu'il peut s'exécuter.
    //
    // Ce contrôle est donc la moitié qui manquait, et il est STATIQUE : il ne
    // demande pas qu'on écrive dans chaque table, il demande que chacune PUISSE
    // l'être.
    const auditees = await clientOwner().$queryRawUnsafe<
      Array<{ table_cible: string }>
    >(
      `SELECT c.relname AS table_cible
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
        WHERE t.tgname = 'journal_audit' AND NOT t.tgisinternal
        ORDER BY 1`,
    );
    // Témoin de non-vacuité : un décompte nul ressemble toujours à un
    // sans-faute (§9, 30/08).
    expect(auditees.length).toBeGreaterThanOrEqual(20);

    const colonnes = await clientOwner().$queryRawUnsafe<
      Array<{ table_name: string }>
    >(
      `SELECT "table_name" FROM information_schema.columns
        WHERE "table_schema" = 'public' AND "column_name" = 'id'`,
    );
    const avecId = new Set(colonnes.map((c) => c.table_name));

    expect(
      auditees.map((a) => a.table_cible).filter((nom) => !avecId.has(nom)),
      "ces tables portent le déclencheur d'audit sans exposer de colonne `id` : " +
        "tout INSERT y lèvera en P0001, et rien ne le dira tant que personne " +
        "n'écrira",
    ).toEqual([]);
  });
});
