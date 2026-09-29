import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { debutDuJourSociete } from "@/lib/interventions/depot";
import {
  refusDeLaDateDeVerification,
  saisieVerificationRecue,
} from "@/lib/vgp/saisie-verification";
import { enregistrerVerification } from "@/lib/vgp/verification";

import { champ } from "../../../interventions/actions";
import { versLeFormulaire } from "./formulaire";

/**
 * ENREGISTRER UNE VÉRIFICATION VGP — LE SEUL CHEMIN D'ÉCRITURE (D114, R2-13).
 *
 * **Le refus retourne sur le formulaire avec son motif**, jamais sur une page
 * blanche — même raison que `/api/parametres/forfaits/creer` : *un refus qui
 * renvoie ailleurs fait perdre la saisie.*
 *
 * ## `document_id` RESTE NUL — VOIR `FormulaireVerification`
 *
 * Aucun champ de document n'est lu ici : le formulaire n'en porte pas
 * (aucun sélecteur de document n'existe encore à réutiliser ailleurs dans le
 * dépôt). `schemaVerificationVgp` le défaut déjà à `null`.
 *
 * **D131 (23/09/2026, DROITS-1).** `exigerCapacite` remplace `contexteCourant()` :
 * `enregistrer_vgp` était absente du §5.2, arbitrée avec « clôturer ». Le ○
 * du technicien passe la porte ; `enregistrerVerification` juge en base si la
 * machine est portée par une de SES interventions non annulées.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;

  const contexte = await exigerCapacite("enregistrer_vgp");
  if (contexte === null) {
    return versLeFormulaire(id, await motifDuRefus());
  }

  const formulaire = await requete.formData();
  // CE QUI AVAIT ÉTÉ SOUMIS, capturé AVANT toute validation
  // (9BR-TP-A4b-MESSAGES, PV-45).
  const champsResoumis = {
    date_verification: champ(formulaire, "date_verification") ?? undefined,
    origine: champ(formulaire, "origine") ?? undefined,
    organisme: champ(formulaire, "organisme") ?? undefined,
    reference_rapport: champ(formulaire, "reference_rapport") ?? undefined,
    observations: champ(formulaire, "observations") ?? undefined,
  };

  const saisie = saisieVerificationRecue(formulaire, id);
  if (saisie === null) {
    return versLeFormulaire(id, "vgp.verifier.refus.saisie", champsResoumis);
  }

  // LA DATE FUTURE EST REFUSÉE ICI, CÔTÉ SERVEUR (TP-A2, décision d'Alexis du
  // 29/09/2026) — l'attribut `max` du champ ne protège que le navigateur
  // qui l'honore ; un POST direct doit être jugé de la même façon.
  const aujourdHui = await avecContexteApplicatif(contexte, (tx) =>
    debutDuJourSociete(tx, contexte),
  );
  const refusDate = refusDeLaDateDeVerification(
    saisie.date_verification,
    aujourdHui,
  );
  if (refusDate !== null) {
    return versLeFormulaire(id, refusDate, champsResoumis);
  }

  try {
    await enregistrerVerification(contexte, saisie);
  } catch {
    // La forme « filiation » de la politique RLS (`vgp_verification`, parent
    // `machine`) refuse l'écriture si la machine n'est pas visible sous cette
    // société — même raison que `lireMachine` rend `null` pour la même cause.
    return versLeFormulaire(
      id,
      "vgp.verifier.refus.introuvable",
      champsResoumis,
    );
  }

  return new Response(null, {
    status: 303,
    headers: { Location: "/vgp" },
  });
}
