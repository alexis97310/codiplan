import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Badge, type TonBadge } from "@/components/ui/badge";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { Button } from "@/components/ui/button";
import { Carte } from "@/components/ui/carte";
import { Champ } from "@/components/ui/champ";
import { EtatVide } from "@/components/ui/etat-vide";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { ListeCartes } from "@/components/ui/liste-cartes";
import { Cellule, Tableau } from "@/components/ui/tableau";
import { Volet } from "@/components/ui/volet";
import { Page } from "@/components/mise-en-page/page";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import {
  listerAppareilsPret,
  type AppareilPretEnListe,
} from "@/lib/prets/depot";
import type { StatutAppareilPret } from "@prisma/client";

import { ouTiret } from "../../presentation";

export const metadata: Metadata = { title: t("prets.parc.titre") };

/**
 * LE PARC DE PRÊT (9L61-PRET-2-ECRANS-BUREAU, D287) — rangé sous
 * « Paramètres », section Référentiels, à côté du référentiel matériel :
 * les appareils de prêt sont un référentiel propre à la SOCIÉTÉ (`appareil_
 * pret`, forme « société », D287), jamais une donnée client, exactement
 * comme les familles et modèles de `/parametres/materiel`. `/parc` (le parc
 * MACHINES, forme « parc », filles d'un client et d'un site) aurait mélangé
 * deux périmètres de cloisonnement différents.
 *
 * Volontairement plus simple que `/parametres/materiel` : une seule entité,
 * aucun onglet, aucun filtre — le parc de prêt d'une société tient sur
 * quelques lignes.
 */
