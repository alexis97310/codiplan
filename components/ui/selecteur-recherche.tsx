"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { t } from "@/lib/i18n/fr";

/**
 * LE SÉLECTEUR DE RECHERCHE SERVEUR (SELECTEURS-1, 24/09/2026).
 *
 * ## Ce qu'il répare
 *
 * Trois écrans (`/sites/nouveau`, `/interventions/nouvelle`, `/parc/nouvelle`)
 * peuplaient un `<select>` avec un référentiel entier — coupé à 50 ou 200
 * lignes, ou complet mais gigantesque après `tousLesResultats`. Ce composant
 * remplace le `<select>` par un champ texte qui interroge une route de
 * recherche SERVEUR (`app/api/recherche/*`), déjà cloisonnée, 20 résultats à
 * la fois, « Voir plus » pour la suite. Aucun référentiel n'est plus chargé
 * en entier pour peupler un formulaire.
 *
 * ## Il ne reçoit que des chaînes et des données — jamais une fonction
 * transmise depuis un composant SERVEUR
 *
 * *Une page serveur qui passerait une fonction à un composant `"use client"`
 * rend un écran mort dès sa livraison* (panne #266, voir
 * `components/interventions/site-et-machines.tsx`). `onChoix` est un
 * paramètre légitime ICI parce que ce composant n'est jamais rendu QUE par un
 * autre composant CLIENT — jamais directement par un `page.tsx` serveur.
 *
 * ## La composition avec un choix précédent (client → site)
 *
 * `parametres` porte des critères FIXES à joindre à chaque requête — par
 * exemple `{ client: clientChoisiId }`. Quand cette valeur change, l'appelant
 * doit remonter ce composant (`key={clientChoisiId}`) : un sélecteur de site
 * qui garderait sa sélection après un changement de client afficherait le
 * site d'un AUTRE client.
 *
 * ## `TOption` — la même route sert des formulaires qui n'attendent pas la
 * même valeur
 *
 * `/api/recherche/sites` sert `/parc/nouvelle` (qui soumet `site_id`, un UUID
 * nu) ET `/interventions/nouvelle` (qui soumet `site`, le couple
 * `client_id:site_id` — voir `app/api/interventions/creer/route.ts`). La
 * route ne peut pas deviner pour lequel des deux elle répond ; c'est donc
 * l'APPELANT qui choisit, par `versValeurChamp`, jamais la route elle-même.
 *
 * ## LE PANNEAU DE RÉSULTATS EST EN `position: fixed` (9I7E-CREER-MACHINE-
 * LISTES-DEROULANTES, repris 31/10/2026 — 9I7E1-REPRISE-9I7E)
 *
 * *Signalé par Alexis* : sur `/parc/nouvelle`, la liste s'ouvrait bien, mais
 * se faisait couper par le bas de la carte qui contient le champ — mesuré :
 * `SectionFormulaire` pose chaque champ DANS une `Carte`
 * (`components/ui/carte.tsx`), et `Carte` pose `overflow-hidden` sur sa
 * racine pour que ses coins restent arrondis. Un panneau `absolute` ouvert
 * près du bas de cette carte se faisait rogner par cette même règle — la
 * carte n'a pas la hauteur du panneau, seulement celle de son contenu.
 *
 * **Une première version (9I7E) rendait ce panneau par `createPortal` dans
 * `document.body`** — ce qui échappe bien au rognage, mais sort aussi le
 * panneau du sous-arbre DOM que les épreuves cherchent
 * (`[data-selecteur="…"] ul[role="listbox"]`, voir
 * `tests/e2e/setup/selecteur-recherche.ts`), et de la portée d'un dialogue
 * (`aria-modal`). 38 épreuves en sont tombées. Le panneau reste donc un
 * ENFANT ordinaire du composant, mais en `position: fixed` plutôt
 * qu'`absolute` : ses coordonnées, recalculées depuis le champ texte
 * (`getBoundingClientRect`) à l'ouverture, au défilement (n'importe quel
 * ancêtre, par l'écoute `capture`) et au redimensionnement, le placent hors
 * du flux normal — `position: fixed` se positionne par rapport à la fenêtre
 * (ou au bloc conteneur le plus proche avec `transform`/`filter`/`contain`,
 * qu'aucun ancêtre ne pose ici — `Carte`, `Volet`), jamais par rapport à un
 * ancêtre qui rogne ou fait défiler, DOM inchangé ou pas.
 *
 * ## LE PANNEAU SE RETOURNE VERS LE HAUT, SE FERME SOUS LE BANDEAU, ET
 * S'ANCRE SOUS LE LABEL ENTIER (9I8E-RESERVES-LISTES-ET-PIECES, réserves de
 * revue de 9I7E/9I7E1)
 *
 * Trois défauts mesurés sur la version `position: fixed` ci-dessus : (a)
 * `top: rect.bottom + 4` ne retournait jamais vers le haut ni ne bornait sa
 * hauteur à l'espace restant — un champ près du bas d'un formulaire défilé
 * ouvrait une liste qui débordait hors de la fenêtre ; (b) rien ne fermait
 * la liste quand le CHAMP lui-même sortait de la zone visible (défilé sous
 * le bandeau sticky, ou derrière la barre basse fixe) — elle restait peinte
 * là où le bandeau ou la barre basse se trouvent ; (c) l'ancrage se faisait
 * sous le CHAMP TEXTE seul, pas sous le label entier, si bien que la liste
 * recouvrait l'aide ou le message « choix requis » qui le suivent.
 *
 * `champEstVisible` répond (b) en testant, par `elementFromPoint` au centre
 * du champ — même technique que `assertListeVisibleEtCliquable`, qui
 * l'éprouve à l'écran plutôt qu'à la géométrie seule —, si quelque chose
 * d'AUTRE que le champ occupe ce point : un bandeau sticky ou une barre
 * basse fixe, peints PAR-DESSUS au défilement, y répondent sans que ce
 * fichier ait besoin de connaître leur hauteur. La liste se ferme alors
 * plutôt que de rester peinte derrière eux.
 *
 * `recalculer` répond (a) en comparant l'espace sous le LABEL entier à
 * celui au-dessus : s'il manque de place en bas, le panneau s'ouvre vers le
 * HAUT (ancré par `bottom`, pas par `top`, pour ne jamais dépendre d'une
 * hauteur de contenu pas encore connue), et dans les deux sens sa hauteur
 * (`max-height` en ligne, plus `max-h-64` en classe) est bornée à l'espace
 * réellement disponible — jamais hors de la fenêtre.
 *
 * (c) se répare en ancrant sur `labelRef` (le `<label>` entier — libellé,
 * champ, aide ou erreur) plutôt que sur `champTexte` (le seul champ texte) :
 * `left`/`width` restent ceux du champ, pour que le panneau garde sa largeur
 * d'avant, mais le bord vertical qui le positionne est celui du label.
 *
 * `z-50` (plutôt que l'ancien `z-[1000]`, hors de l'échelle du dépôt) reste
 * au-dessus du bandeau (`z-20`, `bandeau-bureau.tsx`/`bandeau-mobile.tsx`) en
 * tant que frère plus tardif dans le DOM, et, imbriqué dans un volet
 * (`volet.tsx`, `z-50` lui aussi), reste dans le contexte d'empilement que
 * le volet forme — au-dessus du reste de son contenu — sans avoir besoin
 * d'une valeur hors échelle.
 */

