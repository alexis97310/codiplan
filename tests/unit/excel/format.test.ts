import { describe, expect, it } from "vitest";

import {
  ANOMALIES,
  analyserMarqueur,
  apparierColonnes,
  codeDuMarqueur,
  lireDate,
  lireNombre,
  type Cellule,
} from "@/lib/excel/format";
import { fr } from "@/lib/i18n/fr";

/**
 * LA GRAMMAIRE DES FICHIERS D'IMPORT (ticket L1-08, D31).
 *
 * Les six mécaniques de D31, éprouvées une à une — et, à chaque endroit où D31
 * est muet, le refus plutôt que l'invention, avec la question au registre.
 */

const texte = (valeur: string): Cellule => ({ texte: valeur });

describe("le marqueur de version — D31, cellule A1", () => {
  const attendu = { type: "clients", version: 2 };

  it("reconnaît le marqueur conforme", () => {
    expect(analyserMarqueur(texte("CODIPLAN-clients-v2"), attendu)).toEqual({
      etat: "conforme",
    });
    // Les espaces d'un copier-coller ne changent pas la nature du fichier.
    expect(analyserMarqueur(texte("  CODIPLAN-clients-v2 "), attendu)).toEqual({
      etat: "conforme",
    });
  });

  it("DISTINGUE les quatre refus — c'est le mot « reconnu » de D31", () => {
    // Quatre corrections différentes pour celui qui reçoit le refus : trouver
    // un autre fichier, retélécharger le modèle, changer de type d'import, ou
    // mettre l'application à jour. Un message unique le ferait chercher au
    // mauvais endroit.
    expect(analyserMarqueur(texte("Liste des clients"), attendu).etat).toBe(
      "absent",
    );
    expect(analyserMarqueur(undefined, attendu).etat).toBe("absent");
    expect(analyserMarqueur(texte("CODIPLAN-clients"), attendu)).toEqual({
      etat: "illisible",
      valeur: "CODIPLAN-clients",
    });
    expect(analyserMarqueur(texte("CODIPLAN-sites-v2"), attendu)).toEqual({
      etat: "autre_type",
      type: "sites",
    });
    expect(analyserMarqueur(texte("CODIPLAN-clients-v1"), attendu)).toEqual({
      etat: "version_anterieure",
      version: 1,
    });
  });

  it("REFUSE une version POSTÉRIEURE — le cas que D31 ne tranche pas", () => {
    // Un fichier qui se déclare en v3, lu par du code qui connaît la v2, ne peut
    // pas l'être sans supposer ce que la v3 a changé. Le refuser est la seule
    // lecture qui ne détruit rien. La question est au registre du 08/09/2026.
    expect(analyserMarqueur(texte("CODIPLAN-clients-v3"), attendu)).toEqual({
      etat: "version_posterieure",
      version: 3,
    });
  });

  it("chaque état non conforme porte un code, et le conforme n'en porte aucun", () => {
    expect(codeDuMarqueur({ etat: "conforme" })).toBeNull();
    expect(codeDuMarqueur({ etat: "absent" })).toBe("marqueur_absent");
    expect(codeDuMarqueur({ etat: "version_anterieure", version: 1 })).toBe(
      "marqueur_version_anterieure",
    );
  });
});

