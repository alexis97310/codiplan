import { afterAll, describe, expect, it } from "vitest";

import {
  ecartsPolitiques,
  formeAttendue,
  RAPPEL_FORMES,
  SQL_COLONNE_SOCIETE,
  SQL_POLITIQUES,
  tablesPremiereCategorie,
  type ColonneSociete,
  type PolitiqueObservee,
} from "../../scripts/lib/politiques-rls";
import { clientOwner, fermerClients } from "./setup/db";

/**
 * Les FORMES de politique RLS, mesurées en base (ticket R0-a, écart É9 ;
 * invariant I1 ; D4, D10, D22, D42 ; L0-10).
 *
 * **Ce que ce fichier garde, et que rien ne gardait.** `force-rls.test.ts`
 * prouve que la RLS est ACTIVÉE et FORCÉE ; il ne dit rien de ce que les
 * politiques LAISSENT PASSER. Une table peut porter les deux drapeaux et une
 * politique `USING (true)` : le contrôle d'attribut la trouve irréprochable, et
 * toutes les sociétés se lisent l'une l'autre. C'est le trou que la revue R0 a
 * nommé É9, et il s'ouvre en obéissant au backlog — L0-04 énonce « la forme
 * imposée » au singulier alors qu'il en existe cinq.
 *
 * **Mesuré, jamais déclaré.** Les clauses viennent de `pg_policies`, qui rend
 * l'expression ANALYSÉE : les graphies, les enveloppes `DO $$ … $$`, les poses
 * en deux temps et les noms assemblés à l'exécution — les formes 1, 2, 3 et 6
 * du §9 — s'y dissolvent, parce que c'est l'état final qui est lu et non le
 * texte qui l'installe.
 *
 * **Et chaque refus a son jumeau** (§9, 24/08) : les épreuves ci-dessous
 * n'imaginent pas la faute, elles l'ÉCRIVENT réellement — dans une transaction
 * annulée, le DDL étant transactionnel en PostgreSQL — puis vérifient que la
 * faute a bien eu lieu avant de vérifier que le gardien la voit. La sonde
 * compte autant que l'assertion : c'est elle qui a démasqué les épreuves
 * creuses du 30/08.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/** Ce qu'une épreuve observe, une fois la faute écrite et avant l'annulation. */
type Observation = {
  colonnes: ColonneSociete[];
  politiques: PolitiqueObservee[];
  ecarts: string[];
};

function lireColonnes(client: {
  $queryRawUnsafe: <T>(sql: string) => Promise<T>;
}): Promise<ColonneSociete[]> {
  return client.$queryRawUnsafe<ColonneSociete[]>(SQL_COLONNE_SOCIETE);
}

function lirePolitiques(client: {
  $queryRawUnsafe: <T>(sql: string) => Promise<T>;
}): Promise<PolitiqueObservee[]> {
  return client.$queryRawUnsafe<PolitiqueObservee[]>(SQL_POLITIQUES);
}

/**
 * Joue `faute` dans une transaction ANNULÉE, puis rend ce que la base montre
 * une fois la faute écrite. Le `ROLLBACK` remet la base en l'état — les
 * scénarios suivants ne voient rien de tout cela.
 */
