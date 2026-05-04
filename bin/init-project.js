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

console.log("");

/*********************************************
// Check that UN_PATH is defined.
*********************************************/
let basePath = process.env.UN_PATH;
if (basePath === undefined) {
	console.log("Environment variable UN_PATH not defined.");
	process.exit(1);
}
basePath = `${basePath}/${new Date().getFullYear()}`;
console.log(`Base path is: ${basePath}`);

/*********************************************
// Require packages.
*********************************************/
const fs = require("node:fs");
const ncp = require("ncp");
const exec = require("node:child_process").exec;

/*********************************************
// Check that we have enough arguments.
*********************************************/

const fileFilter = [".DS_Store", ".git", ".gitignore", "README.md"];

if (process.argv.length < 3) {
	console.log("Usage: un-init-project [project_name] {template_name}");
	console.log("Example: un-init-project 2019-climate");
	console.log("Available templates:");
	const templatePath = `${__dirname}/../templates/`;
	const templates = fs
		.readdirSync(templatePath)
		.filter((file) => fileFilter.indexOf(file) === -1);
	for (const fileName of templates) {
		console.log(`- ${fileName}`);
	}
	process.exit(1);
}

/*********************************************
// Check template name. 
*********************************************/
const templateName = process.argv[3] || "react-vite";
const templatePath = `${__dirname}/../templates/`;
const templates = fs
	.readdirSync(templatePath)
	.filter((file) => fileFilter.indexOf(file) === -1);
if (templates.indexOf(templateName) === -1) {
	console.log("Selected template doesn't exist.\n");
	console.log("Available templates:");
	for (const fileName of templates) {
		console.log(`- ${fileName}`);
	}
	process.exit(1);
}

/*********************************************
// Check project name. 
*********************************************/
const projectName = process.argv[2];
const projects = fs.readdirSync(basePath);
console.log(`\nProject name: ${projectName}`);
if (projects.indexOf(projectName) !== -1) {
	console.log("There already is a project with that name.");
	process.exit(1);
}

/*********************************************
// Define functions.
*********************************************/
const createProject = () => {
	console.log(
		`Creating a new ${templateName} project named ${projectName} at ${basePath}`,
	);
	const src = `${templatePath}/${templateName}/`;
	const target = `${basePath}/${projectName}/`;

	fs.mkdirSync(`${basePath}/${projectName}`);
	copyFiles({ src: src, target: target })
		// .then(initVersionControl)
		.then(injectFiles)
		.then(() => console.log("Done!"));
};

const copyFiles = (props) => {
	return new Promise((fulfill, reject) => {
		ncp(props.src, props.target, { dereference: true }, (err) => {
			if (err) {
				reject(err);
			} else {
				console.log("Copied files.");
				fulfill(props);
			}
		});
	});
};

const injectFiles = (props) => {
	return new Promise((_fulfill, _reject) => {
		console.log("Injecting files...");

		// Project files.
		const injectFiles = [
			"package.json",
			"README.md",
			"index.html",
			"src/index.jsx",
			"src/jsx/App.jsx",
			"src/jsx/components/ChartMap.jsx",
			"src/styles/styles.css",
		];

		injectFiles.forEach((filePath) => {
			try {
				let targetFile = fs.readFileSync(props.target + filePath, "utf8");
				targetFile = targetFile.replace(/__PROJECT_NAME__/g, projectName);
				fs.writeFileSync(props.target + filePath, targetFile, "utf8");
				// console.log('Injected file at ' + filePath);
			} catch {}
		});
		process.chdir(`${basePath}/${projectName}`);
		exec("subl .");
	});
};

/*********************************************
// Create project.
*********************************************/
console.log("");
createProject();
