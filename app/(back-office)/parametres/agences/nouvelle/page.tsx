import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * LA CRÉATION D'UNE AGENCE, ET DE SON CALENDRIER D'OUVERTURE (AGENCE-1).
 *
 * ## Le constat que cet écran ferme
 *
 * Aucun chemin de création n'existait hors du semis (`prisma/seed.ts`) : sur
 * une base de PRODUCTION neuve — sans semis, par construction (I9) —, aucun
 * établissement ne pouvait naître. Trois conséquences en cascade : l'import de
 * sites ne résout plus sa colonne de rattachement (`lib/imports/modeles.ts`),
 * le planning n'a aucun calendrier d'ouverture, et `pnpm feries:etendre` n'a
 * rien à étendre (D46).
 *
 * ## DEUX CHAMPS DISTINCTS, ET LEURS AIDES LE DISENT (D46)
 *
 * Le fuseau et le territoire ne se déduisent JAMAIS l'un de l'autre : le
 * fuseau dit quelle heure il est, le territoire dit quels jours sont fériés.
 * `Europe/Paris` couvre plusieurs territoires aux fériés différents — les
 * confondre romprait le gardien
 * `tests/unit/calendar/territoire-independant-du-fuseau.test.ts`.
 *
 * ## AUCUN HORAIRE PAR DÉFAUT N'EST PROPOSÉ
 *
 * Le §8 du CLAUDE.md interdit d'inventer une donnée d'exploitation. Le
 * calendrier créé avec l'établissement ne porte donc AUCUNE plage — il naît
 * fermé tous les jours —, et cet écran le dit avant la saisie plutôt que de
 * laisser la surprise pour après. Le réglage des horaires existe déjà
 * (`/parametres/agences/[id]`, l'écran de détail d'un calendrier) : cet écran
 * ne le refait pas, la création y renvoie directement.
 *
 * ## Le mot imposé se compose au point d'usage
 *
 * « Agence » ne s'écrit qu'à un seul endroit (`lib/i18n/vocabulaire.ts`,
 * L0-11) : les libellés composent donc `mot("agence")`, et les textes du
 * dictionnaire lui préfèrent « établissement » — la même convention que
 * `parametres.aucune_agence` et `calendrier.retour`.
 */
export default async function PageNouvelleAgence({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const motif = (await searchParams).motif;

  return (
    <Page
      chemin="/parametres/agences"
      titre={t("agence.creer")}
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

      <p className="border-app-bord bg-app-surface text-app-encre-faible rounded-md border px-3.5 py-2.5 text-[12.5px]">
        {t("agence.aide_calendrier_vide")}
      </p>

      <form
        method="post"
        action="/api/parametres/agences/creer"
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
      >
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("agence.code")}
          <input
            name="code"
            required
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
          <span className="text-app-encre-faible text-[11px] font-normal">
            {t("agence.code.aide")}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {mot("agence")}
          <input
            name="libelle"
            required
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("agence.territoire")}
          <input
            name="territoire"
            required
            maxLength={2}
            placeholder={t("agence.territoire.exemple")}
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
            placeholder={t("agence.fuseau_horaire.exemple")}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          />
          <span className="text-app-encre-faible text-[11px] font-normal">
            {t("agence.fuseau_horaire.aide")}
          </span>
        </label>

        <div>
          <ActionPrimaire>{t("agence.action.creer")}</ActionPrimaire>
        </div>
      </form>
    </Page>
  );
}
