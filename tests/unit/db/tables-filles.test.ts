import { describe, expect, it } from "vitest";

import {
  RATTACHEES_HORS_FILIATION,
  TABLES_PARC,
  ecartsListeRattachees,
  ecartsTablesFilles,
  type TableEtParents,
} from "../../../scripts/lib/politiques-rls";
import {
  corpsDuModele,
  lireSchema,
  modelesDuSchema,
} from "../outils/schema-prisma";

/**
 * LE CRITÈRE DE LA SIXIÈME FORME DE POLITIQUE — « filiation » (L1-02, 07/09).
 *
 * Le principe est tranché : **une table fille d'une table du parc est visible
 * si son parent l'est**, par une clause adossée à sa clé étrangère. La forme
 * n'est pas construite, et c'est délibéré — il n'existe aujourd'hui aucune
 * table fille. Le raisonnement complet, son coût mesuré et ce qui reste à
 * écrire vivent en tête de `scripts/lib/politiques-rls.ts`.
 *
 * **Ce fichier est la BORNE QUI PORTE SA CONDITION** (§9, 01/09). Il ne
 * demande rien tant qu'aucune fille n'existe ; il rougit le jour où la première
 * est écrite, et renvoie au principe. C'est ce qui remplace « on y pensera au
 * lot 2 » — une échéance qui, elle, tomberait au moment le plus défavorable
 * (§9, 30/08).
 */

/** Les tables du schéma et celles qu'elles référencent par clé étrangère. */
function tablesEtParents(): TableEtParents[] {
  const schema = lireSchema();
  const modeles = modelesDuSchema(schema);
  // Le nom de TABLE d'un modèle Prisma : les relations nomment le MODÈLE, les
  // listes closes du dépôt nomment la table. Sans cette traduction, `Site` ne
  // serait jamais reconnu comme fille de `client`.
  const tableDuModele = new Map(modeles.map((m) => [m.modele, m.table]));

  return modeles.map((modele) => {
    const parents = new Set<string>();
    // Le CORPS BRUT, et non `champs` : ce dernier découpe chaque ligne en
    // « nom / type » et perd l'attribut `@relation`, qui est précisément ce
    // qui distingue le côté détenteur de la clé du côté inverse.
    for (const ligne of corpsDuModele(schema, modele.modele).split("\n")) {
      // `@relation(fields: […])` marque le côté qui DÉTIENT la clé étrangère,
      // donc le côté fille. Le côté inverse (`sites Site[]`) n'en porte pas et
      // n'est pas compté — sans quoi tout parent serait déclaré fille de ses
      // propres enfants, et le critère rougirait sur tout.
      if (!/@relation\([^)]*fields\s*:/.test(ligne)) {
        continue;
      }
      const type = /^\s*[A-Za-z0-9_]+\s+([A-Za-z0-9_]+)/.exec(ligne)?.[1];
      const table = type === undefined ? undefined : tableDuModele.get(type);
      if (table !== undefined && table !== modele.table) {
        parents.add(table);
      }
    }
    return { table: modele.table, parents: [...parents] };
  });
}

