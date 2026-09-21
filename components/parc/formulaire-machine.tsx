"use client";

import { useRef, useState } from "react";

import { ActionPrimaire } from "@/components/ui/action-primaire";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  CRITICITES_MACHINE,
  STATUTS_MACHINE,
  type SaisieMachine,
} from "@/lib/machines/saisie";

/**
 * LE FORMULAIRE DE CRÉATION ET DE CORRECTION D'UNE MACHINE (18/09/2026).
 *
 * ## POURQUOI UN COMPOSANT CLIENT, ET PAS LE `<form method="post">` NU DE
 * L'ACTION DE LA FICHE INTERVENTION
 *
 * *« Un formulaire qui échoue le DIT : distingue enregistré, refusé par la
 * règle métier, erreur serveur, connexion interrompue. Un envoi répété est
 * bloqué pendant la demande. »* — la règle posée pour le glisser-déposer du
 * planning (D-06, `components/planning/pose.tsx`), étendue ici sur demande
 * explicite de l'exploitation. Un `<form method="post">` nu laisse le
 * navigateur décider de la page d'erreur d'une coupure réseau, et rien
 * n'empêche un double clic de partir en DEUX requêtes concurrentes.
 *
 * `interpreterReponseMachine` est PURE, pour la même raison qu'`interpreterReponseDepot` :
 * ce qui doit être mesuré — qu'un appel qui échoue ne rend jamais la branche
 * du succès — se mesure sans navigateur.
 *
 * ## LE MODÈLE, LE CLIENT, LE SITE ET LE STATUT NE SE CORRIGENT PAS EN MODE
 * « MODIFICATION »
 *
 * `modifierMachineDans` (`lib/machines/depot.ts`) ne les réécrit pas — le
 * modèle porte l'unicité de la fiche, et le client/site sont un déménagement,
 * un geste daté qu'aucun formulaire ne porte encore. Ce composant ne
 * contourne pas cette limite : en modification, les quatre champs
 * s'affichent en LECTURE SEULE, dans l'ordre de D126 (famille, marque,
 * référence), et ne sont jamais soumis comme des champs modifiables.
 *
 * ## `tousLesResultats` — UN SÉLECTEUR MONTRE LE RÉFÉRENTIEL ENTIER (lot
 * SELECT-1, 21/09/2026)
 *
 * Mesuré contre une base réelle (locale — le proxy de ce bac à sable bloque
 * la base hébergée) : une société porte déjà 576 clients, et le sélecteur de
 * `/parc/nouvelle` s'arrêtait à 200, `LIMITE_RECHERCHE_MAXIMALE` de
 * `lib/clients/saisie.ts` et `lib/sites/saisie.ts`. Créer une machine pour
 * l'un des 376 clients restants était impossible — aucun message, la fiche
 * disparaissait simplement du sélecteur.
 *
 * Cette fonction vit ICI et non dans `app/(back-office)/parc/nouvelle/page.tsx`,
 * qui l'appelle : Next.js refuse toute exportation d'un `page.tsx` étrangère à
 * son contrat de route (mesuré au build). Elle enchaîne les pages d'une
 * recherche bornée — `rechercherClients` ou `rechercherSites`, déjà appliqués
 * au contexte et aux critères — jusqu'à ce qu'un lot revienne plus court que
 * `tailleDePage` : exactement le critère que `skip`/`take` de Prisma
 * produisent déjà côté dépôt, jamais une seconde lecture du total. La borne
 * `LIMITE_RECHERCHE_MAXIMALE` reste entière comme garde-fou PAR REQUÊTE —
 * contre une seule requête qui ramènerait tout le référentiel d'un coup
 * depuis Nouméa —, ce n'est que la première page qui ne suffit plus à un
 * sélecteur.
 */
export async function tousLesResultats<T>(
  page: (numero: number) => Promise<readonly T[]>,
  tailleDePage: number,
): Promise<T[]> {
  const resultats: T[] = [];
  for (let numero = 1; ; numero += 1) {
    const lot = await page(numero);
    resultats.push(...lot);
    if (lot.length < tailleDePage) {
      return resultats;
    }
  }
}

export type OptionModele = {
  readonly id: string;
  readonly marque: string;
  readonly reference: string;
  readonly familleLibelle: string;
};

