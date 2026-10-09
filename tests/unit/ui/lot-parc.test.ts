import { createElement } from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionPrimaire } from "@/components/ui/action-primaire";
import {
  FormulaireMachine,
  interpreterReponseMachine,
} from "@/components/parc/formulaire-machine";
import { fr } from "@/lib/i18n/fr";

/**
 * LE GARDIEN DU LOT PARC (AT-07 bis, 18/09/2026) — création et correction
 * d'une machine, écrit en `.ts` (pas `.tsx`) : les composants se rendent par
 * `createElement`, jamais par du JSX, pour que ce fichier reste exactement
 * celui que la consigne nomme.
 *
 * ## CE QUE CE FICHIER MESURE, ET DANS L'ORDRE OÙ ÇA A ÉTÉ MESURÉ
 *
 * 1. Le blocage n°1 du domaine : `creerMachineDans`/`modifierMachineDans`
 *    existaient et n'avaient AUCUN écran ni AUCUNE route (mesuré
 *    `grep -rn "creerMachineDans\|modifierMachineDans"` avant ce ticket :
 *    quatre fichiers, aucun sous `app/`). Les deux écrans, les deux routes et
 *    les deux fonctions de dépôt (`creerMachine`, `modifierMachine`) sont la
 *    réparation.
 * 2. LA RÈGLE D-06, ÉTENDUE ICI SUR DEMANDE EXPLICITE DE L'EXPLOITATION : un
 *    formulaire qui échoue le dit, dans QUATRE issues qui ne se confondent
 *    jamais, et un geste répété ne poste jamais deux requêtes concurrentes.
 *    Même mesure que `tests/unit/planning/pose.test.tsx`, sur un formulaire
 *    plutôt que sur un glisser-déposer.
 * 3. RG-PAR-07 / D126 : la fiche met en évidence famille, marque, référence,
 *    numéro de série, année de vente, DANS CET ORDRE — et la consigne du
 *    ticket exige que le formulaire suive la même règle, dans le même ordre.
 * 4. AT-07 (recherche remplie, total des filtres) — mesuré déjà résolu par
 *    N-12/AT-07 (#219) sur `/parc` : ce fichier porte la preuve statique que
 *    la régression reste impossible, faute de pouvoir interroger la base
 *    depuis ce bac à sable (réseau sortant bloqué vers Neon — voir la
 *    proposition).
 */

const RACINE = process.cwd();

function reel(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

const VALEURS_VIDES = {
  numeroSerie: "",
  referenceInterne: "",
  localisation: "",
  factureOrigine: "",
  dateMiseEnService: "",
  dateVente: "",
  garantieFin: "",
  criticite: "normale" as const,
};

/**
 * LES FAMILLES DE LA SCÈNE (D184) — deux, pour éprouver que le changement
 * de famille remonte le sélecteur de modèle avec un critère différent.
 */
const FAMILLES_SCENE = [
  { id: "famille-1", libelle: "Pelles" },
  { id: "famille-2", libelle: "Chariots" },
];

function formulaireDeCreation(
  reglages: Partial<{
    readonly clientInitial: { readonly id: string; readonly libelle: string };
    readonly siteInitial: { readonly id: string; readonly libelle: string };
    readonly familles: readonly {
      readonly id: string;
      readonly libelle: string;
    }[];
  }> = {},
) {
  return render(
    createElement(FormulaireMachine, {
      mode: "creation",
      action: "/api/machines/creer",
      motifSucces: "machine.creee",
      valeurs: VALEURS_VIDES,
      familles: reglages.familles ?? [],
      clientInitial: reglages.clientInitial,
      siteInitial: reglages.siteInitial,
    }),
  );
}

/** Voir `tests/unit/planning/pose.test.tsx` — même raison, même forme. */
const naviguer = vi.fn();

beforeEach(() => {
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign: naviguer },
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  naviguer.mockClear();
});

