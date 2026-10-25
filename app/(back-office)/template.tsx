import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { exigerSessionActive } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { lireIntervention } from "@/lib/interventions/depot";
import {
  fermeAuTechnicienParD221,
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
 * reçoit jamais, par `params`, de quoi distinguer lequel a matché) ; elle vit
 * maintenant dans `fermeAuTechnicienParD221` (`lib/navigation/
 * redirection-technicien.ts`), relue par ce fichier EXACTEMENT comme avant.
 *
 * **CE DÉPLACEMENT SEUL NE SUFFISAIT PAS À TOUT FERMER (9G8D) — FERMÉ PAR
 * 9G8E-NAV-TECHNICIEN-SANS-ENTREES-BUREAU, PAR L'AUTRE BOUT.** 9G8D mesurait
 * qu'un clic sur une entrée de la colonne, PENDANT la fenêtre de
 * préchargement automatique de `<Link>`, continuait de rendre le contenu
 * interdit sans qu'aucune requête ne reparte vers le serveur — ni ce fichier,
 * ni `middleware.ts`. Décision d'Alexis (25/10/2026, ~15h20) : plutôt que de
 * poursuivre la chasse au cache du routeur, retirer du technicien les liens
 * eux-mêmes — `components/navigation/entrees.ts` (devenu `entreesAffichables`
 * conscient de D221) et `components/navigation/menu-creer.tsx` ne rendent
 * plus aucun lien vers une route que CE garde lui fermerait, en relisant la
 * MÊME fonction, `fermeAuTechnicienParD221`. Sans lien, rien à précharger —
 * le garde ci-dessous reste la DERNIÈRE ligne (une URL tapée à la main, ou
 * un signet, l'atteint toujours), mais la fenêtre de précharge n'a plus de
 * lien à exploiter.
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
    if (fermeAuTechnicienParD221(chemin, recherche)) {
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
