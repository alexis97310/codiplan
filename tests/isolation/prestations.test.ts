import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  basculerActivite,
  creerPrestation,
  famillesVisables,
  listerLesPrestations,
  modifierPrestation,
} from "@/lib/prestations/depot";
import { schemaPrestation } from "@/lib/prestations/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  FAMILLE_A,
  FAMILLE_B,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * R3-15 — LE CATALOGUE DES PRESTATIONS, SOUS LE RÔLE APPLICATIF.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurerait
 *
 * **Le cloisonnement d'une table qui n'avait aucun appelant.** `prestation`
 * existait depuis L1-12 — table, contraintes, politique — et *rien ne l'écrivait
 * ni ne la lisait* : `ls lib/prestations/` rendait un seul fichier. Une
 * politique juste que personne n'appelle dort jusqu'au jour où quelqu'un la
 * découvre fausse (§9, 08/09 — *un défaut invisible parce que ce qu'il casse
 * n'existe pas encore*).
 *
 * **Aucune comparaison de société n'est écrite dans le dépôt** : on lit et on
 * écrit SOUS le contexte, la forme « société » décide, et une prestation
 * d'ailleurs rend le MÊME refus qu'un identifiant inconnu (D35, D50).
 */

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = { ...SESSION, societeId: SOCIETE_B };

const posees: string[] = [];

/**
 * Un code unique par scénario — deux scénarios ne se disputent pas la clé.
 *
 * **Les DERNIERS caractères, jamais les premiers** : un UUID v7 porte
 * l'horodatage sur ses 48 bits de poids fort (I10), si bien que deux
 * identifiants tirés dans la même milliseconde commencent PAREIL. *Mesuré ici
 * même en écrivant ce fichier : deux prestations créées à la suite rendaient le
 * même code, et le scénario échouait sur « code_pris » en croyant mesurer une
 * famille.* C'est le §9 du 14/09 sur le repli du planning, rencontré une
 * seconde fois — un discriminant qui ne discrimine pas.
 */
function code(): string {
  return `ISO-PRESTA-${uuidv7().replaceAll("-", "").slice(-12)}`;
}

function saisie(surcharge: Record<string, unknown> = {}) {
  return schemaPrestation.parse({
    code: code(),
    libelle: "Visite préventive type",
    ...surcharge,
  });
}

async function creer(surcharge: Record<string, unknown> = {}): Promise<string> {
  const resultat = await creerPrestation(
    SESSION,
    saisie(surcharge),
    clientApp(),
  );
  if (!resultat.accepte) {
    throw new Error(`création refusée : ${resultat.motif}`);
  }
  posees.push(resultat.id);
  return resultat.id;
}

describe("R3-15 — le catalogue des prestations", () => {
  afterEach(async () => {
    if (posees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "prestation" WHERE "id" IN (${posees.map((id) => `'${id}'`).join(",")})`,
      );
      posees.length = 0;
    }
  });

  afterAll(fermerClients);

  it("TÉMOIN — la politique mord : sans contexte, zéro prestation", async () => {
    // *Sans lui, tout ce qui suit serait vert sur une base où la RLS ne
    // s'applique pas* (§9, 07/09). Il porte sur le MÉCANISME : la ligne existe,
    // et l'assertion suivante la rend sous un contexte interne.
    await creer();
    const vues = await clientApp().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "prestation"`,
    );
    expect(vues).toHaveLength(0);
  });

  it("une société lit SON catalogue et jamais celui d'une autre", async () => {
    const id = await creer();
    const chezA = await listerLesPrestations(SESSION, clientApp());
    expect(chezA.map((p) => p.id)).toContain(id);

    const chezB = await listerLesPrestations(SESSION_B, clientApp());
    expect(chezB.map((p) => p.id)).not.toContain(id);
  });

  it("modifier une prestation d'une AUTRE société rend « introuvable »", async () => {
    // Aucune comparaison de société n'est écrite dans le dépôt : la politique
    // prononce, et le refus est le même que pour un identifiant inconnu — les
    // distinguer ferait un oracle (D35, D50).
    const id = await creer();
    const ailleurs = await modifierPrestation(
      SESSION_B,
      id,
      saisie(),
      clientApp(),
    );
    const inconnue = await modifierPrestation(
      SESSION_B,
      uuidv7(),
      saisie(),
      clientApp(),
    );
    expect(ailleurs).toStrictEqual({ accepte: false, motif: "introuvable" });
    expect(inconnue).toStrictEqual(ailleurs);
  });

  it("un CODE déjà pris est refusé, et le motif le nomme", async () => {
    const premiere = saisie();
    const resultat = await creerPrestation(SESSION, premiere, clientApp());
    expect(resultat.accepte).toBe(true);
    if (resultat.accepte) posees.push(resultat.id);

    const doublon = await creerPrestation(SESSION, premiere, clientApp());
    expect(doublon).toStrictEqual({ accepte: false, motif: "code_pris" });
  });

  it("le même code dans une AUTRE société passe — le cas qui doit rester vert", async () => {
    // *Le cas qui doit rester vert POUR SA PROPRE RAISON* (§9, 11/09) :
    // l'unicité porte sur `(societe_id, code)`, et un verrou qui la lirait sur
    // le code seul passerait le scénario ci-dessus sans qu'on s'en aperçoive —
    // puis empêcherait deux sociétés d'avoir chacune sa « VISITE ».
    const partage = saisie();
    const chezA = await creerPrestation(SESSION, partage, clientApp());
    expect(chezA.accepte).toBe(true);
    if (chezA.accepte) posees.push(chezA.id);

    const chezB = await creerPrestation(SESSION_B, partage, clientApp());
    expect(chezB.accepte).toBe(true);
    if (chezB.accepte) posees.push(chezB.id);
  });

  it("JUMEAU — l'unicité retirée, le doublon PASSE", async () => {
    // *Un test de refus prouve que le verrou mordait le jour où on l'a écrit*
    // (§9, 24/08). Le jumeau retire LE verrou visé — l'index unique, pas une
    // contrainte voisine — dans une transaction annulée, et montre l'écriture
    // interdite réussir.
    const partage = saisie();
    const premiere = await creerPrestation(SESSION, partage, clientApp());
    expect(premiere.accepte).toBe(true);
    if (premiere.accepte) posees.push(premiere.id);

    await expect(
      clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP INDEX "prestation_societe_id_code_key"`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
           VALUES ('${uuidv7()}', '${SOCIETE_A}', '${partage.code}', 'doublon', now())`,
        );
        throw new Error("rollback voulu");
      }),
    ).rejects.toThrow("rollback voulu");

    // L'index est revenu avec l'annulation, et il mord de nouveau.
    const apres = await creerPrestation(SESSION, partage, clientApp());
    expect(apres).toStrictEqual({ accepte: false, motif: "code_pris" });
  });

  it("une famille d'une AUTRE société est refusée par la clé, jamais par une comparaison", async () => {
    // La clé étrangère est composite `(societe_id, famille_id)` : *sans la
    // société dans la clé, le verrou serait muet là où le cloisonnement doit
    // mordre.* Aucune ligne de TypeScript ne compare ici quoi que ce soit.
    const refus = await creerPrestation(
      SESSION,
      saisie({ famille_id: FAMILLE_B }),
      clientApp(),
    );
    expect(refus).toStrictEqual({
      accepte: false,
      motif: "famille_hors_societe",
    });
  });

  it("une famille de SA société passe, et l'absence de famille aussi", async () => {
    // LES DEUX CAS QUI DOIVENT RESTER VERTS. Le second est le sujet du ticket :
    // *c'est le premier parent facultatif de ce dépôt* — un déplacement, un
    // diagnostic ou une formation ne visent aucune famille de matériel.
    const avec = await creer({ famille_id: FAMILLE_A });
    const sans = await creer();
    const catalogue = await listerLesPrestations(SESSION, clientApp());
    const lues = new Map(catalogue.map((p) => [p.id, p.famille_id]));
    expect(lues.get(avec)).toBe(FAMILLE_A);
    expect(lues.get(sans)).toBeNull();

    const familles = await famillesVisables(SESSION, clientApp());
    expect(familles.map((f) => f.id)).toContain(FAMILLE_A);
    expect(familles.map((f) => f.id)).not.toContain(FAMILLE_B);
  });

  it("une durée NON ESTIMÉE reste nulle — jamais zéro", async () => {
    // *Zéro dirait « instantané ».* La saisie refuse zéro, et l'absence se lit
    // `null` jusqu'au bout de la chaîne : c'est ce que l'écran affiche comme
    // une absence plutôt que comme une valeur.
    const id = await creer();
    const catalogue = await listerLesPrestations(SESSION, clientApp());
    expect(catalogue.find((p) => p.id === id)?.duree_standard_min).toBeNull();

    expect(
      schemaPrestation.safeParse({
        code: code(),
        libelle: "x",
        duree_standard_min: 0,
      }).success,
    ).toBe(false);
    expect(
      schemaPrestation.safeParse({
        code: code(),
        libelle: "x",
        duree_standard_min: 45,
      }).success,
    ).toBe(true);
  });

  it("désactiver retire du CHOIX sans toucher au passé", async () => {
    // Il n'y a AUCUNE suppression : une intervention désignera sa prestation, et
    // *une facture émise sous une prestation disparue ne s'explique plus.*
    const id = await creer();
    const retiree = await basculerActivite(SESSION, id, false, clientApp());
    expect(retiree.accepte).toBe(true);

    const catalogue = await listerLesPrestations(SESSION, clientApp());
    const ligne = catalogue.find((p) => p.id === id);
    // ELLE EST TOUJOURS LÀ, et c'est le sujet : le catalogue la rend inactive
    // plutôt que de la faire disparaître.
    expect(ligne?.actif).toBe(false);
  });
});
