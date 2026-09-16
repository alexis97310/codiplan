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
 * Le logo de société est hors périmètre du ticket — il suppose un stockage de
 * fichiers — et rien ici ne l'empêche : il viendrait se poser devant le nom,
 * lu depuis `societe.logo_url`, sans changer le mécanisme.
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
 */
export function BandeauSociete({ theme }: { theme: ThemeSociete }) {
  return (
    <div
      data-origine-theme={theme.origine}
      /*
        `shrink-0` et `whitespace-nowrap` : le bandeau débordait de la barre et
        son libellé se coupait en plein mot. **Deux causes distinctes, deux
        remèdes** — `shrink-0` empêche le bandeau de céder à la navigation qui
        le pousse, `whitespace-nowrap` empêche le nom de se replier sur deux
        lignes dans la place qui lui reste. *Poser l'un sans l'autre déplace le
        défaut au lieu de le fermer.*
      */
      className="bg-societe-primaire text-societe-primaire-encre flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 whitespace-nowrap"
    >
      <span className="text-[12.5px] font-bold tracking-tight">
        {theme.nom}
      </span>
    </div>
  );
}
