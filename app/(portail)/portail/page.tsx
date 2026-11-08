import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import { estRolePortail } from "@/lib/auth/roles";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { t } from "@/lib/i18n/fr";
import { estFige } from "@/lib/interventions/cycle-de-vie";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { parcDuClient, rattachementsDuCompte } from "@/lib/portail/depot";

import { interventionsDuParc } from "./interventions/depot";
import {
  emplacementDeLaMachine,
  libelleDuSite,
  nomDeLaMachine,
  numeroDeSerieDeLaMachine,
  placeDesDocuments,
  placeDuVgp,
  sansLieuDuPortail,
  siteDeLaMachine,
  sousTitreDuPortail,
  titreDesSites,
  titreTuileAvecCompte,
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
 * ## CONSULTATION SEULE — SAUF LE BOUTON QUI MÈNE AU DÉPÔT, DEPUIS 9K02
 *
 * L2-12 refusait tout bouton « demander une intervention » : cette demande
 * n'était pas tranchée, et une place réservée pour une décision qu'on n'a pas
 * prise est une décision prise par personne (§9, 24/08). **Elle l'est
 * désormais** — 9J04-PORTAIL-DEMANDES livre `/portail/demandes` et son
 * formulaire. « Signaler une panne », ci-dessous, n'est qu'un LIEN vers cet
 * écran déjà construit : cette page elle-même ne lit toujours que le parc, et
 * n'écrit rien.
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

  // LA RAISON SOCIALE LUE DANS LES RÉGLAGES, JAMAIS « CODIMA » EN DUR (TR-28,
  // décision d'Alexis du 29/09/2026) : `chromeDeLaRequete` est mémoïsé par
  // requête (`cache()` de React) — la mise en page du segment l'a déjà appelé,
  // et cet appel ne relit rien.
  const { theme } = await chromeDeLaRequete();

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

  const contexte = { ...session.contexte, clientId: premier.clientId };

  // LES DEUX TUILES DE L'ACCUEIL (9K02-PORTAIL-MENU-ACCUEIL) — MÊMES
  // LECTURES que `/portail/interventions` et `/portail/demandes`, jamais une
  // troisième lecture du même critère (§9, 01/09) : aucun filtre de société,
  // de client ni de périmètre de sites n'est recomposé ici.
  //
  // « En cours » = non FIGÉE (`estFige`, `lib/interventions/cycle-de-vie.ts`) :
  // le même partage que le back-office lit déjà pour refuser une action sur
  // une intervention `cloturee` ou `annulee`. « En attente » = la file de
  // qualification de l'ADV (`demandesOuvertes`, les statuts `nouvelle` et
  // `qualifiee`) — le même appel que l'onglet ouvert de `/portail/demandes`.
  const [parc, interventions, demandes] = await Promise.all([
    parcDuClient(contexte),
    interventionsDuParc(contexte),
    demandesOuvertes(contexte),
  ]);
  const interventionsEnCours = interventions.filter(
    (intervention) => !estFige(intervention.statut),
  ).length;

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
      sousTitre={sousTitreDuPortail(theme.nom)}
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
          <p className="text-18 font-extrabold">{parc.raisonSociale}</p>
          <p className="text-[13px] font-bold opacity-85">
            {t("portail.bandeau.espace")}
          </p>
        </div>
      )}

      {/*
        « SIGNALER UNE PANNE » EN PREMIER, PUIS LES DEUX TUILES
        (9K02-PORTAIL-MENU-ACCUEIL, recommandation non contredite d'Alexis du
        08/11/2026). Les trois mènent à des écrans qui EXISTENT déjà (9J04,
        9J07) — ce que l'accueil ne faisait pas voir avant ce lot.

        `min-h-11` (44 px) sur le bouton : la même cible tactile que
        `components/ui/choix.tsx` et `components/planning/pose.tsx`.
      */}
      <Link
        href="/portail/demandes"
        className="bg-app-marque text-app-marque-encre flex min-h-11 w-fit items-center justify-center rounded-lg px-5 text-[14px] font-extrabold"
      >
        {t("portail.accueil.signaler_panne")}
      </Link>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/portail/interventions"
          className="bg-app-surface border-app-bord hover:border-app-marque rounded-lg border px-4 py-3.5 text-[13px] font-bold"
        >
          {titreTuileAvecCompte(
            t("portail.accueil.interventions_en_cours"),
            interventionsEnCours,
          )}
        </Link>
        <Link
          href="/portail/demandes"
          className="bg-app-surface border-app-bord hover:border-app-marque rounded-lg border px-4 py-3.5 text-[13px] font-bold"
        >
          {titreTuileAvecCompte(
            t("portail.accueil.demandes_en_attente"),
            demandes.length,
          )}
        </Link>
      </section>

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
        <p className="text-app-encre-faible text-13 font-bold">
          {t("portail.perimetre")}
        </p>
        {parc.sites.length === 0 ? (
          <p className="text-[13px] font-bold">
            {sansLieuDuPortail(theme.nom)}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {parc.sites.map((site) => (
              <li
                key={site.id}
                className="bg-app-surface border-app-bord rounded-lg border px-4 py-2.5 text-[13px] font-bold"
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
          <p className="text-[13px] font-bold">{t("portail.sans_machine")}</p>
        ) : (
          <>
            {/* LES DEUX PLACES RÉSERVÉES, DITES UNE SEULE FOIS
                (9K02-PORTAIL-MENU-ACCUEIL) — elles valaient pour CHAQUE
                machine de la liste, identiques d'une ligne à l'autre ; répétées
                sous chacune, elles gonflaient la page sans rien dire de plus.
                Elles disent toujours qu'elles sont vides ; elles n'affichent
                NI un compte de documents à zéro, NI un état VGP « à jour ».
                Les deux se liraient comme des mesures (§9, 06/09), et le
                second serait faux au sens de D88. */}
            <p className="text-app-encre-faible text-12 font-bold">
              {placeDesDocuments()}
            </p>
            <p className="text-app-encre-faible text-12 font-bold">
              {placeDuVgp()}
            </p>
            <ul className="flex flex-col gap-2">
              {parc.machines.map((machine) => (
                <li key={machine.id}>
                  {/* CHAQUE LIGNE MÈNE À SA FICHE (9J06-PORTAIL-FICHE-MACHINE,
                      CLI-2.3a) — D98 retire « Fiche machine » de la barre, ça
                      n'empêche pas une fiche ATTEINTE depuis une liste. */}
                  <Link
                    href={`/portail/machines/${machine.id}`}
                    className="bg-app-surface border-app-bord hover:border-app-marque flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border px-4 py-3 text-[13px] font-bold"
                  >
                    <span className="font-bold">{nomDeLaMachine(machine)}</span>
                    <span className="text-app-encre-faible">
                      {siteDeLaMachine(machine, siteParId)}
                    </span>
                    {machine.localisation === null ? null : (
                      <span className="text-app-encre-faible">
                        {emplacementDeLaMachine(machine)}
                      </span>
                    )}
                    <span className="text-app-encre-faible text-12 font-bold">
                      {numeroDeSerieDeLaMachine(machine)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* LE BARÈME (9J20-PORTAIL-GRILLE-TARIFAIRE, CLI-7) — un point d'entrée
          de PLUS vers `/portail/tarifs`, à côté de l'entrée de la barre
          (9K02-PORTAIL-MENU-ACCUEIL) : même raison que le lien vers une
          fiche machine plus haut sur cette page, une fiche ATTEINTE depuis
          une liste n'est pas la même chose qu'une fiche dans la barre. */}
      <Link
        href="/portail/tarifs"
        className="bg-app-surface border-app-bord hover:border-app-marque flex flex-col gap-1 rounded-lg border px-4 py-3.5 text-[13px] font-bold"
      >
        <h2 className="text-[15px] font-extrabold tracking-tight">
          {t("portail.tarifs")}
        </h2>
        <p className="text-app-encre-faible text-13 font-bold">
          {t("portail.tarifs.carte_sous_titre")}
        </p>
      </Link>
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
      <p className="text-app-encre-faible text-12 font-bold tracking-[0.6px] uppercase">
        {libelle}
      </p>
      <p className="my-1 text-28 font-extrabold tracking-[-1px]">{valeur}</p>
      <p className="text-app-encre-faible text-12 font-bold">{detail}</p>
    </div>
  );
}
