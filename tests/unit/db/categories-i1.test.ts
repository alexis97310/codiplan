import { describe, expect, it } from "vitest";

import { lireSchema, modelesDuSchema } from "../outils/schema-prisma";

/**
 * Gardien d'EXHAUSTIVITÉ des catégories de I1 (arbitrage D41).
 *
 * **Ce qu'il répare, et ce n'est pas une table.** Trois oublis du même type se
 * sont succédé : `second_facteur` et `utilisateur` manquaient à D34, `parite`
 * manquait à D4. À chaque fois le même enchaînement — une liste est fermée un
 * jour, une décision ultérieure crée une table, et personne ne revient ranger
 * la nouvelle venue. La liste reste « close » et devient fausse, ce qui est pire
 * qu'une liste ouverte : elle a l'autorité d'une décision et le contenu d'un
 * oubli. Réparer le troisième cas à la main ne protège pas du quatrième.
 *
 * **Le renversement.** Les autres gardiens partent d'une liste et vérifient que
 * le schéma s'y conforme. Celui-ci part du SCHÉMA — `modelesDuSchema` énumère
 * ce qui existe réellement — et exige que chaque table trouve **exactement une**
 * catégorie. Une table oubliée n'a nulle part où se ranger et fait tomber la
 * vérification le jour où elle est écrite, pas trois arbitrages plus tard.
 *
 * **Zéro et deux échouent tous les deux.** Zéro, c'est l'oubli. Deux, c'est
 * l'inverse et c'est aussi grave : une table technique d'authentification qui se
 * mettrait à porter `societe_id NOT NULL` cesserait d'être technique sans que
 * personne ne l'ait décidé — la liste dirait une chose, la colonne une autre.
 */

/**
 * Les quatre catégories de I1, rappelées telles que la constitution les écrit.
 * Le message d'échec les cite : un développeur qui découvre ce test doit
 * comprendre ce qu'on lui demande sans ouvrir le CLAUDE.md.
 */
const RAPPEL_CATEGORIES = [
  "1. Table métier — porte `societe_id NOT NULL` (ou, pour `societe` seule, " +
    "est cloisonnée par son identité).",
  "2. Référentiel de plateforme — liste close de I1, lisible par toutes les " +
    "sociétés, modifiable par les seuls rôles éditeur.",
  "3. Table technique d'authentification — liste close de I1, pas de " +
    "`societe_id` du tout, purgeable.",
  "4. Table d'identité de plateforme — liste close de I1, `utilisateur` seule, " +
    "durable et sans aucune donnée métier.",
].join("\n  ");

/**
 * Listes closes de I1, recopiées ici EN TOUTES LETTRES.
 *
 * La recopie est délibérée, comme celle de l'énumération des rôles : un gardien
 * qui tirerait ses listes de la même source que le code ne vérifierait rien.
 * Ici, c'est la constitution qui est confrontée au schéma.
 */
const REFERENTIELS_PLATEFORME = [
  "devise",
  "parite",
  "jour_ferie",
  "famille_materiel",
  "modele_materiel",
  "checklist_modele",
];

const TECHNIQUES_AUTHENTIFICATION = [
  "session",
  "compte",
  "verification",
  "second_facteur",
  "journal_acces",
];

const IDENTITE_PLATEFORME = ["utilisateur"];

/**
 * `societe` est cloisonnée par son IDENTITÉ, non par une colonne `societe_id` :
 * la politique de L0-04 s'écrit `id = app.societe_id`. Elle relève bien de la
 * première catégorie — c'est la table que `societe_id` désigne —, mais la règle
 * mécanique « porte une colonne `societe_id` obligatoire » ne peut pas la voir.
 * L'exception est nommée ici plutôt que déduite : une exception qu'on lit vaut
 * mieux qu'une règle qu'on assouplit (D42).
 *
 * **C'est une liste close de plus, et elle est gardée comme les autres.** La
 * série D34–D41 vient de montrer ce qui arrive à une liste close que personne ne
 * surveille : elle garde l'autorité d'une décision et prend le contenu d'un
 * oubli. Celle-ci est la plus exposée des quatre — elle dispense de la seule
 * règle mécanique de I1, et la table suivante qui s'en réclamerait sortirait du
 * cloisonnement par colonne sans que personne ne l'ait décidé. Le gardien
 * `ecartsListeExceptions` échoue donc sur toute entrée autre que `societe`.
 */
const CLOISONNEE_PAR_IDENTITE = ["societe"];

/** L'unique entrée que D42 autorise. Recopiée : c'est la constitution, pas la liste. */
const SEULE_EXCEPTION_ARBITREE = "societe";

/**
 * Écart de la liste d'exceptions elle-même. Rendu sous forme de liste, comme
 * `ecartsCategories` : une liste vide est le seul état acceptable.
 */
