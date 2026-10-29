import { type ContexteActif } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { type Fuseau } from "@/lib/calendar/fuseau";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { fuseauDuTechnicien } from "@/lib/calendar/technicien";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  peutDemarrerLeCompteur,
  peutTerminer,
  type Verdict,
} from "@/lib/interventions/cycle-de-vie";
import {
  interventionsEnRetard,
  lireFicheIntervention,
  listerPlanning,
  type LigneFileATraiter,
} from "@/lib/interventions/depot";
import { mesureDeLIntervention } from "@/lib/interventions/depot-compteur";
import {
  derniereSignature,
  lireRapportTexte,
  piecesRemplacees,
  prestationsRealisees,
} from "@/lib/interventions/depot-rapport-terrain";
import { repartirJourneeTechnicien } from "@/lib/interventions/journee-technicien";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { photosDeLIntervention } from "@/lib/documents/depot";
import { donneesMaterielDesMachines } from "@/lib/machines/depot";
import { libelleMaterielComplet } from "@/lib/machines/presentation";
import {
  catalogueActifPourTerrain,
  type PrestationCatalogueTerrain,
} from "@/lib/prestations/depot";

/**
 * `GET /api/terrain/instantane` — LA COPIE QUE LE TÉLÉPHONE EMPORTE (point 2,
 * 9F4H1-HORS-RESEAU-CONSULTATION, décisions n° 105 et 106 d'Alexis, 14/10/2026).
 *
 * ## CE QUE CETTE ROUTE FAIT, ET CE QU'ELLE NE FAIT PAS
 *
 * Elle rend, en JSON, EXACTEMENT ce que `/terrain` et `/terrain/[id]`
 * calculent déjà — en appelant les MÊMES fonctions de dépôt, jamais une
 * seconde requête écrite à la main (§9, 01/09). Ni montant (la matrice du
 * §5.2 ne donne au technicien aucun `voir_montants_vente`), ni octets de
 * photo (seulement leur libellé, « métadonnée déjà affichée » à l'écran) —
 * c'est le composant client de consultation hors réseau qui compose
 * l'affichage, sous `components/terrain/presentation.ts`, jamais une seconde
 * forme.
 *
 * **Elle n'appelle jamais `marquerVuParTechnicien`** : une copie n'est pas une
 * lecture, et poser l'instant de première ouverture depuis une route que le
 * téléphone sollicite en arrière-plan ferait disparaître le badge « nouveau »
 * avant que la personne n'ait rien vu.
 *
 * ## LA MÊME PORTE QUE LES VOISINES DU TERRAIN
 *
 * `consulter_planning` (restreint pour TEC, §5.2) prouve le DROIT ; le
 * périmètre RESTREINT, relu après, prouve que ce compte est un compte de
 * terrain — un rôle à accès complet n'a pas de copie personnelle à emporter
 * (voir le docblock de `app/api/terrain/[id]/compteur/route.ts`, même forme).
 */

export const dynamic = "force-dynamic";

export type LigneJSON = {
  readonly id: string;
  readonly statut: string;
  readonly type: string;
  readonly priorite: string;
  readonly client: string;
  readonly site: string;
  readonly creneauDebut: string | null;
  readonly creneauFin: string | null;
  readonly datePlanifiee: string | null;
  readonly panne: string | null;
  readonly vueTechnicienLe: string | null;
  readonly machinesLibelles: readonly string[];
};

export type FicheJSON = {
  readonly id: string;
  readonly statut: string;
  readonly type: string;
  readonly priorite: string;
  readonly client: string | null;
  readonly lieu: string | null;
  readonly creneauDebut: string | null;
  readonly creneauFin: string | null;
  readonly datePlanifiee: string | null;
  readonly fuseau: Fuseau;
  readonly panne: string | null;
  readonly machinesLibelles: readonly string[];
  readonly contact: {
    readonly nom: string;
    readonly numeros: readonly string[];
  } | null;
  readonly rapport: {
    readonly commentaireTechnicien: string | null;
    readonly suiteADonner: string | null;
    /** LES PIÈCES REMPLACÉES (9I7B) — mêmes régime que `prestationsRealisees` ci-dessous : voyagent dans la même enveloppe que le rapport. */
    readonly piecesRemplacees: readonly {
      readonly designation: string;
      readonly reference: string | null;
      readonly quantite: number;
    }[];
  };
  readonly prestationsRealisees: readonly string[];
  /** Les `id` des mêmes prestations, DANS LE MÊME ORDRE (9F4H6, point 3) —
   * `prestationsRealisees` ne porte que des LIBELLÉS (affichage en ligne,
   * jamais coché) ; la coquille a besoin de l'`id` pour précocher ce qui est
   * déjà fait sans écraser la saisie servie au prochain « Terminer » (le
   * dépôt remplace l'ENSEMBLE entier, voir son en-tête). */
  readonly prestationsRealiseesIds: readonly string[];
  readonly photos: readonly string[];
  readonly signatureIssue: string | null;
  readonly verdictTerminer: Verdict;
  readonly verdictDemarrer: Verdict;
};

