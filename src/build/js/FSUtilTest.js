"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fsu = require("./FSUtil");
var promises_1 = require("./promises");
function testMkdirs() {
    var dirsToMake = [];
    var promz = [];
    var _loop_1 = function (i) {
        var depth = 1 + Math.floor(Math.random() * 4);
        var parts = ['temp', 'mkdir-test'];
        for (var j = 0; j < depth; ++j) {
            // Have leading parts be common
            var comp = void 0;
            if (j == depth - 1) {
                comp = "" + Math.floor(Math.random() * 1000);
            }
            else {
                comp = "" + Math.floor(Math.random() * 10);
            }
            parts.push(comp);
        }
        var path = parts.join("/");
        promz.push(fsu.mkdirR(path).then(function () {
            // Make sure it actually exists!
            return fsu.readDir(path);
        }));
    };
    for (var i = 0; i < 100; ++i) {
        _loop_1(i);
    }
    return Promise.all(promz).then(promises_1.RESOLVED_VOID_PROMISE_CALLBACK);
}
function testReadFileToUint8Array() {
    return fsu.readFileToUint8Array('build.js').then(function (bytes) {
        if (!(bytes instanceof Uint8Array))
            return Promise.reject(new Error("Value returned by readFileToUint8Array not a Uint8Array!"));
        if (bytes.length <= 0)
            return Promise.reject(new Error("Uint8Array returned by readFileToUint8Array has non-positive length: " + bytes.length));
        return promises_1.RESOLVED_VOID_PROMISE;
    });
}
function testReadFileToString() {
    return fsu.readFileToString('build.js').then(function (str) {
        if (typeof str != 'string')
            return Promise.reject(new Error("Value returned by readFileToString not a string!"));
        if (str.length <= 0)
            return Promise.reject(new Error("String returned by readFileToString has non-positive length: " + str.length));
        return promises_1.RESOLVED_VOID_PROMISE;
    });
}
var tests = {
    testMkdirs: testMkdirs,
    testReadFileToUint8Array: testReadFileToUint8Array,
    testReadFileToString: testReadFileToString,
};
var prom = Promise.resolve();
var _loop_2 = function (testName) {
    var testProm = tests[testName]();
    prom = prom.then(function () { return testProm; }).then(function () {
        console.log("FSUtilTest." + testName + ": Okay");
    }, function (err) {
        console.error("FSUtilTest." + testName + ": " + err.stack);
        process.exitCode = 1;
    });
};
for (var testName in tests) {
    _loop_2(testName);
}
