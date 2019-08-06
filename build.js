"use strict";

const fs = require('fs');
const _builder = require('./src/build/js/Builder');
const builder = new _builder.default();
const _fsutil = require('./src/build/js/FSUtil');
const readDir = _fsutil.readDir;
const rmRf = _fsutil.rmRf;

/**
 * Removes '//# sourceMapping' lines
 * and makes sure there's a trailing "\n"
 */
function filterJs( js ) {
	let lines = js.split("\n");
	let result = "";
	for( let i=0; i<lines.length; ++i ) {
		if( /^\s*\/\/# sourceMapping/.exec(lines[i]) ) {
			// skip it!
			continue;
		}
		result += lines[i]+"\n";
	}
	return result;
}
function _concatJsFile( file, outputStream ) {
	return new Promise( (resolve,reject) => {
		fs.readFile( file, {encoding:"utf-8"}, (err,data) => {
			if( err ) { reject(err); return; }
			
			let fixed = filterJs(data);
			outputStream.write(fixed);
			resolve();
		});
	});
}
function _concatJsFiles( files, outputStream, start ) {
	if( start >= files.length ) return Promise.resolve();
	if( start == undefined ) start = 0;
	
	return _concatJsFile(files[start], outputStream).then( () => _concatJsFiles(files, outputStream, start+1))
}
/**
 * Concatenate a bunch of JS files, removing //# sourceMapping lines and ensuring files are "\n"-terminated.
 * Returns Promise that resolves to void when done.
 */
function concatJsFiles( files, outputFile ) {
	return new Promise( (resolve,reject) => {
		let stream = fs.createWriteStream(outputFile);
		
		stream.on('error', reject);
		stream.on('close', () => resolve() );
		
		return _concatJsFiles(files, stream).then( () => {
			stream.close();
		});
	});
}

const amdComponentFiles = [
	"target/amd.es5.js"
];

builder.targets = {
	"default": {
		prereqs: ["js-libs"]
	},
	"sortaclean": {
		invoke: (ctx) => rmRf('node_modules')
	},
	"clean": {
		invoke: (ctx) => rmRf(['node_modules','target'])
	},
	"node_modules": {
		prereqs: ["package.json"],
		invoke: (ctx) => ctx.builder.npm(["install"]),
		isDirectory: true,
	},
	"src": {
		isDirectory: true,
	},
	"target/cjs": {
		prereqs: ["src", "node_modules"],
		invoke: (ctx) => ctx.builder.tsc(["-p","src/main/ts/cjs.es5.tsconfig.json","--outDir",ctx.targetName]),
		isDirectory: true,
	},
	"target/amd.es5.js": {
		prereqs: ["src", "node_modules"],
		invoke: (ctx) => ctx.builder.tsc(["-p","src/main/ts/amd.es5.tsconfig.json","--outFile",ctx.targetName]),
		isDirectory: false,
	},
	"target/all.amd.es5.js": {
		prereqs: amdComponentFiles,
		// Stupid TypeScript emits amd files without a newline at the end,
		// so we can't just use cat; sed -e '$s/$/\\n/' adds one.
		invoke: (ctx) => concatJsFiles(ctx.prereqNames, ctx.targetName),
	},
	"run": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => ctx.builder.doCmd("node target/cjs/GCodeGenerator.js")
	},
	"run-unit-tests": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => ctx.builder.runUnitTests("target/cjs")
	},
	"js-libs": {
		isFile: false,
		prereqs: ["target/cjs", "target/all.amd.es5.js"]
	},
	"restart": {
		prereqs: ["target/cjs"],
		invoke: (ctx) => ctx.builder.doCmd("TZ=America/Chicago ./restart")
	}
}

// If build.js has changed, assume everything else is out of date!
builder.globalPrereqs = ['build.js', 'src/build/js/Builder.js'];

builder.processCommandLineAndSetExitCode(process.argv.slice(2));
