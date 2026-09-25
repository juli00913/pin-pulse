# Pin Pulse

A private dashboard with the pins people love on Pinterest right now, for knitwear inspiration. It doesn't use search terms: it reads Pinterest's "ideas" pages, which list Pinterest's own most popular pins for a topic.

- **Дрехи (Clothes)**: knitwear pins from pages like Knitwear, Knit Fashion, Cable Knit and Cardigan Outfits (last 14 days).
- **Визии за дизайн (Visuals)**: pins to use for designing knitwear graphics: patterns & motifs, illustrations & graphics, nature & textures, paintings & drawings (last 30 days).
- **Източници и настройки (Sources)**: turn pages on or off, add your own ideas pages, and choose how many pages are read per day.

Pins are ranked by saves per day since they were posted. Each page is re-read every few days, and a pin seen again also shows how many saves a day it's gaining now.

Data comes from the Apify actor `memo23/pinterest-scraper`. A Vercel Cron job refreshes it every morning.

## Deploy on Vercel (about 10 minutes)

1. **Put the code on GitHub.** Create a new private repository and upload the contents of this folder (drag and drop works on github.com).
2. **Import it in Vercel.** At vercel.com, choose Add New → Project, pick the repository and click Deploy. No build settings are needed.
3. **Add a database.** In the project, open the **Storage** tab, click Create → **Upstash for Redis** (free plan) and connect it to the project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
4. **Add these environment variables** under Settings → Environment Variables:

   | Name | Value |
   |---|---|
   | `APIFY_TOKEN` | your Apify API token |
   | `ADMIN_PASSWORD` | a password you choose, used to save settings |
   | `CRON_SECRET` | any long random text (lets Vercel's scheduler call the refresh) |

5. **Redeploy.** Go to the Deployments tab → ⋯ → Redeploy, so the new variables are picked up.
6. **Open the site.** The first visit loads the 25 Sept data. The daily refresh runs at 04:00 UTC (07:00 Sofia in summer, 06:00 in winter). On the free plan it can run any time within that hour.

To run a refresh by hand, open `https://<your-site>/api/refresh?key=<ADMIN_PASSWORD>`.

## Costs

- Vercel Hobby and Upstash free plans are free for this use.
- Apify: about $0.04 per ideas page (about 20 pins). The default of 4 pages a day comes to about **$4.50 a month**, inside Apify's free $5 monthly credit. Apify stops runs when the credit runs out, so there are no surprise bills. The free plan also allows only 5 runs at once, so the app reads at most 4 pages at a time.

## Files

- `public/index.html`: the dashboard
- `api/data.js`: returns pins and settings to the page (`?tab=clothes` or `?tab=visuals`)
- `api/refresh.js`: the daily job (Vercel Cron, see `vercel.json`)
- `api/config.js`: saves sources and pages per day (password protected)
- `lib/pipeline.js`: fetching and scoring logic
- `lib/store.js`: storage (Upstash Redis, or a local file for testing)
- `lib/sources.js`: the default ideas pages and categories
- `lib/seed-data.js`: the first data pull (25 Sept 2026), loaded once

Local preview: `npm run dev`, then open http://localhost:3000. It uses a local file instead of Redis.

## Good to know

- Pinterest doesn't publish view counts, so the app ranks pins by saves and how fast they grow.
- These Apify actors scrape public Pinterest pages, which goes against Pinterest's terms of service. If one stops working, change the actor name in `lib/pipeline.js`.
- The site has no login. Only saving settings needs the password. The address isn't listed anywhere, and pages are marked `noindex`.
