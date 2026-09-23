import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import { estRolePortail } from "@/lib/auth/roles";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { parcDuClient, rattachementsDuCompte } from "@/lib/portail/depot";

import {
  emplacementDeLaMachine,
  libelleDuSite,
  placeDesDocuments,
  placeDuVgp,
  siteDeLaMachine,
  titreDesSites,
} from "./presentation";

export const metadata: Metadata = { title: t("portail.titre") };

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
      <Page
        chemin="/portail"
        entrees={ENTREES_PORTAIL}
        titre={t("portail.titre")}
        sousTitre={t("portail.reserve")}
      />
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
    <Page
      chemin="/portail"
      entrees={ENTREES_PORTAIL}
      titre={t("portail.titre")}
      sousTitre={t("portail.sous_titre")}
    >
      {/*
        LE BANDEAU DE LA MAQUETTE — `.pcli` : dégradé à 120°, encre blanche,
        22/24 de marge intérieure ; le nom en 19 px extra-gras, la ligne
        dessous à 85 % d'opacité en 13 px. **LE DÉGRADÉ NE PORTE AUCUNE
        COULEUR NOUVELLE** : la maquette va de `--bleu` à `#00376e` ; ici il va
        de `--app-marque` à `--app-bleu-encre`, qui EST le bleu sombre de la
        charte. *Un écran nomme un rôle, jamais une couleur* — et la seconde
        apparence le repeint sans que cette ligne bouge.

        LE RAYON N'EST PLUS LE `10` PROPRE DE `.pcli` (D124) : `rounded-lg`
        lit `--radius`, le jeton commun à toute carte de l'application depuis
        que `codiplan-maquette-complete.html` en fait foi — ce bandeau suit
        désormais la même valeur que le reste de l'écran plutôt qu'une mesure
        isolée sur sa propre règle.
      */}
      {parc.raisonSociale === null ? null : (
        <div
          className="text-app-marque-encre rounded-lg px-6 py-[22px]"
          style={{
            backgroundImage:
              "linear-gradient(120deg, var(--app-marque), var(--app-bleu-encre))",
          }}
        >
          <p className="text-[19px] font-extrabold">{parc.raisonSociale}</p>
          <p className="text-[13px] opacity-85">
            {t("portail.bandeau.espace")}
          </p>
        </div>
      )}

      {/*
        LES QUATRE INDICATEURS DE LA MAQUETTE — et DEUX D'ENTRE EUX SONT VIDES,
        nommément.

        La maquette en montre quatre : machines, machine à l'arrêt, prochaine
        visite, interventions de l'année. **Le portail ne lit que le PARC** —
        `parcDuClient` rend des sites et des machines, et rien d'autre : ni
        intervention, ni créneau. *Mesuré au type qu'il rend, pas supposé.*

        **Les deux qu'on ne sait pas mesurer affichent « — » et DISENT pourquoi,
        au lieu d'un zéro.** Un zéro se lit comme une mesure : « aucune machine à
        l'arrêt » est une affirmation, et elle serait fausse. *« Sans
        information » n'est ni « à jour » ni « en retard »* (D88, doctrine §3) —
        c'est la même règle que le registre VGP applique une page plus loin.

        **Et ce n'est PAS une place réservée** : rien n'est préparé en base ni
        en type pour les recevoir. Le jour où le portail lira les interventions,
        ces deux cartes recevront une valeur ; d'ici là elles disent ce qu'elles
        ne savent pas.
      */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Chiffre
          libelle={t("portail.chiffre.machines")}
          valeur={String(parc.machines.length)}
          detail={t("portail.chiffre.machines_detail")}
          filet="bleu"
        />
        <Chiffre
          libelle={t("portail.chiffre.lieux")}
          valeur={String(parc.sites.length)}
          detail={t("portail.chiffre.lieux_detail")}
          filet="bleu"
        />
        <Chiffre
          libelle={t("portail.chiffre.arret")}
          valeur={t("portail.chiffre.sans_mesure")}
          detail={t("portail.chiffre.arret_detail")}
          filet="gris"
        />
        <Chiffre
          libelle={t("portail.chiffre.visite")}
          valeur={t("portail.chiffre.sans_mesure")}
          detail={t("portail.chiffre.visite_detail")}
          filet="gris"
        />
      </section>

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
                className="bg-app-surface border-app-bord rounded-lg border px-4 py-2.5 text-[13px]"
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
                className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3 text-[13px]"
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

      {/*
        LES DEUX CARTES DE LA COLONNE DROITE DE LA MAQUETTE, et elles sont VIDES
        toutes les deux — nommément, avec ce qu'il faut faire à la place.

        **« Mes interventions » et son tableau** demandent l'historique, que le
        portail ne lit pas ; **« Demander une intervention »** est un FORMULAIRE
        que L2-12 refuse d'ouvrir et même de préparer — *une place réservée pour
        une décision qu'on n'a pas prise est une décision prise par personne*.
        La table `demande_intervention` existe (L2-06) et un compte portail peut
        y écrire ; **ce qui manque est la décision de lui ouvrir cet écran**, et
        elle n'appartient pas à une session : c'est ce qu'un client voit.

        Ce qui est écrit ici n'est donc pas « bientôt » — c'est **ce que la
        personne doit faire aujourd'hui** : appeler son agence. *Une place qui
        promet sans dire quoi faire est pire qu'une absence.*
      */}
      <section className="grid gap-3 lg:grid-cols-2">
        <article className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
          <h2 className="text-[15px] font-extrabold tracking-tight">
            {t("portail.interventions")}
          </h2>
          <p className="text-app-encre-faible mt-1.5 text-[12.5px]">
            {t("portail.interventions.a_venir_avant")}{" "}
            {motDansUnePhrase("agence")}{" "}
            {t("portail.interventions.a_venir_apres")}
          </p>
        </article>
        <article className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
          <h2 className="text-[15px] font-extrabold tracking-tight">
            {t("portail.demande")}
          </h2>
          <p className="text-app-encre-faible mt-1.5 text-[12.5px]">
            {t("portail.demande.a_venir_avant")} {motDansUnePhrase("agence")}
            {t("portail.demande.a_venir_apres")}
          </p>
        </article>
      </section>
    </Page>
  );
}

/**
 * UNE CARTE D'INDICATEUR — `.kpi` de la maquette : fond de surface, bordure,
 * rayon `--radius` (D124), 15/16 de marge, et **un filet de 3 px à gauche**.
 *
 * *Le filet porte un SENS et non une décoration* : bleu quand le chiffre est
 * une mesure, gris quand il n'y en a pas. Un filet bleu sur un « — » dirait que
 * la case est renseignée.
 */
function Chiffre({
  libelle,
  valeur,
  detail,
  filet,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly detail: string;
  readonly filet: "bleu" | "gris";
}) {
  return (
    <div className="bg-app-surface border-app-bord relative overflow-hidden rounded-lg border px-4 py-[15px]">
      <span
        aria-hidden
        className={`absolute top-0 bottom-0 left-0 w-[3px] ${
          filet === "bleu" ? "bg-app-bleu-bord" : "bg-app-gris-bord"
        }`}
      />
      <p className="text-app-encre-faible text-[11px] font-bold tracking-[0.6px] uppercase">
        {libelle}
      </p>
      <p className="my-1 text-[27px] font-extrabold tracking-[-1px]">
        {valeur}
      </p>
      <p className="text-app-encre-faible text-[11px]">{detail}</p>
    </div>
  );
}
