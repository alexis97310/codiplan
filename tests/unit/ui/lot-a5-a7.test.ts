import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE GARDIEN DE COMPOSITION — LOT A5+A7 (D125).
 *
 * Confronte `/vgp` à `vgp()` et `/parametres` à `parametres()` de
 * `docs/maquette/codiplan-maquette-complete.html`, bloc par bloc — le même
 * principe que `tests/unit/machines/composition-parc.test.ts` (N-10) : deux
 * TEXTES confrontés, jamais un rendu.
 *
 * ## CE QUE LA « PREUVE » CONFRONTE, ET CE QU'ELLE NE CONFRONTE PAS
 *
 * `preuve` est un extrait EXACT de la fonction de la maquette — il prouve que
 * le bloc existe bien LÀ, dans la disposition qu'elle dessine (D125). Il ne
 * dit rien du CONTENU que l'écran réel affiche : D125 fait foi sur la
 * disposition, jamais sur les règles de gestion du chapitre 10 (D125, « Ce que
 * D125 ne touche pas »). Deux blocs de ce fichier ont un contenu réel
 * DÉLIBÉRÉMENT différent du texte de démonstration de la maquette :
 *
 * - **`kpi-informations-recues`** — la maquette écrit « Conformes ». CODIPLAN
 *   n'affirme jamais la conformité (L9-02, D88, D114) : les VGP sont
 *   commandées par les clients, et CODIPLAN ne rend jamais de verdict. Le KPI
 *   existe à la même place, avec un compte réel et sans jugement — un ÉCART
 *   NOMMÉ de contenu, jamais de disposition.
 * - **La colonne « Temps » du tableau des forfaits** — aucune table ne porte
 *   de durée sur un forfait (`prisma/schema.prisma`, modèle `Forfait`) ; la
 *   colonne existe, avec le signe d'absence, comme D125 l'exige déjà pour
 *   « Contrat » dans le `dl.kv` de la fiche machine.
 *
 * ## LA POPULATION EST CELLE MESURÉE, PAS CELLE QU'ON CROIT AVOIR ÉCRITE
 *
 * Un `it` de non-vacuité vérifie que chaque preuve existe réellement dans la
 * fonction de la maquette, avant toute confrontation au code source.
 */

const MAQUETTE = readFileSync(
  join(process.cwd(), "docs/maquette/codiplan-maquette-complete.html"),
  "utf8",
);

type BlocAttendu = {
  readonly nom: string;
  readonly preuve: string;
};

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

