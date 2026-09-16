import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { creerClientDans, modifierClientDans } from "@/lib/clients/depot";
import {
  schemaCreationClient,
  schemaModificationClient,
} from "@/lib/clients/saisie";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";

import { creerSiteDans, modifierSiteDans } from "@/lib/sites/depot";
import { schemaCreationSite, schemaModificationSite } from "@/lib/sites/saisie";
import {
  creerFamilleDans,
  creerModeleDans,
  modifierFamilleDans,
  modifierModeleDans,
} from "@/lib/materiel/depot";
import {
  schemaFamilleMateriel,
  schemaModeleMateriel,
} from "@/lib/materiel/saisie";
import { creerMachineDans, modifierMachineDans } from "@/lib/machines/depot";
import { schemaMachine } from "@/lib/machines/saisie";
import {
  creerPrestationDans,
  modifierPrestationDans,
} from "@/lib/prestations/depot";
import { schemaPrestation } from "@/lib/prestations/saisie";
import { uuidv7 } from "@/lib/db/uuid";

import { CHAMPS_ECRITS_CLIENTS, CHAMPS_SITES_MODIFIES } from "./annulation";
import { porteEncore } from "./comparaison";
import { DELAIS_APPLICATION } from "./delais";
import {
  CHAMPS_CLIENTS,
  preparerUnEquipement,
  preparerUnModele,
  preparerUnePrestation,
  preparerUneFamille,
  preparerUnSite,
  saisieDepuisLaLigne,
} from "./modeles";
import { indexerLesAgences } from "./parc-agences";
import { indexerLesFamilles } from "./parc-familles";
import { indexerLeParcClients } from "./parc-clients";
import {
  indexerLeParcEquipements,
  indexerLeParcFamilles,
  indexerLeParcModeles,
  indexerLeParcPrestations,
  indexerLeParcSites,
} from "./parc-cibles";

/**
 * L'APPLICATION D'UN LOT D'IMPORT (L1-08i ; I6, RG-IMP-01, RG-IMP-04, D15).
 *
 * ## Elle n'applique QUE ce que le rapport a montré
 *
 * C'est la seconde moitié de I6, et la première est en base depuis L1-08e : le
 * lot existe dès le contrôle, avec ses lignes et leur action. **L'application
 * ne redécide rien** — elle lit `import_lot_ligne.action` et l'exécute. *Si
 * elle recalculait, la validation humaine aurait porté sur un écran et
 * l'écriture sur autre chose*, ce qui est exactement ce que I6 interdit.
 *
 * ## Une seule transaction, et ce n'est pas un détail
 *
 * Tout le lot s'écrit dans la transaction que `avecContexteApplicatif` ouvre.
 * *Une écriture par ligne laisserait, au premier incident, un lot « contrôlé »
 * dont la moitié des fiches existe — un état que rien ne décrit et que
 * l'annulation ne saurait pas défaire.*
 *
 * ## Le CLIQUET : un lot ne s'applique qu'une fois
 *
 * Il est tenu par une lecture ET par la base : `applique_le` est lié au statut
 * par une équivalence (L1-08e), si bien qu'un second passage ne peut pas
 * réécrire un lot déjà appliqué sans que la contrainte le dise.
 */

/** Ce que l'application refuse, et pourquoi. */
export type RefusApplication =
  | "lot_introuvable"
  | "lot_deja_applique"
  | "lot_annule"
  // AJOUTÉ le 16/09/2026 (point 4 de la session : une violation de contrainte
  // d'unicité ressortait en page d'erreur 500). Voir le `catch` d'
  // `appliquerLesLignes` plus bas : c'est le FILET, jamais la première ligne
  // de défense — celle-ci
  // est le contrôle, qui rejette désormais un doublon AVANT l'application
  // (`MOTIF_DOUBLON_FICHIER`, `lib/excel/controle.ts`). Ce motif couvre ce que
  // le contrôle ne pouvait pas voir : le parc a bougé ENTRE le contrôle et la
  // validation — un autre lot, appliqué entre-temps, a écrit la même clé.
  | "contrainte_violee"
  // AJOUTÉ le 16/09/2026 (session dépassement de délai) : un lot de 615
  // MODIFICATIONS a mesuré `POST /api/imports/{id}/appliquer` sans réponse
  // après quatre minutes, le lot restant `controle`. **Même geste que
  // `contrainte_violee` pour la même raison** : la transaction s'est défaite
  // — voir `DELAIS_APPLICATION` dans `lib/imports/delais.ts` —, rien n'est
  // écrit, et ce n'est pas une panne que le produit ignore : c'est un
  // dépassement NOMMÉ, exactement comme #206 l'a fait pour P2002.
  | "delai_depasse";

export type ResultatApplication =
  | { readonly applique: false; readonly motif: RefusApplication }
  | {
      readonly applique: true;
      readonly creations: number;
      readonly modifications: number;
      /**
       * AJOUTÉ le 16/09/2026 (point 1 de la session) : les lignes classées
       * MODIFICATION dont la comparaison a montré qu'elles ne changeaient
       * rien — voir `porteEncore` et son appel juste avant chaque écriture.
       * *Une modification qui ne modifie rien n'est pas une modification*,
       * et ce décompte est ce qui empêche `modifications` de mentir.
       */
      readonly inchangees: number;
    };