export function ecartsListeExceptions(
  liste: readonly string[] = CLOISONNEE_PAR_IDENTITE,
): string[] {
  const intruses = liste.filter((table) => table !== SEULE_EXCEPTION_ARBITREE);
  const ecarts = intruses.map(
    (table) =>
      `« ${table} » a été ajoutée à CLOISONNEE_PAR_IDENTITE : toute addition ` +
      "passe par un arbitrage, elle ne se décide pas dans un ticket.",
  );

  if (!liste.includes(SEULE_EXCEPTION_ARBITREE)) {
    ecarts.push(
      "CLOISONNEE_PAR_IDENTITE ne contient plus son unique entrée " +
        `« ${SEULE_EXCEPTION_ARBITREE} » : toute modification passe par un ` +
        "arbitrage, elle ne se décide pas dans un ticket.",
    );
  }

  return ecarts;
}

type Categorie =
  | "métier (cloisonnée)"
  | "référentiel de plateforme"
  | "technique d'authentification"
  | "identité de plateforme";

/**
 * Catégories auxquelles une table appartient. Zéro comme deux sont des défauts ;
 * la fonction rend donc la liste, jamais un seul verdict.
 */
export function categoriesDeLaTable(
  table: string,
  champs: readonly { nom: string; type: string }[],
): Categorie[] {
  const categories: Categorie[] = [];

  // Première catégorie : `societe_id` OBLIGATOIRE. Le `?` compte — un
  // `societe_id String?` est la forme des référentiels surchargeables (D4), pas
  // celle d'une table métier.
  const cloisonnement = champs.find((champ) => champ.nom === "societe_id");
  const obligatoire =
    cloisonnement !== undefined && !cloisonnement.type.endsWith("?");
  if (obligatoire || CLOISONNEE_PAR_IDENTITE.includes(table)) {
    categories.push("métier (cloisonnée)");
  }

  if (REFERENTIELS_PLATEFORME.includes(table)) {
    categories.push("référentiel de plateforme");
  }
  if (TECHNIQUES_AUTHENTIFICATION.includes(table)) {
    categories.push("technique d'authentification");
  }
  if (IDENTITE_PLATEFORME.includes(table)) {
    categories.push("identité de plateforme");
  }

  return categories;
}

/** Écarts d'un schéma entier — une ligne par table mal rangée. */
export function ecartsCategories(schema: string): string[] {
  return modelesDuSchema(schema).flatMap(({ modele, table, champs }) => {
    const categories = categoriesDeLaTable(table, champs);

    if (categories.length === 0) {
      return [
        `« ${table} » (modèle ${modele}) n'appartient à AUCUNE catégorie de ` +
          "I1. Une table sans catégorie est un oubli, pas une exception : la " +
          "ranger est un arbitrage, jamais une décision de session.",
      ];
    }
    if (categories.length > 1) {
      return [
        `« ${table} » (modèle ${modele}) appartient à ${categories.length} ` +
          `catégories de I1 à la fois — ${categories.join(", ")}. Les ` +
          "catégories s'excluent : la liste dit une chose et le schéma une " +
          "autre, et l'une des deux est fausse.",
      ];
    }
    return [];
  });
}

