import { redirect } from "next/navigation";

/**
 * L'ÉCRAN « CHARTE DE LA SOCIÉTÉ » EST RETIRÉ JUSQU'AU LOT 7 (QT-22, D167,
 * 05/10/2026, TP-NAV1).
 *
 * ## CE QUI REVIENT SUR N-02
 *
 * N-02 (16/09/2026) avait déménagé ici la pastille de thème que la barre
 * portait en permanence — « Charte de la société » ou « Thème neutre
 * CODIPLAN ». QT-22 retire cet écran à son tour : il ne réglait rien
 * (`couleur_primaire`/`couleur_secondaire` n'ont AUCUN chemin d'écriture, voir
 * l'ancien en-tête de ce fichier), et la seule chose qu'il DISAIT en lecture —
 * l'identité de la société active — rejoint la carte « Identité » en tête du
 * hub de paramétrage (`lib/societes/identite.ts`). La pastille de thème,
 * elle, ne réapparaît nulle part : elle reviendra avec le formulaire des
 * couleurs, au lot 7 (la console éditeur), plutôt que de rester un écran
 * sans formulaire que seule la lecture justifiait.
 *
 * ## POURQUOI UNE REDIRECTION, ET NON UNE SUPPRESSION DE ROUTE
 *
 * L'adresse reste valide plutôt que de rendre un 404 à qui l'a mémorisée ou
 * mise en favori — elle mène simplement à l'endroit où l'information a
 * déménagé. `tests/unit/navigation/atteignabilite-ecrans.test.ts` nomme cet
 * écran comme un écart accepté : une redirection sans porte qui y mène n'est
 * pas un écran orphelin au sens que ce gardien vise.
 */
export default function PageParametresSociete() {
  redirect("/parametres");
}