/** Le motif de refus, lu dans l'état du lot. */
function refusDuStatut(statut: string): RefusApplication | null {
  if (statut === "applique") return "lot_deja_applique";
  if (statut === "annule") return "lot_annule";
  return null;
}

/**
 * UNE LIGNE QUE L'APPLICATION VA ÉCRIRE — telle que le rapport l'a posée.
 */
type LigneAAppliquer = {
  readonly id: string;
  readonly rang: number;
  readonly action: "creation" | "modification";
  readonly cle: string | null;
  readonly valeurs: Record<string, string | undefined>;
};

/**
 * Ce qu'une ligne a produit :
 *   - `"creation"` / `"modification"` — une fiche a été écrite ;
 *   - `"inchangee"` — la ligne est une MODIFICATION dont la comparaison a
 *     montré que la fiche porte déjà exactement ces valeurs (point 1 de la
 *     session du 16/09/2026) : rien n'est écrit, et le compte le dit ;
 *   - `null` — rien ne désigne plus rien (fiche disparue, parent introuvable,
 *     politique qui refuse en silence).
 */
type Ecriture = "creation" | "modification" | "inchangee" | null;

/**
 * L'ENVELOPPE QUE LES QUATRE APPLICATIONS PARTAGENT (R6-01).
 *
 * ## Ce qu'elle porte, et ce qu'elle NE porte PAS
 *
 * Elle porte le **cliquet** (un lot ne s'applique qu'une fois), la **lecture du
 * lot**, la **transaction unique** et la **clôture**. *Elle ne porte aucune
 * décision : elle ne sait ni quelle entité est visée, ni quel schéma juge, ni
 * quel dépôt écrit.* Chaque ligne est confiée à l'`ecrire` que l'appelant
 * fournit, et c'est l'appelant qui nomme son type.
 *
 * ## Pourquoi ce n'est PAS la fonction que L1-08i refusait
 *
 * L1-08i écrivait : *« une fonction “applique n'importe quel lot” devrait tenir
 * une table de correspondance entre un type d'import et une écriture,
 * c'est-à-dire une liste close de plus, tenue à la main, que le prochain type
 * oublierait. »* **L'objection portait sur la TABLE, pas sur la boucle**, et la
 * distinction se vérifie : cette enveloppe ne lit jamais `lot.type_import` et
 * ne choisit jamais d'écriture. *Elle reçoit celle qu'on lui donne.*
 *
 * La table, elle, existe bel et bien — il en faut une dès qu'une route doit
 * choisir — et elle est **fermée par un gardien contre les sources de
 * `lib/imports/`** plutôt que tenue à la main : `lib/imports/types-dimport.ts`,
 * confronté par `tests/unit/imports/types-dimport.test.ts`. *Le jour où une
 * application de plus sera écrite et non déclarée, `pnpm verify` rougira le
 * jour même.* C'est la réponse que L1-08i attendait d'avoir cinq exemplaires
 * sous les yeux pour donner — **et elle a tenu sans une ligne de plus quand
 * R6-03 en a ajouté deux.**
 *
 * ## Le parc peut AVOIR BOUGÉ, et ce n'est pas une erreur du fichier
 *
 * `ecrire` rend `null` quand la ligne ne désigne plus rien — une fiche
 * supprimée entre le contrôle et la validation, un parent disparu. *La ligne
 * est laissée en l'état et le lot continue* : l'annulation partielle de I6 est
 * faite du même bois, et l'écart se lit dans les décomptes rendus, qui sont
 * ceux de ce qui a été ÉCRIT et non ceux du rapport.
 *
 * ## LA TRANSACTIONNALITÉ, VÉRIFIÉE PLUTÔT QU'AFFIRMÉE (point 4 du 16/09/2026)
 *
 * *Question posée en production après une page d'erreur 500 sur une violation
 * de contrainte : rien n'avait-il été écrit ?* La réponse est OUI, et elle
 * tient à une seule ligne, déjà vraie avant cet incident : `avecContexteRls`
 * (`lib/db/rls.ts`) ouvre `travail` dans `prisma.$transaction(async (tx) =>
 * …)` — une transaction INTERACTIVE, que Prisma annule intégralement dès
 * qu'une requête à l'intérieur lève. Une violation de contrainte survenue au
 * milieu du `for` ci-dessous défait donc TOUT ce que la boucle avait déjà
 * écrit, y compris pour les lignes précédentes de la MÊME boucle — le lot
 * reste `controle`, comme si l'application n'avait jamais commencé.
 * `tests/isolation/application-import-types.test.ts` le mesure contre la
 * vraie base, colonne par colonne, plutôt que de le supposer du code.
 *
 * **Ce que cette garantie NE fait PAS, et c'est pour cela qu'un filet suit** :
 * une transaction qui se défait bien laisse quand même l'ERREUR remonter telle
 * quelle à l'appelant. C'est cette remontée non rattrapée, et elle seule, qui
 * faisait le 500 — la donnée n'a jamais été le problème.
 */
