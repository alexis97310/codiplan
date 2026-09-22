import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { lireAgences } from "../../scripts/lib/feries";
import {
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
  urlOwner,
} from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

/**
 * L'HORIZON DES FÉRIÉS LIT LES AGENCES SOUS UN CLOISONNEMENT FORCÉ — et il
 * doit le DIRE, jamais rendre zéro (FERIES-1, 22/09/2026).
 *
 * **Le constat, mesuré sur la vraie base de production.** `agence` porte
 * `FORCE ROW LEVEL SECURITY` ; `scripts/lib/feries.ts` la lisait sans poser de
 * contexte ni prendre d'identité exemptée. Un rôle qui n'est ni superutilisateur
 * ni `BYPASSRLS` — le propriétaire de migration tel qu'un hébergeur le donne —
 * voyait donc ZÉRO agence, et le script concluait « aucun territoire n'est
 * rattaché à une agence ». *Il ne se trompait pas, il ne regardait rien* (§9,
 * 07/09). Une base qui porte une agence et une base dont on ne voit pas les
 * agences rendaient le MÊME message : c'est le silence qu'on referme ici, avant
 * même de faire marcher le bouton.
 *
 * **Pourquoi la mesure se fait sous le rôle applicatif.** Sur la base jetable,
 * le propriétaire est superutilisateur : il ne voit aucun défaut lié à `FORCE`
 * (c'est précisément pour cela que `verify:full` ne l'a jamais vu). Le seul
 * rôle local soumis aux politiques est `codiplan_app` — non propriétaire, non
 * `BYPASSRLS` —, et c'est le rôle SOUS LEQUEL tous les scénarios de ce
 * répertoire tournent. Il rend la même chose que le propriétaire hébergé : zéro
 * ligne sans contexte, sans erreur.
 *
 * **Puis le chemin de l'hébergé, rejoué tel quel** : un rôle de connexion sans
 * exemption, membre `NOINHERIT` d'un rôle `BYPASSRLS` — la forme courante chez
 * un hébergeur infogéré, et celle qu'`inventaire.mts` sait déjà prendre par
 * `SET LOCAL ROLE`. La lecture des agences DOIT emprunter ce mécanisme, pas en
 * inventer un.
 */

/** Rôle de connexion « à la façon de l'hébergeur » : soumis aux politiques. */
const ROLE_CONNEXION = "feries_epreuve_connexion";
/** Rôle exempté dont il est membre, sans héritage : seul `SET ROLE` le prend. */
const ROLE_EXEMPTE = "feries_epreuve_exempte";

function urlSous(role: string): string {
  const url = new URL(urlOwner());
  url.username = role;
  url.password = "";
  return url.toString();
}

let connexion: PrismaClient | undefined;

function clientConnexion(): PrismaClient {
  connexion ??= new PrismaClient({
    datasources: { db: { url: urlSous(ROLE_CONNEXION) } },
  });
  return connexion;
}

async function retirerRoles(): Promise<void> {
  const owner = clientOwner();
  for (const role of [ROLE_CONNEXION, ROLE_EXEMPTE]) {
    // `DROP OWNED` retire les privilèges accordés dans CETTE base ; sans lui,
    // `DROP ROLE` refuse tant qu'un GRANT subsiste.
    await owner.$executeRawUnsafe(
      `DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${role}') THEN
           EXECUTE 'DROP OWNED BY "${role}"';
           EXECUTE 'DROP ROLE "${role}"';
         END IF;
       END $$`,
    );
  }
}

