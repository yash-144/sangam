create table public.users (
    id uuid default gen_random_uuid() primary key,
    stellar_wallet text not null unique,
    google_id text unique,
    email text,
    name text,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