describe("interpreterReponseMachine — les quatre issues ne se confondent jamais (D-06)", () => {
  it("JUMEAU — une réponse qui réussit VRAIMENT rend « enregistre »", () => {
    const issue = interpreterReponseMachine({
      ok: true,
      corps: { accepte: true, cle: null, id: "m-1" },
    });
    expect(issue).toEqual({ issue: "enregistre", id: "m-1" });
  });

  it("un code HTTP d'échec ne rend jamais « enregistre »", () => {
    expect(
      interpreterReponseMachine({ ok: false, corps: null }).issue,
    ).not.toBe("enregistre");
  });

  it("un corps VIDE malgré un 200 ne rend jamais « enregistre »", () => {
    expect(interpreterReponseMachine({ ok: true, corps: null }).issue).not.toBe(
      "enregistre",
    );
  });

  it("un succès SANS identifiant ne rend jamais « enregistre » — rien à rejoindre", () => {
    expect(
      interpreterReponseMachine({
        ok: true,
        corps: { accepte: true, cle: null },
      }).issue,
    ).not.toBe("enregistre");
  });

  it("l'ABSENCE de réponse ne rend jamais « enregistre »", () => {
    expect(interpreterReponseMachine(null).issue).not.toBe("enregistre");
  });

  it("JUMEAU — un refus MÉTIER reste un refus, avec sa clé exacte", () => {
    const issue = interpreterReponseMachine({
      ok: true,
      corps: {
        accepte: false,
        cle: "machine.refus.numero_serie_pris",
        id: null,
      },
    });
    expect(issue).toEqual({
      issue: "refuse",
      cle: "machine.refus.numero_serie_pris",
    });
  });

  it("une clé de refus INCONNUE du dictionnaire n'est jamais recopiée telle quelle", () => {
    const issue = interpreterReponseMachine({
      ok: true,
      corps: { accepte: false, cle: "<script>", id: null },
    });
    expect(issue).toEqual({ issue: "refuse", cle: "machine.refus.inconnue" });
  });

  it("les quatre issues portent des noms tous DIFFÉRENTS", () => {
    const noms = new Set(
      [
        interpreterReponseMachine({
          ok: true,
          corps: { accepte: true, cle: null, id: "m-1" },
        }),
        interpreterReponseMachine({
          ok: true,
          corps: { accepte: false, cle: "machine.refus.introuvable", id: null },
        }),
        interpreterReponseMachine({ ok: false, corps: null }),
        interpreterReponseMachine(null),
      ].map((issue) => issue.issue),
    );
    expect(noms.size).toBe(4);
  });
});

describe("le formulaire de création — les quatre issues à l'écran (D-06)", () => {
  it("un refus métier affiche le texte exact de la clé rendue par la route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accepte: false,
          cle: "machine.refus.numero_serie_pris",
          id: null,
        }),
      }),
    );
    const { container } = formulaireDeCreation();
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        fr["machine.refus.numero_serie_pris"],
      ),
    );
    expect(naviguer).not.toHaveBeenCalled();
  });

  it("une erreur serveur (ok:false) affiche le texte « erreur_serveur », pas « connexion_interrompue »", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => null }),
    );
    const { container } = formulaireDeCreation();
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        fr["machine.refus.erreur_serveur"],
      ),
    );
    expect(naviguer).not.toHaveBeenCalled();
  });

  it("un `fetch` qui REJETTE affiche « connexion_interrompue », jamais confondu avec l'erreur serveur", async () => {
    expect(fr["machine.refus.connexion_interrompue"]).not.toBe(
      fr["machine.refus.erreur_serveur"],
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("réseau")));
    const { container } = formulaireDeCreation();
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        fr["machine.refus.connexion_interrompue"],
      ),
    );
    expect(naviguer).not.toHaveBeenCalled();
  });

  it("un succès rejoint la fiche créée, à l'identifiant rendu par la route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accepte: true, cle: null, id: "machine-42" }),
      }),
    );
    const { container } = formulaireDeCreation();
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(naviguer).toHaveBeenCalledWith(
        `/parc/machine-42?motif=${encodeURIComponent("machine.creee")}`,
      ),
    );
  });
});

