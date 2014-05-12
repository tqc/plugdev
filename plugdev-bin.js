#!/usr/bin/env node

"use strict";
var fs = require('fs');
var path = require('path');
var xmldoc = require('xmldoc');
var ncp = require("ncp").ncp;
var crypto = require('crypto');


var pkg = require(path.join(__dirname, 'package.json'));

var homedir = (process.platform === 'win32') ? process.env.HOMEPATH : process.env.HOME;
var plugdevConfigPath = path.resolve(homedir, "plugdevconfig.json");


var plugdevConfig = {};
if (fs.existsSync(plugdevConfigPath)) plugdevConfig = JSON.parse(fs.readFileSync(plugdevConfigPath, "utf8"));

plugdevConfig.linkedPlugins = plugdevConfig.linkedPlugins || {};


function loadPluginConfig(pluginFile) {
    var result = {};
    var pluginXml = new xmldoc.XmlDocument(fs.readFileSync(pluginFile));
    result.name = pluginXml.childNamed("name").val;
    result.id = pluginXml.attr.id;
    result.jsFiles = [];
    result.platforms = {};

    pluginXml.eachChild(function(node) {
        if (node.name == "js-module") {
            result.jsFiles.push(node.attr.src);
        } else if (node.name == "platform") {
            var t = result.platforms[node.attr.name] = {
                files: []
            };

            node.eachChild(function(node) {
                if (node.name == "source-file") {
                    t.files.push({
                        src: node.attr.src,
                        targetDir: node.attr.targetDir,
                    });
                } else if (node.name == "header-file") {
                    t.files.push({
                        src: node.attr.src,
                        targetDir: node.attr.targetDir,
                    });
                }
            });

        }



    });


    return result;
}

function loadCordovaConfig(configFilePath) {
    var result = {};
    var pluginXml = new xmldoc.XmlDocument(fs.readFileSync(configFilePath));
    result.name = pluginXml.childNamed("name").val;
    result.id = pluginXml.attr.id;

    return result;
}


process.bin = process.title = 'plugdev';
process.stdout.write("plugdev " + pkg.version + '\n');

