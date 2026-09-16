import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  basculerActiviteFamille,
  basculerActiviteModele,
  creerFamille,
  creerModele,
  listerLesFamilles,
  listerLesModeles,
  modifierFamille,
  modifierModele,
} from "@/lib/materiel/depot";
import {
  schemaFamilleMateriel,
  schemaModeleMateriel,
} from "@/lib/materiel/saisie";

import { clientApp, clientOwner, fermerClients, sousSociete } from "./setup/db";
import {
  FAMILLE_A,
  FAMILLE_B,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * L1-05b — LE CHEMIN D'ÉCRITURE DU RÉFÉRENTIEL MATÉRIEL, ET CE QUE LA BASE
 * GARDE QU'UN ÉCRAN NE PEUT PAS GARDER À SA PLACE.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurait
 *
 * L1-05 a livré les deux tables, leurs contraintes et la saisie Zod. **Rien ne
 * créait une famille ni un modèle** — `ls lib/materiel/` rendait `saisie.ts`,
 * et le parc ne se remplissait que par le semis.
 *
 * ## LES VERBES, ET POURQUOI LES TROIS SONT ÉCRITS
 *
 * *`create`, `update` et `upsert` ne compilent pas vers le même SQL*, et
 * `upsert` est le seul à produire un `INSERT … ON CONFLICT DO UPDATE` dont la
 * ligne candidate porte un identifiant NEUF. **C'est lui qui a fait tomber le
 * semis le 14/09/2026** sur `plage_sans_chevauchement`, et le §9 en a tiré la
 * règle : *un gardien de base se lit sur deux axes — quelles lignes regarde-t-il,
 * et par quel VERBE les écrit-il.*
 *
 * **Le dépôt de ce module emploie `create` et `updateMany`, jamais `upsert`.**
 * Les scénarios d'`upsert` passent donc par Prisma directement, sous le contexte
 * cloisonné : *ils mesurent ce que la BASE refuse, là où les deux autres
 * mesurent en plus ce que le DÉPÔT traduit.* Écrire le verbe que la production
 * n'emploie pas est ici volontaire — **l'import l'emploiera** le jour où R6-01
 * et R6-03 donneront une application aux gabarits de famille et de modèle, et
 * *une contrainte éprouvée sur deux verbes sur trois est une contrainte dont on
 * ne sait pas ce qu'elle fait sur le troisième.*
 *
 * ## LE TÉMOIN DE CHAQUE JUMEAU VIT HORS DE SA TRANSACTION
 *
 * *Un jumeau devrait montrer le refus avant de retirer le verrou.* PostgreSQL
 * l'interdit dans la même transaction : une violation abandonne la transaction
 * entière (`25P02`). Le témoin est donc l'assertion de refus qui PRÉCÈDE chaque
 * jumeau, par le même chemin et sur la même ligne.
 */

const contexte = (societeId: string, role: Role) => ({
  utilisateurId: UTILISATEUR_PAR_ROLE[role],
  societeId,
  role,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
});

const ADMIN_A = contexte(SOCIETE_A, Role.admin_societe);
const ADMIN_B = contexte(SOCIETE_B, Role.admin_societe);

/** Un préfixe qui n'appartient qu'à ce fichier — le ménage s'y accroche. */
const PREFIXE = "EPR-";

function famille(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaFamilleMateriel.safeParse({
    code: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    libelle: "Famille d'épreuve",
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

function modele(surcharge: Record<string, unknown> = {}) {
  const analyse = schemaModeleMateriel.safeParse({
    famille_id: FAMILLE_A,
    marque: `${PREFIXE}${Math.floor(Math.random() * 1_000_000)}`,
    reference: "REF-EPREUVE",
    ...surcharge,
  });
  if (!analyse.success) {
    throw new Error(`saisie d'épreuve invalide : ${analyse.error.message}`);
  }
  return analyse.data;
}

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "modele_materiel" WHERE "marque" LIKE '${PREFIXE}%'`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "famille_materiel" WHERE "code" LIKE '${PREFIXE}%'`,
  );
});

afterAll(fermerClients);

// ── 1. LE CHEMIN EXISTE, ET IL ÉCRIT DANS LA BONNE SOCIÉTÉ ──────────────────

describe("L1-05b — le référentiel a enfin un chemin d'écriture", () => {
  it("une famille se crée, se relit et se modifie", async () => {
    const saisie = famille();
    const creation = await creerFamille(ADMIN_A, saisie, clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    const apres = await listerLesFamilles(ADMIN_A, clientApp());
    expect(apres.find((f) => f.id === creation.id)?.libelle).toBe(
      saisie.libelle,
    );

    const modification = await modifierFamille(
      ADMIN_A,
      creation.id,
      { ...saisie, libelle: "Renommée" },
      clientApp(),
    );
    expect(modification.accepte).toBe(true);
    const relue = await listerLesFamilles(ADMIN_A, clientApp());
    expect(relue.find((f) => f.id === creation.id)?.libelle).toBe("Renommée");
  });

  it("un modèle se crée sous sa famille, et la chaîne famille → modèle tient", async () => {
    const parent = await creerFamille(ADMIN_A, famille(), clientApp());
    expect(parent.accepte).toBe(true);
    if (!parent.accepte) return;

    const creation = await creerModele(
      ADMIN_A,
      modele({ famille_id: parent.id }),
      clientApp(),
    );
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    const lus = await listerLesModeles(ADMIN_A, clientApp());
    expect(lus.find((m) => m.id === creation.id)?.famille_id).toBe(parent.id);
  });

  it("une famille NAÎT « à déterminer » — jamais « non soumise » (L9-03)", async () => {
    // *Une case décochée est indiscernable d'une famille jamais examinée*, et
    // un pont élévateur sortirait du registre en silence. Ce module n'écrit
    // AUCUNE colonne de VGP ; le défaut de la colonne est donc ce qui compte,
    // et il se relit plutôt qu'il ne se suppose.
    const creation = await creerFamille(ADMIN_A, famille(), clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    const lignes = await clientOwner().$queryRawUnsafe<
      {
        assujettissement_vgp: string;
        vgp_periodicite_mois: number | null;
        vgp_reference_texte: string | null;
      }[]
    >(
      `SELECT "assujettissement_vgp", "vgp_periodicite_mois", "vgp_reference_texte"
         FROM "famille_materiel" WHERE "id" = $1::uuid`,
      creation.id,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0].assujettissement_vgp).toBe("a_determiner");
    expect(lignes[0].vgp_periodicite_mois).toBeNull();
    expect(lignes[0].vgp_reference_texte).toBeNull();
  });

  it("« non périodique » s'écrit NULL, jamais zéro", async () => {
    // *Une maintenance due tous les zéro jours est due en permanence.* Le champ
    // vide d'un formulaire devient `null` en amont ; ce qui se mesure ici est
    // que la colonne le reçoit bien, et non un zéro traduit en chemin.
    const creation = await creerModele(ADMIN_A, modele(), clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    const lus = await listerLesModeles(ADMIN_A, clientApp());
    const lu = lus.find((m) => m.id === creation.id);
    expect(lu?.periodicite_jours).toBeNull();
    expect(lu?.periodicite_compteur).toBeNull();
  });
});

// ── 2. LE CLOISONNEMENT, ET IL N'EST ÉCRIT NULLE PART DANS LE MODULE ────────

describe("aucune comparaison de société n'est écrite au-dessus de la politique", () => {
  it("une famille d'une AUTRE société est « introuvable », jamais « pas à vous »", async () => {
    // Les distinguer ferait un oracle (D35, D50). `updateMany` rend zéro ligne
    // touchée : *ce n'est pas une erreur technique, c'est la politique qui a
    // refusé*, et elle refuse en silence.
    const refus = await modifierFamille(
      ADMIN_B,
      FAMILLE_A,
      famille(),
      clientApp(),
    );
    expect(refus).toEqual({ accepte: false, motif: "introuvable" });

    const inconnue = await modifierFamille(
      ADMIN_B,
      uuidv7(),
      famille(),
      clientApp(),
    );
    expect(inconnue).toEqual({ accepte: false, motif: "introuvable" });
  });

  it("une bascule d'activité ne franchit pas la frontière", async () => {
    const refus = await basculerActiviteFamille(
      ADMIN_B,
      FAMILLE_A,
      false,
      clientApp(),
    );
    expect(refus).toEqual({ accepte: false, motif: "introuvable" });

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : la même
    // bascule, sous la BONNE société, passe. Sans lui, un module qui refuserait
    // TOUT passerait le scénario ci-dessus sans qu'on s'en aperçoive.
    const creation = await creerFamille(ADMIN_A, famille(), clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    const bascule = await basculerActiviteFamille(
      ADMIN_A,
      creation.id,
      false,
      clientApp(),
    );
    expect(bascule.accepte).toBe(true);
  });

  it("la bascule d'activité d'un MODÈLE ne franchit pas non plus la frontière", async () => {
    // Le pendant exact du scénario ci-dessus sur l'autre table. *Une garantie
    // éprouvée sur une table et supposée sur sa jumelle est une garantie dont
    // on ne sait rien de la seconde.*
    const creation = await creerModele(ADMIN_A, modele(), clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    const refus = await basculerActiviteModele(
      ADMIN_B,
      creation.id,
      false,
      clientApp(),
    );
    expect(refus).toEqual({ accepte: false, motif: "introuvable" });

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON, et il est relu : une
    // bascule qui rendrait « accepté » sans rien écrire passerait le scénario
    // ci-dessus sans qu'on s'en aperçoive.
    const bascule = await basculerActiviteModele(
      ADMIN_A,
      creation.id,
      false,
      clientApp(),
    );
    expect(bascule.accepte).toBe(true);
    const lus = await listerLesModeles(ADMIN_A, clientApp());
    expect(lus.find((m) => m.id === creation.id)?.actif).toBe(false);
  });

  it("un modèle ne peut pas désigner la famille d'une AUTRE société", async () => {
    // Refusé PAR LA CLÉ composite `(societe_id, famille_id)`, jamais par une
    // comparaison écrite dans le module. *Sans la société dans la clé, le
    // verrou serait muet là où le cloisonnement doit mordre.*
    const refus = await creerModele(
      ADMIN_A,
      modele({ famille_id: FAMILLE_B }),
      clientApp(),
    );
    expect(refus).toEqual({ accepte: false, motif: "famille_hors_societe" });
  });
});

// ── 3. LES VERROUS, ÉPROUVÉS SUR LES TROIS VERBES ──────────────────────────

describe("l'unicité du code de famille — les TROIS verbes", () => {
  /** Pose une famille par le chemin applicatif, et rend son code. */
  async function poser(): Promise<{ id: string; code: string }> {
    const saisie = famille();
    const creation = await creerFamille(ADMIN_A, saisie, clientApp());
    if (!creation.accepte) throw new Error("la pose d'épreuve a échoué");
    return { id: creation.id, code: saisie.code };
  }

  it("CREATE — un second code identique est refusé, et le motif est traduit", async () => {
    const { code } = await poser();
    const refus = await creerFamille(ADMIN_A, famille({ code }), clientApp());
    expect(refus).toEqual({ accepte: false, motif: "code_pris" });
  });

  it("UPDATE — renommer vers un code déjà pris est refusé", async () => {
    const { code } = await poser();
    const autre = await poser();
    const refus = await modifierFamille(
      ADMIN_A,
      autre.id,
      famille({ code }),
      clientApp(),
    );
    expect(refus).toEqual({ accepte: false, motif: "code_pris" });
  });

  it("UPSERT avec conflit — la branche UPDATE est jugée, et elle est refusée", async () => {
    // **LE VERBE QUE LE DÉPÔT N'EMPLOIE PAS, ET QUE L'IMPORT EMPLOIERA.** La
    // ligne existe ; le bloc `create` ne sera pas exécuté, et c'est bien la
    // valeur du bloc `update` que l'unicité juge.
    const { code } = await poser();
    const autre = await poser();
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.familleMateriel.upsert({
          where: { id: autre.id },
          create: {
            id: autre.id,
            societe_id: SOCIETE_A,
            code,
            libelle: "Jamais écrite",
          },
          update: { code },
        }),
      ),
    ).rejects.toThrow(/famille_materiel_societe_id_code_key|Unique constraint/);
  });

  it("UPSERT sans conflit — le cas qui doit rester vert pour sa propre raison", async () => {
    // *Un verrou qui refuserait TOUT `upsert` passerait le scénario ci-dessus
    // sans qu'on s'en aperçoive.* Ici la ligne n'existe pas : la branche
    // `create` s'exécute, le code est libre, et elle passe.
    const id = uuidv7();
    const saisie = famille();
    const posee = await sousSociete(SOCIETE_A, (tx) =>
      tx.familleMateriel.upsert({
        where: { id },
        create: {
          id,
          societe_id: SOCIETE_A,
          code: saisie.code,
          libelle: saisie.libelle,
        },
        update: { code: saisie.code },
      }),
    );
    expect(posee.code).toBe(saisie.code);
  });

  it("LE JUMEAU — l'unicité retirée, le second code identique PASSE", async () => {
    // Le témoin est l'assertion de refus du premier scénario, par le même
    // chemin et sur la même ligne. Ici on retire LE verrou visé — pas un
    // voisin — et l'on montre que l'écriture fautive passe alors.
    //
    // **`DROP INDEX`, et pas `DROP CONSTRAINT`** — mesuré le 15/09/2026 :
    // `pg_constraint` ne porte AUCUNE unicité sur ces deux tables, et
    // `pg_indexes` porte `famille_materiel_societe_id_code_key`. La migration de
    // L1-05 les a posées en INDEX uniques. *Un jumeau qui nomme un objet
    // inexistant échoue en `42704` au lieu de retirer le verrou* — et c'est le
    // bon sens de défaillance : il refuse de mesurer, plutôt que de mesurer le
    // refus d'un voisin (§9, 24/08). Le premier jet l'a fait, et c'est la
    // mesure qui l'a dit.
    const { code } = await poser();
    await expect(
      creerFamille(ADMIN_A, famille({ code }), clientApp()),
    ).resolves.toEqual({ accepte: false, motif: "code_pris" });

    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP INDEX "famille_materiel_societe_id_code_key"`,
        );
        const passe = await tx.$executeRawUnsafe(
          `INSERT INTO "famille_materiel" ("id", "societe_id", "code", "libelle")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${code}', 'Doublon')`,
        );
        expect(passe).toBe(1);
        // Le DDL est transactionnel en PostgreSQL : la contrainte revient au
        // `ROLLBACK`, et le jumeau se rejoue à chaque `pnpm verify`.
        throw new AnnulationVoulue();
      })
      .catch((erreur: unknown) => {
        if (!(erreur instanceof AnnulationVoulue)) throw erreur;
      });
  });
});

