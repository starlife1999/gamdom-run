import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'portrait-production-homepage',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const portrait = bundle['portrait-prototype.html'];
      if (portrait?.type !== 'asset' || typeof portrait.source !== 'string') {
        this.error('The compiled portrait entry is required for the production homepage.');
      }
      portrait.source = portrait.source.replace('</head>',
        '  <link rel="icon" type="image/png" href="/assets/environment/gamdom-city-new/gamdom-run-logo-game.png" />\n  </head>');
      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: portrait.source.replace('<title>GAMDOM RUN - Portrait Prototype</title>', '<title>GAMDOM RUN</title>'),
      });
    },
  }],
  build: {
    sourcemap: false,
    rollupOptions: {
      input: { portraitPrototype: 'portrait-prototype.html' },
    },
  },
});
