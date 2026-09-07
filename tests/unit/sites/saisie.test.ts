import { describe, expect, it } from "vitest";

import {
  LIMITE_RECHERCHE_MAXIMALE,
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaCreationSite,
  schemaModificationSite,
  schemaRechercheSite,
} from "@/lib/sites";

/**
 * Les règles de saisie d'un site (ticket L1-02 ; D23 ; RG-PLA-05 ; CLAUDE.md §2
 * — Zod sur toute entrée serveur, sans exception).
 *
 * Ces règles sont PURES : elles s'éprouvent sans base. Leur jumelle en base —
 * les contraintes `CHECK`, les deux clés étrangères et la politique « parc » —
 * est éprouvée dans `tests/isolation/site.test.ts`, avec ses épreuves par
 * retrait. Les deux sont nécessaires et ne se remplacent pas.
 */

const CLIENT = "0192f0a0-1000-7000-8000-000000000001";
const AGENCE = "0192f0a0-0000-7000-8000-0000000000a1";
const AGENCE_BIS = "0192f0a0-0000-7000-8000-0000000000a2";

/**
 * La saisie minimale d'un site : un client, une AGENCE DE RATTACHEMENT et un
 * nom. Le rattachement y est entré au ticket L1-02 avec D56 — il n'a pas de
 * valeur par défaut, la choisir reviendrait à décider d'où part le temps de
 * trajet.
 */
const MINIMALE = {
  client_id: CLIENT,
  agence_id: AGENCE,
  libelle: "Atelier principal",
};

