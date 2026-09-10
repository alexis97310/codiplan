import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { Button } from "@/components/ui/button";
import { etatArrivee, type Arrivee } from "@/lib/auth/arrivee";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("arrivee.titre")}
      </h1>

      <dl className="flex flex-col gap-3 text-sm">
        <Ligne libelle={t("arrivee.compte")} valeur={etat.arrivee.nom} />
        <Ligne libelle={t("arrivee.email")} valeur={etat.arrivee.email} />
      </dl>

      {etat.issue === "sans_societe" && societes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("arrivee.sans_societe")}
        </p>
      ) : null}

      {etat.issue === "arrivee" ? <Societe arrivee={etat.arrivee} /> : null}

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

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="font-medium">{valeur}</dd>
    </div>
  );
}

function Societe({ arrivee }: { arrivee: Arrivee }) {
  return (
    <dl className="bg-societe-primaire text-societe-primaire-encre flex flex-col gap-3 rounded-lg px-4 py-3 text-sm">
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
      <h2 className="text-base font-medium">{t("arrivee.choix.titre")}</h2>
      <p className="text-muted-foreground text-sm">{t("arrivee.choix.aide")}</p>
      <ul className="flex flex-col gap-2">
        {societes.map((societe) => (
          <li key={societe.societeId}>
            <form
              action="/api/session/societe"
              method="post"
              className="border-border flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
            >
              <input type="hidden" name="societe" value={societe.societeId} />
              <span className="text-sm font-medium">{nomAffiche(societe)}</span>
              {/* Le rôle s'affiche tel que l'énumération le porte, comme le
                  fait déjà la ligne « Rôle » ci-dessus : la constitution range
                  un nom de rôle du côté de ce qu'une MACHINE lit, et lui
                  inventer dix libellés serait une décision de dictionnaire
                  qu'aucun ticket n'a prise. */}
              <span className="text-muted-foreground text-xs">
                {societe.role}
              </span>
              {societe.societeId === active ? (
                <span className="text-muted-foreground ml-auto text-xs">
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
