This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase locations

The app reads its shared location catalog from Supabase. Copy `.env.example` to
`.env.local`, then set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` to your project's URL and public anon key. You
can set `NEXT_PUBLIC_SUPABASE_LOCATIONS_TABLE` if the table is not named
`places`. These values are used by the browser client, so never put a
service-role key in a `NEXT_PUBLIC_` variable.

The app reads `id`, `created_at`, `name`, `category`, `lat`, `lng`,
`price_level`, and `link` from the `places` table. Neighborhood selection is not
available because the table has no neighborhood column; planning uses a neutral
`Nearby` location. Category values such as `Coffee Shop` are normalized for the
existing category filters; other values remain visible as labels. Price levels
1–3 display as `$`–`$$$`,
not as dollar estimates. Missing links use no action, and missing images use a
generated initial tile. Since this table has no per-user save field, all its
locations appear in Saved Spots.

PostgreSQL table grants are separate from RLS. If the `anon` role gets
`permission denied for table places`, run these grants in the Supabase SQL
editor:

```sql
grant usage on schema public to anon;
grant select on table public.places to anon;
```

For a new setup, enable RLS and add a SELECT policy for the `anon` role:

```sql
alter table public.places enable row level security;

create policy "Allow public location reads"
on public.places
for select
to anon
using (true);
```

If your table has a different name, replace `public.places` in that policy.
The app shows a connection or query error in the locations UI when the
configuration, table, or read policy needs attention.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
