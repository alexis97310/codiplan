import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  entreesDuSommaire,
  FORME_LIGNE,
  repertoiresAvecLigne,
  SEUIL_LIGNES_SOMMAIRE,
  titresDuCorps,
} from "../../../scripts/lib/sommaires";

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

/**
 * Gardien de la NAVIGATION dans la constitution — DOC-1, 22/09/2026.
 *
 * **Ce qu'il fallait constater d'abord.** Le noyau prescrit « le §9
 * intégralement », « le §6 intégralement » : deux fichiers de rang 1 sur trois
 * n'ont AUCUN titre interne — deux, pour 386 et 1 125 lignes — si bien qu'une
 * session qui cherche une règle précise n'a pas d'autre choix que de charger le
 * fichier ENTIER. `invariants.md` montre la forme qui marche : 13 titres pour
 * 219 lignes, et on l'ouvre à l'endroit utile.
 *
 * **Le seuil n'est pas inventé, il se lit sur l'état mesuré le 22/09/2026** :
 * posé à 250 lignes, il laisse passer `invariants.md` (219) et les trois
 * fichiers courts (24, 21, 17) SANS qu'on y touche, et il retient les deux
 * fautifs (386 et 1 125) — c'est la marge la plus étroite qui obtient ce
 * partage-là, pas un chiffre rond choisi après coup.
 *
 * **DEUX FORMES, PAS UNE, et la seconde est une contrainte découverte en
 * écrivant ce ticket.** `erreurs-a-ne-pas-refaire.md` porte un titre `### `
 * par entrée datée : rien ne s'y oppose, chaque entrée est un bloc de prose
 * indépendant. `organisation-du-code.md` ne peut PAS recevoir de titres à
 * l'intérieur de son arbre : `tests/unit/docs/organisation-du-code.test.ts`
 * (hors territoire de ce ticket) lit l'arborescence en entier comme UN SEUL
 * bloc de code — `/## 6\. Organisation du code[\s\S]*?```([\s\S]*?)```/` — et
 * scinder ce bloc lui aurait fait perdre `lib/` dès le premier titre inséré.
 * Son sommaire pointe donc par NUMÉRO DE LIGNE plutôt que par titre — la
 * seule forme de renvoi qui ne touche pas au bloc.
 *
 * **Dans les deux formes, le SOMMAIRE et le CORPS sont deux écritures d'une
 * même chose**, comme les dix invariants ci-dessus le sont entre le noyau et
 * `invariants.md` — même famille de gardien, un cran plus bas : la POPULATION
 * vient des deux côtés, et aucun des deux ne recopie l'autre à la main. Un
 * titre renommé — ou une ligne qui a bougé — d'un côté sans l'autre rougit.
 *
 * **DOC-2 (23/09/2026) a déplacé `titresDuCorps`, `entreesDuSommaire` et
 * `repertoiresAvecLigne` dans `scripts/lib/sommaires.ts`** : le script de
 * régénération (`scripts/regenerer-sommaires.mts`) en a besoin lui aussi, et
 * les garder deux fois aurait recréé exactement le défaut que ce fichier
 * dénonce plus haut — deux lectures d'un même critère qui divergent en
 * silence. Ce gardien les IMPORTE désormais ; il ne les définit plus.
 */

/** Les fichiers de `docs/constitution/` que le seuil de navigabilité astreint. */
export function fichiersATitrer(): string[] {
  return fichiersSurLeDisque().filter((fichier) => {
    const lignes = readFileSync(join(RACINE, fichier), "utf8").split("\n");
    return lignes.length > SEUIL_LIGNES_SOMMAIRE;
  });
}

describe("les fichiers longs de la constitution s'ouvrent à l'endroit utile (DOC-1)", () => {
  const cibles = fichiersATitrer();

  it("la population n'est pas vide — sinon la règle ne s'exerce sur rien", () => {
    expect(cibles.length).toBeGreaterThanOrEqual(2);
  });

  it("les fichiers déjà navigables ne sont pas requis de se restructurer", () => {
    // invariants.md (219 lignes, 13 titres) et les trois fichiers courts
    // passent SANS modification : c'est la condition posée au seuil lui-même.
    for (const epargne of [
      "docs/constitution/invariants.md",
      "docs/constitution/comment-travailler.md",
      "docs/constitution/sources.md",
      "docs/constitution/stack.md",
    ]) {
      expect(cibles).not.toContain(epargne);
    }
  });

  it.each(cibles)(
    "%s porte un sommaire, et il s'accorde au corps dans les deux sens",
    (fichier) => {
      const texte = readFileSync(join(RACINE, fichier), "utf8");
      expect(
        texte,
        `${fichier} dépasse ${SEUIL_LIGNES_SOMMAIRE} lignes sans « ### Sommaire »`,
      ).toContain("### Sommaire");

      const entrees = entreesDuSommaire(texte);
      expect(entrees.length, `${fichier} : sommaire vide`).toBeGreaterThan(0);

      // La FORME du sommaire décide comment on le confronte au corps — cf.
      // le commentaire de ce gardien sur les deux formes et leur raison.
      const parLigne = entrees.every((e) => FORME_LIGNE.test(e));

      const attendues = parLigne
        ? repertoiresAvecLigne(texte).map((r) => `\`${r.chemin}\` — ligne ${r.ligne}`)
        : titresDuCorps(texte);
      expect(
        attendues.length,
        `${fichier} : aucun titre ni répertoire trouvé dans le corps`,
      ).toBeGreaterThan(0);

      const orphelins = attendues.filter((a) => !entrees.includes(a));
      expect(
        orphelins,
        `${fichier} : absents du sommaire — ${orphelins.join(" / ")}`,
      ).toEqual([]);

      const fantomes = entrees.filter((e) => !attendues.includes(e));
      expect(
        fantomes,
        `${fichier} : le sommaire pointe dans le vide — ${fantomes.join(" / ")}`,
      ).toEqual([]);
    },
  );
});