export type OptionClient = {
  readonly id: string;
  readonly raisonSociale: string;
};

export type OptionSite = {
  readonly id: string;
  readonly libelle: string;
  readonly clientId: string;
};

/**
 * CE QUE LA ROUTE REND, INTERPRÉTÉ EN QUATRE ISSUES QUI NE SE CONFONDENT PAS
 * (D-06). Fonction pure : voir la note de tête.
 */
export type IssueEnvoiMachine =
  | { readonly issue: "enregistre"; readonly id: string }
  | { readonly issue: "refuse"; readonly cle: CleTraduction }
  | { readonly issue: "erreur_serveur" }
  | { readonly issue: "connexion_interrompue" };

export function interpreterReponseMachine(
  resultat: { readonly ok: boolean; readonly corps: unknown } | null,
): IssueEnvoiMachine {
  if (resultat === null) {
    // Le `fetch` a lui-même échoué : la réponse n'est jamais revenue. On ne
    // sait pas si l'écriture a été appliquée — regarder ailleurs qu'à
    // l'écran, pas réessayer à l'aveugle.
    return { issue: "connexion_interrompue" };
  }
  if (!resultat.ok) {
    return { issue: "erreur_serveur" };
  }
  const { corps } = resultat;
  if (corps === null || typeof corps !== "object" || !("accepte" in corps)) {
    return { issue: "erreur_serveur" };
  }
  if (corps.accepte === true) {
    const id = "id" in corps && typeof corps.id === "string" ? corps.id : null;
    if (id === null) {
      // Un « succès » HTTP sans identifiant n'est pas un succès exploitable :
      // rien à afficher, aucune fiche à rejoindre.
      return { issue: "erreur_serveur" };
    }
    return { issue: "enregistre", id };
  }
  const cleBrute = "cle" in corps ? corps.cle : null;
  return {
    issue: "refuse",
    cle:
      typeof cleBrute === "string" && estCleTraduction(cleBrute)
        ? cleBrute
        : "machine.refus.inconnue",
  };
}

type ValeursEditables = {
  readonly numeroSerie: string;
  readonly referenceInterne: string;
  readonly localisation: string;
  readonly factureOrigine: string;
  readonly dateMiseEnService: string;
  readonly dateVente: string;
  readonly garantieFin: string;
  readonly criticite: SaisieMachine["criticite"];
};

type LectureSeule = {
  readonly modeleId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly familleLibelle: string;
  readonly marque: string;
  readonly reference: string;
  readonly clientLibelle: string;
  readonly siteLibelle: string;
};

type Props = {
  readonly action: string;
  /**
   * La clé du motif à joindre à l'URL de retour, `/parc/{id}?motif={…}`
   * (D-06). **Une donnée, jamais une fonction** : `urlRetour` était une
   * fermeture passée telle quelle du composant serveur au composant client,
   * et React refuse de sérialiser une fonction à travers cette frontière —
   * mesuré (digests 547900095 et 1461852287, un par écran) : les deux DEVENAIENT
   * une 500 au premier rendu, avant même que `envoyer` ne s'exécute. Le test
   * de ce composant ne pouvait pas le voir : il rend `FormulaireMachine`
   * directement, sans jamais franchir la frontière serveur → client que Next.js
   * franchit, lui, à chaque requête réelle.
   */
  readonly motifSucces: CleTraduction;
  readonly modeles: readonly OptionModele[];
  readonly clients: readonly OptionClient[];
  readonly sites: readonly OptionSite[];
  readonly motifInitial?: CleTraduction;
  readonly valeurs: ValeursEditables;
} & (
  | { readonly mode: "creation" }
  | { readonly mode: "modification"; readonly lectureSeule: LectureSeule }
);

