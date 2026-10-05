import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Carte } from "@/components/ui/carte";
import { Kpi } from "@/components/ui/kpi";
import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  bornesDuMois,
  jourDe,
  maintenant,
  moisDecale,
  schemaFuseau,
  type MoisLocal,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { compterInterventions } from "@/lib/interventions/depot";
import {
  TYPES_INTERVENTION,
  schemaRechercheInterventions,
  type TypeIntervention,
} from "@/lib/interventions/saisie";
import { compterLeParc } from "@/lib/machines/depot";
import {
  SOURCES_CREATION_MACHINE,
  schemaRechercheParc,
  type OrigineMachine,
} from "@/lib/machines/saisie";

export const metadata: Metadata = { title: t("indicateurs.titre") };

/**
 * LES INDICATEURS DU MOIS — DES DÉCOMPTES, JAMAIS UN VERDICT (9DT-TP-MOD2-
 * INDICATEURS-DONNEES, QT-20, D170).
 *
 * ## CE QU'ELLE RÉPARE
 *
 * L'audit du 28/09 (QT-20) et la décision du pilote du 03/10 : une page qui
 * dit « combien », ce mois-ci et le mois dernier, SANS jamais sommer une
 * heure ni un montant — ce calcul-là reste le travail d'un autre lot, jamais
 * improvisé ici. **Chaque chiffre vient de la MÊME requête que la liste
 * qu'il ouvre** (§9, 01/09) : `compterInterventions`/`compterLeParc`, les
 * MÊMES fonctions que les registres eux-mêmes, jamais un second calcul qui
 * pourrait diverger.
 *
 * ## « PAR NATURE », PRÉCISÉ (CHOIX DU PILOTE, D170)
 *
 * Le ticket demande les planifiées et les clôturées « par nature » — la
 * seule notion de « nature » que le schéma connaît est `Intervention.type`
 * (neuf valeurs closes, `TYPES_INTERVENTION`). Une tuile par nature,
 * jamais un regroupement inventé. Les créées, elles, n'ont PAS cette
 * précision dans le ticket : un seul total.
 *
 * ## LE SÉLECTEUR DE MOIS EST UN BASCULEMENT, PAS UN CALENDRIER
 *
 * Le ticket ferme le choix à deux valeurs — « mois en cours » et « mois
 * précédent » — et `?mois=precedent` est la seule valeur reconnue au-delà du
 * défaut : une URL qui porte autre chose retombe sur le mois en cours,
 * jamais une erreur.
 *
 * ## LES BORNES SONT CELLES DE LA SOCIÉTÉ, JAMAIS DE L'APPAREIL (L0-08)
 *
 * `bornesDuMois` part du jour civil `maintenant(fuseau)` — le fuseau de la
 * société, lu en base, jamais un littéral.
 */
