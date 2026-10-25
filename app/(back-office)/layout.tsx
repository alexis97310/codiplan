import { LargeurUtile } from "@/components/mise-en-page/largeur-utile";
import { BandeauBureau } from "@/components/navigation/bandeau-bureau";
import {
  BandeauMobile,
  FournisseurNavigationMobile,
} from "@/components/navigation/bandeau-mobile";
import { BarreDeNavigation } from "@/components/navigation/barre";
import { BarreBasseBureau } from "@/components/navigation/barre-basse-bureau";
import { Role } from "@/lib/auth/roles";
import { t } from "@/lib/i18n/fr";
import { chromeDeLaRequete } from "@/lib/navigation/chrome";
import { ENTREES } from "@/lib/navigation/entrees";

/**
 * LE SEGMENT DU BACK-OFFICE — les écrans de travail, et ceux-là portent la
 * barre de navigation (R2-16).
 *
 * Elle vivait dans la mise en page racine depuis D95, où elle coiffait tout, y
 * compris les quatre écrans d'authentification et les deux écrans sans compte.
 * Elle est rendue ici, au segment, parce que c'est le segment qui sait s'il y a
 * une session à naviguer.
 *
 * **La barre reste du CHROME et n'accorde rien.** Un écran qui exige une
 * session continue de la demander lui-même et de rediriger ; une entrée de la
 * barre n'est jamais masquée pour cause de droit, ce que
 * `lib/navigation/entrees.ts` écrit — masquer serait une seconde lecture d'un
 * critère que la politique porte déjà, et c'est celle qui vieillit sans rougir.
 *
 * **DEPUIS D121, LA BARRE EST UNE COLONNE, PAS UN EN-TÊTE** : elle occupe la
 * hauteur de la fenêtre à gauche du contenu plutôt que sa largeur au-dessus.
 * Ce fichier pose donc la ligne flexible qui les met côte à côte — c'est tout
 * ce que ce changement de forme demande ici, `BarreDeNavigation` portant le
 * reste (sa propre largeur, son propre défilement).
 *
 * **SOUS 901 PX, LA COLONNE SORT DE L'ÉCRAN (COQUE-375)** : mesuré au
 * navigateur sur le site en ligne à 375 px, elle y occupait 272 px sur une
 * fenêtre de 375, avant même la gouttière — 63 px de contenu utile restants.
 * `FournisseurNavigationMobile` porte l'état d'ouverture que
 * `BarreDeNavigation` (l'aside, dans `components/navigation/barre.tsx`) et
 * `BandeauMobile` (le déclencheur ci-dessous) partagent tous deux ; il enrobe
 * l'ensemble parce que ni l'un ni l'autre ne peut recevoir de l'autre une
 * fonction depuis CE fichier, un composant SERVEUR. `<BarreDeNavigation
 * entrees={ENTREES} …/>` reste écrit ici en toutes lettres — c'est ce texte
 * que lit le gardien statique de R2-16
 * (`tests/unit/app/barre-par-segment.test.ts`).
 *
 * **DEPUIS D221 (décision d'Alexis du 21/10/2026, 9G8-TERRAIN-
 * CONFIRMATIONS-ET-ACCES), CE N'EST PLUS TOUT À FAIT VRAI POUR LE
 * TECHNICIEN** — ce segment entier lui est FERMÉ, par un garde-fou SERVEUR,
 * sauf `/arrivee` et `/absences?declarer=1`. **Ce garde ne vit plus ici
 * depuis le 25/10/2026 (9G8D-GARDE-TECHNICIEN-PAGES)** : mesuré, une
 * navigation DOUCE (clic sur un `<Link>` de la colonne, depuis
 * `/absences?declarer=1` vers `/planning`) atteignait le tableau complet
 * sans redirection — ce fichier est un LAYOUT, et App Router en garde
 * l'instance à travers une navigation entre pages du même segment plutôt que
 * de le réexécuter ; le garde qui y vivait ne jugeait donc que le premier
 * rendu. Il vit maintenant dans `app/(back-office)/template.tsx`, RECRÉÉ lui
 * à chaque navigation, douce ou dure — voir son en-tête pour la logique et
 * les exemptions, inchangées.
 */
export default async function MiseEnPageBackOffice({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { theme, initiales, role, decomptes } = await chromeDeLaRequete();
  // LA MARQUE RENVOIE LE TECHNICIEN VERS SA JOURNÉE, PAS VERS LE TABLEAU DE
  // BORD DU BUREAU (décision d'Alexis du 25/10/2026, 9G8E-NAV-TECHNICIEN-
  // SANS-ENTREES-BUREAU) — `/planning` lui est fermé par D221 comme le reste
  // du segment ; `/terrain` est la seule destination que ce rôle garde ici.
  const accueil = role === Role.technicien ? "/terrain" : "/planning";

  return (
    <FournisseurNavigationMobile>
      {/*
        LE LIEN D'ÉVITEMENT (99E-EVITEMENT, audit du 25/09, constat 39) —
        PREMIER élément focalisable de la coque, avant la barre de
        navigation : masqué (`sr-only`) tant qu'il n'a pas le focus, visible
        dès qu'un clavier l'atteint (`focus:not-sr-only`). Il cible le
        `<main id="contenu">` posé par `components/mise-en-page/page.tsx`.
      */}
      <a
        href="#contenu"
        className="focus:bg-app-surface focus:text-app-marque sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:border-app-bord focus:px-4 focus:py-2 focus:text-[13px] font-bold focus:underline"
      >
        {t("navigation.aller_au_contenu")}
      </a>
      <div className="flex min-h-dvh">
        <BarreDeNavigation
          theme={theme}
          initiales={initiales}
          entrees={ENTREES}
          role={role}
          accueil={accueil}
          decomptes={decomptes}
        />
        <div className="min-w-0 flex-1">
          <BandeauMobile />
          <BandeauBureau role={role} />
          <LargeurUtile>{children}</LargeurUtile>
          {/* LA RÉSERVE DE LA BARRE BASSE (QE-6a, 9DV-TP-NAV4-TELEPHONE-
              GLOSSAIRE) — 64 px, SA PROPRE hauteur exactement (`h-16` ci-
              dessous dans `BarreBasseBureau`) : une marge posée À CÔTÉ de
              `LargeurUtile`, jamais une classe ajoutée à sa chaîne, pour ne
              jamais faire dépendre ce lot de l'ordre dans lequel Tailwind
              range deux utilitaires `pb-*` en conflit. */}
          <div className="h-16 min-[901px]:hidden" aria-hidden />
        </div>
      </div>
      <BarreBasseBureau role={role} />
    </FournisseurNavigationMobile>
  );
}
