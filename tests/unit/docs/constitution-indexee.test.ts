import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Gardien de l'INDEX de la constitution — AT-05, 16/09/2026.
 *
 * **Pourquoi il existe.** Le `CLAUDE.md` pesait 259 245 octets, lus à chaque
 * démarrage de session. Il a été scindé : un noyau, et `docs/constitution/` qui
 * porte le reste **mot pour mot et au même rang**. La scission crée aussitôt un
 * mode de défaillance que le fichier unique n'avait pas — *un fichier que le
 * noyau ne nomme pas est un fichier que personne n'ouvrira jamais.* Il ne
 * disparaît pas, il ne rougit pas : il cesse simplement d'être lu, et la règle
 * qu'il porte meurt sans que rien ne le dise. C'est le silence du §9 (31/08),
 * appliqué non plus à une alarme mais à un texte de rang 1.
 *
 * **LES DEUX SENS SONT GARDÉS, et le second est celui qu'on oublie.**
 *
 *   1. tout fichier de `docs/constitution/` est nommé par l'index du noyau —
 *      sinon il est orphelin ;
 *   2. tout fichier que l'index nomme existe — sinon l'index envoie dans le
 *      vide, et une entrée qui ne s'adosse à rien est la sélection négative
 *      pourrie du §9 (31/08).
 *
 * **La POPULATION vient des DEUX côtés, jamais d'une liste tenue à la main** —
 * le répertoire pour le premier sens, le tableau du noyau pour le second. Aucun
 * des deux ne contrôle l'autre, et c'est ce qui les rend confrontables : deux
 * listes recopiées l'une sur l'autre s'accorderaient en aveugle (§9, 10/09 —
 * *deux erreurs identiques ne se contredisent jamais*).
 *
 * ## Le troisième contrôle, et c'est lui que la scission RÉCLAME
 *
 * Le noyau énonce les dix invariants **en une ligne chacun**, alors que leur
 * texte entier vit dans `invariants.md`. Ce sont deux écritures d'une même
 * chose, et le §9 (01/09) est formel : *deux lectures d'un même critère
 * divergent en silence, parce qu'aucune des deux ne prétend être l'autre.* La
 * question qu'il impose de poser est « **qu'est-ce qui les confronterait ?** ».
 *
 * Ici : le TITRE. Chaque ligne du tableau du noyau doit retrouver, à
 * l'identique, sa section `### In — Titre` dans `invariants.md`. On ne peut donc
 * plus renommer un invariant d'un côté sans que l'autre rougisse. Ce que ce
 * gardien NE fait PAS, et qui est écrit plutôt que tu : il ne juge pas que la
 * ligne d'index RÉSUME fidèlement la section — aucun motif statique ne sait
 * lire cela. Il tient l'ancrage, pas le sens. C'est pourquoi le noyau écrit,
 * à côté du tableau, qu'on ne se réclame pas d'un invariant sur la foi d'une
 * ligne.
 */

const RACINE = process.cwd();
const CONSTITUTION = join(RACINE, "docs", "constitution");

/** Les fichiers réellement posés dans `docs/constitution/`. */
export function fichiersSurLeDisque(): string[] {
  return readdirSync(CONSTITUTION)
    .filter((nom) => nom.endsWith(".md"))
    .map((nom) => `docs/constitution/${nom}`)
    .sort();
}

/**
 * Les fichiers que l'INDEX du noyau nomme — et l'index seul.
 *
 * Le motif est ancré sur le début d'une ligne de tableau, pas sur une mention
 * quelconque : un fichier cité en passant dans une porte de § n'est pas un
 * fichier indexé, et le confondre rendrait le premier sens vacueux — il suffit
 * qu'un chemin traîne quelque part pour qu'il passe.
 */
export function fichiersIndexes(noyau: string): string[] {
  return [...noyau.matchAll(/^\| `(docs\/constitution\/[a-z0-9-]+\.md)` \|/gm)]
    .map((m) => m[1] ?? "")
    .sort();
}

/** Les invariants que le tableau du noyau énonce en une ligne. */
export function invariantsDuNoyau(
  noyau: string,
): { id: string; titre: string }[] {
  return [...noyau.matchAll(/^\| (I\d{1,2}) \| ([^|]+?) \| [^|]+ \|$/gm)].map(
    (m) => ({ id: m[1] ?? "", titre: (m[2] ?? "").trim() }),
  );
}