export type OptionRecherche = {
  readonly id: string;
  readonly libelle: string;
};

type ReponseRecherche<TOption> = {
  readonly resultats: readonly TOption[];
  readonly page: number;
  readonly limite: number;
  readonly total: number;
};

const DELAI_RECHERCHE_MS = 250;
const HAUTEUR_LISTE_SOUHAITEE_PX = 256; // 16rem — même borne que l'ancien `max-h-64`
const MARGE_LISTE_PX = 4;

type PositionListe =
  | {
      readonly ancrage: "bas";
      readonly top: number;
      readonly left: number;
      readonly width: number;
      readonly hauteurMax: number;
    }
  | {
      readonly ancrage: "haut";
      readonly bottom: number;
      readonly left: number;
      readonly width: number;
      readonly hauteurMax: number;
    };

/**
 * LE CHAMP EST-IL RÉELLEMENT VISIBLE — PAS SEULEMENT DANS LES BORNES DE LA
 * FENÊTRE, MAIS NON RECOUVERT ? Même technique que `assertListeVisibleEt
 * Cliquable` (`tests/e2e/setup/selecteur-recherche.ts`) : `elementFromPoint`
 * au centre du champ répond à la question sans que ce fichier ait besoin de
 * connaître la hauteur du bandeau sticky ou de la barre basse fixe qui
 * pourraient le recouvrir au défilement — quel que soit l'écran.
 */
