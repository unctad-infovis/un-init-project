# UN Data visualisation initialization script

Use this to initialize an empty project.

`UN_PATH` needs to be set. This is the based path were the project folder is created.

`export UN_PATH=''`

Or you can set it in your default config.

## Install

`npm install && npm install -g`

## How to use

`un-init-project {project_name} [template_name]`

Default template is `react-vite`

Example: `un-init-project 2026-climate`

## Available templates

### react-vite

Basic React + Vite template that comes with a basic folder structure and that allows you to build everything from zero.

### react-vite-highcharts-map

Basic React + Vite template that comes with a basic folder structure to build a map visualisation based on the UN country map and that allows you to build everything from zero.

### react-webpack (depricated, do not use)

Basic React + Webpack template that comes with a basic folder structure and that allows you to build everything from zero.

### react-webpack-un-map (depricated, do not use)

Basic React + Webpack template that comes with a basic folder structure to build a map visualisation based on the UN country map and that allows you to build everything from zero.

### react-webpack-highcharts (depricated, do not use)

Basic React + Webpack template that comes with a basic folder structure to build a highcharts graph and that allows you to build everything from zero.
