import { describe, expect, it } from "vitest";

import { champsDuModele, lireSchema } from "../outils/schema-prisma";

/**
 * « Aucune donnée métier sur `utilisateur` » (arbitrage D39, invariant I1,
 * quatrième catégorie).
 *
 * **Ce que ce gardien protège.** `utilisateur` ne porte pas de `societe_id`, et
 * ne peut pas en porter : l'identité est unique au niveau plateforme (D35),
 * l'authentification cherche un compte avant qu'aucune société ne soit active.
 * Cette table échappe donc au cloisonnement — et **ce qui rend cette exception
 * acceptable est qu'il n'y a rien à cloisonner dessus**. Le jour où une colonne
 * métier s'y ajoute — la fonction d'un salarié, son agence de rattachement, ses
 * préférences —, la donnée d'une société devient lisible depuis toutes les
 * autres, sans qu'aucune politique ne s'y oppose et sans que rien n'ait l'air
 * d'avoir changé. C'est une régression silencieuse : elle ne casse aucun test de
 * comportement, puisqu'il n'y a aucun comportement à casser.
 *
 * Tout cela vit dans `utilisateur_societe`, qui est cloisonnée. `utilisateur` ne
 * porte que ce qui sert à **trouver** et à **authentifier** un compte.
 *
 * **La liste ci-dessous est close.** Une colonne de plus est un arbitrage, pas
 * une décision de session — au même titre que les trois listes de I1.
 */
const COLONNES_AUTORISEES: readonly string[] = [
  // Trouver le compte.
  "id",
  "nom",
  "email",
  // L'authentifier.
  "email_verifie",
  "mfa_actif",
  "actif",
  // Trace technique de l'identité elle-même.
  "avatar_url",
  "derniere_connexion",
  "cree_le",
  "modifie_le",
];

/**
 * Relations autorisées. Une relation dit autant qu'une colonne : `agence Agence`
 * rattacherait l'identité à un établissement aussi sûrement qu'un `agence_id`.
 * Celles-ci pointent toutes vers les tables d'habilitation ou les tables
 * techniques d'authentification, jamais vers une table métier.
 */
const RELATIONS_AUTORISEES: readonly string[] = [
  "societes",
  "clients",
  "sessions",
  "comptes",
  "seconds_facteurs",
  "acces_journalise",
];

/**
 * Mots qui trahissent une donnée métier. Ils ne servent pas à décider — la liste
 * close ci-dessus s'en charge — mais à rendre l'échec parlant : « colonne
 * inconnue » n'apprend rien, « `agence_id` rattache une identité à un
 * établissement » dit quoi faire.
 */
const MOTS_METIER =
  /agence|societe|client|site|machine|intervention|contrat|fonction|metier|habilitation|preference|tarif|taux|forfait|matricule|salaire/i;

function motifMetier(colonne: string): string {
  const mot = MOTS_METIER.exec(colonne);
  return mot === null
    ? `« ${colonne} » ne figure pas dans la liste close de I1`
    : `« ${colonne} » porte « ${mot[0]} » : donnée métier, à ranger dans utilisateur_societe`;
}

describe("aucune donnée métier sur `utilisateur` (D39)", () => {
  it("le gardien sait extraire un modèle — éprouvé sur un schéma fabriqué", () => {
    // Sans cette vérification, une extraction fautive rendrait le gardien vert
    // sur n'importe quel schéma, y compris un schéma fautif.
    const fabrique = `
      model Autre {
        id String @id
      }

      /// Un commentaire de documentation, qui n'est pas un champ.
      model Utilisateur {
        id         String @id @db.Uuid
        // Un commentaire ordinaire non plus.
        email      String @unique
        agence_id  String @db.Uuid

        societes UtilisateurSociete[]

        @@unique([email, agence_id])
        @@map("utilisateur")
      }
    `;

    expect(champsDuModele(fabrique, "Utilisateur")).toEqual([
      "id",
      "email",
      "agence_id",
      "societes",
    ]);
    expect(champsDuModele(fabrique, "Autre")).toEqual(["id"]);
  });

  it("le gardien sait ÉCHOUER — éprouvé sur une colonne métier fabriquée", () => {
    const fabrique = `
      model Utilisateur {
        id        String @id @db.Uuid
        email     String @unique
        agence_id String @db.Uuid
      }
    `;

    const inattendues = champsDuModele(fabrique, "Utilisateur").filter(
      (champ) =>
        !COLONNES_AUTORISEES.includes(champ) &&
        !RELATIONS_AUTORISEES.includes(champ),
    );

    expect(inattendues).toEqual(["agence_id"]);
    expect(motifMetier("agence_id")).toContain("donnée métier");
    // Et une colonne inconnue sans mot métier reste refusée, avec l'autre motif.
    expect(motifMetier("couleur_favorite")).toContain("liste close");
  });

  it("le modèle réel ne porte que des colonnes d'identité et d'authentification", () => {
    const champs = champsDuModele(lireSchema(), "Utilisateur");

    const inattendues = champs
      .filter(
        (champ) =>
          !COLONNES_AUTORISEES.includes(champ) &&
          !RELATIONS_AUTORISEES.includes(champ),
      )
      .map(motifMetier);

    expect(
      inattendues,
      "`utilisateur` échappe au cloisonnement parce qu'il n'y a rien à " +
        "cloisonner dessus (I1, quatrième catégorie). Une donnée métier ici " +
        "devient lisible depuis toutes les sociétés à la fois.",
    ).toEqual([]);
  });

  it("porte bien quelque chose — le gardien ne s'exerce pas sur un modèle vide", () => {
    const champs = champsDuModele(lireSchema(), "Utilisateur");

    expect(champs).toContain("email");
    expect(champs).toContain("mfa_actif");
    // L'habilitation est ailleurs, et c'est le fond de la règle.
    expect(champs).toContain("societes");
  });

  it("et elle ne porte surtout pas de `societe_id`", () => {
    expect(champsDuModele(lireSchema(), "Utilisateur")).not.toContain(
      "societe_id",
    );
    // Alors que la table d'habilitation, elle, en porte un : c'est là que le
    // cloisonnement mord.
    expect(champsDuModele(lireSchema(), "UtilisateurSociete")).toContain(
      "societe_id",
    );
  });
});
