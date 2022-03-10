#!/usr/bin/env node

// node bin/polygraphic-web.js pwa app/index.ts -o pwa

const yargs = require("yargs");
const {Parcel, createWorkerFarm} = require("@parcel/core");
const {MemoryFS} = require("@parcel/fs");
const fs = require("fs");
const path = require("path");
const { html } = require("../dist/index.js");

const workerFarm = createWorkerFarm();
const outputFS = new MemoryFS(workerFarm);

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
			await mkdir(argv.o);
			const bundler = new Parcel({
				entries: argv.path,
				defaultConfig: "@parcel/config-default",
				mode: "production",
				workerFarm,
				outputFS
			});
			const {bundleGraph} = await bundler.run();
			for (let bundle of bundleGraph.getBundles()) {        
				await writeFile(path.join(argv.o, path.basename(bundle.filePath)), await outputFS.readFile(bundle.filePath, "utf8"));
			}
			await workerFarm.end();
			const dep = path.join(process.cwd(), argv.o, "index.js");
			const {
				default : {
					App, 
					state
				}
			} = require(dep);
			const output = await html(App, "index")(state);
			await rmdir(argv.o);
			await mkdir(argv.o);
			await Object.keys(output).reduce(async (promise, key) => {
				await promise;
				await writeFile(path.join(argv.o, key), output[key]);
			}, Promise.resolve());
		} catch(e) {
			console.log("ERROR", e, JSON.stringify(e, null, "\t"));
		}
	})
	.help()
	.argv;
