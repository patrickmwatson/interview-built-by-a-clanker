These two folders are the ORIGINAL buggy storefront (commit 325f5e5 of github.com/patrickmwatson/interview-built-by-a-clanker,
exported with git archive, no source fix applied) built as a static hash-routed bundle.
Only two hosting changes were made, and neither touches a bug:
  1. the hosting commit 9e62d60 (env-driven API base, hash router), applied on top of 325f5e5
  2. the browser storage key "auth_token" was renamed (auth_token_b / auth_token_bp) in the built file so the Before and After apps,
     which share one browser origin inside the tour page, do not overwrite each other's sign-in.
before/    talks to /eci-storefront-api-before/       (port 7474, ENFORCE_AUTH=true, so signed-in features can be seen alone)
before-pure/ talks to /eci-storefront-api-before-pure/ (port 7473, exactly as shipped: auth off by default)