describe("la constitution scindée reste atteignable (AT-05)", () => {
  const noyau = readFileSync(join(RACINE, "CLAUDE.md"), "utf8");
  const surLeDisque = fichiersSurLeDisque();
  const indexes = fichiersIndexes(noyau);

  it("les deux populations sont peuplées — sinon l'accord ne prouve rien", () => {
    // Témoin de non-vacuité, et il est double à dessein : deux ensembles vides
    // sont égaux, et l'égalité passerait pour un sans-faute (§9, 10/09).
    expect(surLeDisque.length).toBeGreaterThanOrEqual(6);
    expect(indexes.length).toBeGreaterThanOrEqual(6);
  });

  it("aucun fichier de `docs/constitution/` n'est orphelin", () => {
    const orphelins = surLeDisque.filter((f) => !indexes.includes(f));
    expect(
      orphelins,
      `le noyau ne nomme pas ${orphelins.join(", ")} : personne ne l'ouvrira`,
    ).toEqual([]);
  });

  it("aucune entrée de l'index ne s'adosse au vide", () => {
    const fantomes = indexes.filter((f) => !surLeDisque.includes(f));
    expect(
      fantomes,
      `l'index nomme ${fantomes.join(", ")}, qui n'existe pas`,
    ).toEqual([]);
  });

  it("le texte détaché est déclaré de rang 1, et chaque fichier le redit", () => {
    // Le rang est ce qui rend la scission neutre. S'il cessait d'être écrit, le
    // détachement deviendrait une rétrogradation silencieuse.
    expect(noyau).toContain("garde le\nrang 1");
    for (const fichier of surLeDisque) {
      const texte = readFileSync(join(RACINE, fichier), "utf8");
      expect(texte, `${fichier} ne déclare pas son rang`).toContain(
        "**Source de rang 1.**",
      );
      expect(texte, `${fichier} ne dit pas qu'il est inchangé`).toContain(
        "sans qu'une ligne change",
      );
    }
  });

  it("les dix invariants du noyau retrouvent leur section, à l'identique", () => {
    const detail = readFileSync(join(CONSTITUTION, "invariants.md"), "utf8");
    const invariants = invariantsDuNoyau(noyau);

    // Témoin : dix, et pas « au moins un ». Le §3 en annonce dix depuis
    // l'origine, et un tableau amputé passerait sans cela.
    expect(invariants.map((i) => i.id)).toEqual([
      "I1", "I2", "I3", "I4", "I5", "I6", "I7", "I8", "I9", "I10",
    ]);

    const absents = invariants
      .map(({ id, titre }) => `### ${id} — ${titre}`)
      .filter((entete) => !detail.includes(entete));
    expect(
      absents,
      `le noyau et invariants.md ont divergé sur : ${absents.join(" / ")}`,
    ).toEqual([]);
  });

  it("le noyau reste un noyau — c'est tout l'objet du ticket", () => {
    // AT-05 a ramené 259 245 octets à ~20 700. Sans plafond, le noyau regrossit
    // ticket après ticket et la scission se défait sans que rien ne rougisse —
    // la panne EST la lente reprise de poids, pas un franchissement brutal.
    // Le plafond est donc posé près de l'état mesuré, pas au double : un
    // plafond large ne mesure rien et se lit comme une autorisation.
    const octets = Buffer.byteLength(noyau, "utf8");
    expect(
      octets,
      `le noyau pèse ${octets} octets : ce qui a grossi doit-il être ici, ou ` +
        `dans docs/constitution/ ?`,
    ).toBeLessThan(24_000);
  });
});

describe("ÉPREUVES — le gardien mord là où la faute se commettrait", () => {
  const noyau = readFileSync(join(RACINE, "CLAUDE.md"), "utf8");

  it("un fichier ajouté sans entrée d'index est vu comme orphelin", () => {
    const disque = [...fichiersSurLeDisque(), "docs/constitution/nouveau.md"];
    expect(disque.filter((f) => !fichiersIndexes(noyau).includes(f))).toEqual([
      "docs/constitution/nouveau.md",
    ]);
  });

  it("une entrée d'index dont le fichier a disparu est vue comme fantôme", () => {
    const ampute = fichiersSurLeDisque().filter(
      (f) => f !== "docs/constitution/stack.md",
    );
    expect(fichiersIndexes(noyau).filter((f) => !ampute.includes(f))).toEqual([
      "docs/constitution/stack.md",
    ]);
  });

  it("un invariant renommé d'un seul côté est vu", () => {
    const renomme = noyau.replace(
      "| I8 | Traçabilité |",
      "| I8 | Tracabilite |",
    );
    const detail = readFileSync(join(CONSTITUTION, "invariants.md"), "utf8");
    const absents = invariantsDuNoyau(renomme)
      .map(({ id, titre }) => `### ${id} — ${titre}`)
      .filter((entete) => !detail.includes(entete));

    expect(absents).toEqual(["### I8 — Tracabilite"]);
  });

  it("ET IL RESTE VERT POUR SA PROPRE RAISON — le §9 du 11/09", () => {
    // La direction permissive, celle qui ne produit aucun signal. Un motif qui
    // trouverait « ### I8 » n'importe où — dans une prose qui le cite, dans le
    // noyau lui-même — passerait ici pour une mauvaise raison. On vérifie donc
    // qu'un titre VOISIN et FAUX est bien absent, à côté du vrai qui est là.
    const detail = readFileSync(join(CONSTITUTION, "invariants.md"), "utf8");
    expect(detail).toContain("### I8 — Traçabilité");
    expect(detail).not.toContain("### I8 — Traçabilité des accès");
    expect(detail).toContain("### I1 — Cloisonnement multi-société");
    expect(detail).not.toContain("### I1 — Cloisonnement multi-agence");
  });
});
