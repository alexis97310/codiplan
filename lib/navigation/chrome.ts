import { cache } from "react";

import { headers } from "next/headers";

import { identiteDeChrome } from "@/lib/auth/chrome";
import { initialesDuNom } from "@/lib/navigation/initiales";
import { themeDuContexte } from "@/lib/theme/session";
import type { ThemeSociete } from "@/lib/theme/theme";

/**
 * CE QUE LE CHROME D'UN RENDU A BESOIN DE SAVOIR, LU UNE SEULE FOIS (R2-16).
 *
 * ## Pourquoi ce module existe
 *
 * D95 avait mis la barre de navigation dans la mise en page RACINE, où elle
 * coiffait tout — y compris `/connexion`, `/premier-acces`, `/enrolement` et
 * `/sante`. *Onze entrées dont dix inertes au-dessus d'un formulaire de
 * connexion, et une pastille d'identité vide par construction.* R2-16 rend la
 * barre au SEGMENT : elle vit dans la mise en page de `(back-office)` et de
 * `(portail)`, jamais à la racine.
 *
 * **Et la racine a toujours besoin de la même lecture** : la charte de la
 * société active part en variables CSS avec le HTML, donc depuis `<body>`. Deux
 * mises en page ont donc besoin d'une même session, et elles ne peuvent pas se
 * passer de valeur — une mise en page ne transmet rien à celles qu'elle
 * englobe.
 *
 * `cache()` de React tient exactement ce contrat : **une lecture par rendu,
 * partagée par tous les appelants du même rendu**, et rien qui survive à la
 * requête. C'est ce que `themeDuContexte` avait obtenu autrement le 11/09 — en
 * découpant la fonction pour que la racine n'appelle `obtenirSession` qu'une
 * fois. La découpe ne suffit plus dès qu'il y a deux mises en page ; la
 * mémoïsation de requête, si.
 *
 * ## Ce qu'il ne fait pas
 *
 * **Il ne décide de rien.** Comme `identiteDeChrome` dont il hérite le contrat,
 * il ne lève jamais et il n'accorde aucun droit : une pastille absente n'est
 * pas un refus, et une barre affichée n'est pas une permission. Le contrôle
 * d'accès reste aux politiques et à `exigerContexteActif`.
 */

/** Ce dont une mise en page a besoin pour peindre, et rien de plus. */
export type ChromeDeLaRequete = {
  /** Les initiales de la personne connectée, ou `null` si personne ne l'est. */
  readonly initiales: string | null;
  /** La charte de la société active, ou le thème neutre. */
  readonly theme: ThemeSociete;
};

/**
 * Le chrome du rendu courant. Mémoïsé par requête : appelé depuis la racine et
 * depuis la mise en page d'un segment, il ne lit la session qu'une fois.
 */
export const chromeDeLaRequete = cache(async (): Promise<ChromeDeLaRequete> => {
  const session = await identiteDeChrome(await headers());
  return {
    initiales: initialesDuNom(session?.nom),
    theme: await themeDuContexte(session?.contexte ?? null),
  };
});
