/**
 MIT License
 Copyright (c) 2018-2022 Klaus Landsdorf (http://node-red.plus/)
 Copyright (c) 2019 Sterfive (https://www.sterfive.com/)
 Updated by Richard Meyer 2024
 **/
"use strict";

const path = require("path");
const debug = require("debug");
const {
  OPCUAServer,
  SecurityPolicy,
  MessageSecurityMode,
} = require("node-opcua");
const nodeOPCUANodesets = require("node-opcua-nodesets");
const requireResolve = require.resolve("node-opcua-server");

// Debug loggers
const opcuaServerDebug = debug("opcuaCompact:server");
const opcuaServerDetailsDebug = debug("opcuaCompact:server:details");
const opcuaErrorDebug = debug("opcuaCompact:error");

// Helper functions
const listenForErrors = (node) => {
  node.on("error", (err) => {
    opcuaErrorDebug(err);
  });
};

const setNodeStatus = (node, options) => {
  node.status(options);
};

// Security functions
const isWindows = () => process.platform === "win32";

const checkUserLogon = () => true;

const getPackagePathFromIndex = () => {
  if (isWindows()) {
    return requireResolve.replace("\\index.js", "");
  } else {
    return requireResolve.replace("/index.js", "");
  }
};

const serverCertificateFile = (keybits) => {
  return path.join(
    __dirname,
    "../../certificates/server_selfsigned_cert_" + keybits + ".pem"
  );
};

const serverKeyFile = (keybits) => {
  return path.join(
    __dirname,
    "../../certificates/server_key_" + keybits + ".pem"
  );
};

