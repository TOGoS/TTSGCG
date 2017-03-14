"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERBOSITY_SILENT = 0;
exports.VERBOSITY_ERRORS = 1;
exports.VERBOSITY_WARNINGS = 2;
exports.VERBOSITY_INFO = 3;
exports.VERBOSITY_DEBUG = 4;
var LevelFilteringLogger = (function () {
    function LevelFilteringLogger(backingLogger, verbosity) {
        this.backingLogger = backingLogger;
        this.verbosity = verbosity;
    }
    LevelFilteringLogger.prototype.error = function (message) {
        var etc = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            etc[_i - 1] = arguments[_i];
        }
        if (this.verbosity < exports.VERBOSITY_ERRORS)
            return;
        (_a = this.backingLogger).error.apply(_a, [message].concat(etc));
        var _a;
    };
    LevelFilteringLogger.prototype.log = function (message) {
        var etc = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            etc[_i - 1] = arguments[_i];
        }
        if (this.verbosity < exports.VERBOSITY_INFO)
            return;
        (_a = this.backingLogger).log.apply(_a, [message].concat(etc));
        var _a;
    };
    return LevelFilteringLogger;
}());
exports.LevelFilteringLogger = LevelFilteringLogger;
exports.NULL_LOGGER = {
    error: function (message) {
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
    },
    log: function (message) {
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
    },
};
