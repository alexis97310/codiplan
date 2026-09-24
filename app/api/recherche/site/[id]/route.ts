import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { obtenirSession } from "@/lib/auth/session";
import { contactsDuClient } from "@/lib/contacts/depot";
import { machinesDesSites } from "@/lib/machines/depot";
import { lireSite } from "@/lib/sites/depot";

/**
 * LES MACHINES ET LES CONTACTS D'UN SITE (SELECTEURS-1, 24/09/2026).
 *
 * Remplace la lecture qu'`interventions/nouvelle` faisait AVANT ce lot pour
 * les 200 sites d'un coup (`machinesDesSites`, `contactsDuClient` par client
 * distinct) : elle ne porte plus désormais que sur le site CHOISI, une fois
 * qu'il l'est. `machinesDesSites` et `contactsDuClient` existaient déjà
 * (chantier INT-MACHINE 2, CONTACTS-1) ; cette route les compose pour un seul
 * site.
 *
 * Le contact rendu est celui du CLIENT (`site_id` nul) ou celui du site
 * lui-même — même filtre que `ChampSiteEtMachines` appliquait déjà côté
 * navigateur avant ce lot, posé ici côté serveur puisque la liste complète
 * des contacts du client n'est plus envoyée d'avance.
 */
async function traiter(
  requete: Request,
  route: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await obtenirSession(requete.headers);
  if (session === null || session.contexte.societeId === null) {
    return Response.json({ erreur: "session_absente" }, { status: 401 });
  }

  const { id } = await route.params;
  const site = await lireSite(session.contexte, id);
  if (site === null) {
    return Response.json({ erreur: "introuvable" }, { status: 404 });
  }

  const [machines, contactsDuClientLu] = await Promise.all([
    machinesDesSites(session.contexte, [id]),
    contactsDuClient(session.contexte, site.client_id),
  ]);
  const contacts = contactsDuClientLu.filter(
    (contact) => contact.site_id === null || contact.site_id === id,
  );

  return Response.json({
    machines: machines.map((machine) => ({
      id: machine.id,
      libelle: machine.libelle,
    })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      libelle: contact.nom,
    })),
  });
}

export async function GET(
  requete: Request,
  route: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, route));
}
