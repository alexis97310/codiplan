import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * R2-16 — LA BARRE DE NAVIGATION NE COIFFE PAS LES ÉCRANS SANS SESSION.
 *
 * ## Ce que ce gardien regarde, et pourquoi pas une liste de chemins
 *
 * L'acceptation du ticket l'écrit : *la règle est portée par la mise en page du
 * segment et non par une liste de chemins tenue à la main — une liste
 * oublierait le prochain écran d'authentification.* Le gardien suit la même
 * discipline : **sa population est DÉRIVÉE du répertoire `app/`**, page par
 * page, et un écran écrit dans six mois y entre le jour où son fichier
 * apparaît (même forme que le gardien d'exhaustivité de D41).
 *
 * Pour chaque page, il remonte la chaîne de ses mises en page jusqu'à la racine
 * — c'est ce que Next fait à l'exécution — et constate si l'une d'elles rend la
 * barre. Il ne lit donc pas une intention, il lit **l'état final**, quel que
 * soit le fichier qui l'installe (§9, 26/08, forme 3).
 *
 * ## Les deux directions, et la seconde est celle qu'on oublie
 *
 * Un gardien est un prédicat à deux directions : *il rougit quand il doit* et
 * *il ne reste vert que quand il le doit* (§9, 11/09). Une mise en échec
 * n'éprouve que la première. Ici la paire est écrite : `/connexion` ne porte
 * PAS la barre et `/arrivee` la porte — si la remontée de chaîne se trompait de
 * répertoire, ou rendait toujours `false`, la seconde moitié tomberait.
 *
 * ## Ce qu'il ne prétend pas
 *
 * Il ne dit rien du CLOISONNEMENT. La barre n'a jamais été un contrôle d'accès
 * (`lib/navigation/entrees.ts`), et un écran d'après-session reste défendu par
 * ses politiques et par `exigerContexteActif`, jamais par le groupe de routes
 * qui l'héberge.
 */

const RACINE_APP = join(process.cwd(), "app");

/**
 * Les trois segments, et ce que chacun décide. **Liste close** : une page qui
 * n'habiterait aucun d'eux fait échouer le gardien plutôt que de recevoir un
 * régime par défaut — un défaut silencieux est ce qui a produit R2-16.
 */
const SEGMENTS = {
  "(sans-session)": { barre: false, entrees: null },
  "(back-office)": { barre: true, entrees: "ENTREES" },
  // D97 — le portail a SA barre. *Il recevait celle du back-office, et rien ne
  // pouvait le dire : les deux rendaient bien `<BarreDeNavigation`.* C'est le
  // sens silencieux de ce gardien, et c'est celui qu'on oublie — un segment
  // qui reprendrait la liste du back-office continuerait de passer la
  // vérification ci-dessus, qui ne regarde que la PRÉSENCE de la barre.
  "(portail)": { barre: true, entrees: "ENTREES_PORTAIL" },
} as const;

type NomDeSegment = keyof typeof SEGMENTS;

/** Le répertoire `api/` n'a pas de page : on ne l'explore pas. */
const HORS_PERIMETRE = new Set(["api"]);

function pagesDuRepertoire(repertoire: string): readonly string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(repertoire)) {
    const chemin = join(repertoire, entree);
    if (statSync(chemin).isDirectory()) {
      if (HORS_PERIMETRE.has(entree)) {
        continue;
      }
      trouvees.push(...pagesDuRepertoire(chemin));
    } else if (entree === "page.tsx") {
      trouvees.push(chemin);
    }
  }
  return trouvees;
}

/** La marque d'une mise en page qui rend la barre. */
function rendLaBarre(cheminDeMiseEnPage: string): boolean {
  return readFileSync(cheminDeMiseEnPage, "utf8").includes(
    "<BarreDeNavigation",
  );
}

/**
 * La chaîne des mises en page au-dessus d'une page, de la plus proche à la
 * racine — exactement ce que Next empile à l'exécution.
 */
function chaineDeMisesEnPage(cheminDePage: string): readonly string[] {
  const chaine: string[] = [];
  let repertoire = dirname(cheminDePage);
  for (;;) {
    const miseEnPage = join(repertoire, "layout.tsx");
    try {
      statSync(miseEnPage);
      chaine.push(miseEnPage);
    } catch {
      // Un segment sans mise en page propre : Next remonte, nous aussi.
    }
    if (repertoire === RACINE_APP) {
      return chaine;
    }
    repertoire = dirname(repertoire);
  }
}

