import { t } from "@/lib/i18n/fr";
import type { ThemeSociete } from "@/lib/theme/theme";

/**
 * Bandeau d'identité de la société active (ticket L0-09).
 *
 * Il ne connaît aucune couleur : il nomme les variables posées par le serveur.
 * Basculer de société change donc son rendu sans qu'une ligne de ce fichier
 * bouge — c'est exactement le critère d'acceptation du ticket.
 *
 * L'encre est celle que `lib/theme/contraste.ts` a CALCULÉE pour ce fond : sur
 * un jaune pâle elle est noire, sur un bleu profond elle est blanche. Le texte
 * reste lisible quelle que soit la couleur choisie par le client, et la règle
 * qui le garantit est un rapport de contraste d'au moins 4,5:1.
 *
 * ## CE QUE D95 CHANGE : SA FORME, JAMAIS SON RÔLE
 *
 * Il était un bandeau pleine largeur posé au-dessus du contenu de chaque page.
 * La maquette ne porte pas de bandeau : elle met l'identité de la société dans
 * une PASTILLE, à droite de la barre de navigation (`.socsel`). C'est la forme
 * rendue désormais — et c'est la seule chose qui change. Il nomme toujours les
 * mêmes variables, il ne connaît toujours aucune couleur, et basculer de
 * société change toujours son rendu sans qu'une ligne bouge ici.
 *
 * ## LE LIBELLÉ « CHARTE DE LA SOCIÉTÉ » / « THÈME NEUTRE » A DÉMÉNAGÉ (N-02,
 * arbitrage du 16/09/2026)
 *
 * ~~*Le libellé reste rendu, et il reste utile : c'est lui qui distingue, à
 * l'œil, une société qui a choisi ses couleurs d'une société qui n'en a pas.*~~
 * **Vrai, et pourtant à la mauvaise place** : cette pastille répond à une
 * question qu'on se pose UNE FOIS, à la mise en service, et elle occupait en
 * permanence la place la plus chère de l'écran — celle que la déconnexion
 * réclamait, et qu'un compte ouvert des journées durant sur un poste partagé
 * ne pouvait pas trouver ailleurs. L'information n'a pas disparu : elle vit
 * maintenant sur l'écran où la charte se regarde, `/parametres/societe`
 * (`app/(back-office)/parametres/societe/page.tsx`). La phrase barrée ci-dessus
 * reste plutôt que d'être effacée : elle a gouverné ce composant, et ce qui a
 * été décidé un jour se relit. `data-origine-theme` reste posé ici : c'est un
 * repère de scénario, jamais un texte, et rien dans le raisonnement ci-dessus
 * ne le concerne.
 *
 * ## LE LOGO EST ARRIVÉ (9EZ-LOGO-SOCIETE-1, D87)
 *
 * Devant le nom, jamais à sa place : une société sans logo continue de
 * rendre EXACTEMENT comme avant (`theme.logoEmpreinte === null`, aucun
 * `<img>`). `?v=<empreinte>` sur l'URL de lecture invalide le cache du
 * navigateur dès que le logo change, sans attendre l'expiration posée par la
 * route.
 *
 * ## LE NOM RESTE DANS LA PASTILLE (9EZ-LOGO-SOCIETE-3-CORRECTIFS)
 *
 * `shrink-0` + `whitespace-nowrap`, posés avant l'arrivée du logo, empêchaient
 * le nom de se replier sur deux lignes — mais figeaient aussi la pastille à la
 * largeur de son CONTENU, logo compris : avec un nom long et un logo large,
 * cette largeur dépassait celle de la colonne (272 px) ou du rail (76 px,
 * QE-4), et le nom débordait, coupé, hors de la boîte. **Le même remède que
 * `Entree` applique déjà à son propre libellé** (`components/navigation/
 * barre.tsx`, `min-w-0 flex-1 truncate`) : la pastille (`min-w-0`, plus de
 * `shrink-0`) peut désormais être réduite par son parent flex, et le nom
 * (`min-w-0 flex-1 truncate`) se coupe proprement par des points de
 * suspension plutôt que de déborder.
 *
 * **`max-w-[40vw]` — nécessaire pour le SEUL bandeau du terrain** (`barre.tsx`,
 * `BarreHorizontaleVide`), dont le groupe englobant (pastille + déconnexion +
 * avatar) porte lui-même `shrink-0` — hors de ce fichier, donc jamais touché
 * par ce correctif (territoire fermé). **Mesuré, pas supposé** : sans cette
 * borne, ce groupe se dimensionne sur la largeur NATURELLE de la pastille —
 * `min-w-0`/`truncate` ne jouent alors aucun rôle, puisque rien ne demande
 * jamais à la pastille d'être plus étroite que son contenu — et le bandeau du
 * terrain débordait (375 px visés, 412 px constatés). `40vw` ne mord jamais
 * sur la colonne ni le rail : leur largeur RÉELLE (272 px, 76 px) vient d'un
 * ancêtre `flex-col` en `stretch`, toujours plus étroit que 40 % d'un écran
 * d'au moins 901 px — `min-[901px]:max-w-none` le dit explicitement, pour que
 * cette classe ne doive jamais être relue à la lumière d'un futur écran de
 * bureau plus étroit que prévu ici.
 *
 * ## `repliee` — LE RAIL (76 PX, QE-4) NE PEUT PAS MONTRER LE LOGO
 *
 * **Mesuré, pas supposé** : le logo porte `shrink-0` (« inchangé en taille »,
 * exigé même ici) — à 64 px, il dépasse SEUL le contenu utile du rail
 * (76 px, moins le padding de l'aside et de la pastille, ~36 px). Aucune
 * classe de `truncate` ne répare un élément qui refuse de rétrécir : ce n'est
 * pas le nom qui déborde dans ce cas précis, c'est le logo. `repliee` (une
 * seule prop, passée par `barre.tsx` au SEUL appel de la colonne — jamais à
 * celui du bandeau du terrain) retire le logo de ce rendu : le nom seul,
 * toujours tronqué par le même `truncate`, est ce qui reste visible dans le
 * rail — même doctrine que `Marque` ci-dessous, qui réduit déjà son propre
 * texte à `sr-only` dans ce même état.
 */
export function BandeauSociete({
  theme,
  repliee = false,
}: {
  readonly theme: ThemeSociete;
  readonly repliee?: boolean;
}) {
  return (
    <div
      data-origine-theme={theme.origine}
      className="bg-societe-primaire text-societe-primaire-encre flex max-w-[40vw] min-w-0 items-center gap-2 rounded-md px-3 py-1.5 min-[901px]:max-w-none"
    >
      {theme.logoEmpreinte === null || repliee ? null : (
        // eslint-disable-next-line @next/next/no-img-element -- octets servis par une route applicative, pas un fichier statique optimisable
        <img
          src={`/api/societe/logo?v=${theme.logoEmpreinte}`}
          alt={t("societe.logo_alt")}
          className="h-6 max-w-16 shrink-0 object-contain"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-13 font-bold tracking-tight">
        {theme.nom}
      </span>
    </div>
  );
}
