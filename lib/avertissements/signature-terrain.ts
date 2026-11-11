import type { PrismaClient } from "@prisma/client";

import { exigerSocieteActive, type ContexteSession } from "@/lib/auth/contexte";
import type { Capacite } from "@/lib/auth/habilitations";
import { Role, ROLES_BUREAU } from "@/lib/auth/roles";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { envoyerCourrielMetier, type Envoi } from "@/lib/courriel";
import { construireCourrielMetier } from "@/lib/courriel/gabarit-metier";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import type { IssueSignature } from "@/lib/interventions/saisie";
import { poserNotification } from "@/lib/notifications/depot";
import {
  lireLogoEtRaisonSocialePourCourriel,
  type LogoEtRaisonSociale,
} from "@/lib/societes/logo";

/**
 * L'ALERTE AU RESPONSABLE SAV — ABSENT OU REFUS (9DE-TP-CY1, décisions du
 * 03/10/2026, points 10 et 11 ; AMENDÉE PAR D241, audit UX B1 du 10/11/2026).
 *
 * *« Absent OU refus → un courriel à CHAQUE `responsable_sav` ACTIF de la
 * société »* — jamais au `signee`, qui n'a rien à signaler. Même modèle que
 * `lib/avertissements/planification.ts` : CHAQUE fonction publique lit et
 * compose SOUS le contexte cloisonné, puis envoie HORS de toute transaction
 * (`envoyerAlerte`) — un courriel ne doit ni retarder ni annuler le
 * « Terminer » qu'il annonce.
 *
 * **D241 — L'ALERTE TROUVE TOUJOURS UN DESTINATAIRE QUAND LE BUREAU EXISTE
 * ENCORE.** Avant D241, une société sans `responsable_sav` actif ne recevait
 * RIEN — le technicien lisait « signalez-le vous-même » (B1 de l'audit).
 * `planerAlerteResponsables` tente désormais, DANS CET ORDRE : chaque
 * `responsable_sav` actif ; à défaut, chaque compte actif de `ROLES_BUREAU`
 * (`lib/auth/roles.ts` — exactement « le bureau » de `docs/arbitrages.md`,
 * les rôles internes hors technicien). `type: "sans_destinataire"` ne
 * voyage plus que si AUCUN compte de bureau n'est actif — un cas que
 * l'écran terrain traduit en avertissement, jamais en invitation à se
 * substituer au SAV (M1 de l'audit).
 *
 * **Plusieurs destinataires, jamais un seul courriel à plusieurs `To`** : la
 * consigne dit « un courriel à CHAQUE » destinataire, et c'est un envoi par
 * personne, pas une liste de diffusion.
 *
 * **La notification interne suit le même repli** : `capaciteNotification`
 * voyage dans le plan et distingue les deux cas — `valider_rapport` pour le
 * SAV (inchangé), `consulter_clients_sites` pour le repli bureau, la SEULE
 * capacité de la matrice dont l'ensemble `complet` est exactement
 * `ROLES_BUREAU` (`lib/auth/habilitations.ts`) : sans cette capacité précise,
 * un `adv` recevrait le courriel de repli sans jamais voir la notification
 * correspondante dans l'application, `valider_rapport` ne lui étant pas
 * ouverte.
 *
 * **COURRIEL MÉTIER, MIS EN PAGE (D207, 9EZ-LOGO-SOCIETE-2)** — même texte
 * qu'avant, logo de la société en pièce jointe en ligne, lu UNE SEULE fois
 * pour l'ensemble des destinataires.
 *
 * **LE LOGO NE BLOQUE NI LE GESTE NI L'ENVOI (point 1,
 * 9EZ-LOGO-SOCIETE-4-COURRIELS-SOLDE)** — lu HORS de la transaction qui
 * compose le reste de l'alerte (dans SA PROPRE transaction), et toute erreur
 * y est absorbée : un logo illisible ne fait plus échouer « Terminer ».
 */

export type EtatAlerteResponsables =
  | { readonly type: "sans_destinataire" }
  | { readonly type: "envoyee"; readonly nombre: number };

