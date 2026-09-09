import {
  type BlocPlanning,
  type ColonneTechnicien,
  type NatureBloc,
  type RefusNomme,
} from "@/lib/planning/depot";
import { heureLocale } from "@/lib/calendar";
import { type Grille, PAS_MINUTES, positionner } from "@/lib/planning/grille";
import { t } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * LA GRILLE DU PLANNING — rendu seulement (ticket L2-11).
 *
 * **Elle ne calcule aucune heure et ne lit aucune base.** La géométrie vient de
 * `lib/planning/grille.ts`, les données de `lib/planning/depot.ts` ; ce fichier
 * pose des `div` sur une grille CSS. C'est ce qui permet d'éprouver le pas de
 * quinze minutes et les horaires paramétrables sans navigateur.
 *
 * **Cinq natures de bloc, cinq formes, et la forme dit le type** (charte,
 * règle 2). La couleur seule ne suffirait pas : un daltonisme rouge-vert
 * confond le refus et l'interne. Chaque nature porte donc AUSSI une forme —
 * filet épais à gauche, hachures, pointillés — et un texte.
 *
 * **La grille défile, la page jamais** (charte, règle 13). Le conteneur porte
 * `overflow-x: auto` ; sous 900 px, c'est lui qui bouge, et l'en-tête de
 * colonnes reste collé en haut.
 */

/** La hauteur d'un pas de quinze minutes, en pixels. */
const HAUTEUR_PAS = 18;

/** Les classes de forme de chaque nature (charte, règle 2). */
const FORMES: Readonly<Record<NatureBloc, string>> = {
  facture: "bg-plaque border-l-4 border-l-bleu border border-trait",
  forfait: "bg-ambre-fond border-l-4 border-l-ambre border border-ambre",
  // Les hachures à 135° sont la forme du trajet : elles se lisent sans couleur,
  // et c'est le point — un trajet n'est pas « un bloc gris », c'est un bloc
  // rayé qui n'est jamais facturé (D74).
  trajet:
    "border border-dashed border-trait text-gris bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,var(--trait)_5px,var(--trait)_6px)]",
  interne: "bg-vert-fond border border-trait",
  refus: "border-2 border-oxyde bg-oxyde-fond text-oxyde",
};

/**
 * `08:15 – 09:30`. Le formatage vient de `lib/calendar` : c'est le seul endroit
 * du dépôt où un fuseau se nomme, et un composant qui construirait son propre
 * formateur écrirait l'heure de l'appareil (L0-08).
 */
function heures(debut: Date, fin: Date, fuseau: string): string {
  return `${heureLocale(debut, fuseau)} – ${heureLocale(fin, fuseau)}`;
}

/** « BR absente » — le code de l'habilitation, et ce qui lui manque. */
function motifCourt(refus: RefusNomme): string {
  const motif =
    refus.motif === "absente"
      ? t("planning.refus.absente")
      : t("planning.refus.expiree");
  return `${refus.code} ${motif}`;
}

function Bloc({ bloc, grille }: { bloc: BlocPlanning; grille: Grille }) {
  const place = positionner(grille, bloc.debut, bloc.fin);
  if (place === null) {
    return null;
  }

  return (
    <article
      className={cn(
        "absolute right-0.5 left-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-xs",
        FORMES[bloc.nature],
      )}
      style={{
        top: place.depuis * HAUTEUR_PAS,
        height: place.pas * HAUTEUR_PAS - 2,
      }}
    >
      {bloc.nature === "refus" ? (
        <p className="truncate font-bold">{t("planning.refus.prefixe")}</p>
      ) : null}
      <p className="truncate font-bold">{bloc.titre}</p>
      <p className="truncate">{heures(bloc.debut, bloc.fin, grille.fuseau)}</p>
      {bloc.nature === "trajet" ? (
        <p className="truncate font-bold">{t("planning.non_facture")}</p>
      ) : (
        <p className="truncate">{bloc.client}</p>
      )}
      {bloc.refus.map((refus) => (
        <p key={refus.code} className="truncate font-bold">
          {motifCourt(refus)}
        </p>
      ))}
      {bloc.avertissements.map((refus) => (
        <p key={refus.code} className="text-ambre truncate">
          {motifCourt(refus)}
        </p>
      ))}
      {place.deborde ? (
        <p className="truncate italic">{t("planning.deborde")}</p>
      ) : null}
    </article>
  );
}

