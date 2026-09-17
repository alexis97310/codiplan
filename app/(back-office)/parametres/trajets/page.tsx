import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Button } from "@/components/ui/button";
import { Cellule, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { enHeure } from "@/lib/calendar/parametrage";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { lireCatalogueTrajets } from "@/lib/sites/depot";
import {
  catalogueAffichable,
  TRAJET_MINUTES_MAXIMUM,
  type LigneCatalogue,
} from "@/lib/sites/trajet-zone";

/**
 * L'ÉCRAN DE RÉGLAGE DES TEMPS DE TRAJET PAR ZONE (R3-03, D107).
 *
 * *« C'est l'ADV qui remplit les données, elle ne doit pas dépendre d'un
 * déploiement. »* Cet écran est ce qui rend cette phrase vraie : sans lui, les
 * six durées de D107 seraient des constantes du dépôt, c'est-à-dire un réglage
 * qu'une correction de terrain ne pourrait pas atteindre sans demande de fusion.
 *
 * **Il affiche TOUJOURS les six zones**, réglées ou non. *Un écran qui
 * n'afficherait que les zones réglées cacherait exactement ce qu'on vient y
 * chercher* — celle dont personne ne s'est occupé.
 *
 * **Et chaque ligne dit D'OÙ vient ce qui s'applique.** C'est D56 : *un nombre
 * dont la signification dépend d'autre chose ne voyage jamais seul.* « 90 » sans
 * son origine ferait revoir les mauvaises lignes le jour d'une correction —
 * celles qui portent un réglage, ou celles qui n'en portent pas.
 *
 * **Rien n'est recalculé ici.** La cascade et le refus des îles viennent de
 * `lib/sites/trajet-zone.ts`, c'est-à-dire des mêmes fonctions que la
 * résolution et que le schéma de saisie. Un écran qui refarait le tri serait une
 * seconde lecture d'un même critère, et il divergerait en silence (§9, 01/09) —
 * c'est-à-dire qu'il montrerait une valeur et que le calcul de charge en
 * prendrait une autre.
 *
 * ## LA ZONE DES ÎLES N'A PAS DE CHAMP, ET ELLE DIT POURQUOI
 *
 * D107 : *« déplacement par avion — estimation impossible, à saisir site par
 * site. »* Un champ grisé se lirait « pas encore rempli » ; une phrase se lit
 * pour ce qu'elle est. **Même discipline que le `NOT VALID` de D104 : ce qu'on
 * ne sait pas, on l'écrit.**
 *
 * ## ÉCRAN DE LA MAQUETTE : « Sociétés & tarifs », comme ses deux voisins
 *
 * La barre l'allume par la section `/parametres` (D95, `lib/navigation/`), et la
 * forme du tableau est celle que R2-05 et R2-06 partagent — *deux
 * implémentations d'une même forme divergent en silence, et une forme visuelle
 * est un critère comme un autre.* Aucune couleur, aucune largeur, aucune barre
 * n'est écrite ici : le socle de D95 les porte.
 *
 * ## CE QU'IL NE GARDE PAS, ET C'EST À ALEXIS
 *
 * *Mesuré le 12/09/2026 :* `parametrer_societe` donne `●` à `admin_societe` et
 * `○` à `direction` — **`adv` n'y est pas** — et la matrice des capacités n'a
 * **qu'un seul appelant dans tout le dépôt**. Ni `/parametres/agences` ni
 * `/parametres/forfaits` ne gardent leur accès par capacité, et cet écran fait
 * comme eux : *poser un filtre ici et nulle part ailleurs refuserait l'ADV que
 * D107 désigne, sur le seul écran qu'elle doit remplir.* L'écart est porté au
 * ticket R3-03 plutôt que tranché en passant — ou bien la matrice est fausse et
 * RG-DRO-03 se réécrit, ou bien le filtrage arrive partout à la fois.
 */
export default async function PageParametresTrajets({
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
  const motif = (await searchParams).motif;

  const lignes = catalogueAffichable(
    await lireCatalogueTrajets(session.contexte),
  );

  const colonnes = [
    { cle: "zone", libelle: t("trajets.colonne_zone"), largeur: "170px" },
    {
      cle: "defaut",
      libelle: t("trajets.colonne_defaut"),
      droite: true,
      largeur: "170px",
    },
    {
      cle: "reglee",
      libelle: t("trajets.colonne_reglee"),
      droite: true,
      largeur: "170px",
    },
    { cle: "applique", libelle: t("trajets.colonne_applique") },
    {
      cle: "action",
      libelle: t("trajets.colonne_action"),
      largeur: "300px",
    },
  ];

  return (
    <Page
      chemin="/parametres/trajets"
      titre={t("trajets.titre")}
      sousTitre={t("trajets.sous_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnes} minimum="1000px">
          {lignes.map((ligne) => (
            <LigneZone key={ligne.zone} ligne={ligne} />
          ))}
        </Tableau>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">
        {t("trajets.explication_cascade")}
      </p>
      <p className="text-app-encre-faible text-[11.5px]">
        {t("trajets.explication_inter_sites")}
      </p>
      <p className="text-app-encre-faible text-[11.5px]">
        {t("trajets.explication_planification")}
      </p>
    </Page>
  );
}

function LigneZone({ ligne }: { readonly ligne: LigneCatalogue }) {
  return (
    <tr>
      <Cellule fort>{libelleZone(ligne.zone)}</Cellule>
      <Cellule droite>{referenceAffichee(ligne)}</Cellule>
      <Cellule droite>
        {ligne.reglee === null ? t("trajets.non_reglee") : duree(ligne.reglee)}
      </Cellule>
      <Cellule>{appliqueAffiche(ligne)}</Cellule>
      <Cellule>
        <Reglage ligne={ligne} />
      </Cellule>
    </tr>
  );
}

/**
 * Le formulaire, ou la phrase — jamais un champ grisé.
 *
 * *Un champ qu'on ne peut pas remplir se lit « pas encore rempli ».* Sur une
 * zone sans estimation, l'écran écrit ce que D107 a décidé, et le serveur
 * refuserait de toute façon l'écriture : les deux lisent la même source.
 */
function Reglage({ ligne }: { readonly ligne: LigneCatalogue }) {
  if (ligne.defaut.nature === "sans_estimation") {
    return (
      <span className="text-app-encre-faible text-[12px]">
        {t(ligne.defaut.motif)}
      </span>
    );
  }
  return (
    <form
      action="/api/parametres/trajet-zone"
      method="post"
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="zone" value={ligne.zone} />
      <label className="sr-only" htmlFor={`trajet-${ligne.zone}`}>
        {etiquetteChamp(ligne)}
      </label>
      <input
        id={`trajet-${ligne.zone}`}
        name="minutes"
        type="number"
        min={1}
        max={TRAJET_MINUTES_MAXIMUM}
        defaultValue={ligne.reglee ?? ligne.defaut.minutes}
        className="border-app-bord bg-app-surface w-20 rounded-md border px-2 py-1 text-[12.5px]"
      />
      <Button type="submit" variant="outline" size="sm">
        {t("trajets.enregistrer")}
      </Button>
      {/* Le retrait n'est proposé que s'il y a quelque chose à retirer : un
          bouton inerte sur une zone jamais réglée ferait croire à un état. */}
      {ligne.reglee === null ? null : (
        <Button
          type="submit"
          name="retirer"
          value="1"
          variant="ghost"
          size="sm"
        >
          {t("trajets.retirer")}
        </Button>
      )}
    </form>
  );
}

/** L'étiquette lue par un lecteur d'écran — la zone, puis l'unité. */
function etiquetteChamp(ligne: LigneCatalogue): string {
  return `${libelleZone(ligne.zone)} — ${t("trajets.minutes")}`;
}

/** La valeur de référence de D107, ou la phrase quand il n'y en a pas. */
function referenceAffichee(ligne: LigneCatalogue): string {
  return ligne.defaut.nature === "minutes"
    ? duree(ligne.defaut.minutes)
    : ABSENT;
}

/**
 * Ce qui s'applique, AVEC SON ORIGINE — et l'absence dit son motif.
 *
 * Les deux motifs ne se corrigent pas au même endroit : `sans_estimation` se
 * corrige site par site (D107), et cette ligne-là est la seule de l'écran qui
 * n'attend rien de l'écran.
 */
function appliqueAffiche(ligne: LigneCatalogue): string {
  const applique = ligne.applique;
  if (applique.minutes === null) {
    return ligne.defaut.nature === "sans_estimation"
      ? t(ligne.defaut.motif)
      : ABSENT;
  }
  const origine =
    applique.origine === "societe"
      ? t("trajets.origine_societe")
      : t("trajets.origine_defaut");
  return `${duree(applique.minutes)} — ${origine}`;
}

/**
 * Une durée en `HH:MM` suivie de ses minutes — la forme que le planning emploie
 * déjà (`enHeure`). *Quatre heures se lisent mieux que 240 minutes, et 240
 * minutes se vérifient mieux que quatre heures* : l'écran donne les deux.
 */
function duree(minutes: number): string {
  return `${enHeure(minutes)} (${String(minutes)} ${t("trajets.minutes")})`;
}

/** Le tiret cadratin d'une valeur absente — un signe, pas une phrase. */
const ABSENT = "—";

/** Le libellé d'une zone — au dictionnaire, jamais écrit dans le composant. */
function libelleZone(zone: string): string {
  const cle = `zone.${zone}`;
  return estCleTraduction(cle) ? t(cle) : zone;
}
