import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import type { JourLocal } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { t } from "@/lib/i18n/fr";
import {
  construireJournee,
  type AgenceDeJournee,
  type Occupante,
} from "@/lib/interventions/journee";
import { personnesANommer, quiTravaille } from "@/lib/interventions/personnes";

/**
 * LA COLONNE D'UN TECHNICIEN QUI NE TRAVAILLE PAS PORTE SON NOM (14/09/2026).
 *
 * ## Le défaut, et pourquoi rien ne pouvait le voir
 *
 * Le 12/09, la vue jour a cessé de tirer ses colonnes des interventions pour
 * les tirer du **référentiel** : *un technicien dont la journée est entièrement
 * libre n'avait aucune colonne, sur un écran dont l'objet déclaré est de
 * MONTRER LES TROUS.* La résolution des noms, elle, est restée branchée sur les
 * interventions.
 *
 * **Chaque moitié était juste.** Le référentiel donnait les bonnes colonnes, la
 * résolution rendait les bons noms de ceux qu'on lui demandait. Ce qui était
 * faux était leur **RENCONTRE**, que ni l'une ni l'autre ne connaît (§9, 09/09)
 * — et le défaut frappait très exactement la population pour laquelle la
 * colonne venait d'être créée.
 *
 * *Constaté à l'écran sur la base hébergée, lundi 14/09 : deux colonnes
 * intitulées « Technicien 01a09565 ».*
 *
 * ## Ce que ce fichier tient, en deux moitiés qui ne se recouvrent pas
 *
 *   1. **LE FAIT** — une journée bâtie comme l'écran la bâtit, avec un
 *      technicien actif SANS aucune intervention : sa colonne porte son nom.
 *      *Sans lui, la garantie porterait sur un geste — « la liste est plus
 *      large » — et non sur un fait* (§9, 09/09).
 *   2. **LES DEUX ABSENCES** — « la politique refuse » et « je n'ai pas
 *      demandé » ne rendent plus la même chaîne. La première est légitime et le
 *      reste ; la seconde est une anomalie, et elle se lit comme telle.
 *
 * Le **jumeau** (§9, 24/08) rejoue la faute telle qu'elle a été commise — la
 * population réduite aux seules interventions — et montre que la colonne perd
 * alors son nom. Sans lui, ce fichier prouverait que le repli fonctionne, pas
 * que le défaut est fermé.
 */

const LUNDI: JourLocal = { annee: 2026, mois: 9, jour: 14 };

const DUCOS: AgenceDeJournee = {
  id: "ag-ducos",
  libelle: "Ducos",
  plages: [1, 2, 3, 4, 5].flatMap((jourSemaine) => [
    { jourSemaine, debutMinutes: 450, finMinutes: 690 },
    { jourSemaine, debutMinutes: 780, finMinutes: 1020 },
  ]),
  pasCreneauMinutes: 30,
  calendrierConnu: true,
};

/** Deux identités du référentiel — l'une occupée ce lundi, l'autre libre. */
const OCCUPE = "11111111-1111-7111-8111-111111111111";
const LIBRE = "22222222-2222-7222-8222-222222222222";
/** Une personne posée sur une intervention SANS être au référentiel. */
const PARTI = "33333333-3333-7333-8333-333333333333";

const NOMS = new Map([
  [OCCUPE, "Paul Kaméré"],
  [LIBRE, "Téa Wamytan"],
  [PARTI, "Jean Poindi"],
]);

type Ligne = Occupante & { readonly reference: string };

function ligne(technicienId: string | null, debutMinutes: number): Ligne {
  return {
    id: `${technicienId ?? "-"}@${debutMinutes}`,
    duree_estimee_min: 60,
    technicien_id: technicienId,
    agence_id: DUCOS.id,
    creneau_debut: instant(debutMinutes),
    creneau_fin: instant(debutMinutes + 60),
    reference: `${technicienId ?? "-"}@${debutMinutes}`,
  };
}

function instant(minutes: number): Date {
  return new Date(
    Date.UTC(LUNDI.annee, LUNDI.mois - 1, LUNDI.jour, 0, minutes, 0),
  );
}

const MINUTES_DE = (moment: Date) =>
  moment.getUTCHours() * 60 + moment.getUTCMinutes();

const LIGNES: readonly Ligne[] = [ligne(OCCUPE, 480), ligne(PARTI, 540)];
const REFERENTIEL = [{ id: OCCUPE }, { id: LIBRE }];