function champEstVisible(champ: HTMLInputElement, rect: DOMRect): boolean {
  // AUCUNE GÉOMÉTRIE RÉELLE (jsdom, dans les épreuves de composant — jamais
  // un navigateur réel) : `getBoundingClientRect`/`elementFromPoint` y
  // rendent des zéros, pas une absence de mise en page. Rien à conclure,
  // jamais fermer sur la foi d'une mesure qui n'en est pas une.
  if (rect.width === 0 && rect.height === 0) {
    return true;
  }
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
    return false;
  }
  const y = Math.min(
    Math.max(rect.top + rect.height / 2, 0),
    window.innerHeight - 1,
  );
  const x = rect.left + rect.width / 2;
  const element = document.elementFromPoint(x, y);
  return element === champ || (element?.contains(champ) ?? false);
}

export function SelecteurRecherche<TOption extends OptionRecherche>({
  nom,
  url,
  parametres,
  libelle,
  libelleAucunResultat,
  libelleVoirPlus,
  valeurInitiale,
  obligatoire = false,
  disabled = false,
  aide,
  versValeurChamp = (option) => option.id,
  onChoix,
}: Readonly<{
  /** Le nom du champ caché soumis avec le formulaire. */
  nom: string;
  /** La route de recherche, par ex. `/api/recherche/clients`. */
  url: string;
  /** Critères fixes joints à chaque requête (`client`, `famille`, …). */
  parametres?: Readonly<Record<string, string>>;
  libelle: string;
  libelleAucunResultat: string;
  libelleVoirPlus: string;
  /** La sélection déjà faite — préremplissage (LIENS-1) ou mode modification. */
  valeurInitiale?: TOption;
  obligatoire?: boolean;
  disabled?: boolean;
  aide?: string;
  /** La valeur SOUMISE pour une option choisie — `id` par défaut. */
  versValeurChamp?: (option: TOption) => string;
  /** Appelé quand la sélection change — jamais transmis depuis un serveur. */
  onChoix?: (option: TOption | null) => void;
}>) {
  const [texte, setTexte] = useState(valeurInitiale?.libelle ?? "");
  const [selection, setSelection] = useState<TOption | null>(
    valeurInitiale ?? null,
  );
  const [resultats, setResultats] = useState<readonly TOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [survol, setSurvol] = useState(-1);
  const [choixManquant, setChoixManquant] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jetonRequete = useRef(0);
  const champTexte = useRef<HTMLInputElement | null>(null);
  const labelEntier = useRef<HTMLLabelElement | null>(null);
  const [positionListe, setPositionListe] = useState<PositionListe | null>(
    null,
  );

  useEffect(
    () => () => {
      if (minuteur.current !== null) {
        clearTimeout(minuteur.current);
      }
    },
    [],
  );

  /**
   * LA POSITION DU PANNEAU, RECALCULÉE DEPUIS LE CHAMP TEXTE — voir la note
   * de tête sur `position: fixed`. L'écoute du défilement est posée en CAPTURE sur
   * `window` : un ancêtre scrollable (la carte n'en est pas une, mais le
   * volet de `/demandes` l'est) ne fait pas remonter son évènement `scroll`
   * jusqu'à `window` par bouillonnement, seule la phase de capture le voit.
   */
  useLayoutEffect(() => {
    if (!ouvert) {
      return;
    }
    function recalculer() {
      const champ = champTexte.current;
      const rectLabel = labelEntier.current?.getBoundingClientRect();
      if (champ === null || rectLabel === undefined) {
        return;
      }
      const rectChamp = champ.getBoundingClientRect();
      if (!champEstVisible(champ, rectChamp)) {
        setOuvert(false);
        setPositionListe(null);
        return;
      }
      const espaceBas = window.innerHeight - rectLabel.bottom - MARGE_LISTE_PX;
      const espaceHaut = rectLabel.top - MARGE_LISTE_PX;
      const versLeHaut =
        espaceBas < HAUTEUR_LISTE_SOUHAITEE_PX && espaceHaut > espaceBas;
      const hauteurMax = Math.max(
        0,
        Math.min(
          HAUTEUR_LISTE_SOUHAITEE_PX,
          versLeHaut ? espaceHaut : espaceBas,
        ),
      );
      setPositionListe(
        versLeHaut
          ? {
              ancrage: "haut",
              bottom: window.innerHeight - rectLabel.top + MARGE_LISTE_PX,
              left: rectChamp.left,
              width: rectChamp.width,
              hauteurMax,
            }
          : {
              ancrage: "bas",
              top: rectLabel.bottom + MARGE_LISTE_PX,
              left: rectChamp.left,
              width: rectChamp.width,
              hauteurMax,
            },
      );
    }
    recalculer();
    window.addEventListener("scroll", recalculer, true);
    window.addEventListener("resize", recalculer);
    return () => {
      window.removeEventListener("scroll", recalculer, true);
      window.removeEventListener("resize", recalculer);
    };
  }, [ouvert]);

  /**
   * UN TEXTE TAPÉ SANS ÊTRE CHOISI NE PART JAMAIS AU SERVEUR (9G6-FORMULAIRES,
   * point 1) — le champ caché n'est rempli QUE par `choisir` ; `required` sur
   * le champ texte visible ne bloque qu'un champ VIDE, jamais un texte tapé
   * sans sélection choisie dans la liste. `setCustomValidity` rend donc le
   * champ INVALIDE tant que ce cas tient, ce qui empêche nativement
   * l'évènement `submit` de se déclencher — jamais un `evenement.
   * preventDefault()` posé à la main sur ce `submit`, qui s'exécuterait
   * APRÈS celui de `BoutonCreer` (même formulaire, même évènement) et
   * désactiverait le bouton sans retour possible.
   */
  useEffect(() => {
    champTexte.current?.setCustomValidity(
      obligatoire && selection === null && texte.trim() !== ""
        ? t("selecteur.choix_requis")
        : "",
    );
  }, [obligatoire, selection, texte]);

  async function chercher(q: string, pageDemandee: number, remplacer: boolean) {
    const jeton = ++jetonRequete.current;
    const params = new URLSearchParams({
      q,
      page: String(pageDemandee),
      ...(parametres ?? {}),
    });
    let reponse: Response;
    try {
      reponse = await fetch(`${url}?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
    } catch {
      return;
    }
    if (jeton !== jetonRequete.current || !reponse.ok) {
      return;
    }
    const corps = (await reponse
      .json()
      .catch(() => null)) as ReponseRecherche<TOption> | null;
    if (corps === null || jeton !== jetonRequete.current) {
      return;
    }
    setResultats((precedent) =>
      remplacer ? corps.resultats : [...precedent, ...corps.resultats],
    );
    setPage(corps.page);
    setTotal(corps.total);
  }

  function surChangementTexte(valeur: string) {
    setTexte(valeur);
    setChoixManquant(false);
    if (selection !== null) {
      setSelection(null);
      onChoix?.(null);
    }
    setOuvert(true);
    setSurvol(-1);
    if (minuteur.current !== null) {
      clearTimeout(minuteur.current);
    }
    minuteur.current = setTimeout(() => {
      void chercher(valeur, 1, true);
    }, DELAI_RECHERCHE_MS);
  }

  function choisir(option: TOption) {
    setSelection(option);
    setTexte(option.libelle);
    setChoixManquant(false);
    setOuvert(false);
    setSurvol(-1);
    onChoix?.(option);
  }

  function surFocus() {
    setOuvert(true);
    if (resultats.length === 0) {
      void chercher(texte, 1, true);
    }
  }

  function surClavier(evenement: React.KeyboardEvent<HTMLInputElement>) {
    if (evenement.key === "ArrowDown") {
      evenement.preventDefault();
      setOuvert(true);
      setSurvol((s) => Math.min(s + 1, resultats.length - 1));
    } else if (evenement.key === "ArrowUp") {
      evenement.preventDefault();
      setSurvol((s) => Math.max(s - 1, 0));
    } else if (evenement.key === "Enter") {
      const cible = resultats[survol];
      if (ouvert && cible !== undefined) {
        evenement.preventDefault();
        choisir(cible);
      }
    } else if (evenement.key === "Escape") {
      setOuvert(false);
      setSurvol(-1);
    }
  }

  const peutVoirPlus = resultats.length < total;

  return (
    <label
      ref={labelEntier}
      data-selecteur={nom}
      className="relative flex flex-col gap-1 text-13 font-bold"
    >
      {libelle}
      <input
        type="hidden"
        name={nom}
        value={selection === null ? "" : versValeurChamp(selection)}
      />
      <input
        ref={champTexte}
        type="text"
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={`${nom}-resultats`}
        aria-autocomplete="list"
        aria-invalid={choixManquant}
        required={obligatoire}
        value={texte}
        disabled={disabled}
        onChange={(evenement) => surChangementTexte(evenement.target.value)}
        onFocus={surFocus}
        onKeyDown={surClavier}
        onBlur={() => {
          window.setTimeout(() => setOuvert(false), 150);
        }}
        onInvalid={(evenement) => {
          if (selection === null && texte.trim() !== "") {
            evenement.preventDefault();
            setChoixManquant(true);
            champTexte.current?.focus();
          }
        }}
        autoComplete="off"
        className="border-app-bord bg-app-surface rounded-md border px-3 py-1.5 text-[13px] font-bold disabled:opacity-50"
      />
      {choixManquant ? (
        <p role="alert" className="text-app-rouge-encre text-12 font-bold">
          {t("selecteur.choix_requis")}
        </p>
      ) : aide === undefined ? null : (
        <span className="text-app-encre-faible text-12 font-bold">{aide}</span>
      )}
      {ouvert && !disabled && positionListe !== null ? (
        <div
          style={{
            position: "fixed",
            left: positionListe.left,
            width: positionListe.width,
            maxHeight: positionListe.hauteurMax,
            ...(positionListe.ancrage === "bas"
              ? { top: positionListe.top }
              : { bottom: positionListe.bottom }),
          }}
          className="border-app-bord bg-app-surface z-50 overflow-auto rounded-md border shadow-md"
        >
          {resultats.length === 0 ? (
            <p className="text-app-encre-faible px-3 py-2 text-13 font-bold">
              {libelleAucunResultat}
            </p>
          ) : (
            <ul id={`${nom}-resultats`} role="listbox">
              {resultats.map((option, indice) => (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={indice === survol}
                >
                  <button
                    type="button"
                    onMouseDown={(evenement) => evenement.preventDefault()}
                    onClick={() => choisir(option)}
                    className={`block w-full px-3 py-1.5 text-left text-13 font-bold ${
                      indice === survol ? "bg-app-fond" : ""
                    }`}
                  >
                    {option.libelle}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {peutVoirPlus ? (
            <button
              type="button"
              onMouseDown={(evenement) => evenement.preventDefault()}
              onClick={() => void chercher(texte, page + 1, false)}
              className="text-app-encre-faible block w-full px-3 py-1.5 text-left text-13 font-bold"
            >
              {libelleVoirPlus}
            </button>
          ) : null}
        </div>
      ) : null}
    </label>
  );
}
