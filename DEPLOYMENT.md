# Static Deployment Preparation

Status: prepared for local verification only. Nothing has been published.

## Build Settings

- Target: Cloudflare Pages static hosting; no Functions or Workers runtime.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Run the build from the project root containing `package.json` and `vite.config.ts`.
- Install dependencies from the existing lockfile with `npm ci` in a clean build environment.
- No runtime environment variables, database, account service or backend are required.

Cloudflare documents [static HTML hosting](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) and [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/). A top-level `index.html` serves the homepage. The [single-asset limit](https://developers.cloudflare.com/pages/platform/limits/) is 25 MiB; this project's measured assets are below that limit.

## Entry Strategy

Development remains unchanged: `npm run dev` serves the desktop game at `/` and the mobile game at `/portrait-prototype.html`.

The production build compiles only `portrait-prototype.html`. A build-only Vite plugin adds an icon link to the existing logo (preventing the browser's default missing-favicon request), then emits `dist/index.html` from that compiled HTML, changing only the browser title to `GAMDOM RUN`. Both production entries use the same hashed script and stylesheet and the same approved game implementation. There is no redirect, copied game code or second Phaser instance.

The checked-in desktop `index.html` and `src/main.ts` remain untouched. The desktop entry is deliberately not a production homepage or a separate public build entry.

## Assets and Production Safety

Vite copies the existing `public` tree to `dist` unchanged. Assets use origin-root `/assets/...` and `/art/...` URLs and require no path rewrites. Character atlas image/JSON pairs remain intact. Music and effects are synthesized by the existing audio implementation, not fetched from an external audio service. Audio still unlocks through player interaction.

Source maps are explicitly disabled. Portrait diagnostic imports are gated by `import.meta.env.DEV` and removed from production, even if diagnostic query parameters are supplied. No development server, Windows path, localhost service, account system or third-party runtime request is needed by the deployed game. Browser-persisted mute settings remain local to each origin.

Only upload/publish the build output directory when deployment is separately authorized. Project sources, screenshots, test artifacts and local verification TLS keys are outside `dist`.

Cloudflare Pages may canonicalize `/portrait-prototype.html` to its extensionless URL, as described in [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/). This does not change the game implementation; the development URL remains unchanged.

## Local Verification

`npx tsc --noEmit` checks types. `npm run build` produces the actual static output. `npm run preview -- --host 127.0.0.1 --port 4182 --strictPort` can serve that output locally after verification servers have stopped; this is not the development server and does not publish anything.

The task's strict static HTTP/HTTPS server and automated checks are under `artifacts/deployment-preparation`. Verification JSON and screenshots are local artifacts, not part of the public build. The HTTPS check uses a self-signed local certificate accepted by the test browser; it is not a public-domain TLS test.

Legacy desktop regression scripts expect the desktop Menu at `/`. Keep those on the unchanged desktop development entry. Mobile regressions can run against the production root by adapting their old prototype URL in the test harness only. The audio suite also imports `/src/audio/arcadeSynth.ts` for isolated PCM assertions; the production audio adapter supplies that module through a test-browser route fixture, not the static server or public output. Its live audio graph and UI still run from the production bundle. Do not change accepted gameplay or weaken assertions to accommodate the new public entry.

Physical iPhone Safari and Android Chrome approval remains separate from headless desktop-browser testing. Verify touch behavior, safe areas, orientation, background/resume, audio recovery and sustained performance before release. The existing large asset/decoded-texture footprint remains unchanged by deployment preparation.
