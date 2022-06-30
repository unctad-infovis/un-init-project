#!/usr/bin/env node

// Required global packages
// - 
//
// Required environment variables
// UN_PATH
//
//
// Usage: un-init-project [project_name] {template_name}
// Example: un-init-project 2019-climate

'use strict';

console.log('');

/*********************************************
// Check that UN_PATH is defined.
*********************************************/
const basePath = process.env.UN_PATH;
if (basePath === undefined) {
  console.log('Environment variable UN_PATH not defined.');
  process.exit(1);
}
console.log('Base path is: ' + basePath);

/*********************************************
// Require packages.
*********************************************/
const fs = require('fs');
const ncp = require('ncp');
const exec = require('child_process').exec;
const Promise = require('promise');


/*********************************************
// Check that we have enough arguments.
*********************************************/

if (process.argv.length < 3) {
  console.log('Usage: un-init-project [project_name] {template_name}');
  console.log('Example: un-init-project 2019-climate');
  process.exit(1);
}

const fileFilter = [
  '.DS_Store',
  '.git',
  '.gitignore',
  'README.md'
];

/*********************************************
// Check template name. 
*********************************************/
const templateName = process.argv[3] || 'react-webpack';
const templatePath = __dirname + '/../templates/';
const templates = fs.readdirSync(templatePath).filter(file => fileFilter.indexOf(file) === -1);
if (templates.indexOf(templateName) === -1) {
  console.log('Selected template doesn\'t exist.\n');
  console.log('Available templates:');
  templates.forEach(fileName => console.log('- ' + fileName));
  process.exit(1);
} 

/*********************************************
// Check project name. 
*********************************************/
const projectName = process.argv[2];
const projects = fs.readdirSync(basePath);
console.log('\nProject name: ' + projectName);
if (projects.indexOf(projectName) !== -1) {
  console.log('There already is a project with that name.');
  process.exit(1);
}

/*********************************************
// Define functions.
*********************************************/
const createProject = function () {
  console.log('Creating a new "' + templateName + '" project named "' + projectName + '" at ' + basePath);
  let src = templatePath + '/' + templateName + '/';
  let target = basePath + '/' + projectName + '/';

  fs.mkdirSync(basePath + '/' + projectName);
  copyFiles({ src: src, target: target })
    // .then(initVersionControl)
    .then(injectFiles)
    .then(() => console.log('Done!'));
};

const copyFiles = props => {
  return new Promise((fulfill, reject) => {
    ncp(props.src, props.target, { dereference: true }, err => {
      if (err) {
        reject(err);
      } else {
        console.log('Copied files.');
        fulfill(props);
      }
    });
  });
};

const injectFiles = props => {
  return new Promise((fulfill, reject) => {
    console.log('Injecting files...');

    // Project files.
    const injectFiles = [
      'package.json',
      'README.md',
      'src/html/index.html',
      'src/jsx/App.jsx',
      'src/styles/styles.less'
    ];

    injectFiles.forEach(filePath => {
      try {
        let targetFile = fs.readFileSync(props.target + filePath, 'utf8');
        targetFile = targetFile.replace(/__PROJECT_NAME__/g, projectName);
        fs.writeFileSync(props.target + filePath, targetFile, 'utf8');
        // console.log('Injected file at ' + filePath);
      } catch (err) {
        console.log('No file at ' + filePath);
      }
    });
    process.chdir(basePath + '/' + projectName);
    exec('subl .');
  });

};

/*********************************************
// Create project.
*********************************************/
console.log('');
createProject();
