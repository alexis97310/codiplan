import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { leverLeBlocage } from "@/lib/absences/depot";
import { schemaLeveeBlocage } from "@/lib/absences/saisie";

import { champ } from "../../interventions/actions";
import { versLesAbsences } from "../actions";

/**
 * SUPPRIMER UNE ABSENCE QUI N'A PAS COMMENCÉ (R3-14, QT-15, D136).
 *
 * **Elle se supprime, elle ne se « refuse » pas.** Un statut `refusee` aurait
 * gardé la ligne en disant qu'elle ne compte pas : *deux façons pour une
 * période de ne pas bloquer, dont une invisible au lecteur qui ne regarde que
 * les dates.*
 *
 * **`exigerCapaciteComplete`, PAS `exigerCapacite`** (TR-5) : depuis que le
 * technicien a un ○ sur `modifier_planning` pour déclarer SA PROPRE absence
 * (voir `app/api/absences/declarer/route.ts`), seul le ● doit pouvoir la
 * supprimer ou l'écourter — un technicien qui efface sa propre absence
 * effacerait aussi, en silence, les interventions qu'elle a rendues à la
 * file.
 *
 * **Ce que cette route ne fait pas est écrit plutôt que tu** : supprimer une
 * absence ne rend PAS leurs créneaux aux interventions déjà rendues à la
 * file. Elles gardent la mention de leur ancien créneau (9CC-DEPLANIFIEE-1),
 * et le planificateur a le journal d'audit sous les yeux (I8) et le choix de
 * les reposer où il veut.
 *
 * **Réservée à une absence qui n'a pas commencé** : `leverLeBlocage`
 * (`lib/absences/depot.ts`) refuse sinon, nommément.
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
  const saisie = schemaLeveeBlocage.safeParse({
    absence_id: champ(formulaire, "absence_id") ?? "",
  });
  if (!saisie.success) {
    return versLesAbsences("absence.refus.saisie");
  }
  const resultat = await leverLeBlocage(contexte, saisie.data);
  return versLesAbsences(resultat.accepte ? undefined : resultat.cle);
}
