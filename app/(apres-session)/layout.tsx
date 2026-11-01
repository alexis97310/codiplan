import { LargeurUtile } from "@/components/mise-en-page/largeur-utile";

/**
 * LE SEGMENT DES ÉCRANS D'APRÈS-SESSION SANS CHROME (9IB-ARRIVEE-HORS-
 * BACK-OFFICE, audit du 28/10/2026, constat M6, ticket T8).
 *
 * **Un seul écran y habite aujourd'hui : `/arrivee`.** Il suit une session
 * déjà ouverte — ce n'est donc pas `(sans-session)` — mais n'affiche ni
 * barre latérale, ni recherche, ni pied : c'est « qui vous êtes, pour quelle
 * société, et rien d'autre » (L1-02f), et le chrome du back-office le
 * dessinait comme un écran de travail alors que la maquette ne le prévoit
 * pas.
 *
 * **Ce n'est PAS un contrôle d'accès**, exactement comme `(sans-session)/
 * layout.tsx` le dit déjà pour les écrans qui précèdent la session : ce qui
 * donne ou refuse ses données reste `etatArrivee`, les politiques et
 * `exigerContexteActif`, jamais le groupe de routes qui héberge l'écran.
 *
 * Même mise en page que `(sans-session)` — `LargeurUtile` seule, aucune
 * barre — mais un segment DISTINCT : les deux répondent à des questions
 * différentes (« y a-t-il une session ? » contre « cette session a-t-elle
 * de quoi naviguer ? »), et les mêler masquerait au gardien de R2-16
 * (`tests/unit/app/barre-par-segment.test.ts`) lequel des deux motifs est en
 * jeu si l'un des deux change un jour de forme.
 */
export default function MiseEnPageApresSession({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <LargeurUtile className="flex flex-1 flex-col">{children}</LargeurUtile>
    </div>
  );
}
