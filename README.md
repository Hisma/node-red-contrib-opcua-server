# node-red-contrib-opcua-server-refresh

A programmable OPC UA server for Node-RED based on node-opcua next generation version with less dependencies.

NOTE:
This is a fork of the original work of Klaus Landorf by Richard Meyer.  The original package has not been maintained for over 2 years.  This updated version was created to work with the latest version of node opc-ua and other dependencies, and fixed some broken/in progress features such as -
* loading of nodeset xml files from inside the node configuration
* full opc-ua security policy support
This is a WIP with the goal of being able to build modern node opc-ua servers within node-red that support most essential features.

## Core

using next generation node-opcua version from [Etienne Rossignon](https://github.com/erossignon/)

## Install

Run the following command in your Node-RED user directory - typically `~/.node-red`

        npm install node-red-contrib-opcua-server-refresh

try these options on npm install to build from source if you have problems to install

        --unsafe-perm --build-from-source

## Debug

Debugging on remote devices is important to help users. The verbose logging
provides interesting points in different abstractions if IDE or console debugging is not possible.

Start debug with Node-RED in verbose (-v) mode to get a verbose logging:

    DEBUG=opcuaCompact* node-red -v 1>Node-RED-OPC-UA-Server.log 2>&1

or on local Node-RED

    DEBUG=opcuaCompact* node red.js -v 1>Node-RED-OPC-UA-Server.log 2>&1

## Code Style

Prettier

## Contribution

**Yes, sure!** Please help us to make it even better and send your pull requests or tests!

#### Happy coding!

## License

based on node-opcua we use MIT license
Copyright (c) 2019 [Bianco Royal Software Innovations®](https://github.com/BiancoRoyal/)
Forked and updated by Richard Meyer
