import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { absenceCouvrant, type AbsenceDeclaree } from "@/lib/absences/periode";
import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import {
  instantDuJour,
  lireCleJour,
  maintenant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { jugerPose } from "@/lib/interventions/depot";
import {
  creneauxDisponibles,
  type OccupationDuJour,
} from "@/lib/interventions/creneaux";
import { schemaDeplacement } from "@/lib/interventions/saisie";

/**
 * `GET /api/interventions/{id}/verdict-pose` — LE VERDICT D'UNE POSE, EN
 * LECTURE SEULE (PG-B1, spécification §3.10).
 *
 * **Aucune écriture** : cette route n'importe que `jugerPose` (extraite de
 * `deplacerIntervention`, `lib/interventions/depot.ts`), jamais
 * `deplacerIntervention` elle-même ni aucune autre fonction qui écrit. *Qui
 * peut déplacer peut lire le verdict* : même capacité, `modifier_planning`,
 * que `POST .../deplacer` — les autres, 403.
 *
 * **Les créneaux et le verdict répondent à deux questions différentes.** Le
 * verdict juge UN candidat précis — technicien, date, heure, durée, les
 * quatre ensemble — et n'existe que si les quatre sont fournis : sans heure,
 * il n'y a rien de précis à juger, seulement des trous à montrer. Les
 * créneaux, eux, ne demandent pas d'heure : ce sont les débuts possibles
 * pour cette durée, ce jour-là, pour ce technicien.
 */

const schemaRequete = z.object({
  technicienId: z.string().uuid().nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date attendue au format AAAA-MM-JJ")
    .nullable(),
  debutMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 - 1)
    .nullable(),
  dureeMin: z.number().int().positive().nullable(),
});

/** Une chaîne de requête vide vaut absence, jamais une valeur à valider. */
function nonVide(valeur: string | null): string | null {
  return valeur === null || valeur === "" ? null : valeur;
}

/**
 * `08:30` ou `510` — les deux formes que l'écran envoie, une seule lecture.
 * Même lecture que `POST .../deplacer` (`app/api/interventions/[id]/deplacer/route.ts`).
 */
function minutesLocales(valeur: string): number {
  const horaire = /^(\d{1,2}):(\d{2})$/.exec(valeur);
  if (horaire !== null) {
    return Number(horaire[1]) * 60 + Number(horaire[2]);
  }
  return /^\d+$/.test(valeur) ? Number(valeur) : Number.NaN;
}

export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return dansUnEchangeAuth(() => traiter(requete, id));
}

async function traiter(requete: Request, id: string): Promise<Response> {
  const contexte = await exigerCapacite("modifier_planning");
  if (contexte === null) {
    return Response.json({ erreur: "acces_refuse" }, { status: 403 });
  }

  const url = new URL(requete.url);
  const heureBrute = nonVide(url.searchParams.get("heure"));
  const dureeBrute = nonVide(url.searchParams.get("duree"));
  const saisie = schemaRequete.safeParse({
    technicienId: nonVide(url.searchParams.get("technicien")),
    date: nonVide(url.searchParams.get("date")),
    debutMinutes: heureBrute === null ? null : minutesLocales(heureBrute),
    dureeMin: dureeBrute === null ? null : Number(dureeBrute),
  });
  if (!saisie.success) {
    return Response.json({ erreur: "requete_invalide" }, { status: 400 });
  }
  const { technicienId, date, debutMinutes, dureeMin } = saisie.data;

  const resultat = await avecContexteApplicatif(contexte, async (tx) => {
    const ligne = await tx.intervention.findFirst({
      where: { id },
      select: {
        id: true,
        statut: true,
        agence_id: true,
        site_id: true,
        duree_estimee_min: true,
      },
    });
    if (ligne === null) {
      return {
        verdicts: [{ cle: "intervention.refus.inconnue", bloquant: true }],
        creneaux: [],
      };
    }

    const datePlanifiee =
      date === null ? null : new Date(`${date}T00:00:00.000Z`);

    // ── LE VERDICT — un candidat précis, ou rien à juger ────────────────
    //
    // `jugerPose` est LA MÊME fonction que `deplacerIntervention` appelle
    // pour écrire : voir son entête (`lib/interventions/depot.ts`).
    const candidat =
      debutMinutes !== null && dureeMin !== null
        ? schemaDeplacement.safeParse({
            intervention_id: id,
            date_planifiee: datePlanifiee,
            debut_minutes: debutMinutes,
            duree_min: dureeMin,
            technicien_id: technicienId,
          })
        : null;
    const jugement =
      candidat !== null && candidat.success
        ? await jugerPose(tx, contexte, ligne, candidat.data)
        : null;
    const verdicts = [
      ...(jugement !== null && jugement.verdict.refuse
        ? [{ cle: jugement.verdict.cle, bloquant: true }]
        : []),
      ...(jugement?.avertissements ?? []).map((cle) => ({
        cle,
        bloquant: false,
      })),
    ];

    // ── LES CRÉNEAUX — hors heure, pour une durée et un technicien donnés ──
    let creneaux: readonly string[] = [];
    if (technicienId !== null && date !== null && dureeMin !== null) {
      const jour: JourLocal = lireCleJour(date);
      const calendrier = await chargerCalendrierAgence(tx, {
        societeId: contexte.societeId,
        agenceId: ligne.agence_id,
        fenetre: { du: jour, au: jour },
      });
      if (calendrier !== null) {
        const agence = await tx.agence.findFirst({
          where: { id: ligne.agence_id, societe_id: contexte.societeId },
          select: { calendrier: { select: { pas_creneau_minutes: true } } },
        });
        const pasMinutes = agence?.calendrier?.pas_creneau_minutes ?? 0;

        const viseeInstant = instantDuJour(jour);
        const absences = await tx.absence.findMany({
          where: {
            utilisateur_id: technicienId,
            du: { lte: viseeInstant },
            au: { gte: viseeInstant },
          },
          select: { id: true, utilisateur_id: true, du: true, au: true },
        });
        const absent =
          absenceCouvrant(
            absences as readonly AbsenceDeclaree[],
            technicienId,
            viseeInstant,
          ) !== null;

        const bornes = {
          du: viseeInstant,
          au: instantDuJour(jour, 1),
        };
        const voisines = await tx.intervention.findMany({
          where: {
            technicien_id: technicienId,
            date_planifiee: { gte: bornes.du, lt: bornes.au },
            statut: { not: "annulee" },
            NOT: { id: ligne.id },
          },
          select: { creneau_debut: true, creneau_fin: true },
        });
        const occupations: readonly OccupationDuJour[] = voisines
          .filter(
            (voisine): voisine is { creneau_debut: Date; creneau_fin: Date } =>
              voisine.creneau_debut !== null && voisine.creneau_fin !== null,
          )
          .map((voisine) => ({
            debut: voisine.creneau_debut,
            fin: voisine.creneau_fin,
          }));

        const { instant } = maintenant(calendrier.fuseau);
        creneaux = creneauxDisponibles({
          calendrier,
          jour,
          dureeMin,
          pasMinutes,
          occupations,
          absent,
          maintenant: instant,
        }).map((debut) => debut.toISOString());
      }
    }

    return { verdicts, creneaux };
  });

  return Response.json(resultat);
}
