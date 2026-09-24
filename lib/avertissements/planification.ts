import type { Prisma, PrismaClient } from "@prisma/client";

import type { ContexteSession } from "@/lib/auth/contexte";
import { fuseauDeLAgence } from "@/lib/calendar/agence";
import { versLocal, type Fuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { envoyerCourriel } from "@/lib/courriel";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import type { EtatAvantPlanification } from "@/lib/interventions/saisie";

/**
 * AVERTISSEMENTS-1 (24/09/2026) — LA PLANIFICATION PRÉVIENT, PAS LA CRÉATION.
 *
 * Arbitrages d'Alexis, repris tels quels par le ticket :
 *
 * - c'est la PLANIFICATION (`a_planifier` → un statut posé, sous
 *   `deplacerIntervention`) qui déclenche les avertissements, jamais la
 *   création d'une demande ;
 * - le CLIENT est prévenu à l'interlocuteur du SITE portant le rôle
 *   « Donneur d'ordre », à défaut à celui du CLIENT (`site_id` nul) ; sans
 *   destinataire, la planification se fait quand même et l'écran le dit ;
 * - le TECHNICIEN est prévenu par courriel ET par un badge « Nouveau » —
 *   porté par `intervention.vue_technicien_le`, posé ailleurs
 *   (`app/(mobile)/terrain/[id]/page.tsx`).
 * - un DÉPLACEMENT de créneau sur une intervention déjà planifiée prévient
 *   les deux À NOUVEAU, avec l'ancien et le nouveau créneau (arbitrage du
 *   24/09/2026 à 17h25).
 *
 * ## CE QUE CE MODULE NE FAIT PAS
 *
 * Aucun prix, aucune pièce jointe, aucun HTML — la surface de `lib/courriel`
 * ne s'élargit pas (Q8). Aucune nouvelle configuration : le canal absent se
 * dit dans le compte-rendu, la planification reste faite (I4 n'est pas en
 * cause ici, mais le principe est le même que pour tout courriel de ce
 * dépôt).
 *
 * ## LE COMPTE-RENDU VOYAGE PAR DES CLÉS, JAMAIS PAR DU TEXTE
 *
 * Comme `clesDAvertissement` (`../interventions/depot.ts`, RG-PLA-04) : le
 * canal qui reporte un avertissement à l'écran — l'URL de redirection après
 * un POST — est un canal d'écriture ouvert à qui forge un lien (L1-02f, D50).
 * Le motif technique qu'`envoyerCourriel` rend (un code HTTP, un texte du
 * prestataire) n'y voyage donc jamais : `clesAvertissementCourriel` ne rend
 * que des clés fermées — « parti », « non parti », « sans destinataire » —,
 * et c'est délibérément moins riche qu'afficher le motif verbatim.
 */

// ── LE DESTINATAIRE CLIENT (RG PLANIFICATION) ──────────────────────────────

/** Ce que `destinataireClient` a besoin de lire d'un contact. */
export type ContactPourDestinataire = {
  readonly id: string;
  readonly nom: string;
  readonly email: string | null;
  readonly actif: boolean;
  readonly roles: readonly string[];
  readonly site_id: string | null;
};

const ROLE_DONNEUR_ORDRE = "donneur_ordre";

function tri(
  contacts: readonly ContactPourDestinataire[],
): ContactPourDestinataire | null {
  if (contacts.length === 0) {
    return null;
  }
  return [...contacts].sort(
    (a, b) => a.nom.localeCompare(b.nom) || a.id.localeCompare(b.id),
  )[0];
}

/**
 * LE CONTACT QUI REÇOIT LE COURRIEL CLIENT — d'abord le donneur d'ordre du
 * SITE, à défaut celui du CLIENT (`site_id` nul). `null` si aucun n'a
 * l'adresse qu'il faudrait pour recevoir quoi que ce soit.
 *
 * Départage STABLE — nom, puis id — quand plusieurs contacts sont éligibles
 * au même niveau : un ordre qui dépendrait de l'ordre de lecture en base
 * changerait de destinataire d'un envoi à l'autre sans qu'aucune règle ne le
 * décide (même défaut que celui réparé en L3-03 pour la file d'attente).
 */
export function destinataireClient(
  contacts: readonly ContactPourDestinataire[],
  siteId: string,
): ContactPourDestinataire | null {
  const eligibles = contacts.filter(
    (contact) =>
      contact.actif &&
      contact.email !== null &&
      contact.roles.includes(ROLE_DONNEUR_ORDRE),
  );
  const duSite = tri(eligibles.filter((contact) => contact.site_id === siteId));
  if (duSite !== null) {
    return duSite;
  }
  return tri(eligibles.filter((contact) => contact.site_id === null));
}

// ── LA COMPOSITION DES COURRIELS ────────────────────────────────────────────

/** Un créneau, déjà lu dans le fuseau de l'agence — prêt à s'écrire dans un texte. */
export type CreneauLisible = {
  readonly date: string;
  readonly heure: string | null;
};

/** Ce que la composition a besoin de savoir de l'intervention. */
export type DetailPourCourriel = {
  readonly site: { readonly libelle: string; readonly commune: string | null };
  readonly nature: string;
  readonly referenceClient: string | null;
  readonly dureeMin: number | null;
  readonly machine: {
    readonly famille: string;
    readonly marque: string;
    readonly reference: string;
    readonly numeroSerie: string;
  } | null;
};

function libelleCreneau(creneau: CreneauLisible): string {
  return creneau.heure === null
    ? creneau.date
    : `${creneau.date} à ${creneau.heure}`;
}

function lignesCommunes(
  detail: DetailPourCourriel,
  creneau: CreneauLisible,
): readonly string[] {
  const lignes: string[] = [`Date : ${libelleCreneau(creneau)}`];
  if (detail.dureeMin !== null) {
    lignes.push(`Durée prévue : ${detail.dureeMin} min`);
  }
  lignes.push(
    `Lieu : ${detail.site.libelle}` +
      (detail.site.commune === null ? "" : ` — ${detail.site.commune}`),
  );
  lignes.push(`Nature : ${detail.nature}`);
  if (detail.machine !== null) {
    lignes.push(
      `Machine : ${detail.machine.famille} ${detail.machine.marque} ${detail.machine.reference} (S/N ${detail.machine.numeroSerie})`,
    );
  }
  if (detail.referenceClient !== null) {
    lignes.push(`Référence client : ${detail.referenceClient}`);
  }
  return lignes;
}

export function sujetPourClient(deplacement: boolean): string {
  return deplacement
    ? "CODIPLAN — Votre intervention est déplacée"
    : "CODIPLAN — Votre intervention est planifiée";
}

export function sujetPourTechnicien(deplacement: boolean): string {
  return deplacement
    ? "CODIPLAN — Intervention déplacée"
    : "CODIPLAN — Nouvelle intervention affectée";
}

/**
 * Le corps du courriel au CLIENT. `ancien` est `null` pour une PREMIÈRE
 * planification, et porte l'ancien créneau pour un DÉPLACEMENT.
 */
export function corpsPourClient(
  detail: DetailPourCourriel,
  nouveau: CreneauLisible,
  ancien: CreneauLisible | null,
): string {
  const entete =
    ancien === null
      ? "Votre intervention est planifiée :"
      : `Votre intervention est déplacée du ${libelleCreneau(ancien)} au ${libelleCreneau(nouveau)}.`;
  return [entete, "", ...lignesCommunes(detail, nouveau)].join("\n");
}

/**
 * Le corps du courriel au TECHNICIEN — même logique que pour le client, avec
 * en plus le lien vers sa fiche terrain.
 */
export function corpsPourTechnicien(
  detail: DetailPourCourriel,
  nouveau: CreneauLisible,
  ancien: CreneauLisible | null,
  lien: string,
): string {
  const entete =
    ancien === null
      ? "Une intervention vous est affectée :"
      : `Votre intervention est déplacée du ${libelleCreneau(ancien)} au ${libelleCreneau(nouveau)}.`;
  return [entete, "", ...lignesCommunes(detail, nouveau), "", lien].join("\n");
}

// ── L'ORCHESTRATION ─────────────────────────────────────────────────────────

export type EtatEnvoiAvertissement =
  | { readonly type: "parti" }
  | { readonly type: "non_parti"; readonly motif: string }
  | { readonly type: "sans_destinataire" };

/**
 * `null` sur un des deux bords : cet événement ne concerne pas ce
 * destinataire — un changement de technicien seul ne prévient pas le client,
 * et l'ancien technicien d'une réaffectation ne reçoit plus rien ici.
 */
export type CompteRenduAvertissement = {
  readonly client: EtatEnvoiAvertissement | null;
  readonly technicien: EtatEnvoiAvertissement | null;
};

function jourLisible(date: Date): string {
  return (
    `${String(date.getUTCDate()).padStart(2, "0")}/` +
    `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`
  );
}

function heureLisible(instant: Date, fuseau: Fuseau): string {
  const local = versLocal(instant, fuseau);
  return `${String(local.heures).padStart(2, "0")}:${String(local.minutes).padStart(2, "0")}`;
}

function creneauLisible(
  datePlanifiee: Date | null,
  creneauDebut: Date | null,
  fuseau: Fuseau,
): CreneauLisible | null {
  if (datePlanifiee === null) {
    return null;
  }
  return {
    date: jourLisible(datePlanifiee),
    heure: creneauDebut === null ? null : heureLisible(creneauDebut, fuseau),
  };
}

function memeInstant(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.getTime() === b.getTime();
}

function natureLisible(type: string): string {
  const cle = `type_intervention.${type}`;
  return estCleTraduction(cle) ? t(cle) : type;
}

/**
 * LE DÉCLENCHEUR — appelé APRÈS qu'une planification ou un déplacement a été
 * accepté et VALIDÉ en base, jamais dans la même transaction que l'écriture
 * (un courriel ne doit ni retarder ni annuler une planification).
 *
 * `avant` est l'état lu juste avant l'écriture par `deplacerIntervention` ou
 * `affecterTechnicien` — c'est en le comparant à l'état ACTUEL, relu ici, que
 * cette fonction décide qui prévenir et de quoi. `null` quand rien de ce que
 * ce ticket couvre n'a changé (par exemple un redimensionnement qui ne touche
 * ni la date, ni l'heure, ni le technicien).
 */
export async function avertirApresPlanification(
  contexte: ContexteSession,
  interventionId: string,
  avant: EtatAvantPlanification,
  connexion?: PrismaClient,
  environnement: Record<string, string | undefined> = process.env,
): Promise<CompteRenduAvertissement | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: {
          statut: true,
          client_id: true,
          site_id: true,
          technicien_id: true,
          date_planifiee: true,
          creneau_debut: true,
          duree_estimee_min: true,
          type: true,
          reference_client: true,
          agence: {
            select: {
              fuseau_horaire: true,
              societe: { select: { fuseau_horaire: true } },
            },
          },
          site: { select: { libelle: true, commune: true } },
          machines: {
            select: {
              machine: {
                select: {
                  numero_serie: true,
                  modele: {
                    select: {
                      marque: true,
                      reference: true,
                      famille: { select: { libelle: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (intervention === null || intervention.technicien_id === null) {
        return null;
      }

      const premierePlanification =
        avant.statut === "a_planifier" && intervention.statut !== "a_planifier";
      const technicienChange =
        avant.technicienId !== intervention.technicien_id;
      const creneauChange =
        !memeInstant(avant.datePlanifiee, intervention.date_planifiee) ||
        !memeInstant(avant.creneauDebut, intervention.creneau_debut);

      const clientRaison: "planification" | "deplacement" | null =
        premierePlanification
          ? "planification"
          : creneauChange
            ? "deplacement"
            : null;
      const technicienRaison: "planification" | "deplacement" | null =
        premierePlanification
          ? "planification"
          : technicienChange
            ? "planification"
            : creneauChange
              ? "deplacement"
              : null;

      if (clientRaison === null && technicienRaison === null) {
        return null;
      }

      const fuseau = fuseauDeLAgence(intervention.agence);
      const nouveau = creneauLisible(
        intervention.date_planifiee,
        intervention.creneau_debut,
        fuseau,
      );
      if (nouveau === null) {
        // Retourné à la file d'attente : rien à annoncer avec une date.
        return null;
      }
      const ancien =
        clientRaison === "deplacement" || technicienRaison === "deplacement"
          ? creneauLisible(avant.datePlanifiee, avant.creneauDebut, fuseau)
          : null;

      const machineLigne = intervention.machines[0]?.machine ?? null;
      const detail: DetailPourCourriel = {
        site: intervention.site,
        nature: natureLisible(intervention.type),
        referenceClient: intervention.reference_client,
        dureeMin: intervention.duree_estimee_min,
        machine:
          machineLigne === null
            ? null
            : {
                famille: machineLigne.modele.famille.libelle,
                marque: machineLigne.modele.marque,
                reference: machineLigne.modele.reference,
                numeroSerie: machineLigne.numero_serie,
              },
      };

      const client =
        clientRaison === null
          ? null
          : await envoyerAuClient(
              tx,
              environnement,
              intervention.client_id,
              intervention.site_id,
              detail,
              nouveau,
              ancien,
            );

      const technicien =
        technicienRaison === null
          ? null
          : await envoyerAuTechnicien(
              tx,
              environnement,
              intervention.technicien_id,
              interventionId,
              detail,
              nouveau,
              ancien,
            );

      return { client, technicien };
    },
    connexion,
  );
}

async function envoyerAuClient(
  tx: Prisma.TransactionClient,
  environnement: Record<string, string | undefined>,
  clientId: string,
  siteId: string,
  detail: DetailPourCourriel,
  nouveau: CreneauLisible,
  ancien: CreneauLisible | null,
): Promise<EtatEnvoiAvertissement> {
  const contacts = await tx.contact.findMany({
    where: {
      client_id: clientId,
      OR: [{ site_id: siteId }, { site_id: null }],
    },
    select: {
      id: true,
      nom: true,
      email: true,
      actif: true,
      roles: true,
      site_id: true,
    },
  });
  const destinataire = destinataireClient(contacts, siteId);
  if (destinataire === null || destinataire.email === null) {
    return { type: "sans_destinataire" };
  }
  const envoi = await envoyerCourriel(
    {
      destinataire: destinataire.email,
      sujet: sujetPourClient(ancien !== null),
      texte: corpsPourClient(detail, nouveau, ancien),
    },
    environnement,
  );
  return envoi.parti
    ? { type: "parti" }
    : { type: "non_parti", motif: envoi.motif };
}

async function envoyerAuTechnicien(
  tx: Prisma.TransactionClient,
  environnement: Record<string, string | undefined>,
  technicienId: string,
  interventionId: string,
  detail: DetailPourCourriel,
  nouveau: CreneauLisible,
  ancien: CreneauLisible | null,
): Promise<EtatEnvoiAvertissement> {
  const technicien = await tx.utilisateur.findFirst({
    where: { id: technicienId },
    select: { email: true },
  });
  if (technicien === null) {
    return { type: "sans_destinataire" };
  }
  const base = environnement.BETTER_AUTH_URL ?? "";
  const lien = `${base}/terrain/${interventionId}`;
  const envoi = await envoyerCourriel(
    {
      destinataire: technicien.email,
      sujet: sujetPourTechnicien(ancien !== null),
      texte: corpsPourTechnicien(detail, nouveau, ancien, lien),
    },
    environnement,
  );
  return envoi.parti
    ? { type: "parti" }
    : { type: "non_parti", motif: envoi.motif };
}

// ── LE COMPTE-RENDU, RENDU À L'ÉCRAN — DES CLÉS, JAMAIS DU TEXTE ───────────

/**
 * Les clés que le compte-rendu peut rendre à l'écran — closed set, comme
 * `clesDAvertissement` (RG-PLA-04) et pour la même raison : ce canal traverse
 * une redirection HTTP, donc une URL, donc un lien qui peut être forgé
 * (L1-02f, D50). Le motif technique d'`envoyerCourriel` n'y voyage jamais.
 */
export function clesAvertissementCourriel(
  compteRendu: CompteRenduAvertissement,
): readonly CleTraduction[] {
  const cles: CleTraduction[] = [];
  if (compteRendu.client !== null) {
    cles.push(
      compteRendu.client.type === "parti"
        ? "intervention.avertissement.courriel_client_parti"
        : compteRendu.client.type === "sans_destinataire"
          ? "intervention.avertissement.courriel_client_sans_destinataire"
          : "intervention.avertissement.courriel_client_non_parti",
    );
  }
  if (compteRendu.technicien !== null) {
    cles.push(
      compteRendu.technicien.type === "parti"
        ? "intervention.avertissement.courriel_technicien_parti"
        : "intervention.avertissement.courriel_technicien_non_parti",
    );
  }
  return cles;
}
