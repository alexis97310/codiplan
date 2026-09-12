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
 * Et la condition de réouverture est écrite pour être vérifiée : *« le jour où
 * une personne travaillera pour deux agences, cet affichage devient ambigu et
 * devra nommer l'agence. Ce jour-là se reconnaît à une seule chose — une ligne
 * de technicien rattachée à deux agences. »*
 *
 * ## CE GARDIEN TIENT LA CONDITION, PAS L'AFFICHAGE
 *
 * *Une condition de réouverture écrite en prose est une intention* (§9, 31/08) :
 * elle ne rougit pas le jour où elle est remplie. Celle-ci rougit — sur la
 * **forme du schéma**, qui est ce que D111 invoque.
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

describe("LA CONDITION DE VALIDITÉ de D111, tenue par le schéma", () => {
  it("`technicien` porte UNE agence, colonne simple et obligatoire", () => {
    const modele = /model Technicien \{[\s\S]*?\n\}/.exec(SCHEMA)?.[0] ?? "";
    // TÉMOIN : le modèle a bien été trouvé. Un motif qui ne trouve rien
    // satisferait les assertions suivantes sans rien regarder (§9, 30/08).
    expect(modele).toContain('@@map("technicien")');

    // La colonne existe, elle n'est PAS optionnelle, et elle n'est PAS une
    // liste. Ces trois-là sont la condition de D111, chacune dans un sens que
    // le schéma pourrait perdre séparément.
    expect(modele).toMatch(/\n\s+agence_id\s+String\s+@db\.Uuid/);
    expect(modele).not.toMatch(/\n\s+agence_id\s+String\?/);
    expect(modele).not.toMatch(/\n\s+agence_ids\s/);
  });

  it("aucune table ne rattache un technicien à PLUSIEURS agences", () => {
    // La seconde forme que prendrait la réouverture : une table de liaison.
    // Elle n'existe pas ; le jour où elle naîtra, cette assertion la nommera.
    expect(SCHEMA).not.toMatch(/@@map\("technicien_agence"\)/);
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
