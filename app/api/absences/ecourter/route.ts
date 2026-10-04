import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { ecourterAbsence } from "@/lib/absences/depot";
import { schemaEcourtementAbsence } from "@/lib/absences/saisie";

import { champ } from "../../interventions/actions";
import { jourCivil, versLesAbsences } from "../actions";

/**
 * ÉCOURTER UNE ABSENCE EN COURS (QT-15, D136) — une nouvelle fin, rien
 * d'autre.
 *
 * **`exigerCapaciteComplete`, PAS `exigerCapacite`** (TR-5) : même raison que
 * `app/api/absences/lever/route.ts` — le ○ du technicien sur
 * `modifier_planning` ne lui ouvre que la déclaration pour lui-même, jamais
 * l'écourtement ni la suppression.
 *
 * **Les bornes sont jugées par `ecourterAbsence`** (`lib/absences/depot.ts`),
 * qui seul connaît la date du jour dans le fuseau de la société et l'ancienne
 * fin de la ligne visée : cette route ne fait que lire la saisie et la lui
 * transmettre.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("modifier_planning");
  if (contexte === null) {
    return versLesAbsences(await motifDuRefus());
  }
  const formulaire = await requete.formData();
  const saisie = schemaEcourtementAbsence.safeParse({
    absence_id: champ(formulaire, "absence_id") ?? "",
    au: jourCivil(formulaire, "au") ?? new Date(Number.NaN),
  });
  if (!saisie.success) {
    return versLesAbsences("absence.refus.saisie");
  }
  const resultat = await ecourterAbsence(contexte, saisie.data);
  return versLesAbsences(resultat.accepte ? undefined : resultat.cle);
}
