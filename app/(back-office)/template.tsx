import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { exigerSessionActive } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { lireIntervention } from "@/lib/interventions/depot";
import {
  CHEMIN_EXEMPTE_DU_GARDE_TECHNICIEN,
  declarationAbsenceOuverteAuTechnicien,
  idInterventionDuChemin,
} from "@/lib/navigation/redirection-technicien";

/**
 * LE GARDE TECHNICIEN DE D221, PORTÉ ICI DEPUIS `layout.tsx` (9G8D-GARDE-
 * TECHNICIEN-PAGES) — MESURÉ : une navigation DOUCE (`<Link>`) depuis
 * `/absences?declarer=1` vers `/planning` atteignait le tableau complet,
 * sans redirection. `app/(back-office)/layout.tsx` est un LAYOUT : App
 * Router en garde l'instance au travers d'une navigation entre pages du même
 * segment, et ne le réexécute donc pas — le garde qui y vivait ne jugeait
 * alors QUE le premier rendu (chargement direct, rafraîchissement), jamais
 * les clics qui suivent.
 *
 * Un `template.tsx`, lui, est RECRÉÉ à chaque navigation, douce ou dure, à
 * l'intérieur du même layout (c'est tout ce qui le distingue de lui, et
 * exactement ce que demande ce garde) — ce fichier ne porte donc QUE lui,
 * jamais le chrome (colonne, bandeaux), qui reste en place dans `layout.tsx`
 * pour ne pas le recréer à chaque clic.
 *
 * La logique elle-même n'a pas changé — ni D221, ni la précision du
 * 24/10/2026 sur `/absences?declarer=1` : mêmes exemptions, même lecture de
 * `x-chemin`/`x-recherche` posés par `middleware.ts` pour la même raison
 * qu'avant (un ancêtre de plusieurs dossiers `[id]` mutuellement exclusifs ne
 * reçoit jamais, par `params`, de quoi distinguer lequel a matché).
 *
 * **Ce déplacement seul ne suffit PAS À TOUT FERMER — mesuré, pas supposé,
 * et NON RÉSOLU à ce jour (9G8D, passation du 25/10/2026 23h NC).** Un clic
 * sur une entrée de la colonne, PENDANT la fenêtre de préchargement
 * automatique de `<Link>` (quelques secondes après le montage de la page),
 * continue de rendre le contenu interdit SANS qu'aucune nouvelle requête —
 * ni ce fichier, ni même `middleware.ts` — ne reparte vers le serveur :
 * confirmé en désactivant `experimental.staleTimes.dynamic` (aucun effet) et
 * en posant `prefetch={false}` sur l'entrée de la colonne
 * (`components/navigation/barre.tsx`, `Entree`) — effet partiel seulement,
 * une autre source de précharge (au moins la marque, qui vise `/planning`)
 * alimente le même cache. Ce fichier corrige la cause que le ticket nommait
 * (le layout ne se réexécute pas) et reste la place correcte pour ce garde ;
 * il ne ferme pas la seconde cause, plus profonde, mesurée en même temps. Un
 * prochain lot doit soit identifier pourquoi le cache client du routeur sert
 * ce contenu malgré `dynamic: 0`, soit retirer toute précharge des entrées
 * de la colonne pour un technicien, soit déplacer la décision dans
 * `middleware.ts` lui-même (seul point qui a confirmé s'exécuter à chaque
 * préchargement).
 */
export default async function GardeTechnicienBureau({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const contexteTechnicien = await exigerSessionActive();
  if (
    contexteTechnicien !== null &&
    contexteTechnicien.role === Role.technicien
  ) {
    const entetesRequete = await headers();
    const chemin = entetesRequete.get("x-chemin") ?? "";
    const recherche = entetesRequete.get("x-recherche") ?? "";
    if (
      chemin !== CHEMIN_EXEMPTE_DU_GARDE_TECHNICIEN &&
      !declarationAbsenceOuverteAuTechnicien(chemin, recherche)
    ) {
      const idIntervention = idInterventionDuChemin(chemin);
      const interventionAffectee =
        idIntervention === null
          ? null
          : await lireIntervention(contexteTechnicien, idIntervention);
      redirect(
        interventionAffectee === null
          ? "/terrain"
          : `/terrain/${idIntervention}`,
      );
    }
  }

  return children;
}
