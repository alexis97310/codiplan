import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RapportTerrainAutomatique,
  type PrestationOption,
} from "@/components/terrain/rapport-automatique";
import { fr } from "@/lib/i18n";
import { envoyerFile } from "@/lib/terrain/envoi-file";
import {
  ajouterSaisie,
  listerFilePourIntervention,
  retirerSaisie,
} from "@/lib/terrain/file-saisies";

import {
  ecrireEntreeBrute,
  installerIndexedDBFactice,
} from "./aide-indexeddb-factice";

/**
 * 9F4-TERRAIN-ENREGISTREMENT-AUTO — LE COMPOSANT, SANS SERVEUR NI RÉSEAU.
 *
 * Ce que `tests/e2e/rapport-terrain.spec.ts` et les voisins mesurent de bout
 * en bout, ce fichier le mesure à l'unité : le DÉBOUNCE (rien avant 1,5 s,
 * tout au `blur`), la FUSION du brouillon local avec les valeurs serveur au
 * montage, et le refus hors connexion du bouton Terminer. `fetch` est un
 * mock — aucune route réelle n'est jointe.
 *
 * Le tracé de la signature (canevas) n'est PAS éprouvé ici : jsdom ne pose
 * aucun contexte 2D, et le composant s'en abstient silencieusement
 * (`getContext` rend `null`) — c'est le rôle de `tests/e2e/rapport-
 * terrain.spec.ts`, où un vrai navigateur trace réellement.
 *
 * LE DOUBLE INDEXEDDB (9F4H3A-FILE-SANS-PERTE, point 2) — jsdom n'implémente
 * pas IndexedDB ; sans le double, `ajouterSaisie` échouerait RÉELLEMENT à
 * chaque scénario « hors réseau » de ce fichier, et ces scénarios verraient
 * tous le message d'échec du point 2 plutôt que celui qu'ils éprouvent.
 *
 * JAMAIS `vi.useFakeTimers({ shouldAdvanceTime: true })` POUR UNE BORNE EN
 * DEÇÀ D'UN DÉLAI (9F4H5A-HEURE-CALEE-SERVEUR, point 2) — mesuré instable
 * (ROUGE puis VERT sur deux passages de `pnpm verify`, aucun autre
 * changement entre les deux) sur « aucun envoi avant 1,5 s » :
 * `shouldAdvanceTime` fait avancer l'horloge FACTICE toute seule, au rythme
 * de l'horloge RÉELLE de la machine qui joue l'épreuve — le temps que
 * `scene()` prenne à monter (rendu, effets, double IndexedDB) s'ajoutait
 * donc, de façon non reproductible, aux 1 499 ms explicitement avancées, et
 * basculait parfois la minuterie de 1 500 ms AVANT l'assertion « rien
 * envoyé ». Seule l'horloge FACTICE sans compagnon réel, avancée
 * EXPLICITEMENT par `vi.advanceTimersByTimeAsync` (jamais
 * `advanceTimersByTime` synchrone, qui ne laisse pas les microtâches —
 * `fetch`, les promesses d'IndexedDB — se résoudre entre deux avancées),
 * tient la borne « avant »/« après » au nombre de millisecondes exact,
 * indépendamment de la machine.
 */

const INTERVENTION_ID = "33333333-3333-3333-3333-333333333333";
const UTILISATEUR_ID = "55555555-5555-5555-5555-555555555555";
const SOCIETE_ID = "66666666-6666-6666-6666-666666666666";
const CLE_BROUILLON = `codiplan.terrain.${INTERVENTION_ID}.brouillon`;

const POUSSER = vi.fn();
const RAFRAICHIR = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: POUSSER, refresh: RAFRAICHIR }),
}));

/**
 * UN SEUL TYPE DE GESTE ÉCHOUE À ÊTRE GARDÉ, LES AUTRES PASSENT PAR LE VRAI
 * DOUBLE (point 4, 9F4H3AC) — `installerIndexedDBFactice({ enPanne: true })`
 * fait échouer TOUTE écriture, ce qui ne distinguerait pas « terminer n'a
 * jamais été tenté parce que la signature a échoué » de « terminer a aussi
 * échoué, pour la même raison que la signature ». `controleAjout` isole la
 * panne sur un seul type de geste, le reste restant garde par le double réel.
 */
const controleAjout = vi.hoisted(() => ({
  echouerPourType: null as string | null,
}));

vi.mock("@/lib/terrain/file-saisies", async () => {
  const reel = await vi.importActual<
    typeof import("@/lib/terrain/file-saisies")
  >("@/lib/terrain/file-saisies");
  return {
    ...reel,
    ajouterSaisie: (parametres: Parameters<typeof reel.ajouterSaisie>[0]) => {
      if (parametres.geste.type === controleAjout.echouerPourType) {
        return Promise.resolve({ gardee: false as const });
      }
      return reel.ajouterSaisie(parametres);
    },
  };
});

const PRESTATIONS: readonly PrestationOption[] = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    libelle: fr["terrain.e2e.prestation_libelle"],
  },
  // SECONDE PRESTATION, DISTINCTE (9F4H6D-PRESTATIONS-SANS-PERTE, point 2) —
  // un libellé littéral, comme `PRESTATION_P2_COLLEGUE` dans les scènes e2e
  // (ex. `9f4h6b-file-ancien-format.spec.ts`) : ce n'est pas une chaîne de
  // composant, c'est une donnée de catalogue (fixture), hors du dictionnaire.
  {
    id: "44444444-4444-4444-4444-444444444445",
    libelle: "Courroie — ajoutée par le bureau",
  },
];

type ProprietesScene = Partial<{
  rapportInitial: {
    commentaire_technicien: string | null;
    suite_a_donner: string | null;
  };
  prestationsInitiales: readonly string[];
  dejaSignee: boolean;
  afficherTerminer: boolean;
  statut: "en_cours" | "a_planifier" | "cloturee" | "annulee";
  minutesConnues: number;
  segmentOuvertConnu: { readonly debut: string } | null;
}>;

