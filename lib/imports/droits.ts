import { type Capacite, peut } from "@/lib/auth/habilitations";
import { type Role } from "@/lib/auth/roles";

/**
 * LA CAPACITÉ D'ÉCRAN QU'UN TYPE D'IMPORT EXIGE, EN PLUS DE
 * « importer_exporter » (QT-3 de l'audit du 28/09/2026, D150).
 *
 * ## Ce que QT-3 corrige
 *
 * Les trois routes d'import qui ÉCRIVENT (`app/api/imports/controler`,
 * `[id]/appliquer`, `[id]/annuler`) n'exigeaient que « Importer / exporter en
 * masse ». Un responsable matériel ou SAV crée donc en masse des clients et
 * des sites que D130 lui refuse À L'UNITÉ ; un responsable ou l'ADV crée en
 * masse des familles, des modèles et des prestations que l'écran Paramètres
 * leur refuse. **L'import suit les droits de l'écran de son type** — c'est
 * QT-3, et c'est tout ce que D150 décide.
 *
 * `[id]/rejets`, en LECTURE SEULE, était restée hors de cette garde — un
 * oubli de D150, mesuré et corrigé par le lot 9DX-RETOUCHES-11 (R3,
 * amendement du 04/10/2026) : elle appelle désormais `peutImporterLeType`
 * exactement comme les trois routes d'écriture, le fichier qu'elle rend
 * portant le même contenu qu'un lot appliqué de ce type.
 *
 * ## Pourquoi « clients » et « sites » exigent `gerer_client_site`
 *
 * C'est la capacité de D130, posée sur les quatre routes unitaires
 * (`app/api/clients/*`, `app/api/sites/*`). L'import n'invente rien : il
 * reprend la même capacité, pour le même geste à la chaîne plutôt qu'à
 * l'unité.
 *
 * ## Pourquoi « familles », « modeles » et « prestations » exigent
 * `parametrer_societe`
 *
 * C'est la capacité que `app/api/parametres/materiel/{familles,modeles}` et
 * `app/api/parametres/prestations` exigent déjà. **Le `○` de la direction sur
 * cette capacité n'est pas tranché ici** : la porte (`exigerCapacite`) laisse
 * passer `peut()`, restreint compris, exactement comme sur l'écran
 * Paramètres aujourd'hui — PA-02 reste une décision de fin du §7 non rendue,
 * et ce fichier ne la préjuge pas.
 *
 * ## Pourquoi les cinq autres types n'exigent RIEN de plus
 *
 * `equipements`, `historique`, `vgp`, `vgp_observations` et `contacts` : QT-3
 * ne les nomme pas. Leur écran d'origine (la fiche machine, le registre, la
 * fiche VGP) n'a pas de capacité d'écriture unique et transposable — une
 * machine se crée depuis plusieurs écrans, sous `gerer_machine`, que
 * `importer_exporter` ne recouvre pas le même ensemble de rôles. **Inventer
 * une règle ici serait trancher une question que personne n'a posée** (§8) ;
 * `null` dit l'absence, et le motif ci-dessus dit pourquoi, pour que le jour
 * où QT-3 est étendue, ce ne soit pas un oubli qu'on corrige mais une
 * décision qu'on écrit.
 */
export const CAPACITE_DU_TYPE: Readonly<Record<string, Capacite | null>> = {
  clients: "gerer_client_site",
  sites: "gerer_client_site",
  familles: "parametrer_societe",
  modeles: "parametrer_societe",
  prestations: "parametrer_societe",
  equipements: null,
  historique: null,
  vgp: null,
  vgp_observations: null,
  contacts: null,
};

/**
 * CE RÔLE PEUT-IL IMPORTER CE TYPE ? (QT-3, D150).
 *
 * `importer_exporter` ET, si ce type en exige une, la capacité de son écran.
 * **Un type absent de `CAPACITE_DU_TYPE` est refusé** — pas un type qu'on
 * aurait simplement oublié de restreindre : `tests/unit/imports/droits-import.test.ts`
 * exige que la table porte EXACTEMENT les types que `lib/imports/` et l'écran
 * des imports connaissent, dans les deux sens, pour qu'aucun type neuf ne
 * puisse manquer cette table en silence.
 */
export function peutImporterLeType(role: Role, type: string): boolean {
  if (!peut(role, "importer_exporter")) return false;
  const capacite = CAPACITE_DU_TYPE[type];
  if (capacite === undefined) return false;
  if (capacite === null) return true;
  return peut(role, capacite);
}
