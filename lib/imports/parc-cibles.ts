import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { type ParcConnu } from "@/lib/excel/controle";
import { avecContexteApplicatif } from "@/lib/db/client";

import { cleDeRapprochement } from "@/lib/excel/rapprochement";

import {
  cleDeLaFamille,
  cleDeLaPrestation,
  cleDuModele,
  cleDuSite,
} from "./modeles";
import { indexerLeParcClients } from "./parc-clients";

/**
 * LE PARC DE LA CIBLE — ce que la base connaît DÉJÀ (R6-01 ; RG-IMP-05).
 *
 * ## Ce que ce module répare, et ce qu'il n'est pas
 *
 * `controlerFeuille` reçoit un `ParcConnu` : *une clé qui s'y trouve est une
 * MODIFICATION, une clé absente est une CRÉATION.* Jusqu'ici un seul index
 * existait — celui des clients —, et il servait aussi de PARC pour les sites,
 * les modèles et les prestations. **C'est une confusion de rôles, et elle a un
 * coût mesurable** : la clé d'un site est `SITE-…`, que l'index des clients ne
 * contient jamais, si bien que *toute ligne de site serait une création — y
 * compris pour un site déjà en base.* Un second import du même fichier en
 * ferait autant de doublons, ce que RG-IMP-05 interdit.
 *
 * **Le parent et la cible ne sont pas la même question.** `parc-clients.ts`,
 * `parc-agences.ts` et `parc-familles.ts` répondent à *« que désigne cette
 * cellule ? »* ; ce module répond à *« cette fiche existe-t-elle déjà ? »*.
 * L'index des clients était le seul à répondre aux deux, parce qu'un
 * client n'a pas de parent — et c'est ce qui avait rendu la confusion
 * invisible.
 *
 * > **R6-03 PÉRIME CE « SEUL », et non le découpage.** Un équipement désigne
 * > trois parents — client, site, modèle (D6) —, si bien que `indexerLeParcSites`
 * > et `indexerLeParcModeles` répondent désormais aux deux questions eux aussi.
 * > *Ce qui rendait le client unique n'était pas qu'il réponde aux deux, c'est
 * > que rien ne le désignait.* Écrire un second module d'index pour les mêmes
 * > tables serait la seconde implémentation d'une clé — **rien ne se
 * > rapprocherait plus, et tout redeviendrait création**, exactement le défaut
 * > que ce fichier existe pour fermer.
 *
 * ## LES CLÉS NE SONT PAS RECALCULÉES ICI
 *
 * Chaque index appelle `cleDuSite`, `cleDuModele`, `cleDeLaPrestation` — **les
 * fonctions mêmes que les gabarits appellent** (`lib/imports/modeles.ts`).
 * *Une variante ferait que RIEN ne se rapproche, et tout deviendrait création*
 * — le défaut exact que L1-08f a mesuré sur les clients, et que la parade du §9
 * (01/09) ferme : on remplace la seconde implémentation par un appel à la
 * première.
 *
 * ## L'AMBIGUÏTÉ EST POSSIBLE SUR LES SITES, ET C'EST MESURÉ
 *
 * *Ce qui rend une clé utilisable n'est pas sa forme, c'est ce que la base
 * garantit d'elle* (D101). **Les trois ne sont donc pas logées à la même
 * enseigne**, et la première rédaction de ce module affirmait le contraire —
 * elle prêtait à `site` un `@@unique([societe_id, client_id, libelle])`
 * qu'aucune migration n'a jamais posé. *Un scénario d'`upsert` l'a démentie en
 * une exécution ; la relecture ne l'avait pas vue* (§9, 08/09).
 *
 * *Mesuré le 16/09/2026, `pg_indexes` sous `UNIQUE` :*
 *
 * | Table | Index unique métier | Deux fiches peuvent-elles rendre la même clé ? |
 * |---|---|---|
 * | `modele_materiel` | `(societe_id, marque, reference)` | non |
 * | `prestation` | `(societe_id, code)` | non |
 * | `site` | **aucun** — seulement `(societe_id, client_id, id)` | **OUI** |
 *
 * **Et même sur les deux premières, la NORMALISATION n'est pas garantie par la
 * base** : `normaliserRaisonSociale` rabat la casse et les espaces, si bien que
 * deux références que la base accepte comme distinctes — « KPX-337 » et
 * « kpx 337 » — rendent la MÊME clé.
 *
 * *L'ambiguïté est donc DÉTECTÉE plutôt que supposée impossible* : une clé
 * rendue deux fois entre dans `ambigues`, elle est RETIRÉE de `fiches`, et la
 * ligne qui la porte est rejetée — RG-IMP-05, et le raisonnement de
 * `parc-clients.ts` repris tel quel. *Laisser l'une des deux fiches ferait
 * écraser celle-là plutôt que l'autre : un choix au hasard rendu stable par
 * l'ordre de lecture.*
 *
 * ## AUCUN FILTRE SUR `actif`
 *
 * Une fiche désactivée occupe toujours sa clé. *L'ignorer ferait qu'un import
 * la recrée* — un refus d'unicité en base à la place d'un rapprochement, c'est
 * à dire une panne technique là où il fallait une modification (le raisonnement
 * de `parc-clients.ts`, repris tel quel).
 */