describe("les dates — JJ/MM/AAAA, et rien d'autre", () => {
  it("lit la forme textuelle que D31 arrête", () => {
    const lu = lireDate(texte("03/04/2026"));
    expect(lu.ok).toBe(true);
    expect(lu.ok && lu.valeur.toISOString()).toBe("2026-04-03T00:00:00.000Z");
  });

  it.each([
    "3/4/2026",
    "2026-04-03",
    "03-04-2026",
    "03/04/26",
    "03 avril 2026",
    "03/04/2026 08:00",
  ])("refuse « %s » — un seul format accepté", (valeur) => {
    const lu = lireDate(texte(valeur));
    expect(lu.ok).toBe(false);
    expect(!lu.ok && lu.anomalie.code).toBe("date_format");
  });

  it("refuse une date qui n'existe pas au calendrier", () => {
    // `Date.UTC` ne refuse rien : le 31/02 devient le 3 mars. La seule façon de
    // le voir est de relire ce qu'on vient d'écrire.
    const lu = lireDate(texte("31/02/2026"));
    expect(lu.ok).toBe(false);
    expect(!lu.ok && lu.anomalie.code).toBe("date_hors_plage");
    // TÉMOIN : le 29/02 d'une année réellement bissextile passe, sans quoi ce
    // refus ne prouverait que l'existence d'un refus.
    expect(lireDate(texte("29/02/2028")).ok).toBe(true);
  });

  it("lit un numéro de série EN UTC — jamais par un Date local", () => {
    // La forme la plus courante : une colonne mise au format « date » dans le
    // tableur ne porte pas de texte. Et la conversion ne passe pas par le fuseau
    // de la machine — la Nouvelle-Calédonie est à UTC+11, le serveur ne l'est
    // pas, et un import saisi le 1ᵉʳ du mois se rangerait au 31 du précédent.
    const lu = lireDate({ serie: 46115 });
    expect(lu.ok).toBe(true);
    expect(lu.ok && lu.valeur.toISOString()).toBe("2026-04-03T00:00:00.000Z");
  });

  it("refuse un série FRACTIONNAIRE — c'est une heure, pas une date", () => {
    const lu = lireDate({ serie: 46115.5 });
    expect(lu.ok).toBe(false);
    expect(!lu.ok && lu.anomalie.code).toBe("date_avec_heure");
  });

  it("refuse tout ce qui précède le 1ᵉʳ mars 1900 — le bogue bissextile fermé", () => {
    // Le tableur croit que 1900 était bissextile : le sérial 60 désigne un
    // 29 février 1900 qui n'a jamais existé, et tout ce qui précède est décalé
    // d'un jour. Refuser la plage entière ferme la classe du défaut plutôt que
    // de porter deux époques.
    expect(lireDate({ serie: 60 }).ok).toBe(false);
    expect(lireDate({ serie: 1 }).ok).toBe(false);
    // TÉMOIN : le premier jour sûr passe.
    const premier = lireDate({ serie: 61 });
    expect(premier.ok).toBe(true);
    expect(premier.ok && premier.valeur.toISOString()).toBe(
      "1900-03-01T00:00:00.000Z",
    );
  });

  it("une cellule vide est une cellule vide, pas une date fausse", () => {
    expect(lireDate(undefined).ok).toBe(false);
    const lu = lireDate(texte("   "));
    expect(!lu.ok && lu.anomalie.code).toBe("cellule_vide");
  });
});

describe("les nombres — virgule décimale, aucun séparateur de milliers", () => {
  it("NE REND JAMAIS un flottant : les chiffres et leur échelle", () => {
    // Conséquence directe de I3. Rendre `12345.67` obligerait le premier
    // appelant à remultiplier par cent — c'est-à-dire à faire l'arithmétique
    // flottante que I3 interdit, une ligne après nous.
    const lu = lireNombre(texte("1234,56"));
    expect(lu.ok).toBe(true);
    expect(lu.ok && lu.valeur).toEqual({
      chiffres: BigInt(123456),
      decimales: 2,
    });
  });

  it("lit un entier, et un négatif", () => {
    expect(lireNombre(texte("7000")).ok && lireNombre(texte("7000"))).toEqual({
      ok: true,
      valeur: { chiffres: BigInt(7000), decimales: 0 },
    });
    expect(lireNombre(texte("-12,5"))).toEqual({
      ok: true,
      valeur: { chiffres: -BigInt(125), decimales: 1 },
    });
  });

  it("DISTINGUE les trois confusions que D31 ferme", () => {
    // Le refus dit LAQUELLE : sans cela, « format invalide » laisse chercher.
    expect(
      lireNombre(texte("1 234,56")).ok === false &&
        lireNombre(texte("1 234,56")),
    ).toMatchObject({ anomalie: { code: "nombre_separateur_milliers" } });
    expect(lireNombre(texte("1234.56"))).toMatchObject({
      anomalie: { code: "nombre_point_decimal" },
    });
    expect(lireNombre(texte("douze"))).toMatchObject({
      anomalie: { code: "nombre_format" },
    });
  });

  it("l'espace insécable compte comme un séparateur de milliers", () => {
    // C'est celui que le tableur insère tout seul en France, et c'est donc le
    // cas RÉEL : ne reconnaître que l'espace ordinaire laisserait passer la
    // seule forme qu'un fichier français puisse porter (§9, 21/08).
    expect(lireNombre(texte("1 234,56"))).toMatchObject({
      anomalie: { code: "nombre_separateur_milliers" },
    });
    expect(lireNombre(texte("1 234,56"))).toMatchObject({
      anomalie: { code: "nombre_separateur_milliers" },
    });
  });

  it.each(["12,", ",5", "1,2,3", "12-3"])(
    "refuse la forme malformée « %s »",
    (valeur) => {
      expect(lireNombre(texte(valeur)).ok).toBe(false);
    },
  );

  it("une cellule NUMÉRIQUE est lue sans passer par un séparateur", () => {
    // Le tableur a déjà tranché la question que D31 pose au texte.
    expect(lireNombre({ nombre: 1234.56 })).toEqual({
      ok: true,
      valeur: { chiffres: BigInt(123456), decimales: 2 },
    });
    expect(lireNombre({ nombre: 7000 })).toEqual({
      ok: true,
      valeur: { chiffres: BigInt(7000), decimales: 0 },
    });
  });
});

