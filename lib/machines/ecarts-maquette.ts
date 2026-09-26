/**
 * L'ÉCRAN « PARC » DIT CE QUE LA MAQUETTE DIT, moins les écarts nommés
 * (AT-04 ; réécrit N-10, D125).
 *
 * ## CE QUE D125 REND CADUC ICI
 *
 * Jusqu'à N-10, ce fichier confrontait le TABLEAU à huit colonnes de
 * `CODIPLAN_Maquette.html` (D95) — la seule disposition alors autorisée pour
 * cet écran. D125 fait de `codiplan-maquette-complete.html` la source de la
 * disposition de `/parc`, et sa fonction `parc()` ne dessine plus un tableau
 * mais un MAÎTRE-DÉTAIL : `COLONNES_PARC`, `KPI_PARC` et leurs deux listes
 * d'écarts de colonnes/KPI (« Compteur », « Contrat », « Sous contrat »)
 * n'ont plus de tableau à décrire, et sont RETIRÉS plutôt qu'empilés à côté
 * d'une nouvelle liste — la même règle que D124 applique déjà aux gardiens de
 * couleur : réorienté, jamais assoupli, jamais laissé en double.
 *
 * Les TROIS KPI existent toujours, autrement : ils sont désormais des clés du
 * dictionnaire choisies directement par `app/(back-office)/parc/page.tsx`
 * (`parc.kpi_affichees`, `parc.kpi_garantie`, `parc.kpi_en_panne`), confrontées
 * par le gardien de composition (`tests/unit/machines/composition-parc.
 * test.ts`) plutôt que par une liste ici : il n'y a plus de « KPI absent » à
 * nommer, les trois de la maquette ont un fait réel derrière chacun.
 *
 * ## TROIS POPULATIONS, TROIS LISTES — la même raison qu'avant
 *
 * `lib/navigation/entrees.ts` désigne un `<button>` de `.nav` ; celui-ci
 * désigne maintenant deux populations propres au maître-détail : les ACTIONS
 * du bandeau (`<button>` de `head()`), et les CHAMPS du `dl.kv` de l'aperçu.
 * Aucune des deux ne se mélange à l'autre, pour la raison déjà écrite ici
 * avant N-10 : mélanger deux formes de DOM laisserait un libellé en excuser
 * un autre par pure homonymie.
 */

export type EcartMaquette = {
  readonly libelle: string;
  readonly motif: string;
};

/**
 * L'ACTION DU BANDEAU QUE `/parc` NE REND PAS — liste close, UNE entrée
 * depuis le 18/09/2026 (AT-07 bis).
 *
 * `head()` de `parc()` posait deux `<button>` : « Scanner un QR code » et
 * « + Machine ». **Le second est un GAP COMBLÉ** — mesuré, pas supposé :
 * `app/(back-office)/parc/nouvelle` existe désormais, et `/parc` porte un
 * vrai lien (`LienPrimaire`) vers cet écran. « Scanner un QR code » reste
 * seul dans la liste : `app/api/machines/qr/[jeton]/route.ts` RÉSOUT un
 * jeton, il ne dessine aucun écran de lecture, et aucun encodeur d'image QR
 * n'existe dans le dépôt (`lib/machines/qr.ts` ne fabrique que le jeton).
 * **Un lien vers rien se lit comme une panne (R2-13)** : ce bouton-là reste
 * donc un écart nommé plutôt qu'un lien mort.
 */
export const ECARTS_MAQUETTE_ACTIONS_PARC: readonly EcartMaquette[] = [
  {
    libelle: "Scanner un QR code",
    motif:
      "N-11 — aucun écran de lecture de QR n'existe ; app/api/machines/qr/" +
      "[jeton]/route.ts résout un jeton, il ne dessine rien. Un encodeur " +
      "d'image QR n'existe pas non plus dans le dépôt (lib/machines/qr.ts " +
      "ne fabrique que le jeton).",
  },
];

/**
 * LE CHAMP ABSENT DU `dl.kv` DE L'APERÇU — liste close, une entrée.
 *
 * `machinePreview()` écrit six paires — Client, Site, N° de série, Famille,
 * Agence CODIMA, Contrat. Les cinq premières se lisent sur des colonnes
 * réelles (`lib/machines/depot.ts`, `CHAMPS_PARC`) ; aucune table de contrat
 * de maintenance n'existe (lot 4, même cause que l'ancien écart de colonne
 * du même nom). **L'entrée RESTE dans le `dl.kv`**, avec le signe d'absence
 * (`—`) — D125 demande que la STRUCTURE soit identique, et une absence qui se
 * lit comme une absence est exactement ce que ça veut dire.
 */
export const ECARTS_MAQUETTE_APERCU_PARC: readonly EcartMaquette[] = [
  {
    libelle: "Contrat",
    motif: "lot 4 — aucune table de contrat de maintenance n'existe encore",
  },
];

