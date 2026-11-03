// Sovereign Fire: game rules (setup, movement, battles, turn resolution).
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

  function distance(a, b) {
    var sa = SF.sq(a), sb = SF.sq(b);
    return Math.abs(sa.row - sb.row) + Math.abs(sa.col - sb.col);
  }

  // ---------- Movement ----------

  // Squares one unit type can reach this turn. Squares holding enemy units
  // can be attacked but not moved through.
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
        if (occ !== null && occ !== owner) {
          if (best[n.id] === undefined) best[n.id] = 0;
          return;
        }
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

  // Squares a group of unit types can all reach, nearest first.
  SF.reachable = function (state, owner, fromId, types) {
    if (!types.length) return [];
    var maps = types.map(function (type) { return reachType(state, owner, fromId, type); });
    return Object.keys(maps[0]).filter(function (id) {
      return maps.every(function (m) { return m[id] !== undefined; });
    }).sort(function (a, b) {
      var da = distance(fromId, a), db = distance(fromId, b);
      if (da !== db) return da - db;
      var sa = SF.sq(a), sb = SF.sq(b);
      return sa.row - sb.row || sa.col - sb.col;
    });
  };

  function checkUnits(state, owner, unitIds) {
    var units = state.units.filter(function (u) { return unitIds.indexOf(u.id) !== -1; });
    if (!units.length) throw new Error("No units");
    var from = units[0].at;
    units.forEach(function (u) {
      if (u.owner !== owner || u.at !== from) throw new Error("Bad order");
      if (SF.orderFor(state, u.id)) throw new Error("Unit already has orders");
    });
    return units;
  }

  function typesOf(units) {
    var types = [];
    units.forEach(function (u) { if (types.indexOf(u.type) === -1) types.push(u.type); });
    return types;
  }

  SF.addOrder = function (state, owner, unitIds, to) {
    var units = checkUnits(state, owner, unitIds);
    var from = units[0].at;
    if (SF.reachable(state, owner, from, typesOf(units)).indexOf(to) === -1) throw new Error("Out of reach");
    var order = { id: state.nextOrderId++, kind: "move", unitIds: unitIds.slice(), from: from, to: to };
    state.orders[owner].push(order);
    return order;
  };

  // Enemy-held squares artillery can fire at from a square.
  SF.bombardTargets = function (state, owner, fromId) {
    var range = SF.UNIT_TYPES.artillery.bombardRange;
    return SF.allSquares().filter(function (sq) {
      var occ = SF.occupant(state, sq.id);
      return occ !== null && occ !== owner && distance(fromId, sq.id) <= range;
    }).map(function (sq) { return sq.id; }).sort(function (a, b) {
      return distance(fromId, a) - distance(fromId, b);
    });
  };

  SF.addBombard = function (state, owner, unitIds, target) {
    var units = checkUnits(state, owner, unitIds);
    var from = units[0].at;
    units.forEach(function (u) { if (u.type !== "artillery") throw new Error("Only artillery can bombard"); });
    if (SF.bombardTargets(state, owner, from).indexOf(target) === -1) throw new Error("Out of range");
    var order = { id: state.nextOrderId++, kind: "bombard", unitIds: unitIds.slice(), from: from, to: target };
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

  // ---------- Battles ----------

  function attackValue(u, terrain) {
    var v = SF.UNIT_TYPES[u.type].attack;
    if (u.type === "tank" && terrain) v += SF.TANK_ATTACK[terrain] || 0;
    return v;
  }

  function defenseValue(u, terrain) {
    var t = SF.UNIT_TYPES[u.type];
    var v = t.defense + (SF.DEFENSE_BONUS[terrain] || 0);
    if (t.rough) v += SF.ROUGH_BONUS[terrain] || 0;
    return v;
  }

  function hitChance(v) { return Math.min(0.9, Math.max(0.05, v / 10)); }

  function takeLosses(side, hits) {
    side.sort(function (a, b) { return SF.UNIT_TYPES[a.type].loss - SF.UNIT_TYPES[b.type].loss; });
    return side.splice(0, Math.min(hits, side.length));
  }

  // One battle. In a normal battle the defender gets terrain bonuses. In a
  // meeting battle both sides ran into each other, and both fight as
  // attackers. Lasts up to SF.BATTLE_ROUNDS rounds.
  SF.fight = function (attackers, defenders, terrain, meeting, rand) {
    rand = rand || Math.random;
    var att = attackers.slice(), def = defenders.slice();
    var attLost = [], defLost = [];
    for (var round = 0; round < SF.BATTLE_ROUNDS && att.length && def.length; round++) {
      var attHits = 0, defHits = 0;
      att.forEach(function (u) { if (rand() < hitChance(attackValue(u, terrain))) attHits++; });
      def.forEach(function (u) {
        var v = meeting ? attackValue(u, terrain) : defenseValue(u, terrain);
        if (rand() < hitChance(v)) defHits++;
      });
      defLost = defLost.concat(takeLosses(def, attHits));
      attLost = attLost.concat(takeLosses(att, defHits));
    }
    var result;
    if (!def.length && att.length) result = "attacker";
    else if (!att.length && def.length) result = "defender";
    else if (!att.length && !def.length) result = "both destroyed";
    else result = "held";
    return { attLost: attLost, defLost: defLost, attLeft: att, defLeft: def, result: result };
  };

  // Chance, as a whole percent, that these units take the target square
  // from the enemy units on it now.
  SF.attackOdds = function (state, owner, units, target, rand) {
    var defenders = SF.unitsAt(state, target, 1 - owner);
    var terrain = SF.sq(target).terrain.key;
    var wins = 0, runs = 400;
    for (var i = 0; i < runs; i++) {
      if (SF.fight(units, defenders, terrain, false, rand).result === "attacker") wins++;
    }
    // Nothing is ever certain, so never show 0% or 100%.
    return Math.min(99, Math.max(1, Math.round((wins / runs) * 100)));
  };

  SF.bombardChance = function (target) {
    var terrain = SF.sq(target).terrain.key;
    return Math.max(0.05, SF.BOMBARD_CHANCE - (SF.BOMBARD_TERRAIN[terrain] || 0));
  };

  // The computer opponent. For now it only defends, so it gives no orders.
  SF.computerOrders = function (state) {
    state.orders[1] = [];
  };

  // ---------- Turn resolution ----------

  SF.resolveTurn = function (state, rand) {
    rand = rand || Math.random;
    var report = { turn: state.turn, mode: state.mode, bombards: [], battles: [], moves: [] };
    var alive = {};
    state.units.forEach(function (u) { alive[u.id] = u; });

    function unitsOf(order) {
      return order.unitIds.map(function (id) { return alive[id]; }).filter(Boolean);
    }
    function kill(units) { units.forEach(function (u) { delete alive[u.id]; }); }

    var all = [];
    [0, 1].forEach(function (owner) {
      state.orders[owner].forEach(function (o) { all.push({ owner: owner, order: o }); });
    });

    // 1. Artillery fires first.
    all.filter(function (e) { return e.order.kind === "bombard"; }).forEach(function (e) {
      var guns = unitsOf(e.order);
      if (!guns.length) return;
      var killed = [];
      guns.forEach(function () {
        var targets = Object.keys(alive).map(function (id) { return alive[id]; })
          .filter(function (u) { return u.at === e.order.to && u.owner !== e.owner; });
        if (!targets.length) return;
        if (rand() < SF.bombardChance(e.order.to)) {
          var hit = targets[Math.floor(rand() * targets.length)];
          killed.push(hit);
          delete alive[hit.id];
        }
      });
      report.bombards.push({
        owner: e.owner, what: SF.describeUnits(guns), from: e.order.from, at: e.order.to,
        killed: SF.describeUnits(killed)
      });
    });

    // 2. Movement and battles.
    var moves = all.filter(function (e) { return e.order.kind !== "bombard"; });
    moves.forEach(function (e) { e.units = unitsOf(e.order); });
    moves = moves.filter(function (e) { return e.units.length; });

    var inTransit = {};
    moves.forEach(function (e) { e.units.forEach(function (u) { inTransit[u.id] = true; }); });
    var retreats = [];   // { units, to }

    function battleEntry(at, attOwner, att, def, outcome, meeting) {
      report.battles.push({
        at: at,
        meeting: meeting,
        attacker: attOwner,
        attWhat: SF.describeUnits(att),
        defWhat: SF.describeUnits(def),
        attLost: SF.describeUnits(outcome.attLost),
        defLost: SF.describeUnits(outcome.defLost),
        result: outcome.result
      });
    }

    // Armies trying to swap squares meet halfway. Survivors go back home.
    moves.forEach(function (a) {
      if (a.done || a.owner !== 0) return;
      moves.forEach(function (b) {
        if (b.done || a.done || b.owner !== 1) return;
        if (a.order.from === b.order.to && a.order.to === b.order.from) {
          var out = SF.fight(a.units, b.units, null, true, rand);
          kill(out.attLost); kill(out.defLost);
          battleEntry(a.order.from + " and " + b.order.from, 0, a.units, b.units, out, true);
          a.done = b.done = true;
          a.units.concat(b.units).forEach(function (u) { delete inTransit[u.id]; });
        }
      });
    });

    // Group the remaining moves by the square they head for.
    var byTarget = {};
    moves.forEach(function (e) {
      if (e.done) return;
      (byTarget[e.order.to] = byTarget[e.order.to] || []).push(e);
    });

    Object.keys(byTarget).sort().forEach(function (target) {
      var incoming = byTarget[target];
      var terrain = SF.sq(target).terrain.key;
      var stay = Object.keys(alive).map(function (id) { return alive[id]; })
        .filter(function (u) { return u.at === target && !inTransit[u.id]; });
      var side = [[], []];
      incoming.forEach(function (e) {
        e.units = e.units.filter(function (u) { return alive[u.id]; });
        side[e.owner].push(e);
      });
      function unitsIn(list) { return list.reduce(function (acc, e) { return acc.concat(e.units); }, []); }
      function arrive(list) {
        list.forEach(function (e) {
          e.units.forEach(function (u) { if (alive[u.id]) u.at = target; });
          report.moves.push({ owner: e.owner, what: SF.describeUnits(e.units), from: e.order.from, to: target });
        });
      }
      function retreat(list) {
        list.forEach(function (e) {
          var back = e.units.filter(function (u) { return alive[u.id]; });
          if (back.length) retreats.push({ owner: e.owner, units: back, to: e.order.from });
        });
      }

      if (stay.length) {
        var defOwner = stay[0].owner, attOwner = 1 - defOwner;
        var attackers = unitsIn(side[attOwner]);
        // Friendly units arriving join the defense.
        arrive(side[defOwner]);
        if (!attackers.length) return;
        var defenders = stay.concat(unitsIn(side[defOwner]));
        var out = SF.fight(attackers, defenders, terrain, false, rand);
        kill(out.attLost); kill(out.defLost);
        battleEntry(target, attOwner, attackers, defenders, out, false);
        if (out.result === "attacker") {
          side[attOwner].forEach(function (e) {
            e.units.forEach(function (u) { if (alive[u.id]) u.at = target; });
          });
        } else {
          retreat(side[attOwner]);
        }
      } else if (side[0].length && side[1].length) {
        var a = unitsIn(side[0]), b = unitsIn(side[1]);
        var meet = SF.fight(a, b, terrain, true, rand);
        kill(meet.attLost); kill(meet.defLost);
        battleEntry(target, 0, a, b, meet, true);
        if (meet.result === "attacker") {
          side[0].forEach(function (e) { e.units.forEach(function (u) { if (alive[u.id]) u.at = target; }); });
        } else if (meet.result === "defender") {
          side[1].forEach(function (e) { e.units.forEach(function (u) { if (alive[u.id]) u.at = target; }); });
        } else {
          retreat(side[0]); retreat(side[1]);
        }
      } else {
        arrive(side[0].length ? side[0] : side[1]);
      }
    });

    // Units falling back to a square the enemy now holds are cut off and lost.
    retreats.forEach(function (r) {
      var held = Object.keys(alive).some(function (id) {
        var u = alive[id];
        return u.at === r.to && u.owner !== r.owner && !inTransitBack(u);
      });
      if (held) {
        kill(r.units);
        report.battles.push({ cutOff: true, owner: r.owner, what: SF.describeUnits(r.units), at: r.to });
      } else {
        r.units.forEach(function (u) { u.at = r.to; });
      }
    });
    function inTransitBack(u) {
      return retreats.some(function (r) { return r.units.indexOf(u) !== -1; });
    }

    state.units = state.units.filter(function (u) { return alive[u.id]; });
    report.remaining = [0, 1].map(function (owner) {
      return state.units.filter(function (u) { return u.owner === owner; }).length;
    });
    state.report = report;
    state.orders = [[], []];
    state.turn += 1;
    return report;
  };
})(window.SF);
