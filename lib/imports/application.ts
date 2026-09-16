import { type Prisma, type PrismaClient } from "@prisma/client";

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
import { creerModeleDans, modifierModeleDans } from "@/lib/materiel/depot";
import { schemaModeleMateriel } from "@/lib/materiel/saisie";
import {
  creerPrestationDans,
  modifierPrestationDans,
} from "@/lib/prestations/depot";
import { schemaPrestation } from "@/lib/prestations/saisie";
import { uuidv7 } from "@/lib/db/uuid";

import {
  CHAMPS_CLIENTS,
  preparerUnModele,
  preparerUnePrestation,
  preparerUnSite,
  saisieDepuisLaLigne,
} from "./modeles";
import { indexerLesAgences } from "./parc-agences";
import { indexerLesFamilles } from "./parc-familles";
import { indexerLeParcClients } from "./parc-clients";
import {
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
  "lot_introuvable" | "lot_deja_applique" | "lot_annule";

export type ResultatApplication =
  | { readonly applique: false; readonly motif: RefusApplication }
  | {
      readonly applique: true;
      readonly creations: number;
      readonly modifications: number;
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

/** Ce qu'une ligne a produit — ou `null` si rien n'a bougé. */
type Ecriture = "creation" | "modification" | null;

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
 * cinquième application sera écrite et non déclarée, `pnpm verify` rougira le
 * jour même.* C'est la réponse que L1-08i attendait d'avoir cinq exemplaires
 * sous les yeux pour donner.
 *
 * ## Le parc peut AVOIR BOUGÉ, et ce n'est pas une erreur du fichier
 *
 * `ecrire` rend `null` quand la ligne ne désigne plus rien — une fiche
 * supprimée entre le contrôle et la validation, un parent disparu. *La ligne
 * est laissée en l'état et le lot continue* : l'annulation partielle de I6 est
 * faite du même bois, et l'écart se lit dans les décomptes rendus, qui sont
 * ceux de ce qui a été ÉCRIT et non ceux du rapport.
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

  return avecContexteApplicatif(
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
        return { applique: false as const, motif: "lot_introuvable" as const };
      }
      const refus = refusDuStatut(lot.statut);
      if (refus !== null) {
        return { applique: false as const, motif: refus };
      }

      let creations = 0;
      let modifications = 0;

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
      }

      await tx.importLot.update({
        where: { id: lotId },
        data: { statut: "applique", applique_le: await instantDate(tx) },
      });

      // **Aucun décompte des lignes IGNORÉES n'est rendu**, et c'est délibéré :
      // la requête ne les rapporte pas, ce chiffre vaudrait donc zéro en toute
      // circonstance. *Une ligne qui ne peut pas bouger sous une faute n'est
      // jamais présentée à côté de celles qui le peuvent* (§9, 06/09) — le lot
      // porte déjà ses décomptes, et c'est là qu'on les lit.
      return { applique: true as const, creations, modifications };
    },
    client,
  );
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
      // seule trace — sur une table qu'aucune annulation ne lit.
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

      await modifierClientDans(
        tx,
        cible,
        schemaModificationClient.parse(saisie),
      );
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
      await modifierSiteDans(
        tx,
        cible,
        schemaModificationSite.parse(modifiables),
      );
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
        },
      });

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
        },
      });

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
