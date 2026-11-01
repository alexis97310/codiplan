import type { Metadata } from "next";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Champ } from "@/components/session/formulaire";
import { ChampsNouveauMotDePasse } from "@/components/session/champs-nouveau-mot-de-passe";
import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { Message } from "@/components/ui/message";
import {
  CAPACITES,
  niveau,
  type Capacite,
  type Niveau,
} from "@/lib/auth/habilitations";
import { LONGUEUR_MINIMALE } from "@/lib/auth/premier-acces";
import { libelleCapacite } from "@/lib/auth/presentation-capacites";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";
import { type TonMessage } from "@/lib/theme/statuts";

export const metadata: Metadata = { title: t("mon_compte.titre") };

/**
 * MON COMPTE — L'ÉCRAN QUI MANQUAIT (constat M5, ticket T5 de l'audit du
 * 28/10/2026) : aucune route de bureau ne montrait l'identité de la personne
 * connectée ni ne permettait de changer son mot de passe sans se déconnecter
 * — seul « Mot de passe oublié ? », depuis `/connexion`, l'ouvrait. Le
 * pendant, pour tout rôle de bureau, du profil du technicien
 * (`app/(mobile)/terrain/profil/page.tsx`).
 *
 * **Accessible à tout rôle de bureau connecté, sans capacité
 * supplémentaire** — même garde que les écrans qui ne jugent qu'une session
 * et une société actives (`consulter le logo de la barre`, par exemple) : une
 * société active et un rôle suffisent, la matrice des capacités n'a rien à
 * juger ici.
 *
 * Le technicien n'atteint jamais cette route : le garde-fou serveur de D221
 * (`app/(back-office)/template.tsx`) ferme tout le segment en dehors de ses
 * deux exemptions, et cette route n'en fait pas partie.
 */
export default async function PageMonCompte({
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
  const contexte = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };

  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId },
      select: { raison_sociale: true },
    }),
  );

  const motif = (await searchParams).motif;

  const habilitations = CAPACITES.map(
    (capacite): { readonly capacite: Capacite; readonly degre: Niveau } => ({
      capacite,
      degre: niveau(contexte.role, capacite),
    }),
  ).filter((ligne) => ligne.degre !== "aucun");

  return (
    <Page titre={t("mon_compte.titre")}>
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <Message ton={tonDuMotif(motif)} titre={t(motif)} />
      ) : null}

      <Carte titre={t("mon_compte.identite.titre")}>
        <dl className="flex flex-col gap-2.5 px-4 py-3.5 text-13 font-bold">
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
            valeur={societe?.raison_sociale ?? t("mon_compte.identite.inconnu")}
          />
          <LigneIdentite
            libelle={t("mon_compte.identite.role")}
            valeur={t(`role.${contexte.role}`)}
          />
        </dl>
      </Carte>

      <Carte titre={t("mon_compte.habilitations.titre")}>
        {habilitations.length === 0 ? (
          <p className="text-app-encre-faible px-4 py-3.5 text-13 font-bold">
            {t("mon_compte.habilitations.aucune")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 px-4 py-3.5 text-13 font-bold">
            {habilitations.map(({ capacite, degre }) => (
              <li
                key={capacite}
                className="flex items-center justify-between gap-2"
              >
                <span>{libelleCapacite(capacite)}</span>
                {degre === "restreint" ? (
                  <span className="text-app-encre-faible text-12 font-bold">
                    {t("mon_compte.habilitations.restreint_suffixe")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre={t("mon_compte.second_facteur.titre")}>
        <p className="px-4 py-3.5 text-13 font-bold">
          {session.identite.mfaActif
            ? t("mon_compte.second_facteur.actif")
            : t("mon_compte.second_facteur.inactif")}
        </p>
      </Carte>

      <Carte titre={t("mon_compte.mot_de_passe.titre")}>
        <form
          action="/api/session/mon-compte/mot-de-passe"
          method="post"
          className="flex flex-col gap-4 px-4 py-3.5"
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
          <Button type="submit" className="self-start">
            {t("mon_compte.mot_de_passe.valider")}
          </Button>
        </form>
      </Carte>
    </Page>
  );
}

/** Succès et refus affichent le MÊME motif, sous un ton distinct (D188). */
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
