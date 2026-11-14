import type { DetailNonConforme } from "./non-conformite";
import { t } from "@/lib/i18n/fr";
import type { ReponseDeChecklist } from "./depot";

/**
 * LA RÉPONSE CONNUE DU SERVEUR, RAMENÉE À LA SEULE VALEUR UTILE À SON TYPE
 * (9K21-CHECKLIST-TERRAIN-SAISIE, CK5 ; partagée avec l'instantané hors
 * réseau depuis 9K22-CHECKLIST-HORS-RESEAU, CK6) — `ReponseDeChecklist`
 * porte les cinq colonnes à la fois (une seule non nulle, I1 §3) ; l'écran
 * n'a besoin que de celle que `typeReponse` désigne. `null` si aucune
 * réponse n'existe encore pour ce point.
 *
 * Deux appelants, UNE SEULE fonction (§9, 01/09) : `app/(mobile)/terrain/
 * [id]/page.tsx` (la fiche en ligne) et `app/api/terrain/instantane/
 * route.ts` (la copie emportée hors réseau) doivent composer la MÊME valeur
 * depuis la MÊME réponse, jamais deux lectures qui pourraient diverger.
 *
 * `conforme_non_conforme_sans_objet` rend l'objet `DetailNonConforme`
 * (9L04I-CHECKLIST-NON-CONFORME-DETAIL) DÈS que la suite ou le commentaire
 * porte une valeur — sinon la simple chaîne, comme avant (`ChecklistTerrain`
 * sait lire les deux formes, voir `lib/checklists/non-conformite.ts`).
 */
export function valeurChecklistAffichee(
  typeReponse: string,
  reponse: ReponseDeChecklist | undefined,
): string | number | boolean | DetailNonConforme | null {
  if (reponse === undefined) {
    return null;
  }
  switch (typeReponse) {
    case "conforme_non_conforme_sans_objet": {
      if (reponse.valeurConforme === null) {
        return null;
      }
      if (
        reponse.nonConformiteSuite === null &&
        reponse.nonConformiteCommentaire === null
      ) {
        return reponse.valeurConforme;
      }
      return {
        conforme: "non_conforme",
        suite: reponse.nonConformiteSuite,
        commentaire: reponse.nonConformiteCommentaire,
      };
    }
    case "valeur_mesuree":
      return reponse.valeurMesuree === null
        ? null
        : Number(reponse.valeurMesuree);
    case "case_faite":
      return reponse.valeurFait ?? null;
    case "choix_dans_une_liste":
      return reponse.valeurChoix;
    case "texte_libre":
      return reponse.valeurTexte;
    // LE NOMBRE DE PHOTOS DÉJÀ LIÉES (9K28-CHECKLIST-REPONSE-PHOTO) — `null`
    // tant qu'aucune n'est encore liée, exactement comme les autres types :
    // c'est ce qui permet à `valeursInitiales` (`checklist-terrain.tsx`) de
    // compter ou non ce point comme répondu.
    case "photo":
      return reponse.nombrePhotos > 0 ? reponse.nombrePhotos : null;
    default:
      return null;
  }
}

/**
 * « 13 conformes, 2 non conformes, 1 sans objet » (CK8, point 3 du ticket) —
 * UNIQUEMENT les réponses « conforme/non conforme/sans objet » ; les
 * mesures, cases et textes n'entrent dans aucun des trois comptes.
 *
 * DÉPLACÉE de `components/interventions/bon-tuiles.tsx` vers ce module, SANS
 * dépendance Prisma (9L04H-TERRAIN-RECAPITULATIF-SIGNATURE) — le récapitulatif
 * terrain, un composant CLIENT (`rapport-automatique.tsx`), doit pouvoir
 * composer le MÊME texte que le bon sans entraîner `lib/checklists/depot.ts`
 * (et son client Prisma) dans le paquet du navigateur. `bon-tuiles.tsx`
 * réexporte cette fonction pour ses appelants existants.
 */
export function resumeChecklistBon(resume: {
  readonly conformes: number;
  readonly nonConformes: number;
  readonly sansObjet: number;
}): string {
  const virgule = t("ponctuation.virgule");
  return (
    `${resume.conformes} ${t("checklist.bon.resume_conformes")}${virgule}` +
    `${resume.nonConformes} ${t("checklist.bon.resume_non_conformes")}${virgule}` +
    `${resume.sansObjet} ${t("checklist.bon.resume_sans_objet")}`
  );
}
