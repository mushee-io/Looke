# Looke staging infrastructure

Provisioned on 2026-10-31 for isolated development:
- Neon organization: Mushee (free plan)
- Neon project name: `looke-ultra-staging`
- Neon project ID: `winter-credit-26110568`
- Region: `aws-eu-west-2`; PostgreSQL 16
- Migrations applied successfully: `db/001_social.sql` and `db/002_coin_events.sql`.
- Verified tables: looke_challenges, looke_coin_events, looke_follows, looke_indexer_cursors, looke_likes, looke_posts, looke_profiles, looke_sessions.
- No unrelated Neon database was modified. Database connection string was not committed or printed in docs.

## Hosting blocker
An attempt to create an isolated Vercel project `looke-ultra-staging` connected to `mushee-io/Looke` under the Mushee team returned HTTP **403 forbidden** ("You don't have permission to create the project"). No Vercel project was created and no production environment was changed.

**Needed:** a team owner/member with permission to create a Vercel project or an approved alternative deployment environment. After that:
1. Create a protected staging deployment on the team, linked to `mushee-io/Looke`.
2. Retrieve the Neon connection string for project `winter-credit-26110568` through its secret manager; set `DATABASE_URL` securely as a Vercel server-side secret, **never as `NEXT_PUBLIC_DATABASE_URL`**.
3. Deploy and test auth challenge/verify, posts, follows, profile updates, API health and Uniq queries with authorized testnet wallets.
4. Add distributed rate limiting, abuse/malware protection and operational logging before opening social posting publicly.
5. Leave `NEXT_PUBLIC_LOOKE_UNIQ_MINT_LAB=false`, trade execution disabled and all mainnet financial operations NO-GO until separate verification.

No live financial or public mint services are enabled by these database migrations.
