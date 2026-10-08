# OPERATION ZERO HOUR

A 5-round, team-based murder mystery competition platform.
Noir-black minimalist UI · Convex backend · Next.js 15 frontend.

- **Teams** log in with `TM-XXX` + access key, progress through 5 admin-controlled rounds.
- **Admins** run everything from the control room: import teams (Excel/CSV), open/close rounds, reveal evidence tapes, set the Round 4 code, file the verdict, watch results land in real time.

## Structure

```
src/app/          Next.js routes (team + admin pages)
src/components/   UI primitives (typewriter, fade-in, icons, status badges)
convex/           Backend: schema + all queries/mutations
test/             flows.ts (60 end-to-end checks) + spike.ts (traffic sim)
```

## Environment

`.env.local` (see `.env.local.example`):

```
CONVEX_DEPLOYMENT=dev:beaming-mallard-142      # deployment id for CLI
NEXT_PUBLIC_CONVEX_URL=https://beaming-mallard-142.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://beaming-mallard-142.convex.site
```

## Commands

```bash
npm run dev          # next dev
npm run build        # production build
npx convex dev       # push functions + regenerate _generated
npx convex deploy    # production push
npm test             # ADMIN_PW=... npx tsx test/flows.ts   (60/60 green)
npm run spike        # TEAM_TOKEN=... npx tsx test/spike.ts
```

## Event-day checklist

1. `npx convex run seed:wipeAndSeed '{"admin1Password":"...","admin2Password":"...","round4Code":"PU88"}'`
2. Log into `/admin`, upload team Excel (team name + participant name + email), **Generate Credentials**, download the CSV (passwords shown once).
3. Rounds tab: enter the 5 evidence tapes (embed URLs + captions) and up to 5 Round-4 clues. Set/confirm the Round 4 code and the Round 5 verdict (suspects + killer).
4. Advance rounds from the Rounds tab; teams see status changes live over WebSocket.
5. Results tab: Round 4 solve ledger, Round 5 submissions ranked **1st / 2nd / 3rd**, correct-killer filter, CSV exports, audit trail.

## Security model

- Passwords and the Round 4 code are stored **hashed only** (salted SHA-256); plaintext credentials are shown exactly once at generation.
- Every gated query/mutation validates the session token server-side (`requireTeamByToken` / `requireAdminByToken`); locked rounds return locked-state, never content.
- Round 4: 5 attempts/minute/team, every attempt logged (audit + attempt feed), code case-insensitive.
- Round 5: one submission per team enforced inside the transaction; submissions rejected after closing; server timestamps only.
- No answers, codes, suspects, or clues are present in the client bundle (verified by grep audit).
- All admin actions written to `audit_log`; attempt feed visible in the Logs tab.

## Scope

Team logins are created exclusively via admin import; there is no public signup, no solo-pool merging — every row of the Excel becomes part of a team.
