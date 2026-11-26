# switchLAND.IN — mobile + web property discovery

A React Native + Expo starter that runs on Android, iOS, and the web. It includes plot listings, plot detail sheets, proposed-investment interest submission, aggregate progress, and a basic admin add-plot screen.

## 1. Requirements
- Install Node.js LTS: https://nodejs.org/
- Install Expo Go on your Android phone from Google Play.
- Install VS Code (recommended).

## 2. Run locally
Open this project folder in VS Code, then open Terminal in that folder:

```bash
npm install
npx expo start
```

A QR code appears.
- Android: open Expo Go and scan the QR code.
- iPhone: scan with the Camera app and open in Expo Go.
- Browser: press `w` in the terminal, or run `npm run web`.

Your computer and phone should be on the same Wi-Fi for the easiest local connection. If discovery fails, run:

```bash
npx expo start --tunnel
```

## 3. Easiest database: Supabase
1. Create a free project at https://supabase.com/
2. Open the project's SQL Editor.
3. For a new database, run `supabase/schema.sql` in SQL Editor to create the tables. If the tables already exist, skip that file. Then run `supabase/venture-map-migration.sql` to add map, apartment, sale/rent, and media fields, followed by `supabase/seed-nirmala-kubera.sql` to add the Nirmala Kubera Heights listing and remove only the three named starter examples.
4. In Supabase, open Project Settings → API (or Connect).
5. Copy the Project URL and the publishable/anon key. Never use the secret/service-role key in a mobile app.
6. Copy `.env.example` to a new file named `.env` in the project root.
7. Put your Supabase values into `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

8. Stop Expo with Ctrl+C, then restart:

```bash
npx expo start -c
```

The app will now load plot data from Supabase and save investor interest submissions.

## 4. Maps and venture photos
- Add `latitude` and `longitude` (decimal degrees) to each plot row. The map only places pins for rows with valid coordinates.
- Listings can be plots, flats/apartments, commercial properties, or buildings, offered for sale or rent. Search filters include property type, sale/rent, and availability.
- For the web map, enable the Maps JavaScript API and billing, then set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to a key restricted to your website domains and that API. The map focuses on one property pin, hides Google points of interest, and switches to a tilted satellite view when selected.
- For native Google Maps, set `GOOGLE_MAPS_IOS_API_KEY` and/or `GOOGLE_MAPS_ANDROID_API_KEY` in `.env`. Restrict keys to your app identifiers and the matching Maps SDK. Native Google Maps configuration requires a development or production build; Expo Go on iOS previews with Apple Maps until the iOS key is configured in a new build.
- The SQL setup creates the public `venture-photos` bucket. Add listing photos from the device gallery or camera; the app stores their public URLs in `photo_urls`. Uploads are limited to JPEG, PNG, or WebP and 10 MB per image.
- The starter migration permits public demo uploads and listing edits so the un-authenticated demo form works. Add Supabase Auth and restrict these policies to admins before using this with real property or customer data.
- Copy `.env.example` to `.env` and restart Expo after adding keys. Never expose the Supabase secret/service-role key.

## 5. Open the app from anywhere
- For testing on your own Wi-Fi: use Expo Go + QR code.
- For a shareable web preview: deploy the web build to Vercel or Netlify. A simple path is:

```bash
npx expo export --platform web
```

This creates `dist/`. For Vercel, use the **Other** framework preset, build command `npx expo export --platform web`, and output directory `dist`. Add the `EXPO_PUBLIC_SUPABASE_*` variables and `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in the hosting dashboard and rebuild.

## 6. Build an installable Android app
For an APK/AAB, use Expo Application Services (EAS):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

Follow the EAS prompts. The build page provides the install link when complete. For a Play Store release, use `--profile production` and an AAB.

## 7. Important security note
This is a learning/MVP starter. The SQL includes permissive demo policies so you can test quickly. Do NOT use those policies with real investor data. Before launch:
- Add Supabase Auth.
- Create a profiles table with roles.
- Restrict plot creation/update/delete to admins.
- Restrict investor names, phone numbers, and individual amounts to authorized admins and the investor themselves.
- Expose only aggregate totals to public users.
- Never put the Supabase secret/service-role key in the app. `EXPO_PUBLIC_*` values are shipped to clients.
- This is an Expo client, not a server runtime; do not install `@supabase/server` in the app. Put privileged operations in a Supabase Edge Function or separate backend and keep secret keys there.
- Have an Indian property lawyer review title, ownership, agreements, payments, and any fractional/group-purchase structure.

Amounts in this starter are non-binding expressions of interest, not payments or legal ownership.
