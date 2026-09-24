"use client";

import { useEffect, useRef, useState } from "react";

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
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jetonRequete = useRef(0);

  useEffect(
    () => () => {
      if (minuteur.current !== null) {
        clearTimeout(minuteur.current);
      }
    },
    [],
  );

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
    <label className="relative flex flex-col gap-1 text-[12.5px] font-semibold">
      {libelle}
      <input
        type="hidden"
        name={nom}
        value={selection === null ? "" : versValeurChamp(selection)}
      />
      <input
        type="text"
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={`${nom}-resultats`}
        aria-autocomplete="list"
        required={obligatoire}
        value={texte}
        disabled={disabled}
        onChange={(evenement) => surChangementTexte(evenement.target.value)}
        onFocus={surFocus}
        onKeyDown={surClavier}
        onBlur={() => {
          window.setTimeout(() => setOuvert(false), 150);
        }}
        autoComplete="off"
        className="border-app-bord bg-app-surface rounded-md border px-3 py-1.5 text-[13px] font-normal disabled:opacity-50"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-[11px] font-normal">
          {aide}
        </span>
      )}
      {ouvert && !disabled ? (
        <div className="border-app-bord bg-app-surface absolute top-full z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-md">
          {resultats.length === 0 ? (
            <p className="text-app-encre-faible px-3 py-2 text-[12.5px]">
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
                    className={`block w-full px-3 py-1.5 text-left text-[12.5px] ${
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
              className="text-app-encre-faible block w-full px-3 py-1.5 text-left text-[12.5px]"
            >
              {libelleVoirPlus}
            </button>
          ) : null}
        </div>
      ) : null}
    </label>
  );
}
