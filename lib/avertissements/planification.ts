import type { Prisma, PrismaClient } from "@prisma/client";

import { exigerSocieteActive, type ContexteSession } from "@/lib/auth/contexte";
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
 * ## AMENDEMENT D141 (QG-5, 9CO-PG-G14A-TRANSMETTRE, 02/10/2026) — LE
 * TECHNICIEN ATTEND LA TRANSMISSION
 *
 * *« Planifiée » = préparée par le bureau, INVISIBLE du terrain ; « Transmettre »
 * passe Planifiée → Affectée, envoie le courriel au technicien et rend
 * visible.* Le CLIENT garde la règle écrite ci-dessus, inchangée — prévenu à
 * la planification. Le TECHNICIEN, lui, n'est plus prévenu qu'à compter du
 * moment où la ligne est `affectee` : jamais sur une simple Planifiée, qu'il
 * s'agisse de la planification elle-même, d'un déplacement ou d'un
 * changement de technicien. Voir `technicienRaison` et `ancienTechnicien`,
 * plus bas.
 *
 * ## PRÉCISIONS DU 02/10/2026 SOUS D141 (9CT-RETOUCHES-5)
 *
 * **Point 6** — une AFFECTÉE remise dans la file (sa date vidée, elle
 * retombe à `a_planifier`, QG-4) PRÉVIENT le technicien d'avant par le
 * courriel « retirée » EXISTANT, celui du changement de technicien ; aucun
 * texte neuf. Voir `remiseDansLaFile`, dans `avertirApresPlanification`.
 *
 * **Les courriels partent HORS de toute transaction** — voir `PlanEnvoi` et
 * `envoyerPlan`, plus bas : composer un courriel lit la base, l'envoyer non.
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

