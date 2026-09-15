import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  listerLesFamilles,
  listerLesModeles,
  type LigneFamille,
  type LigneModele,
} from "@/lib/materiel/depot";

/**
 * LE RÉFÉRENTIEL MATÉRIEL (L1-05b ; L1-05, D4 amendé, D6).
 *
 * ## Pourquoi cet écran existe, et ce que son absence coûtait
 *
 * *Mesuré le 14/09/2026 puis le 15/09/2026 : `ls lib/materiel/` rendait un seul
 * fichier.* Les deux tables existaient depuis L1-05 ; **il n'y avait ni dépôt,
 * ni route, ni écran.**
 *
 * **Et c'est un ENCHAÎNEMENT plutôt qu'un manque isolé.** Une machine exige un
 * modèle — D6, quatre champs obligatoires —, un modèle exige une famille, et
 * **aucun des deux ne pouvait naître**. *Le parc ne se remplissait donc que par
 * le semis.* L'import ne le sauvait pas davantage : une seule fonction
 * d'application existe dans tout le dépôt, et c'est celle des clients (R6-01) ;
 * il n'existe même aucun gabarit de FAMILLE (R6-03).
 *
 * ## AUCUNE ÉNUMÉRATION N'EST INVENTÉE
 *
 * Ni les familles, ni les marques, ni les références. **C'est le fond de L1-05
 * et pas une économie** : D4 rangeait ces tables parmi les référentiels de
 * plateforme, avec un catalogue d'éditeur qu'une société surchargeait par copie ;
 * l'amendement du 08/09/2026 a retiré ce mécanisme parce qu'il se contredisait.
 * *Chez CODIMA, les modèles viennent du fichier de suivi, pas d'un catalogue* —
 * ce sont des données saisies, et une liste close ici serait la même faute,
 * déplacée d'une couche.
 *
 * ## L'ENTRETIEN N'EST PAS LA VGP, ET L'ÉCRAN LE DIT LÀ OÙ ON LE SAISIT
 *
 * `periodicite_jours` et `periodicite_compteur` sont l'entretien du
 * constructeur. **La périodicité RÉGLEMENTAIRE des vérifications générales est
 * une autre colonne, une autre règle et un autre écran** : elle se déclare à la
 * FAMILLE, elle exige le texte qui la fonde (L9-04), et le modèle peut la
 * PRÉCISER sans jamais faire exception (L9-06). *Les mêler dans un même champ
 * ferait facturer un entretien pour une vérification légale, ou l'inverse.*
 *
 * **Ce formulaire n'écrit donc aucune colonne de VGP**, et une famille créée ici
 * naît « à déterminer » — l'état que L9-03 a choisi pour qu'il ne se confonde
 * pas avec « non soumise ». Elle apparaît le jour même dans `/vgp/a-determiner`,
 * et l'écran le dit plutôt que de le laisser découvrir.
 *
 * ## AUCUNE SUPPRESSION
 *
 * Quatre clés étrangères retiennent une famille et deux un modèle, toutes en
 * `Restrict`. *Proposer un bouton qui échoue huit fois sur dix est pire que de
 * ne pas le proposer* — la bascule d'activité retire du CHOIX sans toucher au
 * passé.
 *
 * ## ZÉRO FAMILLE N'EST PAS UNE PAGE VIDE
 *
 * Le tableau des modèles dit alors **pourquoi** on ne peut pas encore en créer,
 * et non « aucun modèle ». *Un tableau vide sans phrase se lirait comme un écran
 * cassé, ou pire, comme une question qui ne se pose pas.*
 */
