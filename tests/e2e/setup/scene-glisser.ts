import { PrismaClient } from "@prisma/client";

import { instantAMinutes } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./base";
import { jourDeLaScene, type ReperesDeScene } from "./scene";

/**
 * LA SCÈNE DU GLISSER-DÉPOSER, PROPRE À CHAQUE SCÉNARIO (99XA-STAB-GLISSER).
 *
 * ## Pourquoi ceci existe, et pourquoi `scene.ts` ne suffisait plus
 *
 * `tests/e2e/glisser-deposer.spec.ts` visait `SCENE.glissable`,
 * `SCENE.chevauchante` et `SCENE.obstacle` — des fixtures ÉCRITES UNE FOIS par
 * la préparation globale, avant toute la suite. Un scénario qui DÉPLACE
 * réellement un bloc (le premier du fichier) le laisse à sa nouvelle place —
 * *une mutation permanente que la scène ne refait jamais*. Mesuré le
 * 27/09/2026 (`--repeat-each=5`) : dès la deuxième exécution du fichier dans
 * le même processus, le témoin d'origine ne trouvait plus le bloc — il avait
 * déjà été déplacé par la précédente. Le même mécanisme frappe une reprise
 * CI : `test.describe.configure({ mode: "serial" })` fait qu'un échec ANNULE
 * les scénarios suivants, et la reprise **rejoue tout le fichier depuis le
 * premier** — y compris celui qui avait déjà réussi et déjà muté sa fixture.
 *
 * La correction n'est pas d'empêcher la mutation — un déplacement accepté
 * DOIT en produire une, c'est ce que le scénario éprouve — mais de ne plus la
 * faire porter sur une ligne que la suite entière partage. Chaque appel de
 * `poserInterventionGlisser` écrit sa PROPRE ligne, avec un identifiant tiré
 * au sort à l'instant de l'appel (jamais un identifiant fixe) : une reprise,
 * un `--repeat-each`, ou même une simple ré-exécution manuelle du fichier
 * partent tous d'un état vierge.
 */

type Lieu = { agenceId: string; siteId: string; clientId: string };

async function lieuDe(
  client: PrismaClient,
  societeId: string,
  codeAgence: "KONE" | "DUCOS",
): Promise<Lieu> {
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: societeId, code: codeAgence },
    select: { id: true },
  });
  const site = await client.site.findFirstOrThrow({
    where: { societe_id: societeId, agence_id: agence.id },
    select: { id: true, client_id: true },
    orderBy: { libelle: "asc" },
  });
  return { agenceId: agence.id, siteId: site.id, clientId: site.client_id };
}

export type PoseGlisser = {
  /** `KONE` ferme le samedi, `DUCOS` l'ouvre — le repère dont deux scénarios ont besoin. */
  readonly codeAgence: "KONE" | "DUCOS";
  readonly technicienId: string;
  /** Rang depuis le lundi de la scène — voir `MARDI`/`MERCREDI`/`SAMEDI`. */
  readonly rang: number;
  /** `null` : sans créneau, posée en file d'attente — comme l'ancien `SCENE.glissable`. */
  readonly debut: number | null;
  readonly duree: number;
};

/**
 * Pose une intervention pour LE SEUL scénario qui l'appelle et rend son
 * identifiant. Jamais lue ni écrite par aucun autre fichier — l'appelant la
 * retire lui-même en fin de scénario, avec `retirerInterventionGlisser`.
 */
export async function poserInterventionGlisser(
  reperes: ReperesDeScene,
  pose: PoseGlisser,
): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const lieu = await lieuDe(client, reperes.societeId, pose.codeAgence);
    const jour = jourDeLaScene(reperes, pose.rang);
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: lieu.agenceId,
        client_id: lieu.clientId,
        site_id: lieu.siteId,
        technicien_id: pose.technicienId,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut:
          pose.debut === null
            ? null
            : instantAMinutes(jour, pose.debut, reperes.fuseau),
        creneau_fin:
          pose.debut === null
            ? null
            : instantAMinutes(jour, pose.debut + pose.duree, reperes.fuseau),
        duree_estimee_min: pose.duree,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

/**
 * Retire une intervention posée par `poserInterventionGlisser` — ses segments
 * d'abord (`ON DELETE RESTRICT`, D120), comme `ecrireLaScene`.
 */
export async function retirerInterventionGlisser(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}
