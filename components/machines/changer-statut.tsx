"use client";

import { useState } from "react";

import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";
import { t } from "@/lib/i18n/fr";

/**
 * CHANGER L'ÉTAT D'UNE MACHINE (9I8F-STATUT-MACHINE-MODIFIABLE) — le même
 * formulaire sert la fiche machine (cinq états, confirmation sur les deux
 * sorties du parc) et la tuile Machine d'une fiche intervention (trois
 * états, jamais de confirmation) : ce que chaque écran propose voyage dans
 * `options`, posées par la page SERVEUR, jamais décidé ici.
 *
 * Le `<select>` est contrôlé pour que la confirmation sache, AVANT la
 * soumission, si l'état visé est l'une de celles que `options` marque
 * `confirmation: true` — c'est la seule raison pour laquelle ce composant
 * est un composant CLIENT.
 *
 * **UNE VRAIE SORTIE DU PARC RETAPE LE CODE** (9L44-STATUT-MACHINE-SIMULTANE-
 * SORTIE, réserve des revues) — `optionChoisie.sortie` (remplacee/ferraillee,
 * jamais le retour) ajoute, au dialogue, le champ que
 * `BoutonAvecConfirmation` désactive tant qu'il ne reprend pas exactement
 * `codeMachine` : une confirmation à un clic ne peut plus sortir une machine
 * du parc par erreur. `codeMachine` est absent de la tuile Machine, qui ne
 * propose jamais de sortie.
 */
export function FormulaireChangerStatutMachine({
  machineId,
  retour,
  statutActuel,
  options,
  codeMachine,
  libelleChamp,
  libelleBouton,
  texteConfirmationAvant,
  texteConfirmationApres,
  boutonConfirmer,
  boutonRevenir,
}: Readonly<{
  machineId: string;
  retour: string;
  statutActuel: string;
  options: readonly {
    readonly valeur: string;
    readonly libelle: string;
    readonly confirmation: boolean;
    readonly sortie: boolean;
  }[];
  codeMachine?: string;
  libelleChamp: string;
  libelleBouton: string;
  texteConfirmationAvant: string;
  texteConfirmationApres: string;
  boutonConfirmer: string;
  boutonRevenir: string;
}>) {
  const [statut, setStatut] = useState(statutActuel);
  const optionChoisie = options.find((option) => option.valeur === statut);

  return (
    <form
      action={`/api/machines/${machineId}/changer-statut`}
      method="post"
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="retour" value={retour} />
      {/* LA CONFIRMATION, VÉRIFIÉE CÔTÉ SERVEUR (9I8F1-REPRISE-9I8F, D227) —
          posée ici, jamais ailleurs : `champ()` rend `null` pour une chaîne
          vide (`app/api/interventions/actions.ts`), donc ce champ ne prouve
          rien quand `optionChoisie` ne demande pas confirmation, et porte
          une valeur dès que l'option choisie en demande une — qu'elle soit
          réellement passée par le dialogue ou non n'est, pour ce formulaire,
          jamais différent : la seule voie pour soumettre quand une
          confirmation est requise EST ce dialogue (`dialogueActif`,
          `BoutonAvecConfirmation`). */}
      <input
        type="hidden"
        name="confirmation"
        value={optionChoisie?.confirmation === true ? "oui" : ""}
      />
      <label className="flex flex-col gap-1 text-13 font-bold">
        {libelleChamp}
        <select
          name="statut"
          value={statut}
          onChange={(evenement) => setStatut(evenement.target.value)}
          className="border-app-bord bg-app-surface rounded-md border px-3 py-1.5 text-[13px] font-bold"
        >
          {options.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </select>
      </label>
      <BoutonAvecConfirmation
        libelle={libelleBouton}
        variant="outline"
        dialogueActif={optionChoisie?.confirmation ?? false}
        texteConfirmation={
          <>
            {texteConfirmationAvant}{" "}
            <b className="font-bold">{optionChoisie?.libelle}</b>
            {texteConfirmationApres}
          </>
        }
        saisieDeControle={
          optionChoisie?.sortie === true && codeMachine !== undefined
            ? {
                attendu: codeMachine,
                libelle: (
                  <>
                    {t("machine.changer_etat.sortie_retape_avant")}{" "}
                    <b className="font-bold">{codeMachine}</b>
                    {t("machine.changer_etat.sortie_retape_apres")}
                  </>
                ),
              }
            : undefined
        }
        boutonConfirmer={boutonConfirmer}
        boutonRevenir={boutonRevenir}
      />
    </form>
  );
}
