#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { cpSync } from 'node:fs';

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
  getTemplates().forEach(t => console.log(`  - ${t}`));
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