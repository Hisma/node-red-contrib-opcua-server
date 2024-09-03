/**
 MIT License
 Copyright (c) 2018-2022 Klaus Landsdorf (http://node-red.plus/)
 **/
"use strict";
const { VM, Reference } = require("isolated-vm");

module.exports = {
  choreCompact: require("./chore").de.bianco.royal.compact,
  debugLog: require("./chore").de.bianco.royal.compact.opcuaSandboxDebug,
  errorLog: require("./chore").de.bianco.royal.compact.opcuaErrorDebug,
  initialize: async (node, coreServer, done) => {
    node.outstandingTimers = [];
    node.outstandingIntervals = [];

    const isolate = new VM();
    const context = await isolate.createContext();

    // Create a sandbox object with necessary functions and objects
    const sandbox = {
      node: new Reference(node),
      coreServer: new Reference(coreServer),
      sandboxNodeContext: new Reference({
        set: (...args) => node.context().set(...args),
        get: (...args) => node.context().get(...args),
        keys: (...args) => node.context().keys(...args),
        global: node.context().global,
        flow: node.context().flow,
      }),
      sandboxFlowContext: new Reference({
        set: (...args) => node.context().flow.set(...args),
        get: (...args) => node.context().flow.get(...args),
        keys: (...args) => node.context().flow.keys(...args),
      }),
      sandboxGlobalContext: new Reference({
        set: (...args) => node.context().global.set(...args),
        get: (...args) => node.context().global.get(...args),
        keys: (...args) => node.context().global.keys(...args),
      }),
      sandboxEnv: new Reference({
        get: (envVar) => node._flow.getSetting(envVar),
      }),
    };

    // Inject the sandbox object into the context
    await context.global.set('sandbox', sandbox);

    // Create wrapper functions for setTimeout and setInterval
    const wrapTimerFunction = (funcName) => {
      return new Reference((...args) => {
        const callback = args[0];
        const wrappedCallback = (...cbArgs) => {
          try {
            callback(...cbArgs);
          } catch (err) {
            node.error(err, {});
          }
        };
        args[0] = wrappedCallback;
        const timerId = global[funcName](...args);
        node[`outstanding${funcName.slice(3)}s`].push(timerId);
        return timerId;
      });
    };

    // Create wrapper functions for clearTimeout and clearInterval
    const wrapClearFunction = (funcName) => {
      return new Reference((id) => {
        global[funcName](id);
        const arrayName = `outstanding${funcName.slice(5)}s`;
        const index = node[arrayName].indexOf(id);
        if (index > -1) {
          node[arrayName].splice(index, 1);
        }
      });
    };

    // Inject timer functions into the context
    await context.global.set('setTimeout', wrapTimerFunction('setTimeout'));
    await context.global.set('setInterval', wrapTimerFunction('setInterval'));
    await context.global.set('clearTimeout', wrapClearFunction('clearTimeout'));
    await context.global.set('clearInterval', wrapClearFunction('clearInterval'));

    // Inject console methods
    const console = ['log', 'error', 'warn', 'info', 'debug'].reduce((acc, method) => {
      acc[method] = new Reference((...args) => global.console[method](...args));
      return acc;
    }, {});
    await context.global.set('console', new Reference(console));

    done(node, context);
  },
};
