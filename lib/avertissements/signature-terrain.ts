import type { PrismaClient } from "@prisma/client";

import { exigerSocieteActive, type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";
import { envoyerCourriel } from "@/lib/courriel";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import type { IssueSignature } from "@/lib/interventions/saisie";

/**
 * L'ALERTE AU RESPONSABLE SAV — ABSENT OU REFUS (9DE-TP-CY1, décisions du
 * 03/10/2026, points 10 et 11).
 *
 * *« Absent OU refus → un courriel à CHAQUE `responsable_sav` de la
 * société »* — jamais au `signee`, qui n'a rien à signaler. Même modèle que
 * `lib/avertissements/planification.ts` : CHAQUE fonction publique lit et
 * compose SOUS le contexte cloisonné, puis envoie HORS de toute transaction
 * (`envoyerPlan`) — un courriel ne doit ni retarder ni annuler le « Terminer »
 * qu'il annonce.
 *
 * **Plusieurs destinataires, jamais un seul courriel à plusieurs `To`** : la
 * consigne dit « un courriel à CHAQUE responsable_sav », et c'est un envoi
 * par personne, pas une liste de diffusion.
 *
 * **Aucun destinataire = rien envoyé, et l'écran le dit** (même honnêteté que
 * 9DB) : `type: "sans_destinataire"` voyage jusqu'à la route terrain, qui le
 * traduit en motif affiché plutôt que de laisser croire qu'une alerte est
 * partie.
 */

export type EtatAlerteResponsables =
  | { readonly type: "sans_destinataire" }
  | { readonly type: "envoyee"; readonly nombre: number };

type PlanAlerte =
  | { readonly type: "sans_destinataire" }
  | {
      readonly type: "a_envoyer";
      readonly destinataires: readonly string[];
      readonly sujet: string;
      readonly texte: string;
    };

function sujetAlerte(): string {
  return t("terrain.terminer.alerte_sujet");
}

function texteAlerte(
  issue: Exclude<IssueSignature, "signee">,
  motif: string,
  detail: { readonly site: string; readonly client: string },
): string {
  const entete =
    issue === "client_absent"
      ? t("terrain.terminer.alerte_entete_absent")
      : t("terrain.terminer.alerte_entete_refus");
  return [
    entete,
    "",
    `${t("terrain.terminer.alerte_client_libelle")} ${detail.client}`,
    `${mot("site")} : ${detail.site}`,
    `${t("terrain.terminer.alerte_motif_libelle")} ${motif}`,
  ].join("\n");
}

async function planerAlerteResponsables(
  contexte: ContexteSession,
  interventionId: string,
  issue: Exclude<IssueSignature, "signee">,
  motif: string,
  client?: PrismaClient,
): Promise<PlanAlerte> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: {
          site: { select: { libelle: true } },
          client: { select: { raison_sociale: true } },
        },
      });
      if (intervention === null) {
        return { type: "sans_destinataire" };
      }
      const responsables = await tx.utilisateurSociete.findMany({
        where: {
          societe_id: societeId,
          role: Role.responsable_sav,
          utilisateur: { actif: true },
        },
        select: { utilisateur: { select: { email: true } } },
      });
      if (responsables.length === 0) {
        return { type: "sans_destinataire" };
      }
      return {
        type: "a_envoyer",
        destinataires: responsables.map((r) => r.utilisateur.email),
        sujet: sujetAlerte(),
        texte: texteAlerte(issue, motif, {
          site: intervention.site.libelle,
          client: intervention.client.raison_sociale,
        }),
      };
    },
    client,
  );
}

/** ENVOIE UN PLAN, HORS TRANSACTION — un courriel PAR destinataire. */
async function envoyerAlerte(
  plan: PlanAlerte,
  environnement: Record<string, string | undefined>,
): Promise<EtatAlerteResponsables> {
  if (plan.type === "sans_destinataire") {
    return { type: "sans_destinataire" };
  }
  await Promise.all(
    plan.destinataires.map((destinataire) =>
      envoyerCourriel(
        { destinataire, sujet: plan.sujet, texte: plan.texte },
        environnement,
      ),
    ),
  );
  return { type: "envoyee", nombre: plan.destinataires.length };
}

/**
 * LE DÉCLENCHEUR — appelé APRÈS que `terminerIntervention` a accepté
 * l'issue « client_absent » ou « refus_signature », jamais dans la même
 * transaction que l'écriture.
 */
export async function alerterResponsablesSAV(
  contexte: ContexteSession,
  interventionId: string,
  issue: Exclude<IssueSignature, "signee">,
  motif: string,
  connexion?: PrismaClient,
  environnement: Record<string, string | undefined> = process.env,
): Promise<EtatAlerteResponsables> {
  const plan = await planerAlerteResponsables(
    contexte,
    interventionId,
    issue,
    motif,
    connexion,
  );
  return envoyerAlerte(plan, environnement);
}
