import Link from "next/link";

import {
  PORTES_PARAMETRAGE,
  type PorteParametrage,
} from "@/lib/navigation/portes-parametrage";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * LA PORTE DES ÉCRANS DE PARAMÉTRAGE (R3-05) — mesuré le 13/09/2026.
 *
 * ## Ce qu'elle répare
 *
 * `/parametres/trajets` et `/parametres/forfaits` **existaient et aucun lien
 * n'y menait.** La barre menait à `/parametres/agences` et à rien d'autre ; le
 * seul chemin vers les trajets était une redirection d'API *après soumission*,
 * c'est-à-dire un chemin qu'on n'emprunte qu'en revenant d'un formulaire qu'on
 * ne peut pas ouvrir.
 *
 * > **Alexis avait demandé que les temps de trajet soient paramétrables. Ils
 * > l'étaient déjà** — R3-03 les a livrés, les valeurs sont des défauts et
 * > l'écran existe. *Le produit avait la fonction et pas la porte*, et il a
 * > fallu lire le code pour le savoir. L'ADV qui doit saisir ces données ne
 * > l'aurait jamais trouvée.
 *
 * ## POURQUOI UNE PAGE, ET NON UNE DOUZIÈME ENTRÉE DANS LA BARRE
 *
 * **La barre de D95 est une liste CLOSE de onze entrées, confrontée à la
 * maquette, et un gardien fait rougir la douzième — à raison.** Elle n'est pas
 * un menu qu'on complète : c'est le catalogue d'écrans que la maquette arrête,
 * et la forcer aurait été traiter un gardien juste comme un obstacle.
 *
 * L'entrée « Sociétés & tarifs » **est** l'entrée de paramétrage de la
 * maquette, et elle portait déjà `section: "/parametres"` — la section
 * existait, il lui manquait sa page. *Ce n'est donc pas un écran de plus : c'est
 * l'écran que la section désignait déjà.*
 *
 * ## CE QU'ELLE NE FAIT PAS
 *
 * **Elle ne lit aucune base et ne compte rien.** Une pastille « 3 forfaits » ou
 * « 6 zones réglées » se lirait comme une mesure, et il faudrait alors décider
 * ce qu'elle affiche quand la lecture échoue — c'est le motif de D88, appliqué
 * à un écran d'aiguillage. *Une porte dit où elle mène, pas ce qu'il y a
 * derrière.*
 *
 * **Et « Sites d'intervention » y figure alors qu'il n'était PAS orphelin** :
 * on l'atteint depuis le lieu d'une intervention, puis depuis la fiche du site.
 * *Un chemin qui existe dans le code n'est pas un chemin qu'un humain trouve* —
 * c'est la limite que le gardien d'atteignabilité annonce lui-même, et la
 * seule chose qui puisse la combler est une porte qu'on voit.
 */

export const metadata = {
  title: t("parametres.index_titre"),
};

/**
 * Le libellé d'une porte. **Un mot imposé se compose, il ne se recopie pas** :
 * « site » se définit une fois sous `vocabulaire.*` et vient de `mot(notion)`
 * (D5, D47). Le dictionnaire ne porte alors que ce qui l'accompagne.
 */
function libelle(porte: PorteParametrage): string {
  return porte.vocabulaire === "site"
    ? `${mot("site", true)} ${t("parametres.index_sites_suffixe")}`
    : t(porte.titre);
}

export default function PageParametres() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-app-encre text-[22px] font-semibold">
        {t("parametres.index_titre")}
      </h1>
      <p className="text-app-encre-faible mt-2 max-w-2xl text-[13.5px]">
        {t("parametres.index_sous_titre")}
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {PORTES_PARAMETRAGE.map((porte) => (
          <li key={porte.chemin}>
            <Link
              href={porte.chemin}
              className="border-app-trait hover:border-app-marque block h-full rounded-lg border p-4 transition-colors"
            >
              <span className="text-app-encre block text-[15px] font-medium">
                {libelle(porte)}
              </span>
              <span className="text-app-encre-faible mt-1.5 block text-[13px]">
                {t(porte.resume)}
              </span>
              <span className="text-app-marque mt-3 block text-[12.5px] font-medium">
                {t("parametres.index_ouvrir")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