async function appliquerLesLignes(
  contexte: ContexteSession,
  lotId: string,
  client: PrismaClient | undefined,
  ecrire: (
    tx: Prisma.TransactionClient,
    societeId: string,
    ligne: LigneAAppliquer,
  ) => Promise<Ecriture>,
): Promise<ResultatApplication> {
  const societeId = exigerSocieteActive(contexte);

  try {
    return await avecContexteApplicatif(
      contexte,
      async (tx) => {
        const lot = await tx.importLot.findUnique({
          where: { id: lotId },
          select: {
            statut: true,
            lignes: {
              where: { action: { in: ["creation", "modification"] } },
              select: {
                id: true,
                rang: true,
                action: true,
                cle: true,
                valeurs: true,
              },
              orderBy: { rang: "asc" },
            },
          },
        });

        // `null` couvre deux cas que rien ne distingue ici, et c'est voulu : le
        // lot n'existe pas, ou il appartient à une autre société et la politique
        // le cache. *Les distinguer ferait un oracle* (D35, D50).
        if (lot === null) {
          return {
            applique: false as const,
            motif: "lot_introuvable" as const,
          };
        }
        const refus = refusDuStatut(lot.statut);
        if (refus !== null) {
          return { applique: false as const, motif: refus };
        }

        let creations = 0;
        let modifications = 0;
        let inchangees = 0;

        for (const brute of lot.lignes) {
          const ecriture = await ecrire(tx, societeId, {
            id: brute.id,
            rang: brute.rang,
            action: brute.action as "creation" | "modification",
            cle: brute.cle,
            valeurs: brute.valeurs as Record<string, string | undefined>,
          });
          if (ecriture === "creation") creations += 1;
          if (ecriture === "modification") modifications += 1;
          if (ecriture === "inchangee") inchangees += 1;
        }

        await tx.importLot.update({
          where: { id: lotId },
          data: {
            statut: "applique",
            applique_le: await instantDate(tx),
            // **SEUL `lignes_inchangees` EST ÉCRIT ICI**, jamais
            // `lignes_modifications` ni `lignes_creations` : ceux-là restent
            // « tels que le rapport les a rendus » (le commentaire du schéma,
            // mot pour mot), la PROPOSITION du contrôle. `lignes_inchangees`
            // n'a pas de proposition à trahir : il vaut zéro tant que rien ne
            // l'a mesuré, et c'est l'application, seule, qui le mesure.
            lignes_inchangees: inchangees,
          },
        });

        // **Aucun décompte des lignes IGNORÉES n'est rendu**, et c'est délibéré :
        // la requête ne les rapporte pas, ce chiffre vaudrait donc zéro en toute
        // circonstance. *Une ligne qui ne peut pas bouger sous une faute n'est
        // jamais présentée à côté de celles qui le peuvent* (§9, 06/09) — le lot
        // porte déjà ses décomptes, et c'est là qu'on les lit.
        return {
          applique: true as const,
          creations,
          modifications,
          inchangees,
        };
      },
      client,
      DELAIS_APPLICATION,
    );
  } catch (erreur) {
    // **LE FILET, jamais la première ligne de défense** (point 4, 16/09/2026 ;
    // étendu le même jour, point 3 de la session suivante). La transaction
    // s'est déjà défaite — voir le docblock ci-dessus — et rien n'a été
    // écrit ; ce bloc ne répare rien, il choisit seulement de ne pas laisser
    // une erreur technique remonter jusqu'à une page d'erreur 500. *Une
    // erreur que le produit sait nommer n'est pas une panne.*
    const motif = motifDeLErreurTransaction(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { applique: false as const, motif };
  }
}

/**
 * LE MOTIF D'UNE ERREUR DE TRANSACTION, LU SUR SON CODE PRISMA — jamais
 * levée, jamais devinée. Même forme que `motifDeLErreur` de
 * `lib/clients/depot.ts`, et pour la même raison : une fonction pure, séparée
 * de la transaction qu'elle interprète, s'éprouve sans base (`P2002`/`P2028`
 * fabriqués) plutôt que par un incident qu'il faudrait reproduire — un
 * dépassement RÉEL de `DELAIS_APPLICATION.timeout` prendrait vingt minutes à
 * mesurer.
 *
 * **Seuls P2002 et P2028 sont reconnus.** Une autre erreur Prisma dirait
 * autre chose qu'un doublon ou un dépassement de délai — une colonne trop
 * longue, une connexion perdue — et les nommer mentirait sur leur cause :
 * `null` la laisse remonter telle quelle, comme avant ce ticket.
 */
export function motifDeLErreurTransaction(
  erreur: unknown,
): RefusApplication | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (erreur.code === "P2002") {
    return "contrainte_violee";
  }
  // P2028 : « Transaction API error […] Transaction already closed » — le
  // moteur a fermé la transaction au bout de `DELAIS_APPLICATION.timeout`
  // (`lib/imports/delais.ts`) et la requête suivante ne la retrouve plus.
  // *Même code que `prisma/seed-delais.ts` a rencontré pour le même incident
  // de latence — ce n'est pas la première fois que ce dépôt le mesure.* La
  // transaction s'étant défaite, rien n'est écrit : le lot reste `controle`,
  // exactement comme sur `contrainte_violee`.
  if (erreur.code === "P2028") {
    return "delai_depasse";
  }
  return null;
}

