import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE GARDIEN DE COMPOSITION — LOT A2 (D125, D128).
 *
 * Confronte `/planning` à `planning()` (et ses fonctions `weekPlan()`,
 * `dayPlan()`, `eventButton()`, contiguës dans le fichier) de
 * `docs/maquette/codiplan-maquette-complete.html`, bloc par bloc — le même
 * principe que `tests/unit/ui/lot-a5-a7.test.ts` : deux TEXTES confrontés,
 * jamais un rendu.
 *
 * ## LA POPULATION DES ONZE BLOCS
 *
 * Elle reprend exactement le décompte de `docs/audits/2026-09-19-ecrans.md`,
 * section Planning : « 11 blocs attendus, 9 rendus au moins partiellement »,
 * les deux blocs manquants étant la bannière et le badge de la file. Les
 * lignes de l'audit marquées « AJOUT hors maquette » (navigation
 * précédent/suivant, légende, panneau Statistiques, lien Absences) n'ont
 * aucun équivalent dans la maquette : elles ne sont pas comptées, exactement
 * comme l'audit ne les compte pas dans son « 11 ».
 *
 * ## POURQUOI UN ATTRIBUT `data-maquette-bloc`, ET PAS `data-bloc`
 *
 * `data-bloc` existe déjà dans ce dépôt (`components/planning/pose.tsx:408`)
 * et porte l'identifiant d'une intervention pour le glisser-déposer — lui en
 * ajouter un second sens aurait été la même faute que le fichier de l'écran
 * met déjà en garde contre (« un `data-bloc` en double » ferait échouer tout
 * scénario qui cherche un bloc par son identifiant). Ce gardien pose donc son
 * propre attribut, `data-maquette-bloc`, qui ne signifie jamais rien pour la
 * pose.
 *
 * ## CE QUE CE GARDIEN NE CONFRONTE PAS
 *
 * Trois blocs déjà présents et inchangés par ce ticket (en-tête, sélecteur
 * Semaine/Jour dans son PRINCIPE, bouton primaire) sont vérifiés par une
 * preuve textuelle simple plutôt qu'un `data-maquette-bloc` : le titre
 * (`h1`) et le sous-titre viennent du composant partagé `Page`
 * (`components/mise-en-page/page.tsx`), hors du territoire de ce lot — leur
 * poser un marqueur demanderait de toucher un composant partagé, exactement
 * ce que ce ticket interdit.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

function extraireFonction(debutMarqueur: string, finMarqueur: string): string {
  const debut = MAQUETTE.indexOf(debutMarqueur);
  const fin = MAQUETTE.indexOf(finMarqueur);
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error(
      `${debutMarqueur} est introuvable, ou plus bornée par ${finMarqueur} qui ` +
        "la suit — docs/maquette/codiplan-maquette-complete.html a changé de " +
        "forme, et ce gardien ne mesure plus rien",
    );
  }
  return MAQUETTE.slice(debut, fin);
}

/** planning() + weekPlan() + dayPlan() + eventButton(), contigus dans le fichier. */
const FONCTION_PLANNING = extraireFonction(
  "function planning(){",
  "function interventions(){",
);

function source(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}

const PAGE = source("app/(back-office)/planning/page.tsx");
const POSE = source("components/planning/pose.tsx");
const SOURCES = `${PAGE}\n${POSE}`;

type BlocAttendu = {
  readonly nom: string;
  readonly preuve: string;
  /** Vrai si ce bloc se vérifie par une preuve textuelle plutôt qu'un marqueur. */
  readonly texteSeul?: string;
};

const BLOCS_PLANNING: readonly BlocAttendu[] = [
  // ── Déjà présents avant ce lot (audit : PRÉSENT ou PRÉSENT MAIS DIFFÉRENT) ──
  {
    nom: "en-tete",
    preuve: '"Planning des techniciens"',
    texteSeul: 't("planning.titre")',
  },
  {
    nom: "selecteur-semaine-jour",
    preuve: '<div class="seg"><button data-plan-view="week"',
  },
  {
    nom: "bouton-primaire-intervention",
    preuve:
      '<button class="btn primary" data-action="new-job">+ Intervention</button>',
  },
  {
    nom: "carte-a-affecter",
    preuve: '<div class="card-head"><h2>À affecter</h2>',
  },
  {
    nom: "cartes-dossier-file",
    preuve: '<div class="queue-card" data-job="INT-2026-00321">',
  },
  {
    nom: "tableau-charge-semaine",
    preuve:
      '<div class="plan-grid"><div class="plan-cell plan-head">Technicien</div>',
  },
  {
    nom: "bloc-intervention-case",
    preuve: "<strong>${j.time} · ${j.client}</strong>${j.type} · ${j.machine}",
  },
  {
    nom: "vue-jour",
    preuve: "grid-template-columns:170px repeat(4,minmax(180px,1fr))",
  },
  {
    nom: "nom-technicien-agence",
    preuve:
      '<small>${t==="P. Poigoune"?"Koné · brousse":"Ducos · SAV"}</small>',
  },
  // ── Mesurés ABSENTS par l'audit du 19/09 — les deux seuls de la série ──────
  {
    nom: "banniere-calendriers",
    preuve: "<strong>Calendriers d’agence respectés</strong>",
  },
  { nom: "badge-a-affecter", preuve: '${badge("4 dossiers","orange")}' },
];

describe("le gardien de composition — /planning contre planning() de la maquette (D125, D128)", () => {
  it("a réellement lu chaque preuve dans la fonction de la maquette — le témoin de non-vacuité", () => {
    for (const bloc of BLOCS_PLANNING) {
      expect(FONCTION_PLANNING, bloc.nom).toContain(bloc.preuve);
    }
  });

  it("LE DÉCOMPTE — combien des onze blocs le code source rend-il", () => {
    const rendus = BLOCS_PLANNING.filter((bloc) =>
      bloc.texteSeul !== undefined
        ? SOURCES.includes(bloc.texteSeul)
        : SOURCES.includes(`data-maquette-bloc="${bloc.nom}"`),
    );
    expect(
      rendus.map((bloc) => bloc.nom),
      `${rendus.length}/${BLOCS_PLANNING.length} blocs rendus`,
    ).toEqual(BLOCS_PLANNING.map((bloc) => bloc.nom));
  });

  it("N'ÉCRIT PAS de calendrier codé en dur dans la bannière (I7)", () => {
    // Ni l'exemple de démonstration de la maquette, ni aucun autre jour de
    // semaine écrit tel quel : la liste vient de `joursTravailles`, jamais
    // d'une chaîne figée dans l'écran.
    expect(PAGE).not.toContain("Ducos ouvre du lundi au samedi");
  });

  it("NE POSE JAMAIS son marqueur sur l'attribut `data-bloc` du glisser-déposer", () => {
    // `data-bloc` reste réservé à `components/planning/pose.tsx` — un seul
    // sens, jamais deux (voir l'en-tête de ce fichier). Ce gardien pose le
    // sien sur `data-maquette-bloc`, jamais sur `data-bloc=`.
    expect(PAGE).not.toContain('data-bloc="');
  });
});
