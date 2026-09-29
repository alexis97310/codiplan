"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { estCleTraduction, t } from "@/lib/i18n/fr";
import type { Verdict } from "@/lib/interventions/cycle-de-vie";

import { BoutonPoser } from "./pose";

/**
 * LE TIROIR (PG-C5-TIROIR, spécification §3.9, CA-8) — un panneau latéral de
 * 440 px, plutôt qu'une navigation complète vers la fiche.
 *
 * ## CE QU'IL REMPLACE
 *
 * *Mesuré le 27/09/2026 (audit I-3) : cliquer une carte du planning QUITTE le
 * planning.* La maquette complète dessine un tiroir (`openDrawer`,
 * `.detail-drawer`) qui garde l'écran en place ; ce composant l'implémente.
 *
 * ## COMMENT IL S'OUVRE, SANS RECHARGER LE PLANNING
 *
 * Aucune des deux formes habituelles de ce dépôt ne convient : un `<Link>`
 * ordinaire navigue vers `/interventions/[id]` (ce qu'on veut précisément
 * éviter), et `router.push`/`replace` de `next/navigation` re-render le
 * composant SERVEUR de cette page dès que la chaîne de requête change — le
 * planning entier se rechargerait pour ouvrir un tiroir. Ce composant écoute
 * donc les clics par DÉLÉGATION sur `document`, sur tout `<a
 * data-tiroir-declencheur>` (posé par `page.tsx` sur chaque carte, avec un
 * `href` ordinaire qui reste le repli sans JavaScript), empêche la
 * navigation, et pose `?intervention=` par `history.pushState` — jamais par le
 * routeur Next. Le contenu, lui, est chargé à part
 * (`/api/interventions/[id]/resume`), en JSON, sans jamais retoucher au reste
 * de l'écran.
 *
 * ## LE FOYER DU CLAVIER
 *
 * Échap ferme ; le focus est posé sur le bouton de fermeture à l'ouverture, et
 * rendu à la carte qui a ouvert le tiroir à la fermeture — jamais perdu au
 * sommet du document.
 */

type ReponseResume = {
  readonly id: string;
  readonly reference: string;
  readonly statutLibelle: string;
  readonly prioriteLibelle: string;
  readonly panneOuNature: string;
  readonly client: string;
  readonly site: string;
  readonly creneau: string | null;
  readonly duree: string | null;
  readonly technicien: string;
  readonly machines: string;
  readonly dureeEstimeeMin: number | null;
  readonly libellePose: string;
  readonly enRetard: boolean;
  readonly fuseau: string;
  readonly verdictDeplacer: Verdict;
  readonly verdictAnnuler: Verdict;
  readonly peutModifierLePlanning: boolean;
  readonly peutAnnulerIntervention: boolean;
};

/** Lit `?intervention=` dans l'URL courante, ou `null`. */
function interventionDeLUrl(): string | null {
  return new URL(window.location.href).searchParams.get("intervention");
}

/**
 * LE MOTIF D'UN REFUS, TRADUIT — `null` s'il n'y a rien à dire, jamais une
 * clé non reconnue affichée telle quelle (L1-02f : ce que le réseau rend est
 * une frontière, même quand la réponse vient de notre propre route).
 */
function motifDuRefus(verdict: Verdict): string | null {
  if (!verdict.refuse) {
    return null;
  }
  return estCleTraduction(verdict.cle) ? t(verdict.cle) : null;
}

