import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
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
import { CLASSES_LIEN } from "@/lib/theme/apparence";

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
export default async function PageCalendrier({
  params,
  searchParams,
}: {
  params: Promise<{ calendrier: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const { calendrier: calendrierId } = await params;
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
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link href="/parametres/agences" className={CLASSES_LIEN}>
          {t("calendrier.retour")}
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {titreDuCalendrier(vue.parametrage.libelle)}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {t("calendrier.sous_titre")}
        </p>
        <p className="text-app-encre-faible text-[12.5px]">
          {lignePas(vue.parametrage.pasCreneauMinutes)}
        </p>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <p className="border-app-bord bg-app-surface text-app-encre-faible rounded-md border px-3.5 py-2.5 text-[12.5px]">
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
          />
        ))}
      </div>

      <p className="text-app-encre-faible text-[11.5px]">
        {t("calendrier.ajouter_ouvre")}
      </p>
    </main>
  );
}

/** Les sept jours ISO, dans l'ordre où la semaine se lit. */
const JOURS = [1, 2, 3, 4, 5, 6, 7] as const;

function SectionJour({
  jour,
  calendrierId,
  parametrage,
  plages,
}: {
  readonly jour: number;
  readonly calendrierId: string;
  readonly parametrage: Parametrage;
  readonly plages: readonly (Plage & { readonly id: string })[];
}) {
  const creneaux = creneauxDuJour(parametrage, jour);
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-2.5 rounded-[10px] border px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-bold capitalize">
          {libelleJour(jour)}
        </h2>
        <p className="text-app-encre-faible text-[11.5px]">
          {resumeDuJour(plages.length, creneaux)}
        </p>
      </div>

      {plages.map((plage) => (
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
      ))}

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
          valeur={DEBUT_PROPOSE}
        />
        <ChampHeure
          id={`ajout-fin-${jour}`}
          nom="fin"
          libelle={t("calendrier.fin")}
          valeur={FIN_PROPOSEE}
        />
        <Button type="submit" variant="outline" size="sm">
          {t("calendrier.ajouter")}
        </Button>
      </form>
    </section>
  );
}

/**
 * Les deux heures proposées au formulaire d'ajout.
 *
 * **Ce ne sont PAS des valeurs métier** : aucune règle ne dit qu'une agence
 * ouvre à 08:00. Ce sont les bornes d'un champ pré-rempli, qu'on écrase en
 * tapant — écrites ici plutôt que dans le JSX parce qu'un littéral n'y est pas
 * admis (L0-11), et nommées pour que personne ne les lise comme un horaire par
 * défaut au sens du §8.
 */
const DEBUT_PROPOSE = "08:00";
const FIN_PROPOSEE = "12:00";

function ChampHeure({
  id,
  nom,
  libelle,
  valeur,
}: {
  readonly id: string;
  readonly nom: string;
  readonly libelle: string;
  readonly valeur: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type="time"
        defaultValue={valeur}
        className="border-app-bord bg-app-surface w-28 rounded-md border px-2 py-1 text-[12.5px]"
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