/**
 * LA FORME COMPLÈTE DU CORPS — exportée pour que le composant de
 * consultation sans réseau (`components/terrain/consultation-hors-reseau.tsx`)
 * la lise par un `import type`, erasé à la compilation : aucun code serveur
 * ne rejoint le paquet client, seulement la FORME des données.
 */
export type InstantaneJSON = {
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly genereLe: string;
  readonly journee: {
    readonly fuseau: Fuseau;
    readonly jour: {
      readonly jour: number;
      readonly mois: number;
      readonly annee: number;
    };
    readonly enRetard: readonly LigneJSON[];
    readonly aujourdhui: readonly LigneJSON[];
    readonly demain: readonly LigneJSON[];
    readonly sansDate: readonly LigneJSON[];
    readonly suite: {
      readonly nombre: number;
      readonly dates: readonly {
        readonly jour: number;
        readonly mois: number;
        readonly annee: number;
      }[];
    };
  };
  readonly fiches: Readonly<Record<string, FicheJSON>>;
  /** LE CATALOGUE DES PRESTATIONS ACTIVES, SOCIÉTÉ ENTIÈRE (9F4H6, point 3)
   * — une seule fois, jamais répété par fiche : les fiches d'une même
   * société partagent le même catalogue. */
  readonly catalogue: readonly PrestationCatalogueTerrain[];
};

async function contexteDuTerrain(): Promise<ContexteActif | null> {
  const contexte = await exigerCapacite("consulter_planning");
  if (contexte === null) {
    return null;
  }
  return perimetreDuPlanning(contexte).acces === "restreint" ? contexte : null;
}

async function libellesDesMachines(
  contexte: ContexteActif,
  machineIds: readonly string[],
): Promise<readonly string[]> {
  const donnees = await donneesMaterielDesMachines(contexte, machineIds);
  return machineIds
    .map((id) => donnees.get(id))
    .filter((d): d is NonNullable<typeof d> => d !== null && d !== undefined)
    .map(libelleMaterielComplet);
}

function ligneEnJSON(
  ligne: LigneFileATraiter,
  machinesLibelles: ReadonlyMap<string, readonly string[]>,
): LigneJSON {
  return {
    id: ligne.id,
    statut: ligne.statut,
    type: ligne.type,
    priorite: ligne.priorite,
    client: ligne.client.raison_sociale,
    site: ligne.site.libelle,
    creneauDebut: ligne.creneau_debut?.toISOString() ?? null,
    creneauFin: ligne.creneau_fin?.toISOString() ?? null,
    datePlanifiee: ligne.date_planifiee?.toISOString() ?? null,
    panne: ligne.description,
    vueTechnicienLe: ligne.vue_technicien_le?.toISOString() ?? null,
    machinesLibelles: machinesLibelles.get(ligne.id) ?? [],
  };
}