function lireSources(chemins: readonly string[]): string {
  return chemins
    .map((chemin) => {
      try {
        return readFileSync(join(process.cwd(), chemin), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

function confronter(
  nomEcran: string,
  bloc: string,
  attendus: readonly BlocAttendu[],
  sources: string,
) {
  describe(nomEcran, () => {
    it("a réellement lu chaque preuve dans la fonction de la maquette — le témoin de non-vacuité", () => {
      for (const attendu of attendus) {
        expect(bloc, attendu.nom).toContain(attendu.preuve);
      }
    });

    it("CHAQUE BLOC ATTENDU PORTE SON MARQUEUR DANS LE CODE SOURCE", () => {
      const rendus = attendus.filter((b) =>
        sources.includes(`data-bloc="${b.nom}"`),
      );
      expect(
        rendus.map((b) => b.nom),
        `${rendus.length}/${attendus.length} blocs rendus`,
      ).toEqual(attendus.map((b) => b.nom));
    });
  });
}

/* ────────────────────────────────────────────────────────────────────────
 * /vgp CONTRE vgp() — quatre KPI, table à six colonnes (état, action)
 * ──────────────────────────────────────────────────────────────────────── */

const FONCTION_VGP = extraireFonction("function vgp(){", "function portail(){");

const BLOCS_VGP: readonly BlocAttendu[] = [
  { nom: "kpi-sous-30-jours", preuve: "À faire sous 30 jours" },
  { nom: "kpi-en-retard", preuve: "En retard" },
  // Écart nommé de CONTENU — voir l'en-tête de ce fichier : « Conformes »
  // devient un compte réel d'informations reçues, jamais un verdict.
  { nom: "kpi-informations-recues", preuve: "Conformes" },
  { nom: "kpi-a-determiner", preuve: "À déterminer" },
  { nom: "tableau-registre", preuve: 'class="card table-wrap"' },
  {
    nom: "colonnes-registre",
    preuve:
      "<th>Machine</th><th>Client</th><th>Dernier contrôle</th>" +
      "<th>Échéance</th><th>État</th><th>Action</th>",
  },
];

confronter(
  "le gardien de composition — /vgp contre vgp() de la maquette (D125)",
  FONCTION_VGP,
  BLOCS_VGP,
  lireSources(["app/(back-office)/vgp/page.tsx"]),
);

/* ────────────────────────────────────────────────────────────────────────
 * /parametres CONTRE parametres() — trois cartes, puis la table des forfaits
 * ──────────────────────────────────────────────────────────────────────── */

const FONCTION_PARAMETRES = extraireFonction(
  "function parametres(){",
  "function imports(){",
);

/**
 * ARBITRAGE D128 (18/09/2026) — POURQUOI CE VOLET NE CONFRONTE PLUS
 * `/parametres` À `parametres()` BLOC PAR BLOC.
 *
 * *« /parametres n'est pas l'écran de la maquette : c'est une PORTE, et le
 * contenu que la maquette montre en un seul écran est réparti sur quatre
 * routes réelles. Regrouper coûterait élevé ET contredirait une doctrine
 * écrite du dépôt : une porte dit où elle mène, pas ce qu'il y a derrière. »*
 *
 * `app/(back-office)/parametres/page.tsx` reste donc INTACT — R3-05, jamais
 * rouvert par ce ticket. D128 retient trois écarts à coût faible et purement
 * de RENDU sur `/parametres/forfaits`, la porte où vit déjà le catalogue :
 * séparer Code et Libellé, exposer la Catégorie (la donnée existe déjà et
 * sert déjà au regroupement par nature), et **refuser** la colonne « Temps »
 * que `parametres()` dessine — D109 et D113 l'interdisent pour un forfait, et
 * la maquette ne fait pas foi contre une règle de gestion déjà arbitrée
 * (D128, « la règle générale »).
 */
const BLOCS_FORFAITS: readonly BlocAttendu[] = [
  // Les trois positifs sont bien dans `parametres()` — la preuve que ce ne
  // sont pas des colonnes inventées, seulement reprises d'où D128 les veut.
  { nom: "colonne-code", preuve: "<th>Code</th>" },
  { nom: "colonne-libelle", preuve: "<th>Libellé</th>" },
  { nom: "colonne-categorie", preuve: "<th>Catégorie</th>" },
];

const SOURCE_FORFAITS = lireSources([
  "app/(back-office)/parametres/forfaits/page.tsx",
]);

describe("le gardien de composition — /parametres/forfaits, trois écarts à coût faible (D128)", () => {
  it("a réellement lu les trois preuves dans parametres() — le témoin de non-vacuité", () => {
    for (const attendu of BLOCS_FORFAITS) {
      expect(FONCTION_PARAMETRES, attendu.nom).toContain(attendu.preuve);
    }
  });

  it("CHAQUE BLOC ATTENDU PORTE SON MARQUEUR DANS LE CODE SOURCE", () => {
    const rendus = BLOCS_FORFAITS.filter((b) =>
      SOURCE_FORFAITS.includes(`data-bloc="${b.nom}"`),
    );
    expect(
      rendus.map((b) => b.nom),
      `${rendus.length}/${BLOCS_FORFAITS.length} blocs rendus`,
    ).toEqual(BLOCS_FORFAITS.map((b) => b.nom));
  });

  it("NE PORTE PAS de colonne « Temps » — D109/D113 l'interdisent pour un forfait (D128)", () => {
    expect(SOURCE_FORFAITS).not.toContain('data-bloc="colonne-temps"');
  });

  it("/parametres reste la PORTE, intact — R3-05, jamais rouvert par ce ticket", () => {
    const porte = lireSources(["app/(back-office)/parametres/page.tsx"]);
    expect(porte).not.toContain('data-bloc="grille-cartes"');
    expect(porte).not.toContain('data-bloc="carte-societe"');
    expect(porte).not.toContain('data-bloc="table-forfaits"');
  });
});
