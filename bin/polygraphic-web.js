#!/usr/bin/env node

// node bin/polygraphic-web.js pwa app/index.ts -o pwa

const yargs = require("yargs");
const fs = require("fs");
const path = require("path");
const { html } = require("../dist/index.js");
const { spawn } = require("child_process");

const mkdir = (path) => {
	return new Promise(resolve => {
		fs.mkdir(path, {
			recursive: true
		}, () => resolve());
	});
};

const rmdir = (path) => {
	return new Promise(resolve => {
		fs.rm(path, {
			recursive : true,
			force : true
		}, () => resolve());
	});
};

const writeFile = (file, data) => {
	return new Promise((resolve) => {
		fs.writeFile(file, data, "utf-8", () => resolve());
	});
};

yargs.scriptName("polygraphic-web")
	.usage("$0 <cmd> [args]").command("pwa [path]", "build a polygraphic web app", yargs => {
		yargs.positional("path", {
			type: "string",
			describe: "path to the root file"
		});
		yargs.alias("o", "outDir");
	}, async (argv) => {
		try {
			const entries = path.join(process.cwd(), argv.path);
			const outputDir = path.join(process.cwd(), argv.o);
			const args = [
				"build",
				entries,
				"--target", "node",
				"--out-dir", outputDir,
				"--out-file", "index.js",
				"--public-url", outputDir
			];
			const result = spawn("parcel", args);
			console.log("parcel", ...args);
			result.stdout.pipe(process.stdout);
			result.stderr.pipe(process.stderr);
			result.on("exit", async (code) => {
				if(code === 0) {
					const dep = path.join(outputDir, "index.js");
					const {
						default : {
							App, 
							state
						}
					} = require(dep);
					const output = await html(App, "index")(state);
					await Object.keys(output).reduce(async (promise, key) => {
						await promise;
						await writeFile(path.join(outputDir, key), output[key]);
					}, Promise.resolve());
				}
			});
		} catch(e) {
			console.log("ERROR", e, JSON.stringify(e, null, "\t"));
		}
	})
	.help()
	.argv;