async function ficheEnJSON(
  contexte: ContexteActif,
  id: string,
): Promise<FicheJSON | null> {
  const fiche = await lireFicheIntervention(contexte, id);
  if (fiche === null) {
    return null;
  }
  const ligne = fiche.ligne;
  const [
    mesure,
    rapportTexte,
    prestationsFaites,
    photos,
    signature,
    machinesLibelles,
    pieces,
  ] = await Promise.all([
    mesureDeLIntervention(contexte, id),
    lireRapportTexte(contexte, id),
    prestationsRealisees(contexte, id),
    photosDeLIntervention(contexte, id),
    derniereSignature(contexte, id),
    libellesDesMachines(
      contexte,
      ligne.machines.map((m) => m.machine_id),
    ),
    piecesRemplacees(contexte, id),
  ]);
  const statut = ligne.statut;
  return {
    id: ligne.id,
    statut,
    type: ligne.type,
    priorite: ligne.priorite,
    client: fiche.client,
    lieu: fiche.lieu,
    creneauDebut: ligne.creneau_debut?.toISOString() ?? null,
    creneauFin: ligne.creneau_fin?.toISOString() ?? null,
    datePlanifiee: ligne.date_planifiee?.toISOString() ?? null,
    fuseau: fiche.fuseau,
    panne: ligne.description,
    machinesLibelles,
    contact:
      fiche.contact === null
        ? null
        : {
            nom: fiche.contact,
            numeros: [
              ...new Set(
                [fiche.contactTelephone, fiche.contactMobile].filter(
                  (v): v is string => v !== null,
                ),
              ),
            ],
          },
    rapport: {
      commentaireTechnicien: rapportTexte?.commentaire_technicien ?? null,
      suiteADonner: rapportTexte?.suite_a_donner ?? null,
      piecesRemplacees: (pieces ?? []).map((p) => ({
        designation: p.designation,
        reference: p.reference,
        quantite: p.quantite,
      })),
    },
    prestationsRealisees: (prestationsFaites ?? []).map((p) => p.libelle),
    prestationsRealiseesIds: (prestationsFaites ?? []).map(
      (p) => p.prestation_id,
    ),
    photos: (photos ?? []).map((p) => p.libelle),
    signatureIssue: signature?.issue ?? null,
    verdictTerminer: peutTerminer(
      statut,
      mesure.minutes,
      signature?.issue ?? null,
    ),
    verdictDemarrer: peutDemarrerLeCompteur(statut),
  };
}

export async function GET(): Promise<Response> {
  return dansUnEchangeAuth(traiter);
}

async function traiter(): Promise<Response> {
  const contexte = await contexteDuTerrain();
  if (contexte === null) {
    return Response.json({ erreur: "acces_refuse" }, { status: 403 });
  }

  const fuseau = await avecContexteApplicatif(contexte, (tx) =>
    fuseauDuTechnicien(tx, {
      societeId: contexte.societeId,
      utilisateurId: contexte.utilisateurId,
    }),
  );
  const instant = maintenant(fuseau);
  const aujourdHui = jourDe(instant.local);

  const [lignes, retardBrut, catalogue] = await Promise.all([
    listerPlanning(
      contexte,
      instantDuJour(aujourdHui),
      instantDuJour(jourSuivant(aujourdHui, 8)),
      undefined,
      { inclurePlanifiees: false, inclureAnnulees: false },
    ),
    interventionsEnRetard(contexte, instantDuJour(aujourdHui)),
    catalogueActifPourTerrain(contexte),
  ]);
  const retard = retardBrut.filter((l) => l.statut === "affectee");

  const journee = repartirJourneeTechnicien(lignes, retard, aujourdHui);
  const lignesAffichees = [
    ...journee.enRetard,
    ...journee.aujourdHui,
    ...journee.demain,
    ...journee.sansDate,
  ];

  const machinesLibelles = new Map(
    await Promise.all(
      lignesAffichees.map(
        async (l) =>
          [
            l.id,
            await libellesDesMachines(
              contexte,
              l.machines.map((m) => m.machine_id),
            ),
          ] as const,
      ),
    ),
  );

  const fiches = new Map(
    (
      await Promise.all(
        lignesAffichees.map(async (l) => {
          const fiche = await ficheEnJSON(contexte, l.id);
          return fiche === null ? null : ([l.id, fiche] as const);
        }),
      )
    ).filter((e): e is readonly [string, FicheJSON] => e !== null),
  );

  return Response.json(
    {
      utilisateurId: contexte.utilisateurId,
      societeId: contexte.societeId,
      genereLe: instant.instant.toISOString(),
      journee: {
        fuseau,
        jour: aujourdHui,
        enRetard: journee.enRetard.map((l) => ligneEnJSON(l, machinesLibelles)),
        aujourdhui: journee.aujourdHui.map((l) =>
          ligneEnJSON(l, machinesLibelles),
        ),
        demain: journee.demain.map((l) => ligneEnJSON(l, machinesLibelles)),
        sansDate: journee.sansDate.map((l) => ligneEnJSON(l, machinesLibelles)),
        suite: journee.suite,
      },
      fiches: Object.fromEntries(fiches),
      catalogue,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
