import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n/fr";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";

import { lireBaremePortail } from "@/app/api/portail/tarifs/lecture";

import { baremeAffiche } from "./presentation";

export const metadata: Metadata = { title: t("portail.tarifs.titre") };

/**
 * LA GRILLE TARIFAIRE DU PORTAIL CLIENT (9J20-PORTAIL-GRILLE-TARIFAIRE,
 * CLI-7) — LE BARÈME, JAMAIS LE MONTANT D'UNE INTERVENTION PRÉCISE.
 *
 * **LA PORTE NE RÉSOUT AUCUN RATTACHEMENT**, à la différence des autres
 * écrans du portail : le barème ne dépend d'aucun client ni d'aucun site,
 * seulement de la société active sur la session — `societeId` suffit, et
 * `lireBaremePortail` (`app/api/portail/tarifs/lecture.ts`) ouvre sa propre
 * transaction qui ne pose QUE `app.societe_id` (architecture de la route
 * isolée, décision du pilote du 29/10/2026).
 *
 * **« Afficher les montants » (9I8) NE GOUVERNE PAS cet écran** — décision
 * d'Alexis du 29/10/2026, D232 : le réglage ne masque que la valorisation
 * d'une intervention précise (`accesAuxMontants`, D37, arbitrage 3.8), jamais
 * le barème.
 */
export default async function PageTarifsPortail() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  if (!estRolePortail(session.contexte.role)) {
    return (
      <Page
        chemin="/portail"
        entrees={ENTREES_PORTAIL}
        titre={t("portail.tarifs.titre")}
        sousTitre={t("portail.reserve")}
      />
    );
  }

  const bareme = baremeAffiche(
    await lireBaremePortail(session.contexte.societeId),
  );

  return (
    <Page
      chemin="/portail"
      entrees={ENTREES_PORTAIL}
      filAriane={[
        { libelle: t("portail.titre"), href: "/portail" },
        { libelle: t("portail.tarifs.titre") },
      ]}
      titre={t("portail.tarifs.titre")}
      sousTitre={t("portail.tarifs.sous_titre")}
    >
      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5 text-[13px] font-bold">
        <span>
          {t("portail.tarifs.taux_titre")}
          {t("ponctuation.deux_points")}
          {bareme.tauxHoraire}
        </span>
        <span>
          {t("portail.tarifs.majoration_titre")}
          {t("ponctuation.deux_points")}
          {bareme.majoration}
        </span>
        <span>
          {t("portail.tarifs.regle_titre")}
          {t("ponctuation.deux_points")}
          {bareme.regleFacturation}
        </span>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-extrabold tracking-tight">
          {t("portail.tarifs.forfaits_titre")}
        </h2>
        {bareme.forfaits.length === 0 ? (
          <p className="text-[13px] font-bold">
            {t("portail.tarifs.forfaits_vide")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bareme.forfaits.map((forfait) => (
              <li
                key={forfait.id}
                className="bg-app-surface border-app-bord flex flex-col gap-1 rounded-lg border px-4 py-3 text-[13px] font-bold"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span>{forfait.libelle}</span>
                  <span>{forfait.montant}</span>
                </div>
                <span className="text-app-encre-faible">
                  {forfait.categorie}
                  {t("ponctuation.deux_points")}
                  {forfait.conditions}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
