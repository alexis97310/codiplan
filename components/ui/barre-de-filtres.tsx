import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";

/**
 * LA BARRE DE FILTRES — la recherche annoncée par un sous-titre (AT-04,
 * AT-07), et depuis N-12 (18/09/2026) à l'IDENTIQUE de `.toolbar`/`.search`
 * de `codiplan-maquette-complete.html`.
 *
 * ## Un silence mesuré, pas une forme inventée
 *
 * **La note qui suivait ici jusqu'à ce ticket disait la maquette « muette sur
 * la forme d'une barre », et reprenait donc l'apparence d'un `Champ` de
 * formulaire plutôt que d'en inventer une seconde.** C'était vrai le 12/09,
 * avant D125 : `codiplan-maquette-complete.html` dessinait alors des écrans
 * statiques, sans recherche. **Ce n'est plus la lecture correcte depuis D125**
 * (18/09/2026) — `parc()` et `clients()` de cette même maquette dessinent
 * bel et bien un `.toolbar > .search > input.field` avec sa loupe, et
 * `tests/unit/machines/composition-parc.test.ts` le prouve déjà depuis N-10
 * (`class="toolbar"`, `class="search"`). *Aucun gardien ne confrontait pour
 * autant les MESURES de ce champ à celles de la maquette* — mesuré le
 * 18/09/2026 par le directeur d'exploitation : ce composant portait une
 * largeur fixe, aucune loupe, un corps de 12,5 px et un rayon de 6 px, quatre
 * valeurs qui ne venaient d'aucune lecture. `tests/unit/ui/composants-
 * maquette.test.ts` les confronte désormais à `.search`, `.search .field`,
 * `.search:before` et `.field,.select`.
 *
 * ## Ce que ce composant NE couvre PAS
 *
 * `.toolbar` gouverne aussi l'espacement AUTOUR de la barre (l'écart entre le
 * champ, les `<select>` et les boutons, la marge sous l'ensemble) : cette
 * proposition ne mesure que le CHAMP lui-même — la largeur fixe, l'absence de
 * loupe, le corps et le rayon nommés par le directeur d'exploitation le
 * 18/09 — et laisse l'agencement des conteneurs de chaque écran à une
 * proposition qui le nommerait.
 *
 * ## Ce que ce ticket répare, et ce qu'il laisse à AT-07
 *
 * Elle CÂBLE une recherche — un champ, un paramètre de requête nommé, un
 * bouton qui soumet un `GET` vers l'écran lui-même — sans en tenir la
 * PROMESSE : aucun dépôt ne lit encore ce paramètre. *Recherche par client,
 * site, modèle, n° de série ou QR code*, dit le sous-titre du parc depuis
 * D95 ; ce composant est la moitié mécanique de cette phrase, et AT-07 est
 * l'autre moitié — celle qui filtre réellement.
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
      className="flex flex-wrap items-center gap-[10px]"
    >
      {/* `.search{flex:1;min-width:220px}` — le champ grandit avec la
          barre, jamais une largeur fixe. */}
      <div className="relative min-w-[220px] flex-1">
        {/* `.search:before{content:"⌕";left:13px;font-size:20px}` — un
            glyphe rendu, jamais un `::before` CSS : React n'a pas de prise
            sur le contenu d'un pseudo-élément, et un `span` porte la même
            mesure sans en inventer une seconde. Le glyphe passe par le
            dictionnaire (`recherche.loupe`) : décoratif, mais un caractère
            RENDU à l'écran reste un texte pour L0-11. */}
        <span
          aria-hidden="true"
          className="text-app-encre-faible pointer-events-none absolute top-1/2 left-[13px] -translate-y-1/2 text-[20px]"
        >
          {t("recherche.loupe")}
        </span>
        <label className="sr-only" htmlFor={parametre}>
          {libelleChamp}
        </label>
        <input
          id={parametre}
          name={parametre}
          type="search"
          defaultValue={valeur}
          placeholder={libelleChamp}
          // `.field,.select{height:40px;border-radius:9px;padding:0 12px}`
          // puis `.search .field{padding-left:38px}` qui écrase la moitié
          // gauche du rembourrage — la moitié droite (`pr-3`, 12px) reste
          // commune aux deux champs. Aucune taille de police ici : elle
          // s'hérite du corps (14px), comme la maquette la laisse faire.
          className="border-app-bord bg-app-surface h-[40px] w-full rounded-[9px] border py-0 pr-3 pl-[38px]"
        />
      </div>
      {enfants}
      <Button type="submit" variant="outline" size="sm">
        {libelleBouton}
      </Button>
    </form>
  );
}
