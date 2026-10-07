import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { GrilleCartesEntites } from "@/components/ui/carte-entite";
import { Page } from "@/components/mise-en-page/page";
import { Pagination } from "@/components/ui/pagination";
import { PuceVue, ResumeListe } from "@/components/ui/puces-filtre";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peut } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import {
  comptesVueClients,
  compterClients,
  libelleCodeExterneDeLaSociete,
  rechercherClients,
  resumeDesCartesClients,
  sitesParClient,
} from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";
import { CarteClient } from "./carte-client";
import {
  complementRechercheClients,
  libelleAfficherClientsMasques,
  phraseClientsMasques,
  titreSansCode,
} from "./presentation";

export const metadata: Metadata = { title: t("client.titre") };

/**
 * L'ÉCRAN « CLIENTS » — reconstruit au gabarit de la maquette du 28/09
 * (9EB-TP-UX3-2-LISTES-1 ; QE-10 (a) et QE-13c, décisions d'Alexis du
 * 03/10/2026 ; D179). **Revient sur D122 pour cette seule liste** : des
 * puces à compteur remplacent le `<select>` d'état et le grand bandeau
 * « Sans code » ; un tri choisi ; le résumé passe AU-DESSUS de la grille ;
 * la carte entière ouvre la fiche et montre le donneur d'ordre.
 *
 * ## CE QUI NE CHANGE PAS
 *
 * Les deux chemins vers un client (liste, puis fiche), la pagination
 * (AT-07), le masquage des clients sans aucun équipement enregistré
 * (LISTES-1 — sa case devient la phrase de rappel, même forme que `/sites`),
 * et le cloisonnement, jamais écrit ici : `client` est de forme « parc »
 * (D10, D22), et `avecContexteApplicatif` le porte seul.
 *
 * ## LA VUE PAR DÉFAUT (D179)
 *
 * Quand l'adresse ne porte NI `etat` NI `sans_code_externe`, la page choisit
 * `etat=actifs` plutôt que le défaut du SCHÉMA (`tous`, inchangé : d'autres
 * appelants — le sélecteur de `sites/nouveau` — en dépendent encore).
 *
 * ## LES QUATRE COMPTEURS DES PUCES, UNE SEULE LECTURE (`comptesVueClients`)
 *
 * Chaque puce ouvre une vue, et son chiffre est le nombre de cartes que
 * cette vue montrerait — avec la MÊME recherche et le MÊME masquage que la
 * vue courante, jamais une recherche différente qui rendrait les quatre
 * chiffres incomparables entre eux.
 */

