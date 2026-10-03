import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { ActionPrimaire } from "@/components/ui/action-primaire";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  libelleCodeExterne,
  libelleCodeExterneDeLaSociete,
} from "@/lib/clients";
import { estCleTraduction, t } from "@/lib/i18n/fr";

export const metadata: Metadata = { title: t("clients.nouveau.titre") };

/**
 * CRÉER UNE FICHE CLIENT (14/09/2026, L1-01 rouvert par R3-12).
 *
 * ## POURQUOI LA CRÉATION PART DE LA LISTE
 *
 * *« On ne peut pas créer un client depuis une machine qui n'existe pas
 * encore. »* — l'arbitrage du 14/09/2026. La fiche se rejoint neuf fois sur dix
 * en partant d'un parc ou d'un lieu qu'on regardait déjà ; la création, elle,
 * n'a aucun de ces points de départ, et c'est ce qui justifie la liste comme
 * porte à part entière.
 *
 * ## CE QUE CE FORMULAIRE NE DEMANDE PAS, ET CE N'EST PAS UN OUBLI
 *
 * **L'adresse de facturation.** Le chapitre 11 la nomme sans lui fixer de
 * forme, et `schemaCreationClient` la laisse en JSON libre pour cette raison —
 * *une adresse calédonienne (boîte postale, tribu, commune) n'a pas celle d'une
 * adresse métropolitaine.* L'aplatir en quatre champs ici la figerait pour
 * toutes les sociétés, depuis un écran. C'est le motif qui l'écarte déjà du
 * gabarit d'import (`lib/imports/modeles.ts`), et il n'a pas changé.
 *
 * **L'état.** Une fiche naît active — `schemaCreationClient` le pose par
 * défaut. *Créer une fiche inactive n'a pas d'usage*, et le geste existe sur la
 * fiche.
 *
 * ## LE REFUS REVIENT ICI, PAS AILLEURS
 *
 * *Un refus qui renvoie ailleurs fait perdre la saisie*, et c'est la façon la
 * plus sûre d'apprendre à ne plus faire confiance à l'écran. Le succès, lui,
 * mène à la FICHE créée : c'est là qu'on vérifie ce qu'on vient d'écrire.
 */
export default async function PageNouveauClient({
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

  // D153 (03/10/2026, TP-S3) — même capacité que la route qui reçoit ce
  // formulaire (`gerer_client_site`) ; remplace la garde QT-2 (D152) qui ne
  // fermait que le technicien, laissant RM et RS ouvrir un formulaire que la
  // route refusait déjà.
  if (
    session.contexte.role === null ||
    !peut(session.contexte.role, "gerer_client_site")
  ) {
    return (
      <Page chemin="/clients" titre={t("clients.nouveau.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const params = await searchParams;
  const motif = params.motif;
  const libelleSociete = await libelleCodeExterneDeLaSociete(session.contexte);
  // LA SAISIE GARDÉE APRÈS UN REFUS (9BR-TP-A4b-MESSAGES, CS23) — ce que
  // `versLeFormulaire` (`app/api/clients/creer/formulaire.ts`) reporte dans
  // l'URL. Un paramètre absent retombe sur le champ vide, comme avant.
  const valeur = (nom: string): string =>
    typeof params[nom] === "string" ? params[nom] : "";

  return (
    <Page
      chemin="/clients"
      titre={t("clients.nouveau.titre")}
      actions={
        <Link
          href="/clients"
          className="text-app-encre-faible text-13 font-bold"
        >
          {t("clients.retour")}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          data-motif={motif}
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <form
        method="post"
        action="/api/clients/creer"
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
      >
        <Champ
          nom="raison_sociale"
          libelle={t("client.raison_sociale")}
          valeur={valeur("raison_sociale")}
          obligatoire
        />
        <Champ
          nom="code_externe"
          libelle={libelleCodeExterne(libelleSociete)}
          valeur={valeur("code_externe")}
          aide={t("clients.code_externe.aide")}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Champ
            nom="ridet"
            libelle={t("client.ridet")}
            valeur={valeur("ridet")}
          />
          <Champ
            nom="categorie"
            libelle={t("client.categorie")}
            valeur={valeur("categorie")}
          />
          <Champ
            nom="conditions_reglement"
            libelle={t("client.conditions_reglement")}
            valeur={valeur("conditions_reglement")}
          />
          <Champ
            nom="commercial_referent"
            libelle={t("client.commercial_referent")}
            valeur={valeur("commercial_referent")}
          />
        </div>
        <div>
          <ActionPrimaire>{t("clients.action.creer")}</ActionPrimaire>
        </div>
      </form>
    </Page>
  );
}

function Champ({
  nom,
  libelle,
  valeur,
  aide,
  obligatoire,
}: Readonly<{
  nom: string;
  libelle: string;
  valeur?: string;
  aide?: string;
  obligatoire?: boolean;
}>) {
  return (
    <label className="flex flex-col gap-1 text-13 font-bold">
      {libelle}
      <input
        name={nom}
        defaultValue={valeur}
        required={obligatoire === true}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-12 font-bold">{aide}</span>
      )}
    </label>
  );
}