/**
 * Applique un lot d'import de CLIENTS.
 *
 * **Le type est dans le nom**, et ce n'est pas une facilité : chaque entité a
 * ses schémas, ses défauts et son dépôt. *Une fonction « applique n'importe
 * quel lot » devrait tenir une table de correspondance entre un type d'import
 * et une écriture, c'est-à-dire une liste close de plus, tenue à la main, que
 * le prochain type oublierait.* Le jour où un second type existe, la question
 * se posera avec deux exemplaires sous les yeux plutôt qu'avec aucun.
 */
export async function appliquerLeLotDeClients(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const parc = await indexerLeParcClients(contexte, client);

  return appliquerLesLignes(
    contexte,
    lotId,
    client,
    async (tx, societeId, ligne) => {
      const saisie = saisieDepuisLaLigne(ligne.valeurs, CHAMPS_CLIENTS);

      if (ligne.action === "creation") {
        // Le schéma REJOUE ici, et il n'y a pas de seconde lecture : c'est le
        // MÊME schéma que le rapport a consulté (L1-08h). Ce qu'il apporte à ce
        // point est la CONVERSION — les défauts, les types —, pas le verdict,
        // que le rapport a déjà rendu.
        const fiche = await creerClientDans(
          tx,
          societeId,
          schemaCreationClient.parse(saisie),
        );
        await tracer(tx, ligne.id, "client", fiche.id, null);
        return "creation";
      }

      // MODIFICATION. La fiche visée est celle que la CLÉ désigne — jamais une
      // recherche par ressemblance, et jamais une clé ambiguë : le rapport les a
      // déjà rejetées (L1-08g).
      const cible = ligne.cle === null ? undefined : parc.fiches.get(ligne.cle);
      if (cible === undefined) return null;

      // `valeurs_avant` est CE QUE D15 EXIGE POUR RESTAURER, et elle se lit AVANT
      // d'écrire : après, il est trop tard, et le journal d'audit porterait la
      // seule trace — sur une table qu'aucune annulation ne lit. **C'est
      // aussi elle que `porteEncore` compare** (point 1, 16/09/2026) : les
      // deux questions — « que faut-il pouvoir restaurer ? » et « la fiche
      // porte-t-elle déjà cela ? » — portent sur les mêmes colonnes, une
      // seconde lecture divergerait en silence (§9, 01/09).
      const avant = await tx.client.findUnique({
        where: { id: cible },
        select: {
          code_externe: true,
          raison_sociale: true,
          ridet: true,
          categorie: true,
          conditions_reglement: true,
          commercial_referent: true,
        },
      });

      const modification = schemaModificationClient.parse(saisie);

      // **UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION**
      // (point 1, 16/09/2026) : mesuré en production, un même fichier
      // redéposé sans changement a fait réécrire 615 fiches à l'identique —
      // à la fois inutile et FAUX pour le journal d'audit (I8), qui inscrit
      // une trace par écriture. *La fiche porte-t-elle déjà ce que la ligne
      // s'apprête à écrire ?* Si oui, on n'écrit pas.
      if (
        avant !== null &&
        porteEncore(avant, modification, CHAMPS_ECRITS_CLIENTS)
      ) {
        return "inchangee";
      }

      await modifierClientDans(tx, cible, modification);
      await tracer(tx, ligne.id, "client", cible, avant);
      return "modification";
    },
  );
}

/**
 * Applique un lot d'import de SITES (R6-01).
 *
 * **Le type est dans le nom**, comme pour les clients, et les DEUX PARCS qu'il
 * lit ne répondent pas à la même question : `clients` et `agences` disent ce
 * qu'une CELLULE désigne — les deux parents d'un site —, `sites` dit si la
 * FICHE existe déjà. *Les confondre ferait de chaque ligne une création, et
 * d'un second import autant de doublons* (voir `parc-cibles.ts`).
 *
 * **Les parents sont résolus par `preparerUnSite`, la fonction MÊME que le
 * contrôle a appelée.** Ce n'est pas une commodité : une seconde résolution
 * écrite ici diverge en silence (§9, 01/09), et elle divergerait au pire
 * endroit — entre ce qu'un humain a validé et ce qui sera écrit.
 */
