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
    /*
      ── DEUX ÉCARTS FERMÉS LE 12/09/2026, ET C'EST L'ÉCRAN LE PLUS VU DEHORS ──

      **La largeur.** Ce `main` portait `mx-auto max-w-5xl px-6 py-10`, et il
      ANNULAIT la largeur utile que la mise en page du segment lui donne déjà
      (1400 px, D95). *Mesuré avant D95 : cinq écrans, cinq largeurs, aucune
      celle de la maquette* — et celui-ci en était une sixième, posée après. Le
      cadre appartient à `LargeurUtile` ; cet écran ne fait plus que remplir.

      **La typographie.** Elle venait des jetons shadcn — `text-muted-foreground`,
      `border-input`, `text-2xl`, `text-sm` —, et non de la charte du produit.
      *Un écran nomme un RÔLE de l'apparence, jamais une couleur ni une échelle
      étrangère* : les autres écrans lisent `text-app-encre-faible`,
      `border-app-bord`, `bg-app-surface`. Le client voyait donc un produit
      qui ne ressemblait pas au reste du produit.
    */
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("portail.titre")}
        </h1>
        <p className="text-app-encre-faible max-w-[70ch] text-[13px]">
          {t("portail.sous_titre")}
        </p>
        {parc.raisonSociale === null ? null : (
          <p className="text-[13px]">
            <span className="text-app-encre-faible">{t("portail.client")}</span>{" "}
            <span className="font-bold">{parc.raisonSociale}</span>
          </p>
        )}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-extrabold tracking-tight">
          {titreDesSites()}
        </h2>
        <p className="text-app-encre-faible text-[12.5px]">
          {t("portail.perimetre")}
        </p>
        {parc.sites.length === 0 ? (
          <p className="text-[13px]">{t("portail.sans_lieu")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {parc.sites.map((site) => (
              <li
                key={site.id}
                className="bg-app-surface border-app-bord rounded-[10px] border px-4 py-2.5 text-[13px]"
              >
                <span className="font-bold">{libelleDuSite(site)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-extrabold tracking-tight">
          {t("portail.machines")}
        </h2>
        {parc.machines.length === 0 ? (
          <p className="text-[13px]">{t("portail.sans_machine")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {parc.machines.map((machine) => (
              <li
                key={machine.id}
                className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-[10px] border px-4 py-3 text-[13px]"
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-bold">
                    {t("portail.machine.serie")} {machine.numeroSerie}
                  </span>
                  <span className="text-app-encre-faible">
                    {siteDeLaMachine(machine, siteParId)}
                  </span>
                  {machine.localisation === null ? null : (
                    <span className="text-app-encre-faible">
                      {emplacementDeLaMachine(machine)}
                    </span>
                  )}
                </div>
                {/* LES DEUX PLACES RÉSERVÉES. Elles disent qu'elles sont vides ;
                    elles n'affichent NI un compte de documents à zéro, NI un
                    état VGP « à jour ». Les deux se liraient comme des mesures
                    (§9, 06/09), et le second serait faux au sens de D88. */}
                <div className="text-app-encre-faible flex flex-col gap-1 text-[11.5px]">
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
