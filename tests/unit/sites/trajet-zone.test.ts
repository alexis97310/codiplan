import { describe, expect, it } from "vitest";

import {
  catalogueAffichable,
  DEFAUTS_TRAJET_ZONE,
  resoudreTempsTrajet,
  schemaRetraitTrajetZone,
  schemaTrajetZone,
  TRAJET_MINUTES_MAXIMUM,
  zoneAdmetUneEstimation,
  type CatalogueTrajets,
} from "@/lib/sites/trajet-zone";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";

/**
 * LE TEMPS DE TRAJET PAR ZONE — la règle de D107 (R3-03).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurerait
 *
 * **LES SIX VALEURS DE D107, UNE PAR UNE.** Elles n'étaient écrites nulle part
 * avant l'arbitrage — *un délai non spécifié ne s'invente pas* (§8) —, et une
 * valeur qu'on ne vérifie pas est une valeur qu'un « nettoyage » modifiera un
 * jour sans que rien ne rougisse.
 *
 * **LA CASCADE, ET SON ORIGINE.** Trois étages : site, société, défaut. Chaque
 * étage est éprouvé **et** l'origine rendue est vérifiée : *un nombre dont la
 * signification dépend d'autre chose ne voyage jamais seul* (D56).
 *
 * **LES ÎLES, DANS LES DEUX SENS.** Le refus d'écriture ET le `null` de
 * résolution viennent de la MÊME source, `DEFAUTS_TRAJET_ZONE` — et le second
 * est éprouvé sur une base qui porterait quand même une ligne, parce qu'*une
 * garantie qui ne vit que dans la validation d'entrée n'en est pas une*.
 *
 * **ET UN CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON** (§9, 11/09). À côté
 * de chaque refus, son voisin qui passe : `sud` accepte 90 là où `iles` refuse,
 * 1440 passe là où 1441 tombe. *Une mise en échec n'éprouve que la direction qui
 * rougit ; la direction permissive ne produit aucun signal.*
 */

const VIDE: CatalogueTrajets = new Map();

describe("les valeurs de référence de D107", () => {
  it("porte les cinq durées arrêtées, et AUCUNE pour les îles", () => {
    // Écrites une par une : un `Object.entries` comparé à lui-même ne mesure
    // rien, et c'est ce qu'on veut attraper — la valeur, pas la forme.
    expect(DEFAUTS_TRAJET_ZONE.grand_noumea).toEqual({
      nature: "minutes",
      minutes: 30,
    });
    expect(DEFAUTS_TRAJET_ZONE.sud).toEqual({ nature: "minutes", minutes: 90 });
    expect(DEFAUTS_TRAJET_ZONE.cote_ouest).toEqual({
      nature: "minutes",
      minutes: 150,
    });
    expect(DEFAUTS_TRAJET_ZONE.cote_est).toEqual({
      nature: "minutes",
      minutes: 240,
    });
    expect(DEFAUTS_TRAJET_ZONE.nord).toEqual({
      nature: "minutes",
      minutes: 240,
    });
    expect(DEFAUTS_TRAJET_ZONE.iles.nature).toBe("sans_estimation");
  });

  it("couvre les SIX zones de D23 — ni plus, ni moins", () => {
    // TÉMOIN : la population vient de l'énumération, pas de l'objet. Une
    // septième zone ajoutée par arbitrage ferait rougir ici ET refuserait de
    // compiler, ce qui est le but — *une énumération élargie réclame une
    // décision, jamais un défaut silencieux.*
    expect(Object.keys(DEFAUTS_TRAJET_ZONE).sort()).toEqual(
      [...ZONES_GEOGRAPHIQUES].sort(),
    );
    expect(ZONES_GEOGRAPHIQUES.length).toBe(6);
  });

  it("« admet une estimation » se lit dans les défauts et nulle part ailleurs", () => {
    // Une seconde liste « les zones sans estimation » aurait divergé en
    // silence (§9, 01/09). Le critère est donc dérivé, et on le mesure.
    for (const zone of ZONES_GEOGRAPHIQUES) {
      expect(zoneAdmetUneEstimation(zone)).toBe(
        DEFAUTS_TRAJET_ZONE[zone].nature === "minutes",
      );
    }
    expect(zoneAdmetUneEstimation("sud")).toBe(true);
    expect(zoneAdmetUneEstimation("iles")).toBe(false);
  });
});

