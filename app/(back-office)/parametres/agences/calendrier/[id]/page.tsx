import type { Metadata } from "next";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { Page } from "@/components/mise-en-page/page";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { Button } from "@/components/ui/button";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peut } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  creneauxDuJour,
  enHeure,
  lireParametrage,
  type Parametrage,
  type Plage,
} from "@/lib/calendar/parametrage";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";

/**
 * LES HORAIRES D'UN CALENDRIER — L'ÉCRAN OÙ LES PLAGES SE RÈGLENT (R3-13, I7).
 *
 * ## Pourquoi un écran de détail, alors que R2-05 avait tout mis dans la ligne
 *
 * R2-05 a rangé le réglage en tableau dense et a écrit que *« le formulaire de
 * réglage du pas reste DANS la ligne »* — son argument est la COMPARAISON : on
 * règle un pas en regardant celui des autres établissements. **Il ne vaut pas
 * pour les plages.** Un pas est un nombre ; une semaine d'ouverture est sept
 * jours et autant de plages, et l'entrer dans une cellule détruirait exactement
 * la densité que R2-05 venait de gagner. Le pas, lui, N'A PAS BOUGÉ de la ligne.
 *
 * ## « Fermer un jour » n'est pas une case à cocher
 *
 * La migration du 21/08 l'a écrit à la naissance de la table : *« pas de booléen
 * `ouvert` : deux sources pour un même fait finissent par se contredire, et
 * c'est la plage qui fait foi puisque c'est elle qu'on lit. »* Un jour sans
 * plage EST un jour fermé. L'écran le DIT, plutôt que de faire semblant d'avoir
 * un interrupteur qui serait une seconde source.
 *
 * ## Aucune comparaison de société n'est écrite ici
 *
 * La lecture se fait SOUS le contexte cloisonné, et la forme « société » de
 * `calendrier` décide. Un calendrier d'une autre société et un calendrier
 * inexistant rendent donc **la même chose** — les distinguer ferait un oracle
 * (D35, D50).
 *
 * ## Ce que l'écran DIT et qu'il ne peut pas empêcher
 *
 * Changer un horaire ne touche RIEN de ce qui est posé — `pose.ts` décide au
 * moment de la pose, et `demande.depart_compteur` est matérialisé (D85). Mais le
 * dénominateur du taux d'occupation et l'assiette de la majoration relisent les
 * plages **à chaque rendu** : un samedi fermé ce soir change un taux lu la
 * semaine dernière. *Rien n'est matérialisé, donc l'effet rétroactif n'est pas
 * empêchable ici — et le travail est de le DIRE là où le réglage se fait.*
 */

/** MÊME MÉMOÏSATION, POUR LA SESSION — voir `clients/[id]/page.tsx`. */
const sessionCache = cache(async () => obtenirSession(await headers()));

