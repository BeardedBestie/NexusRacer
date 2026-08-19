# Working in this repo

## Git

**Push directly to `main`.** This is an unused prototype and `main` is the test
environment: Netlify deploys every push to `main`, and that deploy is how changes
get tested. Develop on a branch if it helps, but always fast-forward `main` and
push it when the work is done — do not leave finished work sitting on a branch
waiting for a merge, and do not open a pull request unless asked.

## Commands

    npm run dev        # sound manifest + vite dev server
    npm run build      # sound manifest + production build to dist/
    npm run optimize   # re-compress public/models + public/sound (needs the gltf-transform CLI)

There is no test suite and no linter. Verify changes by building and by driving
the real app in a browser — `/?grid=1` renders a model contact sheet and
`/?card=1` regenerates the social share image.

## Conventions

- Vanilla ES modules and three.js. No framework, no bundled UI library.
- All world scale lives in `src/scale.js`. Change it there, not at call sites.
- `src/hud.js` owns one big CSS string and renders markup with template
  literals. Mobile rules key off a `#ui.touch` class that `src/touch.js` decides,
  not off media queries alone.
- `src/icons.js` is **generated** by `scripts/icons.mjs` from the
  `@iconify-json/game-icons` dev dependency. Add an icon by adding it to the
  `WANTED` map in that script and re-running `node scripts/icons.mjs` — never
  hand-edit `src/icons.js`.

## Testing mobile from a desktop browser

`?touch=1` forces the on-screen control deck and tilt-steering UI on; `?touch=0`
forces them off. Real gyroscope input needs an actual handset over HTTPS, because
iOS only grants `DeviceOrientationEvent.requestPermission()` from a user gesture
on a secure origin.

## Licensing

The project is CC0. The icon set in `src/icons.js` is **CC BY 3.0** from
game-icons.net and is attributed in the README credits — keep that attribution if
you touch the icons.
