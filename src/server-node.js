/**
 MIT License
 Copyright (c) 2018-2022 Klaus Landsdorf (http://node-red.plus/)
 Updated by Richard Meyer 2024
 **/
module.exports = function (RED) {
  "use strict";

  function OPCUACompactServerRefreshNode(nodeConfig) {
    const coreServer = require("./core/server");
    const serverSandbox = require("./core/server-sandbox");

    // Create the Node-RED node
    RED.nodes.createNode(this, nodeConfig);
    this.name = nodeConfig.name;
    this.port = nodeConfig.port;

    const node = this;
    let opcuaServer;

    // Initial Logging and Status Setup
    coreServer.detailLog(`Creating node with ID: ${node.id}`);
    coreServer.listenForErrors(node);
    coreServer.setStatusInit(node);
    coreServer.readConfigOfServerNode(node, nodeConfig);

    // Delay Initialization based on configuration
    const initOPCUATimer = setTimeout(() => {
      coreServer.detailLog(
        `Initializing OPC UA Server for node ID: ${node.id}`
      );
      coreServer.setStatusPending(node);

      // Get server options from the core server
      const opcuaServerOptions = coreServer.defaultServerOptions(node);
      opcuaServerOptions.nodeset_filename = coreServer.loadOPCUANodeSets(
        node,
        __dirname
      );

      node.contribOPCUACompact = {};
      node.contribOPCUACompact.eventObjects = {}; // Initialize eventObjects
      node.contribOPCUACompact.initialized = false;

      // Assign the addressSpaceScript from nodeConfig
      if (nodeConfig.addressSpaceScript) {
        try {
          // Safely evaluate the addressSpaceScript as a function
          node.contribOPCUACompact.constructAddressSpaceScript = eval(
            `(${nodeConfig.addressSpaceScript})`
          );
          coreServer.debugLog(
            `Address space script successfully loaded for node ID: ${node.id}`
          );
        } catch (err) {
          node.error(`Failed to evaluate addressSpaceScript: ${err.message}`);
          coreServer.errorLog(
            `Address space script evaluation error: ${err.stack}`
          );
          coreServer.setStatusError(
            node,
            `Address space script error: ${err.message}`
          );
          return;
        }
      } else {
        node.warn(
          "No addressSpaceScript provided. The server might not construct the address space correctly."
        );
        coreServer.setStatusError(node, "No addressSpaceScript provided.");
        // Depending on requirements, you might choose to proceed or halt initialization here
      }

      // Initialize the OPC UA Server with the provided options
      opcuaServer = coreServer.initialize(node, opcuaServerOptions);

      // Start the server
      coreServer
        .run(node, opcuaServer)
        .then(() => {
          // Initialize the sandbox and run the addressSpaceScript within it
          serverSandbox.initialize(
            node,
            coreServer,
            opcuaServer, // Pass the OPC UA server instance
            opcuaServer.engine.addressSpace, // Pass the address space
            node.contribOPCUACompact.eventObjects, // Pass eventObjects
            (node, vm) => {
              node.contribOPCUACompact.vm = vm;

              try {
                // Assign the addressSpaceScript function to the sandboxed context
                vm.run(`
                  node.contribOPCUACompact.constructAddressSpaceScript = node.contribOPCUACompact.constructAddressSpaceScript;
                `);

                // Execute the addressSpaceScript within the sandbox
                vm.run(`
                  node.contribOPCUACompact.constructAddressSpaceScript(
                    server,
                    addressSpace,
                    opcua,
                    eventObjects,
                    () => {
                      // Address space construction completed
                      node.status({ fill: "green", shape: "dot", text: "active" });
                      node.emit("server_running");
                    }
                  );
                `);

                node.contribOPCUACompact.initialized = true;
                node.emit("server_node_running");
                coreServer.setStatusActive(node);
              } catch (err) {
                node.error(
                  `Error executing addressSpaceScript: ${err.message}`
                );
                coreServer.errorLog(
                  `Address space script execution error: ${err.stack}`
                );
                coreServer.setStatusError(
                  node,
                  `Address space script execution error: ${err.message}`
                );
              }
            }
          );
        })
        .catch((err) => {
          /* istanbul ignore next */
          node.warn(err);
          /* istanbul ignore next */
          node.emit("server_node_error", err);
          coreServer.setStatusError(node, `Server run error: ${err.message}`);
        });
    }, node.delayToInit);

    // Function to clean up outstanding timers and intervals
    function cleanSandboxTimer(node, done) {
      if (node.outstandingTimers) {
        while (node.outstandingTimers.length > 0) {
          clearTimeout(node.outstandingTimers.pop());
        }
      }
      if (node.outstandingIntervals) {
        while (node.outstandingIntervals.length > 0) {
          clearInterval(node.outstandingIntervals.pop());
        }
      }
      coreServer.detailLog(`Cleaned up timers for node ID: ${node.id}`);
      done();
    }

    // Function to gracefully close the server
    function closeServer(done) {
      if (initOPCUATimer) {
        clearTimeout(initOPCUATimer);
      }

      if (opcuaServer) {
        coreServer.stop(node, opcuaServer, () => {
          setTimeout(() => {
            coreServer.setStatusClosed(node);
            cleanSandboxTimer(node, done);
          }, node.delayToClose || 0); // Default to 0 if delayToClose is not set
        });
      } else {
        cleanSandboxTimer(node, done);
      }
    }

    // Handle the node being closed (e.g., when Node-RED is stopped or the flow is redeployed)
    node.on("close", (done) => {
      closeServer(done);
    });
  }

  // Register the Node-RED node type
  RED.nodes.registerType("opcua-compact-server-refresh", OPCUACompactServerRefreshNode);

  // Register the node in the Node-RED library (optional, based on your setup)
  RED.library.register("opcua");
};
