import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { formatMoney, lireDevise, montant } from "@/lib/money";
import { forfaitApplicable } from "@/lib/tarification/forfaits";

/**
 * LE PARC D'UN CLIENT — ses sites, leur rattachement, leur trajet, leur
 * forfait, leurs machines (ticket L2-12).
 *
 * **Une seule lecture cloisonnée, et aucun filtre société écrit ici.** `client`,
 * `site` et `machine` portent la forme « parc » : la société, le client et le
 * périmètre de sites mordent en base. Un compte portail restreint à un atelier
 * ne verra donc qu'un site — sans qu'aucune ligne de ce module ne change.
 *
 * **Le trajet ne voyage jamais seul** (D56). `site.temps_trajet_min` est un
 * nombre dont la signification dépend d'une autre colonne : il se compte
 * DEPUIS l'agence de rattachement du site. Ce module rend donc toujours les
 * deux ensemble, et l'écran les affiche ensemble.
 *
 * **Le forfait est CALCULÉ, jamais recopié.** RG-TAR-06 vit dans
 * `lib/tarification/forfaits.ts` ; ce module lui passe la zone du site et rend
 * ce qu'elle répond. Recopier la règle ici en ferait une seconde lecture d'un
 * même critère, qui diverge en silence.
 */

/** Un site, avec ce qui ne se comprend qu'à côté de lui. */
export type SiteDuParc = {
  readonly id: string;
  readonly libelle: string;
  readonly commune: string | null;
  readonly zone: string | null;
  /** L'agence de rattachement — le référentiel du trajet (D56). */
  readonly agence: string;
  /** Minutes de trajet DEPUIS cette agence. `null` = non renseigné. */
  readonly trajetMinutes: number | null;
  /** Nombre de machines installées sur ce site. */
  readonly machines: number;
  /** Les forfaits dont les conditions sont remplies pour ce site. */
  readonly forfaits: readonly ForfaitApplicable[];
};

/** Un forfait qui s'applique, et son montant déjà formaté (I3). */
export type ForfaitApplicable = {
  readonly code: string;
  readonly libelle: string;
  /** Formaté par `formatMoney` : la devise décide des décimales (I3). */
  readonly montant: string;
};

/** Un client, et son parc. */
export type ClientDuParc = {
  readonly id: string;
  readonly raisonSociale: string;
  readonly codeExterne: string | null;
  readonly sites: readonly SiteDuParc[];
  readonly machines: number;
};

/** Le libellé du code externe, paramétrable par société (D29). */
export type Parc = {
  readonly libelleCodeExterne: string;
  readonly clients: readonly ClientDuParc[];
};

export async function lireLeParc(contexte: ContexteSession): Promise<Parc> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      select: {
        libelle_code_externe: true,
        devise: {
          select: {
            code: true,
            libelle: true,
            decimales: true,
            symbole: true,
          },
        },
      },
    });

    const devise = lireDevise(societe?.devise ?? null);

    const forfaits = await tx.forfait.findMany({
      where: { actif: true },
      select: {
        code: true,
        libelle: true,
        montant_mineur: true,
        zone_geo: true,
        famille_id: true,
        type_intervention: true,
      },
      orderBy: { code: "asc" },
    });

    const clients = await tx.client.findMany({
      where: { actif: true },
      select: {
        id: true,
        raison_sociale: true,
        code_externe: true,
        sites: {
          where: { actif: true },
          select: {
            id: true,
            libelle: true,
            commune: true,
            zone_geo: true,
            temps_trajet_min: true,
            agence: { select: { libelle: true } },
            _count: { select: { machines: true } },
          },
          orderBy: { libelle: "asc" },
        },
        _count: { select: { machines: true } },
      },
      orderBy: { raison_sociale: "asc" },
    });

    return {
      libelleCodeExterne: societe?.libelle_code_externe ?? "",
      clients: clients.map((client) => ({
        id: client.id,
        raisonSociale: client.raison_sociale,
        codeExterne: client.code_externe,
        machines: client._count.machines,
        sites: client.sites.map((site) => ({
          id: site.id,
          libelle: site.libelle,
          commune: site.commune,
          zone: site.zone_geo,
          agence: site.agence.libelle,
          trajetMinutes: site.temps_trajet_min,
          machines: site._count.machines,
          forfaits: forfaits
            .filter((forfait) =>
              forfaitApplicable(
                {
                  zone_geo:
                    forfait.zone_geo.length === 0 ? null : forfait.zone_geo,
                  famille_id: forfait.famille_id,
                  // L'axe « type d'intervention » est INERTE ici, et
                  // délibérément : un site n'a pas de type d'intervention. Le
                  // passer à `null` face à une condition posée écarte le
                  // forfait — c'est le sens de RG-TAR-06, une condition qu'on
                  // ne peut pas vérifier n'est pas remplie.
                  type_intervention:
                    forfait.type_intervention.length === 0
                      ? null
                      : forfait.type_intervention,
                },
                {
                  zone: site.zone_geo,
                  familleId: null,
                  typeIntervention: null,
                },
              ),
            )
            .map((forfait) => ({
              code: forfait.code,
              libelle: forfait.libelle,
              // `formatMoney` est le POINT DE PASSAGE UNIQUE (I3) : c'est la
              // devise qui porte les décimales, et un `toFixed(2)` écrit ici
              // rendrait « 12 500,00 F » pour du franc Pacifique.
              montant: formatMoney(
                montant(forfait.montant_mineur, devise.code),
                devise,
              ),
            })),
        })),
      })),
    };
  });
}
