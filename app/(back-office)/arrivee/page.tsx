import type { Metadata } from "next";

import { LienPrimaire } from "@/components/ui/action-primaire";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { Page } from "@/components/mise-en-page/page";
import { etatArrivee, type Arrivee } from "@/lib/auth/arrivee";
import { estContexteActif } from "@/lib/auth/contexte";
import { estRolePortail, type Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { societesDuCompte } from "@/lib/auth/societe-active";
import { t } from "@/lib/i18n/fr";
import {
  perimetreDuPlanning,
  type PerimetrePlanning,
} from "@/lib/interventions/perimetre-technicien";

import { Choix } from "./composants";

export const metadata: Metadata = { title: t("arrivee.titre") };

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
 *
 * ## LE BOUTON DE DÉCONNEXION N'EST PLUS ICI (N-02, arbitrage du 16/09/2026)
 *
 * *Il n'existait qu'ici, sur un écran d'atterrissage sur lequel on ne revient
 * jamais — en pratique, une session ouverte ne se fermait pas.* La commande
 * vit désormais dans le CHROME (`components/navigation/barre.tsx`), rendue
 * dans les trois coques. La retenir ici en plus en aurait fait un second
 * bouton pour le même geste sur le même écran, puisque `/arrivee` porte
 * elle-même cette barre.
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
    <Page
      chemin="/arrivee"
      titre={t("arrivee.titre")}
      sousTitre={t("arrivee.accroche")}
    >
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
          <dl className="flex flex-col gap-3 text-[13px]">
            <Ligne libelle={t("arrivee.compte")} valeur={etat.arrivee.nom} />
            <Ligne libelle={t("arrivee.email")} valeur={etat.arrivee.email} />
          </dl>
        </section>

        {etat.issue === "arrivee" ? <Societe arrivee={etat.arrivee} /> : null}

        {etat.issue === "sans_societe" && societes.length === 0 ? (
          <section className="bg-app-surface border-app-bord text-app-encre-faible rounded-lg border px-4 py-3.5 text-[13px]">
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
        <Entree
          role={session.contexte.role}
          perimetre={
            estContexteActif(session.contexte)
              ? perimetreDuPlanning(session.contexte)
              : null
          }
        />
      ) : null}

      {societes.length > 0 ? (
        <Choix societes={societes} active={societeActive} />
      ) : null}
    </Page>
  );
}

/**
 * LE LIEN VERS L'ÉCRAN QUE CE RÔLE OUVRE.
 *
 * **Trois destinations depuis R5-01**, et pas une de plus : le portail pour un
 * compte client, **la journée du terrain pour qui n'a du planning qu'un accès
 * RESTREINT**, le planning pour tous les autres. *Une liste de liens par rôle
 * serait une seconde lecture de la matrice des droits (§9, 01/09) ; ici la
 * question posée est plus étroite — « par où entre-t-on ? »* — et la troisième
 * réponse ne recopie rien : elle LIT le même périmètre que le dépôt applique,
 * si bien qu'un rôle qui recevrait demain le `○` entrerait par le terrain sans
 * qu'on rouvre ce fichier.
 *
 * **Et c'est ce qui donne un appelant à l'écran du terrain.** Ce dépôt a payé
 * deux fois une politique posée que rien n'appelait (D61, D67) et une fois un
 * écran vers lequel rien ne menait (D92) : *la porte se pose dans le même
 * ticket que la pièce.*
 */
function Entree({
  role,
  perimetre,
}: {
  role: Role | null;
  perimetre: PerimetrePlanning | null;
}) {
  if (role === null) {
    return null;
  }
  if (estRolePortail(role)) {
    return (
      <LienPrimaire href="/portail">{t("arrivee.entrer.portail")}</LienPrimaire>
    );
  }
  if (perimetre?.acces === "restreint") {
    return (
      <LienPrimaire href="/terrain">{t("arrivee.entrer.terrain")}</LienPrimaire>
    );
  }
  return (
    <LienPrimaire href="/planning">{t("arrivee.entrer.planning")}</LienPrimaire>
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
    <dl className="bg-societe-primaire text-societe-primaire-encre flex flex-col gap-3 rounded-lg px-4 py-3.5 text-[13px]">
      <Ligne libelle={t("arrivee.societe")} valeur={arrivee.societe ?? ""} />
      <Ligne libelle={t("arrivee.role")} valeur={arrivee.role ?? ""} />
    </dl>
  );
}
