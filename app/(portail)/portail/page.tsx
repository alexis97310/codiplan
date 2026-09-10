import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { obtenirSession } from "@/lib/auth/session";
import { estRolePortail } from "@/lib/auth/roles";
import { t } from "@/lib/i18n/fr";
import { parcDuClient, rattachementsDuCompte } from "@/lib/portail/depot";

import {
  emplacementDeLaMachine,
  libelleDuSite,
  placeDesDocuments,
  placeDuVgp,
  siteDeLaMachine,
  titreDesSites,
} from "./presentation";

/**
 * LE PORTAIL CLIENT — CONSULTATION SEULE (ticket L2-12, D92).
 *
 * ## Le mur qu'il fallait abattre avant de pouvoir l'écrire
 *
 * Un compte portail n'a **aucune** ligne dans `utilisateur_societe` (D10), et
 * `utilisateur_client` portait la forme « habilitation », ancrée sur
 * `app.societe_id`. *Mesuré le 11/09/2026 : identité seule → 0 ligne de
 * rattachement, `utilisateur_societe` du compte portail → 0.* **Aucun compte
 * portail n'atteignait aucun écran**, et rien ne le disait. D92 pose la dixième
 * forme de politique, « rattachement » ; cette page est ce qui la lit.
 *
 * ## TROIS FILTRES, ET AUCUN N'EST ÉCRIT ICI
 *
 * Société, client, périmètre de sites : c'est la forme « parc » qui les tient,
 * et `lib/portail/depot.ts` lit SOUS le contexte. Une comparaison écrite dans
 * cette page serait une seconde lecture d'un même critère (§9, 01/09) — verte
 * aujourd'hui, divergente demain, et permissive quand elle divergera.
 *
 * ## CONSULTATION SEULE, ET RIEN N'EST PRÉPARÉ POUR L'ÉCRITURE
 *
 * Aucun bouton « demander une intervention » : cette demande n'est pas
 * tranchée. Elle n'est pas non plus *préparée* — pas de table qui l'attendrait,
 * pas de champ mort. *Une place réservée pour une décision qu'on n'a pas prise
 * est une décision prise par personne (§9, 24/08).*
 *
 * ## L'EMPLACEMENT DES DOCUMENTS ET DU VGP EXISTE, SON CONTENU N'EST PAS INVENTÉ
 *
 * Les lots 8 (D87) et 9 (D88) ne sont pas construits. La place est tenue et
 * DITE VIDE — jamais remplie d'un zéro ni d'un « à jour » qui se liraient comme
 * des mesures (§9, 06/09). *« Sans information » n'est ni « à jour » ni « en
 * retard »*, et c'est exactement ce que D88 exige qu'on affiche.
 */
export default async function PagePortail() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  if (!estRolePortail(session.contexte.role)) {
    // Un rôle interne AVEC un client désigné est refusé par
    // `motifRefusContexte` (D70) : le portail n'est pas une vue de plus sur le
    // parc, c'est un régime de lecture distinct. On le dit plutôt que de
    // laisser la base lever.
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("portail.titre")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("portail.reserve")}</p>
      </main>
    );
  }

  // LA DÉSIGNATION DU CLIENT, ET POURQUOI ELLE VIENT D'ICI (D70).
  // L'appelant DÉSIGNE, la base DISPOSE : `app_poser_perimetre_client` refuse
  // la pose si ce client n'est pas parmi les rattachements du compte. On ne
  // désigne donc jamais une valeur reçue de l'extérieur — celle-ci vient de la
  // lecture que la politique de D92 vient de borner.
  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const surCetteSociete = rattachements.filter(
    (r) => r.societeId === session.contexte.societeId,
  );
  const premier = surCetteSociete[0];
  if (premier === undefined) {
    redirect("/arrivee");
  }

  const parc = await parcDuClient({
    ...session.contexte,
    clientId: premier.clientId,
  });

  const siteParId = new Map(parc.sites.map((site) => [site.id, site.libelle]));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("portail.titre")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("portail.sous_titre")}
        </p>
        {parc.raisonSociale === null ? null : (
          <p className="text-sm">
            <span className="text-muted-foreground">{t("portail.client")}</span>{" "}
            <span className="font-medium">{parc.raisonSociale}</span>
          </p>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{titreDesSites()}</h2>
        <p className="text-muted-foreground text-sm">
          {t("portail.perimetre")}
        </p>
        {parc.sites.length === 0 ? (
          <p className="text-sm">{t("portail.sans_lieu")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {parc.sites.map((site) => (
              <li
                key={site.id}
                className="border-input rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{libelleDuSite(site)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("portail.machines")}</h2>
        {parc.machines.length === 0 ? (
          <p className="text-sm">{t("portail.sans_machine")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {parc.machines.map((machine) => (
              <li
                key={machine.id}
                className="border-input flex flex-col gap-2 rounded-md border px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-medium">
                    {t("portail.machine.serie")} {machine.numeroSerie}
                  </span>
                  <span className="text-muted-foreground">
                    {siteDeLaMachine(machine, siteParId)}
                  </span>
                  {machine.localisation === null ? null : (
                    <span className="text-muted-foreground">
                      {emplacementDeLaMachine(machine)}
                    </span>
                  )}
                </div>
                {/* LES DEUX PLACES RÉSERVÉES. Elles disent qu'elles sont vides ;
                    elles n'affichent NI un compte de documents à zéro, NI un
                    état VGP « à jour ». Les deux se liraient comme des mesures
                    (§9, 06/09), et le second serait faux au sens de D88. */}
                <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                  <span>{placeDesDocuments()}</span>
                  <span>{placeDuVgp()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
