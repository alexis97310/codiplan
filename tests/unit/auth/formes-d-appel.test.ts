import { describe, expect, it } from "vitest";

import { CLES_DESIGNATION, designationsDe } from "@/lib/auth/lecture-identite";

/**
 * TOUTE CLÉ DE DÉSIGNATION SE LIT SOUS LES DEUX FORMES D'APPEL (ticket L1-02e).
 *
 * ## D'où vient ce gardien : une cause enfin isolée
 *
 * D59 déclarait la cause du `NULL` de `getSession` hors de portée — « l'isoler
 * demanderait de rejouer l'ancien code contre l'ancienne base, et ni l'un ni
 * l'autre n'existe plus ensemble ». Les deux existent : l'un dans l'historique,
 * l'autre en défaisant cinq `ALTER TABLE`. La passe a coûté vingt minutes et le
 * défaut a été **reproduit**, puis **fait disparaître par une seule ligne**.
 *
 * `getSession` émet deux opérations de client, et la seconde est
 * `Utilisateur.findFirst { where: { id: { equals: "…" } } }`. L'enveloppe de
 * L1-02c lisait la forme `{ equals }` **pour le courriel seul** ; l'identifiant
 * était lu nu (`typeof ou.id === "string"`). La désignation partait donc vide,
 * `utilisateur_lecture` refusait, et Better Auth concluait « pas de session ».
 *
 * **C'est pourquoi la connexion marchait quand la relecture ne marchait pas :
 * deux clés, une seule forme reconnue.** Même espèce que le `AND` du 08/09 — le
 * SQL rendu est identique, c'est la forme de l'APPEL que le code lit — mais un
 * cran plus fin : la faute n'était pas d'ignorer une forme, c'était de la
 * traiter pour une clé et pas pour l'autre.
 *
 * ## Ce que ce gardien fait, et pourquoi il est DÉRIVÉ
 *
 * Il éprouve **toutes** les clés de `CLES_DESIGNATION` sous les quatre formes
 * qu'un adaptateur émet réellement : valeur nue, `{ equals }`, et chacune des
 * deux sous un `AND`. La liste éprouvée est dérivée de la liste réelle plutôt
 * que recopiée : une clé ajoutée demain entre dans le gardien le jour où elle
 * entre dans le module, et non le jour où quelqu'un pense à l'y ajouter (§9,
 * 01/09 — une liste close recopiée devient fausse en silence).
 */

describe("toute clé de désignation se lit sous les deux formes d'appel", () => {
  const entrees = Object.entries(CLES_DESIGNATION);

  it("il y a bien des clés à éprouver — sinon le gardien serait vide", () => {
    expect(entrees.length).toBeGreaterThan(4);
    expect(
      entrees.flatMap(([, cles]) => cles.ou).length,
    ).toBeGreaterThanOrEqual(entrees.length);
  });

  for (const [modele, cles] of entrees) {
    for (const cle of cles.ou) {
      /**
       * Les quatre formes, et elles ont toutes été observées : `{ k: v }` sur
       * une lecture à une condition, `{ k: { equals: v } }` sur la relecture
       * d'identité de `getSession`, et les deux sous `{ AND: [ … ] }` dès que
       * l'adaptateur compose.
       */
      const formes: readonly [string, Record<string, unknown>][] = [
        ["valeur nue", { [cle.champ]: "valeur-designee" }],
        ["{ equals }", { [cle.champ]: { equals: "valeur-designee" } }],
        ["AND + valeur nue", { AND: [{ [cle.champ]: "valeur-designee" }] }],
        [
          "AND + { equals }",
          {
            AND: [{ autre: 1 }, { [cle.champ]: { equals: "valeur-designee" } }],
          },
        ],
      ];

      for (const [nom, ou] of formes) {
        it(`${modele}.${cle.champ} — ${nom}`, () => {
          const posees = designationsDe(modele, "findFirst", { where: ou });

          expect(
            posees.find((d) => d.variable === cle.variable)?.valeur,
            `la clé « ${cle.champ} » de ${modele} n'est pas reconnue sous la ` +
              `forme « ${nom} » : la désignation partirait vide, la politique ` +
              "refuserait, et l'appelant lirait un message juste sur une cause " +
              "fausse (§9, 08/09 et L1-02e).",
          ).toBe("valeur-designee");
        });
      }
    }
  }

  it("une requête qui ne désigne rien ne pose rien — le refus est le défaut", () => {
    expect(designationsDe("utilisateur", "findFirst", { where: {} })).toEqual(
      [],
    );
    expect(
      designationsDe("utilisateur", "findMany", { where: { actif: true } }),
    ).toEqual([]);
  });

  it("une clé trouvée sous un OR ne borne rien, et n'est pas lue", () => {
    // Seule la CONJONCTION borne : sous un `OR`, la requête pourrait rendre
    // autre chose que la ligne nommée.
    expect(
      designationsDe("utilisateur", "findFirst", {
        where: { OR: [{ email: "a@b.test" }, { actif: true }] },
      }),
    ).toEqual([]);
  });
});
