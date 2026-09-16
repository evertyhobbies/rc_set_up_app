# RC Setup Sheets

Base and race-day setups for your RC cars — mobile-first, backed by Neon Postgres.

## What's here

- `src/db/schema.ts` — the data model: car models → versioned setup templates →
  sections → fields (scoped to car / axle / corner, tiered main / detail) →
  cars → setups → values.
- `src/lib/compute.ts` — evaluates computed fields (final drive ratio, corner
  weight %) from a formula stored per field, so a different car's drivetrain
  math is just data, not a code change.
- `src/db/seedData.ts` — seeds the Xray X4 '22 template (summary tier only,
  as agreed) plus a demo car and empty base setup. `src/db/seed.ts` is a thin
  CLI wrapper around it; `/api/setup/seed` runs the same thing in the browser.
- `src/app/api/setup/migrate` and `.../seed` — one-time bootstrap routes:
  visit each once after deploying to set up the database with no CLI at all.
- `src/app/` — garage list page, and the car-plan-style setup summary page
  (FL / front / FR on top, RL / rear / RR on bottom, matching the physical
  sheets), with editable fields that save on blur.

## Set up entirely in the browser (no terminal)

1. **GitHub** — go to github.com → New repository → create it empty (no
   README/template). Open it, click "Add file → Upload files", and drag in
   everything from the unzipped `rc-setup-app` folder (keep `node_modules`
   and `.next` out — there shouldn't be any here yet). Commit.

2. **Neon connection string** — in the Neon console (your `misty-wind-95810124`
   project), open Connect and copy the pooled connection string. You'll need
   it in the next step.

3. **Vercel** — go to vercel.com/new, import the GitHub repo you just
   created. Before the first deploy, add an environment variable:
   `DATABASE_URL` = the connection string from step 2. Deploy.

4. **Apply the schema and seed data** — once deployed, visit, in order:
   - `https://<your-project>.vercel.app/api/setup/migrate`
   - `https://<your-project>.vercel.app/api/setup/seed`

   The seed response includes a `demoUrl` — that's your demo X4 setup page.
   Visit `https://<your-project>.vercel.app/` for the garage list.

That's the whole path — GitHub's upload page, Neon's dashboard, and Vercel's
import flow are all in-browser, so this works from an iPad as well as a
computer.

Once it's working, it's worth deleting or auth-protecting the two
`/api/setup/*` routes — they're unauthenticated and meant only for this
one-time bootstrap.

## Local setup (optional, if you ever have a terminal handy)

```
npm install
cp .env.example .env.local   # fill in DATABASE_URL
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev
```

## Not built yet

Values are editable (tap a field, type, it saves on blur — no save button).
Still missing: the detail-tier toggle, race-setup creation (copy-from-base),
and templates for your other cars. Next steps once you've confirmed this
feels right.
