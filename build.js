/**
 * Starlight Engine Build Script
 * Bundles ES modules into a single deployable HTML file.
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  console.log('🌟 Building Starlight Engine...');

  // Bundle JS modules
  const jsResult = await esbuild.build({
    entryPoints: ['./src/main.js'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'StarlightEngine',
    minify: false, // Keep readable for debugging
    sourcemap: false,
    target: 'es2020',
  });

  const jsCode = jsResult.outputFiles[0].text;

  // Read CSS
  const cssPath = path.join(__dirname, 'src', 'style.css');
  const cssCode = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

  // Read HTML template
  const templatePath = path.join(__dirname, 'src', 'index.template.html');
  let html = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf8')
    : defaultTemplate();

  // Inject CSS and JS
  html = html.replace('<!-- CSS_PLACEHOLDER -->', `<style>\n${cssCode}\n</style>`);
  html = html.replace('<!-- JS_PLACEHOLDER -->', `<script>\n${jsCode}\n</script>`);

  // Write output
  const outPath = path.join(__dirname, 'docs', 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');

  // Also copy to root for consistency
  fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');

  const sizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`✅ Built docs/index.html (${sizeKB} KB)`);
}

function defaultTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Starlight Inn - Virtual World</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
  <!-- CSS_PLACEHOLDER -->
</head>
<body>
  <div id="loadingScreen">
    <h1>✦ STARLIGHT INN</h1>
    <div class="loader"></div>
    <p>Loading your virtual world...</p>
  </div>
  <canvas id="gameCanvas"></canvas>
  <div class="ui-overlay" id="uiOverlay"></div>
  <!-- JS_PLACEHOLDER -->
</body>
</html>`;
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