module.exports = {
  // Use OPCUAServer directly from node-opcua
  nodeOpcuaServer: require("node-opcua-server/dist/opcua_server"),

  // Export opcua (node-opcua module)
  opcua: require("node-opcua"),

  debugLog: opcuaServerDebug,
  detailLog: opcuaServerDetailsDebug,
  errorLog: opcuaErrorDebug,

  readConfigOfServerNode: (node, config) => {
    /***
     * read config from user input from node-red
     */
    // network
    node.port = config.port;
    node.endpoint = config.endpoint;
    node.productUri = config.productUri;
    node.alternateHostname = config.alternateHostname;

    // limits
    node.maxAllowedSessionNumber = config.maxAllowedSessionNumber;
    node.maxConnectionsPerEndpoint = config.maxConnectionsPerEndpoint;
    node.maxAllowedSubscriptionNumber = config.maxAllowedSubscriptionNumber;
    node.maxNodesPerRead = config.maxNodesPerRead;
    node.maxNodesPerWrite = config.maxNodesPerWrite;
    node.maxNodesPerHistoryReadData = config.maxNodesPerHistoryReadData;
    node.maxNodesPerBrowse = config.maxNodesPerBrowse;
    node.maxBrowseContinuationPoints = config.maxBrowseContinuationPoints;
    node.maxHistoryContinuationPoints = config.maxHistoryContinuationPoints;

    node.delayToInit = config.delayToInit;
    node.delayToClose = config.delayToClose;
    node.serverShutdownTimeout = config.serverShutdownTimeout;
    node.showStatusActivities = config.showStatusActivities;
    node.showErrors = config.showErrors;

    // certificates
    node.publicCertificateFile = config.publicCertificateFile;
    node.privateCertificateFile = config.privateCertificateFile;

    // Security
    node.allowAnonymous = config.allowAnonymous;
    // User Management
    node.opcuaUsers = config.users;
    // XML-Set Management
    node.xmlsetsOPCUA = config.xmlsetsOPCUA;
    // Audit
    node.isAuditing = config.isAuditing;

    // discovery
    node.disableDiscovery = !config.serverDiscovery;
    node.registerServerMethod = config.registerServerMethod;
    node.discoveryServerEndpointUrl = config.discoveryServerEndpointUrl;

    /* istanbul ignore next */
    node.capabilitiesForMDNS = config.capabilitiesForMDNS
      ? config.capabilitiesForMDNS.split(",")
      : [config.capabilitiesForMDNS];

    return node;
  },

  initialize: (node, options) => {
    return new OPCUAServer(options);
  },

  stop: (node, server, done) => {
    server.shutdown(node.serverShutdownTimeout, done);
  },

  getRegisterServerMethod: (id) => {
    return nodeOPCUA.RegisterServerMethod[id];
  },

  loadOPCUANodeSets: (node, dirname) => {
    const xmlFiles = [
      nodeOPCUANodesets.nodesets.standard,
      nodeOPCUANodesets.nodesets.di,
    ];

    if (Array.isArray(node.xmlsetsOPCUA)) {
      node.xmlsetsOPCUA.forEach((xmlsetFileName) => {
        if (xmlsetFileName.path) {
          if (xmlsetFileName.path.startsWith("public/vendor/")) {
            xmlFiles.push(path.join(dirname, xmlsetFileName.path));
          } else {
            xmlFiles.push(xmlsetFileName.path);
          }
        }
      });
      opcuaServerDetailsDebug("appending xmlFiles: " + xmlFiles.toString());
    }

    opcuaServerDetailsDebug("node sets:" + xmlFiles.toString());

    return xmlFiles;
  },

  defaultServerOptions: (node) => {
    const certificateFile =
      node.publicCertificateFile || serverCertificateFile("2048");
    const privateKeyFile = node.privateCertificateFile || serverKeyFile("2048");
    const registerServerMethod = 1;

    return {
      port: typeof node.port === "string" ? parseInt(node.port) : node.port,
      resourcePath: node.endpoint || "/UA/NodeRED/Compact",
      buildInfo: {
        productName: "Node-RED OPC UA Compact Server",
        buildNumber: "20240927",
        buildDate: new Date(2022, 9, 27),
      },
      serverCapabilities: {
        maxBrowseContinuationPoints: node.maxBrowseContinuationPoints,
        maxHistoryContinuationPoints: node.maxHistoryContinuationPoints,
        operationLimits: {
          maxNodesPerRead: node.maxNodesPerRead,
          maxNodesPerWrite: node.maxNodesPerWrite,
          maxNodesPerHistoryReadData: node.maxNodesPerHistoryReadData,
          maxNodesPerBrowse: node.maxNodesPerBrowse,
        },
      },
      serverInfo: {
        productUri: node.productUri || "NodeOPCUA-Server-" + node.port,
        applicationName: { text: "NodeRED-Compact", locale: "en" },
        gatewayServerUri: null,
        discoveryProfileUri: null,
        discoveryUrls: [],
      },
      alternateHostname: node.alternateHostname,
      maxAllowedSessionNumber: node.maxAllowedSessionNumber,
      maxConnectionsPerEndpoint: node.maxConnectionsPerEndpoint,
      allowAnonymous: node.allowAnonymous,
      certificateFile,
      privateKeyFile,
      userManager: {
        isValidUser: checkUserLogon,
      },
      isAuditing: node.isAuditing,
      disableDiscovery: node.disableDiscovery,
      registerServerMethod,

      // **Explicitly define security policies and modes**
      securityPolicies: [
        SecurityPolicy.None,
        SecurityPolicy.Basic128Rsa15,
        SecurityPolicy.Basic256,
        SecurityPolicy.Basic256Sha256,
      ],
      securityModes: [
        MessageSecurityMode.None,
        MessageSecurityMode.Sign,
        MessageSecurityMode.SignAndEncrypt,
      ],
    };
  },

  constructAddressSpaceFromScript: (
    server,
    constructAddressSpaceScript,
    opcua,
    eventObjects,
    done
  ) => {
    return new Promise((resolve, reject) => {
      try {
        constructAddressSpaceScript(
          server,
          server.engine.addressSpace,
          opcua, // Correctly pass the opcua module
          eventObjects,
          resolve
        );
      } catch (err) {
        reject(err);
      }
    });
  },

  postInitialize: (node, opcuaServer) => {
    node.contribOPCUACompact.eventObjects = {};

    const addressSpace = opcuaServer.engine?.addressSpace;
    if (addressSpace) {
      addressSpace.getOwnNamespace();
    }

    module.exports
      .constructAddressSpaceFromScript(
        opcuaServer,
        node.contribOPCUACompact.constructAddressSpaceScript,
        node.contribOPCUACompact.eventObjects
      )
      .then(() => {
        setNodeStatus(node, { fill: "green", shape: "dot", text: "active" });
        node.emit("server_running");
      })
      .catch((err) => {
        setNodeStatus(node, { fill: "red", shape: "dot", text: err.message });
        node.emit("server_start_error");
      });
  },

  run: (node, server) => {
    return new Promise((resolve, reject) => {
      server.start((err) => {
        if (err) {
          opcuaErrorDebug("Server failed to start:", err);
          reject(err);
        } else {
          if (server.endpoints && server.endpoints.length) {
            server.endpoints.forEach((endpoint) => {
              endpoint.endpointDescriptions().forEach((endpointDescription) => {
                opcuaServerDebug(
                  "Server endpointUrl: " +
                    endpointDescription.endpointUrl +
                    " securityMode: " +
                    endpointDescription.securityMode.toString() +
                    " securityPolicyUri: " +
                    (endpointDescription.securityPolicyUri
                      ? endpointDescription.securityPolicyUri.toString()
                      : "None Security Policy Uri")
                );
              });
            });

            const endpointUrl =
              server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            opcuaServerDebug("Primary Server Endpoint URL " + endpointUrl);
          }

          server.on("newChannel", (channel) => {
            opcuaServerDebug(
              `Client connected with address = ${channel.remoteAddress} port = ${channel.remotePort}`
            );
          });

          server.on("closeChannel", (channel) => {
            opcuaServerDebug(
              `Client disconnected with address = ${channel.remoteAddress} port = ${channel.remotePort}`
            );
          });

          server.on("create_session", (session) => {
            opcuaServerDebug("############## SESSION CREATED ##############");
            if (session.clientDescription) {
              opcuaServerDetailsDebug(
                `Client application URI: ${session.clientDescription.applicationUri}`
              );
              opcuaServerDetailsDebug(
                `Client product URI: ${session.clientDescription.productUri}`
              );
              opcuaServerDetailsDebug(
                `Client application name: ${
                  session.clientDescription.applicationName
                    ? session.clientDescription.applicationName.toString()
                    : "none application name"
                }`
              );
              opcuaServerDetailsDebug(
                `Client application type: ${
                  session.clientDescription.applicationType
                    ? session.clientDescription.applicationType.toString()
                    : "none application type"
                }`
              );
            }

            opcuaServerDebug(
              `Session name: ${
                session.sessionName
                  ? session.sessionName.toString()
                  : "none session name"
              }`
            );
            opcuaServerDebug(`Session timeout: ${session.sessionTimeout}`);
            opcuaServerDebug(`Session id: ${session.sessionId}`);
          });

          server.on("session_closed", (session, reason) => {
            opcuaServerDebug("############## SESSION CLOSED ##############");
            opcuaServerDetailsDebug(`reason: ${reason}`);
            opcuaServerDetailsDebug(
              `Session name: ${
                session.sessionName
                  ? session.sessionName.toString()
                  : "none session name"
              }`
            );
          });

          opcuaServerDebug("Server Initialized");

          if (server.serverInfo) {
            opcuaServerDetailsDebug(
              `Server Info: ${JSON.stringify(server.serverInfo)}`
            );
          }

          resolve();
        }
      });
    });
  },

  // Set node status indicator in node-red
  listenForErrors,
  setStatusPending: (node) =>
    setNodeStatus(node, { fill: "yellow", shape: "ring", text: "pending" }),
  setStatusInit: (node) =>
    setNodeStatus(node, { fill: "yellow", shape: "dot", text: "init" }),
  setStatusActive: (node) =>
    setNodeStatus(node, { fill: "green", shape: "dot", text: "active" }),
  setStatusClosed: (node) =>
    setNodeStatus(node, { fill: "yellow", shape: "ring", text: "closed" }),
  setStatusError: (node, text) =>
    setNodeStatus(node, { fill: "red", shape: "dot", text }),

  // Security functions
  isWindows,
  checkUserLogon,
  getPackagePathFromIndex,
  serverCertificateFile,
  serverKeyFile,
};