/**
 * LE TITRE D'ONGLET PORTE LE NOM DU CALENDRIER (VISUEL-1) — UNE LECTURE
 * BORNÉE, jamais la transaction complète de la page (plages, agences) : ce
 * que l'onglet affiche n'a besoin que du libellé, `titreDuCalendrier`
 * appliquant la même mise en forme que le `<h1>`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (session === null || session.contexte.societeId === null) {
    return { title: t("parametres.titre") };
  }
  const { id: calendrierId } = await params;
  const parametrage = await avecContexteApplicatif(session.contexte, (tx) =>
    lireParametrage(tx, calendrierId),
  );
  return {
    title:
      parametrage === null
        ? t("parametres.titre")
        : titreDuCalendrier(parametrage.libelle),
  };
}

export default async function PageCalendrier({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await sessionCache();
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // FERMÉ AU TECHNICIEN (QT-2, D152) — « Autres pages /parametres/* ».
  if (session.contexte.role === Role.technicien) {
    return (
      <Page chemin="/parametres/agences" titre={t("parametres.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  // D153 (03/10/2026, TP-S3) — la LECTURE de ce calendrier reste ouverte à
  // tout rôle non technicien (QT-2, D152, choix 6) ; seule l'ÉCRITURE des
  // plages suit désormais `administrer_agences` (aucun ○).
  const peutEcrire =
    session.contexte.role !== null &&
    peut(session.contexte.role, "administrer_agences");

  // DÉPLACÉ SOUS UN SEGMENT EXPLICITE (PA-29, QT-21, D167, 05/10/2026,
  // TP-NAV1) — cette route désignait un CALENDRIER sous
  // `/parametres/agences/[id]`, à la MÊME adresse que la fiche d'une AGENCE
  // (`/parametres/agences/[id]/modifier`, AGENCE-1) : deux entités, une
  // seule adresse, mesurée comme une incohérence (audit du 28/09/2026). Le
  // calendrier vit désormais sous `/parametres/agences/calendrier/[id]`,
  // l'agence sous `/parametres/agences/[agenceId]` — deux adresses, deux
  // entités.
  const { id: calendrierId } = await params;
  const motif = (await searchParams).motif;

  const vue = await avecContexteApplicatif(session.contexte, async (tx) => {
    const parametrage = await lireParametrage(tx, calendrierId);
    if (parametrage === null) {
      return null;
    }
    const plages = await tx.calendrierPlage.findMany({
      where: { calendrier_id: calendrierId },
      select: {
        id: true,
        jour_semaine: true,
        debut_minutes: true,
        fin_minutes: true,
      },
      orderBy: [{ jour_semaine: "asc" }, { debut_minutes: "asc" }],
    });
    const agences = await tx.agence.findMany({
      where: { calendrier_id: calendrierId },
      select: { libelle: true },
      orderBy: { libelle: "asc" },
    });
    return { parametrage, plages, agences: agences.map((a) => a.libelle) };
  });

  if (vue === null) {
    notFound();
  }

  return (
    <Page
      chemin="/parametres/agences"
      titre={titreDuCalendrier(vue.parametrage.libelle)}
      // FIL D'ARIANE (9DR-TP-NAV2-RETOURS-FIL, D168) — remplace l'ancien
      // retour nu `calendrier.retour` (« Revenir aux établissements »),
      // seul libellé de retour sans son « ← » (audit du 28/09, TR-50).
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("parametres.titre"), href: "/parametres/agences" },
        { libelle: titreDuCalendrier(vue.parametrage.libelle) },
      ]}
      sousTitre={t("calendrier.sous_titre")}
    >
      <p className="text-app-encre-faible text-13 font-bold">
        {lignePas(vue.parametrage.pasCreneauMinutes)}
      </p>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>{t(motif)}</BandeauMotif>
      ) : null}

      <p className="border-app-bord bg-app-surface text-app-encre-faible rounded-md border px-3.5 py-2.5 text-13 font-bold">
        {t("calendrier.retroactif")}
      </p>

      <div className="flex flex-col gap-3">
        {JOURS.map((jour) => (
          <SectionJour
            key={jour}
            jour={jour}
            calendrierId={calendrierId}
            parametrage={vue.parametrage}
            plages={vue.plages
              .filter((p) => p.jour_semaine === jour)
              .map((p) => ({
                id: p.id,
                jourSemaine: p.jour_semaine,
                debutMinutes: p.debut_minutes,
                finMinutes: p.fin_minutes,
              }))}
            peutEcrire={peutEcrire}
          />
        ))}
      </div>

      <p className="text-app-encre-faible text-12 font-bold">
        {t("calendrier.ajouter_ouvre")}
      </p>
    </Page>
  );
}

/** Les sept jours ISO, dans l'ordre où la semaine se lit. */
const JOURS = [1, 2, 3, 4, 5, 6, 7] as const;

function SectionJour({
  jour,
  calendrierId,
  parametrage,
  plages,
  peutEcrire,
}: {
  readonly jour: number;
  readonly calendrierId: string;
  readonly parametrage: Parametrage;
  readonly plages: readonly (Plage & { readonly id: string })[];
  /** D153 (03/10/2026, TP-S3) — `administrer_agences`, aucun ○. */
  readonly peutEcrire: boolean;
}) {
  const creneaux = creneauxDuJour(parametrage, jour);
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-2.5 rounded-lg border px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-bold capitalize">
          {libelleJour(jour)}
        </h2>
        <p className="text-app-encre-faible text-12 font-bold">
          {resumeDuJour(plages.length, creneaux)}
        </p>
      </div>

      {plages.map((plage) =>
        peutEcrire ? (
          <div key={plage.id} className="flex flex-wrap items-end gap-2">
            <form
              action={`/api/parametres/plages/${plage.id}/modifier`}
              method="post"
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="calendrier_id" value={calendrierId} />
              <ChampHeure
                id={`debut-${plage.id}`}
                nom="debut"
                libelle={t("calendrier.debut")}
                valeur={enHeure(plage.debutMinutes)}
              />
              <ChampHeure
                id={`fin-${plage.id}`}
                nom="fin"
                libelle={t("calendrier.fin")}
                valeur={enHeure(plage.finMinutes)}
              />
              <Button type="submit" variant="outline" size="sm">
                {t("calendrier.enregistrer")}
              </Button>
            </form>
            <form
              action={`/api/parametres/plages/${plage.id}/supprimer`}
              method="post"
            >
              <input type="hidden" name="calendrier_id" value={calendrierId} />
              <Button type="submit" variant="outline" size="sm">
                {t("calendrier.retirer")}
              </Button>
            </form>
          </div>
        ) : (
          <p key={plage.id} className="text-13 font-bold">
            {intervalleAffiche(plage.debutMinutes, plage.finMinutes)}
          </p>
        ),
      )}

      {peutEcrire ? (
        <form
          action="/api/parametres/plages/ajouter"
          method="post"
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="calendrier_id" value={calendrierId} />
          <input type="hidden" name="jour" value={jour} />
          <ChampHeure
            id={`ajout-debut-${jour}`}
            nom="debut"
            libelle={t("calendrier.debut")}
          />
          <ChampHeure
            id={`ajout-fin-${jour}`}
            nom="fin"
            libelle={t("calendrier.fin")}
          />
          <Button type="submit" variant="outline" size="sm">
            {t("calendrier.ajouter")}
          </Button>
        </form>
      ) : null}
    </section>
  );
}