export async function appliquerLeLotDeSites(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const clients = await indexerLeParcClients(contexte, client);
  const agences = await indexerLesAgences(contexte, client);
  const sites = await indexerLeParcSites(contexte, client);

  return appliquerLesLignes(
    contexte,
    lotId,
    client,
    async (tx, societeId, ligne) => {
      const prepare = preparerUnSite(clients, agences, ligne.valeurs);
      // Le parc a bougé depuis le contrôle : le client ou l'agence que la ligne
      // nommait n'existe plus. *Ce n'est pas une erreur du fichier*, et écrire
      // quand même se heurterait de toute façon à la clé étrangère composite —
      // en emportant la transaction entière, donc le lot.
      if (!prepare.prete) return null;

      if (ligne.action === "creation") {
        const fiche = await creerSiteDans(
          tx,
          societeId,
          schemaCreationSite.parse(prepare.saisie),
        );
        await tracer(tx, ligne.id, "site", fiche.id, null);
        return "creation";
      }

      const cible =
        ligne.cle === null ? undefined : sites.fiches.get(ligne.cle);
      if (cible === undefined) return null;

      // **`valeurs_avant` ne porte QUE ce que cette écriture va toucher**, et
      // les deux parents en sont donc absents — ils ne sont pas écrits ici
      // (voir plus bas). *Y ranger une colonne qu'on ne modifie pas la ferait
      // RESTAURER à l'annulation*, c'est-à-dire écrire une colonne que l'import
      // n'a jamais touchée ; et sur `agence_id`, cette écriture serait en outre
      // refusée par le `superRefine` de D56, emportant l'annulation entière.
      // *L'import n'a pas écrit le reste, il n'a rien à en dire* (L1-08j).
      const avant = await tx.site.findUnique({
        where: { id: cible },
        select: {
          libelle: true,
          commune: true,
          zone_geo: true,
          consignes_acces: true,
        },
      });

      // **LES DEUX PARENTS SONT RETIRÉS AVANT LA MODIFICATION, et chacun
      // pour sa raison** — mesuré le 16/09/2026, `schemaModificationSite`
      // étant `.strict()` : les lui passer LÈVE, et la levée emporte le lot
      // entier.
      //
      // *`client_id`* n'est pas modifiable, et il n'a pas à l'être : la clé
      // d'un site EST le couple (client, libellé), si bien qu'une ligne
      // appariée désigne déjà le même client. **Le lui passer permettrait de
      // déplacer un site chez un autre client par un fichier**, ce qu'aucun
      // gabarit ne promet.
      //
      // *`agence_id`* est modifiable — mais **jamais seul** (D56) :
      // `superRefine` exige `temps_trajet_min` dans la même saisie, parce
      // qu'*un nombre dont la signification dépend d'une autre colonne ne
      // voyage jamais seul*. Or le gabarit n'expose PAS cette colonne
      // (`CHAMPS_SITES_ECARTES` : « sa lecture reste à écrire (L1-09) »).
      // **Un import ne déplace donc pas un site d'une agence à l'autre**, et
      // c'est la bonne lecture de D56 : *on n'exige pas qu'on mesure, on exige
      // qu'on DÉCIDE* — et un fichier ne décide pas. Le geste passe par
      // l'écran du site, où un humain fournit la valeur, ou `null` pour
      // revenir à l'estimation par zone.
      //
      // *Ce que cela coûte est nommé plutôt que tu* : une ligne qui nomme une
      // autre agence pour un site existant met ses autres colonnes à jour
      // **sans le déplacer**. Condition de levée, vérifiable : *le jour où
      // L1-09 lira la colonne « Temps de trajet »*, les deux voyageront
      // ensemble et la restriction tombera.
      const modifiables = { ...prepare.saisie };
      delete modifiables.client_id;
      delete modifiables.agence_id;
      const modification = schemaModificationSite.parse(modifiables);

      // **UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION**
      // (point 1, 16/09/2026) — même geste qu'aux clients, sur les seules
      // colonnes que cette écriture touche (les deux parents en sont exclus,
      // pour la même raison qu'ils sont absents de `valeurs_avant` ci-dessus).
      if (
        avant !== null &&
        porteEncore(avant, modification, CHAMPS_SITES_MODIFIES)
      ) {
        return "inchangee";
      }

      await modifierSiteDans(tx, cible, modification);
      await tracer(tx, ligne.id, "site", cible, avant);
      return "modification";
    },
  );
}

/**
 * Applique un lot d'import de MODÈLES DE MATÉRIEL (R6-01).
 *
 * **AUCUNE COLONNE DE VGP n'est écrite ici**, et c'est la décision de L1-05b
 * reprise telle quelle : l'assujettissement se déclare à la FAMILLE avec ses
 * trois valeurs (L9-03), « soumis » exige la périodicité ET son texte (L9-04),
 * le modèle PRÉCISE sans faire exception (L9-06). *Une seconde entrée sur la
 * même règle ne connaîtrait pas la première* — et un import est précisément le
 * chemin où personne ne relit ce qui entre.
 *
 * La périodicité que ce gabarit porte est celle de l'ENTRETIEN du constructeur,
 * jamais la périodicité réglementaire : *les mêler ferait facturer un entretien
 * pour une vérification légale, ou l'inverse.*
 */

/**
 * LES COLONNES QUE `modifierModeleDans` ÉCRIT — et elle les écrit TOUTES,
 * `actif` compris : `schemaModeleMateriel` lui pose `.default(true)`, et le
 * gabarit ne l'expose pas (`CHAMPS_MODELES_ECARTES`), si bien qu'une ligne de
 * fichier vaut toujours « actif = vrai ». *Une comparaison qui l'omettrait
 * jugerait « inchangée » une fiche désactivée depuis, et ne la réactiverait
 * jamais* — ce que l'import fait aujourd'hui à chaque passage, et que ce
 * ticket n'a pas pour objet de changer.
 *
 * **Ce n'est PAS la liste que compare `annulerLeLotDeModeles`** —
 * `CHAMPS_ECRITS_MODELES`, deux colonnes seulement : celle-ci protège une
 * décision (la famille reclassée reste reclassée), celle-ci mesure une
 * ÉCRITURE. Les deux répondent à des questions différentes, et les confondre
 * ferait sauter une reclassification légitime au premier ticket, ou manquer
 * une écriture réelle à celui-ci.
 */
