import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { Page } from "@/components/mise-en-page/page";
import { FormulaireForfait } from "@/components/forfaits/formulaire";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import type { ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estUuid } from "@/lib/identifiant";
import { estCleTraduction, t } from "@/lib/i18n/fr";

/**
 * LA FICHE D'UN FORFAIT — le seul endroit où on le MODIFIE (R2-20).
 *
 * ## Aucune comparaison de société n'est écrite ici
 *
 * La lecture se fait SOUS le contexte cloisonné, et la forme « société » de
 * `forfait` décide. Un forfait d'une autre société et un forfait inexistant
 * rendent donc **la même chose** — les distinguer ferait un oracle (D35, D50).
 *
 * ## LE FORMULAIRE EST CELUI DE LA CRÉATION, et c'est délibéré
 *
 * `FormulaireForfait` est écrit une fois et rendu deux. *Deux formulaires
 * auraient porté les mêmes champs deux fois, et la divergence se serait vue au
 * pire moment : un champ accepté ici et refusé là, sans que rien ne le dise*
 * (§9, 01/09).
 *
 * ## CE QUE CET ÉCRAN NE PROPOSE PAS : supprimer
 *
 * Une intervention désigne son forfait, et *une facture émise sous un forfait
 * disparu ne s'explique plus*. Le catalogue porte donc une bascule
 * d'activité — elle retire du CHOIX sans toucher au passé — et aucun bouton de
 * suppression n'existe nulle part.
 */

/**
 * LA MÊME LECTURE, FACTORISÉE POUR ÊTRE MÉMOÏSÉE (VISUEL-1, 23/09/2026) —
 * cette fiche n'a pas de dépôt dédié comme `lireClient` ou `lireSite`, sa
 * requête vivait directement dans le composant. `cache()` exige une fonction
 * stable, appelée à l'identique par `generateMetadata` et par la page.
 */
const lireForfaitCache = cache(async (contexte: ContexteSession, id: string) =>
  avecContexteApplicatif(contexte, (tx) =>
    tx.forfait.findFirst({
      where: { id },
      select: {
        id: true,
        code: true,
        libelle: true,
        type: true,
        rang: true,
        montant_mineur: true,
        zone_geo: true,
        cumulable_temps: true,
        actif: true,
      },
    }),
  ),
);

/**
 * LA DEVISE DE LA SOCIÉTÉ — même lecture que `forfaits/page.tsx`, pour que le
 * libellé du champ « Montant » s'adapte ici aussi (audit GR, M2).
 */
const lireDeviseCache = cache(async (contexte: ContexteSession) =>
  avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      select: {
        devise: { select: { code: true, decimales: true, symbole: true } },
      },
    }),
  ),
);

/** MÊME MÉMOÏSATION, POUR LA SESSION — voir `clients/[id]/page.tsx`. */
const sessionCache = cache(async () => obtenirSession(await headers()));

/** LE TITRE D'ONGLET PORTE LE NOM DU FORFAIT (VISUEL-1). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (session === null || session.contexte.societeId === null) {
    return { title: t("forfaits.titre") };
  }
  const { id } = await params;
  if (!estUuid(id)) {
    return { title: t("forfaits.titre") };
  }
  const forfait = await lireForfaitCache(session.contexte, id);
  return { title: forfait?.libelle ?? t("forfaits.titre") };
}

export default async function PageForfait({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await sessionCache();
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // LA FICHE D'UN FORFAIT EST UN TARIF (QT-2, D152, choix 6) — même garde que
  // `/parametres/forfaits`.
  const peutLire =
    session.contexte.role !== null &&
    (peut(session.contexte.role, "parametrer_societe") ||
      peut(session.contexte.role, "voir_montants_vente"));
  if (!peutLire) {
    return (
      <Page chemin="/parametres/forfaits" titre={t("forfaits.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const { id } = await params;
  const motif = (await searchParams).motif;

  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE
  // (9EJ-CORRECTIFS-AUDIT-TUILES-ID) — même garde que `clients/[id]`.
  if (!estUuid(id)) {
    notFound();
  }
  const forfait = await lireForfaitCache(session.contexte, id);
  if (forfait === null) {
    notFound();
  }
  const societe = await lireDeviseCache(session.contexte);
  const devise = societe?.devise ?? null;

  return (
    <Page
      chemin="/parametres/forfaits"
      titre={forfait.libelle}
      sousTitre={forfait.code}
      actions={
        <Link
          href="/parametres/forfaits"
          className="text-app-encre-faible text-13 font-bold"
        >
          {t("forfaits.retour")}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <FormulaireForfait
        action={`/api/parametres/forfaits/${forfait.id}/modifier`}
        devise={devise}
        defauts={{
          code: forfait.code,
          libelle: forfait.libelle,
          type: forfait.type,
          rang: forfait.rang,
          // Le montant est un entier d'unités mineures (I3) : il voyage en
          // chaîne jusqu'au champ, aucun format n'étant appliqué à une saisie.
          montant_mineur: String(forfait.montant_mineur),
          zone_geo: forfait.zone_geo,
          cumulable_temps: forfait.cumulable_temps,
          actif: forfait.actif,
        }}
      />

      <p className="text-app-encre-faible text-12 font-bold">
        {t("forfaits.desactiver_explication")}
      </p>
    </Page>
  );
}
