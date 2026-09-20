import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { typeDuLot } from "@/lib/imports/depot";
import { applicationDuType } from "@/lib/imports/types-dimport";

/**
 * LA DURÉE QUE CETTE ROUTE DÉCLARE (point 2 de la session du 16/09/2026 ;
 * révisé le même jour, suite — le premier déploiement Vercel a refusé 1 200).
 *
 * **Une transaction autorisée à durer plus longtemps que la fonction qui la
 * porte ne sert à rien, et l'inverse non plus.** Cette valeur DOIT être un
 * littéral : Next.js analyse `maxDuration` statiquement et refuse de
 * construire dès qu'il lit un identifiant importé plutôt qu'un nombre —
 * *mesuré au premier `pnpm build`* : « Next.js can't recognize the exported
 * `config` field […] Unknown identifier ». **Ce n'est donc pas la seule
 * source du nombre** : `DUREE_MAXIMALE_S`, dans `lib/imports/delais.ts`, l'est
 * — et `tests/unit/imports/delais-application.test.ts` relit CE fichier en
 * texte pour vérifier que le littéral ci-dessous vaut la même chose, ET qu'il
 * ne dépasse pas `PLAFOND_PLATEFORME_S` (300, Vercel Hobby). **La seconde
 * confrontation est celle qui manquait** : `pnpm build` compile un
 * `maxDuration` de 1 200 sans se plaindre — il ne connaît pas la limite de
 * l'hébergeur, seule Vercel l'applique, au déploiement, trop tard pour que la
 * CI le voie. Une seconde constante qui diverge en silence (§9, 01/09) serait
 * ici invisible à `pnpm typecheck` ET à `pnpm build` ; c'est le gardien qui
 * la voit.
 */
export const maxDuration = 300;

/**
 * APPLIQUER UN LOT — LA SECONDE MOITIÉ DE I6 (L1-11 ; RG-IMP-01, RG-IMP-04).
 *
 * **C'est le SECOND geste, et il porte toute la valeur du premier.** I6 veut un
 * rapport, *puis* une validation explicite ; cette route est cette validation.
 * Elle ne reçoit ni fichier, ni ligne, ni décompte : **seulement l'identifiant
 * du lot que l'écran vient de montrer.** *Lui passer quoi que ce soit d'autre
 * rouvrirait l'écart entre ce qu'un humain a validé et ce qui sera écrit.*
 *
 * **Elle ne décide rien**, et l'application non plus : la décision a été prise
 * par `lib/excel/controle.ts` et posée sur `import_lot_ligne.action`.
 *
 * ## ELLE LIT `type_import`, ET C'EST R6-01 QUI L'A MISE À LE FAIRE
 *
 * Jusqu'au 16/09/2026 elle appelait `appliquerLeLotDeClients` **sans
 * condition** — quel que soit le type du lot. *Mesuré avant d'être réparé*, sur
 * un lot de sites réellement enregistré, sous le rôle applicatif :
 *
 * | Les lignes du lot | Ce qui se produisait |
 * |---|---|
 * | des **créations** | `schemaCreationClient` LÈVE sur `raison_sociale`, la transaction est annulée, le lot reste `controle` — une **erreur 500**, rien d'écrit |
 * | des **modifications** | **aucune levée** : `{applique: true, creations: 0, modifications: 0}`, et le lot passe à `applique` avec sa date |
 *
 * **C'est la seconde qui coûte**, et ce n'était aucune des deux issues que le
 * ticket avait envisagées : le référentiel n'est pas corrompu — rien n'est
 * écrit —, mais *le lot est BRÛLÉ*. Le cliquet est irréversible, l'écran
 * propose désormais « Annuler » sur un lot qui n'a rien fait, et il faut
 * reprendre le fichier au début. **Le silence a exactement la forme du succès**
 * (§9, 31/08).
 *
 * *Ce que la mesure a aussi dit : par le chemin HTTP, aucun lot d'un autre type
 * ne pouvait naître* — la route de contrôle était câblée sur `MODELE_CLIENTS`,
 * et une feuille de sites était refusée en `marqueur_autre_type`. Le défaut
 * était donc LATENT, et il devenait réel à l'instant exact où l'on apprenait à
 * cette route-là les quatre autres gabarits. *R6-01 fait les deux dans le même
 * geste, ce qui est la seule façon de ne pas ouvrir la porte avant de poser le
 * verrou.*
 *
 * ## UN TYPE SANS APPLICATION N'ARRIVE PAS ICI, ET LE REFUS EXISTE QUAND MÊME
 *
 * L'écran ne montre pas le bouton (`TYPES_DIMPORT`), mais *un formulaire posté
 * à la main n'est pas un formulaire impossible* : la route refuse avec son
 * motif, et c'est elle qui garde. **L'écran ne propose pas l'impossible ; il ne
 * l'interdit pas.**
 *
 * **Le refus revient sur le lot, avec son motif.** Un lot déjà appliqué, un lot
 * annulé, un lot introuvable — les trois se lisent, et ils ne se corrigent pas
 * au même endroit. *Rediriger vers la liste ferait perdre de vue lequel des
 * lots a refusé.*
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(_requete, params));
}

async function traiter(
  _requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const versLeLot = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/imports/${encodeURIComponent(id)}?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await exigerCapacite("importer_exporter");
  if (contexte === null) {
    return versLeLot("auth.refus");
  }

  // Le type d'un lot d'une AUTRE société est `null`, comme celui d'un lot qui
  // n'existe pas : *les distinguer ferait un oracle* (D35, D50), et le refus
  // rendu est celui que l'application rendrait elle-même.
  const type = await typeDuLot(contexte, id);
  if (type === null) {
    return versLeLot("imports.refus.lot_introuvable");
  }
  const application = applicationDuType(type);
  if (application === null) {
    return versLeLot("imports.refus.type_sans_application");
  }

  const resultat = await application.appliquer(contexte, id);
  if (!resultat.applique) {
    return versLeLot(`imports.refus.${resultat.motif}`);
  }
  return versLeLot("imports.applique");
}
