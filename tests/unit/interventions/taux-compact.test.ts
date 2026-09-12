import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  tauxCompact,
  type OccupationTechnicien,
} from "@/lib/interventions/statistiques";

/**
 * D111 — LE TAUX SEUL, ET LA CONDITION QUI LE REND LISIBLE.
 *
 * ## CE QUE D111 DIT, ET CE QU'IL SUPPOSE
 *
 * *« Sous le nom du technicien : le pourcentage, sans le nom de l'agence. »* La
 * raison **est** la condition de validité : *un technicien n'a aujourd'hui
 * qu'UNE agence de rattachement, il n'a donc jamais deux taux, et le chiffre ne
 * peut pas être lu de travers.*
 *
 * ## LA CONDITION A CHANGÉ DE SUJET LE 12/09/2026 (Q6, issue 2)
 *
 * ~~*« Le jour où une personne travaillera pour deux agences… Ce jour-là se
 * reconnaît à une seule chose — une ligne de technicien rattachée à deux
 * agences. »*~~ **Cette condition visait `technicien.agence_id`, et ce n'est
 * PAS ce dont dépend le taux.** Alexis l'a réécrite : elle porte désormais sur
 * **LA MAILLE DU TAUX — `(technicien, agence de l'INTERVENTION)`**.
 *
 * *Sa raison vaut au-delà de ce cas : une décision dont la condition porte sur
 * la mauvaise chose sera crue par le prochain lecteur.* Le produit n'a pas
 * bougé ; c'est la décision qu'on a rendue vraie.
 *
 * ## CE GARDIEN TIENT DONC LA MAILLE, ET LE FAIT QUE L'ÉCRAN LA MESURE
 *
 * *Une condition de réouverture écrite en prose est une intention* (§9, 31/08) :
 * elle ne rougit pas le jour où elle est remplie. Et celle-ci ne peut pas se
 * lire dans le schéma — **deux lignes de charge est un fait des DONNÉES**, que
 * `verify` n'observe pas. Ce qui se garde statiquement est donc ce qui rend la
 * décision vraie quel que soit le jour : **que la maille porte bien l'agence,
 * et que l'écran DÉCIDE sur le nombre de lignes plutôt que sur la forme d'une
 * colonne.** *Une « simplification » qui déduirait « une seule ligne » de
 * `technicien.agence_id` ferait mentir l'écran le premier jour d'un renfort —
 * et c'est elle que ce fichier arrête.*
 *
 * ## ET IL NOMME UNE CONTRADICTION MESURÉE, plutôt que de la taire
 *
 * D112, rendu le même soir, autorise expressément la pose d'un technicien sur
 * l'intervention d'une AUTRE agence. Or la maille de l'occupation n'est pas
 * `technicien.agence_id` : `occupationsDuPlanning` rend une ligne par
 * **(technicien, agence de l'INTERVENTION)**. *Les deux décisions se
 * contredisent le premier jour d'un renfort* — et une contradiction entre deux
 * sources de rang 1 est un défaut à signaler, jamais une préséance à appliquer
 * (§1 du CLAUDE.md).
 *
 * L'écran ne suppose donc plus la condition : **il la mesure**. Une seule ligne,
 * le taux seul ; plusieurs, chacune nomme son agence — *ce que D111 prescrit
 * lui-même pour ce jour-là.*
 */

