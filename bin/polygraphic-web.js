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
			await writeFile(path.join(argv.o, bundle.name), await outputFS.readFile(bundle.filePath, "utf8"));
		}
		await workerFarm.end();
		const dep = path.join(process.cwd(), argv.o, "index.js");
		const {
			default : {
				App, 
				state
			}
		} = require(dep);
		const output = html(App)(state);
		writeFile(path.join(argv.o, "index.html"), output);
	})
	.help()
	.argv;
