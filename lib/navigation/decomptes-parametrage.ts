import type { PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  type Fuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import { compterAgences } from "@/lib/agences/depot";
import { compterLesLots } from "@/lib/imports/depot";
import { formatMoney } from "@/lib/money/format";
import { listerLesPrestations } from "@/lib/prestations/depot";
import { compterSites } from "@/lib/sites/depot";
import { schemaRechercheSite } from "@/lib/sites/saisie";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import {
  compterHabilitationsExpirees,
  pointsDonneesACompleter,
  techniciensAccesAOuvrir,
} from "@/lib/tableau-de-bord/lectures";
import { compterZonesSansForfaitDeDeplacement } from "@/lib/tarification/depot-forfaits";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";
import { famillesADeterminer } from "@/lib/vgp/registre";

import type { PorteParametrage } from "./portes-parametrage";

/**
 * LES PASTILLES-DÉCOMPTE DU HUB « Paramètres » (9EWD-PARAMETRES-HUB-
 * MAQUETTE, décision n° 97 d'Alexis, M:4364-4395).
 *
 * ## Pourquoi un module à part, et pas une colonne de `PORTES_PARAMETRAGE`
 *
 * Une porte est une DONNÉE statique (chemin, titre, icône) ; un décompte est
 * une LECTURE, datée à la seconde où la page se rend. Les mêler ferait de
 * `portes-parametrage.ts` un fichier qui ouvre des transactions — exactement
 * ce que `lib/navigation/` refuse (voir son en-tête).
 *
 * ## « Une lecture qui échoue, la porte s'affiche sans décompte »
 *
 * Chaque décompte est calculé séparément, et une erreur sur l'un n'empêche
 * jamais les autres ni la page elle-même de se rendre — jamais une page en
 * erreur pour une pastille. C'est la MÊME discipline que D88 (une tuile dont
 * la lecture échoue n'affiche rien), appliquée ici porte par porte plutôt
 * qu'écran par écran.
 *
 * ## Jamais « Agence » ni « Site » écrits ici (D5, D47)
 *
 * Le décompte des agences et celui des sites sans trajet composent le mot
 * avec `motDansUnePhrase` (`lib/i18n/vocabulaire.ts`), jamais avec une clé du
 * dictionnaire qui porterait le mot en toutes lettres.
 */
export type Decompte = {
  readonly texte: string;
  readonly ton: "alerte" | "neutre";
  readonly href?: string;
};

type DeviseLue = {
  readonly code: string;
  readonly decimales: number;
  readonly symbole: string | null;
};

async function essayer<T>(lecture: () => Promise<T>): Promise<T | undefined> {
  try {
    return await lecture();
  } catch {
    return undefined;
  }
}

function auPluriel(n: number, un: string, plusieurs: string): string {
  return n === 1 ? un : plusieurs;
}

async function decompteTrajets(
  contexte: ContexteSession,
  client: PrismaClient | undefined,
): Promise<Decompte | undefined> {
  const criteres = schemaRechercheSite.parse({
    client_actif: true,
    trajet_inconnu: true,
  });
  const sansTrajet = await compterSites(contexte, criteres, client);
  if (sansTrajet > 0) {
    return {
      texte: `${sansTrajet} ${motDansUnePhrase("site", sansTrajet !== 1)} ${t("parametres.decompte_sites_sans_trajet_suffixe")}`,
      ton: "alerte",
      href: "/sites?vue=trajet_inconnu",
    };
  }
  const total = ZONES_GEOGRAPHIQUES.length;
  return {
    texte: `${total} ${auPluriel(total, t("parametres.decompte_zone_un"), t("parametres.decompte_zone"))}`,
    ton: "neutre",
  };
}

async function decomptePrestations(
  contexte: ContexteSession,
  client: PrismaClient | undefined,
): Promise<Decompte> {
  const total = (await listerLesPrestations(contexte, client)).length;
  return {
    texte: `${total} ${auPluriel(total, t("parametres.decompte_prestation_un"), t("parametres.decompte_prestation"))}`,
    ton: "neutre",
  };
}

async function decompteAgences(
  contexte: ContexteSession,
  client: PrismaClient | undefined,
): Promise<Decompte> {
  const { total, actives } = await compterAgences(contexte, client);
  const suffixeActives =
    total > actives
      ? `${t("parametres.decompte_agence_active_suffixe")}${actives} ${auPluriel(actives, t("parametres.decompte_agence_active_un"), t("parametres.decompte_agence_active"))}`
      : "";
  return {
    texte: `${total} ${motDansUnePhrase("agence", total !== 1)}${suffixeActives}`,
    ton: "neutre",
  };
}

async function decompteEquipe(
  contexte: ContexteSession,
  client: PrismaClient | undefined,
): Promise<Decompte> {
  // RÉUTILISE la lecture du tableau de bord — jamais un second calcul.
  const aOuvrir = (await techniciensAccesAOuvrir(contexte, client)).length;
  if (aOuvrir > 0) {
    return {
      texte: `${aOuvrir} ${t("parametres.decompte_acces_a_ouvrir")}`,
      ton: "alerte",
      href: "/parametres/equipe?acces=a-ouvrir",
    };
  }
  return {
    texte: t("parametres.decompte_tous_acces_ouverts"),
    ton: "neutre",
  };
}

async function decompteHabilitations(
  contexte: ContexteSession,
  fuseau: Fuseau,
  client: PrismaClient | undefined,
): Promise<Decompte | undefined> {
  const { local } = maintenant(fuseau);
  const aujourdHui = jourDe(local);
  const expirees = await compterHabilitationsExpirees(
    contexte,
    aujourdHui,
    client,
  );
  if (expirees === 0) {
    return undefined;
  }
  return {
    texte: `${expirees} ${auPluriel(expirees, t("parametres.decompte_habilitation_expiree_un"), t("parametres.decompte_habilitation_expiree"))}`,
    ton: "alerte",
    href: "/parametres/equipe?echeance=expiree",
  };
}

async function decompteMateriel(
  contexte: ContexteSession,
): Promise<Decompte | undefined> {
  const aDeterminer = (await famillesADeterminer(contexte)).length;
  if (aDeterminer === 0) {
    return undefined;
  }
  return {
    texte: `${aDeterminer} ${auPluriel(aDeterminer, t("parametres.decompte_famille_vgp_a_determiner_un"), t("parametres.decompte_famille_vgp_a_determiner"))}`,
    ton: "alerte",
    href: "/vgp/a-determiner",
  };
}

async function decompteImports(
  contexte: ContexteSession,
  client: PrismaClient | undefined,
): Promise<Decompte | undefined> {
  const aAppliquer = await compterLesLots(contexte, "a-appliquer", client);
  if (aAppliquer === 0) {
    return undefined;
  }
  return {
    texte: `${aAppliquer} ${auPluriel(aAppliquer, t("parametres.decompte_lot_a_appliquer_un"), t("parametres.decompte_lot_a_appliquer"))}`,
    ton: "alerte",
    href: "/imports?vue=a-appliquer",
  };
}

async function decompteDonnees(
  contexte: ContexteSession,
  debutDuJour: Date,
  client: PrismaClient | undefined,
): Promise<Decompte> {
  const points = await pointsDonneesACompleter(contexte, debutDuJour, client);
  if (points.length === 0) {
    return { texte: t("parametres.decompte_a_jour"), ton: "neutre" };
  }
  return {
    texte: `${points.length} ${auPluriel(points.length, t("parametres.decompte_point_a_reprendre_un"), t("parametres.decompte_point_a_reprendre"))}`,
    ton: "alerte",
    // DIFFÉRENT du chemin de la porte (`/parametres/donnees`) — même motif
    // que `/parametres/forfaits?vue=sans-forfait` ci-dessous.
    href: "/parametres/donnees?vue=a-reprendre",
  };
}

async function decompteForfaits(
  contexte: ContexteSession,
  client: PrismaClient | undefined,
): Promise<Decompte | undefined> {
  const sansForfait = await compterZonesSansForfaitDeDeplacement(
    contexte,
    client,
  );
  if (sansForfait === 0) {
    return undefined;
  }
  return {
    texte: `${sansForfait} ${auPluriel(sansForfait, t("parametres.decompte_zone_sans_forfait_un"), t("parametres.decompte_zone_sans_forfait"))}`,
    ton: "alerte",
    // DIFFÉRENT du chemin de la porte elle-même (`/parametres/forfaits`) —
    // deux ancres de même `href` sur une même page rendraient `a[href=…]`
    // introuvable par un décompte exact (droits-rm-rs.spec.ts).
    href: "/parametres/forfaits?vue=sans-forfait",
  };
}

async function decompteTauxHoraire(
  contexte: ContexteSession,
  instant: Date,
  client: PrismaClient | undefined,
): Promise<Decompte | undefined> {
  const societeId = exigerSocieteActive(contexte);
  const { taux, devise } = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const [taux, societe] = await Promise.all([
        tauxEnVigueur(tx, instant),
        tx.societe.findFirst({
          where: { id: societeId },
          select: {
            devise: { select: { code: true, decimales: true, symbole: true } },
          },
        }),
      ]);
      return { taux, devise: (societe?.devise ?? null) as DeviseLue | null };
    },
    client,
  );
  if (taux === null || devise === null || devise.code !== taux.taux.devise) {
    return undefined;
  }
  const texte = `${formatMoney(taux.taux, devise)} ${t("parametres.decompte_taux_depuis_le")} ${dateCivile(taux.dateEffet)}`;
  return { texte, ton: "neutre" };
}

