# Browser tests

`slice1.test.js` drives the real pages (login → dashboard → Grocery) in
headless Chromium. Only the Supabase library is replaced, by
`fake-supabase.js`, an in-memory stand-in with an approximate membership
check. It tests page logic, Core services and script wiring; real auth and
RLS are covered by the database checks in `supabase/migrations/`.

```bash
python3 -m http.server 8765 --bind 127.0.0.1 &   # from the repo root
NODE_PATH=$(npm root -g) node tests/e2e/slice1.test.js
```

Needs Node with the `playwright` package. Set `PW_CHROMIUM` to a Chromium
binary if Playwright cannot find one, and `E2E_OUT` for screenshot output.