describe("l'horizon des fériés sous cloisonnement forcé (FERIES-1)", () => {
  /** Ce que la base porte RÉELLEMENT — le témoin contre lequel tout se lit. */
  let agencesEnBase = 0;

  beforeAll(async () => {
    const [temoin] = await observerSousProprietaire(
      "décompte total des agences actives, que le rôle applicatif ne peut pas lire sans contexte — c'est le témoin de non-vacuité contre lequel toute lecture à zéro ci-dessous se juge",
    ).$queryRawUnsafe<Array<{ agences: number }>>(
      `SELECT count(*)::int AS "agences" FROM "agence" WHERE "actif"`,
    );
    agencesEnBase = temoin?.agences ?? 0;
    // Le témoin : sans agence en base, « zéro lu » ne prouverait rien.
    expect(agencesEnBase).toBeGreaterThanOrEqual(2);

    await retirerRoles();
    const owner = clientOwner();
    await owner.$executeRawUnsafe(
      `CREATE ROLE "${ROLE_EXEMPTE}" NOLOGIN NOSUPERUSER BYPASSRLS`,
    );
    await owner.$executeRawUnsafe(
      `CREATE ROLE "${ROLE_CONNEXION}" LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT IN ROLE "${ROLE_EXEMPTE}"`,
    );
    // Le rôle de connexion LIT les deux tables — c'est ce qui rend son zéro
    // silencieux : un « permission denied » parlerait, une politique se tait.
    // Le harnais recrée `public` à chaque exécution, sans USAGE pour PUBLIC :
    // chaque rôle reçoit le sien, comme `setup/global.ts` le donne au rôle
    // applicatif.
    await owner.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA "public" TO "${ROLE_CONNEXION}", "${ROLE_EXEMPTE}"`,
    );
    await owner.$executeRawUnsafe(
      `GRANT SELECT ON "agence", "societe" TO "${ROLE_CONNEXION}"`,
    );
  });

  afterAll(async () => {
    await connexion?.$disconnect();
    connexion = undefined;
    await retirerRoles();
    await fermerClients();
  });

  it("LE CONSTAT : sans identité exemptée, la lecture nue rend zéro agence sans un mot", async () => {
    // La reproduction du défaut, telle qu'elle a été mesurée sur la base
    // hébergée — gardée ici pour que le mécanisme ci-dessous soit jugé contre
    // un zéro RÉEL et non contre une hypothèse. Le rôle lit la table, la
    // politique le filtre, et rien ne le dit.
    const nues = await clientConnexion().agence.findMany({
      where: { actif: true },
      select: { id: true },
    });
    expect(nues).toHaveLength(0);
  });

  it("sous le rôle applicatif sans contexte, `lireAgences` REFUSE — elle ne rend jamais zéro", async () => {
    // Avant FERIES-1 : résolvait avec `[]`, et le script concluait « aucun
    // territoire ». `codiplan_app` n'a accès à aucun rôle exempté : la seule
    // issue honnête est de le dire.
    await expect(lireAgences(clientApp())).rejects.toThrow(
      /soumis aux politiques de cloisonnement/,
    );
  });

  it("le refus NOMME le remède — la variable que le script lit, pas celle de l'inventaire", async () => {
    await expect(lireAgences(clientApp())).rejects.toThrow(
      /HORIZON_DATABASE_URL/,
    );
    await expect(lireAgences(clientApp())).rejects.not.toThrow(
      /Inventaire impossible/,
    );
  });

  it("sous un rôle membre d'une exemption qui ne LIT pas encore, le refus nomme le GRANT manquant", async () => {
    // L'exemption de politique et le droit de lecture sont deux choses :
    // retenir un rôle BYPASSRLS sans SELECT échangerait un zéro filtré contre
    // un « permission denied ». Le mécanisme partagé le sait déjà, et ce
    // scénario vérifie que la lecture des agences en hérite.
    await expect(lireAgences(clientConnexion())).rejects.toThrow(
      /GRANT SELECT/,
    );
  });

  it("le chemin de l'hébergé : la lecture prend l'identité exemptée et voit TOUTES les agences", async () => {
    await clientOwner().$executeRawUnsafe(
      `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${ROLE_EXEMPTE}"`,
    );

    const agences = await lireAgences(clientConnexion());

    // Même rôle que le constat plus haut, même base : la seule différence est
    // le mécanisme, et c'est lui qui fait passer de zéro au témoin.
    expect(agences).toHaveLength(agencesEnBase);
  });

  it("les fériés sont un fait de TERRITOIRE : la lecture traverse les sociétés", async () => {
    const agences = await lireAgences(clientConnexion());
    const societes = new Set(agences.map((agence) => agence.societe.code));

    const codes = await observerSousProprietaire(
      "les codes des deux sociétés semées, pour vérifier que la lecture des agences n'en a oublié aucune — un contexte posé société par société n'en verrait qu'une",
    ).societe.findMany({
      where: { id: { in: [SOCIETE_A, SOCIETE_B] } },
      select: { code: true },
    });
    expect(codes).toHaveLength(2);
    for (const societe of codes) {
      expect(societes.has(societe.code)).toBe(true);
    }
  });

  it("l'identité prise meurt avec la transaction : la connexion reste le rôle de départ", async () => {
    // `SET LOCAL ROLE` ne survit pas au COMMIT. L'extension écrit ensuite dans
    // `jour_ferie` sous le rôle CONNECTÉ — le propriétaire, ou un rôle
    // éditeur (D46) — et non sous l'identité exemptée, qui n'a que SELECT.
    await lireAgences(clientConnexion());
    const [apres] = await clientConnexion().$queryRawUnsafe<
      Array<{ role: string }>
    >(`SELECT current_user::text AS "role"`);
    expect(apres?.role).toBe(ROLE_CONNEXION);
  });

  it("sous un rôle DÉJÀ exempté, la lecture ne change rien — le chemin local de `verify:full`", async () => {
    const agences = await lireAgences(clientOwner());
    expect(agences).toHaveLength(agencesEnBase);
  });
});
