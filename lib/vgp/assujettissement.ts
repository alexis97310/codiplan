import { AssujettissementVgp } from "@prisma/client";
import { z } from "zod";

/**
 * L'ASSUJETTISSEMENT AUX VÉRIFICATIONS GÉNÉRALES PÉRIODIQUES (lot 9, D88).
 *
 * ## LE FAIT DONT TOUT DÉCOULE, ET IL EST D'EXPLOITATION
 *
 * Les VGP sont commandées par les **CLIENTS**, pas par CODIMA. CODIMA ne les
 * déclenche pas, ne les reçoit pas de droit, et n'apprend leur résultat que si
 * on le lui dit. *Une conception qui l'oublierait produirait un registre qui
 * ment.*
 *
 * ## CE MODULE NE REND JAMAIS UN VERDICT DE CONFORMITÉ (L9-01)
 *
 * Il ne rend que **ce qui a été déclaré** et **des dates**. Il n'existe ici
 * aucune fonction « cette machine est-elle conforme ? », et il ne doit jamais
 * en exister : *« conforme » ne s'affiche que parce qu'un organisme agréé l'a
 * écrit.* Déduire la conformité d'une règle que le produit porterait engagerait
 * une responsabilité que personne ne lui a donnée — dans un logiciel vendu à
 * d'autres sociétés, sur d'autres territoires, avec d'autres textes.
 *
 * ## AUCUNE PÉRIODICITÉ N'EST ÉCRITE DANS CE FICHIER (L9-05)
 *
 * Pas une constante, pas un défaut, pas un « en général ». La périodicité est
 * une donnée saisie par un humain, comme le taux horaire (D68) et la majoration
 * hors ouverture — le §8 du CLAUDE.md interdit d'inventer un délai.
 */

/** Les quatre valeurs, réexportées pour que le code nomme la notion. */
export const ASSUJETTISSEMENT = AssujettissementVgp;

/**
 * L'état de NAISSANCE d'une famille, et il n'est pas neutre.
 *
 * *Une case décochée est indiscernable d'une famille jamais examinée.* Écrit
 * ici pour que le code puisse dire « a-t-on regardé ? » sans recopier la
 * valeur — et pour que la liste des indéterminés (L9-03) se dérive d'une seule
 * source.
 */
export const NAISSANCE: AssujettissementVgp = AssujettissementVgp.a_determiner;

/** A-t-on regardé cette famille ? La moitié DÉTECTIVE du couple (L9-03). */
export function resteADeterminer(valeur: AssujettissementVgp): boolean {
  return valeur === NAISSANCE;
}

/**
 * LA SAISIE D'UN ASSUJETTISSEMENT DE FAMILLE (L9-03, L9-04, L9-05).
 *
 * La base porte la même règle par une contrainte, et ce n'est pas un doublon :
 * *une règle qui ne vit que dans la couche applicative n'en est pas une* — le
 * seed, une migration et une console passent tous par la base, aucun par Zod.
 * Ce que Zod ajoute est un refus LISIBLE, à l'endroit où quelqu'un saisit.
 *
 * **Le refus nomme ce qui manque**, et il le nomme séparément : « il manque la
 * périodicité » et « il manque le texte » ne se corrigent pas au même endroit,
 * et un refus qui les mêle n'apprend pas lequel a mordu (D50).
 */
export const schemaAssujettissementFamille = z
  .object({
    assujettissement: z.enum(AssujettissementVgp),
    /**
     * En MOIS, entier, strictement positif. Aucune borne haute : un texte
     * étranger peut fonder une périodicité que nous ne connaissons pas, et un
     * plafond inventé ici serait le délai que le §8 interdit.
     */
    periodiciteMois: z.number().int().positive().nullable(),
    referenceTexte: z.string().trim().min(1).nullable(),
  })
  .superRefine((saisie, ctx) => {
    if (saisie.assujettissement !== AssujettissementVgp.soumis) {
      return;
    }
    // LES TROIS AUTRES VALEURS N'EXIGENT RIEN, ET N'INTERDISENT RIEN NON PLUS :
    // une famille qu'on vient de déclarer NON soumise peut garder la trace du
    // texte qu'on a lu pour le décider. C'est une information, pas une
    // contradiction.
    if (saisie.periodiciteMois === null) {
      ctx.addIssue({
        code: "custom",
        path: ["periodiciteMois"],
        message: "vgp.periodicite_requise",
      });
    }
    if (saisie.referenceTexte === null) {
      ctx.addIssue({
        code: "custom",
        path: ["referenceTexte"],
        message: "vgp.reference_requise",
      });
    }
  });

export type SaisieAssujettissementFamille = z.output<
  typeof schemaAssujettissementFamille
>;

