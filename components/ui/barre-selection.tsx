"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { CaseACocher } from "./case-a-cocher";
import { cn } from "@/lib/utils";

/**
 * LA SÉLECTION DU REGISTRE (TP-UX3-1-REGISTRE-2, partie B) — une case en
 * première colonne sur trois onglets (`selectionDisponibleSurLOnglet`,
 * `app/(back-office)/interventions/presentation.ts`), une barre collée en
 * haut de la liste qui compte, transmet (Aujourd'hui) et exporte (partout).
 * JAMAIS de pose en lot (D106).
 *
 * ## Pourquoi un contexte React, plutôt qu'un état posé sur `page.tsx`
 *
 * Les lignes du registre sont rendues CÔTÉ SERVEUR (`LigneIntervention`,
 * `page.tsx`) : seule la case à cocher de chaque ligne, et la barre
 * elle-même, ont besoin d'un état client. Un `Provider` de contexte enrobe
 * l'arbre déjà rendu — les lignes serveur restent des enfants ordinaires —
 * et seuls `CaseSelectionLigne` et `BarreSelection`, deux feuilles « use
 * client », lisent cet état (§9, 01/09 : une seule écriture de la
 * sélection, jamais une seconde copie posée ailleurs).
 *
 * ## Ce que la barre NE fait PAS
 *
 * Elle ne pose jamais de créneau ni de technicien : « Transmettre… » rejoue
 * la route GROUPÉE existante (`POST /api/interventions/transmettre`,
 * `id` répété, inchangée par ce ticket, choix du pilote C2 du 07/10/2026),
 * et « Exporter » rejoue `GET /api/interventions/exporter` avec les mêmes
 * identifiants. Les deux sont des formulaires natifs — aucune de ces deux
 * routes n'est appelée en JSON depuis ce composant.
 */

type LigneSelectionnable = {
  readonly id: string;
  readonly statut: string;
};

type EtatSelection = {
  readonly estCoche: (id: string) => boolean;
  readonly basculer: (id: string) => void;
  readonly idsCoches: readonly string[];
  readonly lignes: readonly LigneSelectionnable[];
  readonly vider: () => void;
};

const ContexteSelection = createContext<EtatSelection | null>(null);

export function ProviderSelection({
  lignes,
  children,
}: Readonly<{
  lignes: readonly LigneSelectionnable[];
  children: React.ReactNode;
}>) {
  const [coches, setCoches] = useState<ReadonlySet<string>>(new Set());

  const valeur = useMemo<EtatSelection>(
    () => ({
      estCoche: (id) => coches.has(id),
      basculer: (id) => {
        setCoches((precedent) => {
          const suivant = new Set(precedent);
          if (suivant.has(id)) {
            suivant.delete(id);
          } else {
            suivant.add(id);
          }
          return suivant;
        });
      },
      idsCoches: [...coches],
      lignes,
      vider: () => setCoches(new Set()),
    }),
    [coches, lignes],
  );

  return (
    <ContexteSelection.Provider value={valeur}>
      {children}
    </ContexteSelection.Provider>
  );
}

/** La case d'une ligne — absente de tout rendu si aucun `ProviderSelection` ne l'enrobe. */
export function CaseSelectionLigne({
  id,
  ariaLabel,
}: Readonly<{ id: string; ariaLabel: string }>) {
  const etat = useContext(ContexteSelection);
  if (etat === null) {
    return null;
  }
  return (
    <CaseACocher
      name="selection"
      libelle={ariaLabel}
      libelleVisible={false}
      checked={etat.estCoche(id)}
      onChange={() => etat.basculer(id)}
    />
  );
}

/**
 * LA BARRE — rien tant qu'aucune ligne n'est cochée (`idsCoches.length === 0`,
 * le même principe que D88 : un état vide se tait plutôt que d'afficher un
 * compte à zéro).
 */
export function BarreSelection({
  libelleUn,
  libellePluriel,
  libelleVider,
  libelleExporter,
  actionExporter,
  filtresExport,
  actionTransmettre,
  libelleTransmettre,
  libelleUnePlanifiee,
  libellePlusieursPlanifiees,
  className,
}: Readonly<{
  libelleUn: string;
  libellePluriel: string;
  libelleVider: string;
  libelleExporter: string;
  /** `/api/interventions/exporter` — un `<form method="get">`, jamais un lien composé à la main (évite de dupliquer la construction de l'URL). */
  actionExporter: string;
  /** Les AUTRES paramètres actifs de la recherche (`parametresPuces`), posés en champs cachés — `page` exclu, comme `hrefExportInterventions`. */
  filtresExport: Readonly<Record<string, string | undefined>>;
  /**
   * `/api/interventions/transmettre` — PRÉSENT seulement sur l'onglet
   * « Aujourd'hui » (`selectionDisponibleSurLOnglet` ne suffit pas : cette
   * action-ci n'a de sens que là, voir `page.tsx`).
   */
  actionTransmettre?: string;
  libelleTransmettre?: string;
  libelleUnePlanifiee?: string;
  libellePlusieursPlanifiees?: string;
  className?: string;
}>) {
  const etat = useContext(ContexteSelection);
  if (etat === null || etat.idsCoches.length === 0) {
    return null;
  }
  const idsCoches = etat.idsCoches;
  const planifiees = etat.lignes
    .filter((ligne) => idsCoches.includes(ligne.id))
    .filter((ligne) => ligne.statut === "planifiee")
    .map((ligne) => ligne.id);

  return (
    <div
      role="status"
      className={cn(
        "border-app-bleu-bord bg-app-bleu-fond flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5 text-13 font-bold",
        className,
      )}
    >
      <span>
        {idsCoches.length} {idsCoches.length === 1 ? libelleUn : libellePluriel}
      </span>
      {actionTransmettre !== undefined ? (
        <form
          method="post"
          action={actionTransmettre}
          className="flex items-center gap-2"
        >
          {planifiees.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <button
            type="submit"
            disabled={planifiees.length === 0}
            className="border-app-bord bg-app-surface rounded-md border px-2.5 py-1 disabled:opacity-50"
          >
            {libelleTransmettre}
          </button>
          {planifiees.length > 0 && planifiees.length !== idsCoches.length ? (
            <span className="text-app-encre-faible">
              {planifiees.length === 1
                ? libelleUnePlanifiee
                : `${planifiees.length} ${libellePlusieursPlanifiees}`}
            </span>
          ) : null}
        </form>
      ) : null}
      <form method="get" action={actionExporter}>
        {Object.entries(filtresExport).map(([cle, valeur]) =>
          valeur === undefined || valeur.length === 0 ? null : (
            <input key={cle} type="hidden" name={cle} value={valeur} />
          ),
        )}
        {idsCoches.map((id) => (
          <input key={id} type="hidden" name="id" value={id} />
        ))}
        <button
          type="submit"
          className="border-app-bord bg-app-surface rounded-md border px-2.5 py-1"
        >
          {libelleExporter}
        </button>
      </form>
      <button
        type="button"
        onClick={etat.vider}
        className="text-app-encre-faible hover:text-app-encre"
      >
        {libelleVider}
      </button>
    </div>
  );
}
