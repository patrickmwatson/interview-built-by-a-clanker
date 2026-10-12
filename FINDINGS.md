# Findings: Agentic Personas Storefront

16 seeded bugs found and fixed, one commit each (API and shared first, then web).

| # | Symptom | Root cause | Fix | Commit |
|---|---|---|---|---|
| API-1 | `pnpm build` fails in shared (TS2688) | tsc auto-loads a stray `@types/testing-library__jest-dom` stub | `types: []` in shared tsconfig (api pinned to node types in 0a99f2e) | 1aee572 |
| API-2 | `minPrice` filter returns items at or below the minimum | `<=` instead of `>=` | use `>=` | 477e285 |
| API-3 | Login response has no `user.username` | user object built without it | include `username` | a2de6be |
| API-4 | Browser cannot remove cart or favorite items | CORS methods list lacked DELETE | add DELETE | 7bd9759 |
| API-5 | A user can delete another user's cart item | missing ownership check on DELETE | 404 unless `item.userId` matches | 9194553 |
| API-6 | Cart still full after checkout | cart never cleared after order creation | clear cart after order create | 1c26490 |
| API-7 | Cart, favorites and checkout crash on missing user | auth only enforced when `ENFORCE_AUTH=true` | enforce by default | 5b4bc9b |
| WEB-1 | `pnpm --filter @acme/web typecheck` fails | stray `@types` pickup and unexported `SearchParams` | `types: []`, export the interface | 0fc142d |
| WEB-2 | Persona cards show price 100x too high | `price * 100` | show `price` | 35175fa |
| WEB-3 | Search, filter and sort never refetch | query key ignored the query string | include it in the key | 0c5ce0a |
| WEB-4 | Favorite heart does the opposite action | stray `!` on `isFavorited` | remove `!` | 28b1ef3 |
| WEB-5 | Persona page favorites cache clashes with Favorites page; 401 when signed out | same key for two data shapes, no `enabled` guard | key `["favorites","ids"]`, `enabled: !!user` | 10f0d2c |
| WEB-6 | Logout does not log out after reload; stale cart shown to next user | token left in localStorage, cache kept | remove token, clear query cache | 78fdbb0 |
| WEB-7 | Navbar cart badge never updates | key `cart-count` never invalidated | key `["cart","count"]` | 70e0caf |
| WEB-8 | Cart minus can reach 0 or below | button never disabled | `disabled` at quantity 1 | 57e54be |
| WEB-9 | Star partial fill wrong across cards | duplicate SVG gradient id | unique id per star via `useId` | 89fc70c |

Test and lint: no package defines a test script. `pnpm typecheck` passes for api, shared and web. `pnpm lint` passes (only shared defines it).

## How to verify

```
pnpm install
pnpm build            # exits 0 for shared, api, web
pnpm dev              # web http://localhost:5173, api http://localhost:3001
```

Then in the browser: register, filter by Engineering, add a persona to cart and favorite it, change quantity, check out (cart empties), sign out and reload (stays signed out). A headless Playwright run of exactly these flows passed with no console errors.
