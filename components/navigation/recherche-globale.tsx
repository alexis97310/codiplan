"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { Icone } from "@/components/ui/icone";
import { mot } from "@/lib/i18n/vocabulaire";
import { t } from "@/lib/i18n/fr";

import type {
  CleGroupeRecherche,
  GroupeRecherche,
} from "@/lib/navigation/recherche-globale";

/**
 * LA RECHERCHE GLOBALE DU BANDEAU DU BUREAU (QE-3, 9DU-TP-NAV3-RECHERCHE-RAIL,
 * D171) — un bouton dans le bandeau, un dialogue ouvert par lui, `Ctrl K` ou
 * `/`, qui interroge `/api/recherche?q=`.
 *
 * ## LE DIALOGUE, MÊME FORME QUE `components/planning/tiroir.tsx`
 *
 * Rôle `dialog`, `aria-modal`, Échap ferme, le foyer du clavier est piégé
 * (Tab/Maj+Tab) et rendu au bouton déclencheur à la fermeture — aucune
 * seconde écriture de ce motif, copiée de ce composant déjà éprouvé.
 *
 * ## LE RACCOURCI GLOBAL NE VOLE JAMAIS UNE SAISIE EN COURS
 *
 * `/` n'ouvre PAS le dialogue si le focus est déjà dans un champ de saisie
 * (un formulaire ailleurs sur l'écran) — seul `Ctrl K`/`Cmd K` fonctionne
 * alors, comme dans la plupart des palettes de commande.
 */

const DELAI_RECHERCHE_MS = 250;

type ReponseRecherche = { readonly groupes: readonly GroupeRecherche[] };

function estChampDeSaisie(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) {
    return false;
  }
  const balise = cible.tagName.toLowerCase();
  return (
    balise === "input" ||
    balise === "textarea" ||
    balise === "select" ||
    cible.isContentEditable
  );
}

function libelleDuGroupe(cle: CleGroupeRecherche): string {
  switch (cle) {
    case "clients":
      return t("nav.clients");
    case "sites":
      return mot("site", true);
    case "machines":
      return t("recherche.groupe_machines");
    case "interventions":
      return t("nav.interventions");
  }
}

/** La liste à plat — groupe par groupe, dans l'ordre — pour la navigation au clavier. */
function resultatsAPlat(
  groupes: readonly GroupeRecherche[],
): readonly { readonly id: string; readonly href: string }[] {
  return groupes.flatMap((g) => g.resultats);
}

