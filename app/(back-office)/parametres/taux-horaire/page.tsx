import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { FormulaireTaux } from "@/components/taux-horaire/formulaire";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  lireFuseau,
  maintenant,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { montant } from "@/lib/money";
import { formatMoney } from "@/lib/money/format";
import {
  schemaSuccessionTaux,
  type SaisieSuccessionTaux,
} from "@/lib/tarification/succession-taux";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";

/**
 * L'HISTORIQUE D'UN TAUX HORAIRE, ET LE GESTE QUI LE FAIT ÉVOLUER (TAUX-1).
 *
 * ## Ce qu'il répare
 *
 * `taux_horaire` n'avait qu'un seul chemin d'écriture — le geste de mise en
 * service, atteint par un flux GitHub — et aucun écran : un directeur
 * d'exploitation posait son taux une fois et ne pouvait plus jamais le
 * changer. Le modèle, lui, est historisé par date d'effet depuis le
 * 09/09/2026 (RG-TAR-04) ; rien au-dessus ne savait s'en servir.
 *
 * ## AUCUNE LECTURE NEUVE DE « QUEL TAUX S'APPLIQUE »
 *
 * La colonne « Statut » ne recalcule rien : elle demande à `tauxEnVigueur`
 * (`lib/tarification/taux-horaire.ts`) — la MÊME fonction que la fiche
 * d'intervention — quel taux s'applique AUJOURD'HUI, et marque la ligne dont
 * la date d'effet correspond. *Une seconde implémentation du même critère
 * diverge en silence* (§9, 01/09) : cet écran ne décide jamais seul quel taux
 * est « le bon ».
 *
 * ## LE GESTE EST EN DEUX ÉCRANS, ET UN SEUL ÉCRIT
 *
 * La saisie ne fait que composer un montant et une date ; la route qui la
 * reçoit renvoie ICI, en mode confirmation, SANS RIEN ÉCRIRE — le montant est
 * relu formaté avant d'être validé. Seule la confirmation écrit. Les deux
 * états sont un seul écran, distingués par `?confirmer=1` : un lien « annuler »
 * y ramène à l'état de saisie sans perdre le contexte de la page.
 */

export const metadata = {
  title: t("taux_horaire.titre"),
};

type LigneHistorique = {
  readonly id: string;
  readonly date_effet: Date;
  readonly montant_mineur: bigint;
  readonly devise_code: string;
};

type DeviseLue = { code: string; decimales: number; symbole: string | null };

