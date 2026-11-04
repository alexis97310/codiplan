# 9J11-NOTIFICATIONS-PRODUCTEUR-SIGNATURE — passation

Budget : T0 07:26 (Pacific/Noumea), limite 100 min. Terminé sans dépasser T0+65 pour le code neuf.

## Point par point

1. **Inventaire** (`lib/avertissements/signature-terrain.ts`) : le courriel au `responsable_sav` part dans
   `envoyerAlerte` (anciennement sans paramètre `contexte`), à la ligne du `Promise.all(... envoyerCourrielMetier
   ...)`, appelée depuis `alerterResponsablesSAV` — le déclencheur appelé par `app/api/terrain/[id]/terminer/
   route.ts` après que `terminerIntervention` a accepté l'issue `client_absent` ou `refus_signature`. C'est ce
   point précis qui reçoit, au même geste, l'ajout de ce ticket.

2. **Brancher** : `envoyerAlerte` reçoit désormais `contexte`, `interventionId` et `connexion` en plus, et
   appelle `journaliserEnvoi` (nouvelle fonction privée) juste après l'envoi des courriels — jamais avant, pour
   ne poser le journal qu'à partir d'un résultat réel. `journaliserEnvoi` appelle `poserNotification(contexte,
   "signature_absente_ou_refusee", { cible: "intervention", intervention_id }, "valider_rapport", undefined,
   connexion)`.

   **Capacité retenue : `valider_rapport`, pas `consulter_parc_complet`.** Mesuré dans
   `lib/auth/habilitations.ts` : `valider_rapport` est `complet` pour `[ADMS, DIR, RM, RS]` — exactement les
   rôles qui valident un rapport terrain, le même geste métier qu'une signature absente ou refusée vient
   perturber. `consulter_parc_complet` aurait ouvert la notification au technicien (`restreint`), qui n'a
   aucune part dans la validation d'un rapport qui n'est pas le sien.

   Le courriel existant (destinataires, sujet, texte, `envoyerCourrielMetier`) n'est pas touché : seul l'AJOUT
   de `journaliserEnvoi` a été posé, dans une fonction annexe.

3. **Journal de l'envoi courriel** : `journaliserEnvoi` calcule `partie = envois.every((e) => e.parti)` à partir
   du résultat RÉEL de `Promise.all(... envoyerCourrielMetier ...)` (le type `Envoi`, `lib/courriel/message.ts`)
   — jamais une valeur supposée, et jamais `true` par défaut : un seul envoi resté `parti: false` suffit à dire
   que l'alerte n'a pas PLEINEMENT atteint le SAV. `canal` est posé à `"courriel"`, `tentee_le` à l'instant lu
   dans le fuseau de la SOCIÉTÉ (`maintenant(lireFuseau(societe.fuseau_horaire))`, jamais `new Date()`, gardien
   `tests/unit/calendar/sans-date-courante-implicite.test.ts`) — la même garde que `marquerLue`
   (`lib/notifications/depot.ts`). L'écriture de `canal`/`tentee_le`/`partie` se fait par un second appel à
   `avecContexteApplicatif` depuis `lib/avertissements/signature-terrain.ts` (`tx.notification.update`),
   `lib/notifications/depot.ts` étant hors territoire de ce ticket — il n'expose aucune fonction pour poser ces
   trois colonnes après coup, et ce ticket ne lui en ajoute pas.

   La notification n'est posée que dans la branche `plan.type === "a_envoyer"` (il existe au moins un
   `responsable_sav` actif) — la branche `sans_destinataire` reste inchangée, aucune notification n'y est
   posée. C'est le même périmètre que l'épreuve d'acceptation du ticket, qui porte sur le cas où le courriel
   part.

4. **Épreuve** (`tests/isolation/signature-terrain-notification.test.ts`, deux scénarios) :
   - une signature refusée pose une ligne `Notification` (`evenement: signature_absente_ou_refusee`) lisible
     par `listerNotifications` sous un contexte `responsable_sav`, avec `canal: "courriel"`, `tentee_le` posé
     et `partie: true` — et le courriel part toujours (`etat.type === "envoyee"`, épreuve non régressée) ;
   - un technicien, qui ne tient `valider_rapport` ni au complet ni au restreint, ne la voit pas.

   **Effet de bord corrigé** : `tests/isolation/avertissements-logo-en-echec.test.ts` créait et effaçait une
   intervention de test pour son scénario `alerterResponsablesSAV` ; depuis ce ticket, cette intervention porte
   aussi une `Notification`, et la contrainte `notification_societe_id_intervention_id_fkey` (`RESTRICT`)
   retenait la ligne au moment de l'effacer. Son `supprimerLigne` efface désormais la `Notification` avant
   l'intervention — même geste que le nouveau fichier de ce ticket. Un run antérieur, interrompu avant ce
   correctif, avait laissé une ligne orpheline dans `codiplan_test` (`01a1a848-6ebe-7e38-b735-12f142787f38`),
   nettoyée à la main par `psql` avant de rejouer `pnpm test:isolation` en entier (212 fichiers, 1835 tests,
   vert).

5. **Gardien de chemins** : l'exemption de `poserNotification` dans `FONCTIONS_SANS_CHEMIN`
   (`scripts/lib/chemins-de-depot.ts`) est retirée — `pnpm chemins` la montre désormais atteinte depuis
   `app/api/terrain/[id]/terminer/route.ts` via `lib/avertissements/signature-terrain.ts`.

## Ce qui reste à faire (prochain ticket, déjà nommé par le territoire)

1. **9J19** — le second producteur (`suite_a_donner_id` s'ajoute à la cible disjointe à ce moment-là).

## Vérification jouée

`CI=1 pnpm verify:full` lancé en un seul appel, sortie dans
`docs/etudes/equipe-2026-10-29/tickets/9J11-verify-final.txt`.
