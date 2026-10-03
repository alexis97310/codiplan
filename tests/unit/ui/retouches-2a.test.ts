import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * LES GARDE-FOUS DES RETOUCHES TYPOGRAPHIQUES DU 30/09/2026 (D143,
 * `docs/arbitrages.md`, ticket 9CG-RETOUCHES-2A-TYPO) — un par point de la
 * décision, chacun lisant TOUS les `.tsx` de `app/` et `components/` : la
 * population vient du dépôt, jamais d'une recopie de la liste mesurée en
 * passation.
 *
 * Le plancher étendu rejoint ce fichier à un commit suivant du même ticket —
 * jamais retiré, seulement ajouté.
 */

const FICHIERS = fichiersSource(["app", "components"], [".tsx"]).map((f) => ({
  chemin: f.chemin,
  // `accept="image/*"` (`terrain/[id]/page.tsx`) ouvre un faux commentaire
  // de bloc pour `sansCommentaires` — elle cherche le PROCHAIN fermant,
  // bien plus bas dans le fichier, et avale tout ce qui se trouve entre les
  // deux. Inoffensif pour les gardiens qui ne cherchent qu'une classe (une
  // classe fautive avalée resterait fautive plus loin), mais faux pour un
  // gardien qui COMPTE des blocs (`<Button>`) : le contenu brut sert alors.
  brut: f.contenu,
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

  describe("point 8 — le texte du terrain à 16 px", () => {
    const FICHIERS_TERRAIN = [
      "app/(mobile)/terrain/page.tsx",
      "app/(mobile)/terrain/[id]/page.tsx",
      "components/interventions/signature-terrain.tsx",
    ];
    const TAILLES_TERRAIN = [16, 18, 24, 28];
    const MOTIF_TAILLE_NOMMEE = /\btext-(\d+)\b/g;
    const MOTIF_TAILLE_ARBITRAIRE = /text-\[([0-9.]+)px\]/g;
    /** Surtitre (`uppercase`) ou pastille (`rounded-full`) : rang « plus petit texte », 12 px (point 11). */
    const EST_SURTITRE_OU_PASTILLE = /uppercase|rounded-full/;

    it("chaque fichier du terrain existe encore — le témoin de non-vacuité", () => {
      for (const chemin of FICHIERS_TERRAIN) {
        expect(
          FICHIERS.some((f) => f.chemin === chemin),
          chemin,
        ).toBe(true);
      }
    });

    it("dans les 3 fichiers du terrain, toute taille est 16/18/24/28 px, sauf un surtitre ou une pastille", () => {
      // Contenu BRUT, jamais `sansCommentaires` : `accept="image/*"`
      // (`terrain/[id]/page.tsx`) ouvre un faux commentaire de bloc pour
      // cette dernière, qui avalerait plusieurs classes réelles plus bas
      // dans le fichier. Aucun de ces trois fichiers ne cite une classe
      // `text-…` dans un commentaire — vérifié ci-dessus par construction.
      const fautifs: string[] = [];
      for (const chemin of FICHIERS_TERRAIN) {
        const f = FICHIERS.find((x) => x.chemin === chemin);
        for (const ligne of f?.brut.split("\n") ?? []) {
          if (EST_SURTITRE_OU_PASTILLE.test(ligne)) {
            continue;
          }
          for (const m of ligne.matchAll(MOTIF_TAILLE_NOMMEE)) {
            if (!TAILLES_TERRAIN.includes(Number(m[1]))) {
              fautifs.push(`${chemin}: text-${m[1]}`);
            }
          }
          for (const m of ligne.matchAll(MOTIF_TAILLE_ARBITRAIRE)) {
            if (!TAILLES_TERRAIN.includes(Number(m[1]))) {
              fautifs.push(`${chemin}: text-[${m[1]}px]`);
            }
          }
        }
      }
      expect(fautifs).toEqual([]);
    });

    it("reconnaît la forme qu'il refuse", () => {
      const ligne = 'className="text-13 font-bold"';
      expect(
        !EST_SURTITRE_OU_PASTILLE.test(ligne) &&
          [...ligne.matchAll(MOTIF_TAILLE_NOMMEE)].some(
            (m) => !TAILLES_TERRAIN.includes(Number(m[1])),
          ),
      ).toBe(true);
    });

    it("un surtitre ou une pastille à 12 px n'est pas signalé", () => {
      const ligne = 'className="text-12 font-bold uppercase"';
      expect(EST_SURTITRE_OU_PASTILLE.test(ligne)).toBe(true);
    });

    it("app/(mobile)/layout.tsx porte text-16 — le texte sans classe hérite 16 px", () => {
      const layout = FICHIERS.find(
        (f) => f.chemin === "app/(mobile)/layout.tsx",
      );
      expect(layout).toBeDefined();
      expect(layout?.lignes.some((ligne) => ligne.includes("text-16"))).toBe(
        true,
      );
    });

    it("chaque <Button des 3 fichiers du terrain porte text-16 — 11 au total (constat du 30/09/2026, étendu par 9DE-TP-CY1 : signature à trois issues et « Terminer »)", () => {
      let total = 0;
      for (const chemin of FICHIERS_TERRAIN) {
        const f = FICHIERS.find((x) => x.chemin === chemin);
        const contenu = f?.brut ?? "";
        // Un `<Button` peut s'écrire sur plusieurs lignes (attributs
        // multiples) : chaque bloc, de `<Button` à `>`, doit porter
        // `text-16` quelque part dedans. `terrain/page.tsx` n'en porte
        // aucun — ce n'est pas une carte de forme.
        const blocs = contenu.match(/<Button\b[\s\S]*?>/g) ?? [];
        total += blocs.length;
        for (const bloc of blocs) {
          expect(bloc, `${chemin} : ${bloc.replace(/\s+/g, " ")}`).toContain(
            "text-16",
          );
        }
      }
      expect(total).toBe(11);
    });
  });

  describe("plancher — zéro texte sous 12 px, partout (D138)", () => {
    // Même regex que `plancher-12-pages.test.ts` (9, 9.5, 10, 10.5, 11,
    // 11.5 px) mais sur TOUT `app/` et `components/`, jamais une liste
    // explicite : celle-ci reste utile pour son propre message d'erreur
    // (« la ligne exacte »), celle-ci pour n'avoir jamais de trou.
    const MOTIF = /text-\[(9|1[01])(\.[0-9])?px\]/;

    it("zéro occurrence dans app/ et components/", () => {
      const fautifs = FICHIERS.filter((f) =>
        f.lignes.some((ligne) => MOTIF.test(ligne)),
      ).map((f) => f.chemin);
      expect(fautifs).toEqual([]);
    });

    it("reconnaît la forme qu'il refuse", () => {
      expect(MOTIF.test('className="text-[11.5px]"')).toBe(true);
    });

    it("mais pas 12 px, la valeur du plancher lui-même", () => {
      expect(MOTIF.test('className="text-[12px]"')).toBe(false);
    });
  });
});
