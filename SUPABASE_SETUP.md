# Supabase cloud backup setup

The app continues saving to browser storage. When someone signs in, it merges that account's local transactions with its cloud transactions; it does not clear the browser copy. The first account used on a browser can claim its existing anonymous data. Later accounts on that browser use separate local and cloud data. Each cloud row is private to its signed-in user through Row Level Security.

## 1. Create the Supabase table

In Supabase, open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. The app stores one JSON state row per authenticated user in `public.user_data`.

## 2. Add the public project settings

In Supabase, open **Project Settings → API** and copy the **Project URL** and the **publishable key** (or legacy `anon` key). Never use or share the `service_role` or secret key in this browser app.

For local work, create `.env.local` beside `package.json` with:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

For Cloudflare Workers Builds, add those same names and values under the Worker **Settings → Build → Build variables and secrets**, then trigger a new build. They must be available during the Vite build because Vite embeds `VITE_` values into the browser bundle. These are public client settings; database access is restricted by the SQL policies.

## 3. Allow email sign-in

In Supabase, enable **Authentication → Providers → Email**. Under **Authentication → URL Configuration**, add the deployed app URL to the allowed redirect URLs. If using email confirmation, check the inbox and open the link on the same device/browser.

## 4. Move existing device data

Deploy the configured build, open the app on each device/browser that has existing transactions, go to **Preferences → Cloud backup**, and sign in with the same email. The app merges the transactions found on that device with the account's cloud data. Keep the existing browser data until you confirm the cloud copy appears after signing in on another device.

Anonymous device data cannot be discovered centrally: each browser/device must be opened and signed in once to upload its existing local data. Keep a browser backup until migration is confirmed.