if (process.argv[2] == "link") {

    var pluginRoot = process.cwd();

    if (!fs.existsSync(path.resolve(pluginRoot, "plugin.xml"))) {
        console.log("Plugin not found");
        return;
    }

    var pluginConfig = loadPluginConfig(path.resolve(pluginRoot, "plugin.xml"));

    console.log("Linking plugin " + pluginConfig.name + " (" + pluginConfig.id + ")");
    plugdevConfig.linkedPlugins[pluginConfig.id] = {
        id: pluginConfig.id,
        name: pluginConfig.name,
        path: process.cwd()
    };

    fs.writeFileSync(plugdevConfigPath, JSON.stringify(plugdevConfig, null, 4));

} else if (process.argv[2] == "sync") {
    // check that we are in a cordova app folder
    var cordovaRoot = process.cwd();
    if (!fs.existsSync(path.resolve(cordovaRoot, "plugins"))) {
        console.log("Cordova app not found");
        return;
    }

    var cordovaConfig = loadCordovaConfig(path.resolve(cordovaRoot, "config.xml"));

    var plugDevLogPath = cordovaRoot + "/plugdev-log.json";

    var genlog = {};
    if (fs.existsSync(plugDevLogPath)) genlog = JSON.parse(fs.readFileSync(plugDevLogPath, "utf8"));

    var pluginsToSync = [];

    var files = fs.readdirSync(path.resolve(cordovaRoot, "plugins"));

    for (var i = 0; i < files.length; i++) {
        var pc = plugdevConfig.linkedPlugins[files[i]];
        if (pc) {
            console.log("Found plugin to sync - " + pc.name + " (" + pc.id + ")");
            pluginsToSync.push(pc);
        }
    }

    if (pluginsToSync.length === 0) {
        console.log("No linked plugins found.");
        return;
    }
    var errorCount = 0;

    var loopfn = function(i, finished) {
        if (i >= pluginsToSync.length) return finished();
        var pc = pluginsToSync[i];
        var pluginHistory = genlog[pc.id] = genlog[pc.id] || {};
        var fpc = loadPluginConfig(path.resolve(pc.path, "plugin.xml"));

        function syncFile(sourcePath, target1Path, target2Path, fileHistory) {
            var sourceHash = fs.existsSync(sourcePath) ? crypto.createHash('sha1').update(fs.readFileSync(sourcePath, "utf8")).digest('hex') : undefined;
            var target1Hash = fs.existsSync(target1Path) ? crypto.createHash('sha1').update(fs.readFileSync(target1Path, "utf8")).digest('hex') : undefined;
            var target2Hash = fs.existsSync(target2Path) ? crypto.createHash('sha1').update(fs.readFileSync(target2Path, "utf8")).digest('hex') : undefined;

            if (!sourceHash) {
                console.warn("Missing source file " + sourcePath);
                return;
            }

            var changeCount = 0;
            if (sourceHash != fileHistory.source) changeCount++;
            if (target1Hash != fileHistory.target1) changeCount++;
            if (target2Path && target2Hash != fileHistory.target2) changeCount++;

            if (sourceHash == target1Hash && (!target2Path || sourceHash == target2Hash)) {
                // all files are the same, so no need to change anything even if there were differences in the history
            } else if (changeCount > 1) {
                // multiple changes - skip update
                console.error("Conflicting change (" + changeCount + " files changed) in " + sourcePath + " - not updated");
                errorCount++;

            } else if (target1Hash && target1Hash != fileHistory.target1) {
                // todo:  target changed - copy back to source
                console.log("Target 1 changed - " + target1Path);
                fs.writeFileSync(sourcePath, fs.readFileSync(target1Path));
                if (target2Path) fs.writeFileSync(target2Path, fs.readFileSync(target1Path));
                target2Hash = sourceHash = target1Hash;

            } else if (target2Hash && target2Hash != fileHistory.target2) {
                // todo:  target changed - copy back to source
                console.log("Target 2 changed - " + target2Path);
                fs.writeFileSync(sourcePath, fs.readFileSync(target2Path));
                fs.writeFileSync(target1Path, fs.readFileSync(target2Path));
                target1Hash = sourceHash = target2Hash;
            } else if (sourceHash != fileHistory.source) {
                // todo: source changed - copy to target
                console.log("Source changed - " + sourcePath);
                fs.writeFileSync(target1Path, fs.readFileSync(sourcePath));
                if (target2Path) fs.writeFileSync(target2Path, fs.readFileSync(sourcePath));
                target1Hash = target2Hash = sourceHash;
            }

            if (sourceHash == target1Hash && (!target2Path || sourceHash == target2Hash)) {
                // only record state when files are correctly synced
                fileHistory.source = sourceHash;
                fileHistory.target1 = target1Hash;
                if (target2Path) fileHistory.target2 = target2Hash;
            }
        }

        for (var j = 0; j < fpc.jsFiles.length; j++) {
            var jsf = fpc.jsFiles[j];

            syncFile(
                pc.path + "/" + jsf,
                path.resolve(cordovaRoot, "plugins", pc.id, jsf),
                null,
                pluginHistory[jsf] = pluginHistory[jsf] || {}
            );

        }

        // check if any of the native plugin files in the app project have changed and copy back if necessary


        for (var k = 0; k < fpc.platforms.ios.files.length; k++) {
            var pf = fpc.platforms.ios.files[k].src;
            syncFile(
                pc.path + "/" + pf,
                path.resolve(cordovaRoot, "plugins", pc.id, pf),
                path.resolve(cordovaRoot, "platforms", "ios", cordovaConfig.name, "Plugins", pc.id, path.basename(pf)),
                pluginHistory[pf] = pluginHistory[pf] || {}
            );
        }


        // todo: this may be worth restoring if we know all updates have been synced 
        if (false) {
            // after retrieving changes we can clobber plugins/pluginid with files from the dev folder
            ncp(pc.path, path.resolve(process.cwd(), "plugins", pc.id), {
                clobber: true
            }, function() {
                loopfn(i + 1, finished);
            });
        } else {
            loopfn(i + 1, finished);
            // update files in native app project
        }



    };
    loopfn(0, function() {
        fs.writeFileSync(plugDevLogPath, JSON.stringify(genlog, null, 4));
        if (errorCount > 0) {
            console.error(errorCount + " conflicts found.");
            process.exit(1);
        }
    });



} else {
    console.log("Usage:");
    console.log("From plugin folder: plugdev link");
    console.log("From app folder: plugdev sync");
}