import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { societesDuCompte } from "@/lib/auth/societe-active";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients, observerSousProprietaire } from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";
import "./setup/env";

/**
 * LA NEUVIÈME FORME — « ADHÉSION » SUR `societe` (Q8 / D67, ticket L2-11).
 *
 * ## Ce qu'il faut prouver, et l'exigence qui compte le plus
 *
 * Trois choses, et la troisième est celle que l'arbitrage réclame nommément :
 * un compte lit le NOM des sociétés où il est habilité ; il ne lit celui
 * d'aucune autre ; et **un compte habilité sur UNE SEULE société ne gagne pas
 * une ligne au passage** — ce qui distingue une branche bornée d'une ouverture.
 *
 * ## Ce que la forme coûte, écrit ici comme ailleurs
 *
 * *Une personne apprend le NOM des sociétés dont D61 lui donne déjà la liste.*
 * Ni leurs données, ni leurs habilitations, ni l'existence d'aucune autre.
 */

afterAll(fermerClients);

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

/** Ouvre un compte et l'habilite sur les sociétés demandées. */
async function compte(
  etiquette: string,
  habilitations: readonly { societeId: string; role: Role }[],
): Promise<string> {
  const email = `adhesion-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  const cree = await creerAuth(clientApp(), {
    societeId: habilitations[0]!.societeId,
    role: Role.admin_societe,
  }).api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `Adhésion ${etiquette}` },
  });

  for (const habilitation of habilitations) {
    await avecContexteRls(
      clientApp(),
      { societeId: habilitation.societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          cree.user.id,
          habilitation.societeId,
          habilitation.role,
        ),
    );
  }
  return cree.user.id;
}

describe("un compte lit le NOM de ses sociétés, et de personne d'autre", () => {
  it("habilité sur DEUX sociétés, il lit les DEUX noms — le mur abattu", async () => {
    const moi = await compte("multi", [
      { societeId: SOCIETE_A, role: Role.adv },
      { societeId: SOCIETE_B, role: Role.technicien },
    ]);

    const siennes = await societesDuCompte(moi, clientApp());
    expect(siennes).toHaveLength(2);
    for (const societe of siennes) {
      expect(
        societe.raisonSociale,
        "un sélecteur ne peut proposer que des UUID tant que ce champ est nul",
      ).not.toBeNull();
    }
  });

  it("habilité sur UNE SEULE société, il ne gagne pas une ligne au passage", async () => {
    // L'EXIGENCE NOMMÉE PAR L'ARBITRAGE. Une branche mal ancrée — « toute
    // société pour un compte habilité quelque part » — passerait les deux
    // scénarios précédents et se ferait prendre ici, et ici seulement.
    const moi = await compte("mono", [
      { societeId: SOCIETE_A, role: Role.adv },
    ]);

    const siennes = await societesDuCompte(moi, clientApp());
    expect(siennes).toHaveLength(1);
    expect(siennes[0]?.societeId).toBe(SOCIETE_A);

    // Et la lecture BRUTE de la table, sous son identité seule, ne rend QUE sa
    // société : c'est la politique qu'on mesure, pas la requête du module.
    const brut = await avecContexteRls(
      clientApp(),
      { societeId: "", role: null, auteurId: moi },
      (tx) => tx.societe.findMany({ select: { id: true } }),
    );
    expect(brut.map((s) => s.id)).toEqual([SOCIETE_A]);

    // TÉMOIN DE NON-VACUITÉ : il y a bien PLUS d'une société en base. Sans lui,
    // « une seule ligne » ne distinguerait pas « bornée » de « base à une ligne ».
    const [total] = await observerSousProprietaire(
      "le décompte TOTAL des sociétés est précisément ce qu'aucune politique " +
        "ne laisse voir : c'est la mesure qui rend la précédente lisible.",
    ).$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "societe"`,
    );
    expect(total?.n).toBeGreaterThan(1);
  });

  it("un compte habilité NULLE PART ne lit aucune société", async () => {
    const orphelin = await compte("orphelin", [
      { societeId: SOCIETE_A, role: Role.adv },
    ]);
    // On lui retire son habilitation : il reste une identité sans société.
    await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `DELETE FROM "utilisateur_societe" WHERE utilisateur_id = $1::uuid`,
          orphelin,
        ),
    );

    expect(await societesDuCompte(orphelin, clientApp())).toEqual([]);
    const brut = await avecContexteRls(
      clientApp(),
      { societeId: "", role: null, auteurId: orphelin },
      (tx) => tx.societe.findMany({ select: { id: true } }),
    );
    expect(brut).toEqual([]);
  });

  it("un balayage SANS identité posée ne rend rien", async () => {
    const balayage = await avecContexteRls(
      clientApp(),
      { societeId: "", role: null },
      (tx) => tx.societe.findMany({ select: { id: true } }),
    );
    expect(balayage).toEqual([]);
  });
});

describe("ce que la branche N'OUVRE PAS", () => {
  it("elle ne rend AUCUNE écriture — ni renommer, ni s'attacher une société", async () => {
    const moi = await compte("ecriture", [
      { societeId: SOCIETE_A, role: Role.adv },
    ]);

    // Sous IDENTITÉ SEULE — le contexte où la branche de D67 est la seule à
    // ouvrir quoi que ce soit sur `societe`.
    const { count } = await avecContexteRls(
      clientApp(),
      { societeId: "", role: null, auteurId: moi },
      (tx) =>
        tx.societe.updateMany({
          where: { id: SOCIETE_A },
          data: { raison_sociale: "RENOMMÉE PAR UN COMPTE" },
        }),
    );
    expect(count).toBe(0);

    const [nom] = await observerSousProprietaire(
      "la raison sociale de A n'est pas lisible hors de son contexte : on la " +
        "vérifie de l'extérieur pour prouver qu'elle n'a pas bougé.",
    ).$queryRawUnsafe<{ raison_sociale: string }[]>(
      `SELECT raison_sociale FROM "societe" WHERE id = $1::uuid`,
      SOCIETE_A,
    );
    expect(nom?.raison_sociale).not.toBe("RENOMMÉE PAR UN COMPTE");
  });

  it("elle ne rend pas les HABILITATIONS des autres comptes de ces sociétés", async () => {
    const moi = await compte("cloison", [
      { societeId: SOCIETE_A, role: Role.adv },
    ]);
    const autre = await compte("voisin", [
      { societeId: SOCIETE_A, role: Role.technicien },
    ]);

    const volees = await avecContexteRls(
      clientApp(),
      { societeId: "", role: null, auteurId: moi },
      (tx) =>
        tx.utilisateurSociete.findMany({
          where: { utilisateur_id: autre },
          select: { societe_id: true },
        }),
    );
    expect(volees).toEqual([]);
  });
});