/**
 * UN CHAMP D'HEURE, SANS PLAGE PROPOSÉE (PA-34, QT-21, D167, 05/10/2026,
 * TP-NAV1).
 *
 * **Le formulaire d'ajout ne pré-remplit plus 08:00–12:00.** Mesuré à
 * l'audit du 28/09/2026 : rien, dans le chapitre 10, ne dit qu'une agence
 * ouvre à 08:00 — le §8 interdit d'inventer une donnée d'exploitation, et un
 * champ pré-rempli EST une valeur par défaut, même s'il reste possible de
 * l'écraser en tapant. Celui qui règle une plage choisit désormais les deux
 * bornes lui-même, sans suggestion.
 *
 * `valeur` reste utile à la modification d'une plage EXISTANTE (la vraie
 * valeur qu'elle porte n'est pas une invention), d'où un paramètre facultatif
 * plutôt qu'un second composant.
 */
function ChampHeure({
  id,
  nom,
  libelle,
  valeur,
}: {
  readonly id: string;
  readonly nom: string;
  readonly libelle: string;
  readonly valeur?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-12 font-bold">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type="time"
        defaultValue={valeur}
        className="border-app-bord bg-app-surface w-28 rounded-md border px-2 py-1 text-13 font-bold"
      />
    </div>
  );
}

/**
 * LES TROIS COMPOSITIONS SONT FAITES HORS DU JSX — un littéral n'y est pas
 * admis, fût-il le deux-points d'une étiquette ou la flèche d'un intervalle
 * (L0-11). C'est le gardien qui l'a dit, pas la relecture : six séparateurs
 * écrits dans des gabarits de chaîne, à l'intérieur d'expressions JSX.
 */
function titreDuCalendrier(libelle: string): string {
  return `${t("calendrier.titre")}${TIRET}${libelle}`;
}

function lignePas(pasMinutes: number): string {
  return `${t("calendrier.pas_courant")}${DEUX_POINTS}${pasMinutes}`;
}

/**
 * UNE PLAGE, EN LECTURE SEULE (D153, 03/10/2026, TP-S3) — pour un rôle sans
 * `administrer_agences`, qui lit le calendrier sans pouvoir le régler.
 */
function intervalleAffiche(debutMinutes: number, finMinutes: number): string {
  return `${enHeure(debutMinutes)}${FLECHE}${enHeure(finMinutes)}`;
}

/**
 * Le résumé d'un jour : fermé, ou les deux bouts de la grille et son compte.
 *
 * *« Aucun créneau » et « fermé » ne se corrigent pas au même endroit* — le
 * premier est un réglage qui se contredit (une plage plus courte que le pas),
 * le second est une décision. Les confondre sous un tiret ferait chercher une
 * panne là où il n'y a qu'un samedi.
 */
function resumeDuJour(
  nombreDePlages: number,
  creneaux: readonly number[],
): string {
  if (nombreDePlages === 0) {
    return t("calendrier.jour_ferme");
  }
  if (creneaux.length === 0) {
    return `${t("calendrier.creneaux_du_jour")}${DEUX_POINTS}${t("calendrier.aucun_creneau")}`;
  }
  const premier = enHeure(creneaux[0] ?? 0);
  const dernier = enHeure(creneaux[creneaux.length - 1] ?? 0);
  return `${t("calendrier.creneaux_du_jour")}${DEUX_POINTS}${premier}${FLECHE}${dernier}${OUVRANTE}${creneaux.length}${FERMANTE}`;
}

const TIRET = " — ";
const DEUX_POINTS = " : ";
const FLECHE = " → ";
const OUVRANTE = " (";
const FERMANTE = ")";

/** Le nom d'un jour ISO — au dictionnaire, jamais dans une liste écrite ici. */
function libelleJour(jour: number): string {
  const cle = `jour.${jour}`;
  return estCleTraduction(cle) ? t(cle) : String(jour);
}