describe("l'unicité (marque, référence) d'un modèle — les TROIS verbes", () => {
  async function poser(): Promise<{ id: string; marque: string }> {
    const saisie = modele();
    const creation = await creerModele(ADMIN_A, saisie, clientApp());
    if (!creation.accepte) throw new Error("la pose d'épreuve a échoué");
    return { id: creation.id, marque: saisie.marque };
  }

  it("CREATE — le même couple marque et référence est refusé", async () => {
    const { marque } = await poser();
    const refus = await creerModele(ADMIN_A, modele({ marque }), clientApp());
    expect(refus).toEqual({
      accepte: false,
      motif: "marque_reference_prise",
    });
  });

  it("CREATE — la même marque sous une AUTRE référence passe", async () => {
    // Le cas qui doit rester vert pour sa propre raison : l'unicité porte sur
    // le COUPLE, et non sur la marque seule. *Un verrou trop large refuserait
    // le second modèle d'un même constructeur, ce qui est le cas ordinaire.*
    const { marque } = await poser();
    const seconde = await creerModele(
      ADMIN_A,
      modele({ marque, reference: "REF-AUTRE" }),
      clientApp(),
    );
    expect(seconde.accepte).toBe(true);
  });

  it("UPDATE — renommer vers un couple déjà pris est refusé", async () => {
    const premier = await poser();
    const second = await poser();
    const refus = await modifierModele(
      ADMIN_A,
      second.id,
      modele({ marque: premier.marque }),
      clientApp(),
    );
    expect(refus).toEqual({
      accepte: false,
      motif: "marque_reference_prise",
    });
  });

  it("UPSERT avec conflit — la branche UPDATE est jugée, et elle est refusée", async () => {
    const premier = await poser();
    const second = await poser();
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.modeleMateriel.upsert({
          where: { id: second.id },
          create: {
            id: second.id,
            societe_id: SOCIETE_A,
            famille_id: FAMILLE_A,
            marque: premier.marque,
            reference: "REF-EPREUVE",
          },
          update: { marque: premier.marque, reference: "REF-EPREUVE" },
        }),
      ),
    ).rejects.toThrow(
      /modele_materiel_societe_id_marque_reference_key|Unique constraint/,
    );
  });

  it("UPSERT — la famille d'une autre société est refusée PAR LA CLÉ", async () => {
    // Le chaînage composite mord sur le troisième verbe comme sur les deux
    // autres : *une clé étrangère ne connaît pas les politiques, elle connaît
    // les colonnes.*
    const id = uuidv7();
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.modeleMateriel.upsert({
          where: { id },
          create: {
            id,
            societe_id: SOCIETE_A,
            famille_id: FAMILLE_B,
            marque: `${PREFIXE}CROISE`,
            reference: "REF-EPREUVE",
          },
          update: { famille_id: FAMILLE_B },
        }),
      ),
    ).rejects.toThrow(/modele_materiel_famille_fkey|Foreign key/);
  });

  it("LE JUMEAU — la clé étrangère retirée, la famille d'ailleurs PASSE", async () => {
    await expect(
      creerModele(ADMIN_A, modele({ famille_id: FAMILLE_B }), clientApp()),
    ).resolves.toEqual({ accepte: false, motif: "famille_hors_societe" });

    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "modele_materiel" DROP CONSTRAINT "modele_materiel_famille_fkey"`,
        );
        const passe = await tx.$executeRawUnsafe(
          `INSERT INTO "modele_materiel" ("id", "societe_id", "famille_id", "marque", "reference")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${FAMILLE_B}', '${PREFIXE}CROISE', 'REF-EPREUVE')`,
        );
        expect(passe).toBe(1);
        throw new AnnulationVoulue();
      })
      .catch((erreur: unknown) => {
        if (!(erreur instanceof AnnulationVoulue)) throw erreur;
      });
  });
});

