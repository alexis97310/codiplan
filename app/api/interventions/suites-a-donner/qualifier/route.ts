import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { qualifierSuite } from "@/lib/suite-a-donner/depot";

import { champ } from "../../actions";

/**
 * QUALIFIER MANUELLEMENT UNE SUITE À DONNER (9J18-SUITE-A-DONNER-ECRAN, FLX-2
 * côté bouton seulement — jamais automatique, et jamais le flux de devis
 * lui-même, hors périmètre de ce ticket).
 *
 * **Les trois conditions se vérifient ICI, pas dans `qualifierSuite`**
 * (`lib/suite-a-donner/depot.ts`, hors territoire de ce ticket) : elle crée
 * la ligne sans aucun contrôle de son cru — c'est l'écran qui doit s'assurer
 * que l'intervention est bien CLÔTURÉE, porte un `suite_a_donner` non vide,
 * et n'a pas déjà sa ligne.
 *
 * **La lecture et l'écriture ne sont PAS dans la même transaction** — la
 * même limite que partout ailleurs dans ce lot (voir le docblock de
 * `creerReprise`, `lib/suite-a-donner/reprise.ts`) : `suite_a_donner.
 * intervention_origine_id` ne porte pas de contrainte d'unicité (9J17 n'en
 * pose pas), si bien que deux clics simultanés sur CE bouton précis peuvent
 * en théorie créer deux lignes. Risque accepté, nommé plutôt que caché —
 * une migration le fermerait, hors territoire de ce ticket (aucune migration).
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

const schemaRequete = z.object({ intervention_id: z.string().uuid() });

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("modifier_planning");
  if (contexte === null) {
    return versLeRegistre(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const saisie = schemaRequete.safeParse({
    intervention_id: champ(formulaire, "intervention_id") ?? "",
  });
  if (!saisie.success) {
    return versLeRegistre("suites_a_donner.refus.inconnue");
  }

  const intervention = await avecContexteApplicatif(contexte, (tx) =>
    tx.intervention.findFirst({
      where: { id: saisie.data.intervention_id },
      select: {
        id: true,
        statut: true,
        suite_a_donner: true,
        suites_a_donner_origine: { select: { id: true }, take: 1 },
      },
    }),
  );
  if (intervention === null) {
    return versLeRegistre("suites_a_donner.refus.inconnue");
  }
  if (
    intervention.statut !== "cloturee" ||
    intervention.suite_a_donner === null ||
    intervention.suite_a_donner.trim().length === 0
  ) {
    return versLeRegistre("suites_a_donner.refus.statut_invalide");
  }
  if (intervention.suites_a_donner_origine.length > 0) {
    return versLeRegistre("suites_a_donner.refus.deja_qualifiee");
  }

  await qualifierSuite(contexte, intervention.id);
  return versLeRegistre("suites_a_donner.qualifiee");
}

function versLeRegistre(cle: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/interventions/suites-a-donner?motif=${encodeURIComponent(cle)}`,
    },
  });
}