describe("le critère de la sixième forme de politique — « filiation »", () => {
  const observees = tablesEtParents();

  it("le gardien a réellement lu un schéma, et il y voit des rattachements", () => {
    // TÉMOIN DE NON-VACUITÉ (§9, 30/08). Un parseur devenu aveugle rendrait
    // « aucune table fille » — c'est-à-dire exactement le verdict attendu
    // aujourd'hui, et ce contrôle resterait vert le jour de la bascule. On
    // vérifie donc que la lecture des clés étrangères produit quelque chose.
    expect(observees.length).toBeGreaterThan(10);
    const avecParents = observees.filter((o) => o.parents.length > 0);
    expect(
      avecParents.length,
      "aucune clé étrangère reconnue dans le schéma : le critère ne peut " +
        "reconnaître aucune table fille, et il resterait vert quoi qu'il arrive",
    ).toBeGreaterThan(3);
  });

  it("reconnaît `site` comme rattachée à `client` — la lecture est juste", () => {
    // Second témoin, PLUS ÉTROIT : il ne suffit pas que des clés étrangères
    // soient vues, il faut que celles du parc le soient. `site` référence
    // `client`, qui est une table du parc — c'est très exactement la forme
    // qu'aurait une vraie table fille, et si le parseur ne la voyait pas ici,
    // il ne verrait pas non plus `site_horaire` demain.
    const site = observees.find((o) => o.table === "site");
    expect(site?.parents).toContain("client");
  });

  it("aucune table fille aujourd'hui — il n'y a donc rien à construire", () => {
    // Les tables du parc se référencent entre elles (`site` → `client`), et
    // cela ne fait d'aucune une « fille » au sens de cette forme : les deux
    // portent déjà « parc ».
    //
    // `utilisateur_client` est écartée pour une raison de FOND, écrite dans
    // `RATTACHEES_HORS_FILIATION` : elle n'est pas une donnée du parc mais
    // l'HABILITATION qui y donne accès. Le critère l'a trouvée tout seul le
    // jour où elle a reçu sa clé étrangère, et sa vraie question — un compte
    // portail lit-il l'habilitation d'un autre client ? — est portée au
    // registre.
    expect(
      ecartsTablesFilles(observees),
      ecartsTablesFilles(observees).join("\n"),
    ).toEqual([]);
  });

  it("la liste des rattachées HORS filiation est close des deux côtés", () => {
    // Même forme que `CLOISONNEE_PAR_IDENTITE` et que la frontière du domaine
    // d'audit : une liste close n'a de valeur que si les DEUX gestes qui la
    // modifient sont refusés. L'addition est ici le geste dangereux — c'est
    // celui qui ferait taire le critère sur une vraie table fille.
    expect(ecartsListeRattachees()).toEqual([]);
    expect(
      ecartsListeRattachees(["utilisateur_client", "site_horaire"]),
    ).toHaveLength(1);
    expect(ecartsListeRattachees([])).toHaveLength(1);
  });

  it("ÉPREUVE : ranger une vraie fille hors filiation est REFUSÉ", () => {
    // La faute que la liste rendrait possible, éprouvée : faire taire le
    // critère en y rangeant `site_horaire` plutôt qu'en construisant la forme.
    // Le contrôle rougit sur la liste elle-même, et non sur la table.
    const ecarts = ecartsTablesFilles(
      [...observees, { table: "site_horaire", parents: ["site"] }],
      ["utilisateur_client", "site_horaire"],
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("fait taire le critère");
  });

  it("ÉPREUVE : une table fille FABRIQUÉE déclenche le critère et renvoie au principe", () => {
    // La propriété, éprouvée sur le cas qui se produira réellement — une table
    // d'horaires rattachée à `site`. Aucune liste n'est touchée pour qu'elle
    // soit reconnue : c'est sa clé étrangère qui la désigne.
    const ecarts = ecartsTablesFilles([
      ...observees,
      { table: "site_horaire", parents: ["site"] },
    ]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("site_horaire");
    expect(ecarts[0]).toContain("sixième forme");
    // Le message dit ce qu'il ne faut PAS faire, et c'est le plus important :
    // les deux réparations plausibles sont nommées et refusées.
    expect(ecarts[0]).toContain("« société »");
    expect(ecarts[0]).toContain("« parc »");
  });

  it("ÉPREUVE : une table sans rattachement au parc ne déclenche RIEN", () => {
    // La contre-épreuve. Sans elle, un critère qui rougirait sur n'importe
    // quelle table nouvelle passerait pour juste — il serait seulement bruyant.
    expect(
      ecartsTablesFilles([
        ...observees,
        { table: "forfait", parents: ["societe"] },
      ]),
    ).toEqual([]);
  });

  it("échoue si la liste du parc devenait vide — la population se vérifie", () => {
    expect(TABLES_PARC.length).toBeGreaterThan(0);
    expect(RATTACHEES_HORS_FILIATION).toHaveLength(1);
    expect(ecartsTablesFilles([])).toHaveLength(1);
  });
});
