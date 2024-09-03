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

    // Create an isolate
    const isolate = new ivm.Isolate({ memoryLimit: 128 });

    // Create a new context within the isolate
    const context = await isolate.createContext();

    // Get the global object within the context
    const jail = context.global;
    await jail.set("global", jail.derefInto());

    // Define individual components of the sandbox
    await jail.set("node", new ivm.ExternalCopy(node).copyInto());
    await jail.set("coreServer", new ivm.ExternalCopy(coreServer).copyInto());

    // Set up the context objects, passing only necessary methods and properties
    await jail.set("sandboxNodeContext", {
      set: new ivm.Reference(function () {
        return node.context().set.apply(node, arguments);
      }),
      get: new ivm.Reference(function () {
        return node.context().get.apply(node, arguments);
      }),
      keys: new ivm.Reference(function () {
        return node.context().keys.apply(node, arguments);
      }),
    });

    await jail.set("sandboxFlowContext", {
      set: new ivm.Reference(function () {
        return node.context().flow.set.apply(node, arguments);
      }),
      get: new ivm.Reference(function () {
        return node.context().flow.get.apply(node, arguments);
      }),
      keys: new ivm.Reference(function () {
        return node.context().flow.keys.apply(node, arguments);
      }),
    });

    await jail.set("sandboxGlobalContext", {
      set: new ivm.Reference(function () {
        return node.context().global.set.apply(node, arguments);
      }),
      get: new ivm.Reference(function () {
        return node.context().global.get.apply(node, arguments);
      }),
      keys: new ivm.Reference(function () {
        return node.context().global.keys.apply(node, arguments);
      }),
    });

    await jail.set("sandboxEnv", {
      get: new ivm.Reference(function (envVar) {
        const flow = node._flow;
        return flow.getSetting(envVar);
      }),
    });

    // Set timeout and interval functions
    await jail.set("setTimeout", new ivm.Reference(function (func, delay) {
      const timerId = setTimeout(() => {
        try {
          func.apply(this);
        } catch (err) {
          node.error(err, {});
        }
      }, delay);
      node.outstandingTimers.push(timerId);
      return timerId;
    }));

    await jail.set("clearTimeout", new ivm.Reference(function (id) {
      clearTimeout(id);
      const index = node.outstandingTimers.indexOf(id);
      if (index > -1) {
        node.outstandingTimers.splice(index, 1);
      }
    }));

    await jail.set("setInterval", new ivm.Reference(function (func, delay) {
      const timerId = setInterval(() => {
        try {
          func.apply(this);
        } catch (err) {
          node.error(err, {});
        }
      }, delay);
      node.outstandingIntervals.push(timerId);
      return timerId;
    }));

    await jail.set("clearInterval", new ivm.Reference(function (id) {
      clearInterval(id);
      const index = node.outstandingIntervals.indexOf(id);
      if (index > -1) {
        node.outstandingIntervals.splice(index, 1);
      }
    }));

    // Injecting required modules
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

    // Execute the done function with the isolate and context
    done(node, { isolate, context });
  },
};