/**
 * UN DÉCOMPTE PAR CHEMIN, SEULEMENT POUR LES PORTES OUVERTES — en
 * `Promise.all`, chaque lecture protégée séparément (`essayer`). Une porte
 * absente de la carte n'a simplement aucune pastille.
 *
 * **La lecture ne se déclenche QUE pour une porte ouverte** (9EWD1-
 * PARAMETRES-HUB-SOLDE) : chaque entrée porte une FABRIQUE (`() =>
 * decompteX(...)`), jamais la promesse elle-même — une promesse démarre dès
 * sa construction, donc l'appeler avant le filtre `chemins.has(...)`
 * exécutait la lecture même sous un rôle sans la porte correspondante.
 */
export async function decomptesParametrage(
  contexte: ContexteSession,
  portesOuvertes: readonly PorteParametrage[],
  fuseau: Fuseau,
  client?: PrismaClient,
): Promise<ReadonlyMap<string, Decompte>> {
  const chemins = new Set(portesOuvertes.map((porte) => porte.chemin));
  const { instant, local } = maintenant(fuseau);
  const debutDuJour = instantDuJour(jourDe(local));

  const definitions: ReadonlyArray<{
    readonly chemin: string;
    readonly lire: () => Promise<Decompte | undefined>;
  }> = [
    {
      chemin: "/parametres/trajets",
      lire: () => decompteTrajets(contexte, client),
    },
    {
      chemin: "/parametres/prestations",
      lire: () => decomptePrestations(contexte, client),
    },
    {
      chemin: "/parametres/agences",
      lire: () => decompteAgences(contexte, client),
    },
    {
      chemin: "/parametres/equipe",
      lire: () => decompteEquipe(contexte, client),
    },
    {
      chemin: "/parametres/habilitations",
      lire: () => decompteHabilitations(contexte, fuseau, client),
    },
    {
      chemin: "/parametres/materiel",
      lire: () => decompteMateriel(contexte),
    },
    {
      chemin: "/imports",
      lire: () => decompteImports(contexte, client),
    },
    {
      chemin: "/parametres/donnees",
      lire: () => decompteDonnees(contexte, debutDuJour, client),
    },
    {
      chemin: "/parametres/forfaits",
      lire: () => decompteForfaits(contexte, client),
    },
    {
      chemin: "/parametres/taux-horaire",
      lire: () => decompteTauxHoraire(contexte, instant, client),
    },
  ];

  const entrees = definitions
    .filter((definition) => chemins.has(definition.chemin))
    .map((definition) => ({
      chemin: definition.chemin,
      lecture: essayer(definition.lire),
    }));

  const resultats = await Promise.all(
    entrees.map(async (entree) => ({
      chemin: entree.chemin,
      decompte: await entree.lecture,
    })),
  );

  const decomptes = new Map<string, Decompte>();
  for (const { chemin, decompte } of resultats) {
    if (decompte !== undefined) {
      decomptes.set(chemin, decompte);
    }
  }
  return decomptes;
}