export function FormulaireMachine(props: Props) {
  const [motif, setMotif] = useState<CleTraduction | null>(
    props.motifInitial ?? null,
  );
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  // Un GESTE RÉPÉTÉ NE PART PAS DEUX FOIS (D-06) : une `Ref`, pas seulement
  // l'état d'affichage — un second clic avant le premier rendu React ne doit
  // rien déclencher.
  const enVol = useRef(false);
  const [clientChoisi, setClientChoisi] = useState<string>("");

  const sitesDuClient =
    props.mode === "creation"
      ? props.sites.filter((site) => site.clientId === clientChoisi)
      : [];

  async function envoyer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (enVol.current) {
      return;
    }
    enVol.current = true;
    setEnvoiEnCours(true);
    const corps = new FormData(evenement.currentTarget);
    let issue: IssueEnvoiMachine;
    try {
      const reponse = await fetch(props.action, {
        method: "POST",
        body: corps,
        headers: { accept: "application/json" },
      });
      const rendu: unknown = await reponse.json().catch(() => null);
      issue = interpreterReponseMachine({ ok: reponse.ok, corps: rendu });
    } catch {
      // Le `fetch` a REJETÉ — coupure réseau, délai dépassé. Sans ce `catch`,
      // ce rejet partirait non intercepté et l'écran resterait tel quel.
      issue = { issue: "connexion_interrompue" };
    } finally {
      enVol.current = false;
      setEnvoiEnCours(false);
    }
    switch (issue.issue) {
      case "enregistre":
        window.location.assign(
          `/parc/${issue.id}?motif=${encodeURIComponent(props.motifSucces)}`,
        );
        return;
      case "refuse":
        setMotif(issue.cle);
        return;
      case "erreur_serveur":
      case "connexion_interrompue":
        setMotif(`machine.refus.${issue.issue}`);
        return;
    }
  }

  return (
    <form
      onSubmit={(evenement) => {
        void envoyer(evenement);
      }}
      className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
    >
      {motif === null ? null : (
        <p
          data-refus={motif}
          role="alert"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      )}

      {/* FAMILLE, MARQUE, RÉFÉRENCE, N° DE SÉRIE, ANNÉE DE VENTE — dans cet
          ordre (RG-PAR-07, D126). */}
      {props.mode === "modification" ? (
        <ChampsLectureSeule lectureSeule={props.lectureSeule} />
      ) : (
        <SelectionModele modeles={props.modeles} />
      )}

      <Champ
        nom="numero_serie"
        libelle={t("machine.champ.numero_serie")}
        aide={t("machine.champ.numero_serie_aide")}
        valeurParDefaut={props.valeurs.numeroSerie}
        obligatoire
      />

      {props.mode === "creation" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            {t("machine.champ.client")}
            <select
              name="client_id"
              required
              value={clientChoisi}
              onChange={(evenement) => setClientChoisi(evenement.target.value)}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
            >
              <option value="" disabled>
                {t("machine.champ.client")}
              </option>
              {props.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.raisonSociale}
                </option>
              ))}
            </select>
            {props.clients.length > 0 ? null : (
              <span className="text-app-encre-faible text-[11px] font-normal">
                {t("machine.champ.aucun_client")}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            {mot("site")}
            <select
              name="site_id"
              required
              disabled={clientChoisi === ""}
              defaultValue=""
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal disabled:opacity-50"
            >
              <option value="" disabled>
                {mot("site")}
              </option>
              {sitesDuClient.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.libelle}
                </option>
              ))}
            </select>
            {clientChoisi !== "" && sitesDuClient.length === 0 ? (
              <span className="text-app-encre-faible text-[11px] font-normal">
                {t("machine.champ.aucun_site")}
              </span>
            ) : null}
          </label>
        </div>
      ) : (
        <>
          <input
            type="hidden"
            name="modele_id"
            value={props.lectureSeule.modeleId}
          />
          <input
            type="hidden"
            name="client_id"
            value={props.lectureSeule.clientId}
          />
          <input
            type="hidden"
            name="site_id"
            value={props.lectureSeule.siteId}
          />
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Champ
          nom="reference_interne"
          libelle={t("machine.champ.reference_interne")}
          valeurParDefaut={props.valeurs.referenceInterne}
        />
        <Champ
          nom="localisation"
          libelle={t("machine.champ.localisation")}
          valeurParDefaut={props.valeurs.localisation}
        />
        <Champ
          nom="facture_origine"
          libelle={t("machine.champ.facture_origine")}
          valeurParDefaut={props.valeurs.factureOrigine}
        />
        <Champ
          nom="date_mise_en_service"
          type="date"
          libelle={t("machine.champ.date_mise_en_service")}
          valeurParDefaut={props.valeurs.dateMiseEnService}
        />
        <Champ
          nom="date_vente"
          type="date"
          libelle={t("machine.champ.date_vente")}
          valeurParDefaut={props.valeurs.dateVente}
        />
        <Champ
          nom="garantie_fin"
          type="date"
          libelle={t("machine.champ.garantie_fin")}
          valeurParDefaut={props.valeurs.garantieFin}
        />
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("machine.champ.criticite")}
          <select
            name="criticite"
            defaultValue={props.valeurs.criticite}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            {CRITICITES_MACHINE.map((valeur) => (
              <option key={valeur} value={valeur}>
                {t(`criticite_machine.${valeur}`)}
              </option>
            ))}
          </select>
        </label>
        {props.mode === "creation" ? (
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            {t("machine.champ.statut")}
            <select
              name="statut"
              defaultValue="en_service"
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
            >
              {STATUTS_MACHINE.filter((valeur) => valeur !== "fusionnee").map(
                (valeur) => (
                  <option key={valeur} value={valeur}>
                    {t(`statut_machine.${valeur}`)}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : null}
      </div>

      <div>
        <ActionPrimaire type="submit">
          {envoiEnCours
            ? t("machine.action.envoi_en_cours")
            : t("machine.action.enregistrer")}
        </ActionPrimaire>
      </div>
    </form>
  );
}

function ChampsLectureSeule({
  lectureSeule,
}: Readonly<{ lectureSeule: LectureSeule }>) {
  return (
    <div className="bg-app-fond rounded-md px-3.5 py-2.5">
      <p className="text-app-encre-faible mb-2 text-[11px] font-semibold uppercase">
        {t("machine.modifier.non_modifiable")}
      </p>
      <dl className="grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
        <LigneLectureSeule
          dt={t("machine.champ.famille")}
          dd={lectureSeule.familleLibelle}
        />
        <LigneLectureSeule
          dt={t("machine.champ.marque")}
          dd={lectureSeule.marque}
        />
        <LigneLectureSeule
          dt={t("machine.champ.reference")}
          dd={lectureSeule.reference}
        />
        <LigneLectureSeule
          dt={t("machine.champ.client")}
          dd={lectureSeule.clientLibelle}
        />
        <LigneLectureSeule dt={mot("site")} dd={lectureSeule.siteLibelle} />
      </dl>
    </div>
  );
}

function LigneLectureSeule({ dt, dd }: Readonly<{ dt: string; dd: string }>) {
  return (
    <>
      <dt className="text-app-encre-faible">{dt}</dt>
      <dd className="font-semibold">{dd}</dd>
    </>
  );
}

/** LE SÉLECTEUR DE MODÈLE — groupé par famille (RG-PAR-07, D126). */
function SelectionModele({
  modeles,
}: Readonly<{ modeles: readonly OptionModele[] }>) {
  const parFamille = new Map<string, OptionModele[]>();
  for (const modele of modeles) {
    const groupe = parFamille.get(modele.familleLibelle) ?? [];
    groupe.push(modele);
    parFamille.set(modele.familleLibelle, groupe);
  }
  return (
    <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
      {t("machine.champ.modele")}
      <select
        name="modele_id"
        required
        defaultValue=""
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
      >
        <option value="" disabled>
          {t("machine.champ.modele")}
        </option>
        {[...parFamille.entries()].map(([famille, options]) => (
          <optgroup key={famille} label={famille}>
            {options.map((modele) => (
              <option key={modele.id} value={modele.id}>
                {libelleModele(modele)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {modeles.length > 0 ? null : (
        <span className="text-app-encre-faible text-[11px] font-normal">
          {t("machine.champ.aucun_modele")}
        </span>
      )}
    </label>
  );
}

/** « Marque — Référence » — recopié de `titreDeLaLigne` (`/parc`), même retenue. */
function libelleModele(modele: OptionModele): string {
  return `${modele.marque} — ${modele.reference}`;
}

function Champ({
  nom,
  libelle,
  aide,
  type = "text",
  valeurParDefaut,
  obligatoire,
}: Readonly<{
  nom: string;
  libelle: string;
  aide?: string;
  type?: "text" | "date";
  valeurParDefaut?: string;
  obligatoire?: boolean;
}>) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
      {libelle}
      <input
        name={nom}
        type={type}
        required={obligatoire === true}
        defaultValue={valeurParDefaut}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-[11px] font-normal">
          {aide}
        </span>
      )}
    </label>
  );
}
