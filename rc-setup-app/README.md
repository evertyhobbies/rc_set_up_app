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

## Admin, master setups and versions (current flow)

- **Admin → Model database** (`/admin`): one entry per model/year (e.g. XRAY X4 '26). Each has:
  1. **Setup sheet:** the manufacturer's editable PDF, which becomes the template. Replacing it with a newer PDF keeps values.
  2. **Summary layout:** which sheet boxes show on the Summary drawing and where (front, rear, per wheel, bottom strip).
     It's pre-filled from XRAY-style box names (`fr-ride-height`, `re-camber`, `pinion`…).
  3. **Files:** manual, parts list, exploded view and more, kept in a **private Vercel Blob** store.
     Uploads go straight from the browser, so there's no 4.5 MB limit; files are served back through `/api/files/:id`.
- **Model Select** (`/models`): your model/years. Each has one **Master** (edited on the PDF sheet) and numbered
  **versions** (v1, v2…), shared by the whole model/year.
  - **Save master as vN** takes event, track and date from the sheet's own event boxes (`race`, `track`, `date`).
  - Versions are read-only snapshots. "Load into master" copies one back to work from.
- **Summary** (`/models/:id/setups/:setupId`): a top-down touring chassis drawing with the chosen values around it.
  It's read-only and always matches the sheet.
- **Files** on the home screen lists every model's files.

Needs a Vercel Blob store connected to the project (private, with the read-write token env var for browser uploads).
Migration `0003_model_db_versions` is additive (`/api/setup/migrate`).

## Model Select, PDF sheets and setup views (Nov 2026)

- **Home** (`/`): Model Select, Files, Live RC Links, Find Parts (the last three are placeholders).
- **Model Select** (`/models`, was the old `/` Garage): your cars, plus **Create new model → from scratch**:
  Type → Manufacturer → Scale → Model → Year → name it. Choices come from the `car_types`, `manufacturers`,
  `scales` and `car_models` tables, and every step has **+ Add new**. A new year of a model you already have
  (e.g. X4 '26 next to X4 '22) copies that model's summary layout, calculations and constants.
- **Car page** (`/cars/:id`): base and race setups, **New setup** (blank or copying all values from another),
  and **upload the setup sheet PDF**. The browser renders each page to an image and reads every fillable box.
  Each box becomes a field in a "Setup sheet" section (detail tier), so its values go in `setup_values` like the rest.
- **Setup page** tabs:
  - **Summary**: the corner layout, as before
  - **Sheet**: the real PDF sheet with editable boxes
  - **All fields**: a list view (Main, or Main + detail)
  All three read and write the same values.
- **Link fields** (`/templates/:id/map`): point a sheet box at a summary field (e.g. the sheet's front-left ride
  height → Ride height · FL) so both views share one value. Existing values move across. Boxes left as "Sheet only"
  can be renamed and promoted to the Main tier. Re-importing a newer PDF keeps these links.

### Build setup with AI

After a sheet is uploaded, **Build setup with AI** on the car page has Claude read it:
1. **Layout:** the whole page goes to the AI, which returns the sheet's sections with bounding boxes.
2. **Sections:** the browser cuts a sharp close-up of each section with every box outlined and numbered.
   The AI returns a label, unit, main/detail tier and storage for every box. Storage is either its own
   field, or a link to a summary field (a corner, or a whole axle, e.g. front ride height → FL + FR).
   Up to 4 sections run at once, each in its own short request.
3. **Review:** the proposal shows as cards. Edit labels, units, tiers and links, then **Apply**.

The setup page then gets a **Setup** tab: one card per section, with the manufacturer's own drawing
(boxes live and clickable on it) next to a clean list of that section's settings.
Re-running keeps all values, and so does re-uploading a newer PDF.

Needs `ANTHROPIC_API_KEY` in Vercel (Production + Preview). Optional: `AI_MODEL` (default `claude-opus-5-5`).
`AI_MOCK=1` returns canned answers for local testing.

### Deploying this update

1. Merge the branch (Vercel builds a preview first).
2. Visit `/api/setup/migrate` once. Migrations `0001_sheets_and_catalog` and `0002_ai_sections` are additive and safe to re-run.
   Your existing cars, setups and values are untouched. It also:
   - adds the lookup lists,
   - fills in model / year / scale for existing models (X4 '22 → X4, 2022, 1/10),
   - adds an X4 '26 model, with its constants copied from the X4 '22.
3. Model Select → Create new → Touring → Xray → 1/10 → X4 → 2026, then upload the **Editable** sheet
   (`x4_2026_set_up_editable_v02.pdf` from teamxray.com). The flattened "Basic" sheets have no fillable boxes.

Local dev also works against a plain Postgres: `src/db/index.ts` uses node-postgres when `DATABASE_URL`
isn't a Neon URL. `npm install` copies the pdf.js worker into `public/` (see `scripts/copy-pdf-worker.mjs`).

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