describe("la cascade rend son ORIGINE avec sa valeur", () => {
  it("la valeur du site fait foi, même contre un réglage de société", () => {
    const catalogue: CatalogueTrajets = new Map([["sud", 120]]);
    expect(
      resoudreTempsTrajet({ temps_trajet_min: 75, zone_geo: "sud" }, catalogue),
    ).toEqual({ minutes: 75, origine: "site" });
  });

  it("le réglage de la société l'emporte sur le défaut", () => {
    const catalogue: CatalogueTrajets = new Map([["sud", 120]]);
    expect(
      resoudreTempsTrajet(
        { temps_trajet_min: null, zone_geo: "sud" },
        catalogue,
      ),
    ).toEqual({ minutes: 120, origine: "societe" });

    // Le voisin qui doit rester vert POUR SA PROPRE RAISON : sans réglage, le
    // défaut de D107 — 90 et non 120. Sans cette paire, une résolution qui
    // rendrait toujours le catalogue passerait le scénario précédent.
    expect(
      resoudreTempsTrajet({ temps_trajet_min: null, zone_geo: "sud" }, VIDE),
    ).toEqual({ minutes: 90, origine: "defaut" });
  });

  it("sans zone, c'est « sans_zone » et jamais un nombre", () => {
    expect(
      resoudreTempsTrajet({ temps_trajet_min: null, zone_geo: null }, VIDE),
    ).toEqual({ minutes: null, motif: "sans_zone" });
  });

  it("une zone INCONNUE du dépôt ne devient jamais un défaut", () => {
    // La base accepte du texte libre (voir la migration) : une ligne écrite à
    // la main pour `koumac` est INERTE, elle n'est pas un défaut silencieux.
    const catalogue: CatalogueTrajets = new Map([["koumac", 300]]);
    expect(
      resoudreTempsTrajet(
        { temps_trajet_min: null, zone_geo: "koumac" },
        catalogue,
      ),
    ).toEqual({ minutes: null, motif: "sans_zone" });
  });
});

describe("les îles — les deux sens du même critère", () => {
  it("la résolution rend « sans_estimation », ET MÊME si une ligne existe", () => {
    expect(
      resoudreTempsTrajet({ temps_trajet_min: null, zone_geo: "iles" }, VIDE),
    ).toEqual({ minutes: null, motif: "sans_estimation" });

    // LE CŒUR : une ligne posée à la main dans une console ne rouvre rien.
    // *Une garantie qui ne vit que dans la validation d'entrée n'en est pas
    // une* — le refus de saisie n'est pas la seule chose qui la tient.
    const forcee: CatalogueTrajets = new Map([["iles", 240]]);
    expect(
      resoudreTempsTrajet({ temps_trajet_min: null, zone_geo: "iles" }, forcee),
    ).toEqual({ minutes: null, motif: "sans_estimation" });
  });

  it("mais une valeur MESURÉE sur le site l'emporte — l'ordre n'est pas interchangeable", () => {
    // D107 dit « à saisir par intervention » : un site des Îles dont le trajet
    // a été chronométré rend ce chronomètre. Inverser les deux premiers tests
    // de la cascade masquerait une mesure réelle derrière un refus de zone.
    expect(
      resoudreTempsTrajet({ temps_trajet_min: 330, zone_geo: "iles" }, VIDE),
    ).toEqual({ minutes: 330, origine: "site" });
  });

  it("le schéma de saisie refuse la zone des îles, et accepte sa voisine", () => {
    expect(
      schemaTrajetZone.safeParse({ zone: "iles", minutes: 240 }).success,
    ).toBe(false);
    // Vert POUR SA PROPRE RAISON : la même écriture sur `sud` passe. Sans
    // elle, un schéma qui refuserait TOUT passerait le refus ci-dessus.
    expect(
      schemaTrajetZone.safeParse({ zone: "sud", minutes: 240 }).success,
    ).toBe(true);
  });

  it("le RETRAIT, lui, accepte les îles — effacer n'est pas régler", () => {
    // Nettoyer une ligne qu'une main aurait écrite doit rester possible ; la
    // refuser enfermerait l'état fautif (§9, 08/09 — un cliquet qui condamne
    // l'issue de secours).
    expect(schemaRetraitTrajetZone.safeParse({ zone: "iles" }).success).toBe(
      true,
    );
    expect(schemaRetraitTrajetZone.safeParse({ zone: "koumac" }).success).toBe(
      false,
    );
  });
});

