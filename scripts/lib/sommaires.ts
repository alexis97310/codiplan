/**
 * Lecture ET régénération des sommaires de la documentation — une seule
 * implémentation, partagée entre le gardien qui les confronte au corps
 * (`tests/unit/docs/constitution-indexee.test.ts`,
 * `tests/unit/docs/readme-indexe.test.ts`) et le script qui les recalcule
 * (`scripts/regenerer-sommaires.mts`, DOC-2, 23/09/2026).
 *
 * DOC-1 (22/09/2026) avait écrit cette logique deux fois — une fois dans le
 * gardien, jamais dans un script de régénération, qu'il a nommé comme manquant
 * dans sa passation. L'écrire ici, un seul endroit, évite d'emblée le défaut
 * que le §9 du 01/09/2026 nomme : deux lectures d'un même critère divergent en
 * silence, parce qu'aucune des deux ne prétend être l'autre.
 */

/** Seuil de navigabilité (DOC-1, mesuré le 22/09/2026) : au-delà, un fichier exige un sommaire. */
export const SEUIL_LIGNES_SOMMAIRE = 250;

/** Bornes du sommaire : `[début des entrées, fin (le premier "---" qui suit))`. */
export function bornesDuSommaire(
  lignes: string[],
  marqueur = "### Sommaire",
): [number, number] | null {
  const debut = lignes.findIndex((l) => l.trim() === marqueur);
  if (debut === -1) return null;
  const fin = lignes.findIndex((l, idx) => idx > debut && l.trim() === "---");
  return [debut + 1, fin === -1 ? lignes.length : fin];
}

/** Les titres de troisième et quatrième rang portés APRÈS le sommaire (formes à titres). */
export function titresDuCorps(
  texte: string,
  marqueur = "### Sommaire",
  niveaux: [number, number] = [3, 4],
): string[] {
  const lignes = texte.split("\n");
  const bornes = bornesDuSommaire(lignes, marqueur);
  const debutCorps = bornes ? bornes[1] : 0;
  const motif = new RegExp(`^#{${niveaux[0]},${niveaux[1]}} `);
  return lignes
    .slice(debutCorps)
    .filter((l) => motif.test(l))
    .map((l) => l.replace(/^#+\s+/, "").trim());
}

/** Les entrées `- texte` que le sommaire énonce, dans l'ordre où il les énonce. */
export function entreesDuSommaire(
  texte: string,
  marqueur = "### Sommaire",
): string[] {
  const lignes = texte.split("\n");
  const bornes = bornesDuSommaire(lignes, marqueur);
  if (!bornes) return [];
  const [debut, fin] = bornes;
  return lignes
    .slice(debut, fin)
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

/** Une entrée de sommaire par NUMÉRO DE LIGNE : `` `chemin/` — ligne N `` (forme à lignes). */
export const FORME_LIGNE = /^(`[^`]+`) — ligne (\d+)$/;

/**
 * Les répertoires du PREMIER bloc de code du fichier, avec la ligne (1-indexée,
 * dans le fichier ENTIER) où chacun commence — dérivés du texte, jamais tenus à
 * la main. Ne descend d'un niveau que sous `lib/`, seule branche où le §6 pose
 * un répertoire par ligne — même limite que documente le parseur du gardien
 * voisin (`tests/unit/docs/organisation-du-code.test.ts`), pour la même raison.
 */
export function repertoiresAvecLigne(
  texte: string,
): { chemin: string; ligne: number }[] {
  const lignes = texte.split("\n");
  const ouverture = lignes.findIndex((l) => l.trim() === "```");
  if (ouverture === -1) return [];
  const fermeture = lignes.findIndex(
    (l, idx) => idx > ouverture && l.trim() === "```",
  );
  const bloc = lignes.slice(
    ouverture + 1,
    fermeture === -1 ? undefined : fermeture,
  );

  const resultats: { chemin: string; ligne: number }[] = [];
  let dansLib = false;
  bloc.forEach((ligne, idx) => {
    const numero = ouverture + 2 + idx;
    const sommet = /^([a-zA-Z][\w.-]*\/)/.exec(ligne);
    if (sommet) {
      const nom = sommet[1] ?? "";
      resultats.push({ chemin: nom, ligne: numero });
      dansLib = nom === "lib/";
      return;
    }
    if (dansLib) {
      const sousNiveau = /^ {2}([a-zA-Z][\w.-]*\/)/.exec(ligne);
      if (sousNiveau) {
        resultats.push({ chemin: `lib/${sousNiveau[1]}`, ligne: numero });
      } else if (/^\S/.test(ligne)) {
        dansLib = false;
      }
    }
  });
  return resultats;
}

/**
 * Remplace le CONTENU du sommaire (la ligne blanche qui suit le marqueur, puis
 * les entrées) par les entrées recalculées — tout le reste du fichier, y
 * compris une note posée AVANT le marqueur, reste octet pour octet identique.
 * Une note placée À L'INTÉRIEUR de la zone (entre le marqueur et le « --- »)
 * serait perdue : c'est pourquoi les deux documents régénérés portent leur
 * note AVANT `### Sommaire` / `## Sommaire`, jamais dedans.
 */
export function regenererBlocSommaire(
  texte: string,
  entrees: string[],
  marqueur = "### Sommaire",
): string {
  const lignes = texte.split("\n");
  const bornes = bornesDuSommaire(lignes, marqueur);
  if (!bornes) {
    throw new Error(
      `Aucun « ${marqueur} » trouvé dans le texte : rien à régénérer.`,
    );
  }
  const [debut, fin] = bornes;
  const avant = lignes.slice(0, debut);
  const apres = lignes.slice(fin);
  const bloc = ["", ...entrees.map((e) => `- ${e}`), ""];
  return [...avant, ...bloc, ...apres].join("\n");
}