const CHAMPS_MODELES_ECRITS = [
  "famille_id",
  "marque",
  "reference",
  "periodicite_jours",
  "periodicite_compteur",
  "actif",
] as const;

export async function appliquerLeLotDeModeles(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const familles = await indexerLesFamilles(contexte, client);
  const modeles = await indexerLeParcModeles(contexte, client);

  return appliquerLesLignes(
    contexte,
    lotId,
    client,
    async (tx, societeId, ligne) => {
      const prepare = preparerUnModele(familles, ligne.valeurs);
      if (!prepare.prete) return null;
      const saisie = schemaModeleMateriel.parse(prepare.saisie);

      if (ligne.action === "creation") {
        // L'identifiant est tiré ICI et non par la base (I10) — et il est rendu
        // à `tracer`, sans quoi l'annulation n'aurait rien à défaire.
        const id = uuidv7();
        await creerModeleDans(tx, societeId, id, saisie);
        await tracer(tx, ligne.id, "modele_materiel", id, null);
        return "creation";
      }

      const cible =
        ligne.cle === null ? undefined : modeles.fiches.get(ligne.cle);
      if (cible === undefined) return null;

      const avant = await tx.modeleMateriel.findUnique({
        where: { id: cible },
        select: {
          famille_id: true,
          marque: true,
          reference: true,
          periodicite_jours: true,
          periodicite_compteur: true,
          actif: true,
        },
      });

      // **UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION**
      // (point 1, 16/09/2026).
      if (avant !== null && porteEncore(avant, saisie, CHAMPS_MODELES_ECRITS)) {
        return "inchangee";
      }

      // **Zéro ligne touchée n'est pas une erreur, c'est la politique qui a
      // refusé**, et elle refuse en silence. La ligne est alors laissée en
      // l'état, comme une fiche disparue : le lot continue.
      const touchees = await modifierModeleDans(tx, cible, saisie);
      if (touchees === 0) return null;
      await tracer(tx, ligne.id, "modele_materiel", cible, avant);
      return "modification";
    },
  );
}

/**
 * Applique un lot d'import de PRESTATIONS (R6-01).
 *
 * **La famille est FACULTATIVE ici, et c'est la seule des trois à l'être** :
 * un déplacement, un diagnostic ou une formation ne visent aucune famille de
 * matériel. `preparerUnePrestation` porte la distinction — cellule VIDE contre
 * cellule RENSEIGNÉE QUI NE DÉSIGNE RIEN —, et elle n'est pas relue ici.
 *
 * **AUCUN MONTANT** : `schemaPrestation` n'en porte aucun (D109), et un import
 * est le chemin où personne ne relit ce qui entre.
 */
/**
 * LES COLONNES QUE `modifierPrestationDans` ÉCRIT — les cinq, `actif`
 * compris pour la même raison qu'aux modèles : le gabarit ne l'expose pas
 * (`CHAMPS_PRESTATIONS_ECARTES`), `schemaPrestation` lui pose `.default(true)`,
 * et l'omettre de la comparaison manquerait la réactivation qu'une écriture
 * produit réellement aujourd'hui.
 */
const CHAMPS_PRESTATIONS_ECRITES = [
  "code",
  "libelle",
  "famille_id",
  "duree_standard_min",
  "actif",
] as const;

export async function appliquerLeLotDePrestations(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const familles = await indexerLesFamilles(contexte, client);
  const prestations = await indexerLeParcPrestations(contexte, client);

  return appliquerLesLignes(
    contexte,
    lotId,
    client,
    async (tx, societeId, ligne) => {
      const prepare = preparerUnePrestation(familles, ligne.valeurs);
      if (!prepare.prete) return null;
      const saisie = schemaPrestation.parse(prepare.saisie);

      if (ligne.action === "creation") {
        const id = uuidv7();
        await creerPrestationDans(tx, societeId, id, saisie);
        await tracer(tx, ligne.id, "prestation", id, null);
        return "creation";
      }

      const cible =
        ligne.cle === null ? undefined : prestations.fiches.get(ligne.cle);
      if (cible === undefined) return null;

      const avant = await tx.prestation.findUnique({
        where: { id: cible },
        select: {
          code: true,
          libelle: true,
          famille_id: true,
          duree_standard_min: true,
          actif: true,
        },
      });

      // **UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION**
      // (point 1, 16/09/2026).
      if (
        avant !== null &&
        porteEncore(avant, saisie, CHAMPS_PRESTATIONS_ECRITES)
      ) {
        return "inchangee";
      }

      const touchees = await modifierPrestationDans(tx, cible, saisie);
      if (touchees === 0) return null;
      await tracer(tx, ligne.id, "prestation", cible, avant);
      return "modification";
    },
  );
}

