// Sovereign Fire: game rules (setup, movement, turn resolution).
(function (SF) {
  "use strict";

  SF.newGame = function (mode) {
    var state = {
      version: 1,
      mode: mode,          // "computer" or "hotseat"
      turn: 1,
      phase: "orders",     // "orders" or "handoff"
      current: 0,          // whose orders are being entered
      nextUnitId: 1,
      units: [],
      orders: [[], []],
      nextOrderId: 1,
      report: null
    };
    SF.STARTING_ARMY.forEach(function (entry) {
      var at = entry[0], army = entry[1];
      [0, 1].forEach(function (owner) {
        var where = owner === 0 ? at : SF.mirrorId(at);
        SF.UNIT_ORDER.forEach(function (type) {
          for (var i = 0; i < (army[type] || 0); i++) {
            state.units.push({ id: state.nextUnitId++, type: type, owner: owner, at: where });
          }
        });
      });
    });
    return state;
  };

  SF.unitsAt = function (state, id, owner) {
    return state.units.filter(function (u) {
      return u.at === id && (owner === undefined || u.owner === owner);
    });
  };

  // Who has units on a square right now, or null.
  SF.occupant = function (state, id) {
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].at === id) return state.units[i].owner;
    }
    return null;
  };

  SF.orderFor = function (state, unitId) {
    for (var p = 0; p < 2; p++) {
      for (var i = 0; i < state.orders[p].length; i++) {
        if (state.orders[p][i].unitIds.indexOf(unitId) !== -1) return state.orders[p][i];
      }
    }
    return null;
  };

  // Squares one unit type can reach from a square this turn.
  function reachType(state, owner, fromId, type) {
    var t = SF.UNIT_TYPES[type];
    var best = {};
    best[fromId] = t.move;
    var queue = [fromId];
    while (queue.length) {
      var id = queue.shift();
      var rem = best[id];
      if (rem <= 0) continue;
      SF.neighbors(SF.sq(id)).forEach(function (n) {
        var key = n.terrain.key;
        if (key === "ocean") return;
        if (key === "river" && !t.crossRiver) return;
        var occ = SF.occupant(state, n.id);
        if (occ !== null && occ !== owner) return;
        var left = Math.max(0, rem - SF.MOVE_COST[key]);
        if (best[n.id] === undefined || left > best[n.id]) {
          best[n.id] = left;
          queue.push(n.id);
        }
      });
    }
    delete best[fromId];
    return best;
  }

  // Squares a group of unit types can all reach, as a list of ids,
  // nearest first.
  SF.reachable = function (state, owner, fromId, types) {
    if (!types.length) return [];
    var maps = types.map(function (type) { return reachType(state, owner, fromId, type); });
    var from = SF.sq(fromId);
    return Object.keys(maps[0]).filter(function (id) {
      return maps.every(function (m) { return m[id] !== undefined; });
    }).sort(function (a, b) {
      var sa = SF.sq(a), sb = SF.sq(b);
      var da = Math.abs(sa.row - from.row) + Math.abs(sa.col - from.col);
      var db = Math.abs(sb.row - from.row) + Math.abs(sb.col - from.col);
      if (da !== db) return da - db;
      return sa.row - sb.row || sa.col - sb.col;
    });
  };

  SF.addOrder = function (state, owner, unitIds, to) {
    var units = state.units.filter(function (u) { return unitIds.indexOf(u.id) !== -1; });
    if (!units.length) return null;
    var from = units[0].at;
    var types = [];
    units.forEach(function (u) {
      if (u.owner !== owner || u.at !== from) throw new Error("Bad order");
      if (SF.orderFor(state, u.id)) throw new Error("Unit already has orders");
      if (types.indexOf(u.type) === -1) types.push(u.type);
    });
    if (SF.reachable(state, owner, from, types).indexOf(to) === -1) throw new Error("Out of reach");
    var order = { id: state.nextOrderId++, unitIds: unitIds.slice(), from: from, to: to };
    state.orders[owner].push(order);
    return order;
  };

  SF.cancelOrder = function (state, owner, orderId) {
    state.orders[owner] = state.orders[owner].filter(function (o) { return o.id !== orderId; });
  };

  // "2 infantry and 1 tank"
  SF.describeUnits = function (units) {
    var counts = {};
    units.forEach(function (u) { counts[u.type] = (counts[u.type] || 0) + 1; });
    var parts = [];
    SF.UNIT_ORDER.forEach(function (type) {
      var n = counts[type];
      if (!n) return;
      var t = SF.UNIT_TYPES[type];
      parts.push(n + " " + (n === 1 ? t.name : t.plural));
    });
    if (parts.length <= 1) return parts.join("");
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  };

  // The computer opponent. For now it only defends, so it gives no orders.
  SF.computerOrders = function (state) {
    state.orders[1] = [];
  };

  // Play out both players' orders at once.
  SF.resolveTurn = function (state) {
    var unitById = {};
    state.units.forEach(function (u) { unitById[u.id] = u; });

    var all = state.orders[0].map(function (o) { return { owner: 0, order: o }; })
      .concat(state.orders[1].map(function (o) { return { owner: 1, order: o }; }));
    all.forEach(function (e) {
      e.order.unitIds = e.order.unitIds.filter(function (id) { return unitById[id]; });
      e.blocked = false;
    });

    // Armies trying to swap squares meet on the way and stop.
    state.orders[0].forEach(function (a) {
      state.orders[1].forEach(function (b) {
        if (a.from === b.to && a.to === b.from) {
          all.forEach(function (e) { if (e.order === a || e.order === b) e.blocked = true; });
        }
      });
    });

    // Find where everyone would end up, and stop any move that ends on a
    // square holding the other side. Repeat, since a stopped army stays
    // where it started and can block someone else.
    function positions() {
      var pos = {};
      state.units.forEach(function (u) { pos[u.id] = u.at; });
      all.forEach(function (e) {
        if (e.blocked) return;
        e.order.unitIds.forEach(function (id) { pos[id] = e.order.to; });
      });
      return pos;
    }
    var changed = true;
    while (changed) {
      changed = false;
      var pos = positions();
      var owners = {};
      state.units.forEach(function (u) {
        var at = pos[u.id];
        owners[at] = owners[at] || {};
        owners[at][u.owner] = true;
      });
      all.forEach(function (e) {
        if (e.blocked) return;
        var o = owners[e.order.to];
        if (o && o[0] && o[1]) { e.blocked = true; changed = true; }
      });
    }

    var finalPos = positions();
    var entries = all.map(function (e) {
      var units = e.order.unitIds.map(function (id) { return unitById[id]; });
      return {
        owner: e.owner,
        what: SF.describeUnits(units),
        from: e.order.from,
        to: e.order.to,
        blocked: e.blocked
      };
    });
    state.units.forEach(function (u) { u.at = finalPos[u.id]; });

    state.report = { turn: state.turn, entries: entries, mode: state.mode };
    state.orders = [[], []];
    state.turn += 1;
    return state.report;
  };
})(window.SF);
