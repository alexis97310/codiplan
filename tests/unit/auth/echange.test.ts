import { describe, expect, it } from "vitest";

import {
  dansUnEchangeAuth,
  designationsReportees,
  echangeOuvert,
  retenirDesignations,
} from "@/lib/auth/echange";
import { ecritUneLigneNommeeParSaCle } from "@/lib/auth/lecture-identite";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * L'ÉCHANGE D'AUTHENTIFICATION — ce que le report fait, et ce qu'il ne fait
 * JAMAIS (ticket D62).
 *
 * Trois propriétés, et la troisième est celle qui rend le mécanisme acceptable :
 *
 *   1. le report ne vaut que pour une ÉCRITURE qui nomme une ligne par sa clé
 *      primaire — l'`id` ouvre les écritures, jamais les lectures ;
 *   2. il ne traverse pas deux échanges, et cela se MESURE plutôt que se
 *      supposer : c'est toute la sûreté du mécanisme derrière un serveur qui
 *      sert plusieurs requêtes à la fois ;
 *   3. hors d'un échange il n'existe pas — donc un point d'entrée qui oublierait
 *      d'en ouvrir un **casse la fonctionnalité au lieu d'ouvrir une porte**.
 */
describe("le report ne vaut que pour une écriture nommant une ligne par sa clé", () => {
  const ecritures = ["update", "updateMany", "upsert", "delete", "deleteMany"];
  const lectures = [
    "findUnique",
    "findFirst",
    "findMany",
    "count",
    "aggregate",
  ];

  it.each(ecritures)("%s par `id` reçoit le report", (operation) => {
    expect(ecritUneLigneNommeeParSaCle(operation, { where: { id: "x" } })).toBe(
      true,
    );
  });

  it.each(lectures)("%s par `id` ne le reçoit PAS", (operation) => {
    expect(ecritUneLigneNommeeParSaCle(operation, { where: { id: "x" } })).toBe(
      false,
    );
  });

  it("les deux formes d'appel de Prisma sont reconnues, et le `AND` aussi", () => {
    expect(
      ecritUneLigneNommeeParSaCle("update", { where: { id: { equals: "x" } } }),
    ).toBe(true);
    expect(
      ecritUneLigneNommeeParSaCle("update", {
        where: { AND: [{ codes_secours: "c" }, { id: "x" }] },
      }),
    ).toBe(true);
  });

  it("une écriture qui ne nomme PAS de clé primaire ne reçoit rien", () => {
    expect(
      ecritUneLigneNommeeParSaCle("updateMany", {
        where: { utilisateur_id: "u" },
      }),
    ).toBe(false);
    expect(ecritUneLigneNommeeParSaCle("update", {})).toBe(false);
  });

  it("une clé trouvée sous un `OR` ne compte pas — elle ne bornerait rien", () => {
    expect(
      ecritUneLigneNommeeParSaCle("update", {
        where: { OR: [{ id: "x" }, { id: "y" }] },
      }),
    ).toBe(false);
  });
});