/**
 * L'INSTANT, DATÉ DANS LE FUSEAU DE LA SOCIÉTÉ (L0-08).
 *
 * *L'instant rendu est le même quel que soit le fuseau* — `maintenant` fait
 * `new Date(Date.now())`. Ce que le détour apporte n'est donc pas une valeur
 * différente : **c'est l'impossibilité d'écrire une heure sans avoir dit
 * laquelle.** Le gardien de L0-08 l'a réclamé ici en nommant le fichier, et il
 * a raison de ne pas faire d'exception pour les cas où « c'est juste un
 * horodatage » : *c'est ainsi qu'une heure d'appareil finit par entrer.*
 */
async function instantDate(tx: Prisma.TransactionClient): Promise<Date> {
  const societe = await tx.societe.findFirstOrThrow({
    select: { fuseau_horaire: true },
  });
  return maintenant(lireFuseau(societe.fuseau_horaire)).instant;
}

/**
 * Écrit sur la ligne ce qu'elle a produit, et ce qu'elle a écrasé.
 *
 * **L'entité est un PARAMÈTRE depuis R6-01**, où elle était « client » en dur.
 * *C'est l'annulation qui la lit* — elle doit savoir quelle table restaurer —,
 * et une valeur figée aurait fait annuler un lot de sites contre la table des
 * clients, en silence.
 */
