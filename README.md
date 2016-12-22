# Cordova Plugin Development Tool

[ ![Codeship Status for tqc/plugdev](https://codeship.com/projects/2909ee80-1b31-0133-fbe3-22e6056c3449/status?branch=master)](https://codeship.com/projects/94446)

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

For iOS native files, the sync will include the copy in the platform folder as well as the one in plugins since this is the one that shows up in xcode and is most likely to change. There is no attempt to do the same for the platform www folder, since changing anything in there is asking for trouble.

The tool only handles changes to files included in plugin.xml. For more extensive changes, use the cordova update process:

cordova plugin rm pluginname
cordova plugin add pluginname

## Development Status

This is a work in progress. Currently it handles javascript (js-module) and ios native files assuming they are in the default location. Other platforms should be easy to add, but I'm not working on any android apps at the moment.