function elementDeScene(props: ProprietesScene = {}) {
  return (
    <RapportTerrainAutomatique
      interventionId={INTERVENTION_ID}
      utilisateurId={UTILISATEUR_ID}
      societeId={SOCIETE_ID}
      statut={props.statut ?? "en_cours"}
      // Un temps déjà mesuré par défaut (point 4, C5) : la plupart des
      // épreuves de ce fichier n'éprouvent PAS le refus « temps manquant »,
      // et ne doivent pas s'y heurter par accident.
      minutesConnues={props.minutesConnues ?? 60}
      segmentOuvertConnu={props.segmentOuvertConnu ?? null}
      rapportInitial={
        props.rapportInitial ?? {
          commentaire_technicien: null,
          suite_a_donner: null,
        }
      }
      prestations={PRESTATIONS}
      prestationsInitiales={props.prestationsInitiales ?? []}
      dejaSignee={props.dejaSignee ?? false}
      afficherTerminer={props.afficherTerminer ?? false}
      verdictTerminerRefuseCle={null}
      sectionPhotos={null}
    />
  );
}

function scene(props: ProprietesScene = {}) {
  return render(elementDeScene(props));
}

let fetchMock: ReturnType<typeof vi.fn>;
let restaurerIndexedDB: () => void;

beforeEach(() => {
  window.localStorage.clear();
  restaurerIndexedDB = installerIndexedDBFactice();
  fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true, motif: null }),
  });
  vi.stubGlobal("fetch", fetchMock);
  POUSSER.mockClear();
  RAFRAICHIR.mockClear();
  controleAjout.echouerPourType = null;
});

afterEach(() => {
  restaurerIndexedDB();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("le brouillon local reprend le pas sur les valeurs serveur, au montage", () => {
  it("un brouillon trouvé l'emporte sur le `rapportInitial` du serveur", () => {
    window.localStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({
        commentaire: "Brouillon jamais envoyé",
        suite: "",
        prestationIds: [],
        signature: null,
      }),
    );

    scene({
      rapportInitial: {
        commentaire_technicien: "Valeur du serveur",
        suite_a_donner: null,
      },
    });

    expect(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
    ).toHaveValue("Brouillon jamais envoyé");
  });

  it("sans brouillon, les valeurs du serveur restent affichées", () => {
    scene({
      rapportInitial: {
        commentaire_technicien: "Valeur du serveur",
        suite_a_donner: null,
      },
    });

    expect(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
    ).toHaveValue("Valeur du serveur");
  });
});

describe("le rapport s'envoie seul — débounce de 1,5 s, ou immédiatement au blur", () => {
  it("aucun envoi avant 1,5 s", async () => {
    // JAMAIS `shouldAdvanceTime` (instable — voir le docblock de tête du
    // fichier) : l'horloge factice n'avance alors QUE par
    // `advanceTimersByTimeAsync`, jamais toute seule au rythme de l'horloge
    // RÉELLE — la durée que prend `scene()` à monter sur la machine qui
    // joue l'épreuve ne compte plus pour rien dans les 1 499 ms mesurées.
    vi.useFakeTimers();
    scene();

    fireEvent.change(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
      { target: { value: "Filtre remplacé" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1499);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/rapport`);
    expect(options.headers).toMatchObject({ Accept: "application/json" });
  });

  it("le `blur` envoie immédiatement, sans attendre le débounce", async () => {
    scene();

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("l'indicateur « Enregistré » apparaît après un envoi réussi", async () => {
    scene();

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.rapport.enregistre"])).toBeVisible(),
    );
  });
});

describe("les prestations s'envoient à chaque changement, une DIFFÉRENCE jamais l'ensemble (D143, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE)", () => {
  it("cocher une prestation l'envoie sans attendre", async () => {
    scene();

    fireEvent.click(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/prestations`);
    // JAMAIS `prestation_id` (l'ancien ensemble complet) — l'envoi EN LIGNE
    // emprunte désormais le MÊME corps que le rejeu depuis la file.
    const corps = options.body as FormData;
    expect(corps.getAll("ajouter_id")).toEqual([PRESTATIONS[0].id]);
    expect(corps.getAll("retirer_id")).toEqual([]);
    expect(corps.getAll("prestation_id")).toEqual([]);
  });
});

describe("les prestations mises en FILE portent une DIFFÉRENCE, jamais l'ensemble (point 2, 9F4H6A-COQUILLE-ANCIENNE-COPIE)", () => {
  it("une prestation de la base connue, absente du catalogue affiché (ajoutée par un collègue), n'apparaît ni en ajout ni en retrait", async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);

    scene({
      prestationsInitiales: ["11111111-1111-1111-1111-111111111111"],
    });

    fireEvent.click(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    );

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible(),
    );

    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    const geste = file.find((e) => e.geste.type === "prestations")?.geste;
    expect(geste).toEqual({
      type: "prestations",
      ajouterIds: [PRESTATIONS[0].id],
      retirerIds: [],
    });
  });
});

describe("cocher puis décocher hors réseau ne rejoue plus la case, et ne jette plus un ajout qui a pu partir (point 3, 9F4H6B-FILE-ANCIEN-FORMAT ; précisé point 1, 9F4H6C-FILE-ROBUSTESSE)", () => {
  it("décocher une prestation juste cochée garde l'INVERSE de la différence en file, jamais le silence — un échec réseau et une réponse perdue après succès sont indistinguables pour ce composant (point 1, 9F4H6C-FILE-ROBUSTESSE)", async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);

    scene();

    const caseAPrestation = screen.getByLabelText(
      fr["terrain.e2e.prestation_libelle"],
    );

    fireEvent.click(caseAPrestation);
    await waitFor(() =>
      expect(screen.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible(),
    );
    const apresCoche = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(
      apresCoche.find((e) => e.geste.type === "prestations")?.geste,
    ).toEqual({
      type: "prestations",
      ajouterIds: [PRESTATIONS[0].id],
      retirerIds: [],
    });

    fireEvent.click(caseAPrestation);
    await waitFor(async () => {
      const apresDecoche = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      // JAMAIS LE SILENCE (point 1, 9F4H6C) — le premier ajout a pu, sans
      // qu'aucun signal ne le confirme ni ne l'infirme ici, déjà atteindre le
      // serveur (réponse perdue) ; l'entrée gardée est l'INVERSE, jamais la
      // rejoue de l'ajout (toujours absent), ni son silence (qui laisserait
      // l'ajout facturable s'il avait réellement abouti).
      expect(
        apresDecoche.find((e) => e.geste.type === "prestations")?.geste,
      ).toEqual({
        type: "prestations",
        ajouterIds: [],
        retirerIds: [PRESTATIONS[0].id],
      });
    });
  });

  // REVUE DU PILOTE sur fe4b58e8 (9F4H6D-PRESTATIONS-SANS-PERTE, point 3) —
  // le test ci-dessus ne couvrait que le RETOUR ARRIÈRE D'UN AJOUT
  // (`ajouterIds.length > 0`) : décocher une prestation DÉJÀ sur le serveur,
  // dont la réponse se perd, puis la recocher, ne passait par AUCUNE des
  // deux branches couvertes jusqu'ici — l'entrée en file est alors un pur
  // RETRAIT (`ajouterIds: []`), et était jetée EN SILENCE au lieu d'être
  // inversée.
  it("décocher une prestation DÉJÀ sur le serveur, réponse perdue, puis la recocher : le retrait est inversé, jamais jeté en silence (point 3, 9F4H6D-PRESTATIONS-SANS-PERTE)", async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);

    scene({ prestationsInitiales: [PRESTATIONS[0].id] });

    const caseAPrestation = screen.getByLabelText(
      fr["terrain.e2e.prestation_libelle"],
    );
    expect(caseAPrestation).toBeChecked();

    fireEvent.click(caseAPrestation);
    await waitFor(async () => {
      const apresDecoche = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      expect(
        apresDecoche.find((e) => e.geste.type === "prestations")?.geste,
      ).toEqual({
        type: "prestations",
        ajouterIds: [],
        retirerIds: [PRESTATIONS[0].id],
      });
    });

    fireEvent.click(caseAPrestation);
    await waitFor(async () => {
      const apresRecoche = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      // JAMAIS LE SILENCE — le retrait a pu, lui aussi, déjà atteindre le
      // serveur (réponse perdue) ; l'entrée gardée est son INVERSE (un ajout),
      // jamais son absence pure et simple, qui laisserait la prestation
      // retirée du serveur alors qu'elle est de nouveau cochée à l'écran.
      expect(
        apresRecoche.find((e) => e.geste.type === "prestations")?.geste,
      ).toEqual({
        type: "prestations",
        ajouterIds: [PRESTATIONS[0].id],
        retirerIds: [],
      });
    });
  });
});