describe("les bornes de la donnée elle-même — non vides, périodicités positives", () => {
  it("CREATE — un libellé vide est refusé par la BASE, pas seulement par Zod", async () => {
    // Zod le refuse à l'écran ; ce qui se mesure ici est que la base le refuse
    // AUSSI, parce que l'import et une correction manuelle sont deux chemins de
    // plus. *Une garantie qui ne vit que dans la couche applicative n'en est
    // pas une* (I1).
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.familleMateriel.create({
          data: {
            id: uuidv7(),
            societe_id: SOCIETE_A,
            code: `${PREFIXE}VIDE`,
            libelle: "   ",
          },
        }),
      ),
    ).rejects.toThrow(/famille_materiel_libelle_non_vide/);
  });

  it("UPDATE — une périodicité nulle-en-valeur est refusée", async () => {
    const creation = await creerModele(ADMIN_A, modele(), clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.modeleMateriel.update({
          where: { id: creation.id },
          data: { periodicite_jours: 0 },
        }),
      ),
    ).rejects.toThrow(/modele_materiel_periodicite_jours_positive/);
  });

  it("UPSERT — zéro est refusé sur la branche CREATE aussi", async () => {
    const id = uuidv7();
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.modeleMateriel.upsert({
          where: { id },
          create: {
            id,
            societe_id: SOCIETE_A,
            famille_id: FAMILLE_A,
            marque: `${PREFIXE}ZERO`,
            reference: "REF-EPREUVE",
            periodicite_compteur: 0,
          },
          update: { periodicite_compteur: 0 },
        }),
      ),
    ).rejects.toThrow(/modele_materiel_periodicite_compteur_positive/);
  });

  it("LE JUMEAU — la borne retirée, zéro PASSE", async () => {
    const creation = await creerModele(ADMIN_A, modele(), clientApp());
    expect(creation.accepte).toBe(true);
    if (!creation.accepte) return;

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.modeleMateriel.update({
          where: { id: creation.id },
          data: { periodicite_jours: 0 },
        }),
      ),
    ).rejects.toThrow(/modele_materiel_periodicite_jours_positive/);

    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "modele_materiel" DROP CONSTRAINT "modele_materiel_periodicite_jours_positive"`,
        );
        const passe = await tx.$executeRawUnsafe(
          `UPDATE "modele_materiel" SET "periodicite_jours" = 0 WHERE "id" = '${creation.id}'`,
        );
        expect(passe).toBe(1);
        throw new AnnulationVoulue();
      })
      .catch((erreur: unknown) => {
        if (!(erreur instanceof AnnulationVoulue)) throw erreur;
      });
  });
});

/**
 * L'annulation VOULUE d'un jumeau — elle rend la contrainte au `ROLLBACK`.
 *
 * Une classe nommée plutôt qu'une chaîne : *un `catch` qui reconnaît un message
 * attraperait aussi la vraie panne qu'il devrait laisser remonter.*
 */
class AnnulationVoulue extends Error {}
