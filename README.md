# Cordova Plugin Development Tool

A tool to take the pain out of developing and updating cordova plugins. Intended to work like npm link, you can edit plugin code either in the plugin development folder or in the app xcode project, and changes will be updated in both places.

It can also be used to simplify the process of keeping published cordova plugins up to date.

## Installation

    npm install -g plugdev

## Usage

From the plugin development folder, run

    plugdev link

This will read the plugin config file and register it for use in the sync process.

In the app development folder, install the plugin with the cordova tools

    cordova plugin add <pluginname>

This will handle the initial adding of plugin files to the project. 

As part of your build process, run 

    plugdev sync

This will detect that a plugin matching the one linked has been added to the project and will automatically update changed files. Syncing is two-way - If the app version of a file has changed since the last sync, it will be copied to the plugin development folder.

The plugin sync process will produce an error if both the app and plugin versions of a file have changed.

The tool only handles changes to existing files. For more extensive changes, use the cordova update process:

cordova plugin rm pluginname
cordova plugin add pluginname

