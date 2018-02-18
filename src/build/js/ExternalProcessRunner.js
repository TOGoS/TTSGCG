"use strict";
// This file is maintained as part of NodeBuildUtil: https://github.com/TOGoS/NodeBuildUtil
// If you're making fixes and want to make sure they get merged upstream,
// PR to that project.
// Otherwise, feel free to remove this comment.
Object.defineProperty(exports, "__esModule", { value: true });
var Logger_1 = require("./Logger");
var child_process = require("child_process");
var fs = require("fs");
var ExternalProcessRunner = /** @class */ (function () {
    function ExternalProcessRunner() {
        this.logger = Logger_1.NULL_LOGGER;
        this.shellCommandPromise = undefined;
        this.npmCommandPromise = undefined;
    }
    ExternalProcessRunner.prototype.findWorkingProgram = function (alternatives, testPostfix, start, name) {
        var _this = this;
        if (start === void 0) { start = 0; }
        if (name === void 0) { name = "a program"; }
        if (start >= alternatives.length)
            return Promise.reject(new Error("Couldn't figure out how to run " + name + "!"));
        var testCommand = alternatives[start].concat(testPostfix);
        return this.doCmd(testCommand, { silent: true }).then(function () {
            return alternatives[start];
        }, function (err) {
            _this.logger.log(_this.argsToShellCommand(testCommand) + " didn't work; will try something else...");
            return _this.findWorkingProgram(alternatives, testPostfix, start + 1, name);
        });
    };
    ExternalProcessRunner.prototype.argsToShellCommand = function (args) {
        if (typeof args === 'string')
            return args;
        var escaped = [];
        for (var i in args) {
            var arg = args[i];
            if (arg.match(/^[a-zA-Z0-9\/\.\+_\-]+$/))
                escaped.push(arg);
            else
                escaped.push('"' + arg.replace(/["\$\\]/g, '\\$&') + '"');
        }
        return escaped.join(' ');
    };
    ExternalProcessRunner.prototype.processCmd = function (cmd) {
        if (typeof cmd === 'string') {
            return this.figureShellCommand().then(function (shell) { return shell.concat([cmd]); });
        }
        return Promise.resolve(cmd);
    };
    ExternalProcessRunner.prototype.doCmd = function (args, opts) {
        var _this = this;
        if (opts === void 0) { opts = {}; }
        if (!opts)
            opts = {};
        var silent = opts.silent == undefined ? true : opts.silent;
        var stdio = opts.stdio || opts.silent ? undefined : 'inherit';
        var onNz = opts.onNz || 'error';
        return this.processCmd(args).then(function (args) {
            var argStr = _this.argsToShellCommand(args);
            _this.logger.log("+ " + argStr);
            return new Promise(function (resolve, reject) {
                var cproc;
                if (typeof args === 'string') {
                    cproc = child_process.spawn(args, [], {
                        shell: true,
                        cwd: opts.cwd,
                        stdio: stdio
                    });
                }
                else {
                    cproc = child_process.spawn(args[0], args.slice(1), {
                        cwd: opts.cwd,
                        stdio: stdio
                    });
                }
                cproc.on('error', reject);
                cproc.on('close', function (exitCode) {
                    if (exitCode == 0 || onNz == 'return')
                        resolve(exitCode);
                    else
                        reject(new Error("Process exited with code " + exitCode + ": " + argStr));
                });
            });
        });
    };
    ExternalProcessRunner.prototype.figureShellCommand = function () {
        if (this.shellCommandPromise)
            return this.shellCommandPromise;
        var alternatives = [
            ['cmd.exe', '/c'],
            ['sh', '-c'],
        ];
        return this.shellCommandPromise = this.findWorkingProgram(alternatives, ['exit 0'], 0, 'shell');
    };
    ExternalProcessRunner.prototype.figureNpmCommand = function () {
        var _this = this;
        if (this.npmCommandPromise)
            return this.npmCommandPromise;
        // Most non-Windows systems will look at the path for us,
        // so 'npm' should be sufficient.
        if (process.platform != 'win32')
            return this.npmCommandPromise = Promise.resolve(['npm']);
        // Not so on windows!
        // We'll look for npm-cli.js by iterating over everything in %Path%
        var alternatives = [
            ['npm'],
        ];
        var envPath = process.env.Path;
        var envPaths = (envPath != '' && envPath != undefined) ? envPath.split(';') : [];
        var leftToCheck = envPaths.length;
        var findNpmCliJsPromise = Promise.resolve();
        leftToCheck == 0 ? Promise.resolve() : new Promise(function (resolve, reject) {
            var _loop_1 = function (p) {
                var npmCliJsPath = envPaths[p] + '/node_modules/npm/bin/npm-cli.js';
                fs.stat(npmCliJsPath, function (err, stats) {
                    if (!err)
                        alternatives.push(['node', npmCliJsPath]);
                    if (--leftToCheck == 0)
                        resolve();
                });
            };
            for (var p in envPaths) {
                _loop_1(p);
            }
        });
        return this.npmCommandPromise = findNpmCliJsPromise.then(function () { return _this.findWorkingProgram(alternatives, ['-v'], 0, 'npm'); });
    };
    ExternalProcessRunner.prototype.figureNodeCommand = function () {
        return Promise.resolve(['node']);
    };
    ExternalProcessRunner.prototype.node = function (args, opts) {
        var _this = this;
        if (opts === void 0) { opts = {}; }
        return this.figureNodeCommand().then(function (nodeCmd) { return _this.doCmd(nodeCmd.concat(args), opts); });
    };
    ExternalProcessRunner.prototype.npm = function (args, opts) {
        var _this = this;
        if (opts === void 0) { opts = {}; }
        return this.figureNpmCommand().then(function (npmCmd) { return _this.doCmd(npmCmd.concat(args), opts); });
    };
    ExternalProcessRunner.prototype.tsc = function (args, opts) {
        if (opts === void 0) { opts = {}; }
        return this.doCmd(["node", "node_modules/typescript/bin/tsc"].concat(args), opts);
    };
    return ExternalProcessRunner;
}());
exports.default = ExternalProcessRunner;
