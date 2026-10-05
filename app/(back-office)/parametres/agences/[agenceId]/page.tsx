import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { Page } from "@/components/mise-en-page/page";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { lireAgence } from "@/lib/agences/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import { fuseauxConnus, territoiresConnus } from "@/lib/calendar";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * LA FICHE D'UNE AGENCE — UNE SEULE ADRESSE POUR CETTE ENTITÉ (PA-29, QT-21,
 * D167, 05/10/2026, TP-NAV1).
 *
 * ## Le défaut que ce déplacement répare
 *
 * `/parametres/agences/[id]` désignait tour à tour un CALENDRIER (l'écran de
 * détail des horaires) et une AGENCE (cette fiche, alors sous `[id]/
 * modifier`) — deux entités, une même forme d'adresse, distinguées
 * uniquement par le dernier segment. Mesuré à l'audit du 28/09/2026 : une
 * adresse copiée ou modifiée à la main mène à « introuvable » sans qu'aucun
 * message ne dise pourquoi. L'agence a désormais SA propre adresse,
 * `/parametres/agences/[agenceId]` ; le calendrier a la sienne,
 * `/parametres/agences/calendrier/[id]`.
 *
 * ## `code` n'est pas de ce formulaire
 *
 * Voir l'en-tête de `lib/agences/saisie.ts` : c'est la clé qu'un import
 * résout, et un champ absent est un champ qu'on ne peut pas soumettre par
 * erreur. Il est affiché en lecture seule, pour qu'on sache toujours de quel
 * établissement il s'agit.
 *
 * **Aucune comparaison de société n'est écrite ici** : `lireAgence` lit sous
 * le contexte cloisonné, et un établissement hors périmètre rend `null`,
 * exactement comme un identifiant inconnu (D35, D50).
 *
 * **Un identifiant mal formé est un refus, jamais une panne** (DÉFAUT 2,
 * revue de #275) : un segment comme `pas-un-uuid` atteindrait `lireAgence`
 * tel quel, qui l'envoie dans un `WHERE "id" = $1::uuid` — PostgreSQL refuse
 * de le caster et lève, 500 au lieu d'un `notFound()`. Même correction que
 * `app/api/parametres/agences/[id]/modifier/route.ts` (et, avant lui,
 * `app/api/sites/[id]/modifier/route.ts`, mesuré le 11/09/2026) : le contrôle
 * de forme précède la lecture, et un identifiant mal formé rend LA MÊME chose
 * qu'un identifiant inconnu — les distinguer ferait un oracle (D35, D50).
 *
 * **Le calendrier ne se règle pas ici** — le réglage des horaires existe déjà
 * (`/parametres/agences/calendrier/[id]`), et cette fiche y renvoie plutôt que
 * de le refaire.
 *
 * ## PA-35 — territoire et fuseau se CHOISISSENT, ils ne s'écrivent plus
 *
 * Deux listes, jamais de saisie libre : les territoires présents dans
 * `jour_ferie` (`territoiresConnus`), les fuseaux connus du moteur
 * (`Intl.supportedValuesOf("timeZone")`). La valeur courante de l'agence
 * reste présélectionnée — ce n'est pas une valeur par défaut inventée, c'est
 * la valeur qu'elle porte déjà.
 */

const sessionCache = cache(async () => obtenirSession(await headers()));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agenceId: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (session === null || session.contexte.societeId === null) {
    return { title: mot("agence") };
  }
  const { agenceId } = await params;
  if (!z.uuid().safeParse(agenceId).success) {
    return { title: mot("agence") };
  }
  const agence = await lireAgence(session.contexte, agenceId);
  return {
    title: agence === null ? mot("agence") : titreDeLAgence(agence.libelle),
  };
}

export default async function PageAgence({
  params,
  searchParams,
}: {
  params: Promise<{ agenceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await sessionCache();
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // D153 (03/10/2026, TP-S3) — cet écran est ENTIÈREMENT le formulaire que
  // la route (`administrer_agences`, aucun ○) accepterait ou refuserait.
  if (
    session.contexte.role === null ||
    !peut(session.contexte.role, "administrer_agences")
  ) {
    return (
      <Page chemin="/parametres/agences" titre={mot("agence")}>
        <RefusAcces />
      </Page>
    );
  }

  const { agenceId } = await params;
  if (!z.uuid().safeParse(agenceId).success) {
    notFound();
  }
  const agence = await lireAgence(session.contexte, agenceId);
  if (agence === null) {
    notFound();
  }

  const territoires = await avecContexteApplicatif(session.contexte, (tx) =>
    territoiresConnus(tx),
  );
  const fuseaux = fuseauxConnus();

  const motif = (await searchParams).motif;

  return (
    <Page
      chemin="/parametres/agences"
      titre={titreDeLAgence(agence.libelle)}
      // FIL D'ARIANE (9DR-TP-NAV2-RETOURS-FIL, D168) — remplace l'ancien
      // retour nu `agence.retour` (toujours vivant sur `agences/nouvelle`).
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("parametres.titre"), href: "/parametres/agences" },
        { libelle: agence.libelle },
      ]}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>{t(motif)}</BandeauMotif>
      ) : null}

      {agence.calendrier_id === null ? null : (
        <p className="border-app-bord bg-app-surface text-app-encre-faible rounded-md border px-3.5 py-2.5 text-13 font-bold">
          {t("agence.lien_calendrier_aide")}{" "}
          <Link
            href={`/parametres/agences/calendrier/${agence.calendrier_id}`}
            className="text-app-marque underline underline-offset-2"
          >
            {t("parametres.regler_horaires")}
          </Link>
        </p>
      )}

      <form
        method="post"
        action={`/api/parametres/agences/${agence.id}/modifier`}
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
      >
        <div className="flex flex-col gap-1 text-13 font-bold">
          {t("agence.code")}
          <p className="text-app-encre-faible text-[13px] font-bold">
            {agence.code}
          </p>
        </div>

        <label className="flex flex-col gap-1 text-13 font-bold">
          {mot("agence")}
          <input
            name="libelle"
            required
            defaultValue={agence.libelle}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>

        <label className="flex flex-col gap-1 text-13 font-bold">
          {t("agence.territoire")}
          <select
            name="territoire"
            required
            defaultValue={agence.territoire}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          >
            {territoires.map((territoire) => (
              <option key={territoire} value={territoire}>
                {territoire}
              </option>
            ))}
          </select>
          <span className="text-app-encre-faible text-12 font-bold">
            {t("agence.territoire.aide")}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-13 font-bold">
          {t("agence.fuseau_horaire")}
          <select
            name="fuseau_horaire"
            defaultValue={agence.fuseau_horaire ?? ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          >
            <option value="">{t("agence.fuseau_horaire.herite")}</option>
            {fuseaux.map((fuseau) => (
              <option key={fuseau} value={fuseau}>
                {fuseau}
              </option>
            ))}
          </select>
          <span className="text-app-encre-faible text-12 font-bold">
            {t("agence.fuseau_horaire.aide")}
          </span>
        </label>

        <CaseACocher
          name="actif"
          value="true"
          defaultChecked={agence.actif}
          libelle={t("agence.actif")}
          className="flex items-center gap-2 text-13 font-bold"
        />

        <div>
          <ActionPrimaire>{t("agence.action.modifier")}</ActionPrimaire>
        </div>
      </form>
    </Page>
  );
}

/** Le titre de la fiche — le mot imposé, composé, jamais recopié (D5, D47). */
function titreDeLAgence(libelle: string): string {
  return `${mot("agence")} ${libelle}`;
}
