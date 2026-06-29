# 🐦‍🔥 chirp 🐦‍🔥

## How to run
Most of the scripts can be found in `package.json`. After cloning the repo, you should be able to run:
* `bun start`

This will:
1. drop the database (if not empty already)
2. run the migrations
3. seed the database
4. start the next.js app

The seeding is done deterministically via [faker](https://fakerjs.dev) creating aorund **~50 users**, **~250 tweets**, and create around **~250 follows**.
While the database-ids for each row (users, tweets etc.) are using postgres' native support for `uuid7` (normally ordered and with some slight randomness) they will be deterministic as well.
The reason for picking uuid7 as the primary-key was in order to get ordering "for free". But being able to perform automated tests, especially with data that has the "right" shape.
That often requires me to reach a certain  threshold before I can start to feel confident a reasonable part of a system's behaviors are exercised tested in a way
that's faithful to how it would behave in production.

Note that the postgres instance is run as a docker container using tmpfs volume. That can be changed in the  `docker-compose.yml` file at the root of the repo. If you don't want to run the db with docker there are other scripts in `package.json` which
to run the next.js server separately, there are also scripts related to migrations, seeding the database and various options for how
to run the API-tests / Integration-tests. (See the next section for more info).


## Other useful commands
`bun test`
`bun test:api`
`bun test:api:docker`

If you use `nix` there's a flake.nix in the root of the repo which is my preferred way of dealing  the kind of complexity I used to need to resort to docker for. But since I'm aware that not that many people use Nix I also included some additional ways for example to run
the API-tests / Integration-tests that actually runs against the backend's json API.  These tests also relies on the determinstic seeding of synthetic data.
If you use Nix, you don't really need to do anything. `bun test:api` should just work fine to run without any env variables etc. If you use any tool along the lines of `uv` `pipx` `pip` you can of course install the CLI-tool used for those tests.
Otherise `bun test:api:docker` can be used to run this tool in a ephemeral container, although I've only tested the script on Mac.

## Skivvy
The CLI-tool for doing the testing mentioned above is called skivvy and its repo can be found [here](https://github.com/hyrfilm/skivvy). It was mostly developed during a number of years I spent in the medtech-industry. The Github-repo contains quite detailed documentation of it including a in-browser [playground](https://hyrfilm.github.io/skivvy/) where you
can try out various suites, tests to get a feel for it. (It also contains a number of mini-tutorial for testing everything from HTTP-headers, OAuth, GraphQL etc).

## Fast-check
Orignally born out of the Haskell-community _Property-based testing_ is, at least to me, and invaluable tool for code that are either business-critical, complex, or have invariants that need to be "guaranteed". In contrast to unit-tests,
property-based testing is slightly more formal. Instead of creating some more or less arbitrary unit-tests you specify what properties should be maintained, which at run-time creates a huge number of unit-tests. These tests can be found in`age-comparisions.test.js`, which generates around 50,000 unit-tests with data varifying according how you have decided to model things. It's can also be extremely useful to 
detect subtle race-condition bugs and for creating fuzz-tests.

## Other architectural considerations
I mostly chose to focus on testability when I did this exercise, and due to lack of time, the rest of the design is pretty mundane.
The browser requests one or more tweets, the server looks them up in the database and delivers them as JSON which the frontend then uses
to send events, and render its local state. I seriously considered using `XState` on the frontend-side but it felt a bit too overkill.
A bit too much over-engineering, So I skipped it and focused on making the frontend as thin and dumb as possible. 😉

`constrainedExactlyTwice` did throw me off alittle bit thoughould use a fixed table indexed by age, but a Set is already space-bounded by the small age domain, so the table is a constant-factor win, not an asymptotic one. More importantly, indexing-by-age moves the "ages are in-range" invariant out of the data and into arithmetic a maintainer has to preserve — a more fragile interface for no practical gain. I'd reach for the table only under real performance pressure.

## TL;DR
Most of my focus has been on achieving better automated-testing and due to some lack of time, most of the app is otherwise
quite basic unfortunately - one could even say... Boring! 😉