import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import { estRolePortail } from "@/lib/auth/roles";
import { estUuid } from "@/lib/identifiant";
import { t } from "@/lib/i18n/fr";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { ficheMachineDuParc, rattachementsDuCompte } from "@/lib/portail/depot";

import {
  clientDeLaFiche,
  etatDeLaFiche,
  miseEnServiceDeLaFiche,
  siteDeLaFiche,
  titreDeLaFicheMachine,
} from "../presentation";
import {
  emplacementDeLaMachine,
  numeroDeSerieDeLaMachine,
  placeDesDocuments,
  placeDuVgp,
} from "../../presentation";

/**
 * LA FICHE MACHINE DU PORTAIL (9J06-PORTAIL-FICHE-MACHINE, CLI-2.3a).
 *
 * ## MÊME POLITIQUE « PARC » QUE LA LISTE, UNE LECTURE PAR ID
 *
 * `ficheMachineDuParc` (`lib/portail/depot.ts`) n'ajoute aucune politique :
 * société, client et périmètre de sites sont ceux que `machine` et `site`
 * portent déjà, exactement comme `parcDuClient`. `null` couvre AUSSI BIEN une
 * machine inexistante qu'une machine hors du périmètre de ce compte — la
 * politique RLS ne distingue pas les deux cas (D35, D50), et cet écran ne les
 * distingue pas non plus : une fuite par id direct est une faute distincte
 * d'une fuite par liste, et les deux se refusent de la même façon ici,
 * `notFound()`.
 *
 * ## CE QUI N'EST PAS AFFICHÉ, ET POURQUOI
 *
 * Ni le contrat (un prix, D92 doctrine 3.8 : aucun montant sur le portail
 * client), ni les documents ni le registre VGP (CLI-2.3b, lots 8/9, D87/D88,
 * non construits — `placeDesDocuments`/`placeDuVgp` disent qu'ils sont vides,
 * comme sur la liste), ni l'historique des interventions ni l'agence qui la
 * suit (données internes à CODIMA, hors de la forme « parc » que ce compte
 * lit).
 */
const sessionCache = cache(async () => obtenirSession(await headers()));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null ||
    !estRolePortail(session.contexte.role)
  ) {
    return { title: t("portail.titre") };
  }
  const { id } = await params;
  if (!estUuid(id)) {
    return { title: t("portail.titre") };
  }
  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const premier = rattachements.find(
    (r) => r.societeId === session.contexte.societeId,
  );
  if (premier === undefined) {
    return { title: t("portail.titre") };
  }
  const fiche = await ficheMachineDuParc(
    { ...session.contexte, clientId: premier.clientId },
    id,
  );
  return {
    title:
      fiche === null
        ? t("portail.titre")
        : titreDeLaFicheMachine(fiche.machine),
  };
}

export default async function PageFicheMachinePortail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await sessionCache();
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
        titre={t("portail.titre")}
        sousTitre={t("portail.reserve")}
      />
    );
  }

  const { id } = await params;
  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE — même garde que
  // `app/(back-office)/parc/[id]/page.tsx`.
  if (!estUuid(id)) {
    notFound();
  }

  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const premier = rattachements.find(
    (r) => r.societeId === session.contexte.societeId,
  );
  if (premier === undefined) {
    redirect("/arrivee");
  }

  const fiche = await ficheMachineDuParc(
    { ...session.contexte, clientId: premier.clientId },
    id,
  );
  if (fiche === null) {
    notFound();
  }

  const titreFiche = titreDeLaFicheMachine(fiche.machine);
  const client = clientDeLaFiche(fiche.raisonSociale);
  const emplacement = emplacementDeLaMachine(fiche.machine);

  return (
    <Page
      chemin="/portail"
      entrees={ENTREES_PORTAIL}
      filAriane={[
        { libelle: t("portail.titre"), href: "/portail" },
        { libelle: titreFiche },
      ]}
      titre={titreFiche}
      sousTitre={t("portail.machine.sous_titre")}
    >
      <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5 text-[13px] font-bold">
        <span>{etatDeLaFiche(fiche.machine)}</span>
        <span>{siteDeLaFiche(fiche.site)}</span>
        {emplacement === "" ? null : <span>{emplacement}</span>}
        <span>{miseEnServiceDeLaFiche(fiche.machine)}</span>
        {client === null ? null : <span>{client}</span>}
        <span className="text-app-encre-faible text-12 font-bold">
          {numeroDeSerieDeLaMachine(fiche.machine)}
        </span>
      </section>

      {/* « SIGNALER UNE PANNE » DEPUIS LA FICHE MACHINE (9K03) — ouvre le
          formulaire de dépôt avec CETTE machine pré-choisie. Le paramètre
          `machine_id` est revérifié côté serveur par `/portail/demandes`
          (il n'est jamais cru sur parole depuis cette seule page) : même
          machine, même contexte, deux écrans. */}
      <div>
        <Link
          href={`/portail/demandes?machine_id=${fiche.machine.id}`}
          className="bg-app-marque text-app-marque-encre inline-flex rounded-md px-3.5 py-1.5 text-13 font-bold"
        >
          {t("portail.machine.action.signaler_panne")}
        </Link>
      </div>

      {/* LES DEUX PLACES RÉSERVÉES — mêmes qu'à la liste (CLI-2.3b, lots 8 et
          9, D87/D88, non construits) : elles disent qu'elles sont vides. */}
      <section className="text-app-encre-faible flex flex-col gap-1 text-12 font-bold">
        <span>{placeDesDocuments()}</span>
        <span>{placeDuVgp()}</span>
      </section>
    </Page>
  );
}