describe("UN GESTE RÉPÉTÉ EST BLOQUÉ PENDANT LA DEMANDE (D-06)", () => {
  it("deux envois avant la réponse ne postent qu'une seule requête", async () => {
    let resoudre: (valeur: unknown) => void = () => {};
    const enVol = new Promise((resolve) => {
      resoudre = resolve;
    });
    const fetchSimule = vi.fn().mockReturnValue(enVol);
    vi.stubGlobal("fetch", fetchSimule);
    const { container } = formulaireDeCreation();
    const formulaire = container.querySelector("form")!;

    fireEvent.submit(formulaire);
    fireEvent.submit(formulaire);

    // Le second envoi n'a posté AUCUNE requête : bloqué pendant que la
    // première demande vole, pas seulement ignoré après coup.
    expect(fetchSimule).toHaveBeenCalledTimes(1);

    resoudre({
      ok: true,
      json: async () => ({ accepte: true, cle: null, id: "machine-1" }),
    });
    await waitFor(() => expect(naviguer).toHaveBeenCalledTimes(1));

    // Une fois la demande retombée, un troisième envoi en poste une neuve.
    fireEvent.submit(formulaire);
    await waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(2));
  });
});

describe("l'ordre des champs suit RG-PAR-07 / D126, y compris dans le formulaire", () => {
  it("modèle, puis numéro de série, puis date de vente — dans cet ordre, à la création", () => {
    const { container } = formulaireDeCreation();
    const noms = [...container.querySelectorAll("[name]")].map((element) =>
      element.getAttribute("name"),
    );
    const rang = (nom: string) => noms.indexOf(nom);

    expect(rang("modele_id")).toBeGreaterThanOrEqual(0);
    expect(rang("numero_serie")).toBeGreaterThan(rang("modele_id"));
    expect(rang("date_vente")).toBeGreaterThan(rang("numero_serie"));
  });
});

