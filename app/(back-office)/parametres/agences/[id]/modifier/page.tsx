import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { Page } from "@/components/mise-en-page/page";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { CaseACocher } from "@/components/ui/case-a-cocher";
import { obtenirSession } from "@/lib/auth/session";
import { lireAgence } from "@/lib/agences/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

export const metadata: Metadata = { title: t("agence.modifier.titre") };

/**
 * MODIFIER UNE AGENCE (AGENCE-1).
 *
 * **`code` n'est pas de ce formulaire** — voir l'en-tête de
 * `lib/agences/saisie.ts` : c'est la clé qu'un import résout, et un champ
 * absent est un champ qu'on ne peut pas soumettre par erreur. Il est affiché
 * en lecture seule, pour qu'on sache toujours de quel établissement il s'agit.
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
 * **Le calendrier ne se règle pas ici** — voir l'en-tête de la consigne
 * AGENCE-1 : le réglage des horaires existe déjà
 * (`/parametres/agences/[id]`, l'écran de détail d'un calendrier), et cette
 * fiche y renvoie plutôt que de le refaire.
 */
export default async function PageModifierAgence({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const agence = await lireAgence(session.contexte, id);
  if (agence === null) {
    notFound();
  }

  const motif = (await searchParams).motif;

  return (
    <Page
      chemin="/parametres/agences"
      titre={t("agence.modifier.titre")}
      actions={
        <Link
          href="/parametres/agences"
          className="text-app-encre-faible text-13 font-bold"
        >
          {t("agence.retour")}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>{t(motif)}</BandeauMotif>
      ) : null}

      {agence.calendrier_id === null ? null : (
        <p className="border-app-bord bg-app-surface text-app-encre-faible rounded-md border px-3.5 py-2.5 text-13 font-bold">
          {t("agence.lien_calendrier_aide")}{" "}
          <Link
            href={`/parametres/agences/${agence.calendrier_id}`}
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
          <input
            name="territoire"
            required
            maxLength={2}
            defaultValue={agence.territoire}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold uppercase"
          />
          <span className="text-app-encre-faible text-12 font-bold">
            {t("agence.territoire.aide")}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-13 font-bold">
          {t("agence.fuseau_horaire")}
          <input
            name="fuseau_horaire"
            defaultValue={agence.fuseau_horaire ?? ""}
            placeholder={t("agence.fuseau_horaire.exemple")}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
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
