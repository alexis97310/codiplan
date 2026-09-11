import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { Button } from "@/components/ui/button";
import { etatArrivee, type Arrivee } from "@/lib/auth/arrivee";
import { estRolePortail, type Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  societesDuCompte,
  type SocieteDuCompte,
} from "@/lib/auth/societe-active";
import { t } from "@/lib/i18n/fr";

/**
 * PAGE D'ARRIVÉE (ticket L1-02f) — qui vous êtes, pour quelle société.
 *
 * **Et rien d'autre.** Pas de liste de clients, pas de navigation, pas de menu :
 * chaque donnée de plus serait un écran de lot 2 écrit en avance.
 *
 * La raison sociale n'est pas recopiée de la session : elle est LUE en base sous
 * le contexte cloisonné, par `etatArrivee`. La politique de `societe` est de
 * forme « identité » (`id = app.societe_id`, D42), si bien qu'une session active
 * sur A ne peut pas obtenir le nom de B — pas même en passant l'identifiant de
 * B. C'est ce qui rend cette page capable de PROUVER le cloisonnement à travers
 * l'application, et non seulement de l'illustrer.
 *
 * ## R2-04 — LA MAQUETTE EST MUETTE ICI, ET L'ÉCART S'ÉCRIT
 *
 * *Elle ne décrit aucun écran d'arrivée : elle s'ouvre directement sur le
 * tableau de bord.* C'est le ticket le plus exposé du lot — il n'a pas de
 * modèle, et la tentation serait d'en inventer un. **Rien n'a été inventé : ce
 * que l'écran AFFICHE ne change pas d'un mot**, parce que « qui vous êtes, pour
 * quelle société, et rien d'autre » est une décision de L1-02f et non une
 * question d'apparence. Seule sa FORME bouge.
 *
 * *Mesuré le 11/09/2026, fenêtre 1700 × 1000 : contenu de 448 px, centré à
 * mi-hauteur, document de 1072 px* — `max-w-md` et `justify-center`, c'est-à-
 * dire la forme d'une page de connexion. Or `/arrivee` est un écran d'APRÈS-
 * session : il vit sous la barre de navigation, dans un back-office de 1400 px,
 * et un contenu centré à mi-hauteur sous une barre ancrée en haut flotte sans
 * rien pour le tenir.
 *
 * **Ce qui est repris est le seul point où la maquette parle** : ses écrans
 * commencent en haut, sur la largeur utile, titre en 22 px extra-gras et
 * accroche grise en 13 px. *Ce qu'elle montre se suit ; ce qu'elle ne dit pas
 * reste libre* (§1) — et ce qui reste libre ici est la disposition interne,
 * tenue en trois colonnes plutôt qu'en une bande étroite.
 */
export default async function PageArrivee() {
  const entetes = await headers();
  const etat = await etatArrivee(entetes);

  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  if (etat.issue === "enrolement_requis") {
    redirect("/enrolement");
  }

  // LES SOCIÉTÉS DU COMPTE, lues sous le contexte d'IDENTITÉ SEULE — aucune
  // société active, puisque c'est précisément ce qu'on choisit. Deux lectures
  // bornées chacune par SA forme : « appartenance » pour les habilitations
  // (D61), « adhésion » pour les noms (D67).
  const session = await obtenirSession(entetes);
  const societes =
    session === null
      ? []
      : await societesDuCompte(session.contexte.utilisateurId);
  const societeActive =
    etat.issue === "arrivee" ? (session?.contexte.societeId ?? null) : null;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {t("arrivee.titre")}
        </h1>
        <p className="text-app-encre-faible text-[13px]">
          {t("arrivee.accroche")}
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <section className="bg-app-surface border-app-bord rounded-[10px] border px-4 py-3.5">
          <dl className="flex flex-col gap-3 text-[13px]">
            <Ligne libelle={t("arrivee.compte")} valeur={etat.arrivee.nom} />
            <Ligne libelle={t("arrivee.email")} valeur={etat.arrivee.email} />
          </dl>
        </section>

        {etat.issue === "arrivee" ? <Societe arrivee={etat.arrivee} /> : null}

        {etat.issue === "sans_societe" && societes.length === 0 ? (
          <section className="bg-app-surface border-app-bord text-app-encre-faible rounded-[10px] border px-4 py-3.5 text-[13px]">
            {t("arrivee.sans_societe")}
          </section>
        ) : null}
      </div>

      {/* L'ENTRÉE, ET POURQUOI ELLE EST ÉCRITE ICI.

          **Un écran sans appelant n'est éprouvé par personne**, et ce dépôt
          l'a déjà payé deux fois : D61 et D67 ont ouvert la lecture des
          sociétés d'un compte, et pendant deux jours aucun écran ne l'a
          appelée — c'est une IMAGE qui l'a dit, pas une assertion (§9, 09/09).
          Le portail de D92 tombait dans la même trappe : la politique posée,
          l'écran écrit, et rien pour y mener.

          Le rôle ACTIF décide, jamais le compte : la même personne peut être
          interne sur une société et cliente sur une autre (RG-SOC-03), et
          c'est la société choisie qui dit lequel des deux elle est ici. */}
      {etat.issue === "arrivee" && session !== null ? (
        <Entree role={session.contexte.role} />
      ) : null}

      {societes.length > 0 ? (
        <Choix societes={societes} active={societeActive} />
      ) : null}

      <form action="/api/session/deconnexion" method="post">
        <Button type="submit" variant="outline">
          {t("arrivee.deconnexion")}
        </Button>
      </form>
    </main>
  );
}

