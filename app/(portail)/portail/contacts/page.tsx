import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { contactsDuClient } from "@/lib/contacts/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { parcDuClient, rattachementsDuCompte } from "@/lib/portail/depot";

import { sousTitreDesContacts } from "./presentation";
import { ListeContacts } from "./vue";

export const metadata: Metadata = { title: t("portail.contacts.titre") };

/**
 * L'ANNUAIRE DE CONTACTS DU PORTAIL CLIENT (9J03-PORTAIL-CONTACTS, CLI-3).
 *
 * ## LA LECTURE DU CONTEXTE — IDENTIQUE À `/portail` (D70, D92), JAMAIS UNE
 * SECONDE DÉSIGNATION
 *
 * Même chemin que `app/(portail)/portail/page.tsx` : rôle du portail exigé,
 * puis le PREMIER rattachement de ce compte sur la société active. Écrire une
 * seconde variante de cette lecture ici diverge en silence le jour où D70
 * change (§9, 01/09) — la porte des routes d'écriture
 * (`app/api/portail/contacts/contexte.ts`) répète la même forme pour la même
 * raison, aucune des deux ne pouvant importer l'autre (un module serveur de
 * page et un module de route n'ont pas le même cycle de vie Next).
 *
 * ## LECTURE LARGE : « VOS INTERLOCUTEURS » EST L'ANNUAIRE DU CLIENT
 *
 * `contactsDuClient` rend TOUS les contacts du client désigné, qu'ils soient
 * du client (`site_id` nul) ou d'un de ses sites dans le périmètre du compte
 * — jamais la seule fiche du compte connecté. M8 ne restreint pas à
 * « soi-même », et un compte qui ne pourrait pas enregistrer le départ d'un
 * collègue serait un manque (passation, à confirmer par Alexis — non
 * bloquant).
 *
 * ## AUCUNE ENTRÉE DE MENU N'EST AJOUTÉE
 *
 * `ENTREES_PORTAIL` (`lib/navigation/entrees.ts`) et `/portail/page.tsx` sont
 * HORS du territoire de ce ticket. Cet écran n'est donc atteignable que par
 * son URL directe — gap nommé en passation, pas une omission silencieuse :
 * ajouter une entrée de menu est la décision que D97/D121 réservent, pas un
 * réflexe de ticket.
 */
export default async function PageContactsPortail({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
        chemin="/portail/contacts"
        entrees={ENTREES_PORTAIL}
        titre={t("portail.contacts.titre")}
        sousTitre={t("portail.reserve")}
      />
    );
  }

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
  const [contacts, parc] = await Promise.all([
    contactsDuClient(contexte, premier.clientId),
    parcDuClient(contexte),
  ]);

  const paramsResolus = await searchParams;
  const motif = paramsResolus.motif;

  return (
    <Page
      chemin="/portail/contacts"
      entrees={ENTREES_PORTAIL}
      titre={t("portail.contacts.titre")}
      sousTitre={sousTitreDesContacts()}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>{t(motif)}</BandeauMotif>
      ) : null}
      <ListeContacts contacts={contacts} siteOptions={parc.sites} />
    </Page>
  );
}