/** Range des clés en distinguant celles qu'au moins deux fiches se partagent. */
function indexer(
  entrees: readonly (readonly [string, string])[],
): ParcConnu & { readonly fiches: ReadonlyMap<string, string> } {
  const fiches = new Map<string, string>();
  const ambigues = new Set<string>();
  for (const [cle, id] of entrees) {
    if (fiches.has(cle)) {
      // *L'ambiguïté est un fait du parc, jamais du fichier* : la clé est
      // RETIRÉE de l'index et reste dans `cles`. Laisser l'une des deux fiches
      // ferait écraser celle-là plutôt que l'autre — un choix au hasard rendu
      // stable par l'ordre de lecture (L1-08g).
      fiches.delete(cle);
      ambigues.add(cle);
      continue;
    }
    if (!ambigues.has(cle)) fiches.set(cle, id);
  }
  return {
    cles: new Set([...fiches.keys(), ...ambigues]),
    ambigues,
    fiches,
  };
}

export type ParcCible = ParcConnu & {
  /** La fiche que chaque clé NON AMBIGUË désigne. */
  readonly fiches: ReadonlyMap<string, string>;
};

/** Les sites de la société active, indexés par la clé du gabarit « sites ». */
export async function indexerLeParcSites(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcCible> {
  const sites = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.site.findMany({
        select: { id: true, client_id: true, libelle: true },
      }),
    client,
  );
  return indexer(
    sites.map((site) => [cleDuSite(site.client_id, site.libelle), site.id]),
  );
}

/** Les modèles de la société active, indexés par la clé du gabarit « modeles ». */
export async function indexerLeParcModeles(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcCible> {
  const modeles = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.modeleMateriel.findMany({
        select: { id: true, marque: true, reference: true },
      }),
    client,
  );
  return indexer(
    modeles.map((m) => [cleDuModele(m.marque, m.reference), m.id]),
  );
}

