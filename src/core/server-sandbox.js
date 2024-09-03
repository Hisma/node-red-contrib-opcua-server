/**
 MIT License
 Copyright (c) 2018-2022 Klaus Landsdorf (http://node-red.plus/)
 **/
"use strict";
const ivm = require("isolated-vm");

module.exports = {
  choreCompact: require("./chore").de.bianco.royal.compact,
  debugLog: require("./chore").de.bianco.royal.compact.opcuaSandboxDebug,
  errorLog: require("./chore").de.bianco.royal.compact.opcuaErrorDebug,
  initialize: async (node, coreServer, done) => {
    node.outstandingTimers = [];
    node.outstandingIntervals = [];

    /* istanbul ignore next */
    const sandbox = {
      node,
      coreServer,
      sandboxNodeContext: {
        set: new ivm.Reference(function () {
          return node.context().set.apply(node, arguments);
        }),
        get: new ivm.Reference(function () {
          return node.context().get.apply(node, arguments);
        }),
        keys: new ivm.Reference(function () {
          return node.context().keys.apply(node, arguments);
        }),
        global: node.context().global,
        flow: node.context().flow,
      },
      sandboxFlowContext: {
        set: new ivm.Reference(function () {
          return node.context().flow.set.apply(node, arguments);
        }),
        get: new ivm.Reference(function () {
          return node.context().flow.get.apply(node, arguments);
        }),
        keys: new ivm.Reference(function () {
          return node.context().flow.keys.apply(node, arguments);
        }),
      },
      sandboxGlobalContext: {
        set: new ivm.Reference(function () {
          return node.context().global.set.apply(node, arguments);
        }),
        get: new ivm.Reference(function () {
          return node.context().global.get.apply(node, arguments);
        }),
        keys: new ivm.Reference(function () {
          return node.context().global.keys.apply(node, arguments);
        }),
      },
      sandboxEnv: {
        get: new ivm.Reference(function (envVar) {
          const flow = node._flow;
          return flow.getSetting(envVar);
        }),
      },
      setTimeout: new ivm.Reference(function () {
        const func = arguments[0];
        const timerId = setTimeout.apply(this, arguments);
        arguments[0] = function () {
          sandbox.clearTimeout(timerId);
          try {
            func.apply(this, arguments);
          } catch (err) {
            node.error(err, {});
          }
        };
        node.outstandingTimers.push(timerId);
        return timerId;
      }),
      clearTimeout: new ivm.Reference(function (id) {
        clearTimeout(id);
        const index = node.outstandingTimers.indexOf(id);
        if (index > -1) {
          node.outstandingTimers.splice(index, 1);
        }
      }),
      setInterval: new ivm.Reference(function () {
        const func = arguments[0];
        const timerId = setInterval.apply(this, arguments);
        arguments[0] = function () {
          try {
            func.apply(this, arguments);
          } catch (err) {
            node.error(err, {});
          }
        };
        node.outstandingIntervals.push(timerId);
        return timerId;
      }),
      clearInterval: new ivm.Reference(function (id) {
        clearInterval(id);
        const index = node.outstandingIntervals.indexOf(id);
        if (index > -1) {
          node.outstandingIntervals.splice(index, 1);
        }
      }),
    };

    // Step 1: Create an isolate
    const isolate = new ivm.Isolate({ memoryLimit: 128 }); // Memory limit in MB

    // Step 2: Create a new context within the isolate
    const context = await isolate.createContext();

    // Step 3: Set up the global context
    const jail = context.global;
    await jail.set("global", jail.derefInto());

    // Step 4: Inject the sandbox object into the context (only the parts that can be passed)
    await jail.set("sandbox", sandbox);

    // Step 5: Inject required modules
    await jail.set("require", new ivm.Reference((module) => {
      if (module === "fs") {
        return require("fs");
      } else if (module === "Math") {
        return Math;
      } else if (module === "Date") {
        return Date;
      } else if (module === "console") {
        return console;
      } else {
        throw new Error(`Module ${module} is not allowed`);
      }
    }));

    // Step 6: Execute the done function with the isolate and context
    done(node, { isolate, context });
  },
};