type PlanAlerte =
  | { readonly type: "sans_destinataire" }
  | {
      readonly type: "a_envoyer";
      readonly destinataires: readonly string[];
      readonly capaciteNotification: Capacite;
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
      const detail = {
        site: intervention.site.libelle,
        client: intervention.client.raison_sociale,
      };
      const responsables = await tx.utilisateurSociete.findMany({
        where: {
          societe_id: societeId,
          role: Role.responsable_sav,
          utilisateur: { actif: true },
        },
        select: { utilisateur: { select: { email: true } } },
      });
      if (responsables.length > 0) {
        return {
          type: "a_envoyer",
          destinataires: responsables.map((r) => r.utilisateur.email),
          capaciteNotification: "valider_rapport",
          sujet: sujetAlerte(),
          texte: texteAlerte(issue, motif, detail),
        };
      }
      // REPLI SUR LE BUREAU (D241, point 2) — aucun `responsable_sav` actif :
      // la société existe peut-être encore sans en avoir désigné un (ou plus
      // aucun n'est actif), et l'alerte ne doit pas disparaître pour autant.
      const bureau = await tx.utilisateurSociete.findMany({
        where: {
          societe_id: societeId,
          role: { in: [...ROLES_BUREAU] },
          utilisateur: { actif: true },
        },
        select: { utilisateur: { select: { email: true } } },
      });
      if (bureau.length === 0) {
        return { type: "sans_destinataire" };
      }
      return {
        type: "a_envoyer",
        destinataires: bureau.map((r) => r.utilisateur.email),
        capaciteNotification: "consulter_clients_sites",
        sujet: sujetAlerte(),
        texte: texteAlerte(issue, motif, detail),
      };
    },
    client,
  );
}

/**
 * POSE LA NOTIFICATION INTERNE ET SON JOURNAL D'ENVOI (9J11), au même point
 * que le courriel qu'elle accompagne — jamais avant de savoir ce qu'il est
 * devenu. `capaciteNotification` vient du plan (D241) : `valider_rapport`
 * (ADMS, DIR, RM, RS au ●) pour le SAV, `consulter_clients_sites` (ADMS, DIR,
 * RM, RS, ADV au ●) pour le repli bureau — jamais un ensemble plus large
 * comme `consulter_parc_complet`, qui ouvrirait au technicien restreint.
 *
 * `partie` dit si TOUS les envois sont partis — un seul motif de refus suffit
 * à dire que l'alerte n'a PAS pleinement atteint ses destinataires, jamais
 * une moyenne.
 */
async function journaliserEnvoi(
  contexte: ContexteSession,
  interventionId: string,
  envois: readonly Envoi[],
  capaciteNotification: Capacite,
  connexion?: PrismaClient,
): Promise<void> {
  const societeId = exigerSocieteActive(contexte);
  const id = await poserNotification(
    contexte,
    "signature_absente_ou_refusee",
    { cible: "intervention", intervention_id: interventionId },
    capaciteNotification,
    undefined,
    connexion,
  );
  const partie = envois.every((envoi) => envoi.parti);
  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const societe = await tx.societe.findUniqueOrThrow({
        where: { id: societeId },
        select: { fuseau_horaire: true },
      });
      const tenteeLe = maintenant(lireFuseau(societe.fuseau_horaire)).instant;
      await tx.notification.update({
        where: { id },
        data: { canal: "courriel", tentee_le: tenteeLe, partie },
      });
    },
    connexion,
  );
}

/** ENVOIE UN PLAN, HORS TRANSACTION — un courriel PAR destinataire. */
async function envoyerAlerte(
  contexte: ContexteSession,
  interventionId: string,
  plan: PlanAlerte,
  societe: LogoEtRaisonSociale,
  environnement: Record<string, string | undefined>,
  connexion?: PrismaClient,
): Promise<EtatAlerteResponsables> {
  if (plan.type === "sans_destinataire") {
    return { type: "sans_destinataire" };
  }
  const envois = await Promise.all(
    plan.destinataires.map((destinataire) =>
      envoyerCourrielMetier(
        construireCourrielMetier(destinataire, plan.sujet, plan.texte, societe),
        environnement,
      ),
    ),
  );
  await journaliserEnvoi(
    contexte,
    interventionId,
    envois,
    plan.capaciteNotification,
    connexion,
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
  if (plan.type === "sans_destinataire") {
    return { type: "sans_destinataire" };
  }
  // LE LOGO ET LA RAISON SOCIALE, LUS UNE SEULE FOIS (D207), DANS LEUR PROPRE
  // TRANSACTION (point 1, 9EZ-LOGO-SOCIETE-4) — jamais une fois par
  // `responsable_sav`, et une erreur ici ne défait pas l'alerte composée.
  const societeId = exigerSocieteActive(contexte);
  const societe = await lireLogoEtRaisonSocialePourCourriel(
    contexte,
    societeId,
    connexion,
  );
  return envoyerAlerte(
    contexte,
    interventionId,
    plan,
    societe,
    environnement,
    connexion,
  );
}
