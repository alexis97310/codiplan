# Amorçage de la parité légale fixe XPF/EUR

## Contexte

Le socle multi-société (L0-03) déclare deux devises, XPF et EUR, mais laissait la
table `parite` vide : le commentaire du schéma et l'arbitrage D20 renvoyaient la
« convention de base et de sens du taux » au lot reporting. La demande est
d'amorcer dès maintenant la parité légale fixe du franc Pacifique — 1 EUR =
119,331740 XPF, source « parité légale fixe » — afin que la base porte une parité
datée exploitable (I2, D20).

Amorcer cette ligne impose de trancher deux points que D20 laissait ouverts : le
sens du taux et la date d'effet. Ces choix ont été validés explicitement avec le
porteur du besoin avant écriture (CLAUDE.md §8, décision devise).

## Options écartées

- **Stocker le taux inverse (EUR pour 1 XPF ≈ 0,00837998).** Cohérent mais
  contre-intuitif au regard de l'énoncé « 1 EUR = 119,331740 XPF » et source de
  confusion à la relecture. Écarté au profit de la lecture directe.
- **Prendre la date du jour comme `date_effet`.** Une parité *légale fixe* a une
  date d'effet réelle ; utiliser la date de seed aurait masqué ce fait et
  introduit une valeur arbitraire (CLAUDE.md §8 : ne jamais inventer un délai).

## Choix

Une seule ligne `parite`, portée par la devise XPF :

- `devise_code = XPF`, `taux = 119.331740` (chaîne décimale, jamais de flottant),
  lu **« XPF pour 1 euro »** — la devise de base de consolidation est donc l'euro ;
- `date_effet = 1999-01-01`, date d'effet de la parité légale fixe (introduction
  de l'euro, à laquelle le franc CFP a été arrimé) ;
- `source = « parité légale fixe »`.

L'amorçage se limite à cette parité fixe et légale. Toute parité de marché, et la
convention générale de la chaîne de consolidation, restent arrêtées au lot
reporting (D20 inchangé sur ce point).

## Conséquences

- `lib/reporting` (seule zone autorisée à convertir, I2) devra consommer ce taux
  comme « montant XPF ÷ taux = montant EUR » et l'exposer avec la devise de
  restitution. La convention est ici documentée, pas encore implémentée.
- Le seed reste idempotent : l'upsert porte sur la clé naturelle
  (`devise_code`, `date_effet`).
- Le test unitaire `tests/unit/seed-data.test.ts` fige la valeur, le sens et la
  date, indépendamment de la base.