describe("les colonnes — inconnues ignorées, obligatoires exigées", () => {
  const attendues = [
    { nom: "Raison sociale", obligatoire: true },
    { nom: "Code externe", obligatoire: false },
  ];

  it("D31 — une colonne inconnue AVERTIT, elle ne bloque jamais", () => {
    const lu = apparierColonnes(
      [texte("Raison sociale"), texte("Couleur préférée")],
      attendues,
    );
    expect(lu.inconnues).toEqual(["Couleur préférée"]);
    expect(lu.anomalies).toEqual([]);
    expect(lu.indices.get("Raison sociale")).toBe(0);
  });

  it("une colonne facultative absente n'est pas une anomalie", () => {
    const lu = apparierColonnes([texte("Raison sociale")], attendues);
    expect(lu.anomalies).toEqual([]);
    expect(lu.indices.has("Code externe")).toBe(false);
  });

  it("REFUSE un en-tête EN DOUBLE — le cas que D31 ne tranche pas", () => {
    // Lire la seconde colonne écraserait silencieusement la première, et rien
    // dans le rapport ne dirait laquelle a gagné.
    const lu = apparierColonnes(
      [texte("Raison sociale"), texte("Raison sociale")],
      attendues,
    );
    expect(lu.anomalies).toEqual([
      {
        code: "entete_en_double",
        colonne: "Raison sociale",
        valeur: "Raison sociale",
      },
    ]);
  });

  it("REFUSE une colonne OBLIGATOIRE absente, avant toute ligne", () => {
    // Ce n'est pas une ligne qui manque, c'est le fichier qui n'est pas celui
    // qu'on croit : le signaler ligne à ligne produirait trois cents rejets
    // identiques là où une phrase suffit.
    const lu = apparierColonnes([texte("Code externe")], attendues);
    expect(lu.anomalies).toEqual([
      { code: "colonne_obligatoire_absente", colonne: "Raison sociale" },
    ]);
  });

  it("l'appariement est EXACT — et la faute d'orthographe ressort DEUX fois", () => {
    // Ni casse ignorée, ni accents dépliés : une tolérance choisirait à la place
    // de celui qui a écrit le fichier. En l'état, la paire « obligatoire
    // absente » + « inconnue » se lit sans explication.
    const lu = apparierColonnes([texte("raison sociale")], attendues);
    expect(lu.inconnues).toEqual(["raison sociale"]);
    expect(lu.anomalies).toEqual([
      { code: "colonne_obligatoire_absente", colonne: "Raison sociale" },
    ]);
  });

  it("une colonne sans en-tête est ignorée sans bruit", () => {
    const lu = apparierColonnes(
      [texte("Raison sociale"), undefined, texte("  ")],
      attendues,
    );
    expect(lu.inconnues).toEqual([]);
    expect(lu.anomalies).toEqual([]);
  });
});

/**
 * LA RÉCIPROCITÉ ENTRE LES CODES ET LE DICTIONNAIRE.
 *
 * Le module ne rend que des codes ; le rapport de contrôle est lu par un humain
 * (I6, RG-IMP-01), donc chaque code doit avoir un libellé. Deux listes qui se
 * contrôlent l'une l'autre ne peuvent plus être fausses en silence : il faut
 * mentir des deux côtés (§9, 31/08). Le sens SILENCIEUX est le premier — un
 * code ajouté sans libellé n'afficherait rien du tout.
 */
describe("chaque code d'anomalie a son libellé, et réciproquement", () => {
  const cles = Object.keys(fr).filter((c) => c.startsWith("import.anomalie."));

  it("la population n'est pas vide — sans quoi ce gardien ne regarde rien", () => {
    expect(ANOMALIES.length).toBeGreaterThan(0);
    expect(cles.length).toBeGreaterThan(0);
  });

  it.each(ANOMALIES)("%s porte un libellé", (code) => {
    expect(
      cles,
      `le code « ${code} » n'a pas de libellé au dictionnaire : le rapport ` +
        "d'import n'afficherait rien du tout pour cette anomalie.",
    ).toContain(`import.anomalie.${code}`);
  });

  it("aucun libellé ne s'adosse à un code qui n'existe plus", () => {
    const orphelins = cles.filter(
      (cle) =>
        !(ANOMALIES as readonly string[]).includes(
          cle.slice("import.anomalie.".length),
        ),
    );
    expect(orphelins).toEqual([]);
  });
});