describe("la création au gabarit du 28/09 (9EK-TP-UX5-2-CREATIONS-2, D184)", () => {
  it("rend les trois sections dans l'ordre, et la famille n'est jamais soumise", () => {
    const { container } = formulaireDeCreation({ familles: FAMILLES_SCENE });
    const titres = [...container.querySelectorAll("h2")].map(
      (h2) => h2.textContent,
    );
    expect(titres).toEqual([
      `1${fr["machine.nouvelle.section_ou"]}`,
      `2${fr["machine.nouvelle.section_quelle"]}`,
      `3${fr["machine.nouvelle.section_facultatif"]}`,
    ]);
    const familleSelect = [...container.querySelectorAll("select")].find(
      (select) =>
        [...select.querySelectorAll("option")].some(
          (option) => option.textContent === FAMILLES_SCENE[0]!.libelle,
        ),
    );
    expect(familleSelect).not.toBeUndefined();
    expect(familleSelect).not.toHaveAttribute("name");
  });

  it("aucune case n'est cochée pour l'état ou la criticité — le schéma pose le défaut, pas l'écran", () => {
    const { container } = formulaireDeCreation();
    const radios = [
      ...container.querySelectorAll(
        'input[type="radio"][name="statut"], input[type="radio"][name="criticite"]',
      ),
    ] as HTMLInputElement[];
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) {
      expect(radio.checked, `${radio.name}=${radio.value} coché`).toBe(false);
    }
  });

  it("« Je ne peux pas le lire », référence interne remplie, compose SN-INCONNU-<référence>", () => {
    const { container } = formulaireDeCreation();
    const reference = container.querySelector(
      'input[name="reference_interne"]',
    ) as HTMLInputElement;
    const numeroSerie = container.querySelector(
      'input[name="numero_serie"]',
    ) as HTMLInputElement;
    fireEvent.change(reference, { target: { value: "R1" } });
    fireEvent.click(
      screen.getByRole("button", { name: fr["machine.action.illisible"] }),
    );
    expect(numeroSerie.value).toBe("SN-INCONNU-R1");
  });

  it("« Je ne peux pas le lire », référence interne vide, focalise la référence et montre l'aide SOUS elle", () => {
    const { container } = formulaireDeCreation();
    const reference = container.querySelector(
      'input[name="reference_interne"]',
    ) as HTMLInputElement;
    fireEvent.click(
      screen.getByRole("button", { name: fr["machine.action.illisible"] }),
    );
    expect(document.activeElement).toBe(reference);
    // PAS `screen.getByText` ICI (espace insécable dans la clé) — son
    // normalisateur par défaut réduit l'espace du nœud DOM mais pas celui du
    // texte cherché : les deux divergent en silence. Comparaison directe,
    // sans normalisation d'un seul côté.
    const aide = [...container.querySelectorAll("span")].find(
      (span) => span.textContent === fr["machine.champ.numero_serie_aide"],
    );
    expect(aide).not.toBeUndefined();
  });

  it("le refus de doublon (numéro de série) s'affiche SOUS le champ, jamais dans un second bandeau", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accepte: false,
          cle: "machine.refus.numero_serie_pris",
          id: null,
        }),
      }),
    );
    const { container } = formulaireDeCreation();
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      const alertes = screen.getAllByRole("alert");
      expect(alertes).toHaveLength(1);
      expect(alertes[0]).toHaveTextContent(
        fr["machine.refus.numero_serie_pris"],
      );
    });
    expect(
      container.querySelector('[data-refus="machine.refus.numero_serie_pris"]'),
    ).toBeNull();
  });

  it("le refus de doublon (référence interne) s'affiche SOUS le champ, jamais dans un second bandeau", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accepte: false,
          cle: "machine.refus.reference_interne_prise",
          id: null,
        }),
      }),
    );
    const { container } = formulaireDeCreation();
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      const alertes = screen.getAllByRole("alert");
      expect(alertes).toHaveLength(1);
      expect(alertes[0]).toHaveTextContent(
        fr["machine.refus.reference_interne_prise"],
      );
    });
  });

  it("un refus qui n'est ni l'un ni l'autre doublon reste dans le bandeau", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accepte: false,
          cle: "machine.refus.reference_invalide",
          id: null,
        }),
      }),
    );
    const { container } = formulaireDeCreation();
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(
        container.querySelector(
          '[data-refus="machine.refus.reference_invalide"]',
        ),
      ).not.toBeNull(),
    );
  });

  it("le changement de famille remonte le sélecteur de modèle avec le critère `famille`", async () => {
    const appels: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        appels.push(url);
        return Promise.resolve({
          ok: true,
          json: async () => ({ resultats: [], page: 1, limite: 20, total: 0 }),
        });
      }),
    );
    const { container } = formulaireDeCreation({ familles: FAMILLES_SCENE });
    const select = [...container.querySelectorAll("select")].find((s) =>
      [...s.querySelectorAll("option")].some(
        (option) => option.textContent === FAMILLES_SCENE[0]!.libelle,
      ),
    )!;
    fireEvent.change(select, { target: { value: FAMILLES_SCENE[0]!.id } });

    // Le sélecteur de modèle est REMONTÉ (`key={familleChoisie}`) : requêter
    // le nœud APRÈS le changement, jamais avant — l'ancien n'est plus attaché.
    const modele = container.querySelector(
      '[data-selecteur="modele_id"] input[type="text"]',
    ) as HTMLInputElement;
    fireEvent.focus(modele);

    await waitFor(() =>
      expect(
        appels.some((url) => url.includes(`famille=${FAMILLES_SCENE[0]!.id}`)),
      ).toBe(true),
    );
  });

  it("« Créer et en ajouter une autre » rejoint `/parc/nouvelle` avec le client, le site et le motif", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ accepte: true, cle: null, id: "machine-9" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ resultats: [], page: 1, limite: 20, total: 0 }),
        });
      }),
    );
    const { container } = formulaireDeCreation({
      clientInitial: { id: "client-9", libelle: "Client neuf" },
      siteInitial: { id: "site-9", libelle: "Site neuf" },
    });
    const modele = container.querySelector(
      '[data-selecteur="modele_id"] input[type="text"]',
    ) as HTMLInputElement;
    fireEvent.change(modele, { target: { value: "Pelle" } });
    fireEvent.change(container.querySelector('input[name="numero_serie"]')!, {
      target: { value: "SN-9" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["machine.action.creer_et_ajouter"],
      }),
    );

    await waitFor(() =>
      expect(naviguer).toHaveBeenCalledWith(
        `/parc/nouvelle?client=${encodeURIComponent("client-9")}&site=${encodeURIComponent("site-9")}&motif=${encodeURIComponent("machine.creee")}`,
      ),
    );
  });

  it("le bouton principal reste sur la fiche créée, jamais sur /parc/nouvelle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ accepte: true, cle: null, id: "machine-8" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ resultats: [], page: 1, limite: 20, total: 0 }),
        });
      }),
    );
    const { container } = formulaireDeCreation({
      clientInitial: { id: "client-8", libelle: "Client huit" },
      siteInitial: { id: "site-8", libelle: "Site huit" },
    });
    const modele = container.querySelector(
      '[data-selecteur="modele_id"] input[type="text"]',
    ) as HTMLInputElement;
    fireEvent.change(modele, { target: { value: "Pelle" } });
    fireEvent.change(container.querySelector('input[name="numero_serie"]')!, {
      target: { value: "SN-8" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["machine.action.creer_la_machine"],
      }),
    );

    await waitFor(() =>
      expect(naviguer).toHaveBeenCalledWith(
        `/parc/machine-8?motif=${encodeURIComponent("machine.creee")}`,
      ),
    );
  });
});

