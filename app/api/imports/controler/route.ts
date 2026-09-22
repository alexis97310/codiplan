import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import {
  MOTIF_TELEVERSEMENT,
  lireLeTeleversement,
} from "@/lib/imports/televersement";
import { controlerFeuille } from "@/lib/excel/controle";
import { lireClasseur } from "@/lib/excel/classeur";
import { enregistrerLeControle } from "@/lib/imports/depot";
import { gabaritDuMarqueur, refusSansGabarit } from "@/lib/imports/modeles";
import { PARC_VIDE, indexerLeParcCible } from "@/lib/imports/parc-cibles";
import { indexerLesParcs } from "@/lib/imports/parcs";

import { champ } from "../../interventions/actions";

/**
 * TÉLÉVERSER UN CLASSEUR ET EN PRODUIRE LE RAPPORT (L1-11 ; I6, RG-IMP-01).
 *
 * **Cette route ne CRÉE aucune fiche.** Elle lit, elle contrôle, elle
 * enregistre un rapport — et elle s'arrête là. *C'est la première moitié de
 * I6, et la séparer de la seconde est tout l'objet du ticket* : un import qui
 * écrirait dans la foulée du téléversement n'aurait jamais été validé par
 * personne.
 *
 * ## LE MARQUEUR CHOISIT LE GABARIT (R6-01 ; sept depuis R6-03, huit depuis REPRISE-HISTORIQUE)
 *
 * **Elle était câblée sur `MODELE_CLIENTS`**, et l'argument écrit ici était
 * juste le jour où il a été écrit : *« accepter un fichier de contacts
 * produirait un rapport qu'aucun bouton ne pourrait appliquer — un écran qui
 * promet et ne tient pas. »* Il tenait parce qu'une seule application existait.
 *
 * **Sa conséquence, elle, n'avait pas été mesurée** : les quatre autres
 * gabarits n'avaient **aucun appelant**. `modeleSites`, `modeleModeles`,
 * `modelePrestations` et `modeleContacts` étaient écrits, éprouvés, et
 * inatteignables — *mesuré le 16/09/2026 en contrôlant une feuille de sites par
 * ce chemin : anomalie `marqueur_autre_type`, c'est-à-dire un fichier de sites
 * refusé à la première cellule.* C'est la maladie que R3-12 nomme : une couche
 * qu'aucun humain n'atteint.
 *
 * **L'argument reste vrai pour les CONTACTS, et il est rendu à son vrai
 * endroit** : `SANS_APPLICATION` porte le motif, l'écran ne montre pas le
 * bouton, et la route d'application refuse. *Un rapport de contacts est produit
 * et dit ce qu'il ferait* — ce qui est plus utile qu'un fichier refusé à la
 * première cellule, et ne promet rien : il n'y a pas de bouton.
 *
 * **Le PARC dépend du type, et c'est ce qui décide création ou modification.**
 * Un gabarit veut deux choses de la base, et ce ne sont pas les mêmes : les
 * PARENTS qu'une cellule désigne, et la CIBLE qui existe peut-être déjà.
 * *Passer l'index des clients comme parc d'un lot de sites ferait de chaque
 * ligne une création* — donc un doublon par ligne au second import, ce que
 * RG-IMP-05 interdit.
 *
 * **La feuille lue est la PREMIÈRE, et c'est le MARQUEUR qui juge.** Un gabarit
 * que CODIPLAN publie porte `CODIPLAN-<type>-v<n>` en A1 (D31) ; si le fichier
 * n'est pas celui qu'on croit, `controlerFeuille` le refuse à la première
 * cellule, avant d'avoir compté quoi que ce soit. *Chercher une feuille par son
 * nom aurait ajouté une seconde règle d'identification à côté de celle qui
 * existe*, et deux lectures d'un même critère divergent en silence (§9, 01/09).
 *
 * **Aucun octet n'est conservé.** `import_lot.objet_cle` reste nulle : le
 * stockage d'objets n'a aucun appelant, et *une place réservée est une décision
 * prise par personne*. Le classeur vit le temps de la requête.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const versLIndex = (cle: string, valeur?: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location:
          `/imports?motif=${encodeURIComponent(cle)}` +
          (valeur === undefined ? "" : `&valeur=${encodeURIComponent(valeur)}`),
      },
    });

  const contexte = await exigerCapacite("importer_exporter");
  if (contexte === null) {
    return versLIndex("auth.refus");
  }

  const formulaire = await requete.formData();
  const televerse = await lireLeTeleversement(formulaire.get("classeur"));
  if (!televerse.accepte) {
    return versLIndex(`imports.refus.${televerse.motif}`);
  }

  // *Le nom du fichier est une donnée de l'appelant* : il est repris tel quel
  // dans le rapport, jamais interprété — ni pour deviner le type, ni pour
  // chercher une feuille. `classeurTeleverse` l'a déjà borné en longueur.
  const nom = champ(formulaire, "nom") ?? televerse.nom;

  const feuilles = await lireClasseur(televerse.octets);
  const premiere = feuilles[0];
  if (premiere === undefined) {
    return versLIndex(`imports.refus.${MOTIF_TELEVERSEMENT.sansFeuille}`);
  }

  // Les parcs de PARENTS sont lus d'un bloc : ils servent à construire les
  // gabarits, et le type n'est pas encore connu. *La liste vit dans
  // `lib/imports/parcs.ts`* (REPRISE-HISTORIQUE) — elle était recopiée ici et
  // dans deux scénarios, et un neuvième index l'aurait fait diverger.
  const parcs = await indexerLesParcs(contexte);

  const marqueur = premiere.lignes[0]?.[0];
  const modele = gabaritDuMarqueur(marqueur, parcs);
  if (modele === null) {
    // *Aucun des dix gabarits ne répond à ce marqueur.* Deux situations, et le
    // lecteur n'a pas les mêmes gestes (REPRISE-HISTORIQUE, mesuré en
    // production le 22/09/2026) : un marqueur LISIBLE d'un type que cette
    // version ne publie pas — *rien à corriger, ce type n'est pas encore
    // importable*, et le type est NOMMÉ — ou une cellule qui n'est pas un
    // marqueur, dont la grammaire dit déjà ce qui manque.
    const refus = refusSansGabarit(marqueur);
    return versLIndex(`import.anomalie.${refus.code}`, refus.type);
  }

  // **LE PARC DE LA CIBLE**, choisi par le type du gabarit — jamais l'index des
  // clients pour tout le monde. *La correspondance vit dans
  // `lib/imports/parc-cibles.ts`, à côté des index qu'elle nomme, et un gardien
  // la confronte aux types qu'on sait appliquer* : l'écrire ici en ferait une
  // seconde table, à la main, dans une route.
  const parc = (await indexerLeParcCible(contexte, modele.type)) ?? PARC_VIDE;
  const controle = controlerFeuille(premiere, modele, parc);
  if (!controle.lisible) {
    // *Le rapport d'un fichier illisible n'est pas enregistré*, et c'est la
    // règle du module de contrôle reprise ici : il n'a compté aucune ligne, il
    // n'y a donc rien à valider plus tard. L'écran redit ce qui bloque.
    const anomalie = controle.anomalies[0];
    return versLIndex(
      anomalie === undefined
        ? `imports.refus.${MOTIF_TELEVERSEMENT.illisible}`
        : `import.anomalie.${anomalie.code}`,
    );
  }

  const { lotId } = await enregistrerLeControle(
    contexte,
    { nom, type: modele.type, version: modele.version },
    controle.lignes,
  );
  return new Response(null, {
    status: 303,
    headers: { Location: `/imports/${lotId}` },
  });
}
