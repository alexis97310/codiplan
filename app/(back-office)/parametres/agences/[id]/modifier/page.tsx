import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { obtenirSession } from "@/lib/auth/session";
import { lireAgence } from "@/lib/agences/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

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
          className="text-app-encre-faible text-[12.5px]"
        >
          {t("agence.retour")}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {agence.calendrier_id === null ? null : (
        <p className="border-app-bord bg-app-surface text-app-encre-faible rounded-md border px-3.5 py-2.5 text-[12.5px]">
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
        <div className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("agence.code")}
          <p className="text-app-encre-faible text-[13px] font-normal">
            {agence.code}
          </p>
        </div>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {mot("agence")}
          <input
            name="libelle"
            required
            defaultValue={agence.libelle}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("agence.territoire")}
          <input
            name="territoire"
            required
            maxLength={2}
            defaultValue={agence.territoire}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal uppercase"
          />
          <span className="text-app-encre-faible text-[11px] font-normal">
            {t("agence.territoire.aide")}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("agence.fuseau_horaire")}
          <input
            name="fuseau_horaire"
            defaultValue={agence.fuseau_horaire ?? ""}
            placeholder={t("agence.fuseau_horaire.exemple")}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
          <span className="text-app-encre-faible text-[11px] font-normal">
            {t("agence.fuseau_horaire.aide")}
          </span>
        </label>

        <label className="flex items-center gap-2 text-[12.5px] font-semibold">
          <input
            type="checkbox"
            name="actif"
            value="true"
            defaultChecked={agence.actif}
          />
          {t("agence.actif")}
        </label>

        <div>
          <ActionPrimaire>{t("agence.action.modifier")}</ActionPrimaire>
        </div>
      </form>
    </Page>
  );
}