/**
 * La lecture, sans base : le client rend ce que la politique aurait rendu.
 *
 * `refusees` est le levier du second scénario — une identité que la lecture NE
 * rend pas alors qu'elle a bien été demandée, c'est-à-dire le refus légitime du
 * cloisonnement. *Le simuler ici plutôt que de le supposer est ce qui rend les
 * deux absences comparables côte à côte.*
 */
async function annuaireSur(
  identifiants: readonly string[],
  refusees: readonly string[] = [],
): Promise<Annuaire> {
  let interroges: readonly string[] = [];
  const tx = {
    utilisateur: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        interroges = where.id.in;
        return where.id.in
          .filter((id) => !refusees.includes(id))
          .flatMap((id) => {
            const nom = NOMS.get(id);
            return nom === undefined ? [] : [{ id, nom }];
          });
      },
    },
  } as unknown as Prisma.TransactionClient;
  const annuaire = await annuaireDesPersonnes(tx, identifiants);
  // TÉMOIN — la lecture a bien eu lieu sur ce qu'on lui a donné. *Un décompte
  // nul ressemble toujours à un sans-faute* (§9, 30/08) : sans cela, un
  // annuaire qui n'aurait rien interrogé rendrait « refusée » pour tout le
  // monde et ce fichier resterait vert.
  expect(new Set(interroges)).toEqual(new Set(identifiants));
  return annuaire;
}

/** La journée telle que l'écran la bâtit, et le libellé de chaque colonne. */
function libellesDesColonnes(annuaire: Annuaire): readonly string[] {
  const journee = construireJournee(
    LIGNES,
    LUNDI,
    [DUCOS],
    MINUTES_DE,
    REFERENTIEL.map((r) => ({ id: r.id, agenceIds: [DUCOS.id] })),
  );
  return journee.colonnes.map((c) => quiTravaille(c.technicienId, annuaire));
}

describe("LA POPULATION À NOMMER — l'union, jamais une moitié", () => {
  it("elle contient le technicien du référentiel SANS intervention", () => {
    // Le défaut, pris par son bout exact.
    expect(personnesANommer(LIGNES, REFERENTIEL)).toContain(LIBRE);
  });

  it("elle contient la personne posée SANS être au référentiel", () => {
    // L'autre moitié : un `actif = false` sort quelqu'un du référentiel sans
    // effacer son passé. *Perdre une ligne pour la faire rentrer dans un
    // référentiel serait remplacer une disparition par une autre.*
    expect(personnesANommer(LIGNES, REFERENTIEL)).toContain(PARTI);
  });

  it("elle N'INVENTE personne — la file non affectée n'a pas d'identité", () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON (§9, 11/09) : une
    // population qui gonflerait en avalant le `null` de la file passerait les
    // deux scénarios ci-dessus sans rien garantir.
    const avecFile = [...LIGNES, ligne(null, 600)];
    const personnes = personnesANommer(avecFile, REFERENTIEL);
    expect(personnes).toHaveLength(3);
    expect(personnes).not.toContain("");
    expect(personnes.every((id) => NOMS.has(id))).toBe(true);
  });
});

describe("LE FAIT — la colonne du technicien libre porte son nom", () => {
  it("les TROIS colonnes sont nommées, la libre comprise", async () => {
    const annuaire = await annuaireSur(personnesANommer(LIGNES, REFERENTIEL));
    const libelles = libellesDesColonnes(annuaire);
    expect(libelles).toContain("Téa Wamytan");
    expect(libelles).toContain("Paul Kaméré");
    expect(libelles).toContain("Jean Poindi");
  });

  it("AUCUNE colonne ne porte l'anomalie « nom non demandé »", () => {
    // La garantie énoncée sur le FAIT plutôt que sur la liste : quelle que
    // soit la façon dont les colonnes sont composées demain, aucune ne doit
    // sortir de la résolution.
    return annuaireSur(personnesANommer(LIGNES, REFERENTIEL)).then(
      (annuaire) => {
        expect(libellesDesColonnes(annuaire)).not.toContain(
          t("planning.nom_non_demande"),
        );
      },
    );
  });

  it("JUMEAU — la faute telle qu'elle a été commise fait perdre le nom", async () => {
    // La population d'AVANT : les seules interventions. Le verrou retiré, la
    // colonne du technicien libre doit cesser d'être nommée — sans quoi ce
    // fichier prouverait que le repli fonctionne, pas que le défaut est fermé.
    const commeAvant = LIGNES.map((l) => l.technicien_id).filter(
      (id): id is string => id !== null,
    );
    const annuaire = await annuaireSur(commeAvant);
    const libelles = libellesDesColonnes(annuaire);
    expect(libelles).not.toContain("Téa Wamytan");
    expect(libelles).toContain(t("planning.nom_non_demande"));
  });
});

