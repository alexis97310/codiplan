import { afterAll, describe, expect, it } from "vitest";

import { fermerClients, observerSousProprietaire } from "./setup/db";
import {
  PORTAIL_A_CLIENT,
  PORTAIL_B_CLIENT,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * UN NOM DE FIXTURE AFFIRME UNE PROPRIÉTÉ — QU'EST-CE QUI LA CONFRONTE ?
 *
 * ## Ce qui a fait écrire ce fichier
 *
 * `UTILISATEUR_PORTAIL_A` désignait le compte **interne** : « Interne A »,
 * `interne-a@iso.test`, rôle `adv` dans `utilisateur_societe`, et **zéro** ligne
 * dans `utilisateur_client`. Le compte portail, lui, s'appelait
 * `PORTAIL_A_CLIENT`. *Le nom disait l'inverse de ce que la constante tenait.*
 *
 * Ce qu'il a coûté : `categorie-authentification.test.ts` armait un contexte de
 * rôle `client` **sur le compte interne** — un contexte qui ne peut pas exister
 * en production. Le scénario était vert, et il mesurait un cas fictif. Personne
 * ne l'a vu ; c'est la validation de D70 qui l'a refusé, un ticket plus tard.
 *
 * ## Ce que ce fichier ferme, et c'est une ESPÈCE
 *
 * Un nom de fixture est une **déclaration** — « ceci est un compte portail » —
 * et le harnais est le seul endroit du dépôt où une déclaration n'a en face
 * d'elle aucune donnée. Les listes closes sont confrontées au schéma, les
 * politiques à `pg_policies`, le périmètre d'audit aux migrations. Les fixtures,
 * elles, n'étaient confrontées à rien.
 *
 * *C'est la famille du 09/09 — « deux contrats sous un même nom » — prise par le
 * bout du HARNAIS : ici il n'y a qu'un contrat, et le nom dit son contraire.*
 *
 * ## Pourquoi la lecture est faite sous le PROPRIÉTAIRE
 *
 * Elle observe des lignes qu'aucun contexte applicatif ne peut voir ensemble :
 * l'habilitation d'un compte de la société A et celle d'un compte de la société
 * B. Ce n'est pas une assertion de cloisonnement — c'en serait une fausse —,
 * c'est une observation de la POPULATION du harnais.
 */
describe("les fixtures tiennent ce que leur nom déclare", () => {
  afterAll(fermerClients);

  const proprietaire = () =>
    observerSousProprietaire(
      "observe la population du harnais elle-même — les rattachements de " +
        "comptes de DEUX sociétés à la fois, qu'aucun contexte applicatif ne " +
        "peut ni ne doit voir ensemble.",
    );

  const COMPTES = [
    { nom: "UTILISATEUR_INTERNE_A", id: UTILISATEUR_INTERNE_A, portail: false },
    { nom: "UTILISATEUR_INTERNE_B", id: UTILISATEUR_INTERNE_B, portail: false },
    { nom: "PORTAIL_A_CLIENT", id: PORTAIL_A_CLIENT, portail: true },
    { nom: "PORTAIL_B_CLIENT", id: PORTAIL_B_CLIENT, portail: true },
  ] as const;

  it("un compte PORTAIL a une habilitation de portail, un INTERNE n'en a aucune", async () => {
    const lignes = await proprietaire().$queryRawUnsafe<
      Array<{ id: string; portail: bigint; interne: bigint }>
    >(
      `SELECT "u"."id",
              (SELECT count(*) FROM "utilisateur_client" "uc"
                WHERE "uc"."utilisateur_id" = "u"."id") AS portail,
              (SELECT count(*) FROM "utilisateur_societe" "us"
                WHERE "us"."utilisateur_id" = "u"."id") AS interne
         FROM "utilisateur" "u"
        WHERE "u"."id" = ANY($1::uuid[])`,
      COMPTES.map((compte) => compte.id),
    );

    // TÉMOIN DE NON-VACUITÉ : les quatre comptes existent réellement. Une
    // population vide rendrait toutes les assertions ci-dessous triviales, et
    // un `WHERE … = ANY(…)` qui ne trouve rien ressemble trait pour trait à un
    // sans-faute (§9, 30/08).
    expect(lignes).toHaveLength(COMPTES.length);

    for (const compte of COMPTES) {
      const ligne = lignes.find((candidate) => candidate.id === compte.id);
      const habilitationsPortail = Number(ligne?.portail ?? -1);
      const habilitationsInternes = Number(ligne?.interne ?? -1);

      if (compte.portail) {
        expect(
          habilitationsPortail,
          `${compte.nom} se dit compte portail : il doit porter au moins une ` +
            "ligne dans `utilisateur_client`.",
        ).toBeGreaterThan(0);
        // D10 : un compte portail n'a JAMAIS de ligne dans
        // `utilisateur_societe` — c'est ce qui l'empêche d'obtenir une société
        // active par la bascule, et c'est la moitié de sa définition.
        expect(
          habilitationsInternes,
          `${compte.nom} se dit compte portail : il ne doit porter AUCUNE ` +
            "ligne dans `utilisateur_societe` (D10).",
        ).toBe(0);
      } else {
        expect(
          habilitationsPortail,
          `${compte.nom} se dit compte interne : il ne doit porter aucune ` +
            "habilitation de portail.",
        ).toBe(0);
        expect(
          habilitationsInternes,
          `${compte.nom} se dit compte interne : il doit porter une ` +
            "habilitation de société.",
        ).toBeGreaterThan(0);
      }
    }
  });

  it("et les deux ensembles sont DISJOINTS — le témoin qui rend l'assertion utile", async () => {
    // Sans lui, une fixture qui porterait les DEUX rattachements satisferait la
    // moitié « au moins une » de chaque branche. C'est le piège de la
    // population (§9, 31/08) : l'objet fautif doit rester dedans.
    const lignes = await proprietaire().$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "u"."id" FROM "utilisateur" "u"
        WHERE EXISTS (SELECT 1 FROM "utilisateur_client" "uc"
                       WHERE "uc"."utilisateur_id" = "u"."id")
          AND EXISTS (SELECT 1 FROM "utilisateur_societe" "us"
                       WHERE "us"."utilisateur_id" = "u"."id")`,
    );
    expect(
      lignes.map((ligne) => ligne.id),
      "aucun compte du harnais ne doit être à la fois portail et interne : " +
        "un tel compte satisferait les deux branches du scénario précédent.",
    ).toEqual([]);
  });
});