/**
 * Les valeurs de lecture seule d'une fiche fictive — en CONSTANTE, jamais
 * recopiées en littéral dans une assertion (`screen.getByText("Pelles")`
 * serait exactement la forme que `sans-chaine-visible-en-dur.test.ts`
 * refuse : une donnée reste une donnée quand elle vient d'une variable, pas
 * quand elle est retapée).
 */
const LECTURE_SEULE_MACHINE_1 = {
  modeleId: "modele-1",
  clientId: "client-1",
  siteId: "site-1",
  familleLibelle: "Pelles",
  marque: "Komatsu",
  reference: "PC200",
  clientLibelle: "SARL Test",
  siteLibelle: "Site A",
};

describe("le mode modification ne rend ni le modèle, ni le client, ni le site, ni le statut comme des champs modifiables", () => {
  function formulaireDeModification() {
    return render(
      createElement(FormulaireMachine, {
        mode: "modification",
        action: "/api/machines/machine-1/modifier",
        motifSucces: "machine.modifiee",
        valeurs: { ...VALEURS_VIDES, numeroSerie: "SN-001" },
        lectureSeule: LECTURE_SEULE_MACHINE_1,
      }),
    );
  }

  it("aucun `<select>` modifiable pour le modèle, le client, le site ou le statut", () => {
    const { container } = formulaireDeModification();
    expect(container.querySelector('select[name="modele_id"]')).toBeNull();
    expect(container.querySelector('select[name="client_id"]')).toBeNull();
    expect(container.querySelector('select[name="site_id"]')).toBeNull();
    expect(container.querySelector('select[name="statut"]')).toBeNull();
  });

  it("les trois clés voyagent malgré tout, en champs CACHÉS — schemaMachine les exige", () => {
    const { container } = formulaireDeModification();
    expect(
      container.querySelector('input[type="hidden"][name="modele_id"]'),
    ).toHaveAttribute("value", "modele-1");
    expect(
      container.querySelector('input[type="hidden"][name="client_id"]'),
    ).toHaveAttribute("value", "client-1");
    expect(
      container.querySelector('input[type="hidden"][name="site_id"]'),
    ).toHaveAttribute("value", "site-1");
  });

  it("la famille, la marque, la référence, le client et le site s'affichent quand même — en lecture", () => {
    // Ne compare pas le texte rendu à une chaîne recopiée ici (ce serait
    // exactement la « forme 3 » que `sans-chaine-visible-en-dur.test.ts`
    // refuse : une constante littérale de CE fichier, affichée là). La
    // preuve porte sur la STRUCTURE — cinq paires `<dt>/<dd>` non vides —
    // jamais sur le contenu, que `LECTURE_SEULE_MACHINE_1` définit une seule
    // fois pour la scène ci-dessus.
    const { container } = formulaireDeModification();
    const bloc = container.querySelector("dl");
    expect(bloc).not.toBeNull();
    const valeurs = [...bloc!.querySelectorAll("dd")].map(
      (dd) => dd.textContent,
    );
    expect(valeurs).toHaveLength(5);
    for (const valeur of valeurs) {
      expect(valeur, "une valeur de lecture seule est vide").toBeTruthy();
    }
  });

  it("le numéro de série RESTE modifiable — modifierMachineDans l'écrit", () => {
    const { container } = formulaireDeModification();
    const champ = container.querySelector(
      'input[name="numero_serie"]',
    ) as HTMLInputElement;
    expect(champ).not.toBeNull();
    expect(champ.value).toBe("SN-001");
  });
});