describe("saisie d'un site (L1-02)", () => {
  describe("libellé et client", () => {
    it("exige les trois", () => {
      expect(schemaCreationSite.safeParse({}).success).toBe(false);
      expect(schemaCreationSite.safeParse({ client_id: CLIENT }).success).toBe(
        false,
      );
      expect(schemaCreationSite.safeParse({ libelle: "Atelier" }).success).toBe(
        false,
      );
      // Sans agence de rattachement (D56) : refusé. Un site dépend d'une
      // agence et d'une seule, et il n'existe aucune valeur par défaut qui ne
      // soit pas un mensonge.
      expect(
        schemaCreationSite.safeParse({
          client_id: CLIENT,
          libelle: "Atelier",
        }).success,
      ).toBe(false);
    });

    it("refuse un libellé vide ou fait de blancs", () => {
      for (const libelle of ["", "   ", "\t\n"]) {
        expect(
          schemaCreationSite.safeParse({ client_id: CLIENT, libelle }).success,
          libelle,
        ).toBe(false);
      }
    });

    it("refuse un client_id qui n'est pas un UUID", () => {
      expect(
        schemaCreationSite.safeParse({ ...MINIMALE, client_id: "A1" }).success,
      ).toBe(false);
    });
  });

  describe("société et identifiant ne sont jamais des entrées", () => {
    it("refuse une société transmise par l'appelant", () => {
      // Une société transmise serait une habilitation auto-déclarée : elle vient
      // du contexte de session, et de lui seul. Le schéma est `strict()` pour
      // que ce soit un REFUS et non un champ ignoré en silence.
      expect(
        schemaCreationSite.safeParse({
          ...MINIMALE,
          societe_id: "0192f0a0-0000-7000-8000-000000000002",
        }).success,
      ).toBe(false);
    });

    it("refuse un identifiant transmis par l'appelant", () => {
      expect(
        schemaCreationSite.safeParse({ ...MINIMALE, id: CLIENT }).success,
      ).toBe(false);
    });
  });

  describe("zone géographique (D23)", () => {
    it("accepte les six zones arrêtées, et elles seules", () => {
      for (const zone of [
        "grand_noumea",
        "sud",
        "cote_est",
        "cote_ouest",
        "nord",
        "iles",
      ]) {
        expect(
          schemaCreationSite.safeParse({ ...MINIMALE, zone_geo: zone }).success,
          zone,
        ).toBe(true);
      }
      expect(
        schemaCreationSite.safeParse({ ...MINIMALE, zone_geo: "koumac" })
          .success,
      ).toBe(false);
    });

    it("accepte l'ABSENCE de zone, et c'est un cas réel", () => {
      // Le site européen du jeu de démonstration la porte à `null` : aucune des
      // six zones ne décrit Lyon. Refuser l'absence obligerait à inventer une
      // zone, ce que D29 a déjà refusé pour le code externe.
      const rendu = schemaCreationSite.parse({ ...MINIMALE, zone_geo: null });
      expect(rendu.zone_geo).toBeNull();
    });
  });

  describe("coordonnées", () => {
    it("accepte Nouméa", () => {
      const rendu = schemaCreationSite.parse({
        ...MINIMALE,
        latitude: -22.2758,
        longitude: 166.4572,
      });
      expect(rendu.latitude).toBeCloseTo(-22.2758);
    });

    it("refuse l'inversion latitude/longitude", () => {
      // La faute de saisie la plus fréquente sur des coordonnées, et à Nouméa
      // elle est attrapée par la seule borne de la latitude.
      expect(
        schemaCreationSite.safeParse({
          ...MINIMALE,
          latitude: 166.4572,
          longitude: -22.2758,
        }).success,
      ).toBe(false);
    });
  });

  describe("horaires d'accès", () => {
    it("accepte une coupure de midi — deux plages le même jour", () => {
      const rendu = schemaCreationSite.parse({
        ...MINIMALE,
        horaires: [
          { jour_semaine: 1, debut_minutes: 420, fin_minutes: 690 },
          { jour_semaine: 1, debut_minutes: 780, fin_minutes: 960 },
        ],
      });
      expect(rendu.horaires).toHaveLength(2);
    });

    it("refuse une plage dont la fin précède le début", () => {
      // Elle ne décrit aucune ouverture, et l'accepter produirait un
      // avertissement de fermeture (I7) sur un site ouvert.
      expect(
        schemaCreationSite.safeParse({
          ...MINIMALE,
          horaires: [{ jour_semaine: 1, debut_minutes: 960, fin_minutes: 420 }],
        }).success,
      ).toBe(false);
    });

    it("refuse un jour hors de la semaine ISO", () => {
      for (const jour of [0, 8]) {
        expect(
          schemaCreationSite.safeParse({
            ...MINIMALE,
            horaires: [
              { jour_semaine: jour, debut_minutes: 420, fin_minutes: 690 },
            ],
          }).success,
          String(jour),
        ).toBe(false);
      }
    });

    it("distingue « aucune plage » de « on ne sait pas »", () => {
      // `null` = on ne sait pas, liste vide = aucune ouverture. Le premier ne
      // doit produire aucun avertissement (I7), le second en produit un — les
      // confondre rendrait l'avertissement faux dans un sens ou dans l'autre.
      expect(
        schemaCreationSite.parse({ ...MINIMALE, horaires: null }).horaires,
      ).toBeNull();
      expect(
        schemaCreationSite.parse({ ...MINIMALE, horaires: [] }).horaires,
      ).toEqual([]);
    });
  });

  describe("temps de trajet (D23, RG-PLA-05)", () => {
    it("accepte zéro — un site situé à l'agence même", () => {
      expect(
        schemaCreationSite.parse({ ...MINIMALE, temps_trajet_min: 0 })
          .temps_trajet_min,
      ).toBe(0);
    });

    it("refuse un temps négatif ou fractionnaire", () => {
      expect(
        schemaCreationSite.safeParse({ ...MINIMALE, temps_trajet_min: -1 })
          .success,
      ).toBe(false);
      expect(
        schemaCreationSite.safeParse({ ...MINIMALE, temps_trajet_min: 12.5 })
          .success,
      ).toBe(false);
    });

    it("accepte l'absence — c'est la branche où la zone sert de défaut", () => {
      expect(
        schemaCreationSite.parse({ ...MINIMALE }).temps_trajet_min,
      ).toBeNull();
    });
  });

  describe("le temps de trajet ne voyage jamais seul (D56)", () => {
    it("refuse de changer le rattachement sans revoir le temps de trajet", () => {
      // Le nombre décrirait un trajet depuis une agence dont le site ne dépend
      // plus. Le refus porte le CHAMP fautif, pour que l'écran sache quoi
      // signaler.
      const rendu = schemaModificationSite.safeParse({ agence_id: AGENCE_BIS });
      expect(rendu.success).toBe(false);
      if (!rendu.success) {
        expect(rendu.error.issues[0]?.path).toEqual(["temps_trajet_min"]);
      }
    });

    it("accepte le changement quand une nouvelle valeur est fournie", () => {
      expect(
        schemaModificationSite.safeParse({
          agence_id: AGENCE_BIS,
          temps_trajet_min: 90,
        }).success,
      ).toBe(true);
    });

    it("accepte le retour à l'estimation par zone — `null` est une décision", () => {
      // Le schéma n'exige pas qu'on MESURE : il exige qu'on DÉCIDE. `null`
      // signifie « je ne mesure pas, estime depuis la zone » (D23), et c'est
      // une réponse aussi valable qu'un nombre.
      expect(
        schemaModificationSite.safeParse({
          agence_id: AGENCE_BIS,
          temps_trajet_min: null,
        }).success,
      ).toBe(true);
    });

    it("laisse passer une modification qui ne touche PAS au rattachement", () => {
      // Le contrôle ne gêne que là où il a une raison de gêner — sans quoi il
      // serait une friction, pas une garantie.
      expect(
        schemaModificationSite.safeParse({ commune: "Bourail" }).success,
      ).toBe(true);
      expect(
        schemaModificationSite.safeParse({ temps_trajet_min: 30 }).success,
      ).toBe(true);
    });
  });

  describe("modification", () => {
    it("accepte une modification partielle SANS effacer le reste", () => {
      // Le défaut trouvé par un test à L1-01 : un `.default(null)` posé côté
      // modification effaçait tous les champs non mentionnés. Les défauts ne
      // vivent que dans le schéma de création.
      const rendu = schemaModificationSite.parse({ commune: "Bourail" });
      expect(rendu.commune).toBe("Bourail");
      expect(rendu.libelle).toBeUndefined();
      expect(rendu.zone_geo).toBeUndefined();
      expect(rendu.horaires).toBeUndefined();
      expect(rendu.temps_trajet_min).toBeUndefined();
    });

    it("distingue « ne touche pas » de « efface »", () => {
      expect(schemaModificationSite.parse({}).commune).toBeUndefined();
      expect(
        schemaModificationSite.parse({ commune: null }).commune,
      ).toBeNull();
    });

    it("refuse de déplacer un site d'un client à un autre", () => {
      // Déplacer un site emporterait silencieusement ses machines (L2-01), son
      // historique et le périmètre des comptes portail qui le nomment. Ce n'est
      // pas une modification de fiche, c'est une reprise de données.
      expect(
        schemaModificationSite.safeParse({ client_id: CLIENT }).success,
      ).toBe(false);
    });

    it("refuse un libellé vidé par une modification", () => {
      expect(schemaModificationSite.safeParse({ libelle: "   " }).success).toBe(
        false,
      );
    });
  });

  describe("recherche", () => {
    it("LE CRITÈRE DES HORAIRES : le jour où on les INTERROGE, le JSON n'est plus le bon choix", () => {
      // **Une borne qui porte sa condition, et non une date.** Les horaires
      // sont portés par `site` en JSON, et c'est le bon choix tant qu'on ne
      // fait que les LIRE avec le site : ils héritent alors de la politique
      // « parc » de leur parent, et le périmètre les protège sans qu'aucune
      // forme de politique nouvelle soit nécessaire.
      //
      // Le jour où il faut CHERCHER ou FILTRER des sites d'après leurs
      // horaires — « quels sites sont ouverts le samedi matin ? » —, le JSON
      // cesse d'être le bon choix : l'interrogation devient tortueuse,
      // l'indexation aussi, et la table fille devient justifiée. Elle
      // déclenchera alors le critère de la forme « filiation »
      // (`tests/unit/db/tables-filles.test.ts`).
      //
      // Ce scénario est ce déclencheur : il rougit à l'instant où un critère
      // de recherche portant sur les horaires est ajouté, et renvoie ici.
      const criteres = Object.keys(schemaRechercheSite.shape);

      // TÉMOIN : le contrôle lit bien les critères réels. Sans lui, un
      // `shape` devenu vide rendrait le scénario vert pour toujours.
      expect(criteres).toContain("zone_geo");
      expect(criteres.length).toBeGreaterThan(3);

      expect(
        criteres.filter((cle) => /horaire|ouvert|ferme/i.test(cle)),
        "un critère de recherche porte désormais sur les horaires. Ils sont " +
          "stockés en JSON sur `site`, ce qui est le bon choix tant qu'on ne " +
          "fait que les lire avec leur site — pas pour les interroger. C'est " +
          "le critère enregistré au ticket L1-02 : les sortir dans une table " +
          "fille, qui déclenchera alors la forme « filiation » " +
          "(« filiation »). Voir docs/decisions/" +
          "2026-09-06-site-et-la-cle-du-compte-portail.md.",
      ).toEqual([]);
    });

    it("borne le nombre de résultats plutôt que de le laisser au défaut de personne", () => {
      expect(schemaRechercheSite.parse({}).limite).toBe(
        LIMITE_RECHERCHE_PAR_DEFAUT,
      );
      expect(
        schemaRechercheSite.safeParse({ limite: LIMITE_RECHERCHE_MAXIMALE + 1 })
          .success,
      ).toBe(false);
    });

    it("ramène un texte vide à l'absence de filtre", () => {
      expect(schemaRechercheSite.parse({ texte: "   " }).texte).toBeNull();
    });

    it("filtre par client et par zone, ou par aucun des deux", () => {
      expect(schemaRechercheSite.parse({}).client_id).toBeNull();
      expect(schemaRechercheSite.parse({ client_id: CLIENT }).client_id).toBe(
        CLIENT,
      );
      expect(
        schemaRechercheSite.safeParse({ zone_geo: "koumac" }).success,
      ).toBe(false);
    });
  });
});
