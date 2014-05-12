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

    console.log(pluginXml);

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


process.bin = process.title = 'plugdev';
process.stdout.write("plugdev " + pkg.version + '\n');

var plugdevdir = __dirname;
var workingdir = process.cwd();

if (process.argv[2] == "link") {

    if (!fs.existsSync(path.resolve(process.cwd(), "plugin.xml"))) {
        console.log("Plugin not found");
    }

    var pluginConfig = loadPluginConfig(path.resolve(process.cwd(), "plugin.xml"));

    console.log("Linking plugin " + pluginConfig.name + " (" + pluginConfig.id + ")");
    plugdevConfig.linkedPlugins[pluginConfig.id] = {
        id: pluginConfig.id,
        name: pluginConfig.name,
        path: process.cwd()
    };

    fs.writeFileSync(plugdevConfigPath, JSON.stringify(plugdevConfig, null, 4));

} else if (process.argv[2] == "sync") {
    // check that we are in a cordova app folder
    if (!fs.existsSync(path.resolve(process.cwd(), "plugins"))) {
        console.log("Cordova app not found");
        return;
    }

    var plugDevLogPath = process.cwd() + "/plugdev-log.json";

    var genlog = {};
    if (fs.existsSync(plugDevLogPath)) genlog = JSON.parse(fs.readFileSync(plugDevLogPath, "utf8"));

    var pluginsToSync = [];

    var files = fs.readdirSync(path.resolve(process.cwd(), "plugins"));

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

    var loopfn = function(i, finished) {
        if (i >= pluginsToSync.length) return finished();
        var pc = pluginsToSync[i];
        var pluginHistory = genlog[pc.id] = genlog[pc.id] || {};
        var fpc = loadPluginConfig(path.resolve(pc.path, "plugin.xml"));
        console.log(JSON.stringify(fpc, null, 4));

        for (var j = 0; j < fpc.jsFiles.length; j++) {
            var jsf = fpc.jsFiles[j];
            var fileHistory = pluginHistory[jsf] = pluginHistory[jsf] || {};

            // todo: get paths
            var sourcePath = "";
            var targetPath = "";

            var sourceHash = fs.existsSync(sourcePath) ? crypto.createHash('sha1').update(fs.readFileSync(sourcePath, "utf8")).digest('hex') : undefined;
            var targetHash = fs.existsSync(targetPath) ? crypto.createHash('sha1').update(fs.readFileSync(targetPath, "utf8")).digest('hex') : undefined;

            if (!sourceHash) {
                console.warn("Missing source file " + sourcePath);
            } else if (sourceHash == targetHash) {
                // nothing changed, no need to do anything
                fileHistory.source = sourceHash;
                fileHistory.target = targetHash;
            } else if (sourceHash && !targetHash) {
                // todo: target is missing or deleted - replace from source
                console.log("target missing - " + sourcePath);
                //fileHistory.source = fileHistory.target = sourceHash;
            } else if (targetHash != fileHistory.targetHash && sourceHash != fileHistory.sourceHash) {
                // both changed - skip update
                console.error("Conflicting change in " + targetPath + " - not updated");
            } else if (targetHash != fileHistory.targetHash) {
                // todo:  target changed - copy back to source
                console.log("Target changed - " + targetPath);
                //fileHistory.source = fileHistory.target = targetHash;
            } else if (sourceHash != fileHistory.sourceHash) {
                // todo: source changed - copy to target
                console.log("Source changed - " + sourcePath);
                //fileHistory.source = fileHistory.target = sourceHash;
            }
        }

        // check if any of the native plugin files in the app project have changed and copy back if necessary



        // after retrieving changes we can clobber plugins/pluginid with files from the dev folder

        // todo: restore this after testing two way updates 
        /*
        ncp(pc.path, path.resolve(process.cwd(), "plugins", pc.id), {
            clobber: true
        }, function() {
*/

        loopfn(i + 1, finished);
        /*
        });
*/
        // update files in native app project



    };
    loopfn(0, function() {
        fs.writeFileSync(plugDevLogPath, JSON.stringify(genlog, null, 4));

    });



} else {
    console.log("Usage:");
    console.log("    From plugin folder: plugdev link");
    console.log("    From app folder: plugdev sync");
}