export function RechercheGlobale() {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [groupes, setGroupes] = useState<readonly GroupeRecherche[] | null>(
    null,
  );
  const [survol, setSurvol] = useState(-1);
  const declencheurRef = useRef<HTMLButtonElement | null>(null);
  const champRef = useRef<HTMLInputElement | null>(null);
  const conteneurRef = useRef<HTMLDivElement | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jetonRequete = useRef(0);

  const fermer = useCallback(() => {
    setOuvert(false);
    setTexte("");
    setGroupes(null);
    setSurvol(-1);
    declencheurRef.current?.focus();
  }, []);

  const ouvrir = useCallback(() => {
    setOuvert(true);
  }, []);

  useEffect(() => {
    if (ouvert) {
      champRef.current?.focus();
    }
  }, [ouvert]);

  // ── LE RACCOURCI GLOBAL — `Ctrl K`/`Cmd K` partout, `/` hors d'un champ ────
  useEffect(() => {
    function surTouche(evenement: KeyboardEvent): void {
      const combinaisonK =
        (evenement.ctrlKey || evenement.metaKey) &&
        evenement.key.toLowerCase() === "k";
      if (combinaisonK) {
        evenement.preventDefault();
        ouvrir();
        return;
      }
      if (evenement.key === "/" && !estChampDeSaisie(evenement.target)) {
        evenement.preventDefault();
        ouvrir();
      }
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [ouvrir]);

  async function chercher(valeur: string): Promise<void> {
    const jeton = ++jetonRequete.current;
    let reponse: Response;
    try {
      reponse = await fetch(
        `/api/recherche?${new URLSearchParams({ q: valeur }).toString()}`,
        { headers: { accept: "application/json" } },
      );
    } catch {
      return;
    }
    if (jeton !== jetonRequete.current || !reponse.ok) {
      return;
    }
    const corps = (await reponse
      .json()
      .catch(() => null)) as ReponseRecherche | null;
    if (corps === null || jeton !== jetonRequete.current) {
      return;
    }
    setGroupes(corps.groupes);
    setSurvol(-1);
  }

  function surChangementTexte(valeur: string): void {
    setTexte(valeur);
    if (minuteur.current !== null) {
      clearTimeout(minuteur.current);
    }
    minuteur.current = setTimeout(() => {
      void chercher(valeur);
    }, DELAI_RECHERCHE_MS);
  }

  // ── ÉCHAP FERME, LE FOYER RESTE PIÉGÉ (Tab/Maj+Tab) — voir `Tiroir` ────────
  useEffect(() => {
    if (!ouvert) {
      return;
    }
    function surToucheDialogue(evenement: KeyboardEvent): void {
      if (evenement.key === "Escape") {
        fermer();
        return;
      }
      if (evenement.key !== "Tab") {
        return;
      }
      const conteneur = conteneurRef.current;
      if (conteneur === null) {
        return;
      }
      const focusables = conteneur.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        return;
      }
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    }
    document.addEventListener("keydown", surToucheDialogue);
    return () => document.removeEventListener("keydown", surToucheDialogue);
  }, [ouvert, fermer]);

  const plats = groupes === null ? [] : resultatsAPlat(groupes);

  function surClavierDuChamp(
    evenement: React.KeyboardEvent<HTMLInputElement>,
  ): void {
    if (evenement.key === "ArrowDown") {
      evenement.preventDefault();
      setSurvol((s) => Math.min(s + 1, plats.length - 1));
    } else if (evenement.key === "ArrowUp") {
      evenement.preventDefault();
      setSurvol((s) => Math.max(s - 1, 0));
    } else if (evenement.key === "Enter") {
      const cible = plats[survol];
      if (cible !== undefined) {
        evenement.preventDefault();
        window.location.assign(cible.href);
      }
    }
  }

  return (
    <>
      <button
        ref={declencheurRef}
        type="button"
        onClick={ouvrir}
        aria-haspopup="dialog"
        className="border-app-bord bg-app-fond text-app-encre-faible flex h-[38px] w-full max-w-[320px] shrink-0 items-center gap-2.5 rounded-md border px-3 text-left text-13 font-bold"
      >
        <Icone nom="search" taille={16} />
        <span className="min-w-0 flex-1 truncate">{t("recherche.indice")}</span>
        <kbd className="border-app-bord bg-app-surface shrink-0 rounded-md border px-1.5 py-0.5 text-12 font-bold">
          {t("recherche.raccourci")}
        </kbd>
      </button>

      {!ouvert ? null : (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.rechercher")}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[11vh]"
        >
          <button
            type="button"
            aria-label={t("recherche.fermer")}
            onClick={fermer}
            className="bg-app-encre/40 absolute inset-0 cursor-default"
          />
          <div
            ref={conteneurRef}
            className="bg-app-surface relative flex max-h-[72vh] w-[min(660px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl shadow-xl"
          >
            <div className="border-app-bord flex h-[58px] items-center gap-3 border-b px-4">
              <Icone nom="search" taille={18} />
              <input
                ref={champRef}
                type="search"
                autoComplete="off"
                value={texte}
                placeholder={t("recherche.indice")}
                onChange={(evenement) =>
                  surChangementTexte(evenement.target.value)
                }
                onKeyDown={surClavierDuChamp}
                className="min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {groupes === null ? null : plats.length === 0 ? (
                <p className="text-app-encre-faible px-3 py-6 text-center text-13 font-bold">
                  {t("recherche.aucun_resultat")}
                  {t("ponctuation.guillemet_ouvrant")}
                  {texte}
                  {t("ponctuation.guillemet_fermant")}
                </p>
              ) : (
                (() => {
                  let indice = -1;
                  return groupes
                    .filter((g) => g.resultats.length > 0)
                    .map((g) => (
                      <div key={g.cle}>
                        <p className="text-app-encre-faible px-3 pt-2.5 pb-1 text-12 font-extrabold uppercase">
                          {libelleDuGroupe(g.cle)}
                        </p>
                        {g.resultats.map((resultat) => {
                          indice += 1;
                          const actif = indice === survol;
                          return (
                            <Link
                              key={resultat.id}
                              href={resultat.href}
                              onMouseEnter={() => setSurvol(indice)}
                              className={`block rounded-md px-3 py-2 text-13 font-bold ${
                                actif ? "bg-app-fond" : ""
                              }`}
                            >
                              {resultat.libelle}
                            </Link>
                          );
                        })}
                      </div>
                    ));
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