export default async function PageMateriel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const motif = (await searchParams).motif;

  const familles = await listerLesFamilles(session.contexte);
  const modeles = await listerLesModeles(session.contexte);
  const nomDeFamille = new Map(familles.map((f) => [f.id, f.libelle]));

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("materiel.titre")}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {t("materiel.sous_titre")}
        </p>
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {/* ── LES FAMILLES ─────────────────────────────────────────────────── */}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-[10px] border px-4 py-3.5">
        <h2 className="text-[14px] font-bold">{t("materiel.creer_famille")}</h2>
        <FormulaireFamille
          action="/api/parametres/materiel/familles/creer"
          soumettre={t("materiel.creer_action")}
        />
        <p className="text-app-encre-faible text-[11.5px]">
          {t("materiel.vgp_ailleurs")}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnesFamilles()} minimum="760px">
          {familles.length === 0 ? (
            <LignePleine colonnes={3}>
              {t("materiel.aucune_famille")}
            </LignePleine>
          ) : null}
          {familles.map((famille) => (
            <tr key={famille.id}>
              <Cellule fort>{famille.code}</Cellule>
              <Cellule>{famille.libelle}</Cellule>
              <Cellule>
                <Activite
                  action={`/api/parametres/materiel/familles/${famille.id}/activite`}
                  actif={famille.actif}
                />
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      {familles.map((famille) => (
        <section
          key={famille.id}
          className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-[10px] border px-4 py-3.5"
        >
          <h2 className="text-[13px] font-bold">
            {titreDe(t("materiel.modifier_famille"), famille.code)}
          </h2>
          <FormulaireFamille
            action={`/api/parametres/materiel/familles/${famille.id}/modifier`}
            soumettre={t("materiel.enregistrer")}
            valeurs={famille}
          />
        </section>
      ))}

      {/* ── LES MODÈLES ──────────────────────────────────────────────────── */}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-[10px] border px-4 py-3.5">
        <h2 className="text-[14px] font-bold">{t("materiel.creer_modele")}</h2>
        {familles.length === 0 ? (
          // *Un formulaire dont le seul choix de parent est vide est un
          // formulaire qui ne peut que refuser.* La phrase dit où aller ;
          // afficher le champ aurait fait cliquer avant de lire.
          <p className="text-app-encre-faible text-[12.5px]">
            {t("materiel.modele_sans_famille")}
          </p>
        ) : (
          <FormulaireModele
            action="/api/parametres/materiel/modeles/creer"
            familles={familles}
            soumettre={t("materiel.creer_action")}
          />
        )}
        <p className="text-app-encre-faible text-[11.5px]">
          {t("materiel.pas_la_vgp")}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnesModeles()} minimum="960px">
          {modeles.length === 0 ? (
            <LignePleine colonnes={5}>
              {familles.length === 0
                ? t("materiel.modele_sans_famille")
                : t("materiel.aucun_modele")}
            </LignePleine>
          ) : null}
          {modeles.map((modele) => (
            <tr key={modele.id}>
              <Cellule fort>{modele.marque}</Cellule>
              <Cellule>{modele.reference}</Cellule>
              <Cellule>
                {nomDeFamille.get(modele.famille_id) ??
                  t("materiel.famille_inconnue")}
              </Cellule>
              <Cellule>{entretienAffiche(modele)}</Cellule>
              <Cellule>
                <Activite
                  action={`/api/parametres/materiel/modeles/${modele.id}/activite`}
                  actif={modele.actif}
                />
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      {modeles.map((modele) => (
        <section
          key={modele.id}
          className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-[10px] border px-4 py-3.5"
        >
          <h2 className="text-[13px] font-bold">
            {titreDe(t("materiel.modifier_modele"), designation(modele))}
          </h2>
          <FormulaireModele
            action={`/api/parametres/materiel/modeles/${modele.id}/modifier`}
            familles={familles}
            soumettre={t("materiel.enregistrer")}
            valeurs={modele}
          />
        </section>
      ))}

      <p className="text-app-encre-faible text-[11.5px]">
        {t("materiel.aucune_suppression")}
      </p>
    </main>
  );
}

const ACTIF = "oui";
const INACTIF = "non";
const TIRET = " — ";
const ESPACE = " ";
const SEPARATEUR = " / ";
const JOURS = " j";
const COMPTEUR = " h";
const NOUVEAU = "nouveau";

/**
 * La composition est faite HORS du JSX — un littéral n'y est pas admis, fût-il
 * le tiret d'un titre (L0-11). C'est le gardien qui l'a dit, pas la relecture.
 */
function titreDe(prefixe: string, suffixe: string): string {
  return `${prefixe}${TIRET}${suffixe}`;
}

function designation(modele: LigneModele): string {
  return `${modele.marque}${ESPACE}${modele.reference}`;
}

function colonnesFamilles() {
  return [
    { cle: "code", libelle: t("materiel.code"), largeur: "160px" },
    { cle: "libelle", libelle: t("materiel.libelle") },
    { cle: "actif", libelle: t("materiel.activite"), largeur: "220px" },
  ];
}

function colonnesModeles() {
  return [
    { cle: "marque", libelle: t("materiel.marque"), largeur: "180px" },
    { cle: "reference", libelle: t("materiel.reference") },
    { cle: "famille", libelle: t("materiel.famille") },
    { cle: "entretien", libelle: t("materiel.periodicite"), largeur: "180px" },
    { cle: "actif", libelle: t("materiel.activite"), largeur: "220px" },
  ];
}

/**
 * L'ENTRETIEN AFFICHÉ — une absence s'affiche comme une absence.
 *
 * *Jamais « 0 j »* : zéro dirait « dû en permanence », et la base le refuse pour
 * cette raison exacte. « Non périodique » dit ce qui est vrai, et se corrige
 * ailleurs qu'une valeur fausse. **Et ce n'est pas la VGP** — la périodicité
 * réglementaire se lit au registre.
 */
function entretienAffiche(modele: LigneModele): string {
  const parts: string[] = [];
  if (modele.periodicite_jours !== null) {
    parts.push(`${modele.periodicite_jours}${JOURS}`);
  }
  if (modele.periodicite_compteur !== null) {
    parts.push(`${modele.periodicite_compteur}${COMPTEUR}`);
  }
  return parts.length === 0
    ? t("materiel.sans_periodicite")
    : parts.join(SEPARATEUR);
}

/**
 * LA BASCULE D'ACTIVITÉ, écrite une fois et rendue deux.
 *
 * L'état VISÉ voyage dans le corps plutôt que d'être déduit : *une bascule
 * aveugle inverserait un état qu'un autre onglet vient de changer, et personne
 * ne saurait lequel des deux a gagné.*
 */
function Activite({
  action,
  actif,
}: {
  readonly action: string;
  readonly actif: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{actif ? t("materiel.active") : t("materiel.inactive")}</span>
      <form action={action} method="post">
        <input type="hidden" name="actif" value={actif ? INACTIF : ACTIF} />
        <Button type="submit" variant="outline" size="sm">
          {actif ? t("materiel.desactiver") : t("materiel.activer")}
        </Button>
      </form>
    </div>
  );
}

/**
 * LES FORMULAIRES, ÉCRITS UNE FOIS ET RENDUS DEUX — création et modification.
 *
 * *Deux formulaires auraient porté les mêmes champs deux fois, et la divergence
 * se serait vue au pire moment : un champ accepté ici et refusé là, sans que
 * rien ne le dise* (§9, 01/09).
 */
function FormulaireFamille({
  action,
  soumettre,
  valeurs,
}: {
  readonly action: string;
  readonly soumettre: string;
  readonly valeurs?: LigneFamille;
}) {
  const prefixe = valeurs?.id ?? NOUVEAU;
  return (
    <form
      action={action}
      method="post"
      className="flex flex-wrap items-end gap-2"
    >
      <Champ
        id={`${prefixe}-code`}
        nom="code"
        libelle={t("materiel.code")}
        valeur={valeurs?.code}
      />
      <Champ
        id={`${prefixe}-libelle`}
        nom="libelle"
        libelle={t("materiel.libelle")}
        valeur={valeurs?.libelle}
        large
      />
      <CaseActive defaut={valeurs?.actif ?? true} />
      <Button type="submit" variant="outline" size="sm">
        {soumettre}
      </Button>
    </form>
  );
}

function FormulaireModele({
  action,
  familles,
  soumettre,
  valeurs,
}: {
  readonly action: string;
  readonly familles: readonly LigneFamille[];
  readonly soumettre: string;
  readonly valeurs?: LigneModele;
}) {
  const prefixe = valeurs?.id ?? NOUVEAU;
  return (
    <form
      action={action}
      method="post"
      className="flex flex-wrap items-end gap-2"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${prefixe}-famille`}
          className="text-app-encre-faible text-[11px]"
        >
          {t("materiel.famille")}
        </label>
        {/* LA FAMILLE EST OBLIGATOIRE, et la base la tient : la clé étrangère
            est composite `(societe_id, famille_id)`. Il n'y a donc PAS d'option
            vide — à la différence des prestations, dont le parent est
            facultatif. *Une option vide proposerait ce que la base refuse.* */}
        <select
          id={`${prefixe}-famille`}
          name="famille_id"
          defaultValue={valeurs?.famille_id ?? familles[0]?.id}
          className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-[12.5px]"
        >
          {familles.map((famille) => (
            <option key={famille.id} value={famille.id}>
              {famille.libelle}
            </option>
          ))}
        </select>
      </div>
      <Champ
        id={`${prefixe}-marque`}
        nom="marque"
        libelle={t("materiel.marque")}
        valeur={valeurs?.marque}
      />
      <Champ
        id={`${prefixe}-reference`}
        nom="reference"
        libelle={t("materiel.reference")}
        valeur={valeurs?.reference}
        large
      />
      <Champ
        id={`${prefixe}-jours`}
        nom="periodicite_jours"
        libelle={t("materiel.periodicite_jours")}
        valeur={texteOuVide(valeurs?.periodicite_jours)}
        nombre
      />
      <Champ
        id={`${prefixe}-compteur`}
        nom="periodicite_compteur"
        libelle={t("materiel.periodicite_compteur")}
        valeur={texteOuVide(valeurs?.periodicite_compteur)}
        nombre
      />
      <CaseActive defaut={valeurs?.actif ?? true} />
      <Button type="submit" variant="outline" size="sm">
        {soumettre}
      </Button>
    </form>
  );
}

/** Une périodicité absente laisse le champ VIDE — jamais « 0 ». */
function texteOuVide(valeur: number | null | undefined): string | undefined {
  return valeur === null || valeur === undefined ? undefined : String(valeur);
}

function CaseActive({ defaut }: { readonly defaut: boolean }) {
  return (
    <label className="flex items-center gap-1.5 pb-1 text-[12.5px]">
      <input type="checkbox" name="actif" defaultChecked={defaut} />
      {t("materiel.active")}
    </label>
  );
}

function Champ({
  id,
  nom,
  libelle,
  valeur,
  large,
  nombre,
}: {
  readonly id: string;
  readonly nom: string;
  readonly libelle: string;
  readonly valeur?: string;
  readonly large?: boolean;
  readonly nombre?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-app-encre-faible text-[11px]">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        type={nombre === true ? "number" : "text"}
        min={nombre === true ? 1 : undefined}
        defaultValue={valeur}
        className={`border-app-bord bg-app-surface rounded-md border px-2 py-1 text-[12.5px] ${large === true ? "min-w-64" : "w-36"}`}
      />
    </div>
  );
}