describe("LES DEUX ABSENCES — elles ne se confondent plus", () => {
  it("une identité REFUSÉE par la politique se dit, et reste légitime", async () => {
    const annuaire = await annuaireSur(personnesANommer(LIGNES, REFERENTIEL), [
      LIBRE,
    ]);
    expect(quiTravaille(LIBRE, annuaire)).toBe(
      t("planning.nom_non_communique"),
    );
  });

  it("une identité JAMAIS DEMANDÉE se dit autrement, et c'est une anomalie", async () => {
    const annuaire = await annuaireSur([OCCUPE]);
    expect(quiTravaille(LIBRE, annuaire)).toBe(t("planning.nom_non_demande"));
  });

  it("les deux libellés DIFFÈRENT — sinon rien n'est distingué", () => {
    // Le témoin du dictionnaire : deux clés qui porteraient le même texte
    // rendraient tout ce fichier vert sans rien séparer.
    expect(t("planning.nom_non_communique")).not.toBe(
      t("planning.nom_non_demande"),
    );
  });

  it("aucun des deux ne montre un fragment d'IDENTIFIANT", async () => {
    // L'ancien repli était `Technicien <8 premiers caractères>`. Il ressemblait
    // à une donnée là où il fallait lire un échec.
    const annuaire = await annuaireSur([OCCUPE]);
    expect(quiTravaille(LIBRE, annuaire)).not.toContain(LIBRE.slice(0, 8));
  });
});

describe("POURQUOI le repli ne distinguait personne", () => {
  it("les 8 premiers caractères d'un UUID v7 sont l'HORODATAGE (I10)", () => {
    // Mesuré plutôt qu'affirmé (§9, 07/09). Les 48 bits de poids fort portent
    // les millisecondes : deux identités créées dans la même minute — tout un
    // semis — partagent leur préfixe. *Un discriminant qui ne discrimine pas
    // est pire qu'une absence : il fait croire à une identité*, et c'est bien
    // DEUX colonnes « Technicien 01a09565 » que l'écran a montrées.
    const prefixes = new Set(
      Array.from({ length: 8 }, () => uuidv7().slice(0, 8)),
    );
    expect(prefixes.size).toBe(1);
  });
});

/**
 * L'USAGE — l'écran ne peut pas rétrécir la population en silence.
 *
 * *La moitié précédente sans celle-ci laisserait un écran juste appeler une
 * fonction juste avec le mauvais argument* — c'est exactement la faute du
 * 12/09, et c'est le raisonnement de `planning-un-seul-jeu.test.ts`.
 */
describe("L'USAGE — l'écran demande bien l'UNION", () => {
  const ECRAN = join(process.cwd(), "app/(back-office)/planning/page.tsx");
  const source = () => readFileSync(ECRAN, "utf8");

  it("TÉMOIN — l'écran construit bien un annuaire", () => {
    // Zéro appel trouvé ressemble exactement à un sans-faute (§9, 30/08) : un
    // renommage ferait passer ce gardien au vert sur un écran qu'il ne regarde
    // plus.
    expect(source()).toContain("annuaireDesPersonnes(");
  });

  it("il le construit sur `personnesANommer`, et sur rien de plus étroit", () => {
    // Les espaces et les retours à la ligne sont absorbés : Prettier décide de
    // la mise en forme, et un gardien qui en dépendrait rougirait au premier
    // reformatage (§9, 26/08, forme 1).
    expect(source()).toMatch(
      /annuaireDesPersonnes\(\s*[A-Za-z0-9_.]+\s*,\s*personnesANommer\(/,
    );
  });

  it("les DEUX sources entrent dans l'union — les lignes ET le référentiel", () => {
    // Le défaut se recommettrait en n'en passant qu'une. Les deux noms sont
    // ceux que l'écran emploie ; un renommage fait rougir le témoin ci-dessus
    // plutôt que celui-ci, et c'est le bon ordre.
    expect(source()).toMatch(
      /personnesANommer\(\s*lignes\s*,\s*pourTechniciens\s*\)/,
    );
  });
});