describe("ÉPREUVE — le sommaire à TITRES et le corps divergent (DOC-1)", () => {
  const fichier = "docs/constitution/erreurs-a-ne-pas-refaire.md";
  const texte = readFileSync(join(RACINE, fichier), "utf8");
  const premierTitre = titresDuCorps(texte)[0] ?? "";

  it("population non vide, sinon l'épreuve ne mettrait rien à l'échec", () => {
    expect(premierTitre.length).toBeGreaterThan(0);
  });

  it("un titre retiré du corps est vu comme orphelin du sommaire", () => {
    // On met en échec le VERROU visé, pas un voisin (§9, 24/08) : seule la
    // ligne de titre disparaît, l'entrée elle-même reste intacte en dessous.
    const mutant = texte.replace(`### ${premierTitre}\n\n`, "");
    expect(mutant).not.toEqual(texte);

    const titres = titresDuCorps(mutant);
    const entrees = entreesDuSommaire(mutant);
    expect(entrees.filter((e) => !titres.includes(e))).toEqual([premierTitre]);
  });

  it("une entrée ajoutée au sommaire sans titre réel est vue comme fantôme", () => {
    const mutant = texte.replace(
      "### Sommaire\n\n- ",
      "### Sommaire\n\n- UN TITRE QUI N'EXISTE NULLE PART\n- ",
    );
    const titres = titresDuCorps(mutant);
    const entrees = entreesDuSommaire(mutant);
    expect(entrees.filter((e) => !titres.includes(e))).toEqual([
      "UN TITRE QUI N'EXISTE NULLE PART",
    ]);
  });

  it("ET IL RESTE VERT POUR SA PROPRE RAISON — sur le fichier réel, non modifié", () => {
    const titres = titresDuCorps(texte);
    const entrees = entreesDuSommaire(texte);
    expect(titres.filter((t) => !entrees.includes(t))).toEqual([]);
    expect(entrees.filter((e) => !titres.includes(e))).toEqual([]);
  });
});

describe("ÉPREUVE — le sommaire à LIGNES et l'arbre divergent (DOC-1)", () => {
  const fichier = "docs/constitution/organisation-du-code.md";
  const texte = readFileSync(join(RACINE, fichier), "utf8");

  function attenduesDe(t: string): string[] {
    return repertoiresAvecLigne(t).map((r) => `\`${r.chemin}\` — ligne ${r.ligne}`);
  }

  it("un numéro de ligne faussé au sommaire est vu dans les deux sens", () => {
    const mutant = texte.replace("`lib/db/` — ligne 68", "`lib/db/` — ligne 69");
    expect(mutant).not.toEqual(texte);

    const attendues = attenduesDe(mutant);
    const entrees = entreesDuSommaire(mutant);
    // Fantôme : le sommaire pointe vers une ligne que l'arbre ne tient pas.
    expect(entrees.filter((e) => !attendues.includes(e))).toEqual([
      "`lib/db/` — ligne 69",
    ]);
    // Orphelin : la vraie ligne 68 n'a plus son entrée.
    expect(attendues.filter((a) => !entrees.includes(a))).toEqual([
      "`lib/db/` — ligne 68",
    ]);
  });

  it("un répertoire renommé dans l'arbre laisse son ancienne entrée fantôme", () => {
    const mutant = texte.replace(
      "  auth/       authentification",
      "  authx/      authentification",
    );
    expect(mutant).not.toEqual(texte);

    const attendues = attenduesDe(mutant);
    const entrees = entreesDuSommaire(mutant);
    expect(entrees.filter((e) => !attendues.includes(e))).toEqual([
      "`lib/auth/` — ligne 114",
    ]);
    expect(attendues.filter((a) => !entrees.includes(a))).toEqual([
      "`lib/authx/` — ligne 114",
    ]);
  });

  it("ET IL RESTE VERT POUR SA PROPRE RAISON — sur le fichier réel, non modifié", () => {
    const attendues = attenduesDe(texte);
    const entrees = entreesDuSommaire(texte);
    expect(attendues.filter((a) => !entrees.includes(a))).toEqual([]);
    expect(entrees.filter((e) => !attendues.includes(e))).toEqual([]);
  });
});