describe("la « dernière base connue » suit l'état réellement envoyé par la FILE, pas seulement par ce composant (point 1, 9F4H6C-FILE-ROBUSTESSE)", () => {
  it("décocher après un envoi réussi DE LA FILE (bouton « Envoyer ») retire bien la prestation côté serveur, au lieu d'un retour « accepté » qui ne l'envoie jamais", async () => {
    // HORS RÉSEAU : cocher C le met en file, {ajouter:[C]}.
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    scene();
    const caseAPrestation = screen.getByLabelText(
      fr["terrain.e2e.prestation_libelle"],
    );
    fireEvent.click(caseAPrestation);
    await waitFor(() =>
      expect(screen.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible(),
    );

    // RÉSEAU REVENU : « Envoyer » (envoi-file.ts), comme le ferait
    // `BoutonEnvoyer`, envoie et retire l'entrée de la file — SANS que ce
    // composant n'ait lui-même tenté ni réussi aucun envoi en ligne.
    fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, motif: null }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      await envoyerFile({
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
    });

    // HORS RÉSEAU À NOUVEAU : décocher C. Sans le suivi de ce point, la
    // « dernière base connue » de ce composant resterait périmée (sans C) —
    // identique à `voulues` (sans C) — et le retour « accepté » n'envoie
    // jamais le retrait qui s'impose pourtant, puisque C EST sur le serveur.
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    fireEvent.click(caseAPrestation);

    await waitFor(async () => {
      const file = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      expect(file.find((e) => e.geste.type === "prestations")?.geste).toEqual({
        type: "prestations",
        ajouterIds: [],
        retirerIds: [PRESTATIONS[0].id],
      });
    });
  });

  it("un rafraîchissement des props serveur (`router.refresh()`) met aussi à jour la base connue, sans remonter le composant — même quand la file ne garde plus aucune trace de l'ajout (envoyé par un AUTRE onglet)", async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = scene({ prestationsInitiales: [] });

    fireEvent.click(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    );
    await waitFor(() =>
      expect(screen.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible(),
    );
    const enFile = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    const entree = enFile.find((e) => e.geste.type === "prestations");
    expect(entree).toBeDefined();

    // UN AUTRE ONGLET A ENVOYÉ CET AJOUT ET VIDÉ SA PROPRE FILE — cette
    // fiche n'a reçu NI `EVENEMENT_PRESTATIONS_ENVOYEES` (point 1a : il ne
    // voyage pas entre onglets) NI retiré sa propre entrée ; seul le
    // rafraîchissement des props serveur peut encore la prévenir que C est
    // désormais sur le serveur (point 1b).
    await act(async () => {
      await retirerSaisie(entree!.id);
    });

    // `router.refresh()` relit la fiche : prestationsInitiales montre
    // maintenant C, SANS que ce composant soit remonté.
    rerender(elementDeScene({ prestationsInitiales: [PRESTATIONS[0].id] }));

    fireEvent.click(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    );

    await waitFor(async () => {
      const file = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      expect(file.find((e) => e.geste.type === "prestations")?.geste).toEqual({
        type: "prestations",
        ajouterIds: [],
        retirerIds: [PRESTATIONS[0].id],
      });
    });
  });
});

describe("l'écran suit le serveur — un rafraîchissement des props avance la base ET l'écran ENSEMBLE (9F4H6D-PRESTATIONS-SANS-PERTE, point 2)", () => {
  it("le bureau ajoute une prestation PENDANT que la fiche est ouverte : après rafraîchissement, elle apparaît cochée à l'écran, et un ajout local reste conservé par-dessus", async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = scene({ prestationsInitiales: [] });

    const casePrestationC = screen.getByLabelText(
      fr["terrain.e2e.prestation_libelle"],
    );
    const casePrestationD = screen.getByLabelText(PRESTATIONS[1].libelle);
    expect(casePrestationC).not.toBeChecked();
    expect(casePrestationD).not.toBeChecked();

    // LE BUREAU COCHE D, EN LIGNE, PENDANT QUE LA FICHE EST OUVERTE — cette
    // fiche n'a RIEN fait localement pour D ; seul le rafraîchissement des
    // props serveur (`router.refresh()`) peut l'en prévenir.
    rerender(elementDeScene({ prestationsInitiales: [PRESTATIONS[1].id] }));

    // AVANT CE CORRECTIF, seule la base connue avançait — l'écran restait
    // décoché, et le prochain envoi calculait sa différence contre une base
    // qui connaît D sans que l'écran ne l'ait jamais montrée.
    await waitFor(() => expect(casePrestationD).toBeChecked());
    expect(casePrestationC).not.toBeChecked();

    // LE TECHNICIEN COCHE C, HORS RÉSEAU — rien n'est perdu de D.
    fireEvent.click(casePrestationC);
    await waitFor(() =>
      expect(screen.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible(),
    );

    await waitFor(async () => {
      const file = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      // LA DIFFÉRENCE SE CALCULE CONTRE LA NOUVELLE BASE ({D}), JAMAIS
      // L'ANCIENNE ({}) : D n'est PAS un ajout de ce technicien, et ne doit
      // jamais apparaître dans ce qu'il envoie — seul C, son propre ajout.
      expect(file.find((e) => e.geste.type === "prestations")?.geste).toEqual({
        type: "prestations",
        ajouterIds: [PRESTATIONS[0].id],
        retirerIds: [],
      });
    });
  });
});

