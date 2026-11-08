import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { enregistrerAccord } from "@/lib/suite-a-donner/depot";

import { champ } from "../../../actions";

/**
 * STATUER SUR L'ACCORD ATTENDU (9K05-SUITES-A-DONNER-DEBLOQUEES) :
 * `accord_attendu` → `accord_recu` (avec pièce), `a_replanifier` (accord
 * sans pièce, DÉCISION D'ALEXIS du 08/11/2026) ou `sans_suite` (motif
 * obligatoire). Une seule route pour les deux gestes — même union que
 * `ReponseAccord` (`lib/suite-a-donner/depot.ts`) : deux formulaires sur la
 * page `.../[id]/accord`, discriminés par le champ caché `reponse`.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return dansUnEchangeAuth(() => traiter(requete, id));
}

const schemaAccordRecu = z
  .object({
    pieceAttendueRef: z.string().min(1).optional(),
    dateDispoPrevue: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine(
    (v) =>
      (v.pieceAttendueRef === undefined) === (v.dateDispoPrevue === undefined),
    { message: "piece_attendue_ref et date_dispo_prevue vont ensemble" },
  );

const schemaSansSuite = z.object({ motifSansSuite: z.string().min(1) });

async function traiter(requete: Request, id: string): Promise<Response> {
  const contexte = await exigerCapaciteComplete("modifier_planning");
  if (contexte === null) {
    return versAccord(id, await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const reponse = champ(formulaire, "reponse");

  if (reponse === "sans_suite") {
    const saisie = schemaSansSuite.safeParse({
      motifSansSuite: champ(formulaire, "motif_sans_suite") ?? "",
    });
    if (!saisie.success) {
      return versAccord(id, "suites_a_donner.refus.motif_requis");
    }
    const resultat = await enregistrerAccord(contexte, id, {
      reponse: "sans_suite",
      motifSansSuite: saisie.data.motifSansSuite,
    });
    return resultat.accepte
      ? versLeRegistre("suites_a_donner.sans_suite")
      : versAccord(id, resultat.cle);
  }

  if (reponse === "accord_recu") {
    const saisie = schemaAccordRecu.safeParse({
      pieceAttendueRef: champ(formulaire, "piece_attendue_ref") ?? undefined,
      dateDispoPrevue: champ(formulaire, "date_dispo_prevue") ?? undefined,
    });
    if (!saisie.success) {
      return versAccord(id, "suites_a_donner.refus.piece_sans_horizon");
    }
    const resultat = await enregistrerAccord(contexte, id, {
      reponse: "accord_recu",
      pieceAttendueRef: saisie.data.pieceAttendueRef,
      dateDispoPrevue:
        saisie.data.dateDispoPrevue === undefined
          ? undefined
          : new Date(`${saisie.data.dateDispoPrevue}T00:00:00.000Z`),
    });
    return resultat.accepte
      ? versLeRegistre("suites_a_donner.accord_recu")
      : versAccord(id, resultat.cle);
  }

  return versAccord(id, "suites_a_donner.refus.statut_invalide");
}

function versAccord(id: string, cle: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/interventions/suites-a-donner/${id}/accord?motif=${encodeURIComponent(cle)}`,
    },
  });
}

function versLeRegistre(cle: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/interventions/suites-a-donner?motif=${encodeURIComponent(cle)}`,
    },
  });
}