async function sousLaFaute(faute: readonly string[]): Promise<Observation> {
  let observation: Observation | undefined;

  try {
    await clientOwner().$transaction(async (tx) => {
      for (const instruction of faute) {
        await tx.$executeRawUnsafe(instruction);
      }
      const colonnes = await lireColonnes(tx);
      const politiques = await lirePolitiques(tx);
      observation = {
        colonnes,
        politiques,
        ecarts: ecartsPolitiques(colonnes, politiques),
      };
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }

  if (observation === undefined) {
    throw new Error("la transaction d'épreuve n'a rien observé.");
  }
  return observation;
}

/** La clause de lecture d'une politique, telle que le catalogue la rend. */
function clause(
  observation: Observation,
  table: string,
  nom: string,
): string | null {
  const trouvee = observation.politiques.find(
    (politique) => politique.table === table && politique.nom === nom,
  );
  return trouvee?.lecture ?? null;
}

/** La forme « société » nue : la clause de L0-04, recopiée sans rien d'autre. */
const CLAUSE_SOCIETE = `"societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid`;

describe("les formes de politique RLS, mesurées en base (R0-a, É9, I1)", () => {
  afterAll(fermerClients);

  it("le SCHÉMA RÉEL porte la bonne forme sur chaque table de la 1ʳᵉ catégorie", async () => {
    const colonnes = await lireColonnes(clientOwner());
    const politiques = await lirePolitiques(clientOwner());

    expect(
      ecartsPolitiques(colonnes, politiques),
      `Les cinq formes en vigueur :\n  ${RAPPEL_FORMES}\n\n` +
        "Celle qui ne s'applique JAMAIS à une table métier ordinaire est " +
        "« référentiel », et ses deux moitiés sont fausses séparément : sa " +
        "lecture ouvre toutes les lignes à toutes les sociétés, son écriture " +
        "donne le droit au salarié de l'éditeur et le retire à la société " +
        "propriétaire. Voir scripts/lib/politiques-rls.ts et le pied de I1.",
    ).toEqual([]);
  });

  it("le gardien a réellement regardé — témoins de non-vacuité", async () => {
    const colonnes = await lireColonnes(clientOwner());
    const politiques = await lirePolitiques(clientOwner());

    // Un décompte nul ressemble toujours à un sans-faute (§9, 30/08).
    expect(politiques.length).toBeGreaterThanOrEqual(19);

    const premiereCategorie = tablesPremiereCategorie(colonnes);
    // Sept tables du socle, le journal, et les trois fixtures du parc.
    expect(premiereCategorie.length).toBeGreaterThanOrEqual(11);

    // Chaque forme est réellement PEUPLÉE : une forme à zéro dirait que le
    // classement ne mord pas, et le gardien passerait au vert en rangeant tout
    // au même endroit.
    const parForme = new Map<string, string[]>();
    for (const colonne of premiereCategorie) {
      const forme = formeAttendue(colonne.table);
      parForme.set(forme, [...(parForme.get(forme) ?? []), colonne.table]);
    }
    expect(parForme.get("identité")).toEqual(["societe"]);
    expect(parForme.get("société")).toContain("agence");
    // `utilisateur_societe` a QUITTÉ la forme « société » à L1-02f (D61) : elle
    // porte la huitième, « appartenance ». Le témoin le nomme plutôt que de
    // compter, pour qu'un déplacement ultérieur se voie (§9, 06/09).
    expect(parForme.get("appartenance")).toEqual(["utilisateur_societe"]);
    expect([...(parForme.get("parc") ?? [])].sort()).toEqual([
      "client",
      "contact",
      "machine",
      "site",
    ]);
    expect(parForme.get("journal")).toEqual(["journal_audit"]);
  });

  it("ÉPREUVE : la branche « sa propre ligne » sur une ÉCRITURE est refusée (D61)", async () => {
    // LA faute que la huitième forme existe pour arrêter, et elle se commet en
    // simplifiant : une session étend la branche de lecture aux quatre
    // commandes « pour que ce soit cohérent ». Un compte pourrait alors ÉCRIRE
    // sa propre habilitation — s'attribuer le rôle de son choix sur la société
    // de son choix.
    const observation = await sousLaFaute([
      'DROP POLICY "utilisateur_societe_mes_habilitations" ON "utilisateur_societe"',
      'CREATE POLICY "utilisateur_societe_mes_habilitations" ON "utilisateur_societe" ' +
        "FOR ALL USING (\"utilisateur_id\" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid) " +
        "WITH CHECK (\"utilisateur_id\" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid)",
    ]);

    // LA SONDE — la faute a-t-elle bien eu lieu ?
    expect(
      observation.politiques.find(
        (p) =>
          p.table === "utilisateur_societe" &&
          p.nom === "utilisateur_societe_mes_habilitations" &&
          p.commande.toUpperCase() === "ALL",
      ),
    ).toBeDefined();

    expect(
      observation.ecarts.filter((ecart) =>
        /s.attribuer le rôle de son choix/.test(ecart),
      ),
    ).not.toEqual([]);
  });

  it("ÉPREUVE : retirer la branche « sa propre ligne » est refusé aussi (D61)", async () => {
    // Le sens INVERSE, et c'est celui qui se commettrait sans y penser : une
    // session « nettoie » une politique qu'elle croit redondante, et le mur
    // revient — aucun compte ne peut plus découvrir sa propre société.
    const observation = await sousLaFaute([
      'DROP POLICY "utilisateur_societe_mes_habilitations" ON "utilisateur_societe"',
    ]);

    expect(
      observation.politiques.find(
        (p) =>
          p.table === "utilisateur_societe" &&
          p.nom === "utilisateur_societe_mes_habilitations",
      ),
    ).toBeUndefined();

    expect(
      observation.ecarts.filter((ecart) =>
        /branche « sa propre ligne » en `SELECT`/.test(ecart),
      ),
    ).not.toEqual([]);
  });

  it("ÉPREUVE : la forme « référentiel » réellement posée sur une table métier est refusée", async () => {
    // La faute exacte de É9, et elle se commet en OBÉISSANT : une session
    // recopie sur une table métier le régime que L0-06 pose sur `devise`.
    const observation = await sousLaFaute([
      'DROP POLICY "cloisonnement_societe" ON "agence"',
      'CREATE POLICY "referentiel_lisible_par_tous" ON "agence" FOR SELECT USING (true)',
      'CREATE POLICY "referentiel_ecriture_editeur" ON "agence" AS PERMISSIVE FOR ALL ' +
        'USING ("app_est_role_editeur"()) WITH CHECK ("app_est_role_editeur"())',
    ]);

    // LA SONDE — la faute a-t-elle réellement eu lieu ? Sans elle, un
    // `DROP POLICY` silencieusement sans effet rendrait l'épreuve creuse.
    expect(clause(observation, "agence", "referentiel_lisible_par_tous")).toBe(
      "true",
    );
    expect(
      observation.politiques.find(
        (p) => p.table === "agence" && p.nom === "cloisonnement_societe",
      ),
    ).toBeUndefined();

    const siennes = observation.ecarts.filter((ecart) =>
      ecart.includes("« agence »"),
    );
    expect(siennes.length).toBeGreaterThan(0);
    expect(siennes.join("\n")).toContain("ouvre TOUTES les lignes");
    expect(siennes.join("\n")).toContain("app_est_role_editeur()");
  });

  it("ÉPREUVE : le filtre PORTAIL retiré de `client` est refusé (D10, É14)", async () => {
    // **La réparation que la revue R0 redoutait, écrite telle qu'elle le
    // serait.** Le jour où L1-01 crée la vraie table `client`, le plus naturel
    // est de lui donner « la forme imposée » du backlog — la clause société
    // seule. Elle passe tous les scénarios de cloisonnement société, et fait
    // disparaître le portail. Ici, elle ne passe pas.
    const observation = await sousLaFaute([
      'DROP POLICY "cloisonnement_parc" ON "client"',
      `CREATE POLICY "cloisonnement_societe" ON "client" USING (${CLAUSE_SOCIETE}) WITH CHECK (${CLAUSE_SOCIETE})`,
    ]);

    // LA SONDE : la clause posée n'a plus aucune trace du filtre portail.
    const posee = clause(observation, "client", "cloisonnement_societe") ?? "";
    expect(posee).toContain("societe_id");
    expect(posee).not.toContain("app.client_id");

    const siennes = observation.ecarts.filter((ecart) =>
      ecart.includes("« client »"),
    );
    expect(siennes.length).toBeGreaterThan(0);
    expect(siennes.join("\n")).toContain("perdu le filtre `app.client_id`");
  });

  it("ÉPREUVE : le filtre de PÉRIMÈTRE retiré de `machine` est refusé (D10)", async () => {
    // Second temps de la même réparation : on garde le client, on perd les
    // sites. Le compte portail voit alors le parc entier de SON client, y
    // compris les sites qu'on lui a fermés.
    const avecClient =
      `${CLAUSE_SOCIETE} AND (NULLIF(current_setting('app.client_id', true), '') IS NULL ` +
      `OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid)`;
    const observation = await sousLaFaute([
      'DROP POLICY "cloisonnement_parc" ON "machine"',
      `CREATE POLICY "cloisonnement_parc" ON "machine" USING (${avecClient}) WITH CHECK (${avecClient})`,
    ]);

    const posee = clause(observation, "machine", "cloisonnement_parc") ?? "";
    expect(posee).toContain("app.client_id");
    expect(posee).not.toContain("app.perimetre_sites");

    const siennes = observation.ecarts.filter((ecart) =>
      ecart.includes("« machine »"),
    );
    expect(siennes.length).toBeGreaterThan(0);
    expect(siennes.join("\n")).toContain(
      "perdu le filtre `app.perimetre_sites`",
    );
  });

  it("ÉPREUVE : `societe` qui perdrait son cloisonnement par identité est refusée (D42)", async () => {
    const observation = await sousLaFaute([
      'DROP POLICY "cloisonnement_identite" ON "societe"',
      'CREATE POLICY "tout_le_monde" ON "societe" USING (true) WITH CHECK (true)',
    ]);

    expect(clause(observation, "societe", "tout_le_monde")).toBe("true");

    const siennes = observation.ecarts.filter((ecart) =>
      ecart.includes("« societe »"),
    );
    expect(siennes.length).toBeGreaterThan(0);
    expect(siennes.join("\n")).toContain("`id = app.societe_id`");
  });

  it("ÉPREUVE : une table métier SANS aucune politique est refusée", async () => {
    // Fermé plutôt qu'ouvert — donc pas une brèche —, mais une panne : avec
    // FORCE et sans politique, plus personne n'y lit ni n'y écrit. Elle se
    // découvrirait en production.
    const observation = await sousLaFaute([
      'DROP POLICY "cloisonnement_societe" ON "calendrier"',
    ]);

    expect(
      observation.politiques.filter((p) => p.table === "calendrier"),
    ).toHaveLength(0);

    const siennes = observation.ecarts.filter((ecart) =>
      ecart.includes("« calendrier »"),
    );
    expect(siennes).toHaveLength(1);
    expect(siennes[0]).toContain("AUCUNE politique");
  });

  it("ÉPREUVE : la branche `OR societe_id IS NULL` devenue VIVANTE est refusée", async () => {
    // Le vestige de L0-04 est inerte sur une colonne `NOT NULL` : aucune ligne
    // ne peut le satisfaire. Il devient une porte à la seconde où la colonne
    // cesse de l'être — et c'est cette seconde-là que le gardien mesure.
    const observation = await sousLaFaute([
      'ALTER TABLE "agence" ALTER COLUMN "societe_id" DROP NOT NULL',
    ]);

    // LA SONDE : la colonne est réellement devenue nullable.
    const colonne = observation.colonnes.find((c) => c.table === "agence");
    expect(colonne?.presente).toBe(true);
    expect(colonne?.obligatoire).toBe(false);

    const siennes = observation.ecarts.filter((ecart) =>
      ecart.includes("« agence »"),
    );
    expect(siennes.length).toBeGreaterThan(0);
    expect(siennes.join("\n")).toContain("NULLABLE");
    expect(siennes.join("\n")).toContain("VIVANTE");
  });

  it("ÉPREUVE : une politique d'UPDATE sur le journal est refusée (I8, ajout seul)", async () => {
    const observation = await sousLaFaute([
      `CREATE POLICY "journal_audit_correction" ON "journal_audit" FOR UPDATE ` +
        `USING (${CLAUSE_SOCIETE}) WITH CHECK (${CLAUSE_SOCIETE})`,
    ]);

    expect(
      observation.politiques.find(
        (p) =>
          p.table === "journal_audit" && p.nom === "journal_audit_correction",
      ),
    ).toBeDefined();

    const siennes = observation.ecarts.filter((ecart) =>
      ecart.includes("« journal_audit »"),
    );
    expect(siennes.length).toBeGreaterThan(0);
    expect(siennes.join("\n")).toContain("AJOUT SEUL");
  });

  it("ÉPREUVE : une politique RESTRICTIVE ajoutée est refusée", async () => {
    // Aucune forme du dépôt n'est restrictive. Une restrictive se combine par
    // ET : elle peut rendre muettes les permissives voisines sans qu'aucune
    // d'elles ne change — un cloisonnement qui devient une panne, à distance.
    const observation = await sousLaFaute([
      `CREATE POLICY "verrou" ON "agence" AS RESTRICTIVE FOR ALL USING (false)`,
    ]);

    expect(
      observation.politiques.find(
        (p) => p.table === "agence" && p.nom === "verrou",
      )?.permissive,
    ).toBe("RESTRICTIVE");

    const siennes = observation.ecarts.filter((ecart) =>
      ecart.includes("« agence »"),
    );
    expect(siennes.join("\n")).toContain("RESTRICTIVE");
  });

  // **La liste close `TABLES_PARC` n'est PLUS éprouvée ici.** `ecartsListeParc`
  // est de la logique pure : elle ne lit ni `pg_policies`, ni la moindre ligne.
  // La laisser derrière un PostgreSQL jetable rendait le deuxième des trois
  // gardiens de R0-a muet pour une session qui ne lance que `pnpm test` — ce
  // qui est précisément le leg (B) de l'épreuve de L1-01. Elle vit désormais
  // dans `tests/unit/db/liste-parc.test.ts`, et un test ci-dessous vérifie
  // qu'elle y est bien restée plutôt que d'avoir disparu en chemin.
});