describe("en ligne, la base connue avance par la DIFFÉRENCE ENVOYÉE, jamais par `voulues` (point 2, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE)", () => {
  it("une fusion arrivée PENDANT un envoi en vol n'est pas écrasée par la réponse de cet envoi", async () => {
    let resoudre: ((valeur: unknown) => void) | null = null;
    const reponseDifferee = new Promise((resolve) => {
      resoudre = resolve;
    });
    fetchMock = vi.fn((url: unknown) =>
      (url as string).endsWith("/prestations")
        ? reponseDifferee
        : Promise.resolve({
            json: () => Promise.resolve({ ok: true, motif: null }),
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = scene({ prestationsInitiales: [] });

    // LE TECHNICIEN COCHE C — l'envoi part, mais sa réponse reste en vol.
    fireEvent.click(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // LE BUREAU AJOUTE D PENDANT QUE CET ENVOI EST ENCORE EN VOL.
    rerender(elementDeScene({ prestationsInitiales: [PRESTATIONS[1].id] }));
    await waitFor(() =>
      expect(screen.getByLabelText(PRESTATIONS[1].libelle)).toBeChecked(),
    );

    // LE SERVEUR ACCEPTE ENFIN L'ENVOI DE C.
    await act(async () => {
      resoudre!({ json: () => Promise.resolve({ ok: true, motif: null }) });
    });
    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.prestations.enregistre"]),
      ).toBeVisible(),
    );

    // D RESTE COCHÉE — une base écrasée par `voulues` (périmé, sans D)
    // l'aurait oubliée de son propre calcul de diffs futurs.
    expect(screen.getByLabelText(PRESTATIONS[1].libelle)).toBeChecked();

    // LA PREUVE : décocher D envoie bien SON retrait — la base la connaît.
    fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, motif: null }),
    });
    vi.stubGlobal("fetch", fetchMock);
    fireEvent.click(screen.getByLabelText(PRESTATIONS[1].libelle));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const corps = options.body as FormData;
    expect(corps.getAll("retirer_id")).toEqual([PRESTATIONS[1].id]);
    expect(corps.getAll("ajouter_id")).toEqual([]);
  });
});

describe("une relecture des props PLUS ANCIENNE qu'un retrait accepté EN LIGNE ne le recoche pas (point 2, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE)", () => {
  // REVUE DU PILOTE (9F4H6F-PRESTATIONS-ANCIEN-CLIENT, point 2) — la version
  // précédente de cette épreuve relisait les MÊMES props
  // (`prestationsInitiales: [PRESTATIONS[0].id]` avant ET après) : leur
  // JOINTURE ne changeant pas, l'effet qui porte la garde ne se ré-exécutait
  // JAMAIS, et l'assertion passait sans que la garde n'ait rien fait. Les
  // props DOIVENT changer réellement (D apparaît, ajouté par le bureau
  // PENDANT que la relecture était encore en vol) pour que l'effet tourne et
  // que cette épreuve morde.
  it("décocher C en ligne, accepté, puis une relecture périmée montrant encore C (mais D en plus) laisse C décochée", async () => {
    const { rerender } = scene({
      prestationsInitiales: [PRESTATIONS[0].id],
    });
    const caseC = screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]);
    const caseD = screen.getByLabelText(PRESTATIONS[1].libelle);
    expect(caseC).toBeChecked();

    fireEvent.click(caseC);
    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.prestations.enregistre"]),
      ).toBeVisible(),
    );
    expect(caseC).not.toBeChecked();

    // UNE RELECTURE DES PROPS, PLUS ANCIENNE QUE CE RETRAIT ACCEPTÉ (lue par
    // le serveur AVANT que le retrait n'y soit visible — elle montre encore
    // C), MAIS RÉELLEMENT DIFFÉRENTE DE LA PRÉCÉDENTE (D, ajouté par le
    // bureau, y apparaît) : sans ce second changement, l'effet ne
    // s'exécuterait pas et cette épreuve ne garderait rien.
    rerender(
      elementDeScene({
        prestationsInitiales: [PRESTATIONS[0].id, PRESTATIONS[1].id],
      }),
    );

    expect(caseC).not.toBeChecked();
    expect(caseD).toBeChecked();
  });
});

