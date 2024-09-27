// server-sandbox.js
const { VM } = require("vm2");

module.exports = {
  initialize: (node, coreServer, server, addressSpace, eventObjects, done) => {
    node.outstandingTimers = [];
    node.outstandingIntervals = [];

    /* istanbul ignore next */
    // Attach sandboxFlowContext directly to eventObjects
    eventObjects.sandboxFlowContext = {
      set: function () {
        node.context().flow.set.apply(node, arguments);
      },
      get: function () {
        return node.context().flow.get.apply(node, arguments);
      },
      keys: function () {
        return node.context().flow.keys.apply(node, arguments);
      },
    };

    const sandbox = {
      node,
      coreServer,
      opcua: coreServer.opcua, // Expose the opcua module
      server,                     // Expose the OPC UA server instance
      addressSpace,               // Expose the address space
      eventObjects,               // Now includes sandboxFlowContext

      sandboxNodeContext: {
        set: function () {
          node.context().set.apply(node, arguments);
        },
        get: function () {
          return node.context().get.apply(node, arguments);
        },
        keys: function () {
          return node.context().keys.apply(node, arguments);
        },
        get global() {
          return node.context().global;
        },
        get flow() {
          return node.context().flow;
        },
      },
      // Removed separate sandboxFlowContext since it's now within eventObjects
      sandboxGlobalContext: {
        set: function () {
          node.context().global.set.apply(node, arguments);
        },
        get: function () {
          return node.context().global.get.apply(node, arguments);
        },
        keys: function () {
          return node.context().global.keys.apply(node, arguments);
        },
      },
      sandboxEnv: {
        get: function (envVar) {
          const flow = node._flow;
          return flow.getSetting(envVar);
        },
      },
      setTimeout: function () {
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
      },
      clearTimeout: function (id) {
        clearTimeout(id);
        const index = node.outstandingTimers.indexOf(id);
        if (index > -1) {
          node.outstandingTimers.splice(index, 1);
        }
      },
      setInterval: function () {
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
      },
      clearInterval: function (id) {
        clearInterval(id);
        const index = node.outstandingIntervals.indexOf(id);
        if (index > -1) {
          node.outstandingIntervals.splice(index, 1);
        }
      },
    };

    const vm = new VM({
      require: {
        builtin: ["fs", "Math", "Date", "console"],
      },
      sandbox,
    });

    done(node, vm);
  },
};
