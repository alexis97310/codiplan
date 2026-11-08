import { dansUnEchangeAuth } from "@/lib/auth/echange";
import {
  deposerDemande,
  lireDemandePourCreation,
  numeroDeLaDemande,
} from "@/lib/demandes/depot";
import { schemaDepot } from "@/lib/demandes/saisie";
import { lireMachine } from "@/lib/machines/depot";

import {
  contextePortailDemande,
  motifDuRefusPortailDemande,
} from "../contexte";
import { avecFiletPortailDemandes } from "../filet";
import {
  creationDemandePortailRecue,
  versLeRetourPortailDemandes,
} from "../saisie-recue";

/**
 * DÉPOSER UNE DEMANDE DEPUIS LE PORTAIL (9J04-PORTAIL-DEMANDES, CLI-4).
 *
 * Même dépôt que le bureau (`lib/demandes/depot.ts`), jamais une recopie de
 * la règle — seules la PORTE et la SAISIE diffèrent (D70, D97), même
 * décision que `app/api/portail/contacts/creer/route.ts`.
 *
 * **`source` EST IMPOSÉ ICI, EN DUR** — jamais lu du formulaire : c'est la
 * garde explicite des INTERDITS du ticket, et c'est elle qui rend ce dépôt
 * reconnaissable (`SOURCES_DEMANDE` porte six valeurs, un compte portail ne
 * doit pouvoir en forger aucune autre).
 *
 * **LE SITE EST DÉDUIT DE LA MACHINE (CLI-4.1)**, jamais saisi en même temps
 * qu'elle : `lireMachine` lit SOUS LE CONTEXTE PORTAIL (`lib/machines/depot
 * .ts`, forme « parc ») — une machine hors du périmètre du compte, ou
 * inexistante, rend `null` dans les deux cas (D35, D50), et c'est ce refus
 * qui protège contre une machine forgée. Sans machine désignée (CLI-4.2), le
 * lieu vient directement du formulaire — c'est alors `deposerDemande`, puis
 * la politique `WITH CHECK` de `demande`, qui referment si ce lieu sort du
 * périmètre du compte.
 *
 * **`urgence` RESTE FIXÉE ICI, EN DUR** (décision d'Alexis du 08/11/2026,
 * 9K03) — un client ne la choisit pas. **`machine_arretee` VIENT DU
 * FORMULAIRE** depuis 9K03 : ce n'est plus la seule valeur forcée.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() =>
    avecFiletPortailDemandes(() => traiter(requete)),
  );
}

async function traiter(requete: Request): Promise<Response> {
  const porte = await contextePortailDemande();
  if (porte === null) {
    return versLeRetourPortailDemandes(await motifDuRefusPortailDemande());
  }

  const formulaire = await requete.formData();
  const saisie = creationDemandePortailRecue(formulaire);
  if (saisie === null) {
    return versLeRetourPortailDemandes("portail.demandes.refus.saisie");
  }

  // REJOUABILITÉ (un double clic ne dépose qu'une demande) — même patron que
  // `/api/demandes/creer`, lue SOUS LE CONTEXTE cloisonné : un `id` d'un
  // autre client ne s'y voit jamais.
  const dejaDeposee = await lireDemandePourCreation(porte.contexte, saisie.id);
  if (dejaDeposee !== null) {
    const identifiant = await numeroDeLaDemande(porte.contexte, saisie.id);
    return versLeRetourPortailDemandes("portail.demandes.cree", identifiant);
  }

  let siteId: string | null;
  if (saisie.machineId !== null) {
    const machine = await lireMachine(porte.contexte, saisie.machineId);
    if (machine === null) {
      return versLeRetourPortailDemandes(
        "portail.demandes.refus.machine_inconnue",
      );
    }
    siteId = machine.site_id;
  } else {
    siteId = saisie.siteIdSaisi;
  }
  if (siteId === null) {
    return versLeRetourPortailDemandes("portail.demandes.refus.saisie");
  }

  const depot = schemaDepot.safeParse({
    id: saisie.id,
    source: "portail",
    client_id: porte.clientId,
    site_id: siteId,
    machine_id: saisie.machineId,
    contact_id: null,
    description: saisie.description,
    urgence: "p3",
    machine_arretee: saisie.machineArretee,
    etat_machine: null,
    date_souhaitee: null,
  });
  if (!depot.success) {
    return versLeRetourPortailDemandes("portail.demandes.refus.saisie");
  }

  const resultat = await deposerDemande(porte.contexte, depot.data);
  return versLeRetourPortailDemandes(
    resultat.accepte ? "portail.demandes.cree" : resultat.cle,
    resultat.accepte
      ? { numero: resultat.fiche.numero, annee: resultat.fiche.annee }
      : undefined,
  );
}
