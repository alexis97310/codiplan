import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RACINE } from "../outils/fichiers-source";

/**
 * LES COURRIELS DE CONNEXION RESTENT EN TEXTE SEUL, POUR TOUJOURS (D207,
 * 9EZ-LOGO-SOCIETE-2 ; resserré 9EZ-LOGO-SOCIETE-4-COURRIELS-SOLDE, point 3).
 *
 * Q8 amendée (D207, `lib/courriel/message.ts`) ouvre `CourrielMetier` aux
 * SEULS courriels métier. Les trois modules qui composent un courriel de
 * CONNEXION — premier accès, nouveau lien (D204), réinitialisation — ne
 * doivent JAMAIS emprunter cette porte : un gardien statique plutôt qu'une
 * relecture, parce qu'un import oublié ne se voit pas à l'écran d'un
 * courriel qui part quand même en texte.
 *
 * **Resserré (point 3)** — la première version ne reconnaissait que
 * `CourrielMetier`, `envoyerCourrielMetier` et `miseEnPage` : elle manquait
 * `construireCourrielMetier` et `miseEnPageMetier` (aucune frontière de mot
 * entre `miseEnPage` et `Metier`, donc `\bmiseEnPage\b` ne les voyait pas),
 * tout export emprunté au module du gabarit métier par un chemin d'import
 * différent, et les clés littérales `html`/`attachments` que
 * `lib/courriel/resend.ts` envoie au prestataire pour un courriel MÉTIER
 * seul — leur présence dans un fichier de connexion serait la même fuite,
 * recomposée à la main plutôt qu'importée.
 */

const FICHIERS_CONNEXION = [
  join(RACINE, "lib", "courriel", "premier-acces.ts"),
  join(RACINE, "lib", "auth", "lien-d-acces.ts"),
  join(RACINE, "lib", "auth", "config.ts"),
];

/** Les motifs fermés qu'un fichier de connexion ne doit jamais porter. */
const MOTIFS_METIER: ReadonlyArray<{
  readonly nom: string;
  readonly motif: RegExp;
}> = [
  { nom: "CourrielMetier", motif: /\bCourrielMetier\b/ },
  { nom: "envoyerCourrielMetier", motif: /\benvoyerCourrielMetier\b/ },
  { nom: "construireCourrielMetier", motif: /\bconstruireCourrielMetier\b/ },
  { nom: "miseEnPageMetier", motif: /\bmiseEnPageMetier\b/ },
  { nom: "miseEnPage", motif: /\bmiseEnPage\b/ },
  {
    nom: "import depuis le gabarit métier",
    motif: /from\s+["']@\/lib\/courriel\/gabarit-metier["']/,
  },
  { nom: "clé littérale « html »", motif: /[{,]\s*html\s*:/ },
  { nom: "clé littérale « attachments »", motif: /[{,]\s*attachments\s*:/ },
];

/** Les motifs fermés trouvés dans `source` — vide si aucun. */
function violationsMetier(source: string): readonly string[] {
  return MOTIFS_METIER.filter(({ motif }) => motif.test(source)).map(
    ({ nom }) => nom,
  );
}

describe("les modules de connexion n'empruntent jamais la porte métier", () => {
  it("la population n'est pas vide", () => {
    expect(FICHIERS_CONNEXION.length).toBe(3);
  });

  for (const fichier of FICHIERS_CONNEXION) {
    it(`${fichier.split("/").slice(-2).join("/")} ne porte aucun motif métier`, () => {
      const source = readFileSync(fichier, "utf8");
      expect(violationsMetier(source)).toEqual([]);
    });
  }

  it("le gardien ROUGIT réellement sur chacun des motifs resserrés", () => {
    // Témoin : un gardien élargi sans preuve qu'il mord serait un gardien
    // qu'on croit tenir (§9). Chaque motif ajouté par ce resserrement est
    // confronté à un extrait qui le porte, jamais seulement déclaré.
    const temoins: Record<string, string> = {
      construireCourrielMetier:
        'import { construireCourrielMetier } from "@/lib/courriel/gabarit-metier";',
      miseEnPageMetier:
        'import { miseEnPageMetier } from "@/lib/courriel/gabarit-metier";',
      "import depuis le gabarit métier":
        'import type { LogoPourCourriel } from "@/lib/courriel/gabarit-metier";',
      "clé littérale « html »": "const corps = { to, subject, html: page };",
      "clé littérale « attachments »":
        "const corps = { to, subject, attachments: [piece] };",
    };
    for (const [nom, extrait] of Object.entries(temoins)) {
      expect(
        violationsMetier(extrait),
        `« ${nom} » n'a pas fait rougir le gardien`,
      ).toContain(nom);
    }
  });

  it("le gardien ne rougit pas sur un courriel de connexion ordinaire, en texte seul", () => {
    const licite = [
      'import { envoyerCourriel } from "@/lib/courriel";',
      'import { t } from "@/lib/i18n/fr";',
      "const texte = `Bonjour ${nom}, voici votre lien.`;",
      "const corps = { to, subject, text: texte };",
    ].join("\n");
    expect(violationsMetier(licite)).toEqual([]);
  });
});
