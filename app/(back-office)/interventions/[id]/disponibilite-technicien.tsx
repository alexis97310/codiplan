"use client";

import { useEffect, useRef } from "react";

import { absenceCouvrant, type AbsenceDeclaree } from "@/lib/absences/periode";
import { dateCivile } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";

/**
 * « PLANIFIER » ET « DÉPLACER » DISENT LE BLOCAGE AVANT L'ENVOI
 * (66-PLANNING-4, SAV-05).
 *
 * ## Le défaut mesuré (voir le ticket)
 *
 * « Affecter » marque déjà les techniciens dont l'agenda est bloqué, parce que
 * sa date — `ligne.date_planifiee` — est connue au RENDU du serveur
 * (`optionsDAffectation`, `lib/interventions/personnes.ts`). « Planifier » et
 * « Déplacer » saisissent la date DANS le même formulaire : elle n'existe pas
 * encore côté serveur au moment où la page se rend, et le sélecteur technicien
 * restait nu. RG-PLA-06 refusait alors APRÈS l'envoi, jamais avant.
 *
 * ## Ce composant NE DÉCIDE RIEN — même critère, importé, jamais recopié
 *
 * `absenceCouvrant` est la MÊME fonction que `optionsDAffectation` applique
 * déjà côté serveur (§9, 01/09 : jamais une seconde écriture d'un critère).
 * Ce composant se contente de la rejouer côté client, sur les mêmes données,
 * quand la date change — la règle qui bloque réellement l'affectation reste
 * exclusivement côté serveur et en base (`intervention_pas_sur_blocage_agenda`).
 *
 * ## Pourquoi une manipulation DOM plutôt qu'un `<select>` réécrit en React
 *
 * `Saisie` et `Action` restent des Server Components ordinaires : ce composant
 * se pose en simple FRÈRE du champ date et du sélecteur technicien, à
 * l'intérieur du même `<form>`, et retrouve les deux par leur `name` —
 * *aucun composant partagé n'est touché*, comme le veut le ticket. Sans
 * JavaScript, il ne s'exécute jamais : le formulaire se comporte exactement
 * comme avant (repli déjà couvert par `tests/e2e/blocage-agenda-visible.spec.ts`
 * pour « Déplacer »).
 *
 * ## La fenêtre borne l'affirmation, jamais la règle
 *
 * Une date hors de la fenêtre transmise ne porte AUCUNE mention — ni bloqué,
 * ni disponible : c'est la réserve absolue de
 * `planning.technicien_sans_intervention` (§9, 07/09), reprise ici pour ce
 * que ce composant ne sait pas encore affirmer.
 */
export function DisponibiliteTechnicien({
  absences,
  fenetre,
}: {
  /** Les blocages d'agenda de la fenêtre, tels que la page les a lus. */
  absences: readonly {
    readonly id: string;
    readonly utilisateurId: string;
    readonly du: string;
    readonly au: string;
  }[];
  /** Bornes ISO de la fenêtre couverte — toutes deux comprises. */
  fenetre: { readonly du: string; readonly au: string };
}) {
  const repere = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const formulaire = repere.current?.closest("form") ?? null;
    if (formulaire === null) {
      return;
    }
    const champDate = formulaire.elements.namedItem("date_planifiee");
    const champTechnicien = formulaire.elements.namedItem("technicien_id");
    if (
      !(champDate instanceof HTMLInputElement) ||
      !(champTechnicien instanceof HTMLSelectElement)
    ) {
      return;
    }

    const absencesDeclarees: AbsenceDeclaree[] = absences.map((absence) => ({
      id: absence.id,
      utilisateur_id: absence.utilisateurId,
      du: new Date(absence.du),
      au: new Date(absence.au),
    }));
    const bornes = { du: new Date(fenetre.du), au: new Date(fenetre.au) };
    // Le libellé D'ORIGINE, capturé UNE FOIS — jamais recalculé depuis un
    // libellé déjà suffixé, sous peine de l'accumuler à chaque changement.
    const libellesDorigine = new Map(
      [...champTechnicien.options].map((option) => [option.value, option.text]),
    );

    const mettreAJour = () => {
      const dateChoisie = lireDateSaisie(champDate.value);
      const dansLaFenetre =
        dateChoisie !== null &&
        dateChoisie.getTime() >= bornes.du.getTime() &&
        dateChoisie.getTime() <= bornes.au.getTime();

      for (const option of champTechnicien.options) {
        const nom = libellesDorigine.get(option.value);
        if (nom === undefined) {
          continue;
        }
        if (!dansLaFenetre || dateChoisie === null) {
          option.text = nom;
          delete option.dataset.agendaBloque;
          continue;
        }
        const bloque =
          absenceCouvrant(absencesDeclarees, option.value, dateChoisie) !==
          null;
        if (bloque) {
          option.text = `${nom} — ${t("intervention.technicien_agenda_bloque_le")} ${dateCivile(dateChoisie)}`;
          option.dataset.agendaBloque = "";
        } else {
          option.text = nom;
          delete option.dataset.agendaBloque;
        }
      }
    };

    mettreAJour();
    champDate.addEventListener("input", mettreAJour);
    champDate.addEventListener("change", mettreAJour);
    return () => {
      champDate.removeEventListener("input", mettreAJour);
      champDate.removeEventListener("change", mettreAJour);
    };
  }, [absences, fenetre]);

  return <span ref={repere} hidden data-disponibilite-technicien="" />;
}

/** Un `<input type="date">` rend `AAAA-MM-JJ`, ou une chaîne vide sans choix. */
function lireDateSaisie(valeur: string): Date | null {
  const trouve = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
  if (trouve === null) {
    return null;
  }
  const [, annee, mois, jour] = trouve;
  return new Date(
    Date.UTC(Number(annee), Number(mois) - 1, Number(jour)),
  );
}
