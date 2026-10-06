import Link from "next/link";

import { Icone } from "@/components/ui/icone";
import { peut, type Capacite } from "@/lib/auth/habilitations";
import type { Role } from "@/lib/auth/roles";
import { t, type CleTraduction } from "@/lib/i18n/fr";

/**
 * LE BOUTON « + » FLOTTANT, AU TÉLÉPHONE (QE-6b, 9DV-TP-NAV4-TELEPHONE-
 * GLOSSAIRE, décision 9 du pilote du 03/10/2026, D172) — sur une page de
 * liste QUI N'A PAS DÉJÀ un bouton de création visible, vers LA création
 * correspondante, et seulement si la capacité le permet.
 *
 * **MESURÉ SUR MAIN AVANT CE LOT : AUCUNE PAGE DE LISTE N'EN A BESOIN
 * AUJOURD'HUI.** `/interventions`, `/clients`, `/sites`, `/parc` et
 * `/demandes` portent déjà, dans leur en-tête (`actions` de `Page`), un
 * `LienPrimaire` vers leur création — visible à toute largeur, y compris au
 * téléphone (`actions` ne se masque jamais sous 901 px, seul `.has-sticky
 * .page-head .actions` de la maquette le ferait, et aucun de ces écrans n'est
 * « sticky »). `/absences` déclare l'absence de ce bouton comme un ÉCART
 * NOMMÉ (`lib/absences/ecarts-maquette.ts`) — son geste de création est un
 * formulaire déjà sur la page, pas une navigation. `/vgp` n'a pas de création
 * SANS machine déjà choisie dans sa liste (voir le docblock de
 * `components/navigation/menu-creer.tsx`).
 *
 * **LA SEULE PAGE SANS AUCUN BOUTON DE CRÉATION, AU BUREAU COMME AU
 * TÉLÉPHONE, EST `/tableau-de-bord`** — la maquette du 28/09 le confirme :
 * `tableau-de-bord()` et `indicateurs()` sont les deux seules fonctions
 * d'écran de la maquette qui n'annoncent PAS `nofab: true`
 * (`maquette-toutes-pages.html:2903`, `:2919`, contre `:3018`, `:3144`,
 * `:3261`, `:3529`, `:3694`, `:3805`, `:3964`, `:4126`… qui l'annoncent tous).
 * Ce composant est donc posé sur `/tableau-de-bord`, vers la création la plus
 * centrale du produit — une nouvelle intervention, la même capacité et la
 * même route que la première option du menu « Créer » du bureau
 * (`components/navigation/menu-creer.tsx`).
 *
 * **Générique malgré ce constat** : une future page de liste sans bouton de
 * création n'a qu'à poser `<BoutonPlus href="…" capacite="…" libelle="…"
 * role={role} />` — rien à réécrire ici.
 */
export function BoutonPlus({
  href,
  capacite,
  libelle,
  role,
}: Readonly<{
  readonly href: string;
  readonly capacite: Capacite;
  /** Le libellé LU À VOIX HAUTE — ce bouton ne porte aucun texte visible. */
  readonly libelle: CleTraduction;
  readonly role: Role | null;
}>) {
  if (role === null || !peut(role, capacite)) {
    return null;
  }

  return (
    <Link
      href={href}
      aria-label={t(libelle)}
      className="bg-app-bleu-plein text-app-bleu-plein-encre fixed right-4 bottom-[78px] z-40 flex h-14 w-14 items-center justify-center rounded-[18px] shadow-lg min-[901px]:hidden"
    >
      <Icone nom="plus" taille={22} />
    </Link>
  );
}
