# M6 — Feed and text publishing

M6 upgrades the signed-in, database-backed Looke social feed. It is **not** a content coin issuance or creator monetization system.

## Built

- `GET /api/posts` serves deterministic newest-first 20-post pages with an opaque public cursor (PostgreSQL microsecond-precision timestamp plus UUID). Response includes `nextCursor`, author details, likes, followed state and whether the logged-in visitor owns each post.
- `POST /api/posts` requires a valid signed-in session and same-origin JSON request, validates non-empty text up to 1200 Unicode characters, and atomically enforces a maximum of 3 new posts per minute per creator using PostgreSQL advisory locks.
- `PATCH /api/posts/[id]` allows only a post's author to edit it while visible; edit history is marked by `edited_at`, with a 10-second cooldown to discourage repeated updates.
- `DELETE /api/posts/[id]` permanently removes the author's own post; likes and reports are cascade-deleted using existing foreign keys. Other users receive a generic 404.
- `POST /api/posts/[id]/report` requires authentication and accepts only five preset reasons. It rejects self-reporting, stores private reports uniquely per reporter/post and limits new reports to 20 per day per account. Reports are **not automatically converted into removal decisions**.
- The feed UI has a browser-local text draft, pagination, two-step delete confirmation, inline post editor, and a report form. Reporting does not pretend a moderator has acted.
- The existing creator profile page and author links remain usable. All database records come from the Looke dedicated Neon project, not other Mushee products.
- Pure regression tests cover text validation, report reasons, strict IDs and microsecond keyset cursors.

## Database migration

Apply `db/004_feed_publishing.sql` after the initial Looke social migration. It adds `edited_at`, a keyset index, and the private `looke_post_reports` table. This has been applied to Looke's **dedicated Neon staging project**, but production environments still require an authorized migration.

## Media and moderation limitations

- **Photos and videos are not yet uploadable.** Public media should not be enabled before a validated upload/storage pipeline, file-type sniffing, maximum size and duration checks, malware/abuse moderation, signed storage credentials, takedown procedures and tested resource quotas.
- The report queue is stored in PostgreSQL for authorized moderation operations. No public API returns reports. An audited moderator review console, identity-based permissions, appeal process and operational alerting are still required.
- Public posting at scale will also require load tests, abuse monitoring, edge limits, improved user safety controls, and feed indexing.
- Locally saved drafts may remain on a shared browser; they are not encrypted, uploaded or recoverable from another device.
- Changes to a post's text currently overwrite its previous content; an independent edit audit ledger is not yet implemented.

## Acceptance checklist

- [ ] Deploy the app on an authorized protected HTTPS staging environment connected only to Looke's dedicated database.
- [ ] With two actual independent signed-in accounts, publish posts concurrently and verify the 3/minute quota cannot be bypassed.
- [ ] Verify page boundaries, timestamp collisions and newest-first ordering with large sets of real posts and independent database queries.
- [ ] Confirm that an unrelated account cannot edit/delete another user's post; hidden/removed posts cannot be edited or shown publicly.
- [ ] Test reported-post privacy, report deduplication, moderation decisions and safe deletion with real users.
- [ ] Verify text draft persistence, mobile keyboard/screen-reader flows, post editing and explicit deletion.
- [ ] Implement vetted image/video upload storage, background scanning, content moderation, accessibility metadata and removal workflows.
- [ ] Complete production load/security review and monitoring.

**M6 remains partial until media publishing, live multi-account testing and moderation infrastructure are verified.**
