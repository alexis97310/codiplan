import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { CLASSE_BOUTON_PORTAIL } from "@/components/portail/gabarit";
import { Champ } from "@/components/session/formulaire";
import { ChampsNouveauMotDePasse } from "@/components/session/champs-nouveau-mot-de-passe";
import { Message } from "@/components/ui/message";
import { LONGUEUR_MINIMALE } from "@/lib/auth/premier-acces";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";
import { ENTREES_PORTAIL } from "@/lib/navigation/entrees";
import { ficheDuCompte, rattachementsDuCompte } from "@/lib/portail/depot";
import { type TonMessage } from "@/lib/theme/statuts";

import { adresseDuCompte } from "../presentation";

export const metadata: Metadata = { title: t("mon_compte.titre") };

/**
 * « MON COMPTE » DU PORTAIL (I5, 9K06-PORTAIL-COMPTE-TELEPHONE).
 *
 * ## Le constat qui ouvre ce fichier
 *
 * La pastille « Mon compte » de la colonne de navigation (`components/
 * navigation/barre.tsx`) menait tout rôle connecté, portail compris, vers
 * `app/(back-office)/mon-compte/page.tsx`. Cette route construit son
 * contexte directement depuis `session.contexte` — où `clientId` vaut
 * toujours `null` pour une session fraîchement lue (`lib/auth/session.ts`,
 * D70) — puis l'ouvre sur une transaction RLS : `exigerContexteActif` lève
 * pour un rôle du portail sans client désigné, avant même d'atteindre la
 * politique. **Mesuré par une épreuve e2e, pas supposé** : un compte client
 * qui cliquait cette pastille recevait une page d'erreur serveur.
 *
 * Cette page est le pendant du portail : elle désigne le client comme le
 * fait `/portail` (D70, rattachement du compte), et ne lit JAMAIS la liste
 * des capacités ni le second facteur — deux notions de bureau qu'un compte
 * portail ne porte pas (D10).
 *
 * ## Ce qu'elle montre, et rien de plus
 *
 * Nom et courriel de l'identité connectée (même lecture que la version du
 * bureau), la raison sociale et l'adresse de facturation du client — EN
 * LECTURE SEULE, aucune écriture n'est ouverte ici —, le changement de mot
 * de passe par la route EXISTANTE (`/api/session/mon-compte/mot-de-passe`,
 * qui ne juge aucun rôle, voir son en-tête) et la déconnexion.
 */
export default async function PageMonComptePortail({
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
        chemin="/portail"
        entrees={ENTREES_PORTAIL}
        titre={t("mon_compte.titre")}
        sousTitre={t("portail.reserve")}
      />
    );
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

  const contexte = { ...session.contexte, clientId: premier.clientId };
  const fiche = await ficheDuCompte(contexte);
  const adresse = adresseDuCompte(fiche.adresseFacturation);

  const motif = (await searchParams).motif;

  return (
    <Page
      chemin="/portail"
      entrees={ENTREES_PORTAIL}
      titre={t("mon_compte.titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <Message ton={tonDuMotif(motif)} titre={t(motif)} />
      ) : null}

      <dl className="bg-app-surface border-app-bord flex flex-col gap-2.5 rounded-lg border px-4 py-3.5 text-13 font-bold">
        <LigneIdentite
          libelle={t("mon_compte.identite.nom")}
          valeur={session.identite.nom}
        />
        <LigneIdentite
          libelle={t("mon_compte.identite.courriel")}
          valeur={session.identite.email}
        />
        <LigneIdentite
          libelle={t("mon_compte.identite.societe")}
          valeur={fiche.raisonSociale ?? t("mon_compte.identite.inconnu")}
        />
        <LigneIdentite
          libelle={t("mon_compte.identite.adresse")}
          valeur={adresse ?? t("mon_compte.identite.inconnu")}
        />
      </dl>

      <section className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-3.5">
        <form
          action="/api/session/mon-compte/mot-de-passe"
          method="post"
          className="flex flex-col gap-4"
        >
          <Champ
            nom="motDePasseActuel"
            type="password"
            libelle={libelleChampObligatoire(
              t("mon_compte.mot_de_passe.actuel"),
            )}
            autoComplete="current-password"
          />
          <ChampsNouveauMotDePasse
            libelleMotDePasse={libelleChampObligatoire(
              t("mon_compte.mot_de_passe.nouveau"),
            )}
            libelleConfirmation={libelleChampObligatoire(
              t("mon_compte.mot_de_passe.confirmation"),
            )}
            texteRegleLongueur={t("mon_compte.mot_de_passe.regle_longueur")}
            texteRegleConfirmation={t(
              "mon_compte.mot_de_passe.regle_confirmation",
            )}
            longueurMinimale={LONGUEUR_MINIMALE}
          />
          <div>
            <button type="submit" className={CLASSE_BOUTON_PORTAIL}>
              {t("mon_compte.mot_de_passe.valider")}
            </button>
          </div>
        </form>
      </section>

      <form action="/api/session/deconnexion" method="post">
        <button type="submit" className={CLASSE_BOUTON_PORTAIL}>
          {t("nav.deconnexion")}
        </button>
      </form>
    </Page>
  );
}

/** Succès et refus affichent le MÊME motif, sous un ton distinct (D188) — même règle qu'au bureau. */
const MOTIFS_SUCCES: ReadonlySet<string> = new Set([
  "mon_compte.mot_de_passe.abouti",
]);

function tonDuMotif(motif: string): TonMessage {
  return MOTIFS_SUCCES.has(motif) ? "succes" : "refus";
}

function LigneIdentite({
  libelle,
  valeur,
}: Readonly<{ libelle: string; valeur: string }>) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-app-encre-faible">{libelle}</dt>
      <dd>{valeur}</dd>
    </div>
  );
}
