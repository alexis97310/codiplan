import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * LES GARDE-FOUS DES RETOUCHES TYPOGRAPHIQUES DU 30/09/2026 (D143,
 * `docs/arbitrages.md`, ticket 9CG-RETOUCHES-2A-TYPO) — un par point de la
 * décision, chacun lisant TOUS les `.tsx` de `app/` et `components/` : la
 * population vient du dépôt, jamais d'une recopie de la liste mesurée en
 * passation.
 *
 * Les points 8 (terrain à 16 px) et le plancher étendu rejoignent ce fichier
 * aux commits suivants du même ticket — jamais retirés, seulement ajoutés.
 */

const FICHIERS = fichiersSource(["app", "components"], [".tsx"]).map((f) => ({
  chemin: f.chemin,
  lignes: sansCommentaires(f.contenu).split("\n"),
}));

describe("retouches typographiques du 30/09/2026 (D143)", () => {
  it("a réellement lu des fichiers de app/ et components/ — le témoin de non-vacuité", () => {
    expect(FICHIERS.length).toBeGreaterThan(0);
  });

  describe("point 6 — plus aucun text-[12.5px]", () => {
    const MOTIF = /text-\[12\.5px\]/;

    it("zéro occurrence dans app/ et components/", () => {
      const fautifs = FICHIERS.filter((f) =>
        f.lignes.some((ligne) => MOTIF.test(ligne)),
      ).map((f) => f.chemin);
      expect(fautifs).toEqual([]);
    });

    it("reconnaît la forme qu'il refuse", () => {
      expect(MOTIF.test('className="text-[12.5px] font-bold"')).toBe(true);
    });
  });

  describe("points 7 et 10 — toute taille arbitraire reste dans l'échelle", () => {
    const ECHELLE = [12, 13, 14, 15, 16, 18, 24, 28];
    const MOTIF_ARBITRAIRE = /text-\[([0-9.]+)px\]/g;

    it("aucun text-[Npx] à 12 px ou plus, hors de 12/13/14/15/16/18/24/28", () => {
      // Sous 12 px (le plancher, D138) est une règle SÉPARÉE, tenue par
      // `plancher-12-pages.test.ts` et étendue par un commit suivant de ce
      // même ticket — jamais mêlée à l'échelle elle-même.
      const fautifs: string[] = [];
      for (const f of FICHIERS) {
        for (const ligne of f.lignes) {
          for (const m of ligne.matchAll(MOTIF_ARBITRAIRE)) {
            const valeur = Number(m[1]);
            if (valeur >= 12 && !ECHELLE.includes(valeur)) {
              fautifs.push(`${f.chemin}: text-[${m[1]}px]`);
            }
          }
        }
      }
      expect(fautifs).toEqual([]);
    });

    it("reconnaît la forme qu'il refuse", () => {
      expect(ECHELLE.includes(Number("19"))).toBe(false);
    });

    // `text-2xl` (24 px) et `text-lg` (18 px) coïncident déjà avec l'échelle
    // (constat du 30/09/2026, mesure (0)) — seuls `text-xl` (20 px, hors
    // échelle) et `text-3xl` et au-delà sont refusés.
    const MOTIF_TAILWIND = /\btext-(xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/;

    it("aucun text-xl, text-3xl et au-delà de l'échelle", () => {
      const fautifs = FICHIERS.filter((f) =>
        f.lignes.some((ligne) => MOTIF_TAILWIND.test(ligne)),
      ).map((f) => f.chemin);
      expect(fautifs).toEqual([]);
    });

    it("reconnaît la forme qu'il refuse", () => {
      expect(MOTIF_TAILWIND.test('className="text-xl"')).toBe(true);
    });

    it("mais n'interdit pas text-2xl (24 px, déjà dans l'échelle)", () => {
      expect(MOTIF_TAILWIND.test('className="text-2xl"')).toBe(false);
    });

    it("kpi.tsx (tuiles de chiffres) porte text-28", () => {
      const kpi = FICHIERS.find((f) => f.chemin === "components/ui/kpi.tsx");
      expect(kpi).toBeDefined();
      expect(kpi?.lignes.some((ligne) => ligne.includes("text-28"))).toBe(true);
    });
  });

  describe("point 11 — 700 minimum pour un texte de 12 ou 13 px", () => {
    const MOTIF_TAILLE = /text-(12|13|xs|\[12px\]|\[13px\])(?![0-9a-zA-Z.-])/;
    const MOTIF_POIDS_FORT = /font-(bold|extrabold|black)\b/;

    /**
     * EXEMPTION FERMÉE, DANS LES DEUX SENS. « Le lien sous une tuile »
     * (98-TABLEAU-2, 99V-GR6-TUILES, `CLASSES_LIEN_TUILE`) est réservé à
     * 9CH-RETOUCHES-2B-COMPOSANTS — hors territoire de ce ticket, qui ne
     * touche ni aux liens sous les tuiles ni à la tuile « En retard »
     * (passation de 9CG-RETOUCHES-2A-TYPO). Deux entrées, la même constante
     * dans deux fichiers ; la seconde épreuve ci-dessous garantit que
     * l'exemption ne couvre QUE cette ligne précise, jamais le reste du
     * fichier.
     */
    const EXEMPTIONS: ReadonlyArray<readonly [string, string]> = [
      [
        "app/(back-office)/tableau-de-bord/page.tsx",
        "CLASSES_LIEN_TUILE = `inline-flex min-h-[32px] items-center text-[13px] ${CLASSES_LIEN}`;",
      ],
      [
        "app/(back-office)/interventions/page.tsx",
        "CLASSES_LIEN_TUILE = `inline-flex min-h-[32px] items-center text-[13px] ${CLASSES_LIEN}`;",
      ],
    ];

    function estExempte(chemin: string, ligne: string): boolean {
      return EXEMPTIONS.some(
        ([cheminExempte, ligneExemptee]) =>
          chemin === cheminExempte && ligne.trim().endsWith(ligneExemptee),
      );
    }

    it("chaque ligne qui porte une taille de 12 ou 13 px porte aussi une graisse d'au moins 700", () => {
      const fautifs: string[] = [];
      for (const f of FICHIERS) {
        for (const ligne of f.lignes) {
          if (!MOTIF_TAILLE.test(ligne) || MOTIF_POIDS_FORT.test(ligne)) {
            continue;
          }
          if (estExempte(f.chemin, ligne)) {
            continue;
          }
          fautifs.push(`${f.chemin}: ${ligne.trim().slice(0, 120)}`);
        }
      }
      expect(fautifs).toEqual([]);
    });

    it("l'exemption ne couvre que la ligne nommée — le reste de ces deux fichiers reste tenu", () => {
      for (const [chemin] of EXEMPTIONS) {
        const f = FICHIERS.find((x) => x.chemin === chemin);
        expect(f, chemin).toBeDefined();
        const fautifsHorsExemption = (f?.lignes ?? []).filter(
          (ligne) =>
            MOTIF_TAILLE.test(ligne) &&
            !MOTIF_POIDS_FORT.test(ligne) &&
            !estExempte(chemin, ligne),
        );
        expect(fautifsHorsExemption).toEqual([]);
      }
    });

    it("chaque entrée de la liste d'exemption existe réellement dans le fichier qu'elle nomme", () => {
      for (const [chemin, ligneExemptee] of EXEMPTIONS) {
        const f = FICHIERS.find((x) => x.chemin === chemin);
        expect(f, chemin).toBeDefined();
        expect(
          f?.lignes.some((ligne) => ligne.trim().endsWith(ligneExemptee)),
          `${chemin} ne porte plus la ligne exemptée — l'exemption ne protège plus rien`,
        ).toBe(true);
      }
    });

    it("reconnaît la forme qu'il refuse", () => {
      const ligne = 'className="text-12 font-normal"';
      expect(MOTIF_TAILLE.test(ligne) && !MOTIF_POIDS_FORT.test(ligne)).toBe(
        true,
      );
    });
  });
});