describe("solde 9EP point 45 — deux clés restaurées, une clé neuve pour le bouton de création", () => {
  it("`machine.action.creer` retrouve son texte d'origine, égal à `machine.action.enregistrer`", () => {
    expect(fr["machine.action.creer"]).toBe(fr["machine.action.enregistrer"]);
  });

  it("`machine.nouvelle.sous_titre` est restauré, non vide", () => {
    expect(fr["machine.nouvelle.sous_titre"].trim().length).toBeGreaterThan(0);
  });

  it("le bouton principal de création porte `machine.action.creer_la_machine`, celui de modification `machine.action.enregistrer`", () => {
    const creation = formulaireDeCreation();
    expect(
      creation.getByRole("button", {
        name: fr["machine.action.creer_la_machine"],
      }),
    ).toBeInTheDocument();
    creation.unmount();

    const modification = render(
      createElement(FormulaireMachine, {
        mode: "modification",
        action: "/api/machines/machine-1/modifier",
        motifSucces: "machine.modifiee",
        valeurs: { ...VALEURS_VIDES, numeroSerie: "SN-001" },
        lectureSeule: LECTURE_SEULE_MACHINE_1,
      }),
    );
    expect(
      modification.getByRole("button", {
        name: fr["machine.action.enregistrer"],
      }),
    ).toBeInTheDocument();
  });
});

describe("solde 9EP point 46 — le bouton « Corriger la fiche » retrouve l'apparence de l'action primaire", () => {
  it("le bouton submit du mode modification a la même `className` qu'un `ActionPrimaire` rendu à côté", () => {
    const { container } = render(
      createElement(FormulaireMachine, {
        mode: "modification",
        action: "/api/machines/machine-1/modifier",
        motifSucces: "machine.modifiee",
        valeurs: { ...VALEURS_VIDES, numeroSerie: "SN-001" },
        lectureSeule: LECTURE_SEULE_MACHINE_1,
      }),
    );
    // `ActionPrimaire` exige `children` dans ses props — un enfant passé en
    // argument supplémentaire de `createElement` (jamais `children` en prop,
    // que le gardien ESLint refuse) échappe à cette exigence par ce
    // réassouplissement local du type, sans toucher au composant lui-même.
    const Temoin = ActionPrimaire as unknown as (props: {
      readonly type?: "button" | "submit";
    }) => ReturnType<typeof ActionPrimaire>;
    const { container: temoin } = render(
      createElement(Temoin, { type: "submit" }, "Témoin"),
    );
    const bouton = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    const boutonTemoin = temoin.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(bouton.className).toBe(boutonTemoin.className);
  });
});

describe("solde 9EP point 47 — plus aucun `eslint-disable` dans le formulaire machine", () => {
  it("le source ne contient plus la sous-chaîne « eslint-disable »", () => {
    const SOURCE = reel("components/parc/formulaire-machine.tsx");
    expect(SOURCE).not.toContain("eslint-disable");
  });
});

