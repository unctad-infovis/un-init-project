#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs, { cpSync } from 'node:fs';
import path from 'node:path';

const YEAR = new Date().getFullYear();
const FILE_FILTER = ['.DS_Store', '.git', '.gitignore', 'README.md'];

// Files that need __PROJECT_NAME__ injected at creation time
// JS/JSX files get __PROJECT_NAME__ from Vite's define at build time
// CSS files are handled separately via recursive injection
const INJECT_FILES = [
  'index.html',
  'package.json',
  'README.md',
];

/*********************************************
// Validate environment
*********************************************/
const UN_PATH = process.env.UN_PATH;
if (!UN_PATH) {
  console.error('Environment variable UN_PATH not defined.');
  process.exit(1);
}

const basePath = `${UN_PATH}/${YEAR}`;
const templatePath = path.resolve(import.meta.dirname, '../templates/');

/*********************************************
// List available templates
*********************************************/
const getTemplates = () =>
  fs.readdirSync(templatePath).filter(f => !FILE_FILTER.includes(f));

const printTemplates = () => {
  console.log('Available templates:');
    getTemplates().forEach((t) => {
    console.log(`  - ${t}`);
  });
};

/*********************************************
// Validate arguments
*********************************************/
if (process.argv.length < 3) {
  console.log('Usage: un-init-project [project_name] {template_name}');
  console.log('Example: un-init-project 2019-climate');
  printTemplates();
  process.exit(1);
}

const projectName = process.argv[2];
const templateName = process.argv[3] || 'react-vite';
const projectPath = `${basePath}/${projectName}`;
const srcPath = `${templatePath}/${templateName}/`;

/*********************************************
// Validate template
*********************************************/
if (!getTemplates().includes(templateName)) {
  console.error(`Template "${templateName}" doesn't exist.\n`);
  printTemplates();
  process.exit(1);
}

/*********************************************
// Validate project name
*********************************************/
console.log(`\nBase path: ${basePath}`);
console.log(`Project name: ${projectName}`);
console.log(`Template: ${templateName}\n`);

if (fs.existsSync(projectPath)) {
  console.error('A project with that name already exists.');
  process.exit(1);
}

/*********************************************
// Define functions
*********************************************/

/**
 * Replace any symlink under `dir` with a real copy of whatever it points
 * to (file or directory), recursively.
 *
 * Needed because `cpSync`'s own `dereference: true` option (used below)
 * turned out not to do this for us — confirmed 2026-09-11 as a genuine
 * Node.js regression, not a bug in this script's own logic: on Node 20,
 * `cpSync(src, dest, { recursive: true, dereference: true })` correctly
 * follows a symlink found anywhere while recursing `src` and copies the
 * real target content; on Node 22/24/26 it only dereferences the
 * top-level `src` path itself — any symlink found *inside* the tree
 * (which is exactly this repo's situation: templates/react-vite/index.html
 * etc. are deliberately symlinked to templates/shared/ for DRY template
 * maintenance) is copied through as a symlink, unchanged. Reproduced
 * directly against Node 20.19.2/22.22.2/24.15.0/26.1.0 via nvm before
 * concluding this, not assumed.
 *
 * This mattered for more than portability: `index.html` is one of the
 * symlinked files *and* one `injectProjectName` writes into below —
 * `fs.writeFileSync` follows a symlink by default, so on Node 22+ every
 * real scaffold was silently overwriting `templates/shared/index.html`
 * in this repo with that run's own project name, corrupting the shared
 * template's `__PROJECT_NAME__` placeholder for every future scaffold
 * until someone noticed. Confirmed this had already happened for real
 * (`templates/shared/index.html` showed a real project's name baked in,
 * restored via `git checkout` on 2026-09-11) — this function exists to
 * make sure a scaffolded project's files are genuinely its own from the
 * start, not just to satisfy a preference for portability.
 */
const dereferenceSymlinks = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(fullPath);
      const stat = fs.statSync(real);
      fs.rmSync(fullPath, { recursive: true, force: true });
      if (stat.isDirectory()) {
        cpSync(real, fullPath, { recursive: true, dereference: true });
        dereferenceSymlinks(fullPath); // the target itself may contain further symlinks
      } else {
        fs.copyFileSync(real, fullPath);
      }
    } else if (entry.isDirectory()) {
      dereferenceSymlinks(fullPath);
    }
  }
};

const injectProjectName = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(filePath, content.replaceAll('__PROJECT_NAME__', projectName), 'utf8');
  } catch {
    // file doesn't exist in this template, skip
  }
};

const injectAllCssFiles = (dir) => {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = `${dir}/${file}`;
    if (fs.statSync(fullPath).isDirectory()) {
      injectAllCssFiles(fullPath);
    } else if (file.endsWith('.css')) {
      injectProjectName(fullPath);
      console.log(`  Injected: ${fullPath.replace(projectPath, '')}`);
    }
  });
};

/*********************************************
// Create project
*********************************************/
console.log(`Creating project at ${projectPath}...`);

// Copy template
fs.mkdirSync(projectPath, { recursive: true });
cpSync(srcPath, projectPath, { recursive: true, dereference: true });
console.log('Copied template files.');

// Belt-and-braces: cpSync's own `dereference: true` above doesn't reliably
// dereference symlinks nested inside the copied tree on Node 22+ (see
// dereferenceSymlinks' own comment) — replace any that made it through
// with real copies, so the new project never depends on this repo's own
// filesystem location.
dereferenceSymlinks(projectPath);
console.log('Resolved any template symlinks into real files.');

// Inject project name into config/meta files
console.log('Injecting project name into config files...');
INJECT_FILES.forEach(filePath => {
  injectProjectName(`${projectPath}/${filePath}`);
});

// Inject project name into all CSS files recursively
console.log('Injecting project name into CSS files...');
injectAllCssFiles(`${projectPath}/src`);

// Open in Sublime
process.chdir(projectPath);
execSync('subl .');

console.log('\nDone!');