describe("les bornes de la saisie", () => {
  it("zéro est refusé — il se lirait « l'établissement est sur place »", () => {
    expect(
      schemaTrajetZone.safeParse({ zone: "sud", minutes: 0 }).success,
    ).toBe(false);
    expect(
      schemaTrajetZone.safeParse({ zone: "sud", minutes: -30 }).success,
    ).toBe(false);
    // Vert pour sa propre raison : une minute passe. La borne est « > 0 », pas
    // « > 60 » — rien n'autorise à inventer un plancher de métier.
    expect(
      schemaTrajetZone.safeParse({ zone: "sud", minutes: 1 }).success,
    ).toBe(true);
  });

  it("le plafond est une JOURNÉE, et la paire se lit d'un coup d'œil", () => {
    expect(TRAJET_MINUTES_MAXIMUM).toBe(1440);
    expect(
      schemaTrajetZone.safeParse({
        zone: "sud",
        minutes: TRAJET_MINUTES_MAXIMUM,
      }).success,
    ).toBe(true);
    expect(
      schemaTrajetZone.safeParse({
        zone: "sud",
        minutes: TRAJET_MINUTES_MAXIMUM + 1,
      }).success,
    ).toBe(false);
  });

  it("une durée non entière est refusée — les minutes ne se coupent pas", () => {
    expect(
      schemaTrajetZone.safeParse({ zone: "sud", minutes: 90.5 }).success,
    ).toBe(false);
  });
});

describe("l'écran voit TOUJOURS les six zones", () => {
  it("y compris celles que personne n'a réglées", () => {
    // *Un écran qui n'afficherait que les zones réglées cacherait exactement ce
    // qu'on vient y chercher.*
    const lignes = catalogueAffichable(new Map([["nord", 200]]));
    expect(lignes.map((l) => l.zone)).toEqual([...ZONES_GEOGRAPHIQUES]);

    const nord = lignes.find((l) => l.zone === "nord");
    expect(nord?.reglee).toBe(200);
    expect(nord?.applique).toEqual({ minutes: 200, origine: "societe" });

    const sud = lignes.find((l) => l.zone === "sud");
    expect(sud?.reglee).toBeNull();
    expect(sud?.applique).toEqual({ minutes: 90, origine: "defaut" });

    const iles = lignes.find((l) => l.zone === "iles");
    expect(iles?.applique).toEqual({ minutes: null, motif: "sans_estimation" });
  });

  it("et l'ordre est celui de D23, jamais l'alphabet", () => {
    // `cote_est` précède `cote_ouest` dans l'arbitrage ; l'alphabet les met
    // dans le même ordre, mais `grand_noumea` passerait après `cote_*`.
    expect(catalogueAffichable(VIDE)[0]?.zone).toBe("grand_noumea");
  });
});