describe("la base garde les changements acceptés même si une relecture des props qui a changé réellement est plus ancienne (point 3, 9F4H6F-PRESTATIONS-ANCIEN-CLIENT)", () => {
  // REVUE DU PILOTE sur `12853696` — cocher C, puis D, tous deux ACCEPTÉS EN
  // LIGNE ; une relecture des props PLUS ANCIENNE que l'acceptation de D (qui
  // ne montre que C) écrasait `dernierePrestationsEnvoyeesRef` avec les
  // props BRUTES ({C}), effaçant D de la base connue — l'écran continuait à
  // montrer D cochée (la fusion locale la rattrapait), mais un décochage
  // ultérieur de D ne renvoyait alors PLUS RIEN : la base périmée ({C})
  // correspondait déjà à `voulues` ({C}) après ce décochage, et D restait
  // acceptée sur le serveur sans jamais recevoir son retrait.
  it("cocher C puis D (acceptés), une relecture périmée [C] seul, puis décocher D envoie bien SON retrait", async () => {
    const { rerender } = scene({ prestationsInitiales: [] });
    const caseC = screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]);
    const caseD = screen.getByLabelText(PRESTATIONS[1].libelle);

    fireEvent.click(caseC);
    await waitFor(() => expect(caseC).toBeChecked());
    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.prestations.enregistre"]),
      ).toBeVisible(),
    );

    fireEvent.click(caseD);
    await waitFor(() => expect(caseD).toBeChecked());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // UNE RELECTURE DES PROPS, PLUS ANCIENNE QUE L'ACCEPTATION DE D (le
    // serveur l'a lue AVANT que D n'y soit visible) — MAIS RÉELLEMENT
    // DIFFÉRENTE de l'état initial ([] au montage, [C] ici) : l'effet
    // s'exécute bel et bien.
    rerender(elementDeScene({ prestationsInitiales: [PRESTATIONS[0].id] }));
    expect(caseC).toBeChecked();
    expect(caseD).toBeChecked();

    fetchMock.mockClear();
    fireEvent.click(caseD);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/prestations`);
    const corps = options.body as FormData;
    expect(corps.getAll("retirer_id")).toEqual([PRESTATIONS[1].id]);
    expect(corps.getAll("ajouter_id")).toEqual([]);
  });
});

describe("le brouillon rejoue sa PROPRE différence sur la base fraîche au remontage — ce que le bureau a coché depuis n'est jamais effacé (point 3, 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE)", () => {
  it("un brouillon écrit avant l'ajout de D par le bureau ne retire pas D au remontage, et n'envoie que SA propre différence", async () => {
    window.localStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({
        commentaire: "",
        suite: "",
        // Le technicien avait coché C, sur une base alors vide.
        prestationIds: [PRESTATIONS[0].id],
        prestationsBase: [],
        signature: null,
      }),
    );

    // AU REMONTAGE, LE SERVEUR PORTE DÉJÀ D — coché par le bureau pendant
    // que ce brouillon dormait.
    scene({ prestationsInitiales: [PRESTATIONS[1].id] });

    await waitFor(() =>
      expect(screen.getByLabelText(PRESTATIONS[1].libelle)).toBeChecked(),
    );
    expect(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    ).toBeChecked();

    await waitFor(() => {
      const appel = (fetchMock.mock.calls as [string, RequestInit][]).find(
        ([url]) => (url as string).endsWith("/prestations"),
      );
      expect(appel).toBeDefined();
      const corps = appel![1].body as FormData;
      expect(corps.getAll("ajouter_id")).toEqual([PRESTATIONS[0].id]);
      expect(corps.getAll("retirer_id")).toEqual([]);
    });
  });
});

describe("le brouillon est réécrit après chaque envoi de prestations accepté (point 4, 9F4H6F-PRESTATIONS-ANCIEN-CLIENT)", () => {
  // REVUE DU PILOTE sur `12853696` — avant ce correctif, `ecrireBrouillonCourant`
  // n'était rappelé qu'au clic (sur l'ANCIENNE base, avant l'acceptation),
  // jamais après l'acceptation elle-même. `prestationsBase` du brouillon
  // restait alors périmée : au remontage suivant, `fusionnerBrouillonPrestations`
  // rejouait la MÊME différence (déjà acceptée) par-dessus une base fraîche —
  // si le bureau avait, entre-temps, recoché la même prestation, ce rejeu la
  // retirait à tort.
  it("décocher C (accepté), puis le bureau recoche C : un remontage garde C cochée, sans la retirer à nouveau", async () => {
    const { unmount } = scene({
      prestationsInitiales: [PRESTATIONS[0].id],
    });
    const caseC = screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]);
    expect(caseC).toBeChecked();

    fireEvent.click(caseC);
    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.prestations.enregistre"]),
      ).toBeVisible(),
    );
    expect(caseC).not.toBeChecked();

    // L'APPAREIL REDÉMARRE (ou l'onglet se ferme puis se rouvre) — LE
    // BUREAU A RECOCHÉ C ENTRE-TEMPS : le serveur la porte à nouveau.
    unmount();
    scene({ prestationsInitiales: [PRESTATIONS[0].id] });

    // SANS LA RÉÉCRITURE DU BROUILLON APRÈS L'ACCEPTATION, le brouillon
    // rejouerait encore « retirer C » (sa propre différence, déjà
    // acceptée) par-dessus cette base fraîche, et l'effacerait à tort.
    expect(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    ).toBeChecked();
  });
});

describe("le brouillon valide `prestationsBase`, et reprend un brouillon d'une version antérieure sans perte (point 4, 9F4H6F-PRESTATIONS-ANCIEN-CLIENT)", () => {
  it("`prestationsBase` corrompue (pas un tableau de chaînes) ne fait pas lever la reprise du brouillon", () => {
    window.localStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({
        commentaire: "",
        suite: "",
        prestationIds: [PRESTATIONS[0].id],
        prestationsBase: 42,
        signature: null,
      }),
    );

    expect(() => scene({ prestationsInitiales: [] })).not.toThrow();
    expect(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    ).toBeChecked();
  });

  it("un brouillon D'UNE VERSION ANTÉRIEURE, sans `prestationsBase` du tout, reprend ses prestations TELLES QUELLES — jamais effacées par les props fraîches", () => {
    window.localStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({
        commentaire: "",
        suite: "",
        prestationIds: [PRESTATIONS[0].id],
        signature: null,
      }),
    );

    scene({ prestationsInitiales: [] });

    expect(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    ).toBeChecked();
  });
});

describe("le relecteur de « Terminer déjà en file » ne lève jamais sur un geste absent ou nul (point 3, 9F4H6C-FILE-ROBUSTESSE)", () => {
  it("détecte toujours le « démarrer » en file, même quand une AUTRE entrée de la même intervention a un geste `null`", async () => {
    await ecrireEntreeBrute({
      id: "00000000-0000-7000-8000-000000000006",
      interventionId: INTERVENTION_ID,
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      instantAppareil: new Date().toISOString(),
      // UNE ENTRÉE VOISINE, DE FORME ABSOLUMENT ABSENTE — exactement ce que
      // `toutesLesEntrees` (`file-saisies.ts`) pouvait jusqu'ici garder TEL
      // QUEL, et qui levait sur `.type` dans ce même relecteur.
      geste: null,
      motifRefus: null,
    });
    await ajouterSaisie({
      interventionId: INTERVENTION_ID,
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
      geste: { type: "compteur", action: "demarrer" },
    });

    expect(() => scene({ afficherTerminer: false })).not.toThrow();

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.terminer.titre"])).toBeVisible(),
    );
    expect(
      screen.queryByText(fr["terrain.terminer.en_attente_envoi"]),
    ).not.toBeInTheDocument();
  });
});

describe("la signature « client absent » / « refus » s'envoie au blur du motif", () => {
  it("un motif saisi puis quitté envoie {issue, motif}", async () => {
    scene();

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["terrain.signature.option_absent"],
      }),
    );
    const motif = screen.getByLabelText(fr["terrain.signature.motif_libelle"]);
    fireEvent.change(motif, { target: { value: "Client injoignable" } });
    fireEvent.blur(motif);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/signature`);
    const corps = options.body as FormData;
    expect(corps.get("issue")).toBe("client_absent");
    expect(corps.get("motif")).toBe("Client injoignable");
  });

  it("un motif resté vide n'envoie rien", async () => {
    scene();

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["terrain.signature.option_refus"],
      }),
    );
    fireEvent.blur(
      screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
    );

    // Un délai suffit à constater une absence, `waitFor` n'ayant rien de
    // positif à attendre ici.
    await act(async () => {
      await new Promise((resoudre) => setTimeout(resoudre, 10));
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("le message d'échec nomme le bon bloc (9G1-CORRECTIFS-AUDIT-URGENTS, point 3)", () => {
  // AVANT CE POINT : `texteIndicatif` disait toujours « Le rapport n'a pas
  // pu être enregistré » (`terrain.rapport.refus`), même pour un échec de
  // PRESTATIONS ou de SIGNATURE — un message faux qui désignait le mauvais
  // bloc au technicien.
  it("un échec serveur sur les prestations affiche son propre refus, jamais celui du rapport", async () => {
    fetchMock = vi.fn((url: unknown) =>
      (url as string).endsWith("/prestations")
        ? Promise.resolve({
            json: () =>
              Promise.resolve({
                ok: false,
                motif: "terrain.prestations.refus",
              }),
          })
        : Promise.resolve({
            json: () => Promise.resolve({ ok: true, motif: null }),
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    scene({ prestationsInitiales: [] });

    fireEvent.click(
      screen.getByLabelText(fr["terrain.e2e.prestation_libelle"]),
    );

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.prestations.refus"])).toBeVisible(),
    );
    expect(screen.queryByText(fr["terrain.rapport.refus"])).toBeNull();
  });

  it("un échec serveur sur la signature affiche son propre refus, jamais celui du rapport", async () => {
    fetchMock = vi.fn((url: unknown) =>
      (url as string).endsWith("/signature")
        ? Promise.resolve({
            json: () =>
              Promise.resolve({ ok: false, motif: "terrain.signature.refus" }),
          })
        : Promise.resolve({
            json: () => Promise.resolve({ ok: true, motif: null }),
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    scene();

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["terrain.signature.option_absent"],
      }),
    );
    const motif = screen.getByLabelText(fr["terrain.signature.motif_libelle"]);
    fireEvent.change(motif, { target: { value: "Client injoignable" } });
    fireEvent.blur(motif);

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.signature.refus"])).toBeVisible(),
    );
    expect(screen.queryByText(fr["terrain.rapport.refus"])).toBeNull();
  });
});

describe("le bouton Terminer, hors connexion", () => {
  // DEPUIS 9F4H3-HORS-RESEAU-ENVOYER (point 1, décision n° 108 d'Alexis) —
  // « Terminer » hors réseau n'est plus un refus générique
  // (`terrain.terminer.sans_reseau`, superseded) : il est ACCEPTÉ et mis en
  // file, SIGNATURE COMPRISE. Sans signature saisie (ce `scene()` n'en pose
  // aucune), le refus vient désormais du verdict LOCAL `peutTerminer`
  // (point 4, 9F4H3A, C5) — même clé que le serveur poserait pour ce même
  // manque, mais SEUL (plus de prefixe `signature_non_enregistree`) : le
  // verdict local nomme la cause réelle, qu'elle soit le temps ou la
  // signature, jamais une seule d'entre elles supposée par construction.
  it("sans signature saisie, affiche le motif de signature manquante et n'appelle jamais la route", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    try {
      scene({ afficherTerminer: true });

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getByText(fr["intervention.refus.signature_manquante"]),
        ).toBeVisible(),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});

describe("« Terminer » n'appelle jamais /terminer tant qu'un bloc n'est pas accepté (9F4A, point 1)", () => {
  it("un rapport refusé par le serveur bloque Terminer, et garde le brouillon", async () => {
    fetchMock = vi.fn((url: unknown) => {
      if ((url as string).endsWith("/rapport")) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({ ok: false, motif: "terrain.rapport.refus" }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ ok: true, motif: null }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    scene({ afficherTerminer: true });

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);
    await waitFor(() =>
      expect(screen.getByText(fr["terrain.rapport.refus"])).toBeVisible(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          `${fr["terrain.terminer.rapport_non_enregistre"]}${fr["terrain.rapport.refus"]}`,
        ),
      ).toBeVisible(),
    );
    expect(
      (fetchMock.mock.calls as [string, RequestInit][]).some(([url]) =>
        url.endsWith("/terminer"),
      ),
    ).toBe(false);
    expect(window.localStorage.getItem(CLE_BROUILLON)).not.toBeNull();
  });

  // INCHANGÉ PAR 9F4H3-HORS-RESEAU-ENVOYER — la décision n° 108 (Terminer
  // accepté et mis en file) ne se déclenche que sur `!navigator.onLine`
  // (mode avion RÉEL), jamais sur un simple échec de requête alors que
  // l'appareil se croit en ligne : ce scénario (9F4A) reste donc le refus
  // d'origine, rejouable par un second clic.
  it("un rapport jamais parti faute de réseau bloque Terminer, et garde le brouillon", async () => {
    fetchMock = vi.fn((url: unknown) => {
      if ((url as string).endsWith("/rapport")) {
        return Promise.reject(new Error("réseau indisponible"));
      }
      return Promise.resolve({
        json: () => Promise.resolve({ ok: true, motif: null }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    scene({ afficherTerminer: true });

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);
    await waitFor(() =>
      expect(screen.getByText(fr["terrain.auto.hors_ligne"])).toBeVisible(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.terminer.sans_reseau"]),
      ).toBeVisible(),
    );
    expect(
      (fetchMock.mock.calls as [string, RequestInit][]).some(([url]) =>
        url.endsWith("/terminer"),
      ),
    ).toBe(false);
    expect(window.localStorage.getItem(CLE_BROUILLON)).not.toBeNull();
  });

  it("tout accepté : /terminer est appelé, puis le brouillon est effacé", async () => {
    window.localStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({
        commentaire: "Prêt à synchroniser",
        suite: "",
        prestationIds: [],
        signature: null,
      }),
    );

    scene({ afficherTerminer: true });

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.rapport.enregistre"])).toBeVisible(),
    );
    fetchMock.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    );

    await waitFor(() => expect(POUSSER).toHaveBeenCalledTimes(1));
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/terrain/${INTERVENTION_ID}/terminer`);
    expect(window.localStorage.getItem(CLE_BROUILLON)).toBeNull();
  });
});

describe("chaque envoi abandonne après 15 s, plutôt que de bloquer Terminer indéfiniment (point 3)", () => {
  // INCHANGÉ PAR 9F4H3-HORS-RESEAU-ENVOYER — voir le `describe` précédent :
  // ce n'est pas `!navigator.onLine`, donc le refus d'origine (9F4A).
  it("le bloc passe hors connexion, et « Terminer » se réactive avec le message sans réseau", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock = vi.fn(
      (_url: unknown, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            reject(new DOMException("Abandon", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    scene({ afficherTerminer: true });

    fireEvent.change(
      screen.getByLabelText(fr["terrain.rapport.commentaire_libelle"]),
      { target: { value: "Filtre remplacé" } },
    );

    fireEvent.click(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    );
    expect(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() =>
      expect(
        screen.getByText(fr["terrain.terminer.sans_reseau"]),
      ).toBeVisible(),
    );
    expect(
      screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).not.toBeDisabled();
  });
});

describe("« Terminer » hors réseau AVEC signature est accepté et mis en file (9F4H3-HORS-RESEAU-ENVOYER, point 1, décision n° 108)", () => {
  it("met « terminer » en file plutôt que de refuser, et montre l'attente d'envoi", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    try {
      scene({ afficherTerminer: true });

      fireEvent.click(
        screen.getByRole("button", {
          name: fr["terrain.signature.option_absent"],
        }),
      );
      fireEvent.change(
        screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
        { target: { value: "Client absent au départ du technicien" } },
      );

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getByText(fr["terrain.terminer.en_attente_envoi"]),
        ).toBeVisible(),
      );
      expect(
        screen.queryByRole("button", { name: fr["terrain.terminer.bouton"] }),
      ).not.toBeInTheDocument();
      expect(
        (fetchMock.mock.calls as [string, RequestInit][]).some(([url]) =>
          url.endsWith("/terminer"),
        ),
      ).toBe(false);
      // RIEN NE SE PERD (point 3) : le brouillon reste jusqu'à l'envoi réel.
      expect(window.localStorage.getItem(CLE_BROUILLON)).not.toBeNull();
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});

describe("jamais « gardé » sans preuve, quand IndexedDB échoue (point 2, 9F4H3A)", () => {
  it("un rapport jamais parti ET non gardé affiche l'échec, jamais « hors ligne »", async () => {
    restaurerIndexedDB();
    restaurerIndexedDB = installerIndexedDBFactice({ enPanne: true });
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);

    scene();

    const champ = screen.getByLabelText(
      fr["terrain.rapport.commentaire_libelle"],
    );
    fireEvent.change(champ, { target: { value: "Filtre remplacé" } });
    fireEvent.blur(champ);

    await waitFor(() =>
      expect(screen.getByText(fr["terrain.file.echec_gardee"])).toBeVisible(),
    );
    expect(
      screen.queryByText(fr["terrain.auto.hors_ligne"]),
    ).not.toBeInTheDocument();
  });

  it("« Terminer » hors réseau, IndexedDB en panne : aucune promesse d'attente", async () => {
    restaurerIndexedDB();
    restaurerIndexedDB = installerIndexedDBFactice({ enPanne: true });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    try {
      scene({ afficherTerminer: true });

      fireEvent.click(
        screen.getByRole("button", {
          name: fr["terrain.signature.option_absent"],
        }),
      );
      fireEvent.change(
        screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
        { target: { value: "Client absent au départ du technicien" } },
      );

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getAllByText(fr["terrain.file.echec_gardee"]).length,
        ).toBeGreaterThan(0),
      );
      // LE BOUTON RESTE : rien n'a été gardé, le geste doit pouvoir être
      // retenté plutôt que de disparaître derrière « en attente d'envoi ».
      expect(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(fr["terrain.terminer.en_attente_envoi"]),
      ).not.toBeInTheDocument();
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});

describe("un identifiant dès le premier essai, pour la signature (point 3, C7)", () => {
  it("le premier essai EN LIGNE porte operation_id, et la file garde le MÊME identifiant", async () => {
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);

    scene();

    fireEvent.click(
      screen.getByRole("button", {
        name: fr["terrain.signature.option_absent"],
      }),
    );
    const motif = screen.getByLabelText(fr["terrain.signature.motif_libelle"]);
    fireEvent.change(motif, { target: { value: "Client injoignable" } });
    fireEvent.blur(motif);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const idPremierEssai = (options.body as FormData).get("operation_id");
    expect(typeof idPremierEssai).toBe("string");

    const file = await listerFilePourIntervention(INTERVENTION_ID, {
      utilisateurId: UTILISATEUR_ID,
      societeId: SOCIETE_ID,
    });
    expect(file).toHaveLength(1);
    expect(file[0].id).toBe(idPremierEssai);
  });
});

describe("« Terminer » hors réseau ne ment pas sur ce qu'il a gardé (point 4, 9F4H3AC)", () => {
  it("signature en échec de garde : jamais « en attente d'envoi », même si « terminer » aurait réussi", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    fetchMock = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchMock);
    // SEULE LA SIGNATURE ÉCHOUE À ÊTRE GARDÉE — rapport et prestations
    // n'ont pas changé (rien à mettre en file), « terminer » réussirait si
    // on le tentait : c'est justement ce que ce test interdit.
    controleAjout.echouerPourType = "signature";
    try {
      scene({ afficherTerminer: true });

      fireEvent.click(
        screen.getByRole("button", {
          name: fr["terrain.signature.option_absent"],
        }),
      );
      fireEvent.change(
        screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
        { target: { value: "Client absent au départ du technicien" } },
      );

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getAllByText(fr["terrain.file.echec_gardee"]).length,
        ).toBeGreaterThan(0),
      );
      expect(
        screen.queryByText(fr["terrain.terminer.en_attente_envoi"]),
      ).not.toBeInTheDocument();
      const file = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      expect(file.some((e) => e.geste.type === "terminer")).toBe(false);
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });
});

describe("le verdict local de « Terminer », hors réseau (point 4, 9F4H3A, C5)", () => {
  it("aucun temps mesuré, ni connu ni en file : refuse « temps manquant », rien en file", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    try {
      scene({ afficherTerminer: true, minutesConnues: 0 });

      fireEvent.click(
        screen.getByRole("button", {
          name: fr["terrain.signature.option_absent"],
        }),
      );
      fireEvent.change(
        screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
        { target: { value: "Client absent au départ du technicien" } },
      );

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getByText(fr["intervention.refus.temps_manquant"]),
        ).toBeVisible(),
      );
      const file = await listerFilePourIntervention(INTERVENTION_ID, {
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
      });
      expect(file.some((e) => e.geste.type === "terminer")).toBe(false);
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });

  it("aucune minute connue, mais un segment FERMÉ dans la file : accepté et mis en file", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    try {
      // DES IDENTIFIANTS EXPLICITEMENT ORDONNÉS — deux appels d'affilée
      // peuvent tomber dans la MÊME milliseconde, où le tri lexicographique
      // d'un UUID v7 dépend alors des octets aléatoires, pas de l'ordre
      // d'appel (voir l'en-tête de `file-saisies.ts`) ; sans réseau humain
      // entre les deux clics, ce test fixe l'ordre pour rester déterministe.
      await ajouterSaisie({
        interventionId: INTERVENTION_ID,
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
        geste: { type: "compteur", action: "demarrer" },
        instantAppareil: "2026-10-18T03:00:00.000Z",
        id: "01111111-1111-7111-8111-111111111111",
      });
      await ajouterSaisie({
        interventionId: INTERVENTION_ID,
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
        geste: { type: "compteur", action: "arreter" },
        instantAppareil: "2026-10-18T03:10:00.000Z",
        id: "02222222-2222-7222-8222-222222222222",
      });

      scene({ afficherTerminer: true, minutesConnues: 0 });

      fireEvent.click(
        screen.getByRole("button", {
          name: fr["terrain.signature.option_absent"],
        }),
      );
      fireEvent.change(
        screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
        { target: { value: "Client absent au départ du technicien" } },
      );

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getByText(fr["terrain.terminer.en_attente_envoi"]),
        ).toBeVisible(),
      );
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });

  it("un « démarrer » resté seul en file (compteur encore ouvert) : accepté et mis en file, PAS « temps manquant » (correctif 9F4H3AA)", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    try {
      // AUCUN « ARRÊTER » — le cas ORDINAIRE : le technicien clique
      // « Terminer » directement, sans mettre le compteur en pause d'abord.
      // Le serveur fermerait ce segment sur l'instant du « terminer »
      // (`terminerIntervention`) ; la file ne le ferme jamais elle-même.
      await ajouterSaisie({
        interventionId: INTERVENTION_ID,
        utilisateurId: UTILISATEUR_ID,
        societeId: SOCIETE_ID,
        geste: { type: "compteur", action: "demarrer" },
        instantAppareil: "2026-10-18T03:00:00.000Z",
        id: "03333333-3333-7333-8333-333333333333",
      });

      scene({ afficherTerminer: true, minutesConnues: 0 });

      fireEvent.click(
        screen.getByRole("button", {
          name: fr["terrain.signature.option_absent"],
        }),
      );
      fireEvent.change(
        screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
        { target: { value: "Client absent au départ du technicien" } },
      );

      fireEvent.click(
        screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      );

      await waitFor(() =>
        expect(
          screen.getByText(fr["terrain.terminer.en_attente_envoi"]),
        ).toBeVisible(),
      );
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine;
    }
  });

  // UN COMPTEUR DÉMARRÉ EN LIGNE (point 3, 9F4H3AC) — le serveur connaît déjà
  // un segment ouvert (`segmentOuvertConnu`), que la file, elle, ignore
  // puisque ce « démarrer » n'y est jamais passé.
  describe("un compteur démarré EN LIGNE, connu du serveur (point 3, 9F4H3AC)", () => {
    it("(a) rien en file : accepté localement et rangé, jamais « temps manquant »", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      try {
        scene({
          afficherTerminer: true,
          minutesConnues: 0,
          segmentOuvertConnu: { debut: "2026-10-18T03:00:00.000Z" },
        });

        fireEvent.click(
          screen.getByRole("button", {
            name: fr["terrain.signature.option_absent"],
          }),
        );
        fireEvent.change(
          screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
          { target: { value: "Client absent au départ du technicien" } },
        );

        fireEvent.click(
          screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
        );

        await waitFor(() =>
          expect(
            screen.getByText(fr["terrain.terminer.en_attente_envoi"]),
          ).toBeVisible(),
        );
        expect(
          screen.queryByText(fr["intervention.refus.temps_manquant"]),
        ).not.toBeInTheDocument();
      } finally {
        delete (window.navigator as { onLine?: boolean }).onLine;
      }
    });

    it("(b) un « arrêter » seul hors réseau en file ferme ce segment : minutes > 0, accepté", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      try {
        await ajouterSaisie({
          interventionId: INTERVENTION_ID,
          utilisateurId: UTILISATEUR_ID,
          societeId: SOCIETE_ID,
          geste: { type: "compteur", action: "arreter" },
          instantAppareil: "2026-10-18T03:10:00.000Z",
          id: "04444444-4444-7444-8444-444444444444",
        });

        scene({
          afficherTerminer: true,
          minutesConnues: 0,
          segmentOuvertConnu: { debut: "2026-10-18T03:00:00.000Z" },
        });

        fireEvent.click(
          screen.getByRole("button", {
            name: fr["terrain.signature.option_absent"],
          }),
        );
        fireEvent.change(
          screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
          { target: { value: "Client absent au départ du technicien" } },
        );

        fireEvent.click(
          screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
        );

        await waitFor(() =>
          expect(
            screen.getByText(fr["terrain.terminer.en_attente_envoi"]),
          ).toBeVisible(),
        );
      } finally {
        delete (window.navigator as { onLine?: boolean }).onLine;
      }
    });

    it("(c) aucun segment nulle part (ni serveur, ni file) : refus « temps manquant » CONSERVÉ", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      try {
        scene({
          afficherTerminer: true,
          minutesConnues: 0,
          segmentOuvertConnu: null,
        });

        fireEvent.click(
          screen.getByRole("button", {
            name: fr["terrain.signature.option_absent"],
          }),
        );
        fireEvent.change(
          screen.getByLabelText(fr["terrain.signature.motif_libelle"]),
          { target: { value: "Client absent au départ du technicien" } },
        );

        fireEvent.click(
          screen.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
        );

        await waitFor(() =>
          expect(
            screen.getByText(fr["intervention.refus.temps_manquant"]),
          ).toBeVisible(),
        );
        const file = await listerFilePourIntervention(INTERVENTION_ID, {
          utilisateurId: UTILISATEUR_ID,
          societeId: SOCIETE_ID,
        });
        expect(file.some((e) => e.geste.type === "terminer")).toBe(false);
      } finally {
        delete (window.navigator as { onLine?: boolean }).onLine;
      }
    });
  });
});
