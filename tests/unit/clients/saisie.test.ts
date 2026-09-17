import { describe, expect, it } from "vitest";

import {
  LIMITE_RECHERCHE_MAXIMALE,
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaCreationClient,
  schemaModificationClient,
  schemaRechercheClient,
} from "@/lib/clients";

/**
 * Les règles de saisie d'une fiche client (ticket L1-01 ; RG-IMP-05 amendée par
 * D29 ; CLAUDE.md §2 — Zod sur toute entrée serveur, sans exception).
 *
 * Ces règles sont PURES : elles s'éprouvent sans base. Leur jumelle en base —
 * les contraintes `CHECK` et l'index unique — est éprouvée dans
 * `tests/isolation/client.test.ts`, avec ses épreuves par retrait. Les deux
 * sont nécessaires et ne se remplacent pas : Zod ne voit ni l'import Excel de
 * L1-08 ni une correction faite à la main, et la base ne rend pas de message
 * utilisable à l'écran.
 */

/** La saisie minimale d'une fiche : rien qu'un nom. */
const MINIMALE = { raison_sociale: "Atelier du Sud" };

describe("saisie d'une fiche client (L1-01)", () => {
  describe("raison sociale", () => {
    it("est obligatoire", () => {
      expect(schemaCreationClient.safeParse({}).success).toBe(false);
    });

    it("refuse une chaîne de blancs — c'est aussi la contrainte en base", () => {
      expect(
        schemaCreationClient.safeParse({ raison_sociale: "   " }).success,
      ).toBe(false);
    });

    it("est débarrassée de ses blancs de bord", () => {
      const analyse = schemaCreationClient.parse({
        raison_sociale: "  Atelier du Sud  ",
      });
      expect(analyse.raison_sociale).toBe("Atelier du Sud");
    });
  });

  describe("code externe (D29, RG-IMP-05)", () => {
    it("est FACULTATIF — son absence ne rejette plus la ligne", () => {
      const analyse = schemaCreationClient.parse(MINIMALE);
      expect(analyse.code_externe).toBeNull();
    });

    it("ramène la chaîne vide à `null`, jamais à une chaîne vide", () => {
      // La distinction compte : la chaîne vide se lirait « code renseigné » du
      // côté du rapprochement et « code absent » du côté humain, et RG-IMP-05
      // distingue précisément ces deux cas. En base, la contrainte
      // `client_code_externe_non_vide` referme le même chemin.
      for (const brut of ["", "   "]) {
        expect(
          schemaCreationClient.parse({ ...MINIMALE, code_externe: brut })
            .code_externe,
        ).toBeNull();
      }
    });

    it("conserve un code renseigné, débarrassé de ses blancs", () => {
      expect(
        schemaCreationClient.parse({ ...MINIMALE, code_externe: " C-42 " })
          .code_externe,
      ).toBe("C-42");
    });
  });

  describe("la société n'est JAMAIS une entrée", () => {
    it("refuse un `societe_id` transmis par l'appelant", () => {
      // Le schéma est `strict()` : une société fournie par l'appelant serait une
      // habilitation auto-déclarée. Elle vient du contexte de session, et de lui
      // seul — même raisonnement que `lib/auth/societe-active.ts` sur le rôle.
      const analyse = schemaCreationClient.safeParse({
        ...MINIMALE,
        societe_id: "aaaaaaaa-0000-7000-8000-000000000001",
      });
      expect(analyse.success).toBe(false);
    });

    it("refuse aussi un `id` imposé — il est attribué par le serveur (I10)", () => {
      expect(
        schemaCreationClient.safeParse({
          ...MINIMALE,
          id: "aaaaaaaa-0000-7000-8000-0000000000f1",
        }).success,
      ).toBe(false);
    });
  });

  describe("champs facultatifs", () => {
    it("rangent le vide en `null` plutôt qu'en chaîne vide", () => {
      const analyse = schemaCreationClient.parse({
        ...MINIMALE,
        ridet: "  ",
        categorie: "",
        conditions_reglement: "   ",
        commercial_referent: "",
      });
      expect(analyse.ridet).toBeNull();
      expect(analyse.categorie).toBeNull();
      expect(analyse.conditions_reglement).toBeNull();
      expect(analyse.commercial_referent).toBeNull();
    });

    it("n'imposent AUCUNE forme au RIDET ni à la catégorie", () => {
      // Aucun format n'est donné par le cahier des charges, et une énumération
      // de catégories fermerait une liste avant qu'on ait tranché à qui l'on
      // vend (CLAUDE.md §9, 20/08). Ce test dit que c'est une DÉCISION, pas un
      // trou : il échouerait si quelqu'un ajoutait un motif inventé.
      const analyse = schemaCreationClient.parse({
        ...MINIMALE,
        ridet: "1 234 567.001",
        categorie: "Une catégorie qui n'existe dans aucune énumération",
      });
      expect(analyse.ridet).toBe("1 234 567.001");
      expect(analyse.categorie).toBe(
        "Une catégorie qui n'existe dans aucune énumération",
      );
    });

    it("acceptent une adresse de facturation JSON de forme libre", () => {
      const analyse = schemaCreationClient.parse({
        ...MINIMALE,
        adresse_facturation: {
          boite_postale: "BP 1234",
          commune: "Nouméa",
          tribu: null,
        },
      });
      expect(analyse.adresse_facturation).toEqual({
        boite_postale: "BP 1234",
        commune: "Nouméa",
        tribu: null,
      });
    });
  });

  describe("modification", () => {
    it("accepte une modification partielle", () => {
      const analyse = schemaModificationClient.parse({ actif: false });
      expect(analyse).toEqual({ actif: false });
      // Rien d'autre n'est présent : `undefined` signifie « ne touche pas à
      // cette colonne », et le dépôt s'en sert pour ne pas effacer une adresse
      // à chaque modification qui ne la mentionne pas.
      expect(Object.keys(analyse)).toEqual(["actif"]);
    });

    it("refuse d'effacer le nom par une chaîne vide", () => {
      expect(
        schemaModificationClient.safeParse({ raison_sociale: "  " }).success,
      ).toBe(false);
    });

    it("laisse effacer une adresse en la posant explicitement à `null`", () => {
      const analyse = schemaModificationClient.parse({
        adresse_facturation: null,
      });
      expect(analyse.adresse_facturation).toBeNull();
      expect("adresse_facturation" in analyse).toBe(true);
    });
  });

  describe("recherche", () => {
    it("cherche tout, sans critère", () => {
      const analyse = schemaRechercheClient.parse({});
      expect(analyse.texte).toBeNull();
      expect(analyse.etat).toBe("tous");
      expect(analyse.limite).toBe(LIMITE_RECHERCHE_PAR_DEFAUT);
      expect(analyse.page).toBe(1);
    });

    it("REFUSE un état hors de la liste close — N-08", () => {
      // Trois états mesurés sur `clients()` de la maquette, ni plus ni moins :
      // un quatrième ne compilerait sur aucun `<select>` réel.
      expect(schemaRechercheClient.safeParse({ etat: "actifs" }).success).toBe(
        true,
      );
      expect(
        schemaRechercheClient.safeParse({ etat: "inactifs" }).success,
      ).toBe(true);
      expect(
        schemaRechercheClient.safeParse({ etat: "archives" }).success,
      ).toBe(false);
    });

    it("accepte une page au-delà de la première, et refuse une page absurde (AT-07)", () => {
      expect(schemaRechercheClient.parse({ page: 3 }).page).toBe(3);
      // Une page vient de l'URL — une chaîne — et se coerce en nombre.
      expect(schemaRechercheClient.parse({ page: "3" }).page).toBe(3);
      expect(schemaRechercheClient.safeParse({ page: 0 }).success).toBe(false);
      expect(schemaRechercheClient.safeParse({ page: -1 }).success).toBe(false);
    });

    it("ramène un texte vide à `null` — pas de filtre sur du vide", () => {
      expect(schemaRechercheClient.parse({ texte: "   " }).texte).toBeNull();
    });

    it("borne la taille du résultat", () => {
      expect(
        schemaRechercheClient.safeParse({
          limite: LIMITE_RECHERCHE_MAXIMALE + 1,
        }).success,
      ).toBe(false);
      expect(schemaRechercheClient.safeParse({ limite: 0 }).success).toBe(
        false,
      );
    });

    it("la borne par défaut tient sous la borne maximale", () => {
      // Témoin : deux constantes qui se croiseraient rendraient le défaut
      // lui-même refusé, et personne ne le verrait avant la première recherche.
      expect(LIMITE_RECHERCHE_PAR_DEFAUT).toBeLessThanOrEqual(
        LIMITE_RECHERCHE_MAXIMALE,
      );
      expect(
        schemaRechercheClient.safeParse({ limite: LIMITE_RECHERCHE_PAR_DEFAUT })
          .success,
      ).toBe(true);
    });
  });
});