/**
 * CE QUE `/parc` REND ET QUE LA MAQUETTE NE DESSINE PAS — l'écart DANS
 * L'AUTRE SENS, et il se nomme aussi (N-10, §4).
 *
 * `parc()` montre quatre machines sans jamais paginer ; le produit en compte
 * plusieurs centaines et pagine depuis AT-07 — la pagination RESTE, sous la
 * liste maître. Le lien vers le registre des VGP n'est dessiné nulle part
 * dans `parc()` ; il reste aussi, seul appelant de `/vgp` depuis cet écran
 * (AT-04).
 */
export const ECARTS_MAQUETTE_AJOUTS_PARC: readonly EcartMaquette[] = [
  {
    libelle: "Pagination",
    motif:
      "la maquette montre quatre machines sans pagination ; le parc réel en " +
      "compte plusieurs centaines et pagine depuis AT-07 — retirer la " +
      "pagination pour ressembler à la maquette masquerait des machines",
  },
  {
    libelle: "Registre des vérifications périodiques",
    motif:
      "parc() ne le dessine pas ; c'est pourtant le seul appelant de /vgp " +
      "depuis cet écran (AT-04), et le retirer romprait ce chemin",
  },
  {
    libelle: "Intertitre de client dans la liste maître",
    motif:
      "parc() ne dessine aucun repère entre les lignes de `machine-list` ; " +
      "décision d'Alexis (99Z-GR10-PARC, 26/09/2026) — un intertitre non " +
      "cliquable à chaque changement de client, y compris pour un client " +
      "présent dans les deux parties de la liste (complètes puis " +
      "incomplètes depuis PARC-A). Le retirer effacerait le seul repère " +
      "visuel du tri par client que 99C-PARC-TRI a posé.",
  },
];

/* ────────────────────────────────────────────────────────────────────────
 * LA FICHE MACHINE — /parc/[id] contre machinePage() (N-11, D125, D126)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LE BOUTON DE L'EN-TÊTE QUE LA FICHE NE REND PLUS — liste close, VIDE
 * depuis le 18/09/2026 (AT-07 bis).
 *
 * `head()` de `machinePage()` pose deux boutons : « ← Retour au parc » et
 * « Modifier ». **Les deux mènent désormais quelque part** — mesuré, pas
 * supposé : `app/(back-office)/parc/[id]/modifier` existe, et
 * `lib/machines/depot.ts` porte `modifierMachine`, appelant de
 * `modifierMachineDans`. La liste reste déclarée, VIDE plutôt que
 * supprimée : un gardien qui la confrontait à la maquette a mesuré ce gap et
 * doit pouvoir mesurer qu'il n'y en a plus, sans qu'un import se casse.
 */
export const ECARTS_MAQUETTE_ACTIONS_FICHE: readonly EcartMaquette[] = [];

/**
 * LE CONTENU DU `dl.kv` QUE D126 CHANGE, CÔTÉ CONTENU — liste close, une
 * entrée. D125 gouverne la FORME du `dl.kv` (deux colonnes, huit paires) ;
 * D126 gouverne ce qu'il PORTE, et une décision d'exploitation postérieure à
 * D125 en écarte une paire par rapport au texte littéral de `machinePage()`.
 *
 * `machinePage()` pose « Identifiant » en tête du `dl.kv` (`m.id`). D126
 * retire cette entrée : la référence interne reste affichée, mais dans la
 * `.machine-banner`, en chasse fixe et en gris — exactement là où la
 * maquette la place déjà (`<div class="mono muted">${m.id}</div>`). La
 * répéter dans le `dl.kv` ferait doublon avec la bannière, et D126 lui
 * préfère cinq faits de gestion (famille, marque, référence, numéro de
 * série, année de vente) qu'Alexis a demandés en tête du même bloc.
 */
export const ECARTS_MAQUETTE_CONTENU_FICHE: readonly EcartMaquette[] = [
  {
    libelle: "Identifiant (dl.kv)",
    motif:
      "D126 (18/09/2026) — la référence interne reste affichée, mais dans " +
      "la bannière (mono, grise), pas dans le dl.kv, où elle ferait doublon " +
      "; le dl.kv s'ouvre à la place sur famille, marque, référence, " +
      "numéro de série et année de vente, demandés par l'exploitation.",
  },
];

/**
 * CE QUE LA FICHE REND ET QUE LA MAQUETTE NE DESSINE PAS — l'écart DANS
 * L'AUTRE SENS (N-10, §4, appliqué à la fiche).
 *
 * La carte « Documents » porte L8-02 (les documents d'une machine et de son
 * modèle) ; `machinePage()` ne la dessine pas. Elle N'EST PAS un ajout
 * gratuit qui s'efface pour ressembler à la maquette : c'est un module déjà
 * livré, avec son propre ticket et sa propre trace d'audit, et le retirer
 * romprait le seul écran qui l'affiche.
 */
export const ECARTS_MAQUETTE_AJOUTS_FICHE: readonly EcartMaquette[] = [
  {
    libelle: "Documents",
    motif:
      "porte L8-02 — les documents d'une machine et de son modèle ; " +
      "machinePage() ne la dessine pas, et la retirer ferait disparaître " +
      "le seul écran qui expose ce module déjà livré.",
  },
];
