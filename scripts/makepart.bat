@echo off

node build.js && node target/cjs/GCodeGenerator.js %*
