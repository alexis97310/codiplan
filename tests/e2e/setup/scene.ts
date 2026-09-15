import { PrismaClient } from "@prisma/client";

import { reemettreJetonPremierAcces } from "@/lib/auth/amorcage";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import {
  instantAMinutes,
  jourSuivant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";

import { urlAdministration, urlApplicative } from "./base";

/**
 * LA SCÈNE DES SCÉNARIOS DE PLANNING — écrite exprès, jamais devinée du semis.
 *
 * ## Pourquoi une scène, et pas les interventions de démonstration
 *
 * Le semis pose seize interventions réparties par un tour de rôle sur les
 * sites : `sitesEcrits[index % sitesEcrits.length]`. Un scénario qui viserait
 * « l'intervention du mardi de Guérin » dépendrait donc du NOMBRE de sites,
 * c'est-à-dire d'une donnée de démonstration qu'un ticket peut changer sans
 * savoir qu'il casse un scénario. *Une épreuve dont la cible se déplace au
 * prochain ticket n'est pas une épreuve, c'est une alarme qui apprendra à ne
 * plus être lue (§9, 11/09).*
 *
 * La scène écrit donc ses propres lignes, avec des identifiants FIXES, des
 * agences NOMMÉES par leur code, et des jours calculés depuis le lundi de la
 * semaine courante — comme le semis, et pour la même raison : *une
 * démonstration datée se périme sans jamais être vide.*
 *
 * ## Ce qu'elle choisit, et pourquoi
 *
 * **Koné ferme le samedi, Ducos l'ouvre** (`DEMO-KONE` contre `DEMO-NOUMEA`).
 * C'est le cas exact que R2-14 avait laissé ouvert : la vue semaine affiche
 * l'UNION des agences d'une personne, *et cette union est un repère, jamais un
 * droit de poser*. Une intervention de Koné déposée un samedi doit être refusée
 * par le calendrier de SON agence, quoi qu'affiche la ligne.
 *
 * **Deux interventions du même technicien le même jour**, l'une de 08:00 à
 * 10:00 et l'autre de 13:00 à 14:00 : de quoi éprouver le chevauchement sans
 * qu'aucune autre ligne du semis ne vienne s'y mêler.
 */

/**
 * LE MOT DE PASSE DE L'ÉPREUVE, et ce n'en est pas un secret.
 *
 * Un secret protège quelque chose. Celui-ci ouvre un compte de DÉMONSTRATION,
 * sur une base LOCALE que le harnais recrée à chaque exécution, et dont trois
 * refus garantissent qu'elle n'est jamais l'hébergée (`urlAdministration`).
 * `tests/isolation/categorie-authentification.test.ts` en écrit un depuis le
 * 07/09 pour la même raison.
 */
export const MOT_DE_PASSE_EPREUVE = "epreuve-de-bout-en-bout-codiplan";

/** Le compte que les scénarios empruntent : rôle `adv`, donc SANS second facteur. */
export const COMPTE_EPREUVE = "adv@codima.test";

/**
 * LE COMPTE TECHNICIEN DE L'ÉPREUVE (R5-01, R5-02).
 *
 * C'est `technicienDucos`, celui à qui la scène affecte `obstacle` et
 * `chevauchante` — **deux interventions de la même personne**, ce dont le
 * compteur a besoin pour montrer son refus le plus intéressant : *un compteur
 * qui tourne ailleurs.*
 *
 * Il faut une SECONDE identité, et pour la raison inverse de celle du portail :
 * `/terrain` renvoie au back-office tout rôle dont l'accès au planning est
 * COMPLET, et `adv` en fait partie. **Ce compte-là est connectable** — un
 * technicien porte une ligne dans `utilisateur_societe`, donc l'amorçage sait
 * lui émettre un lien de premier accès.
 */
export const COMPTE_TECHNICIEN_EPREUVE = "guerin@codima.test";

/**
 * Les FORFAITS de la scène.
 *
 * **Le catalogue de démonstration naît VIDE, et c'est une décision** — les
 * valeurs appartiennent à l'exploitation (L1-06). *Mesuré le 11/09/2026 :
 * `/parametres/forfaits` n'affiche donc AUCUN tableau sur une base semée, et sa
 * reprise d'apparence serait restée « écrite mais jamais vue ».* La scène en
 * pose deux — une FIXTURE d'épreuve, jamais de la donnée de démonstration : la
 * base est détruite à chaque exécution, et le semis reste inchangé.
 */
export const FORFAITS_SCENE = [
  {
    id: "01a0e2e0-0000-7000-8000-0000000000f1",
    code: "EPR-DEP-A",
    libelle: "Déplacement — épreuve A",
    rang: 901,
    montant_mineur: BigInt(8500),
  },
  {
    id: "01a0e2e0-0000-7000-8000-0000000000f2",
    code: "EPR-DEP-B",
    libelle: "Déplacement — épreuve B",
    rang: 902,
    montant_mineur: BigInt(24000),
  },
] as const;

/** Les interventions de la scène. Identifiants FIXES, jamais tirés du semis. */
export const SCENE = {
  /** Koné, technicien de Koné, MARDI — celle qu'on déplace. */
  deplacable: "01a0e2e0-0000-7000-8000-000000000001",
  /** Koné, technicien de Koné, MERCREDI — celle qu'on jette sur un samedi fermé. */
  versSamedi: "01a0e2e0-0000-7000-8000-000000000002",
  /** Ducos, technicien de Ducos, MARDI 08:00–10:00 — l'obstacle. */
  obstacle: "01a0e2e0-0000-7000-8000-000000000003",
  /** Ducos, MÊME technicien, MARDI 13:00–14:00 — celle qui viendra chevaucher. */
  chevauchante: "01a0e2e0-0000-7000-8000-000000000004",
} as const;

export type ReperesDeScene = {
  readonly societeId: string;
  readonly fuseau: string;
  readonly lundi: JourLocal;
  readonly technicienKone: string;
  readonly technicienDucos: string;
};

/** `2026-09-16`, la forme que la grille emploie pour nommer une colonne. */
export function cleDeJour(jour: JourLocal): string {
  return `${jour.annee}-${String(jour.mois).padStart(2, "0")}-${String(jour.jour).padStart(2, "0")}`;
}

/** Le jour d'un rang depuis le lundi de la semaine courante. */
export function jourDeLaScene(
  reperes: ReperesDeScene,
  rang: number,
): JourLocal {
  return jourSuivant(reperes.lundi, rang);
}

/** MARDI, MERCREDI, SAMEDI — les trois colonnes que les scénarios visent. */
export const MARDI = 1;
export const MERCREDI = 2;
export const SAMEDI = 5;

async function agenceEtLieu(
  client: PrismaClient,
  societeId: string,
  codeAgence: string,
): Promise<{ agenceId: string; siteId: string; clientId: string }> {
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

async function identiteDe(
  client: PrismaClient,
  email: string,
): Promise<string> {
  const identite = await client.utilisateur.findFirstOrThrow({
    where: { email },
    select: { id: true },
  });
  return identite.id;
}

/**
 * Écrit la scène et rend ses repères.
 *
 * Le client est le PROPRIÉTAIRE — comme le semis, et pour la même raison : une
 * fixture s'écrit avant qu'aucune session n'existe. Ce que les scénarios
 * mesurent ensuite passe, lui, entièrement par le rôle applicatif et par les
 * politiques.
 */
export async function ecrireLaScene(): Promise<ReperesDeScene> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true, fuseau_horaire: true },
    });
    const aujourdhui = new Date();
    const lundi = lundiDeLaSemaine({
      annee: aujourdhui.getUTCFullYear(),
      mois: aujourdhui.getUTCMonth() + 1,
      jour: aujourdhui.getUTCDate(),
    });
    const kone = await agenceEtLieu(client, societe.id, "KONE");
    const ducos = await agenceEtLieu(client, societe.id, "DUCOS");
    const reperes: ReperesDeScene = {
      societeId: societe.id,
      fuseau: societe.fuseau_horaire,
      lundi,
      technicienKone: await identiteDe(client, "poigoune@codima.test"),
      technicienDucos: await identiteDe(client, "guerin@codima.test"),
    };

    // ── LA SCÈNE SE FAIT DE LA PLACE, ET C'EST UNE MESURE QUI L'EXIGE ──────
    //
    // *Mesuré le 11/09/2026 : le semis posait déjà une intervention de 13:00 à
    // 15:00 pour le technicien de Ducos le mardi, et la vue jour ne montre
    // qu'une occupation par créneau — la ligne de la scène était rendue
    // INVISIBLE par celle du semis, et le scénario accusait le sélecteur.*
    //
    // Les deux jours de la scène sont donc libérés pour ses deux techniciens :
    // les interventions de démonstration y sont rendues à la file d'attente,
    // pas supprimées. Les statuts TERMINAUX sont écartés — le verrou de cycle
    // de vie les refuse, et le semis ne les pose de toute façon qu'au passé.
    const joursDeLaScene = [MARDI, MERCREDI].map((rang) => {
      const j = jourDeLaScene(reperes, rang);
      return new Date(Date.UTC(j.annee, j.mois - 1, j.jour));
    });
    await client.intervention.updateMany({
      where: {
        technicien_id: {
          in: [reperes.technicienKone, reperes.technicienDucos],
        },
        date_planifiee: { in: joursDeLaScene },
        statut: { notIn: ["cloturee", "annulee", "terminee"] },
      },
      data: {
        technicien_id: null,
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        statut: "a_planifier",
      },
    });

    const lignes = [
      {
        id: SCENE.deplacable,
        lieu: kone,
        technicien: reperes.technicienKone,
        rang: MARDI,
        debut: null,
        duree: 120,
      },
      {
        id: SCENE.versSamedi,
        lieu: kone,
        technicien: reperes.technicienKone,
        rang: MERCREDI,
        debut: null,
        duree: 120,
      },
      {
        id: SCENE.obstacle,
        lieu: ducos,
        technicien: reperes.technicienDucos,
        rang: MARDI,
        debut: 8 * 60,
        duree: 120,
      },
      {
        id: SCENE.chevauchante,
        lieu: ducos,
        technicien: reperes.technicienDucos,
        rang: MARDI,
        debut: 13 * 60,
        duree: 60,
      },
    ];

    for (const ligne of lignes) {
      const jour = jourDeLaScene(reperes, ligne.rang);
      const donnees = {
        societe_id: societe.id,
        agence_id: ligne.lieu.agenceId,
        client_id: ligne.lieu.clientId,
        site_id: ligne.lieu.siteId,
        technicien_id: ligne.technicien,
        type: "preventif_contrat" as const,
        priorite: "p3" as const,
        statut: "planifiee" as const,
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut:
          ligne.debut === null
            ? null
            : instantAMinutes(jour, ligne.debut, reperes.fuseau),
        creneau_fin:
          ligne.debut === null
            ? null
            : instantAMinutes(jour, ligne.debut + ligne.duree, reperes.fuseau),
        duree_estimee_min: ligne.duree,
        mode_valorisation: "temps_passe" as const,
        devise_code: "XPF",
      };
      // `delete` puis `create` : le verrou de cycle de vie refuse la réécriture
      // de certaines lignes, et une scène doit repartir d'un état connu. Les
      // SEGMENTS partent d'abord — `segment_travail` retient son intervention
      // en `ON DELETE RESTRICT` (D120).
      await client.$executeRawUnsafe(
        `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
        ligne.id,
      );
      await client.intervention.deleteMany({ where: { id: ligne.id } });
      await client.intervention.create({ data: { id: ligne.id, ...donnees } });

      // ── UN COMPTEUR A TOURNÉ SUR L'OBSTACLE, ET C'EST DÉSORMAIS LA
      //    CONDITION POUR QUE LA CLÔTURE S'OFFRE (D120) ─────────────────────
      //
      // *Le compteur du technicien est la seule source du temps* : sur une
      // intervention où aucun segment n'a tourné, la fiche affiche le REFUS de
      // clôture à la place de l'action. **Le scénario de largeur utile compte
      // les actions offertes ; sans ce segment, il en compterait quatre.**
      //
      // La scène pose donc un segment FERMÉ de deux heures, et la somme avec
      // lui : le déclencheur `intervention_temps_mesure_est_celui_du_compteur`
      // VÉRIFIE que la valeur écrite est bien celle des segments — *si cette
      // fixture mentait, elle serait refusée.*
      if (ligne.id === SCENE.obstacle) {
        await client.$executeRawUnsafe(
          `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid,
                   $4::timestamptz, $4::timestamptz + interval '120 minutes', now())`,
          societe.id,
          ligne.id,
          ligne.technicien,
          donnees.creneau_debut ?? donnees.date_planifiee,
        );
        await client.intervention.update({
          where: { id: ligne.id },
          data: { temps_mesure_min: 120 },
        });
      }
    }

    for (const forfait of FORFAITS_SCENE) {
      await client.forfait.deleteMany({ where: { id: forfait.id } });
      // EN SQL BRUT, et la raison est mesurée : « aucune condition » se stocke
      // en **NULL**, jamais en tableau vide — `forfait_types_intervention_non_vides`
      // refuse `{}` (code 23514, mesuré le 11/09/2026). Or le type Prisma d'une
      // liste scalaire n'admet pas `null` à l'écriture.
      //
      // ~~Et aucun chemin applicatif ne crée de forfait.~~ **R2-20 en a
      // construit un** (13/09/2026) : `lib/tarification/depot-forfaits.ts`
      // écrit `NULL` en **OMETTANT** la colonne. La phrase est barrée et non
      // effacée — *ce qui a été écrit un jour se relit.* Cette fixture reste
      // en SQL brut à dessein : **une fixture de scène ne passe pas par le
      // chemin qu'elle sert à éprouver**, sinon un défaut du dépôt rendrait la
      // scène muette au lieu de la faire rougir.
      //
      // *Ce que Prisma rend à la LECTURE d'une colonne NULL est `[]`, et c'est
      // pourquoi la constitution dit que « aucune condition » a deux écritures.*
      await client.$executeRawUnsafe(
        `INSERT INTO "forfait" (
           "id", "societe_id", "code", "libelle", "type", "rang",
           "montant_mineur", "devise_code", "zone_geo", "famille_id",
           "type_intervention", "cumulable_temps", "actif"
         ) VALUES ($1::uuid, $2::uuid, $3, $4, 'deplacement', $5::int,
                   $6::bigint, 'XPF', NULL, NULL, NULL, false, true)`,
        forfait.id,
        societe.id,
        forfait.code,
        forfait.libelle,
        forfait.rang,
        // `bigint` en paramètre : Prisma le transporte tel quel, la colonne
        // l'attend, et un nombre flottant serait une arithmétique que I3
        // interdit.
        forfait.montant_mineur,
      );
    }

    return reperes;
  } finally {
    await client.$disconnect();
  }
}

/**
 * Donne un mot de passe au compte de l'épreuve, PAR LE CHEMIN DE PRODUCTION.
 *
 * Le semis n'attribue aucun mot de passe — c'est une règle du dépôt, pas un
 * oubli. La scène ne la contourne pas : elle réémet un jeton de premier accès
 * pour une identité qui n'a jamais servi (D65, complément du 10/09), puis
 * consomme ce jeton par la même fonction que le formulaire. *Un harnais qui
 * écrirait une empreinte de mot de passe en base éprouverait un chemin qui
 * n'existe pas.*
 */
export async function ouvrirLeCompteDeLEpreuve(
  societeId: string,
  email: string = COMPTE_EPREUVE,
): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const reemission = await reemettreJetonPremierAcces(client, {
      societeId,
      email,
    });
    const jeton = jetonDeLUrl(reemission.urlPremierAcces);
    if (jeton === null) {
      throw new Error(
        "La réémission n'a pas rendu de jeton : la scène ne peut pas ouvrir " +
          "le compte de l'épreuve.",
      );
    }
    const issue = await choisirLePremierMotDePasse({
      jeton,
      motDePasse: MOT_DE_PASSE_EPREUVE,
      confirmation: MOT_DE_PASSE_EPREUVE,
    });
    if (issue.issue !== "abouti") {
      throw new Error(
        `Le premier accès du compte de l'épreuve a été refusé : ${issue.issue}.`,
      );
    }
  } finally {
    await client.$disconnect();
  }
}

/**
 * LE JETON, EXTRAIT DE L'URL QUE LA RÉÉMISSION REND.
 *
 * *L'URL est RELATIVE et la bibliothèque y met le jeton en SEGMENT DE CHEMIN* —
 * `/reset-password/<jeton>?callbackURL=/premier-acces` —, là où l'écran de
 * premier accès le lit en paramètre `token` : c'est la redirection de la
 * bibliothèque qui fait passer de l'un à l'autre, et le harnais n'a pas de
 * navigateur pour la suivre. Les deux formes sont donc lues, dans cet ordre.
 *
 * **La limite est annoncée** : ceci connaît la forme d'URL de la bibliothèque.
 * Le jour où elle change, la préparation ÉCHOUE en le disant — elle ne rend
 * jamais un jeton faux, et un harnais qui casse bruyamment vaut mieux qu'un
 * harnais qui ouvre un compte qu'on croit fermé.
 */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}
