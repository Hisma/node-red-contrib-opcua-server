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

    // Step 1: Create an isolate
    const isolate = new ivm.Isolate({ memoryLimit: 128 }); // Memory limit in MB

    // Step 2: Create a new context within the isolate
    const context = await isolate.createContext();

    // Step 3: Set up the global context
    const jail = context.global;
    await jail.set("global", jail.derefInto());

    // Step 4: Inject simple properties into the isolate
    await jail.set("node", new ivm.ExternalCopy({ id: node.id }).copyInto());
    await jail.set("coreServer", new ivm.ExternalCopy({}).copyInto()); // Pass any necessary simple properties of coreServer

    // Step 5: Set up context objects with references for functions
    await jail.set("sandboxNodeContext", {
      set: new ivm.Reference((...args) => node.context().set.apply(node.context(), args)),
      get: new ivm.Reference((...args) => node.context().get.apply(node.context(), args)),
      keys: new ivm.Reference((...args) => node.context().keys.apply(node.context(), args)),
    });

    await jail.set("sandboxFlowContext", {
      set: new ivm.Reference((...args) => node.context().flow.set.apply(node.context().flow, args)),
      get: new ivm.Reference((...args) => node.context().flow.get.apply(node.context().flow, args)),
      keys: new ivm.Reference((...args) => node.context().flow.keys.apply(node.context().flow, args)),
    });

    await jail.set("sandboxGlobalContext", {
      set: new ivm.Reference((...args) => node.context().global.set.apply(node.context().global, args)),
      get: new ivm.Reference((...args) => node.context().global.get.apply(node.context().global, args)),
      keys: new ivm.Reference((...args) => node.context().global.keys.apply(node.context().global, args)),
    });

    await jail.set("sandboxEnv", {
      get: new ivm.Reference((envVar) => node._flow.getSetting(envVar)),
    });

    // Step 6: Setup setTimeout and setInterval functions
    await jail.set("setTimeout", new ivm.Reference(function (func, delay) {
      const timerId = setTimeout(() => {
        try {
          func();
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

    await jail.set("setInterval", new ivm.Reference(function (func, interval) {
      const intervalId = setInterval(() => {
        try {
          func();
        } catch (err) {
          node.error(err, {});
        }
      }, interval);
      node.outstandingIntervals.push(intervalId);
      return intervalId;
    }));

    await jail.set("clearInterval", new ivm.Reference(function (id) {
      clearInterval(id);
      const index = node.outstandingIntervals.indexOf(id);
      if (index > -1) {
        node.outstandingIntervals.splice(index, 1);
      }
    }));

    // Step 7: Inject require function for specific modules
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

    // Step 8: Execute the done function with the isolate and context
    done(node, { isolate, context });
  },
};