function tri<T extends ContactPourDestinataire>(
  contacts: readonly T[],
): T | null {
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
 *
 * **`siteId` accepte `null`** depuis CS45 (QT-16, D165) — la fiche CLIENT,
 * qui n'a aucun site en contexte, veut le donneur d'ordre du client LUI-MÊME,
 * jamais celui d'un de ses sites. Aucun contact ne porte jamais `site_id ===
 * null` comme IDENTIFIANT DE SITE réel (c'est la marque « contact du client »),
 * si bien que `contact.site_id === siteId` avec `siteId` nul retombe
 * exactement sur le même filtre que la ligne suivante : rien n'est recopié,
 * la première branche rend simplement déjà la bonne réponse.
 *
 * **GÉNÉRIQUE depuis 9EE-TP-UX4-1-FICHE-INTERVENTION-2** — la carte « Sur
 * place » de la fiche intervention a besoin, du contact rendu, de champs que
 * `ContactPourDestinataire` ne porte pas (`fonction`, `telephone`, `mobile`) :
 * `T extends ContactPourDestinataire` rend le contact REÇU, jamais retaillé
 * au plus petit dénominateur commun — les cinq appelants existants, qui ne
 * lisent que `nom`/`email`, n'ont rien à changer (l'inférence leur rend ce
 * qu'ils passaient déjà).
 */
export function destinataireClient<T extends ContactPourDestinataire>(
  contacts: readonly T[],
  siteId: string | null,
): T | null {
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

/**
 * EXPORTÉE (9CP-PG-G14B-TRANSMETTRE-GROUPE) — le récapitulatif d'une
 * transmission groupée compose SON entête avec cette même fonction, jamais
 * une seconde écriture du couple date/heure (§9, 01/09).
 */
export function libelleCreneau(creneau: CreneauLisible): string {
  return creneau.heure === null
    ? creneau.date
    : `${creneau.date} à ${creneau.heure}`;
}

/**
 * EXPORTÉE (9CP-PG-G14B-TRANSMETTRE-GROUPE) — le récapitulatif groupé compose
 * UN bloc par intervention avec cette même fonction, jamais une seconde
 * écriture des lignes communes.
 */
export function lignesCommunes(
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

export function sujetPourAncienTechnicien(): string {
  return "CODIPLAN — Intervention retirée de votre planning";
}

/**
 * Le corps du courriel à l'ANCIEN technicien d'une réaffectation
 * (AVERTISSEMENTS-2). `ancien` porte le créneau tel qu'IL le connaissait —
 * pas le nouveau, qui n'est plus le sien. Ni lien `/terrain`, ni nom du
 * nouveau technicien : cette intervention ne lui appartient plus.
 */
export function corpsPourAncienTechnicien(
  detail: DetailPourCourriel,
  ancien: CreneauLisible,
): string {
  return [
    "Cette intervention ne vous est plus affectée :",
    "",
    ...lignesCommunes(detail, ancien),
  ].join("\n");
}

// ── L'ORCHESTRATION ─────────────────────────────────────────────────────────

export type EtatEnvoiAvertissement =
  | { readonly type: "parti" }
  | { readonly type: "non_parti"; readonly motif: string }
  | { readonly type: "sans_destinataire" };

/**
 * UN ENVOI PLANIFIÉ, MAIS PAS ENCORE FAIT (9CT-RETOUCHES-5) — ce que la
 * transaction de LECTURE compose, avant de se refermer.
 *
 * **Pourquoi cette scission.** `DELAI_ENVOI_MS` (`lib/courriel/resend.ts`)
 * vaut 10 secondes ; une transaction Prisma ouverte par
 * `avecContexteApplicatif` sans `delais` explicite retombe sur les défauts
 * de Prisma — 2 000 ms pour obtenir une connexion, 5 000 ms pour toute la
 * transaction (`lib/db/rls.ts`). Composer un courriel EXIGE de lire la base
 * (contact, technicien) ; l'ENVOYER n'exige plus rien de la base. Tant que
 * `envoyerCourriel` était appelé DANS la transaction, un seul envoi lent — ou
 * plusieurs envoyés en série, comme le récapitulatif groupé — dépassait ce
 * budget et faisait ÉCHOUER LA TRANSACTION, alors que l'écriture qu'elle
 * accompagnait (la planification, la transmission) avait déjà été validée
 * par un AUTRE appel, plus tôt. Un courriel ne doit ni retarder ni annuler le
 * geste qu'il annonce : désormais, CHAQUE fonction publique de ce module lit
 * et compose SOUS le contexte cloisonné, puis envoie HORS de toute
 * transaction, par `envoyerPlan`, plus bas.
 *
 * `sans_destinataire` est déjà résolu ICI — pendant la lecture, sous le
 * contexte cloisonné : savoir si un destinataire existe est une question à
 * la base, jamais à `envoyerCourriel`.
 */
type PlanEnvoi =
  | { readonly type: "sans_destinataire" }
  | {
      readonly type: "a_envoyer";
      readonly destinataire: string;
      readonly sujet: string;
      readonly texte: string;
    };

/**
 * ENVOIE UN PLAN, HORS TRANSACTION — la seule fonction de ce module qui
 * appelle `envoyerCourriel`. `EtatEnvoiRecapitulatif` a la même forme que
 * `EtatEnvoiAvertissement` (trois variantes identiques) ; cette fonction sert
 * les deux sans qu'aucun des deux types ne soit élargi pour l'autre.
 */
async function envoyerPlan(
  plan: PlanEnvoi,
  environnement: Record<string, string | undefined>,
): Promise<EtatEnvoiAvertissement> {
  if (plan.type === "sans_destinataire") {
    return { type: "sans_destinataire" };
  }
  const envoi = await envoyerCourriel(
    {
      destinataire: plan.destinataire,
      sujet: plan.sujet,
      texte: plan.texte,
    },
    environnement,
  );
  return envoi.parti
    ? { type: "parti" }
    : { type: "non_parti", motif: envoi.motif };
}

/**
 * `null` (ou absent) sur un bord : cet événement ne concerne pas ce
 * destinataire — un changement de technicien seul ne prévient pas le client.
 *
 * `ancienTechnicien` (AVERTISSEMENTS-2, 25/09/2026) est OPTIONNEL — les
 * comptes-rendus composés avant ce ticket n'en portent aucun, et ce n'est pas
 * la même chose qu'un `null` explicite à traiter en plus. Absent ou `null` :
 * même lecture, « rien à dire ». Renseigné seulement quand le technicien
 * change ET qu'il y en avait un avant : première planification
 * (`avant.technicienId === null`) ou simple déplacement (même technicien) ne
 * le renseignent jamais.
 */
export type CompteRenduAvertissement = {
  readonly client: EtatEnvoiAvertissement | null;
  readonly technicien: EtatEnvoiAvertissement | null;
  readonly ancienTechnicien?: EtatEnvoiAvertissement | null;
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

/**
 * EXPORTÉE (9CP-PG-G14B-TRANSMETTRE-GROUPE) — `avertirApresTransmissionGroupee`
 * relit les lignes transmises et compose LEUR créneau avec cette même
 * fonction, jamais une seconde lecture du couple date/heure (§9, 01/09).
 */
export function creneauLisible(
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

/**
 * EXPORTÉE (9CP-PG-G14B-TRANSMETTRE-GROUPE) — le récapitulatif groupé lit la
 * même nature, jamais une seconde traduction du type d'intervention.
 */
export function natureLisible(type: string): string {
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
  const societeId = exigerSocieteActive(contexte);
  const plan = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId, societe_id: societeId },
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
      if (intervention === null) {
        return null;
      }

      const fuseau = fuseauDeLAgence(intervention.agence);
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

      // ── DÉCISION D'ALEXIS DU 02/10/2026, POINT 6 (D141, 9CT-RETOUCHES-5) —
      // UNE AFFECTÉE REMISE DANS LA FILE PRÉVIENT LE TECHNICIEN ────────────
      //
      // *Une Affectée dont la date est vidée retombe à `a_planifier`
      // (QG-4)* : le technicien qui la voyait sur son terrain ne doit pas la
      // découvrir disparue sans un mot. Le courriel « retirée » EXISTANT
      // (celui du changement de technicien, `envoyerAlAncienTechnicien` /
      // `planerEnvoiAncienTechnicien` plus bas) suffit — aucun texte neuf.
      //
      // **Avant `intervention.technicien_id === null`, pas après** : le
      // chemin TIROIR (`components/planning/tiroir.tsx`) EFFACE le
      // technicien en même temps que la date — `intervention.technicien_id`
      // vaut déjà `null` ici — alors que le chemin FICHE le garde. Les deux
      // préviennent, et seul `avant.technicienId` (QUI avant l'écriture)
      // nomme qui prévenir ; le lire sur `intervention.technicien_id`
      // aurait manqué le chemin tiroir.
      //
      // **Le CLIENT ne reçoit rien de plus ici** (décision du 02/10/2026) :
      // la branche normale, plus bas, ne l'aurait pas davantage prévenu —
      // `nouveau` y est `null` dès qu'il n'y a plus de date.
      const remiseDansLaFile =
        avant.statut === "affectee" &&
        intervention.statut === "a_planifier" &&
        avant.technicienId !== null;
      if (remiseDansLaFile) {
        const ancienCreneau = creneauLisible(
          avant.datePlanifiee,
          avant.creneauDebut,
          fuseau,
        );
        if (ancienCreneau === null) {
          // Impossible en pratique : une Affectée porte toujours sa date.
          // Un manque se nomme, jamais une remise tue.
          return null;
        }
        const ancienTechnicien = await planerEnvoiAncienTechnicien(
          tx,
          societeId,
          // `avant.technicienId !== null` est déjà vérifié par
          // `remiseDansLaFile` ; TypeScript ne l'infère pas à travers la
          // variable intermédiaire.
          avant.technicienId as string,
          detail,
          ancienCreneau,
        );
        return { client: null, technicien: null, ancienTechnicien };
      }

      if (intervention.technicien_id === null) {
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

      // ── LE TECHNICIEN N'EST PRÉVENU QU'UNE FOIS « AFFECTÉE » (QG-5, D141,
      // 9CO-PG-G14A-TRANSMETTRE) ────────────────────────────────────────────
      //
      // *« Planifiée » = préparée par le bureau, INVISIBLE du terrain ;
      // « Transmettre » rend visible.* Avant ce ticket, `technicienRaison`
      // copiait `premierePlanification` — le technicien apprenait une
      // intervention qu'il ne pouvait pas encore voir. Désormais, AUCUN
      // courriel technicien ne part tant que la ligne n'est pas `affectee` —
      // ni à la planification, ni à un déplacement ou un changement de
      // technicien sur une simple Planifiée.
      const transmission =
        avant.statut === "planifiee" && intervention.statut === "affectee";
      const technicienRaison: "planification" | "deplacement" | null =
        intervention.statut !== "affectee"
          ? null
          : transmission
            ? "planification"
            : technicienChange
              ? "planification"
              : creneauChange
                ? "deplacement"
                : null;

      if (clientRaison === null && technicienRaison === null) {
        return null;
      }

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

      const client =
        clientRaison === null
          ? null
          : await planerEnvoiClient(
              tx,
              societeId,
              intervention.client_id,
              intervention.site_id,
              detail,
              nouveau,
              ancien,
            );

      const technicien =
        technicienRaison === null
          ? null
          : await planerEnvoiTechnicien(
              tx,
              societeId,
              intervention.technicien_id,
              interventionId,
              environnement,
              detail,
              nouveau,
              ancien,
            );

      // ── L'ANCIEN TECHNICIEN D'UNE RÉAFFECTATION (AVERTISSEMENTS-2) ───────
      //
      // Son créneau à LUI, jamais le nouveau : ce que `ancien` porte plus
      // haut dépend d'un DÉPLACEMENT, pas d'un changement de technicien, et
      // vaut `null` dans la réaffectation pure que ce ticket couvre.
      //
      // **`avant.statut === "affectee"` (D141, 9CO-PG-G14A-TRANSMETTRE)** —
      // l'ancien technicien n'a rien à « retrouver retiré » s'il n'a jamais
      // été prévenu : réaffecter une simple Planifiée reste silencieuse pour
      // lui comme pour le nouveau (même raison que `technicienRaison`
      // ci-dessus).
      const ancienCreneauPourAncienTechnicien = creneauLisible(
        avant.datePlanifiee,
        avant.creneauDebut,
        fuseau,
      );
      const ancienTechnicien =
        avant.statut === "affectee" &&
        technicienChange &&
        avant.technicienId !== null &&
        ancienCreneauPourAncienTechnicien !== null
          ? await planerEnvoiAncienTechnicien(
              tx,
              societeId,
              avant.technicienId,
              detail,
              ancienCreneauPourAncienTechnicien,
            )
          : null;

      return { client, technicien, ancienTechnicien };
    },
    connexion,
  );

  // ── PHASE B — HORS TRANSACTION (9CT-RETOUCHES-5) ─────────────────────────
  if (plan === null) {
    return null;
  }
  const client =
    plan.client === null ? null : await envoyerPlan(plan.client, environnement);
  const technicien =
    plan.technicien === null
      ? null
      : await envoyerPlan(plan.technicien, environnement);
  const ancienTechnicien =
    plan.ancienTechnicien === null
      ? null
      : await envoyerPlan(plan.ancienTechnicien, environnement);
  return { client, technicien, ancienTechnicien };
}

async function planerEnvoiClient(
  tx: Prisma.TransactionClient,
  societeId: string,
  clientId: string,
  siteId: string,
  detail: DetailPourCourriel,
  nouveau: CreneauLisible,
  ancien: CreneauLisible | null,
): Promise<PlanEnvoi> {
  const contacts = await tx.contact.findMany({
    where: {
      societe_id: societeId,
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
  return {
    type: "a_envoyer",
    destinataire: destinataire.email,
    sujet: sujetPourClient(ancien !== null),
    texte: corpsPourClient(detail, nouveau, ancien),
  };
}

async function planerEnvoiTechnicien(
  tx: Prisma.TransactionClient,
  societeId: string,
  technicienId: string,
  interventionId: string,
  environnement: Record<string, string | undefined>,
  detail: DetailPourCourriel,
  nouveau: CreneauLisible,
  ancien: CreneauLisible | null,
): Promise<PlanEnvoi> {
  const technicien = await tx.utilisateur.findFirst({
    where: { id: technicienId, societes: { some: { societe_id: societeId } } },
    select: { email: true },
  });
  if (technicien === null) {
    return { type: "sans_destinataire" };
  }
  const base = environnement.BETTER_AUTH_URL ?? "";
  const lien = `${base}/terrain/${interventionId}`;
  return {
    type: "a_envoyer",
    destinataire: technicien.email,
    sujet: sujetPourTechnicien(ancien !== null),
    texte: corpsPourTechnicien(detail, nouveau, ancien, lien),
  };
}

async function planerEnvoiAncienTechnicien(
  tx: Prisma.TransactionClient,
  societeId: string,
  technicienId: string,
  detail: DetailPourCourriel,
  ancien: CreneauLisible,
): Promise<PlanEnvoi> {
  const technicien = await tx.utilisateur.findFirst({
    where: { id: technicienId, societes: { some: { societe_id: societeId } } },
    select: { email: true },
  });
  if (technicien === null) {
    return { type: "sans_destinataire" };
  }
  return {
    type: "a_envoyer",
    destinataire: technicien.email,
    sujet: sujetPourAncienTechnicien(),
    texte: corpsPourAncienTechnicien(detail, ancien),
  };
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
  if (
    compteRendu.ancienTechnicien !== null &&
    compteRendu.ancienTechnicien !== undefined
  ) {
    cles.push(
      compteRendu.ancienTechnicien.type === "parti"
        ? "intervention.avertissement.courriel_ancien_technicien_parti"
        : "intervention.avertissement.courriel_ancien_technicien_non_parti",
    );
  }
  return cles;
}

// ── LE RÉCAPITULATIF D'UNE TRANSMISSION GROUPÉE (QG-5, D141,
// 9CP-PG-G14B-TRANSMETTRE-GROUPE) ───────────────────────────────────────────
//
// « Transmettre demain » et « Transmettre toutes les planifiées prêtes »
// transmettent PLUSIEURS lignes d'un coup (`transmettreEnGroupe`,
// `lib/interventions/depot.ts`) ; le technicien reçoit alors UN SEUL
// courriel récapitulatif, jamais un courriel par intervention (précisions
// du 02/10/2026 sous D141, point 2) — même discipline que le reste de ce
// module : aucun prix, aucune pièce jointe, aucun HTML.

/** Une ligne du récapitulatif — tout ce qu'il faut pour composer SON bloc. */
export type LigneRecapitulatif = {
  readonly technicienId: string;
  /** `creneau_debut` BRUT — le tri chronologique se fait sur l'instant, jamais sur le texte déjà composé. */
  readonly instant: Date;
  readonly detail: DetailPourCourriel;
  readonly creneau: CreneauLisible;
  readonly lien: string;
};

/**
 * REGROUPE PAR TECHNICIEN, PUIS TRIE CHAQUE GROUPE PAR CRÉNEAU — fonction
 * PURE, éprouvée sans courriel ni base.
 *
 * Le tri porte sur `instant` (un `Date`), jamais sur `creneau.date` (une
 * chaîne « JJ/MM/AAAA ») : un tri lexicographique sur cette chaîne mettrait
 * le 03/10 avant le 12/09 de l'année suivante.
 */
export function groupesParTechnicien(
  lignes: readonly LigneRecapitulatif[],
): ReadonlyMap<string, readonly LigneRecapitulatif[]> {
  const parTechnicien = new Map<string, LigneRecapitulatif[]>();
  for (const ligne of lignes) {
    const liste = parTechnicien.get(ligne.technicienId) ?? [];
    liste.push(ligne);
    parTechnicien.set(ligne.technicienId, liste);
  }
  for (const liste of parTechnicien.values()) {
    liste.sort((a, b) => a.instant.getTime() - b.instant.getTime());
  }
  return parTechnicien;
}

/** L'objet du courriel récapitulatif — « CODIPLAN — Interventions transmises (N) ». */
export function sujetRecapitulatifTechnicien(nombre: number): string {
  return `CODIPLAN — Interventions transmises (${nombre})`;
}

function enteteRecapitulatif(nombre: number): string {
  return nombre === 1
    ? "1 intervention vous est affectée :"
    : `${nombre} interventions vous sont affectées :`;
}

/**
 * LE CORPS DU COURRIEL RÉCAPITULATIF — un bloc `lignesCommunes` + le lien
 * `/terrain/{id}` par intervention, dans l'ordre déjà posé par
 * `groupesParTechnicien` (date puis heure).
 */
export function corpsRecapitulatifTechnicien(
  lignes: readonly Omit<LigneRecapitulatif, "technicienId">[],
): string {
  const blocs = lignes.map((ligne) =>
    [...lignesCommunes(ligne.detail, ligne.creneau), ligne.lien].join("\n"),
  );
  return [enteteRecapitulatif(lignes.length), "", blocs.join("\n\n")].join(
    "\n",
  );
}

/** L'état d'un envoi récapitulatif — fermé, comme le reste de ce module. */
export type EtatEnvoiRecapitulatif =
  | { readonly type: "parti" }
  | { readonly type: "non_parti"; readonly motif: string }
  | { readonly type: "sans_destinataire" };

/** Le compte-rendu d'UN technicien, dans une transmission groupée. */
export type CompteRenduRecapitulatif = {
  readonly technicienId: string;
  readonly nombre: number;
  readonly envoi: EtatEnvoiRecapitulatif;
};

/**
 * LE DÉCLENCHEUR GROUPÉ — appelé APRÈS que `transmettreEnGroupe` a validé en
 * base, jamais dans la même transaction (même discipline que
 * `avertirApresPlanification` : un courriel ne doit ni retarder ni annuler
 * une transmission).
 *
 * **Relit les lignes transmises**, plutôt que de recevoir leur détail déjà
 * composé : `transmettreEnGroupe` ne porte que des `id`, et c'est ici,
 * jamais dans le dépôt, que vit la composition d'un courriel (même partage
 * des rôles que `avertirApresPlanification`/`transmettreIntervention`).
 */
export async function avertirApresTransmissionGroupee(
  contexte: ContexteSession,
  interventionIds: readonly string[],
  connexion?: PrismaClient,
  environnement: Record<string, string | undefined> = process.env,
): Promise<readonly CompteRenduRecapitulatif[]> {
  if (interventionIds.length === 0) {
    return [];
  }
  const societeId = exigerSocieteActive(contexte);
  // ── PHASE A — LECTURE ET COMPOSITION, SOUS LE CONTEXTE CLOISONNÉ
  // (9CT-RETOUCHES-5) ──────────────────────────────────────────────────────
  const plans = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lignes = await tx.intervention.findMany({
        where: { id: { in: [...interventionIds] }, societe_id: societeId },
        select: {
          id: true,
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

      const base = environnement.BETTER_AUTH_URL ?? "";
      const recapitulatifs: LigneRecapitulatif[] = [];
      for (const ligne of lignes) {
        // Impossible en pratique : seules des lignes « prêtes »
        // (`listerPlanifieesATransmettre`) arrivent ici, et « prête » exige
        // les deux. Un manque se nomme, jamais une ligne tue.
        if (ligne.technicien_id === null || ligne.creneau_debut === null) {
          continue;
        }
        const fuseau = fuseauDeLAgence(ligne.agence);
        const creneau = creneauLisible(
          ligne.date_planifiee,
          ligne.creneau_debut,
          fuseau,
        );
        if (creneau === null) {
          continue;
        }
        const machineLigne = ligne.machines[0]?.machine ?? null;
        recapitulatifs.push({
          technicienId: ligne.technicien_id,
          instant: ligne.creneau_debut,
          detail: {
            site: ligne.site,
            nature: natureLisible(ligne.type),
            referenceClient: ligne.reference_client,
            dureeMin: ligne.duree_estimee_min,
            machine:
              machineLigne === null
                ? null
                : {
                    famille: machineLigne.modele.famille.libelle,
                    marque: machineLigne.modele.marque,
                    reference: machineLigne.modele.reference,
                    numeroSerie: machineLigne.numero_serie,
                  },
          },
          creneau,
          lien: `${base}/terrain/${ligne.id}`,
        });
      }

      const parTechnicien = groupesParTechnicien(recapitulatifs);
      const plansParTechnicien: Array<{
        readonly technicienId: string;
        readonly nombre: number;
        readonly plan: PlanEnvoi;
      }> = [];
      for (const [technicienId, lignesDuTechnicien] of parTechnicien) {
        const plan = await planerRecapitulatif(
          tx,
          societeId,
          technicienId,
          lignesDuTechnicien,
        );
        plansParTechnicien.push({
          technicienId,
          nombre: lignesDuTechnicien.length,
          plan,
        });
      }
      return plansParTechnicien;
    },
    connexion,
  );

  // ── PHASE B — HORS TRANSACTION (9CT-RETOUCHES-5) — un envoi SÉQUENTIEL par
  // technicien, comme avant ; ce qui change, c'est que plus aucun n'est fait
  // SOUS la transaction qui a servi à les composer. ────────────────────────
  const comptesRendus: CompteRenduRecapitulatif[] = [];
  for (const { technicienId, nombre, plan } of plans) {
    const envoi = await envoyerPlan(plan, environnement);
    comptesRendus.push({ technicienId, nombre, envoi });
  }
  return comptesRendus;
}

async function planerRecapitulatif(
  tx: Prisma.TransactionClient,
  societeId: string,
  technicienId: string,
  lignes: readonly LigneRecapitulatif[],
): Promise<PlanEnvoi> {
  const technicien = await tx.utilisateur.findFirst({
    where: { id: technicienId, societes: { some: { societe_id: societeId } } },
    select: { email: true },
  });
  if (technicien === null) {
    return { type: "sans_destinataire" };
  }
  return {
    type: "a_envoyer",
    destinataire: technicien.email,
    sujet: sujetRecapitulatifTechnicien(lignes.length),
    texte: corpsRecapitulatifTechnicien(lignes),
  };
}
