import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { changerStatutMachine } from "@/lib/machines/depot";
import {
  STATUTS_MACHINE_CHOISISSABLES,
  type StatutMachineChoisissable,
} from "@/lib/machines/saisie";

import { champ } from "../../../interventions/actions";

/**
 * CHANGER L'ÉTAT D'UNE MACHINE (9I8F-STATUT-MACHINE-MODIFIABLE) — l'écran
 * autonome, appelé depuis la fiche machine (`/parc/[id]`) et depuis la tuile
 * Machine d'une fiche intervention (`/interventions/[id]`) : les deux
 * fiches envoient `retour`, que ce champ nomme sans jamais le deviner.
 *
 * Les cinq valeurs de `STATUTS_MACHINE_CHOISISSABLES` sont ACCEPTÉES ICI
 * quel que soit l'écran d'origine — la fiche machine seule PROPOSE les deux
 * sorties du parc (`remplacee`, `ferraillee`), avec confirmation ; la tuile
 * Machine n'en propose que trois. `fusionnee` n'est, elle, jamais proposée
 * nulle part, et le type `StatutMachineChoisissable` l'exclut à la
 * compilation (voir `lib/machines/saisie.ts`).
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

/** Fermée aux deux seules fiches qui posent ce bouton (même discipline que `app/api/contacts/saisie-recue.ts`). */
const RETOUR_VALIDE = /^\/(parc|interventions)\/[0-9a-f-]{36}$/;

function versLeRetour(retour: string, id: string, motif?: string): Response {
  const cible = RETOUR_VALIDE.test(retour) ? retour : `/parc/${id}`;
  const parametres =
    motif === undefined ? "" : `?motif=${encodeURIComponent(motif)}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `${cible}${parametres}` },
  });
}

function estStatutChoisissable(
  valeur: string | null,
): valeur is StatutMachineChoisissable {
  return (STATUTS_MACHINE_CHOISISSABLES as readonly string[]).includes(
    valeur ?? "",
  );
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const formulaire = await requete.formData();
  const retour = champ(formulaire, "retour") ?? `/parc/${id}`;

  const contexte = await exigerCapacite("gerer_machine");
  if (contexte === null) {
    return versLeRetour(retour, id, await motifDuRefus());
  }

  const statut = champ(formulaire, "statut");
  if (!estStatutChoisissable(statut)) {
    return versLeRetour(retour, id, "machine.refus.statut_invalide");
  }

  const resultat = await changerStatutMachine(contexte, id, statut);
  if (!resultat.accepte) {
    return versLeRetour(retour, id, `machine.refus.${resultat.motif}`);
  }
  return versLeRetour(retour, id, "machine.statut_modifie");
}