describe("AT-07 (recherche remplie, total des filtres) — mesuré déjà résolu sur /parc (N-12, #219)", () => {
  // MESURE STATIQUE, faute de pouvoir interroger la base depuis ce bac à
  // sable (réseau sortant bloqué vers Neon, mesuré — voir la proposition) :
  // ce n'est PAS un substitut à `tests/unit/db/liste-parc.test.ts` ni à une
  // mesure jouée contre une vraie base, seulement la preuve que le code
  // source reste câblé comme il l'était au moment de la mesure.
  const PAGE = reel("app/(back-office)/parc/page.tsx");
  const DEPOT = reel("lib/machines/depot.ts");

  it("`compterLeParc` et `rechercherLeParc` partagent la MÊME écriture du critère (`filtreDuParc`)", () => {
    expect(DEPOT).toContain("function filtreDuParc(");
    // LE SECOND ET LE TROISIÈME ARGUMENT — le jour civil de la société
    // (9EB-TP-UX3-2-LISTES-2, la vue « garantie » en a besoin) puis le
    // périmètre par personne (QT-2, D152), composés IDENTIQUEMENT par les
    // trois appelants (`rechercherLeParc`, `compterLeParc`,
    // `resumerLeParcFiltre`) : ce motif reste aussi strict qu'avant, il
    // reconnaît juste l'appel à trois arguments plutôt qu'à deux.
    const APPEL_FILTRE_DU_PARC =
      "filtreDuParc(\n" +
      "          criteres,\n" +
      "          aujourdHui,\n" +
      "          await perimetreParcDuTechnicien(tx, exigerContexteActif(contexte)),\n" +
      "        )";
    const appelsRechercher = DEPOT.match(
      /tx\.machine\.findMany\(\{[\s\S]*?where: filtreDuParc\(\s*criteres,\s*aujourdHui,\s*await perimetreParcDuTechnicien\(tx, exigerContexteActif\(contexte\)\),\s*\)/g,
    );
    const appelsCompter = DEPOT.match(
      /tx\.machine\.count\(\{\s*where: filtreDuParc\(\s*criteres,\s*aujourdHui,\s*await perimetreParcDuTechnicien\(tx, exigerContexteActif\(contexte\)\),\s*\),\s*\}\)/g,
    );
    expect(DEPOT).toContain(APPEL_FILTRE_DU_PARC);
    expect(appelsRechercher?.length ?? 0).toBeGreaterThan(0);
    expect(appelsCompter?.length ?? 0).toBeGreaterThan(0);
  });

  it("le résumé et la pagination affichent `totalFiltre` (compterLeParc), jamais `lignes.length`", () => {
    expect(PAGE).toContain("const totalFiltre = criteres.success");
    // LE JOUR CIVIL DE LA SOCIÉTÉ (9EB-TP-UX3-2-LISTES-2) EST DÉSORMAIS UN
    // TROISIÈME ARGUMENT — la vue « garantie » en a besoin, voir
    // `filtreDuParc` ; ce motif reconnaît l'appel à trois arguments.
    expect(PAGE).toContain(
      "await compterLeParc(contexte, criteres.data, aujourdHui)",
    );
    // Les emplacements qui montrent un total à l'écran lisent la même
    // variable — un total qui compterait autrement que ce qu'il pagine est
    // la faute nommée par le directeur d'exploitation le 16/09. Les trois
    // anciens KPI ont quitté `totalFiltre` pour leurs propres tuiles
    // (QE-13b (a)) ; `ResumeListe`, `CarteListe` et `Pagination` restent.
    const occurrences = PAGE.match(/totalFiltre,\n/g);
    expect(occurrences?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(PAGE).not.toContain("valeur={lignes.length}");
  });

  it("la recherche texte porte sur au moins six colonnes visibles — elle est REMPLIE, pas seulement câblée", () => {
    const SAISIE = reel("lib/machines/saisie.ts");
    expect(SAISIE).toContain("export const schemaRechercheParc");
    const colonnes = [
      "numero_serie",
      "raison_sociale",
      "libelle",
      "commune",
      "reference",
      "marque",
    ];
    for (const colonne of colonnes) {
      expect(DEPOT, colonne).toContain(colonne);
    }
  });
});