export default async function PageIndicateurs({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  // LA PAGE EST FERMÉE AU TECHNICIEN (QT-20) — même garde, au niveau
  // complet, que `/tableau-de-bord` et `/interventions`.
  if (
    contexte.role === null ||
    !peutPleinement(contexte.role, "consulter_planning")
  ) {
    return (
      <Page chemin="/indicateurs" titre={t("indicateurs.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const moisActuel: MoisLocal = jourDe(maintenant(fuseau).local);

  const params = await searchParams;
  const moisChoisi = params.mois === "precedent" ? "precedent" : "actuel";
  const mois: MoisLocal =
    moisChoisi === "precedent" ? moisDecale(moisActuel, -1) : moisActuel;
  const { debut, finIncluse } = bornesDuMois(mois);

  const baseInterventions = schemaRechercheInterventions.parse({});
  const baseParc = schemaRechercheParc.parse({});

  const [planifiees, creees, cloturees, machines] = await Promise.all([
    Promise.all(
      TYPES_INTERVENTION.map((type) =>
        compterInterventions(contexte, {
          ...baseInterventions,
          type,
          du: debut,
          au: finIncluse,
        }),
      ),
    ),
    compterInterventions(contexte, {
      ...baseInterventions,
      cree_du: debut,
      cree_au: finIncluse,
    }),
    Promise.all(
      TYPES_INTERVENTION.map((type) =>
        compterInterventions(contexte, {
          ...baseInterventions,
          type,
          cloturee_du: debut,
          cloturee_au: finIncluse,
        }),
      ),
    ),
    Promise.all(
      SOURCES_CREATION_MACHINE.map((origine) =>
        compterLeParc(contexte, {
          ...baseParc,
          origine,
          ajoutee_du: debut,
          ajoutee_au: finIncluse,
        }),
      ),
    ),
  ]);

  return (
    <Page
      chemin="/indicateurs"
      titre={t("indicateurs.titre")}
      sousTitre={t("indicateurs.sous_titre")}
      actions={<SelecteurDeMois moisChoisi={moisChoisi} />}
    >
      <Carte titre={t("indicateurs.section_planifiees")}>
        <div className="grid gap-3 p-[16px] sm:grid-cols-2 lg:grid-cols-3">
          {TYPES_INTERVENTION.map((type, index) => (
            <Kpi
              key={type}
              libelle={t(`type_intervention.${type}`)}
              valeur={planifiees[index]}
              href={hrefInterventions({ type, du: debut, au: finIncluse })}
            />
          ))}
        </div>
      </Carte>

      <Carte titre={t("indicateurs.section_creees")}>
        <div className="grid gap-3 p-[16px] sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            libelle={t("indicateurs.kpi_creees")}
            valeur={creees}
            href={hrefInterventions({ cree_du: debut, cree_au: finIncluse })}
          />
        </div>
      </Carte>

      <Carte titre={t("indicateurs.section_cloturees")}>
        <div className="grid gap-3 p-[16px] sm:grid-cols-2 lg:grid-cols-3">
          {TYPES_INTERVENTION.map((type, index) => (
            <Kpi
              key={type}
              libelle={t(`type_intervention.${type}`)}
              valeur={cloturees[index]}
              href={hrefInterventions({
                type,
                cloturee_du: debut,
                cloturee_au: finIncluse,
              })}
            />
          ))}
        </div>
      </Carte>

      <Carte titre={t("indicateurs.section_machines")}>
        <div className="grid gap-3 p-[16px] sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES_CREATION_MACHINE.map((origine, index) => (
            <Kpi
              key={origine}
              libelle={t(`source_creation.${origine}`)}
              valeur={machines[index]}
              href={hrefParc({ origine, du: debut, au: finIncluse })}
            />
          ))}
        </div>
      </Carte>
    </Page>
  );
}

function SelecteurDeMois({
  moisChoisi,
}: {
  readonly moisChoisi: "actuel" | "precedent";
}) {
  return (
    <div className="flex items-center gap-2 text-13 font-bold">
      <LienDeMois
        href="/indicateurs"
        actif={moisChoisi === "actuel"}
        libelle={t("indicateurs.mois_actuel")}
      />
      <LienDeMois
        href="/indicateurs?mois=precedent"
        actif={moisChoisi === "precedent"}
        libelle={t("indicateurs.mois_precedent")}
      />
    </div>
  );
}

function LienDeMois({
  href,
  actif,
  libelle,
}: {
  readonly href: string;
  readonly actif: boolean;
  readonly libelle: string;
}) {
  if (actif) {
    return (
      <span
        aria-current="page"
        className="bg-app-marque text-app-marque-encre rounded-[9px] px-3 py-1.5"
      >
        {libelle}
      </span>
    );
  }
  return (
    <a href={href} className="border-app-bord rounded-[9px] border px-3 py-1.5">
      {libelle}
    </a>
  );
}

/**
 * LE LIEN VERS LE REGISTRE, POSANT EXACTEMENT LE CRITÈRE COMPTÉ (D170) —
 * jamais le registre nu : `type`, les bornes de création ou de clôture
 * suivent le MÊME paramètre que `schemaRechercheInterventions`
 * (`lib/interventions/saisie.ts`).
 */
function hrefInterventions(criteres: {
  readonly type?: TypeIntervention;
  readonly du?: Date;
  readonly au?: Date;
  readonly cree_du?: Date;
  readonly cree_au?: Date;
  readonly cloturee_du?: Date;
  readonly cloturee_au?: Date;
}): string {
  const params = new URLSearchParams();
  if (criteres.type !== undefined) params.set("type", criteres.type);
  if (criteres.du !== undefined) params.set("du", criteres.du.toISOString());
  if (criteres.au !== undefined) params.set("au", criteres.au.toISOString());
  if (criteres.cree_du !== undefined)
    params.set("cree_du", criteres.cree_du.toISOString());
  if (criteres.cree_au !== undefined)
    params.set("cree_au", criteres.cree_au.toISOString());
  if (criteres.cloturee_du !== undefined)
    params.set("cloturee_du", criteres.cloturee_du.toISOString());
  if (criteres.cloturee_au !== undefined)
    params.set("cloturee_au", criteres.cloturee_au.toISOString());
  return `/interventions?${params.toString()}`;
}

/** Le même geste que `hrefInterventions`, pour le parc (D170). */
function hrefParc(criteres: {
  readonly origine: OrigineMachine;
  readonly du: Date;
  readonly au: Date;
}): string {
  const params = new URLSearchParams({
    origine: criteres.origine,
    ajoutee_du: criteres.du.toISOString(),
    ajoutee_au: criteres.au.toISOString(),
  });
  return `/parc?${params.toString()}`;
}