/**
 * LE LIEN VERS L'ÉCRAN QUE CE RÔLE OUVRE.
 *
 * Deux destinations, et pas une de plus : le portail pour un compte client, le
 * planning pour tous les autres. *Une liste de liens par rôle serait une
 * seconde lecture de la matrice des droits (§9, 01/09) ; ici la question posée
 * est plus étroite — « par où entre-t-on ? » —, et elle n'a que deux réponses.*
 */
function Entree({ role }: { role: Role | null }) {
  if (role === null) {
    return null;
  }
  const portail = estRolePortail(role);
  return (
    <Link
      href={portail ? "/portail" : "/planning"}
      className="bg-app-accent text-app-accent-encre w-fit rounded-md px-4 py-2 text-[13px] font-bold"
    >
      {portail ? t("arrivee.entrer.portail") : t("arrivee.entrer.planning")}
    </Link>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-app-encre-faible">{libelle}</dt>
      <dd className="font-medium">{valeur}</dd>
    </div>
  );
}

function Societe({ arrivee }: { arrivee: Arrivee }) {
  return (
    <dl className="bg-societe-primaire text-societe-primaire-encre flex flex-col gap-3 rounded-[10px] px-4 py-3.5 text-[13px]">
      <Ligne libelle={t("arrivee.societe")} valeur={arrivee.societe ?? ""} />
      <Ligne libelle={t("arrivee.role")} valeur={arrivee.role ?? ""} />
    </dl>
  );
}

/**
 * LE CHOIX D'UNE SOCIÉTÉ — un formulaire HTML, sans JavaScript.
 *
 * Il poste vers `/api/session/societe`, qui n'est qu'un passe-plat vers
 * `basculerSociete` : c'est elle qui relit l'habilitation en base, refuse un
 * rôle sans son second facteur, journalise, et applique le plancher de durée
 * de D35. *Rien de tout cela n'est recopié ici — deux lectures d'un même
 * critère divergeraient en silence (§9, 01/09).*
 *
 * La société ACTIVE est marquée plutôt que retirée de la liste : une liste dont
 * une entrée disparaît fait douter de l'habilitation, alors qu'elle est
 * simplement en cours d'usage.
 */
function Choix({
  societes,
  active,
}: {
  societes: readonly SocieteDuCompte[];
  active: string | null;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[14px] font-bold">{t("arrivee.choix.titre")}</h2>
      <p className="text-app-encre-faible text-[12.5px]">
        {t("arrivee.choix.aide")}
      </p>
      <ul className="flex flex-col gap-2">
        {societes.map((societe) => (
          <li key={societe.societeId}>
            <form
              action="/api/session/societe"
              method="post"
              className="bg-app-surface border-app-bord flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-3"
            >
              <input type="hidden" name="societe" value={societe.societeId} />
              <span className="text-[13px] font-bold">
                {nomAffiche(societe)}
              </span>
              {/* Le rôle s'affiche tel que l'énumération le porte, comme le
                  fait déjà la ligne « Rôle » ci-dessus : la constitution range
                  un nom de rôle du côté de ce qu'une MACHINE lit, et lui
                  inventer dix libellés serait une décision de dictionnaire
                  qu'aucun ticket n'a prise. */}
              <span className="text-app-encre-faible text-[11.5px]">
                {societe.role}
              </span>
              {societe.societeId === active ? (
                <span className="text-app-encre-faible ml-auto text-[11.5px]">
                  {t("arrivee.choix.active")}
                </span>
              ) : (
                <Button type="submit" variant="outline" className="ml-auto">
                  {t("arrivee.choix.activer")}
                </Button>
              )}
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Le nom d'une société, ou son identifiant à défaut.
 *
 * La composition sort du JSX : ce qui se lit à l'écran vient du dictionnaire,
 * pas de la balise (L0-11).
 */
function nomAffiche(societe: SocieteDuCompte): string {
  if (societe.raisonSociale !== null) {
    return societe.raisonSociale;
  }
  return `${t("arrivee.choix.sans_nom")} ${societe.societeId.slice(0, 8)}`;
}
