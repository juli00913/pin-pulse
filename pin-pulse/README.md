# Pin Pulse

A private dashboard showing what Pinterest is saving right now, built for knitwear inspiration.

- **Today's pins**: the top pins for a few searches each day, ranked by saves per day since posting. Pins that come back on a later day also show how fast they are gaining saves.
- **Trend radar**: Pinterest's fastest-rising searches for the US, UK & Ireland, DACH and France, in women's fashion, DIY & crafts and home decor. Refreshed weekly, and the history builds up over time.
- **Watchlist & settings**: choose which searches to follow and how much to fetch each day. The page shows an estimated monthly cost.

Data comes from Apify (actors `data_ops_main/pinterest-trends` and `parseforge/pinterest-scraper`). A Vercel Cron job refreshes it every morning.

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
6. **Open the site.** The first visit loads the 25 Sept snapshot. The daily refresh runs at 04:00 UTC (07:00 Sofia in summer, 06:00 in winter). On the free plan it can run any time within that hour.

To run a refresh by hand, open `https://<your-site>/api/refresh?key=<ADMIN_PASSWORD>`. Add `&trends=1` to also re-fetch the weekly trends.

## Costs

- Vercel Hobby and Upstash free plans are free for this use.
- Apify: about $0.0025 per pin and $0.002 per trend search. The default settings (48 pins a day, trends weekly) come to about **$4.30 a month**, which fits inside Apify's free $5 monthly credit. Apify stops runs when the credit runs out, so there are no surprise bills.

## Files

- `public/index.html`: the dashboard
- `api/data.js`: returns pins, trends and settings to the page
- `api/refresh.js`: the daily job (Vercel Cron, see `vercel.json`)
- `api/config.js`: saves the watchlist and budget (password protected)
- `lib/pipeline.js`: fetching and scoring logic
- `lib/store.js`: storage (Upstash Redis, or a local file for testing)
- `lib/seed-data.js` + `public/seed/`: the first data pull, shown until the first refresh

Local preview: `npm run dev`, then open http://localhost:3000. It uses a local file instead of Redis.

## Good to know

- Pinterest doesn't publish view counts, so the app ranks pins by saves and how fast they grow.
- These Apify actors scrape public Pinterest pages, which goes against Pinterest's terms of service. If one stops working, change the actor name in `lib/pipeline.js`.
- The site has no login. Only saving settings needs the password. The address isn't listed anywhere, and pages are marked `noindex`.
