# Dragon Media Production Baseline

Date: 2026-09-24

## Code
- Repository: kareem766/dragon-media-saas-new
- Production branch: main
- Stable production commit: 3cd616ad7642185d4df00d907d07f51a883cb3b3
- Stable baseline branch: production-baseline-2026-09-24
- Latest production deployment: dpl_ECbPXZF3vkwiEs9yiEoboy19TGZa
- Production deployment state: READY

## Database
- Supabase project: pukqeiagqjqketcecipz
- Latest applied migration: 20260923201118_harden_admin_payment_rpc_active_checks
- Public tables audited: RLS enabled on all listed public tables.

## Environment
Secrets must remain in Vercel/Supabase secret storage and must never be committed.
Required environment variable names are documented in .env.example.

## Recovery
1. Code rollback target: production-baseline-2026-09-24
2. Vercel rollback target: dpl_ECbPXZF3vkwiEs9yiEoboy19TGZa
3. Database recovery must use Supabase backups/migrations; do not restore or rewrite production data ad hoc.

## Change policy
- Do not make large direct changes on main.
- Create a feature/fix branch first.
- Verify build and deployment before promoting.
- Database DDL changes must be migration-based and verified.
