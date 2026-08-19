# Tests d'isolation — répertoire sanctuarisé

Porte `pnpm test:isolation`, bloquante à chaque ticket (CLAUDE.md §4, arbitrage D14).

Les scénarios de cloisonnement multi-société sont écrits au ticket **L0-05**, une
fois le schéma (L0-03) et les politiques RLS (L0-04) posés : lecture, écriture et
suppression tentées depuis une autre société, chemin `GET /machines/qr/{token}`,
accès d'un compte portail aux données d'un autre client, respect du périmètre de
sites. Au moins douze scénarios, tous verts.

Jusque-là, `gardien.test.ts` protège la porte elle-même : elle doit rester armée
et aucun test ne doit y être neutralisé. **Ne jamais assouplir un test de ce
répertoire pour faire passer la vérification** (CLAUDE.md §5).