export function Tiroir({
  initialInterventionId,
}: Readonly<{ initialInterventionId: string | null }>) {
  const [id, setId] = useState<string | null>(initialInterventionId);
  const [donnees, setDonnees] = useState<ReponseResume | null>(null);
  const [erreur, setErreur] = useState(false);
  const [remiseEnCours, setRemiseEnCours] = useState(false);
  const declencheurRef = useRef<HTMLElement | null>(null);
  const boutonFermerRef = useRef<HTMLButtonElement | null>(null);
  const conteneurRef = useRef<HTMLDivElement | null>(null);

  const fermer = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("intervention");
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
    setId(null);
    setDonnees(null);
    setErreur(false);
    declencheurRef.current?.focus();
  }, []);

  // ── OUVRIR AU CLIC SUR N'IMPORTE QUELLE CARTE (délégation, voir l'entête) ──
  useEffect(() => {
    function surClic(evenement: MouseEvent): void {
      const cible = (evenement.target as HTMLElement).closest(
        "a[data-tiroir-declencheur]",
      );
      if (cible === null) {
        return;
      }
      const interventionId = cible.getAttribute("data-tiroir-declencheur");
      if (interventionId === null || interventionId === "") {
        return;
      }
      evenement.preventDefault();
      declencheurRef.current = cible as HTMLElement;
      const url = new URL(window.location.href);
      url.searchParams.set("intervention", interventionId);
      window.history.pushState(null, "", `${url.pathname}${url.search}`);
      setId(interventionId);
    }
    document.addEventListener("click", surClic);
    return () => document.removeEventListener("click", surClic);
  }, []);

  // ── LE BOUTON PRÉCÉDENT DU NAVIGATEUR FERME AUSSI (URL PARTAGEABLE) ───────
  useEffect(() => {
    function surRetour(): void {
      setId(interventionDeLUrl());
    }
    window.addEventListener("popstate", surRetour);
    return () => window.removeEventListener("popstate", surRetour);
  }, []);

  // ── ÉCHAP FERME, ET LE FOYER RESTE PIÉGÉ DANS LE TIROIR (Tab/Maj+Tab) ─────
  useEffect(() => {
    if (id === null) {
      return;
    }
    function surTouche(evenement: KeyboardEvent): void {
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
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [id, fermer]);

  // ── LE CONTENU, CHARGÉ À PART — jamais un rechargement de `/planning` ────
  useEffect(() => {
    if (id === null) {
      return;
    }
    let annule = false;
    setDonnees(null);
    setErreur(false);
    fetch(`/api/interventions/${id}/resume`, {
      headers: { accept: "application/json" },
    })
      .then((reponse) => {
        if (!reponse.ok) {
          throw new Error("resume_indisponible");
        }
        return reponse.json() as Promise<ReponseResume>;
      })
      .then((json) => {
        if (!annule) {
          setDonnees(json);
        }
      })
      .catch(() => {
        if (!annule) {
          setErreur(true);
        }
      });
    return () => {
      annule = true;
    };
  }, [id]);

  // ── LE FOYER DU CLAVIER, POSÉ À L'OUVERTURE ──────────────────────────────
  useEffect(() => {
    if (id !== null) {
      boutonFermerRef.current?.focus();
    }
  }, [id]);

  async function remettreDansLaFile(): Promise<void> {
    if (id === null) {
      return;
    }
    setRemiseEnCours(true);
    try {
      const reponse = await fetch(`/api/interventions/${id}/deplacer`, {
        method: "POST",
        body: new FormData(),
        headers: { accept: "application/json" },
      });
      const corps: unknown = await reponse.json().catch(() => null);
      const accepte =
        typeof corps === "object" &&
        corps !== null &&
        "accepte" in corps &&
        (corps as { accepte?: unknown }).accepte === true;
      if (accepte) {
        const url = new URL(window.location.href);
        url.searchParams.delete("intervention");
        window.location.assign(`${url.pathname}${url.search}`);
        return;
      }
    } finally {
      setRemiseEnCours(false);
    }
  }

  if (id === null) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-tiroir-ouvert={id}
      className="fixed inset-0 z-50 flex justify-end max-[900px]:block"
    >
      <button
        type="button"
        aria-label={t("planning.tiroir.fermer")}
        onClick={fermer}
        className="bg-app-encre/40 absolute inset-0 cursor-default"
      />
      <div
        ref={conteneurRef}
        className="bg-app-surface relative flex h-full w-[440px] flex-col gap-4 overflow-y-auto p-4 shadow-xl max-[900px]:w-full"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold">
            {donnees?.reference ?? t("planning.tiroir.chargement")}
          </h2>
          <button
            ref={boutonFermerRef}
            type="button"
            onClick={fermer}
            className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-bold"
          >
            {t("planning.tiroir.fermer")}
          </button>
        </div>

        {erreur ? (
          <p role="alert" className="text-app-rouge-encre text-[12.5px]">
            {t("planning.tiroir.erreur")}
          </p>
        ) : donnees === null ? (
          <p className="text-app-encre-faible text-[12.5px]">
            {t("planning.tiroir.chargement")}
          </p>
        ) : (
          <>
            {donnees.enRetard ? (
              <p
                data-tiroir-en-retard
                className="text-app-rouge-encre text-[12px] font-bold"
              >
                {t("planning.en_retard")}
              </p>
            ) : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
              <dt className="text-app-encre-faible font-semibold">
                {t("intervention.client")}
              </dt>
              <dd>
                {donnees.client}
                {t("ponctuation.point_median")}
                {donnees.site}
              </dd>
              {donnees.creneau === null ? null : (
                <>
                  <dt className="text-app-encre-faible font-semibold">
                    {t("intervention.creneau")}
                  </dt>
                  <dd>{donnees.creneau}</dd>
                </>
              )}
              {donnees.duree === null ? null : (
                <>
                  <dt className="text-app-encre-faible font-semibold">
                    {t("intervention.duree_estimee")}
                  </dt>
                  <dd>{donnees.duree}</dd>
                </>
              )}
              <dt className="text-app-encre-faible font-semibold">
                {t("intervention.technicien")}
              </dt>
              <dd>{donnees.technicien}</dd>
              <dt className="text-app-encre-faible font-semibold">
                {t("intervention.statut")}
              </dt>
              <dd>{donnees.statutLibelle}</dd>
              <dt className="text-app-encre-faible font-semibold">
                {t("intervention.priorite")}
              </dt>
              <dd>{donnees.prioriteLibelle}</dd>
              <dt className="text-app-encre-faible font-semibold">
                {t("intervention.machine")}
              </dt>
              <dd>{donnees.machines}</dd>
            </dl>

            <div className="border-app-bord flex flex-col gap-2 border-t pt-3">
              <a
                href={`/interventions/${donnees.id}`}
                className="border-app-bord rounded-md border px-3 py-2 text-center text-[12.5px] font-bold"
              >
                {t("planning.tiroir.ouvrir_la_fiche")}
              </a>

              {!donnees.peutModifierLePlanning ? null : donnees.verdictDeplacer
                  .refuse ? (
                <p className="text-app-encre-faible text-[11.5px]">
                  {motifDuRefus(donnees.verdictDeplacer)}
                </p>
              ) : (
                <>
                  <BoutonPoser
                    interventionId={donnees.id}
                    dureeMin={donnees.dureeEstimeeMin}
                    libelle={donnees.libellePose}
                    fuseau={donnees.fuseau}
                  />
                  <button
                    type="button"
                    disabled={remiseEnCours}
                    onClick={() => void remettreDansLaFile()}
                    className="border-app-bord rounded-md border px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50"
                  >
                    {t("planning.tiroir.remettre_dans_la_file")}
                  </button>
                </>
              )}

              {!donnees.peutAnnulerIntervention ? null : donnees.verdictAnnuler
                  .refuse ? (
                <p className="text-app-encre-faible text-[11.5px]">
                  {motifDuRefus(donnees.verdictAnnuler)}
                </p>
              ) : (
                <form
                  method="post"
                  action={`/api/interventions/${donnees.id}/annuler`}
                  className="border-app-bord flex flex-col gap-1.5 border-t pt-2"
                >
                  <label className="text-[11.5px] font-semibold">
                    {t("intervention.annulation.motif")}
                    <input
                      type="text"
                      name="motif"
                      required
                      className="border-app-bord mt-1 block w-full rounded-md border px-2 py-1 text-[12px] font-normal"
                    />
                  </label>
                  <button
                    type="submit"
                    className="border-app-rouge-bord text-app-rouge-encre rounded-md border px-3 py-2 text-[12.5px] font-bold"
                  >
                    {t("intervention.action.annuler")}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