/** Les prestations de la société active, indexées par la clé de leur gabarit. */
export async function indexerLeParcPrestations(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcCible> {
  const prestations = await avecContexteApplicatif(
    contexte,
    (tx) => tx.prestation.findMany({ select: { id: true, code: true } }),
    client,
  );
  return indexer(prestations.map((p) => [cleDeLaPrestation(p.code), p.id]));
}

/**
 * LES FAMILLES de la société active, indexées par la clé de leur gabarit (R6-03).
 *
 * **Ce n'est PAS `parc-familles.ts`, et les deux coexistent** : celui-là indexe
 * par le CODE BRUT en majuscules, pour répondre à *« que désigne la cellule
 * “Famille” d'un modèle ? »* ; celui-ci indexe par `cleDeLaFamille`, pour
 * répondre à *« cette famille existe-t-elle déjà ? »*. Les fondre ferait
 * qu'aucune des deux questions ne serait bien posée — et la normalisation n'est
 * pas la même : `normaliserRaisonSociale` rabat les accents et la ponctuation,
 * `toUpperCase()` non.
 *
 * *L'ambiguïté est donc POSSIBLE ici et impossible là-bas* : la base garantit
 * `(societe_id, code)`, mais « PONT-ELEV » et « pont elev » rendent la même clé
 * normalisée. Elle est détectée, comme partout, plutôt que supposée impossible.
 */
export async function indexerLeParcFamilles(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcCible> {
  const familles = await avecContexteApplicatif(
    contexte,
    (tx) => tx.familleMateriel.findMany({ select: { id: true, code: true } }),
    client,
  );
  return indexer(familles.map((f) => [cleDeLaFamille(f.code), f.id]));
}

/**
 * LES ÉQUIPEMENTS de la société active, par la clé de rapprochement (R6-03).
 *
 * ## L'AMBIGUÏTÉ EST POSSIBLE ICI, ET ELLE EST MESURÉE PLUTÔT QUE SUPPOSÉE
 *
 * *Mesuré le 16/09/2026 au schéma :* `machine` porte
 * `@@unique([societe_id, modele_id, numero_serie])` — **la série seule n'est
 * PAS unique**, deux machines de modèles différents peuvent la partager. Or la
 * clé du gabarit est la série NUE (L2-01, L1-08f), et elle ne peut pas porter le
 * modèle : *un fichier de reprise donne un numéro de série, pas un identifiant
 * de modèle.* Deux fiches peuvent donc rendre la même clé, et la ligne qui la
 * porte est rejetée pour arbitrage humain — RG-IMP-05, sans une ligne de plus.
 *
 * **La référence interne, elle, est unique par société** — index PARTIEL
 * `machine_societe_reference_interne_key` (D6) —, si bien que les clés
 * `SN-INCONNU-…` ne peuvent pas entrer en collision entre elles. *Les deux
 * espaces ne se comportent pas pareil, et c'est ce que la base garantit qui le
 * décide, jamais la forme de la clé* (D101).
 *
 * `reference_interne` est passée **telle quelle** : `cleDeRapprochement` compose
 * `SN-INCONNU-<référence>` lui-même, et la recomposer ici ferait deux lectures
 * d'un même critère.
 */
export async function indexerLeParcEquipements(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcCible> {
  const machines = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.machine.findMany({
        select: { id: true, numero_serie: true, reference_interne: true },
      }),
    client,
  );
  return indexer(
    machines.map((m) => [
      cleDeRapprochement({
        numeroSerie: m.numero_serie,
        reference: m.reference_interne ?? undefined,
        // **Le rang est SANS OBJET, et il ne peut pas être atteint** : une
        // fiche en base porte toujours un numéro de série (`NOT NULL`, D6), si
        // bien que la forme de dernier recours ne se produit jamais ici. *Lui
        // donner une valeur qui aurait un sens ferait croire qu'elle en a un.*
        rang: 0,
      }).cle,
      m.id,
    ]),
  );
}

/**
 * LES TYPES QUI ONT UN INDEX DE CIBLE, ET CEUX QUI N'EN ONT PAS (R6-01).
 *
 * **Une seule maison, et elle est GARDÉE** : `tests/unit/imports/types-dimport.test.ts`
 * exige que tout type qu'on sait APPLIQUER ait un index ici. *Un type qu'on
 * applique sans index de cible ne produit aucune erreur — il produit des
 * DOUBLONS*, une fiche neuve à chaque import, et personne ne le verrait avant
 * le second passage du même fichier.
 *
 * **`contacts` n'en a pas, et c'est écrit plutôt que tu.** `modeleContacts`
 * calcule une clé `CONTACT-…` qu'aucun index ne porte : toute ligne de contact
 * ressort donc en CRÉATION. *C'est sans conséquence tant qu'aucun lot de
 * contacts ne s'applique* (`SANS_APPLICATION`), et le gardien ci-dessus est ce
 * qui empêchera L1-03b d'ouvrir le dépôt sans ouvrir l'index.
 */
export const INDEX_DE_CIBLE: Readonly<
  Record<string, (c: ContexteSession, p?: PrismaClient) => Promise<ParcCible>>
> = {
  clients: indexerLeParcClients,
  sites: indexerLeParcSites,
  modeles: indexerLeParcModeles,
  prestations: indexerLeParcPrestations,
  familles: indexerLeParcFamilles,
  equipements: indexerLeParcEquipements,
};

/**
 * Le parc de la CIBLE pour un type donné, ou `null` si ce type n'en a pas.
 *
 * *`null` n'est pas une panne* : le contrôle a toujours besoin d'un parc, et
 * l'appelant passe alors un parc VIDE — toute ligne devient une création, ce
 * qui est exact pour un type dont aucune fiche n'existe encore par ce chemin.
 */
export async function indexerLeParcCible(
  contexte: ContexteSession,
  type: string,
  client?: PrismaClient,
): Promise<ParcCible | null> {
  const index = INDEX_DE_CIBLE[type];
  return index === undefined ? null : index(contexte, client);
}

/** Un parc vide — pour un type sans index de cible. */
export const PARC_VIDE: ParcCible = {
  cles: new Set(),
  ambigues: new Set(),
  fiches: new Map(),
};