const SCHEMA = readFileSync(
  join(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);
const ECRAN = join(process.cwd(), "app/(back-office)/planning/page.tsx");
const OCCUPATION = readFileSync(
  join(process.cwd(), "lib/interventions/occupation.ts"),
  "utf8",
);

/**
 * Une occupation réduite à ce que le taux regarde.
 *
 * Le TYPE est écrit — `OccupationTechnicien` — et non déduit : *un objet
 * littéral qui satisfait la fonction aujourd'hui cesse de la satisfaire au
 * premier champ ajouté, et le scénario l'apprendrait à la compilation plutôt
 * qu'à l'exécution.* Mesuré en écrivant ce fichier : `trajet` porte trois
 * champs, `vitest` ne typait rien, et c'est `tsc` qui l'a dit.
 */
function occupation(
  minutesEngagees: number,
  minutesOuvrables: number,
): OccupationTechnicien {
  return {
    technicienId: "t",
    interventions: 1,
    minutesEngagees,
    minutesOuvrables,
    sansDuree: 0,
    trajet: { minutes: 0, journees: 0, journeesSansTrajet: 0 },
    segments: [],
  };
}

describe("LA MAILLE DU TAUX porte l'agence — la condition réécrite de D111", () => {
  it("`LigneOccupation` porte un `agenceId` : une personne peut porter deux lignes", () => {
    // ~~L'ancienne condition lisait ici `technicien.agence_id String @db.Uuid`
    // et l'absence d'une table `technicien_agence`.~~ Elle est RETIRÉE plutôt
    // que conservée « au sens large » : *garder une approximation à côté de sa
    // mesure n'ajoute pas de sécurité, elle en retire* (§9, 01/09), et elle
    // aurait continué d'affirmer « ce jour n'est pas arrivé » alors que D112
    // autorise le renfort sans qu'aucune table ne bouge.
    const type = /export type LigneOccupation = \{[\s\S]*?\n\};/.exec(
      OCCUPATION,
    )?.[0];
    // TÉMOIN : le type a bien été trouvé. Un motif qui ne trouve rien
    // satisferait les assertions suivantes sans rien regarder (§9, 30/08).
    expect(type, "le type LigneOccupation est introuvable").toBeDefined();
    expect(type).toMatch(/\n\s+readonly agenceId: string;/);
  });

  it("et le regroupement se fait SUR CE COUPLE, jamais sur le technicien seul", () => {
    // C'est ce qui fait qu'une personne PEUT porter deux lignes. Un
    // regroupement par technicien seul les fusionnerait — et additionnerait
    // deux dénominateurs venus de deux calendriers, ce qu'I7 refuse.
    expect(OCCUPATION).toMatch(/cle\.technicienId[^\n]*\|[^\n]*cle\.agenceId/);
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — le rattachement EXISTE, il ne décide simplement plus", () => {
    // `technicien.agence_id` n'a pas disparu et ne doit pas disparaître : il
    // décide de la majoration (D12) et du calendrier de conflit à la pose
    // (D13). Ce que la réécriture retire est son rôle dans CETTE condition-ci.
    // *Sans cette moitié, on croirait la colonne condamnée.*
    const modele = /model Technicien \{[\s\S]*?\n\}/.exec(SCHEMA)?.[0] ?? "";
    expect(modele).toContain('@@map("technicien")');
    expect(modele).toMatch(/\n\s+agence_id\s+String\s+@db\.Uuid/);
  });
});

describe("L'ÉCRAN MESURE la condition au lieu de la supposer", () => {
  const source = readFileSync(ECRAN, "utf8");

  it("il nomme l'agence dès qu'une personne porte PLUSIEURS lignes de charge", () => {
    // D112 autorise le renfort entre agences, et la maille de l'occupation est
    // (technicien, agence de l'intervention). L'écran doit donc dégrader tout
    // seul — c'est exactement ce que D111 prescrit pour ce jour-là.
    expect(source).toContain("nommerLAgence");
    expect(source).toMatch(/lignes\.length > 1/);
  });

  it("TÉMOIN — la colonne affiche bien un taux", () => {
    expect(source).toContain("tauxCompact");
  });

  it("et il ne DÉCIDE jamais sur `technicien.agence_id`", () => {
    // La « simplification » que la condition réécrite arrête : déduire qu'une
    // personne n'a qu'une ligne parce que sa colonne de rattachement est
    // simple. L'écran serait vert, le schéma inchangé, et l'affichage
    // mentirait le premier jour d'un renfort — que D112 autorise.
    const decisions = source
      .split("\n")
      .filter((l) => l.includes("nommerLAgence"))
      .join("\n");
    expect(decisions).not.toContain("agence_id");
  });
});

describe("les trois états ne se disent pas avec le même mot", () => {
  it("sans calendrier — ce n'est PAS zéro pour cent", () => {
    expect(tauxCompact(occupation(120, 0))).toEqual({
      etat: "sans_calendrier",
    });
  });

  it("non nul mais arrondi à zéro — « moins de 1 % »", () => {
    // *Zéro pour cent se lit « n'a rien fait », et ce technicien a travaillé.*
    expect(tauxCompact(occupation(95, 32_880))).toEqual({ etat: "infime" });
  });

  it("et un taux ordinaire reste un chiffre", () => {
    expect(tauxCompact(occupation(240, 480))).toEqual({
      etat: "chiffre",
      pourcent: 50,
    });
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — zéro minute engagée EST zéro", () => {
    // Sans cette moitié, « infime » couvrirait aussi le vrai zéro, et la
    // distinction ne distinguerait rien.
    expect(tauxCompact(occupation(0, 480))).toEqual({
      etat: "chiffre",
      pourcent: 0,
    });
  });
});