/** Le groupe de routes qui héberge la page, ou `null` s'il n'y en a aucun. */
function segmentDe(cheminDePage: string): NomDeSegment | null {
  for (const morceau of relative(RACINE_APP, cheminDePage).split(sep)) {
    if (morceau in SEGMENTS) {
      return morceau as NomDeSegment;
    }
  }
  return null;
}

const PAGES = pagesDuRepertoire(RACINE_APP);

describe("la barre de navigation est portée par le segment (R2-16)", () => {
  it("observe des pages — sans quoi tout ce qui suit ne mesure rien", () => {
    // Témoin de non-vacuité : un décompte nul ressemble à un sans-faute.
    expect(PAGES.length).toBeGreaterThanOrEqual(10);
  });

  it("la mise en page RACINE ne rend pas la barre", () => {
    // C'est la faute exacte de D95 : posée là, elle coiffe tout, y compris les
    // six écrans qui précèdent la session.
    expect(rendLaBarre(join(RACINE_APP, "layout.tsx"))).toBe(false);
  });

  it("chaque page habite exactement un des trois segments", () => {
    const orphelines = PAGES.filter((page) => segmentDe(page) === null).map(
      (page) => relative(process.cwd(), page),
    );
    expect(orphelines).toEqual([]);
  });

  it("chaque segment déclaré héberge au moins une page", () => {
    // Une entrée de liste close qui ne s'adosse à rien n'exempte plus personne
    // et ne rougit jamais (§9, 31/08).
    for (const nom of Object.keys(SEGMENTS)) {
      expect(
        PAGES.filter((page) => segmentDe(page) === nom).length,
        `le segment ${nom} n'héberge aucune page`,
      ).toBeGreaterThan(0);
    }
  });

  it("la barre suit le segment, page par page", () => {
    const ecarts = PAGES.map((page) => {
      const segment = segmentDe(page);
      if (segment === null) {
        return null;
      }
      const porte = chaineDeMisesEnPage(page).some(rendLaBarre);
      return porte === SEGMENTS[segment].barre
        ? null
        : `${relative(process.cwd(), page)} — segment ${segment}, barre ${porte ? "rendue" : "absente"}`;
    }).filter((ecart): ecart is string => ecart !== null);

    expect(ecarts).toEqual([]);
  });

  it("chaque segment passe SES entrées, et non celles du voisin", () => {
    const ecarts = PAGES.map((page) => {
      const segment = segmentDe(page);
      if (segment === null) return null;
      const attendues = SEGMENTS[segment].entrees;
      if (attendues === null) return null;
      const miseEnPage = chaineDeMisesEnPage(page).find(rendLaBarre);
      if (miseEnPage === undefined) {
        return `${relative(process.cwd(), page)} — aucune mise en page ne rend la barre`;
      }
      const texte = readFileSync(miseEnPage, "utf8");
      return texte.includes(`entrees={${attendues}}`)
        ? null
        : `${relative(process.cwd(), miseEnPage)} — attendu entrees={${attendues}}`;
    }).filter((ecart): ecart is string => ecart !== null);

    expect(ecarts).toEqual([]);
  });

  it("les deux segments à barre ne passent PAS la même liste", () => {
    // Le témoin de la vérification ci-dessus : si les deux attendus étaient le
    // même nom, elle serait satisfaite par la faute même qu'elle surveille.
    const listes: string[] = Object.values(SEGMENTS)
      .map((segment): string | null => segment.entrees)
      .filter((nom): nom is string => nom !== null);
    expect(new Set(listes).size).toBe(listes.length);
    expect(listes.length).toBeGreaterThan(1);
  });

  it("la paire qui prouve que la remontée distingue vraiment", () => {
    // Le cas qui doit rougir, et le cas qui doit rester vert POUR SA PROPRE
    // RAISON (§9, 11/09). Sans le second, une remontée qui rendrait toujours
    // « pas de barre » passerait tous les tests ci-dessus.
    const connexion = join(
      RACINE_APP,
      "(sans-session)",
      "connexion",
      "page.tsx",
    );
    const arrivee = join(RACINE_APP, "(back-office)", "arrivee", "page.tsx");

    expect(chaineDeMisesEnPage(connexion).some(rendLaBarre)).toBe(false);
    expect(chaineDeMisesEnPage(arrivee).some(rendLaBarre)).toBe(true);
  });
});
