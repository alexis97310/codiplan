import type { MetadataRoute } from "next";

import { t } from "@/lib/i18n/fr";
import { COULEUR_FOND, COULEUR_MARQUE } from "@/lib/theme/manifeste";

/**
 * LE MANIFESTE D'APPLICATION (L3-06, §13.1).
 *
 * > *« Application web progressive installable sur l'écran d'accueil, iOS et
 * > Android, sans passer par les magasins d'applications. »*
 *
 * ## Pourquoi un module et non un fichier JSON
 *
 * **Pour que le nom et les couleurs n'aient qu'une maison.** Un
 * `manifest.json` posé dans `public/` aurait recopié `app.nom` et la couleur de
 * marque, et *une liste close recopiée devient fausse le jour où la première
 * grandit, sans rougir* (§9, 01/09). Ici le nom vient du dictionnaire et la
 * couleur du même endroit que la feuille de style.
 *
 * ## LES COULEURS NE SONT PAS ÉCRITES ICI
 *
 * Elles viennent de `lib/theme/manifeste.ts`, **le répertoire que le gardien de
 * L0-09 désigne déjà** comme l'endroit où une couleur s'écrit. *Poser une
 * exemption de plus pour ce fichier aurait élargi la règle ; poser les deux
 * constantes dans le répertoire déjà désigné ne l'élargit pas d'un pouce.* Et
 * ce qui les confronte à `app/globals.css` est un gardien, pas la relecture.
 *
 * ## L'ICÔNE — la maquette est MUETTE, et l'écart s'écrit avec sa mesure
 *
 * D95 fait de la maquette une source qui fait foi sur la disposition et les
 * couleurs, et autorise l'écart *« avec sa mesure et le point précis où elle
 * est muette »*. Mesuré : `docs/maquette/CODIPLAN_Maquette.html` ne porte
 * **aucun logo** — deux `<svg>` seulement, une courbe de tendance et un QR de
 * démonstration. **Elle est donc muette sur l'icône du produit.**
 *
 * Ce qui est posé est le minimum défendable : **le monogramme du produit sur sa
 * couleur de marque**, tracé sans dépendance. Ce n'est pas une identité
 * visuelle — c'est ce qu'une installation exige, et un placeholder nommé vaut
 * mieux qu'une icône absente qui empêche l'installation.
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t("app.nom"),
    short_name: t("app.nom"),
    description: t("app.description"),
    // `/` et non `/planning` : le point d'entrée ne suppose ni session ni rôle.
    // *Une application installée qui s'ouvre sur un écran interdit se lit comme
    // une panne.*
    start_url: "/",
    // Sans barre d'adresse : c'est ce qui distingue une application installée
    // d'un onglet, et ce que §13.1 décrit par « sur l'écran d'accueil ».
    display: "standalone",
    orientation: "portrait",
    background_color: COULEUR_FOND,
    theme_color: COULEUR_MARQUE,
    lang: "fr",
    icons: [
      {
        src: "/icones/codiplan-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icones/codiplan-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // **`maskable` est exigé séparément** : sans elle, Android rogne
        // l'icône dans un cercle et coupe ce qu'elle porte. Le monogramme est
        // tracé dans la zone sûre de 80 %, si bien que la même image sert les
        // deux usages.
        src: "/icones/codiplan-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