export default async function PageTauxHoraire({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  const societeId = session.contexte.societeId;
  if (societeId === null) {
    redirect("/arrivee");
  }

  const parametres = await searchParams;
  const motif = parametres.motif;

  const { historique, enVigueurDepuis, devise } = await avecContexteApplicatif(
    session.contexte,
    async (tx) => {
      const lignes = await tx.tauxHoraire.findMany({
        select: {
          id: true,
          date_effet: true,
          montant_mineur: true,
          devise_code: true,
        },
        orderBy: { date_effet: "desc" },
      });
      // « societe » est de forme IDENTITÉ (D42) : sa politique rend toutes
      // les sociétés dont l'utilisateur est habilité, jamais la seule active
      // — elle doit donc être NOMMÉE par son id, jamais lue au premier rang.
      const societeLue = await tx.societe.findUnique({
        where: { id: societeId },
        select: {
          fuseau_horaire: true,
          devise: { select: { code: true, decimales: true, symbole: true } },
        },
      });
      // « Aujourd'hui » se lit dans le fuseau de la SOCIÉTÉ (L0-08), et se
      // compare à `date_effet` — une colonne civile (`@db.Date`) — par un
      // INSTANT CIVIL, jamais l'instant nu : comparer une heure réelle à une
      // date posée à minuit UTC ferait disparaître le taux du jour onze
      // heures par jour, sous UTC+11 (DATES-1).
      const actuel =
        societeLue === null
          ? null
          : await tauxEnVigueur(
              tx,
              instantDuJour(
                jourDe(maintenant(lireFuseau(societeLue.fuseau_horaire)).local),
              ),
            );
      return {
        historique: lignes,
        enVigueurDepuis: actuel?.dateEffet.getTime() ?? null,
        devise: societeLue?.devise ?? null,
      };
    },
  );

  // La confirmation se reconstruit depuis les paramètres d'URL que la route
  // a posés — jamais depuis une saisie non revalidée : le MÊME schéma que la
  // route protège cet écran d'une URL forgée à la main.
  const brut = {
    montant_mineur: Number(parametres.montant_mineur),
    date_effet: parametres.date_effet,
  };
  const analyseConfirmation =
    parametres.confirmer === "1" ? schemaSuccessionTaux.safeParse(brut) : null;

  return (
    <Page
      chemin="/parametres/taux-horaire"
      titre={t("taux_horaire.titre")}
      sousTitre={t("taux_horaire.sous_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <Historique
        lignes={historique}
        enVigueurDepuis={enVigueurDepuis}
        devise={devise}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-[14px] font-bold">{t("taux_horaire.poser")}</h2>
        {analyseConfirmation?.success === true && devise !== null ? (
          <Confirmation saisie={analyseConfirmation.data} devise={devise} />
        ) : (
          <FormulaireTaux action="/api/parametres/taux-horaire/creer" />
        )}
      </section>
    </Page>
  );
}

function Historique({
  lignes,
  enVigueurDepuis,
  devise,
}: {
  lignes: readonly LigneHistorique[];
  enVigueurDepuis: number | null;
  devise: DeviseLue | null;
}) {
  const colonnes = [
    {
      cle: "date_effet",
      libelle: t("taux_horaire.historique_date_effet"),
      largeur: "160px",
    },
    {
      cle: "montant",
      libelle: t("taux_horaire.historique_montant"),
      droite: true,
      largeur: "180px",
    },
    { cle: "statut", libelle: t("taux_horaire.historique_statut") },
  ];

  return (
    <section
      data-bloc="historique-taux"
      className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
    >
      <Tableau colonnes={colonnes} minimum="560px">
        {lignes.length === 0 ? (
          <LignePleine colonnes={colonnes.length}>
            {t("taux_horaire.vide")}
          </LignePleine>
        ) : null}
        {lignes.map((ligne) => (
          <tr key={ligne.id}>
            <Cellule>{dateCivile(ligne.date_effet)}</Cellule>
            <Cellule droite fort>
              <span className="tabular-nums">
                {montantAffiche(ligne, devise)}
              </span>
            </Cellule>
            <Cellule>
              {enVigueurDepuis !== null &&
              ligne.date_effet.getTime() === enVigueurDepuis
                ? t("taux_horaire.en_vigueur")
                : null}
            </Cellule>
          </tr>
        ))}
      </Tableau>
    </section>
  );
}

/**
 * L'ÉCRAN DE CONFIRMATION — le montant RELU FORMATÉ, avant toute écriture.
 *
 * *Une erreur d'échelle doit se voir avant d'être facturée* (TAUX-1), comme le
 * geste d'amorçage le fait déjà pour le premier taux. Le formulaire ne porte
 * que des champs CACHÉS : rien n'est resaisi, tout ce qui a été validé une
 * fois par la route est reconduit tel quel jusqu'à l'écriture.
 */
function Confirmation({
  saisie,
  devise,
}: {
  saisie: SaisieSuccessionTaux;
  devise: DeviseLue;
}) {
  return (
    <div
      data-bloc="confirmer-taux"
      className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
    >
      <p className="text-[13px]">{t("taux_horaire.confirmer.explication")}</p>
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-[13px]">
        <dt className="text-app-encre-faible text-[12px]">
          {t("taux_horaire.confirmer.montant")}
        </dt>
        <dd className="font-semibold">
          {formatMoney(montant(saisie.montant_mineur, devise.code), devise)}
        </dd>
        <dt className="text-app-encre-faible text-[12px]">
          {t("taux_horaire.confirmer.date_effet")}
        </dt>
        <dd className="font-semibold">
          {dateCivile(new Date(`${saisie.date_effet}T00:00:00.000Z`))}
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <form method="post" action="/api/parametres/taux-horaire/creer">
          <input
            type="hidden"
            name="montant_mineur"
            value={saisie.montant_mineur}
          />
          <input type="hidden" name="date_effet" value={saisie.date_effet} />
          <input type="hidden" name="confirme" value="oui" />
          <button
            type="submit"
            className="bg-app-marque text-app-marque-encre rounded-md px-4 py-1.5 text-[13px] font-semibold"
          >
            {t("taux_horaire.confirmer.confirmer")}
          </button>
        </form>
        <Link
          href="/parametres/taux-horaire"
          className="border-app-bord rounded-md border px-4 py-1.5 text-[13px] font-semibold"
        >
          {t("taux_horaire.confirmer.annuler")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Le montant, ou son absence.
 *
 * **Aucun formatage écrit ici** : `formatMoney` est le point de passage unique
 * (I3). Si la devise du référentiel diffère de celle de la ligne — ce que le
 * déclencheur de la table interdit déjà —, on n'invente pas un format : on
 * n'affiche rien.
 */
function montantAffiche(
  ligne: LigneHistorique,
  devise: DeviseLue | null,
): string {
  if (devise === null || devise.code !== ligne.devise_code) {
    return "—";
  }
  return formatMoney(
    { nature: "reel", valeur: ligne.montant_mineur, devise: ligne.devise_code },
    devise,
  );
}
