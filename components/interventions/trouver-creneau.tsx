"use client";

import { useState } from "react";

import type { Fuseau } from "@/lib/calendar/fuseau";
import { t, type CleTraduction } from "@/lib/i18n/fr";

import { FenetrePose } from "@/components/planning/fenetre-pose";
import {
  posterDeplacement,
  urlDeRechargement,
  type CibleDeDepot,
  type EnMain,
} from "@/components/planning/pose";

/**
 * « TROUVER UN CRÉNEAU » DEPUIS LA FICHE (PG-B3-TROUVER-CRENEAU-FICHE).
 *
 * Ouvre LA MÊME `FenetrePose` que le planning (import, aucune copie), avec le
 * jour CHOISISSABLE (`jourChoisissable`) puisque la fiche n'a ni case ni
 * glissé pour le fixer. À la confirmation, l'écriture passe par
 * `posterDeplacement` — la MÊME fonction, donc la MÊME route et la MÊME
 * garde (`peutPlanifier`/`peutDeplacer`) que « Déplacer » et que le
 * glisser-déposer du planning (§9, 01/09 : jamais une seconde écriture du
 * même geste).
 *
 * Le formulaire « Saisir à la main » de la fiche reste la voie de repli — ce
 * bouton n'est qu'un raccourci, jamais la seule voie (même principe que
 * `BoutonPoser` du planning).
 */
export function TrouverCreneau({
  interventionId,
  libelle,
  dureeMinInitiale,
  technicienIdInitial,
  jourInitial,
  fuseau,
  techniciens,
  libelleBouton = "intervention.action.trouver_creneau",
  ouverteAuDepart = false,
}: Readonly<{
  interventionId: string;
  libelle: string;
  dureeMinInitiale: number | null;
  technicienIdInitial: string | null;
  /** `AAAA-MM-JJ` — valeur de DÉPART seulement, `FenetrePose` la rend modifiable. */
  jourInitial: string;
  fuseau: Fuseau;
  techniciens: readonly { readonly id: string; readonly nom: string }[];
  /**
   * LE TEXTE DU BOUTON (PG-B6-DUREE-A-LA-CREATION) — même mécanisme, un
   * habillage différent : le bandeau « Intervention créée » de la fiche
   * l'ouvre sous « Planifier maintenant », jamais une seconde ouverture
   * écrite à part.
   */
  libelleBouton?: CleTraduction;
  /**
   * « + CRÉER ICI » (PG-D5-CREER-ICI) — FACULTATIF, faux par défaut : sans
   * lui, la fenêtre s'ouvre au clic, exactement comme avant ce ticket.
   * `true` seulement depuis le bandeau de création, quand l'intervention
   * vient d'une case du planning — elle s'ouvre alors d'emblée, pré-remplie.
   */
  ouverteAuDepart?: boolean;
}>) {
  const [ouverte, setOuverte] = useState(ouverteAuDepart);
  const [refus, setRefus] = useState<CleTraduction | null>(null);

  async function confirmer(main: EnMain, cible: CibleDeDepot) {
    const issue = await posterDeplacement(main, cible);
    switch (issue.issue) {
      case "enregistre":
        // LA BASE A ACCEPTÉ : LA FICHE SE RECHARGE — même principe que le
        // planning (voir le docblock de `Posable.deposer`), un rechargement
        // complet est la seule lecture mesurée fiable de l'écriture.
        //
        // Les AVERTISSEMENTS voyagent dans l'URL de la page rechargée, comme
        // au planning (9BW-AVERT-POSE-FICHE) : `urlDeRechargement` retire au
        // passage un vieux `motif`/`avertissement` déjà présent dans l'URL de
        // la fiche (par ex. un refus affiché avant ce dépôt accepté) — un
        // simple `reload()` les aurait laissés réafficher un bandeau caduc à
        // côté du nouveau.
        window.location.assign(urlDeRechargement(issue.avertissements));
        return;
      case "refuse":
        setRefus(issue.cle);
        return;
      case "erreur_serveur":
      case "connexion_interrompue":
        setRefus(`intervention.refus.${issue.issue}`);
        return;
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={() => {
          setRefus(null);
          setOuverte(true);
        }}
        className="border-app-bord text-app-encre-faible hover:bg-app-fond min-h-11 rounded-md border px-2.5 text-12 font-bold sm:min-h-0 sm:py-1"
      >
        {t(libelleBouton)}
      </button>
      {refus === null ? null : (
        <p
          data-refus-creneau={refus}
          role="alert"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3 py-2 text-12 font-bold"
        >
          {t(refus)}
        </p>
      )}
      {!ouverte ? null : (
        <FenetrePose
          interventionId={interventionId}
          libelle={libelle}
          dureeMinInitiale={dureeMinInitiale}
          technicienIdInitial={technicienIdInitial}
          jour={jourInitial}
          jourChoisissable
          fuseau={fuseau}
          techniciens={techniciens}
          onFermer={() => setOuverte(false)}
          onConfirmer={(main, cible) => void confirmer(main, cible)}
        />
      )}
    </div>
  );
}