export default async function PageParcDePret({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // FERMÉ AU TECHNICIEN (D287, décision 1 : le bureau seul gère les prêts) —
  // et, puisque `gerer_prets` ne porte aucun ○, à tout rôle qui n'est pas
  // ADMS/DIR/RM/RS/ADV.
  if (
    session.contexte.role === null ||
    !peutPleinement(session.contexte.role, "gerer_prets")
  ) {
    return (
      <Page chemin="/parametres/prets" titre={t("prets.parc.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const appareils = await listerAppareilsPret(session.contexte);

  const params = await searchParams;
  const motif = params.motif;
  const idEdite = typeof params.id === "string" ? params.id : undefined;
  const appareilEdite =
    idEdite === undefined ? undefined : appareils.find((a) => a.id === idEdite);
  const voletOuvert =
    params.volet === "appareil" &&
    (idEdite === undefined || appareilEdite !== undefined);

  const hrefFermer = "/parametres/prets";
  const hrefCreer = "/parametres/prets?volet=appareil";
  const hrefModifier = (id: string) =>
    `/parametres/prets?volet=appareil&id=${id}`;

  return (
    <Page
      chemin="/parametres/prets"
      titre={t("prets.parc.titre")}
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("prets.parc.titre") },
      ]}
      sousTitre={t("prets.parc.sous_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>{t(motif)}</BandeauMotif>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <LienPrimaire href={hrefCreer}>{t("prets.creer_action")}</LienPrimaire>
      </div>

      {appareils.length === 0 ? (
        <EtatVide titre={t("prets.parc.aucun_appareil")}>
          {t("prets.parc.aucun_appareil_detail")}
        </EtatVide>
      ) : (
        <>
          <Carte className="max-[900px]:hidden">
            <Tableau colonnes={colonnes()} minimum="900px">
              {appareils.map((appareil) => (
                <tr key={appareil.id} data-ligne={appareil.id}>
                  <Cellule fort>{appareil.designation}</Cellule>
                  <Cellule>{ouTiret(appareil.marque)}</Cellule>
                  <Cellule>{ouTiret(appareil.modele)}</Cellule>
                  <Cellule>{ouTiret(appareil.numeroSerie)}</Cellule>
                  <Cellule>
                    <BadgeStatut statut={appareil.statut} />
                  </Cellule>
                  <Cellule>
                    <BadgeActivite actif={appareil.actif} />
                  </Cellule>
                  <Cellule>
                    <ActionsLigne
                      appareil={appareil}
                      hrefModifier={hrefModifier(appareil.id)}
                    />
                  </Cellule>
                </tr>
              ))}
            </Tableau>
          </Carte>

          <ListeCartes libelle={t("prets.parc.titre")}>
            {appareils.map((appareil) => (
              <li key={appareil.id} data-ligne={appareil.id}>
                <Carte className="flex flex-col gap-2 p-3">
                  <span className="text-13 font-bold">
                    {appareil.designation}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <BadgeStatut statut={appareil.statut} />
                    <BadgeActivite actif={appareil.actif} />
                  </div>
                  <ActionsLigne
                    appareil={appareil}
                    hrefModifier={hrefModifier(appareil.id)}
                  />
                </Carte>
              </li>
            ))}
          </ListeCartes>
        </>
      )}

      <p className="text-app-encre-faible text-12 font-bold">
        {t("prets.aucune_suppression")}
      </p>

      {voletOuvert ? (
        <VoletAppareil appareil={appareilEdite} hrefFermer={hrefFermer} />
      ) : null}
    </Page>
  );
}

function colonnes() {
  return [
    { cle: "designation", libelle: t("prets.parc.colonne_designation") },
    {
      cle: "marque",
      libelle: t("prets.parc.colonne_marque"),
      largeur: "140px",
    },
    {
      cle: "modele",
      libelle: t("prets.parc.colonne_modele"),
      largeur: "140px",
    },
    {
      cle: "numero_serie",
      libelle: t("prets.parc.colonne_numero_serie"),
      largeur: "160px",
    },
    {
      cle: "statut",
      libelle: t("prets.parc.colonne_statut"),
      largeur: "140px",
    },
    {
      cle: "activite",
      libelle: t("prets.parc.colonne_activite"),
      largeur: "110px",
    },
    { cle: "actions", libelle: t("prets.parc.colonne_actions") },
  ];
}

/**
 * LE TON DU STATUT — vert (disponible, prêt à l'usage), bleu (prêté, une
 * obligation en cours, même ton que « soumis » du régime VGP), orange (en
 * révision, une attention requise, même ton qu'« à déterminer »).
 */
const TONS_STATUT: Record<StatutAppareilPret, TonBadge> = {
  disponible: "vert",
  prete: "bleu",
  en_revision: "orange",
};

const LIBELLES_STATUT: Record<StatutAppareilPret, CleTraduction> = {
  disponible: "prets.statut.disponible",
  prete: "prets.statut.prete",
  en_revision: "prets.statut.en_revision",
};

function BadgeStatut({ statut }: { readonly statut: StatutAppareilPret }) {
  return <Badge ton={TONS_STATUT[statut]}>{t(LIBELLES_STATUT[statut])}</Badge>;
}

function BadgeActivite({ actif }: { readonly actif: boolean }) {
  return (
    <Badge ton={actif ? "vert" : "gris"}>
      {actif ? t("prets.actif") : t("prets.inactif")}
    </Badge>
  );
}

/**
 * LES ACTIONS D'UNE LIGNE — modifier, basculer le statut manuel (verrouillé
 * si l'appareil est prêté) et basculer l'activité. Chaque bascule ENVOIE
 * l'état visé, jamais déduit (voir les routes).
 */
function ActionsLigne({
  appareil,
  hrefModifier,
}: {
  readonly appareil: AppareilPretEnListe;
  readonly hrefModifier: string;
}) {
  const statutVerrouille = appareil.statut === "prete";
  const statutVise =
    appareil.statut === "disponible" ? "en_revision" : "disponible";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={hrefModifier}>{t("prets.modifier")}</Link>
      </Button>
      {statutVerrouille ? null : (
        <form
          action={`/api/parametres/prets/${appareil.id}/statut`}
          method="post"
        >
          <input type="hidden" name="statut" value={statutVise} />
          <Button type="submit" variant="outline" size="sm">
            {statutVise === "en_revision"
              ? t("prets.passer_en_revision")
              : t("prets.remettre_disponible")}
          </Button>
        </form>
      )}
      <form
        action={`/api/parametres/prets/${appareil.id}/activite`}
        method="post"
      >
        <input
          type="hidden"
          name="actif"
          value={appareil.actif ? "non" : "oui"}
        />
        <Button type="submit" variant="outline" size="sm">
          {appareil.actif ? t("prets.desactiver") : t("prets.activer")}
        </Button>
      </form>
    </div>
  );
}

function VoletAppareil({
  appareil,
  hrefFermer,
}: {
  readonly appareil: AppareilPretEnListe | undefined;
  readonly hrefFermer: string;
}) {
  const action =
    appareil === undefined
      ? "/api/parametres/prets/creer"
      : `/api/parametres/prets/${appareil.id}/modifier`;
  const prefixe = appareil?.id ?? "nouveau";
  return (
    <Volet
      surtitre={t("prets.parc.titre")}
      titre={
        appareil === undefined
          ? t("prets.creer_titre")
          : t("prets.modifier_titre")
      }
      hrefFermer={hrefFermer}
    >
      <form action={action} method="post" className="flex flex-col gap-3">
        <Champ
          id={`${prefixe}-designation`}
          nom="designation"
          libelle={t("prets.champ_designation")}
          valeur={appareil?.designation}
          large
        />
        <Champ
          id={`${prefixe}-marque`}
          nom="marque"
          libelle={t("prets.champ_marque")}
          valeur={appareil?.marque ?? undefined}
        />
        <Champ
          id={`${prefixe}-modele`}
          nom="modele"
          libelle={t("prets.champ_modele")}
          valeur={appareil?.modele ?? undefined}
        />
        <Champ
          id={`${prefixe}-numero-serie`}
          nom="numero_serie"
          libelle={t("prets.champ_numero_serie")}
          valeur={appareil?.numeroSerie ?? undefined}
        />
        <div className="flex justify-end gap-2">
          <Link
            href={hrefFermer}
            className="border-app-bord rounded-md border px-3 py-1.5 text-13 font-bold"
          >
            {t("prets.annuler")}
          </Link>
          <Button type="submit">{t("prets.enregistrer")}</Button>
        </div>
      </form>
    </Volet>
  );
}
