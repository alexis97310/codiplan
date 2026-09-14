import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import {
  famillesVisables,
  listerLesPrestations,
  type LignePrestation,
} from "@/lib/prestations/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";

/**
 * LE CATALOGUE DES PRESTATIONS (R3-15 ; D109, D113, L1-12).
 *
 * ## Pourquoi cet écran existe
 *
 * *Mesuré le 14/09/2026 : `ls lib/prestations/` rendait un seul fichier, et
 * `grep -rn "lib/prestations" app/ components/` rendait zéro ligne.* La table
 * existait depuis L1-12, son gabarit d'import existait, et **entre les deux il
 * n'y avait rien**. C'était le cas le plus nu des neuf modules relevés en tête
 * du backlog : les autres avaient au moins une fonction de dépôt que personne
 * n'appelait ; celui-ci n'en avait aucune à appeler.
 *
 * **Et l'import ne l'aurait pas sauvé** : une seule fonction d'application
 * existe dans tout le dépôt, et c'est celle des clients. Le gabarit des
 * prestations sait produire un rapport et ne sait pas l'appliquer.
 *
 * ## AUCUN CHAMP DE MONTANT, et ce n'est pas une omission
 *
 * > **Une prestation porte une DURÉE, jamais un taux** (D109).
 *
 * *Une facture ne change pas quand un tarif change* — RG-TAR-04 —, et deux
 * endroits qui portent un prix, c'est une préséance à inventer et une seconde
 * historisation à tenir, pour rien. D113 ajoute qu'elle ne DÉSIGNE aucun
 * forfait non plus : le pont passe par l'intervention et ses trois axes
 * (RG-TAR-06). **Un champ « Tarif » ajouté par confort serait refusé par la base
 * avant de l'être par la relecture** — la colonne n'existe pas, et
 * `tests/unit/prestations/aucun-montant.test.ts` refuse qu'elle apparaisse.
 *
 * ## UNE DURÉE ABSENTE S'AFFICHE COMME ABSENTE, JAMAIS COMME ZÉRO
 *
 * *Zéro dirait « instantané ».* `null` dit « personne ne l'a encore estimée »,
 * ce qui est l'état ordinaire d'un catalogue qu'on remplit — la troisième fois
 * que ce dépôt sépare « je ne sais pas » de « la valeur vaut rien » (D76, D88).
 *
 * ## LA CHECKLIST TYPE N'EST PAS SAISIE, et c'est écrit plutôt que tu
 *
 * La colonne existe, en `String?`, et **personne n'a dit ce qu'elle porte** :
 * une liste d'étapes, un texte libre, l'identifiant d'un modèle ? *L'inventer au
 * premier écran qui l'écrit figerait la forme pour toutes les sociétés* — c'est
 * le défaut que L1-09a a nommé sur `adresse_facturation`. **Un tableur ne
 * conviendrait pas davantage** : une checklist est une liste ORDONNÉE d'étapes,
 * et une colonne de tableur en fait une chaîne où l'ordre se devine et où le
 * séparateur est un choix que personne n'a fait.
 *
 * ## Aucune SUPPRESSION, et c'est le raisonnement des forfaits
 *
 * Une intervention désignera sa prestation, et *une facture émise sous une
 * prestation disparue ne s'explique plus.* La bascule d'activité retire du
 * CHOIX sans toucher au passé.
 */