describe("le report ne franchit pas les frontières d'un échange", () => {
  it("hors d'un échange, il n'existe pas", () => {
    expect(echangeOuvert()).toBe(false);
    retenirDesignations([{ variable: "app.x", valeur: "v" }]);
    expect(designationsReportees()).toEqual([]);
  });

  it("dans un échange, il retient ce qui y a été désigné", async () => {
    await dansUnEchangeAuth(async () => {
      expect(echangeOuvert()).toBe(true);
      retenirDesignations([{ variable: "app.x", valeur: "v" }]);
      expect(designationsReportees()).toEqual([
        { variable: "app.x", valeur: "v" },
      ]);
    });
  });

  it("un échange n'hérite JAMAIS de ce qu'un autre a retenu", async () => {
    await dansUnEchangeAuth(async () => {
      retenirDesignations([{ variable: "app.x", valeur: "premier" }]);
    });
    await dansUnEchangeAuth(async () => {
      expect(
        designationsReportees(),
        "un échange a hérité de ce qu'un autre avait désigné : derrière un " +
          "serveur qui sert plusieurs requêtes à la fois, ce serait la " +
          "désignation d'un utilisateur posée pour un autre.",
      ).toEqual([]);
    });
  });

  it("DEUX ÉCHANGES CONCURRENTS ne se mélangent pas — mesuré, pas supposé", async () => {
    // Le cas qui compte réellement : deux requêtes entrelacées. Chacune cède la
    // main au milieu, exactement comme un aller-retour vers la base le ferait.
    const cede = () => new Promise((suite) => setTimeout(suite, 5));
    const un = dansUnEchangeAuth(async () => {
      retenirDesignations([{ variable: "app.u", valeur: "un" }]);
      await cede();
      return designationsReportees();
    });
    const deux = dansUnEchangeAuth(async () => {
      retenirDesignations([{ variable: "app.u", valeur: "deux" }]);
      await cede();
      return designationsReportees();
    });
    const [a, b] = await Promise.all([un, deux]);
    expect(a).toEqual([{ variable: "app.u", valeur: "un" }]);
    expect(b).toEqual([{ variable: "app.u", valeur: "deux" }]);
  });

  it("les échanges ne s'emboîtent pas : l'échange ouvert est réutilisé", async () => {
    // Une route qui appelle deux aides ne doit pas fabriquer deux échanges dont
    // le second perdrait ce que le premier savait.
    await dansUnEchangeAuth(async () => {
      retenirDesignations([{ variable: "app.x", valeur: "v" }]);
      await dansUnEchangeAuth(async () => {
        expect(designationsReportees()).toEqual([
          { variable: "app.x", valeur: "v" },
        ]);
      });
    });
  });
});

/**
 * TOUT POINT D'ENTRÉE D'AUTHENTIFICATION OUVRE UN ÉCHANGE.
 *
 * ## La population est DÉDUITE du dépôt, jamais listée
 *
 * C'est le renversement de D41 appliqué aux routes : une route
 * d'authentification écrite dans six mois entre d'elle-même dans la population,
 * et le gardien la réclame le jour où elle apparaît. Une liste à compléter est
 * une liste qu'on oublie.
 *
 * La marque est simple et vérifiable : le fichier est une route d'API
 * (`app/api/**\/route.ts`) et il atteint l'authentification — il importe
 * `@/lib/auth/` ou appelle `auth()`.
 *
 * ## Ce que ce gardien ne prétend pas
 *
 * Il ne peut pas vérifier que l'échange ENVELOPPE réellement tout le traitement
 * — un appel placé après un `return` lui échapperait. Ce qu'il attrape est le
 * cas réel : une route nouvelle qui ne connaît pas le mécanisme. Et l'oubli
 * échoue du bon côté : sans échange, l'écriture par `id` est refusée et la
 * fonctionnalité cesse de marcher.
 */
describe("tout point d'entrée d'authentification ouvre un échange", () => {
  const routes = fichiersSource(["app"])
    .filter((fichier) => /app\/api\/.*\/route\.ts$/.test(fichier.chemin))
    .map((fichier) => ({
      chemin: fichier.chemin,
      code: sansCommentaires(fichier.contenu),
    }))
    .filter(
      (fichier) =>
        fichier.code.includes("@/lib/auth/") || fichier.code.includes("auth()"),
    );

  it("la population n'est pas vide — sans quoi ce gardien ne regarderait rien", () => {
    expect(routes.length).toBeGreaterThanOrEqual(5);
  });

  it.each(routes.map((r) => r.chemin))("%s ouvre un échange", (chemin) => {
    const route = routes.find((r) => r.chemin === chemin)!;
    expect(
      route.code.includes("dansUnEchangeAuth"),
      `${chemin} atteint l'authentification sans ouvrir d'échange : les ` +
        "écritures que la bibliothèque désigne par leur `id` y seront refusées " +
        "en silence, et la fonctionnalité cessera de marcher sans que rien ne " +
        "le dise. Voir lib/auth/echange.ts.",
    ).toBe(true);
  });
});