async function tracer(
  tx: Prisma.TransactionClient,
  ligneId: string,
  entite: string,
  entiteId: string,
  avant: Record<string, unknown> | null,
): Promise<void> {
  await tx.importLotLigne.update({
    where: { id: ligneId },
    data: {
      entite,
      entite_id: entiteId,
      valeurs_avant:
        avant === null ? undefined : (avant as Prisma.InputJsonValue),
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────
 * LE MATÉRIEL — la famille, puis l'équipement (R6-03)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Applique un lot d'import de FAMILLES DE MATÉRIEL (R6-03).
 *
 * **C'est la RACINE de l'enchaînement** que R6-03 décrit : une machine exige un
 * modèle, un modèle exige une famille, et la famille n'exige rien. *Elle est le
 * seul gabarit du matériel sans parent*, si bien que cette fonction ne lit qu'un
 * parc — celui de la cible.
 *
 * ## LES COLONNES DE VGP SONT ÉCRITES ICI, et L1-05b ne les écrivait pas
 *
 * La différence se vérifie : ce chemin n'énonce aucune règle de L9-04, il passe
 * `prepare.vgp` — que `schemaAssujettissementFamille` a jugé, et que la base
 * jugera une seconde fois par sa contrainte. *Une famille dont le fichier ne dit
 * rien naît `a_determiner`*, l'état honnête, et apparaît le jour même dans
 * `/vgp/a-determiner`.
 */

/**
 * LES COLONNES QUE `modifierFamilleDans` ÉCRIT — `code`, `libelle`, `actif`
 * ET les trois colonnes de VGP, que `saisie` seule ne porte pas : elles
 * viennent de `prepare.vgp`, un second schéma (voir le docblock du fichier).
 * **`actif` pour la même raison qu'aux modèles et aux prestations** : le
 * gabarit ne l'expose pas, `schemaFamilleMateriel` lui pose `.default(true)`.
 *
 * **Ce n'est PAS la liste que compare `annulerLeLotDeFamilles`**
 * (`CHAMPS_ECRITS_FAMILLES`, sans `actif`) — même distinction qu'aux modèles :
 * celle-là protège une décision, celle-ci mesure une écriture.
 */
const CHAMPS_FAMILLES_ECRITES = [
  "code",
  "libelle",
  "actif",
  "assujettissement_vgp",
  "vgp_periodicite_mois",
  "vgp_reference_texte",
] as const;

export async function appliquerLeLotDeFamilles(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const familles = await indexerLeParcFamilles(contexte, client);

  return appliquerLesLignes(
    contexte,
    lotId,
    client,
    async (tx, societeId, ligne) => {
      const prepare = preparerUneFamille(ligne.valeurs);
      if (!prepare.prete) return null;
      const saisie = schemaFamilleMateriel.parse(prepare.saisie);

      if (ligne.action === "creation") {
        const id = uuidv7();
        await creerFamilleDans(tx, societeId, id, saisie, prepare.vgp);
        await tracer(tx, ligne.id, "famille_materiel", id, null);
        return "creation";
      }

      const cible =
        ligne.cle === null ? undefined : familles.fiches.get(ligne.cle);
      if (cible === undefined) return null;

      const avant = await tx.familleMateriel.findUnique({
        where: { id: cible },
        select: {
          code: true,
          libelle: true,
          actif: true,
          assujettissement_vgp: true,
          vgp_periodicite_mois: true,
          vgp_reference_texte: true,
        },
      });

      // **UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION**
      // (point 1, 16/09/2026). L'écrit se recompose de `saisie` et de
      // `prepare.vgp` — le même geste que la reconstitution de
      // `annulerLeLotDeFamilles`, pour la même raison : les colonnes de VGP
      // ne sont pas dans `saisie`.
      const ecrit = {
        ...saisie,
        assujettissement_vgp: prepare.vgp.assujettissement,
        vgp_periodicite_mois: prepare.vgp.periodiciteMois,
        vgp_reference_texte: prepare.vgp.referenceTexte,
      };
      if (
        avant !== null &&
        porteEncore(avant, ecrit, CHAMPS_FAMILLES_ECRITES)
      ) {
        return "inchangee";
      }

      const touchees = await modifierFamilleDans(
        tx,
        cible,
        saisie,
        prepare.vgp,
      );
      if (touchees === 0) return null;
      await tracer(tx, ligne.id, "famille_materiel", cible, avant);
      return "modification";
    },
  );
}

/**
 * Applique un lot d'import d'ÉQUIPEMENTS (R6-03 ; D6, D7, I10).
 *
 * **QUATRE parcs sont lus, et ils ne répondent pas à la même question.**
 * `clients`, `sites` et `modeles` disent ce qu'une CELLULE désigne — les trois
 * parents de D6 —, `equipements` dit si la FICHE existe déjà. *C'est le premier
 * gabarit du dépôt à désigner trois parents*, et le rejet nomme lequel manque.
 *
 * **Les parents sont résolus par `preparerUnEquipement`, la fonction MÊME que le
 * contrôle a appelée** — et le RANG lui est passé, parce que c'est lui qui
 * décide de la forme de la clé, donc du numéro de série. *Une seconde résolution
 * écrite ici divergerait au pire endroit : entre ce qu'un humain a validé et ce
 * qui sera écrit.*
 *
 * **`complet` n'est pas décidé ici** : `schemaMachine` le déduit du numéro de
 * série (§6), et une plaque illisible donne `SN-INCONNU-<référence>` — la fiche
 * entre incomplète et rejoint la file de complétion de L2-01. *Elle n'est pas
 * rejetée : c'est tout le point de D6.*
 */

/**
 * LES COLONNES QUE `modifierMachineDans` ÉCRIT — les neuf, et TOUJOURS : à la
 * différence des clients et des sites, l'équipement n'a pas de schéma de
 * MODIFICATION distinct — `schemaMachine` sert aux deux actions, et ses
 * `.default(null)` sur les trois dates et `facture_origine` s'appliquent
 * qu'une cellule soit vide ou que le gabarit ne l'expose simplement pas
 * (`CHAMPS_EQUIPEMENTS_ECARTES`). *Omettre une seule de ces colonnes de la
 * comparaison ferait juger « inchangée » une ligne dont l'écriture aurait en
 * réalité effacé une date — le défaut inverse de celui que ce ticket ferme.*
 *
 * **Ce n'est pas la liste que compare `annulerLeLotDeEquipements`** — elle
 * varie selon l'action (`CHAMPS_EQUIPEMENTS_MODIFIES` contre
 * `CHAMPS_ECRITS_EQUIPEMENTS`, qui ajoute les trois parents À LA CRÉATION
 * seulement) : cette liste-ci n'a besoin que de la MODIFICATION, la seule
 * action que ce module compare avant d'écrire.
 */
const CHAMPS_EQUIPEMENTS_ECRITS = [
  "numero_serie",
  "reference_interne",
  "localisation",
  "facture_origine",
  "date_mise_en_service",
  "date_vente",
  "garantie_fin",
  "criticite",
  "complet",
] as const;

export async function appliquerLeLotDeEquipements(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const clients = await indexerLeParcClients(contexte, client);
  const sites = await indexerLeParcSites(contexte, client);
  const modeles = await indexerLeParcModeles(contexte, client);
  const equipements = await indexerLeParcEquipements(contexte, client);

  return appliquerLesLignes(
    contexte,
    lotId,
    client,
    async (tx, societeId, ligne) => {
      const prepare = preparerUnEquipement(
        clients,
        sites,
        modeles,
        ligne.valeurs,
        ligne.rang,
      );
      // Le parc a bougé depuis le contrôle : l'un des trois parents a disparu.
      // *Ce n'est pas une erreur du fichier*, et écrire quand même se heurterait
      // de toute façon à la clé étrangère composite — en emportant la
      // transaction entière, donc le lot.
      if (!prepare.prete) return null;
      const saisie = schemaMachine.parse(prepare.saisie);

      if (ligne.action === "creation") {
        // L'identifiant est tiré ICI et non par la base (D7, I10) — et il est
        // rendu à `tracer`, sans quoi l'annulation n'aurait rien à défaire.
        const id = uuidv7();
        await creerMachineDans(tx, societeId, id, saisie);
        await tracer(tx, ligne.id, "machine", id, null);
        return "creation";
      }

      const cible =
        ligne.cle === null ? undefined : equipements.fiches.get(ligne.cle);
      if (cible === undefined) return null;

      const avant = await tx.machine.findUnique({
        where: { id: cible },
        select: {
          numero_serie: true,
          reference_interne: true,
          localisation: true,
          facture_origine: true,
          date_mise_en_service: true,
          date_vente: true,
          garantie_fin: true,
          criticite: true,
          complet: true,
        },
      });

      // **UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION**
      // (point 1, 16/09/2026).
      if (
        avant !== null &&
        porteEncore(avant, saisie, CHAMPS_EQUIPEMENTS_ECRITS)
      ) {
        return "inchangee";
      }

      const touchees = await modifierMachineDans(tx, cible, saisie);
      if (touchees === 0) return null;
      await tracer(tx, ligne.id, "machine", cible, avant);
      return "modification";
    },
  );
}