export default async function PagePrestations({
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

  const prestations = await listerLesPrestations(session.contexte);
  const familles = await famillesVisables(session.contexte);
  const nomDeFamille = new Map(familles.map((f) => [f.id, f.libelle]));

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("prestations.titre")}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {t("prestations.sous_titre")}
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

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-[10px] border px-4 py-3.5">
        <h2 className="text-[14px] font-bold">{t("prestations.creer")}</h2>
        <FormulairePrestation
          action="/api/parametres/prestations/creer"
          familles={familles}
          soumettre={t("prestations.creer_action")}
        />
        <p className="text-app-encre-faible text-[11.5px]">
          {t("prestations.sans_montant")}
        </p>
        <p className="text-app-encre-faible text-[11.5px]">
          {t("prestations.sans_checklist")}
        </p>
      </section>

      <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
        <Tableau colonnes={colonnes()} minimum="900px">
          {prestations.length === 0 ? (
            <LignePleine colonnes={5}>{t("prestations.aucune")}</LignePleine>
          ) : null}
          {prestations.map((prestation) => (
            <tr key={prestation.id}>
              <Cellule fort>{prestation.code}</Cellule>
              <Cellule>{prestation.libelle}</Cellule>
              <Cellule>
                {prestation.famille_id === null
                  ? t("prestations.sans_famille")
                  : (nomDeFamille.get(prestation.famille_id) ??
                    t("prestations.famille_inconnue"))}
              </Cellule>
              <Cellule>{dureeAffichee(prestation)}</Cellule>
              <Cellule>
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    {prestation.actif
                      ? t("prestations.active")
                      : t("prestations.inactive")}
                  </span>
                  <form
                    action={`/api/parametres/prestations/${prestation.id}/activite`}
                    method="post"
                  >
                    <input
                      type="hidden"
                      name="actif"
                      value={prestation.actif ? INACTIF : ACTIF}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      {prestation.actif
                        ? t("prestations.desactiver")
                        : t("prestations.activer")}
                    </Button>
                  </form>
                </div>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </section>

      {prestations.map((prestation) => (
        <section
          key={prestation.id}
          className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-[10px] border px-4 py-3.5"
        >
          <h2 className="text-[13px] font-bold">
            {titreDeModification(prestation.code)}
          </h2>
          <FormulairePrestation
            action={`/api/parametres/prestations/${prestation.id}/modifier`}
            familles={familles}
            soumettre={t("prestations.enregistrer")}
            valeurs={prestation}
          />
        </section>
      ))}
    </main>
  );
}

const ACTIF = "oui";
const INACTIF = "non";
const TIRET = " — ";

/**
 * La composition est faite HORS du JSX — un littéral n'y est pas admis, fût-il
 * le tiret d'un titre (L0-11). C'est le gardien qui l'a dit, pas la relecture.
 */
function titreDeModification(code: string): string {
  return `${t("prestations.modifier")}${TIRET}${code}`;
}

function colonnes() {
  return [
    { cle: "code", libelle: t("prestations.code"), largeur: "140px" },
    { cle: "libelle", libelle: t("prestations.libelle") },
    { cle: "famille", libelle: t("prestations.famille") },
    { cle: "duree", libelle: t("prestations.duree") },
    { cle: "actif", libelle: t("prestations.activite"), largeur: "220px" },
  ];
}

/**
 * LE FORMULAIRE, ÉCRIT UNE FOIS ET RENDU DEUX — création et modification.
 *
 * *Deux formulaires auraient porté les mêmes champs deux fois, et la divergence
 * se serait vue au pire moment : un champ accepté ici et refusé là, sans que
 * rien ne le dise* (§9, 01/09). C'est l'argument de `FormulaireForfait`, et il
 * vaut ici pour la même raison.
 */
function FormulairePrestation({
  action,
  familles,
  soumettre,
  valeurs,
}: {
  readonly action: string;
  readonly familles: readonly {
    readonly id: string;
    readonly libelle: string;
  }[];
  readonly soumettre: string;
  readonly valeurs?: LignePrestation;
}) {
  const prefixe = valeurs?.id ?? NOUVELLE;
  return (
    <form
      action={action}
      method="post"
      className="flex flex-wrap items-end gap-2"
    >
      <Champ
        id={`${prefixe}-code`}
        nom="code"
        libelle={t("prestations.code")}
        valeur={valeurs?.code}
      />
      <Champ
        id={`${prefixe}-libelle`}
        nom="libelle"
        libelle={t("prestations.libelle")}
        valeur={valeurs?.libelle}
        large
      />
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${prefixe}-famille`}
          className="text-app-encre-faible text-[11px]"
        >
          {t("prestations.famille")}
        </label>
        <select
          id={`${prefixe}-famille`}
          name="famille_id"
          defaultValue={valeurs?.famille_id ?? ""}
          className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-[12.5px]"
        >
          {/* LA FAMILLE EST FACULTATIVE, et c'est le premier parent de ce dépôt
              à l'être : un déplacement, un diagnostic ou une formation ne visent
              aucune famille de matériel. L'option vide n'est pas un « non
              renseigné » qu'on corrigera — c'est une réponse. */}
          <option value="">{t("prestations.sans_famille")}</option>
          {familles.map((famille) => (
            <option key={famille.id} value={famille.id}>
              {famille.libelle}
            </option>
          ))}
        </select>
      </div>
      <Champ
        id={`${prefixe}-duree`}
        nom="duree_standard_min"
        libelle={t("prestations.duree_minutes")}
        valeur={
          valeurs?.duree_standard_min === null ||
          valeurs?.duree_standard_min === undefined
            ? undefined
            : String(valeurs.duree_standard_min)
        }
        nombre
      />
      <label className="flex items-center gap-1.5 pb-1 text-[12.5px]">
        <input
          type="checkbox"
          name="actif"
          defaultChecked={valeurs?.actif ?? true}
        />
        {t("prestations.active")}
      </label>
      <Button type="submit" variant="outline" size="sm">
        {soumettre}
      </Button>
    </form>
  );
}

const NOUVELLE = "nouvelle";

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

/**
 * LA DURÉE AFFICHÉE — une absence s'affiche comme une absence.
 *
 * *Jamais « 0 min »* : zéro dirait « instantané », et la base refuse d'ailleurs
 * zéro pour cette raison exacte. « Non estimée » dit ce qui est vrai — personne
 * ne l'a encore mesurée — et se corrige à un autre endroit qu'une valeur fausse.
 */
function dureeAffichee(prestation: LignePrestation): string {
  return prestation.duree_standard_min === null
    ? t("prestations.duree_non_estimee")
    : `${prestation.duree_standard_min}${MINUTES}`;
}

const MINUTES = " min";