describe("chaque table appartient à exactement une catégorie de I1 (D41)", () => {
  it("le gardien sait ÉCHOUER sur une table sans catégorie", () => {
    // Sans cette vérification, une classification trop permissive rendrait le
    // gardien vert sur n'importe quel schéma — y compris sur celui d'avant D41.
    const fabrique = `
      model Prestation {
        id      String @id @db.Uuid
        libelle String

        @@map("prestation")
      }
    `;

    const ecarts = ecartsCategories(fabrique);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("prestation");
    expect(ecarts[0]).toContain("AUCUNE catégorie");
  });

  it("le gardien sait ÉCHOUER sur une table à deux catégories", () => {
    // Le cas inverse, et il est aussi grave : une table technique qui se met à
    // porter `societe_id NOT NULL` cesse d'être technique sans décision.
    const fabrique = `
      model Session {
        id         String @id @db.Uuid
        societe_id String @db.Uuid

        @@map("session")
      }
    `;

    const ecarts = ecartsCategories(fabrique);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("2 catégories");
    expect(ecarts[0]).toContain("technique d'authentification");
  });

  it("le gardien ACCEPTE les quatre formes légitimes", () => {
    const fabrique = `
      model Intervention {
        id         String @id @db.Uuid
        societe_id String @db.Uuid

        @@map("intervention")
      }

      model ModeleMateriel {
        id         String  @id @db.Uuid
        societe_id String? @db.Uuid

        @@map("modele_materiel")
      }

      model Verification {
        id String @id @db.Uuid

        @@map("verification")
      }

      model Utilisateur {
        id String @id @db.Uuid

        @@map("utilisateur")
      }
    `;

    expect(ecartsCategories(fabrique)).toEqual([]);
  });

  it("un référentiel surchargeable reste un référentiel — le `?` compte", () => {
    // `modele_materiel` portera `societe_id NULL` (D4) : la copie d'une société
    // masque le modèle de plateforme. Le confondre avec une table métier
    // rendrait la deuxième catégorie inapplicable.
    expect(
      categoriesDeLaTable("modele_materiel", [
        { nom: "societe_id", type: "String?" },
      ]),
    ).toEqual(["référentiel de plateforme"]);

    expect(
      categoriesDeLaTable("intervention", [
        { nom: "societe_id", type: "String" },
      ]),
    ).toEqual(["métier (cloisonnée)"]);
  });

  it("les colonnes de société INFORMATIVES ne rangent rien (D34)", () => {
    // `journal_acces` porte `societe_id_source` et `societe_id_cible` : elles
    // ne sont pas `societe_id`, et elles ne doivent surtout pas faire passer le
    // journal pour une table cloisonnée.
    expect(
      categoriesDeLaTable("journal_acces", [
        { nom: "societe_id_source", type: "String?" },
        { nom: "societe_id_cible", type: "String?" },
      ]),
    ).toEqual(["technique d'authentification"]);

    // Même chose pour `session.societe_id_active`.
    expect(
      categoriesDeLaTable("session", [
        { nom: "societe_id_active", type: "String?" },
      ]),
    ).toEqual(["technique d'authentification"]);
  });

  it("la liste des exceptions ne contient QUE `societe` (D42)", () => {
    // La quatrième liste close de I1. Elle dispense de la seule règle mécanique
    // de la première catégorie : une entrée de plus, et une table sortirait du
    // cloisonnement par colonne sans décision.
    expect(ecartsListeExceptions()).toEqual([]);
    expect(CLOISONNEE_PAR_IDENTITE).toEqual(["societe"]);
  });

  it("le gardien de la liste sait ÉCHOUER sur une addition", () => {
    // Sans cette vérification, le gardien de la liste serait un décor : il
    // faut prouver qu'il voit l'entrée qu'aucun arbitrage n'a rangée.
    const ecarts = ecartsListeExceptions(["societe", "parametrage_plateforme"]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("parametrage_plateforme");
    expect(ecarts[0]).toContain(
      "toute addition passe par un arbitrage, elle ne se décide pas dans un ticket.",
    );
  });

  it("le gardien de la liste sait ÉCHOUER sur un retrait", () => {
    // Le cas inverse : vider la liste rendrait `societe` hors catégorie sans
    // qu'aucune décision ne l'ait voulu.
    const ecarts = ecartsListeExceptions([]);

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("societe");
    expect(ecarts[0]).toContain("arbitrage");
  });

  it("le SCHÉMA RÉEL ne laisse aucune table hors catégorie", () => {
    const ecarts = ecartsCategories(lireSchema());

    expect(
      ecarts,
      `Les quatre catégories de I1 :\n  ${RAPPEL_CATEGORIES}\n\n` +
        "Une table qui n'en trouve aucune n'est pas un cas particulier : " +
        "c'est le quatrième oubli d'une série (D34 en avait laissé deux, D4 " +
        "un troisième). Elle se range par arbitrage — voir docs/arbitrages.md.",
    ).toEqual([]);
  });

  it("le gardien parcourt bien tout le schéma — il ne s'exerce pas sur le vide", () => {
    const modeles = modelesDuSchema(lireSchema());

    // Le socle L0-03, les tables d'authentification de L0-06, le calendrier
    // de L0-08.
    expect(modeles.length).toBeGreaterThanOrEqual(16);
    expect(modeles.map((modele) => modele.table)).toEqual(
      expect.arrayContaining([
        "societe",
        "agence",
        "calendrier",
        "calendrier_plage",
        "calendrier_ferie",
        "jour_ferie",
        "devise",
        "parite",
        "utilisateur",
        "utilisateur_societe",
        "utilisateur_client",
        "session",
        "compte",
        "verification",
        "second_facteur",
        "journal_acces",
      ]),
    );
  });

  it("chaque catégorie est réellement peuplée — aucune n'est décorative", () => {
    const parCategorie = new Map<string, string[]>();
    for (const { table, champs } of modelesDuSchema(lireSchema())) {
      for (const categorie of categoriesDeLaTable(table, champs)) {
        parCategorie.set(categorie, [
          ...(parCategorie.get(categorie) ?? []),
          table,
        ]);
      }
    }

    // Une catégorie vide serait le signe que la règle de classement ne mord
    // pas : le gardien passerait au vert en rangeant tout au même endroit.
    expect(parCategorie.get("métier (cloisonnée)")).toContain("agence");
    expect(parCategorie.get("métier (cloisonnée)")).toContain("calendrier");
    expect(parCategorie.get("référentiel de plateforme")).toContain("devise");
    expect(parCategorie.get("référentiel de plateforme")).toContain(
      "jour_ferie",
    );
    expect(parCategorie.get("technique d'authentification")).toContain(
      "session",
    );
    expect(parCategorie.get("identité de plateforme")).toEqual(["utilisateur"]);
  });
});