/**
 * LA PRÉCISION D'UN MODÈLE (L9-06) — il précise, il ne décide pas.
 *
 * Le modèle ne porte PAS d'assujettissement : la question se pose à la famille,
 * et lui donner une seconde réponse ferait deux lectures d'un même critère
 * (§9, 01/09). Ce qu'il peut préciser est la périodicité, parce que les
 * caractéristiques techniques vivent là.
 */
export const schemaPrecisionModele = z
  .object({
    periodiciteMois: z.number().int().positive().nullable(),
    referenceTexte: z.string().trim().min(1).nullable(),
  })
  .superRefine((saisie, ctx) => {
    if (saisie.periodiciteMois !== null && saisie.referenceTexte === null) {
      ctx.addIssue({
        code: "custom",
        path: ["referenceTexte"],
        message: "vgp.reference_requise",
      });
    }
  });

export type SaisiePrecisionModele = z.output<typeof schemaPrecisionModele>;

/**
 * L'EXCEPTION D'UN EXEMPLAIRE (L9-06) — et jamais sans sa raison.
 *
 * Les deux sens sont tenus, et le second est celui qu'on oublie : un motif sans
 * exception est une trace qui ne se rattache à rien, et qui survivrait au
 * retrait de l'exception qu'elle expliquait — la famille des exemptions
 * orphelines du §9 (31/08).
 */
export const schemaExceptionMachine = z
  .object({
    exception: z.enum(AssujettissementVgp).nullable(),
    motif: z.string().trim().min(1).nullable(),
  })
  .superRefine((saisie, ctx) => {
    if (saisie.exception !== null && saisie.motif === null) {
      ctx.addIssue({
        code: "custom",
        path: ["motif"],
        message: "vgp.motif_requis",
      });
    }
    if (saisie.exception === null && saisie.motif !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["exception"],
        message: "vgp.motif_orphelin",
      });
    }
  });

export type SaisieExceptionMachine = z.output<typeof schemaExceptionMachine>;

/** Ce qu'une machine hérite, et d'où cela vient. */
export type AssujettissementResolu = {
  readonly valeur: AssujettissementVgp;
  /** Le niveau qui a décidé — c'est lui qu'un écran doit citer. */
  readonly origine: "machine" | "famille";
  /** En mois. NULLE quand rien ne l'a fixée : jamais un défaut inventé. */
  readonly periodiciteMois: number | null;
  /** Le texte qui fonde la périodicité rendue, et jamais un autre. */
  readonly referenceTexte: string | null;
  /** Le niveau qui a fixé la périodicité — « modèle » précise, « famille » fonde. */
  readonly originePeriodicite: "modele" | "famille" | null;
};

/**
 * LA CASCADE : famille → modèle → machine, et elle rend son ORIGINE.
 *
 * **Pourquoi l'origine voyage avec la valeur.** Un assujettissement sans le
 * niveau qui l'a décidé est un nombre dont la signification dépend d'une autre
 * colonne (D56) : le jour où une famille change d'avis, personne ne saurait
 * quelles machines revoir. L'écran cite donc le niveau, et il le cite parce que
 * cette fonction le rend — pas parce que quelqu'un s'en souvient.
 *
 * **La machine fait EXCEPTION sur la VALEUR, jamais sur la périodicité.** Une
 * exception dit « ce n'est pas le même régime », pas « c'est le même régime à
 * un autre rythme » : le rythme se précise au modèle, où vivent les
 * caractéristiques techniques. *Le distinguer évite qu'une exception motivée
 * serve à contourner en silence une périodicité réglementaire.*
 */
export function resoudreAssujettissement(entree: {
  readonly famille: {
    readonly assujettissement: AssujettissementVgp;
    readonly periodiciteMois: number | null;
    readonly referenceTexte: string | null;
  };
  readonly modele: {
    readonly periodiciteMois: number | null;
    readonly referenceTexte: string | null;
  };
  readonly machine: {
    readonly exception: AssujettissementVgp | null;
  };
}): AssujettissementResolu {
  const precise = entree.modele.periodiciteMois !== null;
  return {
    valeur: entree.machine.exception ?? entree.famille.assujettissement,
    origine: entree.machine.exception === null ? "famille" : "machine",
    periodiciteMois: precise
      ? entree.modele.periodiciteMois
      : entree.famille.periodiciteMois,
    // LA RÉFÉRENCE SUIT LA PÉRIODICITÉ QU'ELLE FONDE, jamais l'autre. Rendre le
    // texte de la famille à côté du rythme du modèle serait une justification
    // qui ne justifie pas ce qu'elle accompagne.
    referenceTexte: precise
      ? entree.modele.referenceTexte
      : entree.famille.referenceTexte,
    originePeriodicite:
      entree.famille.periodiciteMois === null && !precise
        ? null
        : precise
          ? "modele"
          : "famille",
  };
}