/** Le planning d'une journée : un en-tête figé, une grille défilante. */
export function GrillePlanning({
  colonnes,
  blocs,
  grilles,
}: {
  colonnes: readonly ColonneTechnicien[];
  blocs: readonly BlocPlanning[];
  /** La grille de CHAQUE colonne — les horaires sont propres au technicien. */
  grilles: ReadonlyMap<string, Grille>;
}) {
  // La grille de référence pour la colonne des heures : la plus large, pour
  // qu'aucun bloc ne sorte de la règle graduée. Une colonne dont les heures
  // sont plus étroites laisse simplement du vide en haut et en bas.
  const reference = [...grilles.values()]
    .filter((grille) => !grille.ferme)
    .sort((a, b) => b.lignes.length - a.lignes.length)[0];

  if (reference === undefined) {
    return null;
  }

  const hauteur = reference.lignes.length * HAUTEUR_PAS;

  return (
    <div className="border-trait overflow-x-auto border">
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `4.5rem repeat(${colonnes.length}, minmax(11rem, 1fr))`,
        }}
      >
        {/* EN-TÊTE FIGÉ. `sticky` sur la première ligne de la grille : les
            colonnes restent nommées quand on descend dans la journée. */}
        <div className="bg-acier border-trait sticky top-0 z-10 border-b px-2 py-2 text-xs">
          {t("planning.colonne_heures")}
        </div>
        {colonnes.map((colonne) => (
          <div
            key={colonne.id}
            className="bg-acier border-trait sticky top-0 z-10 border-b border-l px-2 py-2"
          >
            <p className="truncate text-sm font-bold">{colonne.nom}</p>
            {/* RÈGLE 6 : pas de chaînes jointes par un point médian en guise
                de chrome. L'agence et l'exception d'horaires sont deux faits
                distincts, et ils s'écrivent sur deux lignes. */}
            <p className="text-gris truncate text-xs">
              {colonne.agenceLibelle}
            </p>
            {colonne.calendrierPropre ? (
              <p className="text-ambre truncate text-xs">
                {t("planning.calendrier_propre")}
              </p>
            ) : null}
          </div>
        ))}

        {/* LA RÈGLE GRADUÉE. Les libellés ne sont écrits qu'aux heures pleines :
            un libellé tous les quarts d'heure serait illisible, et la
            graduation reste portée par le filet. */}
        <div className="relative" style={{ height: hauteur }}>
          {reference.lignes.map((ligne, rang) => (
            <div
              key={ligne.minutes}
              className={cn(
                "absolute right-0 left-0 px-2 text-xs",
                ligne.heurePleine ? "border-trait border-t" : "",
              )}
              style={{ top: rang * HAUTEUR_PAS, height: HAUTEUR_PAS }}
            >
              {ligne.heurePleine ? (
                <span className="text-gris">{ligne.libelle}</span>
              ) : null}
            </div>
          ))}
        </div>

        {colonnes.map((colonne, rang) => {
          const grille = grilles.get(colonne.id);
          return (
            <div
              key={colonne.id}
              className="border-trait relative border-l"
              style={{
                height: hauteur,
                // RÈGLE 5 : le SEUL mouvement orchestré du produit — le
                // remplissage colonne par colonne, 140 ms de décalage. Il est
                // porté par une variable, et `prefers-reduced-motion` le
                // supprime entièrement dans app/globals.css.
                animationDelay: `${rang * 140}ms`,
              }}
              data-remplissage="colonne"
            >
              {grille === undefined || grille.ferme ? (
                <p className="text-gris p-2 text-xs">{t("planning.ferme")}</p>
              ) : (
                <>
                  {reference.lignes.map((ligne, rangLigne) =>
                    ligne.heurePleine ? (
                      <div
                        key={ligne.minutes}
                        className="border-trait absolute right-0 left-0 border-t"
                        style={{ top: rangLigne * HAUTEUR_PAS }}
                      />
                    ) : null,
                  )}
                  {blocs
                    .filter((bloc) => bloc.techncienId === colonne.id)
                    .map((bloc) => (
                      <Bloc key={bloc.id} bloc={bloc} grille={grille} />
                    ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Une entrée de légende : la forme du bloc, et l'état qu'elle désigne. */
function EntreeLegende({
  nature,
  libelle,
}: {
  nature: NatureBloc;
  libelle: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn("inline-block h-4 w-8 rounded-md", FORMES[nature])}
      />
      {libelle}
    </li>
  );
}

/**
 * La légende. Chaque couleur y est associée à son état (charte, règle 1).
 *
 * **Les cinq entrées sont écrites une par une**, et non parcourues depuis un
 * tableau. Un tableau serait plus court ; il ferait aussi voyager les noms de
 * natures et les clés du dictionnaire à l'intérieur du JSX, où le gardien des
 * chaînes visibles les lit — à raison — comme du texte d'écran. *Cinq lignes
 * explicites valent mieux qu'une boucle qui oblige à exempter quelque chose.*
 */
export function Legende() {
  return (
    <section aria-label={t("planning.legende")}>
      <h2 className="mb-2 text-sm">{t("planning.legende")}</h2>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <EntreeLegende
          nature="facture"
          libelle={t("planning.legende.facture")}
        />
        <EntreeLegende
          nature="forfait"
          libelle={t("planning.legende.forfait")}
        />
        <EntreeLegende nature="trajet" libelle={t("planning.legende.trajet")} />
        <EntreeLegende
          nature="interne"
          libelle={t("planning.legende.interne")}
        />
        <EntreeLegende nature="refus" libelle={t("planning.legende.refus")} />
      </ul>
    </section>
  );
}

export { HAUTEUR_PAS, PAS_MINUTES };
