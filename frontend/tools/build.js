import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const AUDIO_SRC = path.join(ROOT_DIR, 'public/audio');
const AUDIO_DEST = path.join(DIST_DIR, 'audio');

console.log('--- Starting Clinic Frontend Production Build ---');

// 1. Run Strict TypeScript Verification
console.log('1. Running TypeScript type-checking...');
try {
  execSync('node node_modules/typescript/bin/tsc --noEmit', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
  console.log('   ✓ TypeScript type check passed with 0 errors.');
} catch (err) {
  console.error('   ✗ TypeScript type checking failed!');
  process.exit(1);
}

// 2. Prepare Clean dist/ Directory
console.log('2. Preparing dist directory...');
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });

// 3. Compile Production CSS via PostCSS & Tailwind
console.log('3. Compiling production CSS with PostCSS & Tailwind...');
const rawCss = fs.readFileSync(path.join(ROOT_DIR, 'src/index.css'), 'utf8');
const processedCss = await postcss([tailwind]).process(rawCss, {
  from: path.join(ROOT_DIR, 'src/index.css'),
  to: path.join(ASSETS_DIR, 'index.css'),
});
fs.writeFileSync(path.join(ASSETS_DIR, 'index.css'), processedCss.css);
console.log(`   ✓ CSS compiled successfully (${processedCss.css.length} bytes).`);

// 4. Compile TypeScript Modules to JS
console.log('4. Compiling TypeScript modules...');
execSync(
  'node node_modules/typescript/bin/tsc --jsx react-jsx --target ES2020 --module ESNext --moduleResolution bundler --outDir dist/modules src/main.tsx',
  {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  }
);
console.log('   ✓ Compiled TS to ESNext modules in dist/modules.');

// 5. Generate Production Bundle Entrypoint
console.log('5. Generating production script bundle in dist/assets/index.js...');
// Main bundle entry that imports and mounts the app
const entryScript = `
/**
 * Clinic System SPA Production Bundle
 */
import './modules/main.js';
`;
fs.writeFileSync(path.join(ASSETS_DIR, 'index.js'), entryScript);

// 6. Copy Offline Audio Assets to dist/audio/
console.log('6. Copying 100% offline audio assets...');
if (fs.existsSync(AUDIO_SRC)) {
  fs.mkdirSync(AUDIO_DEST, { recursive: true });
  const audioFiles = fs.readdirSync(AUDIO_SRC);
  for (const file of audioFiles) {
    fs.copyFileSync(path.join(AUDIO_SRC, file), path.join(AUDIO_DEST, file));
  }
  console.log(`   ✓ Copied ${audioFiles.length} offline audio clips to dist/audio.`);
} else {
  console.warn('   ⚠️ No public/audio directory found! Run npm run generate-audio first.');
}

// 7. Write Production index.html
console.log('7. Creating production dist/index.html...');
const htmlContent = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>نظام إدارة العيادة الطبية</title>
    <link rel="stylesheet" href="/assets/index.css" />
  </head>
  <body class="bg-slate-50 font-sans text-slate-900 antialiased selection:bg-cyan-500 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/modules/main.js"></script>
  </body>
</html>`;
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), htmlContent);
console.log('   ✓ dist/index.html created.');

console.log('====================================================');
console.log('✓ Clinic Frontend Production Build Succeeded 100%!');
console.log('====================================================');