export default async function PageClients({
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

  // LA LISTE DES CLIENTS EST FERMÉE AU TECHNICIEN (QT-2, D152, choix 1).
  if (session.contexte.role === Role.technicien) {
    return (
      <Page chemin="/clients" titre={t("client.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  // D153 (03/10/2026, TP-S3, CS6) — « Nouveau client » n'est offert qu'au
  // rôle que la route accepterait (`gerer_client_site`).
  const peutCreer =
    session.contexte.role !== null &&
    peut(session.contexte.role, "gerer_client_site");

  const params = await searchParams;
  const motif = params.motif;
  const avecSansEquipement = params.sans_equipement === "1";
  // LA VUE PAR DÉFAUT (D179) — « Actifs » quand l'adresse ne porte NI `etat`
  // NI `sans_code_externe` ; le défaut du SCHÉMA reste « tous » (voir la
  // note de tête).
  const etatParDefaut =
    typeof params.etat !== "string" &&
    typeof params.sans_code_externe !== "string"
      ? "actifs"
      : params.etat;
  const criteres = schemaRechercheClient.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    etat: typeof etatParDefaut === "string" ? etatParDefaut : undefined,
    inclure_sans_equipement: avecSansEquipement,
    sans_code_externe:
      typeof params.sans_code_externe === "string"
        ? params.sans_code_externe
        : undefined,
    tri: typeof params.tri === "string" ? params.tri : undefined,
    page: typeof params.page === "string" ? params.page : undefined,
  });

  const [clients, totalFiltre, comptesVue, libelleSociete, societe] =
    await Promise.all([
      criteres.success
        ? rechercherClients(session.contexte, criteres.data)
        : Promise.resolve([]),
      criteres.success
        ? compterClients(session.contexte, criteres.data)
        : Promise.resolve(0),
      criteres.success
        ? comptesVueClients(session.contexte, criteres.data)
        : Promise.resolve({ actifs: 0, inactifs: 0, sansCode: 0, tous: 0 }),
      libelleCodeExterneDeLaSociete(session.contexte),
      avecContexteApplicatif(session.contexte, (tx) =>
        tx.societe.findFirst({ select: { fuseau_horaire: true } }),
      ),
    ]);
  // LE JOUR CIVIL, DANS LE FUSEAU DE LA SOCIÉTÉ (D85) — jamais `new Date()`,
  // même raison que `sites/[id]/page.tsx` : l'affichage « jj/mm » dans
  // l'année en cours doit suivre l'année de CETTE société, pas celle du
  // serveur.
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));
  // LE MASQUAGE LISTES-1 (GR12b) — même troisième lecture, indépendante,
  // que `/sites` : ce que compterait la liste si la case n'était jamais
  // posée.
  const totalAvecSansEquipement =
    criteres.success && !avecSansEquipement
      ? await compterClients(session.contexte, {
          ...criteres.data,
          inclure_sans_equipement: true,
        })
      : 0;
  const nombreClientsMasques = avecSansEquipement
    ? 0
    : totalAvecSansEquipement - totalFiltre;

  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / (criteres.success ? criteres.data.limite : 1)),
  );
  const [sites, resume] = await Promise.all([
    sitesParClient(session.contexte, clients),
    resumeDesCartesClients(session.contexte, clients),
  ]);

  // LES PARAMÈTRES QUE CHAQUE PUCE/LIEN DE PAGE PORTE, HORS `etat` ET
  // `sans_code_externe` (chacun les pose lui-même) ET HORS `page` (chaque
  // navigation d'état repart en page 1).
  const parametresCommuns = {
    q: typeof params.q === "string" ? params.q : undefined,
    sans_equipement: avecSansEquipement ? "1" : undefined,
    tri:
      criteres.success && criteres.data.tri !== "raison_sociale"
        ? criteres.data.tri
        : undefined,
  };
  const etatEffectif = criteres.success ? criteres.data.etat : "tous";
  const sansCodeEffectif = criteres.success
    ? criteres.data.sans_code_externe
    : false;
  const vueActive: "actifs" | "inactifs" | "sans-code" | "tous" =
    sansCodeEffectif
      ? "sans-code"
      : etatEffectif === "actifs"
        ? "actifs"
        : etatEffectif === "inactifs"
          ? "inactifs"
          : "tous";

  const hrefAfficherClientsMasques = `/clients?${new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(parametresCommuns).filter(([, v]) => v !== undefined) as [
        string,
        string,
      ][],
    ),
    ...(vueActive === "actifs" ? {} : { etat: etatEffectif }),
    ...(vueActive === "sans-code" ? { sans_code_externe: "1" } : {}),
    sans_equipement: "1",
  }).toString()}`;

  return (
    <Page
      chemin="/clients"
      titre={t("client.titre")}
      sousTitre={t("clients.sous_titre")}
      actions={
        peutCreer ? (
          <LienPrimaire href="/clients/nouveau">
            {t("clients.creer")}
          </LienPrimaire>
        ) : undefined
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
        method="get"
        className="bg-app-surface border-app-bord flex flex-wrap items-end gap-3 rounded-lg border px-4 py-3.5"
      >
        <label className="flex flex-col gap-1 text-[12px] font-bold">
          {t("client.recherche")}
          <input
            type="search"
            name="q"
            defaultValue={typeof params.q === "string" ? params.q : ""}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          />
        </label>
        {/* LES PARAMÈTRES DE LA VUE COURANTE SONT PORTÉS PAR LE FORMULAIRE
            (champs cachés) : une recherche relancée garde la puce active. */}
        <input type="hidden" name="etat" value={etatEffectif} />
        {vueActive === "sans-code" ? (
          <input type="hidden" name="sans_code_externe" value="1" />
        ) : null}
        <label className="flex items-center gap-1.5 self-end pb-2 text-13 font-bold">
          <input
            type="checkbox"
            name="sans_equipement"
            value="1"
            defaultChecked={avecSansEquipement}
          />
          {t("clients.filtre_equipement")}
        </label>
        <label className="flex items-center gap-1.5 self-end pb-2 text-13 font-bold">
          {t("clients.tri.libelle")}
          <select
            name="tri"
            defaultValue={
              criteres.success ? criteres.data.tri : "raison_sociale"
            }
            className="border-app-bord bg-app-surface h-[40px] rounded-[9px] border px-3 text-13 font-bold"
          >
            <option value="raison_sociale">
              {t("clients.tri.raison_sociale")}
            </option>
            <option value="machines">{t("clients.tri.machines")}</option>
            <option value="derniere_intervention">
              {t("clients.tri.derniere_intervention")}
            </option>
          </select>
        </label>
        <button
          type="submit"
          className="border-app-bord rounded-md border px-4 py-2 text-[13px] font-bold"
        >
          {t("clients.rechercher")}
        </button>
      </form>

      <div
        aria-label={t("clients.filtre.libelle")}
        className="flex flex-wrap items-center gap-2"
      >
        <PuceVue
          libelle={t("clients.filtre.actifs")}
          compteur={comptesVue.actifs}
          actif={vueActive === "actifs"}
          href={hrefVueClients(parametresCommuns, {})}
        />
        <PuceVue
          libelle={t("clients.filtre.inactifs")}
          compteur={comptesVue.inactifs}
          actif={vueActive === "inactifs"}
          href={hrefVueClients(parametresCommuns, { etat: "inactifs" })}
        />
        <PuceVue
          libelle={titreSansCode(libelleSociete)}
          compteur={comptesVue.sansCode}
          actif={vueActive === "sans-code"}
          href={hrefVueClients(parametresCommuns, { sans_code_externe: "1" })}
        />
        <PuceVue
          libelle={t("clients.vue_tous")}
          compteur={comptesVue.tous}
          actif={vueActive === "tous"}
          href={hrefVueClients(parametresCommuns, { etat: "tous" })}
        />
      </div>

      <ResumeListe
        texte={decompte(
          totalFiltre,
          t("clients.resultat_un"),
          t("clients.resultat"),
        )}
        complement={complementRechercheClients(
          criteres.success ? criteres.data.texte : null,
        )}
      />

      {nombreClientsMasques > 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {phraseClientsMasques(nombreClientsMasques)}
          {t("ponctuation.point_median")}
          <Link href={hrefAfficherClientsMasques} className={CLASSES_LIEN}>
            {libelleAfficherClientsMasques()}
          </Link>
        </p>
      ) : null}

      {clients.length === 0 ? (
        <p className="text-app-encre-faible text-[13px] font-bold">
          {t("client.recherche.vide")}
        </p>
      ) : (
        <GrilleCartesEntites>
          {clients.map((client) => (
            <CarteClient
              key={client.id}
              client={client}
              sites={sites.get(client.id)}
              resume={resume.get(client.id)}
              aujourdHui={aujourdHui}
            />
          ))}
        </GrilleCartesEntites>
      )}

      <Pagination
        page={criteres.success ? criteres.data.page : 1}
        totalPages={totalPages}
        libelleResultats={decompte(
          totalFiltre,
          t("clients.resultat_un"),
          t("clients.resultat"),
        )}
        libellePage={libellePage(
          criteres.success ? criteres.data.page : 1,
          totalPages,
        )}
        libellePrecedent={t("pagination.precedent")}
        libelleSuivant={t("pagination.suivant")}
        hrefPage={(page) =>
          hrefDeLaPage(
            "/clients",
            {
              q: typeof params.q === "string" ? params.q : undefined,
              etat: vueActive === "actifs" ? undefined : etatEffectif,
              sans_code_externe: vueActive === "sans-code" ? "1" : undefined,
              sans_equipement: avecSansEquipement ? "1" : undefined,
              tri:
                criteres.success && criteres.data.tri !== "raison_sociale"
                  ? criteres.data.tri
                  : undefined,
            },
            page,
          )
        }
      />
    </Page>
  );
}

/** L'adresse d'une vue : les paramètres communs, PUIS la vue (etat/sans_code_externe), jamais `page` (retour en page 1). */
function hrefVueClients(
  parametresCommuns: Readonly<Record<string, string | undefined>>,
  vue: Readonly<{
    readonly etat?: string;
    readonly sans_code_externe?: string;
  }>,
): string {
  const recherche = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametresCommuns)) {
    if (valeur !== undefined && valeur.length > 0) {
      recherche.set(cle, valeur);
    }
  }
  if (vue.etat !== undefined) {
    recherche.set("etat", vue.etat);
  }
  if (vue.sans_code_externe !== undefined) {
    recherche.set("sans_code_externe", vue.sans_code_externe);
  }
  return `/clients?${recherche.toString()}`;
}
