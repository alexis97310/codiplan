import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";
import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { ChampFichier } from "@/components/ui/champ-fichier";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { lireAfficherMontants } from "@/lib/societes/identite";
import { lireLogo } from "@/lib/societes/logo";

export const metadata: Metadata = { title: t("societe.logo_titre") };

/**
 * `/parametres/societe` — RÉOUVERT POUR LE SEUL BLOC LOGO (9EZ-LOGO-SOCIETE-1,
 * décision n° 87 d'Alexis, 13/10/2026). Amende D167 (QT-22, « Charte de la
 * société retirée jusqu'au lot 7 ») : la route redirigeait vers `/parametres`
 * — elle rend désormais ce bloc, et lui SEUL. Les couleurs de charte restent
 * fermées jusqu'au lot 7 ; ce qu'elles portaient (`/parametres/page.tsx`,
 * carte « Identité ») n'est pas touché par ce fichier.
 *
 * **Lecture ouverte par `exigerSessionActive`, écriture par
 * `parametrer_societe`** — même capacité que le reste du paramétrage, ADMS et
 * DIR seuls, aucun ○ (`lib/auth/habilitations.ts`). Un rôle sans cette
 * capacité reçoit `RefusAcces`, jamais le formulaire désactivé : il n'y a
 * rien à montrer à qui ne peut rien y faire.
 */
export default async function PageParametresSociete({
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

  if (
    session.contexte.role === null ||
    !peutPleinement(session.contexte.role, "parametrer_societe")
  ) {
    return (
      <Page chemin="/parametres/societe" titre={t("societe.logo_titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const contexte = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };
  const logo = await lireLogo(contexte);
  const afficherMontants = await lireAfficherMontants(contexte);
  const motif = (await searchParams).motif;

  return (
    <Page
      chemin="/parametres/societe"
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("societe.logo_titre") },
      ]}
      titre={t("societe.logo_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <Carte className="flex flex-col gap-4 p-4">
        {logo === null ? (
          <p className="text-app-encre-faible text-13 font-bold">
            {t("societe.logo_absent")}
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- octets servis par une route applicative, pas un fichier statique optimisable
          <img
            src={`/api/societe/logo?v=${logo.empreinte}`}
            alt={t("societe.logo_alt")}
            className="max-h-20 w-auto max-w-40 object-contain"
          />
        )}

        <form
          method="post"
          action="/api/parametres/societe/logo"
          encType="multipart/form-data"
          className="flex flex-col gap-2"
        >
          <span className="text-13 font-bold">{t("societe.logo_champ")}</span>
          <ChampFichier
            id="logo"
            nom="logo"
            accept="image/png,image/jpeg"
            required
          />
          <p className="text-app-encre-faible text-12 font-bold">
            {t("societe.logo_aide")}
          </p>
          <Button
            type="submit"
            variant="default"
            size="sm"
            className="self-start"
          >
            {t("societe.logo_enregistrer")}
          </Button>
        </form>

        {logo === null ? null : (
          <form
            method="post"
            action="/api/parametres/societe/logo/retirer"
            className="flex flex-col gap-2"
          >
            <BoutonAvecConfirmation
              libelle={t("societe.logo_retirer")}
              variant="outline"
              texteConfirmation={t("societe.logo_retirer_confirmation")}
              boutonConfirmer={t("societe.logo_retirer_confirmer")}
              boutonRevenir={t("societe.logo_retirer_revenir")}
            />
          </form>
        )}
      </Carte>

      <Carte className="flex flex-col gap-3 p-4">
        <h2 className="text-14 font-bold">{t("societe.montants_titre")}</h2>
        <form
          method="post"
          action="/api/parametres/societe/afficher-montants"
          className="flex flex-col gap-2"
        >
          <label className="flex items-center gap-1.5 text-13 font-bold">
            {/* LA SENTINELLE DÉCOCHÉE — même idiome que `site.sous_contrat`. */}
            <input type="hidden" name="afficher_montants" value="0" />
            <input
              type="checkbox"
              name="afficher_montants"
              value="1"
              defaultChecked={afficherMontants}
            />
            {t("societe.montants_case")}
          </label>
          <p className="text-app-encre-faible text-12 font-bold">
            {t("societe.montants_aide")}
          </p>
          <Button
            type="submit"
            variant="default"
            size="sm"
            className="self-start"
          >
            {t("societe.montants_enregistrer")}
          </Button>
        </form>
      </Carte>
    </Page>
  );
}
