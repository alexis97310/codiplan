import { Button } from "@/components/ui/button";

/**
 * LA BARRE DE FILTRES — la recherche annoncée par un sous-titre, jamais
 * remplie (AT-04, AT-07).
 *
 * ## Ce que ce ticket pose, et ce qu'il laisse à AT-07
 *
 * Elle CÂBLE une recherche — un champ, un paramètre de requête nommé, un
 * bouton qui soumet un `GET` vers l'écran lui-même — sans en tenir la
 * PROMESSE : aucun dépôt ne lit encore ce paramètre. *Recherche par client,
 * site, modèle, n° de série ou QR code*, dit le sous-titre du parc depuis
 * D95 ; ce composant est la moitié mécanique de cette phrase, et AT-07 est
 * l'autre moitié — celle qui filtre réellement.
 *
 * ## Pourquoi une barre plutôt qu'une carte
 *
 * La maquette ne dessine aucun contrôle de recherche — ses écrans sont
 * statiques —, seulement des PHRASES qui l'annoncent : le sous-titre du parc,
 * le `.more` « Filtres : agence · type · statut · période » des interventions.
 * *Elle est donc muette sur la forme d'une barre*, et celle-ci reprend
 * l'apparence déjà posée pour un champ de formulaire (`Champ`,
 * `app/(back-office)/parametres/materiel/page.tsx`) plutôt que d'en inventer
 * une seconde : *une troisième apparence de champ serait la faute que §9
 * (01/09) nomme, déplacée d'un cran.*
 *
 * ## Aucune valeur envoyée n'est retenue par ce composant
 *
 * `valeur` initialise le champ pour qu'une recherche déjà lancée survive à un
 * rechargement — quand AT-07 saura la produire — mais ce fichier ne LIT rien :
 * il pose un formulaire, il ne consulte aucune base.
 */
export function BarreDeFiltres({
  action,
  parametre,
  valeur,
  libelleChamp,
  libelleBouton,
  enfants,
}: Readonly<{
  action: string;
  /** Le nom du paramètre de requête que le champ soumettra. */
  parametre: string;
  valeur?: string;
  libelleChamp: string;
  libelleBouton: string;
  /** Des filtres à venir — des `<select>` — posés à côté du champ. */
  enfants?: React.ReactNode;
}>) {
  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-center gap-2"
    >
      <label className="sr-only" htmlFor={parametre}>
        {libelleChamp}
      </label>
      <input
        id={parametre}
        name={parametre}
        type="search"
        defaultValue={valeur}
        placeholder={libelleChamp}
        className="border-app-bord bg-app-surface min-w-64 rounded-md border px-3 py-1.5 text-[12.5px]"
      />
      {enfants}
      <Button type="submit" variant="outline" size="sm">
        {libelleBouton}
      </Button>
    </form>
  );
}
