import { niveau, type Capacite } from "@/lib/auth/habilitations";
import { type ContexteActif } from "@/lib/auth/contexte";

/**
 * QUI LE PLANNING MONTRE — la restriction par PERSONNE, distincte du
 * cloisonnement par société (R5-01, RG-DRO-03).
 *
 * ## Ce que ce module est, et ce qu'il n'est pas
 *
 * La politique de `intervention` est de forme « parc » (D84) : elle décide
 * quelle SOCIÉTÉ, et pour un compte de portail quel CLIENT et quels SITES. Elle
 * ne dit rien de la PERSONNE — et c'est normal : *« mes interventions » n'est
 * pas un fait de cloisonnement, c'est un degré d'accès*, celui que la matrice
 * du §5.2 note `○` sur la ligne « consulter le planning ».
 *
 * **Ce n'est donc PAS une seconde lecture d'un critère que la base porte
 * déjà** — la distinction est ce qui autorise ce module à exister. Une
 * comparaison de société écrite au-dessus de la politique en serait une, et le
 * dépôt la refuse partout. Ici, rien en base ne répond à la question posée.
 *
 * ## POURQUOI LA MATRICE DÉCIDE, ET NON LA REQUÊTE
 *
 * R5-01 pose le choix en toutes lettres : *« ou bien le filtrage par capacité
 * arrive, ou bien la restriction est écrite dans la requête ; les deux se
 * défendent, et les mêler donnerait deux lectures d'un même critère »*.
 *
 * Elles ne sont pas mêlées : **la matrice décide, le dépôt applique**. Le
 * critère « qui est restreint » n'est écrit qu'ici, et il est LU de
 * `niveau(role, "consulter_planning")` plutôt que recopié — *`role ===
 * technicien` écrit dans une requête serait la recopie d'une ligne de matrice,
 * et elle deviendrait fausse le jour où un second rôle reçoit le `○` sans que
 * rien ne rougisse.*
 *
 * Et la matrice cesse par là d'être une couche sans appelant : elle n'en avait
 * qu'un — son propre scénario.
 *
 * ## TROIS VERDICTS, ET JAMAIS UN BOOLÉEN
 *
 * « Aucun accès » et « accès restreint » ne se corrigent pas au même endroit,
 * et un booléen les confondrait avec « accès complet » dans un sens ou dans
 * l'autre. Le troisième est celui qu'on oublie : les rôles du portail et les
 * rôles éditeur ne portent **aucun** `consulter_planning`, et un filtre par
 * personne leur rendrait zéro ligne — c'est-à-dire *la même chose qu'un
 * planning vide*, qui se lit « il n'y a rien » là où il faut lire « ce n'est
 * pas pour vous ».
 */
export type PerimetrePlanning =
  | { readonly acces: "complet" }
  | { readonly acces: "restreint"; readonly technicienId: string }
  | { readonly acces: "aucun" };

/**
 * Le périmètre que ce contexte ouvre sur UNE CAPACITÉ donnée — généralisé le
 * 23/09/2026 (D131, DROITS-1) : le même « trois verdicts, jamais un booléen »
 * gouverne « clôturer », « suspendre / reprendre » et « enregistrer une VGP »,
 * pas seulement « consulter le planning ». *Deux lectures d'un même critère
 * divergent en silence* (§9, 01/09) — une seconde fonction qui refaisait ce
 * switch pour une autre capacité en aurait été une.
 *
 * La personne restreinte est l'identité de la session et jamais une valeur
 * reçue de l'extérieur : *une désignation se dérive d'un contexte authentifié*
 * (L1-02e). Un écran qui passerait un identifiant de technicien choisirait qui
 * il regarde.
 */
export function perimetreParPersonne(
  contexte: ContexteActif,
  capacite: Capacite,
): PerimetrePlanning {
  switch (niveau(contexte.role, capacite)) {
    case "complet":
      return { acces: "complet" };
    case "restreint":
      return { acces: "restreint", technicienId: contexte.utilisateurId };
    case "aucun":
      return { acces: "aucun" };
  }
}

/** Le périmètre que ce contexte ouvre sur le planning — `consulter_planning`, et lui seul. */
export function perimetreDuPlanning(
  contexte: ContexteActif,
): PerimetrePlanning {
  return perimetreParPersonne(contexte, "consulter_planning");
}

/**
 * CE CONTEXTE AGIT-IL SUR CETTE INTERVENTION, POUR CETTE CAPACITÉ (D131) ?
 *
 * Un accès complet agit toujours ; un accès nul n'agit jamais ; un accès
 * restreint n'agit que si LUI-MÊME est le technicien affecté. *Une
 * intervention non affectée (`null`) n'est le périmètre de personne* — un
 * technicien restreint ne peut pas agir sur une intervention que personne
 * n'a encore prise, `null !== technicienId` étant toujours vrai.
 */
export function dansLePerimetre(
  perimetre: PerimetrePlanning,
  technicienAffecte: string | null,
): boolean {
  switch (perimetre.acces) {
    case "complet":
      return true;
    case "restreint":
      return technicienAffecte === perimetre.technicienId;
    case "aucun":
      return false;
  }
}

/** Compose les deux : le verdict direct, sans manipuler `PerimetrePlanning`. */
export function accesSurCetteIntervention(
  contexte: ContexteActif,
  capacite: Capacite,
  technicienAffecte: string | null,
): boolean {
  return dansLePerimetre(
    perimetreParPersonne(contexte, capacite),
    technicienAffecte,
  );
}

/**
 * Le fragment de `where` qui porte la restriction, ou `undefined` quand il n'y
 * en a pas.
 *
 * **Il rend `undefined` et non `{}`** : un objet vide se compose sans rien
 * filtrer, ce qui est juste, mais il se lit comme un filtre posé. *Une lecture
 * qui a l'air filtrée et ne l'est pas est pire qu'une lecture qui ne l'est
 * pas.*
 *
 * L'accès « aucun » n'a pas de fragment : il ne se traduit pas en filtre, il se
 * REFUSE — voir `exigerAccesAuPlanning`.
 */
export function filtreDuPerimetre(
  perimetre: PerimetrePlanning,
): { readonly technicien_id: string } | undefined {
  return perimetre.acces === "restreint"
    ? { technicien_id: perimetre.technicienId }
    : undefined;
}

/**
 * Le motif du refus opposé à un rôle sans accès au planning, ou `null`.
 *
 * Le message est destiné à un DÉVELOPPEUR — il ne passe pas par le dictionnaire
 * (la coupure de L0-11 se lit sur la destination). Ce qu'un humain lit est
 * décidé par l'écran qui l'attrape.
 */
export function motifRefusPlanning(
  perimetre: PerimetrePlanning,
): string | null {
  return perimetre.acces === "aucun"
    ? "Ce rôle ne porte aucun accès au planning (matrice §5.2, RG-DRO-03). " +
        "Une liste vide se lirait « il n'y a rien » au lieu de « ce n'est pas " +
        "pour vous »."
    : null;
}
