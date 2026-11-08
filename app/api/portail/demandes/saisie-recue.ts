import { z } from "zod";

import { champ } from "../../interventions/actions";

/**
 * LA SAISIE DU DÉPÔT DEPUIS LE PORTAIL (9J04-PORTAIL-DEMANDES, CLI-4).
 *
 * Ce module ne construit PAS le `Depot` que `lib/demandes/saisie.ts` exige :
 * `site_id` dépend d'une lecture en base (CLI-4.1, « le site est déduit de
 * la machine »), que ce module — sans accès à la base — ne peut pas faire.
 * Il extrait donc ce que le formulaire porte, et laisse la route composer le
 * `Depot` complet une fois la déduction faite.
 *
 * **`client_id` n'est jamais lu du formulaire** — même raison que
 * `creationContactPortailRecue` (`app/api/portail/contacts/saisie-recue.ts`) :
 * un compte portail n'a qu'un seul client, désigné par `contextePortailDemande`.
 *
 * **`source` n'est jamais lu du formulaire** (INTERDITS du ticket) : la route
 * l'impose à `"portail"`, en dur, jamais depuis une valeur soumise.
 */

const IDENTIFIANT_UUID = z.string().uuid();

export type SaisiePortailDemande = {
  readonly id: string;
  readonly description: string;
  /** La machine CHOISIE (CLI-4.1), ou `null` quand elle n'est pas identifiée. */
  readonly machineId: string | null;
  /** Le lieu saisi quand AUCUNE machine n'est identifiée (CLI-4.2). Ignoré
   * par la route si `machineId` n'est pas `null` — le site est alors DÉDUIT
   * de la machine, jamais des deux lectures à la fois. */
  readonly siteIdSaisi: string | null;
  /** La case « machine à l'arrêt » (9K03) — JAMAIS l'urgence, qui reste fixée
   * côté serveur (décision d'Alexis du 08/11/2026). */
  readonly machineArretee: boolean;
};

export function creationDemandePortailRecue(
  formulaire: FormData,
): SaisiePortailDemande | null {
  const id = champ(formulaire, "id");
  const description = champ(formulaire, "description");
  if (id === null || !IDENTIFIANT_UUID.safeParse(id).success) {
    return null;
  }
  if (description === null) {
    return null;
  }
  const machineBrut = champ(formulaire, "machine_id");
  const siteBrut = champ(formulaire, "site_id");
  return {
    id,
    description,
    machineId:
      machineBrut !== null && IDENTIFIANT_UUID.safeParse(machineBrut).success
        ? machineBrut
        : null,
    siteIdSaisi:
      siteBrut !== null && IDENTIFIANT_UUID.safeParse(siteBrut).success
        ? siteBrut
        : null,
    machineArretee: champ(formulaire, "machine_arretee") !== null,
  };
}

/**
 * LE RETOUR — toujours `/portail/demandes`, jamais un chemin reçu de la
 * requête : même raison que `versLeRetourPortail`
 * (`app/api/portail/contacts/saisie-recue.ts`), un seul écran à désigner.
 *
 * `numeroDemande`/`anneeDemande` (9K03) accompagnent le SEUL motif de succès
 * (`portail.demandes.cree`) : le bandeau les lit pour nommer la demande,
 * jamais pour autre chose — un numéro sur un motif de refus ne serait pas
 * utilisé par l'écran, mais ce n'est pas cette fonction qui le décide.
 */
export function versLeRetourPortailDemandes(
  cle?: string,
  identifiant?: {
    readonly numero: number | null;
    readonly annee: number | null;
  },
): Response {
  const parametres = new URLSearchParams();
  if (cle !== undefined) {
    parametres.set("motif", cle);
  }
  if (identifiant?.numero !== null && identifiant?.numero !== undefined) {
    parametres.set("numero", String(identifiant.numero));
  }
  if (identifiant?.annee !== null && identifiant?.annee !== undefined) {
    parametres.set("annee", String(identifiant.annee));
  }
  const chaine = parametres.toString();
  const suffixe = chaine === "" ? "" : `?${chaine}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `/portail/demandes${suffixe}` },
  });
}
