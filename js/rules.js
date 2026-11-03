// Sovereign Fire: game rules (setup, vision, movement, battles, turn resolution).
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
      scouted: [[], []],   // squares each side's scout planes saw last turn
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

  function isAir(u) { return !!SF.UNIT_TYPES[u.type].air; }
  SF.isAir = isAir;

  SF.unitsAt = function (state, id, owner) {
    return state.units.filter(function (u) {
      return u.at === id && (owner === undefined || u.owner === owner);
    });
  };

  SF.groundAt = function (state, id, owner) {
    return SF.unitsAt(state, id, owner).filter(function (u) { return !isAir(u); });
  };

  // Who has ground units on a square right now, or null. Planes in a city
  // do not hold it.
  SF.occupant = function (state, id) {
    for (var i = 0; i < state.units.length; i++) {
      var u = state.units[i];
      if (u.at === id && !isAir(u)) return u.owner;
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
  SF.distance = distance;

  // Squares within r steps, diagonals counting as one step.
  function around(id, r) {
    var c = SF.sq(id), out = [];
    for (var dr = -r; dr <= r; dr++) {
      for (var dc = -r; dc <= r; dc++) {
        var nr = c.row + dr, nc = c.col + dc;
        if (nr >= 0 && nr < SF.SIZE && nc >= 0 && nc < SF.SIZE) out.push(SF.grid[nr][nc].id);
      }
    }
    return out;
  }
  SF.around = around;

  // ---------- Vision ----------

  // close: squares next to your ground units. Only these reveal special forces.
  // wide: close, plus your own land, squares next to cities you hold, and
  // scouted squares.
  SF.vision = function (state, owner) {
    var close = {}, wide = {};
    state.units.forEach(function (u) {
      if (u.owner !== owner || isAir(u)) return;
      around(u.at, 1).forEach(function (id) { close[id] = true; wide[id] = true; });
    });
    // Your own land is watched by your people, and cities you hold see the
    // squares around them. Neither reveals special forces.
    SF.allSquares().forEach(function (sq) {
      if (sq.home === owner) wide[sq.id] = true;
      if (sq.terrain.key === "city" && sq.home === owner && SF.occupant(state, sq.id) !== 1 - owner) {
        around(sq.id, 1).forEach(function (id) { wide[id] = true; });
      }
    });
    ((state.scouted || [[], []])[owner] || []).forEach(function (id) { wide[id] = true; });
    return { close: close, wide: wide };
  };

  SF.canSee = function (vision, u) {
    return u.type === "specialForces" ? !!vision.close[u.at] : !!vision.wide[u.at];
  };

  // Enemy units on a square that this side can see.
  SF.visibleEnemies = function (state, owner, id, vision) {
    vision = vision || SF.vision(state, owner);
    return SF.unitsAt(state, id, 1 - owner).filter(function (u) { return SF.canSee(vision, u); });
  };

  // Who this side believes holds a square with ground units.
  function knownOccupant(state, owner, id, vision) {
    if (SF.groundAt(state, id, owner).length) return owner;
    var seen = SF.visibleEnemies(state, owner, id, vision).filter(function (u) { return !isAir(u); });
    return seen.length ? 1 - owner : null;
  }
  SF.knownOccupant = knownOccupant;

  // ---------- Movement ----------

  // Squares one unit type can reach this turn, as far as this side knows.
  // Enemy squares it can see can be attacked but not moved through. Hidden
  // enemies are not known, so a move onto their square becomes a surprise battle.
  function reachType(state, owner, fromId, type, vision) {
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
        var occ = knownOccupant(state, owner, n.id, vision);
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
    types = types.filter(function (t) { return !SF.UNIT_TYPES[t].air; });
    if (!types.length) return [];
    var vision = SF.vision(state, owner);
    var maps = types.map(function (type) { return reachType(state, owner, fromId, type, vision); });
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
    units.forEach(function (u) { if (isAir(u)) throw new Error("Planes do not move like ground units"); });
    var from = units[0].at;
    if (SF.reachable(state, owner, from, typesOf(units)).indexOf(to) === -1) throw new Error("Out of reach");
    var order = { id: state.nextOrderId++, kind: "move", unitIds: unitIds.slice(), from: from, to: to };
    state.orders[owner].push(order);
    return order;
  };

  // Enemy squares artillery can see and fire at from a square.
  SF.bombardTargets = function (state, owner, fromId) {
    var range = SF.UNIT_TYPES.artillery.bombardRange;
    var vision = SF.vision(state, owner);
    return SF.allSquares().filter(function (sq) {
      return distance(fromId, sq.id) <= range &&
        knownOccupant(state, owner, sq.id, vision) === 1 - owner;
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

  SF.canScout = function (fromId, target) {
    return !!SF.sq(target) && distance(fromId, target) <= SF.SCOUT_RANGE;
  };

  SF.addScout = function (state, owner, planeId, target) {
    var units = checkUnits(state, owner, [planeId]);
    if (units[0].type !== "scoutPlane") throw new Error("Only scout planes scout");
    var from = units[0].at;
    if (!SF.canScout(from, target)) throw new Error("Out of range");
    var order = { id: state.nextOrderId++, kind: "scout", unitIds: [planeId], from: from, to: target };
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
  // from the enemy units this side can see there.
  SF.attackOdds = function (state, owner, units, target, rand) {
    var defenders = SF.visibleEnemies(state, owner, target).filter(function (u) { return !isAir(u); });
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

  // Produces a list of events. Each side's screen shows only the events,
  // and the parts of them, that side would know about.
  SF.resolveTurn = function (state, rand) {
    rand = rand || Math.random;
    var events = [];
    var alive = {};
    state.units.forEach(function (u) { alive[u.id] = u; });
    state.scouted = [[], []];

    function unitsOf(order) {
      return order.unitIds.map(function (id) { return alive[id]; }).filter(Boolean);
    }
    function kill(units) { units.forEach(function (u) { delete alive[u.id]; }); }
    function living() { return Object.keys(alive).map(function (id) { return alive[id]; }); }

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
        var targets = living().filter(function (u) {
          return u.at === e.order.to && u.owner !== e.owner && !isAir(u);
        });
        if (!targets.length) return;
        if (rand() < SF.bombardChance(e.order.to)) {
          var hit = targets[Math.floor(rand() * targets.length)];
          killed.push(hit);
          delete alive[hit.id];
        }
      });
      events.push({
        type: "bombard", owner: e.owner, what: SF.describeUnits(guns), from: e.order.from,
        at: e.order.to, killed: SF.describeUnits(killed)
      });
    });

    // 2. Ground movement and battles.
    var moves = all.filter(function (e) { return e.order.kind === "move"; });
    moves.forEach(function (e) { e.units = unitsOf(e.order); });
    moves = moves.filter(function (e) { return e.units.length; });

    var inTransit = {};
    moves.forEach(function (e) { e.units.forEach(function (u) { inTransit[u.id] = true; }); });
    var retreats = [];   // { owner, units, to }

    function battleEvent(at, attOwner, att, def, outcome, meeting) {
      events.push({
        type: "battle",
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
          battleEvent(a.order.from + " and " + b.order.from, 0, a.units, b.units, out, true);
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
      var stay = living().filter(function (u) { return u.at === target && !inTransit[u.id] && !isAir(u); });
      var side = [[], []];
      incoming.forEach(function (e) {
        e.units = e.units.filter(function (u) { return alive[u.id]; });
        side[e.owner].push(e);
      });
      function unitsIn(list) { return list.reduce(function (acc, e) { return acc.concat(e.units); }, []); }
      function place(list) {
        list.forEach(function (e) { e.units.forEach(function (u) { if (alive[u.id]) u.at = target; }); });
      }
      function arrive(list) {
        place(list);
        list.forEach(function (e) {
          events.push({
            type: "move", owner: e.owner, what: SF.describeUnits(e.units), from: e.order.from, to: target,
            unitIds: e.units.map(function (u) { return u.id; })
          });
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
        battleEvent(target, attOwner, attackers, defenders, out, false);
        if (out.result === "attacker") place(side[attOwner]);
        else retreat(side[attOwner]);
      } else if (side[0].length && side[1].length) {
        var a = unitsIn(side[0]), b = unitsIn(side[1]);
        var meet = SF.fight(a, b, terrain, true, rand);
        kill(meet.attLost); kill(meet.defLost);
        battleEvent(target, 0, a, b, meet, true);
        if (meet.result === "attacker") { place(side[0]); retreat(side[1]); }
        else if (meet.result === "defender") { place(side[1]); retreat(side[0]); }
        else { retreat(side[0]); retreat(side[1]); }
      } else {
        arrive(side[0].length ? side[0] : side[1]);
      }
    });

    // Units falling back to a square the enemy now holds are cut off and lost.
    function retreating(u) {
      return retreats.some(function (r) { return r.units.indexOf(u) !== -1; });
    }
    retreats.forEach(function (r) {
      var held = living().some(function (u) {
        return u.at === r.to && u.owner !== r.owner && !isAir(u) && !retreating(u);
      });
      if (held) {
        kill(r.units);
        events.push({ type: "cutOff", owner: r.owner, what: SF.describeUnits(r.units), at: r.to });
      } else {
        r.units.forEach(function (u) { u.at = r.to; });
      }
    });

    // 3. Planes in a city the enemy now holds are destroyed on the ground.
    var lostByPlace = {};
    living().forEach(function (u) {
      if (!isAir(u)) return;
      var enemyThere = living().some(function (g) { return g.at === u.at && g.owner !== u.owner && !isAir(g); });
      if (!enemyThere) return;
      var key = u.owner + "@" + u.at;
      (lostByPlace[key] = lostByPlace[key] || { owner: u.owner, at: u.at, units: [] }).units.push(u);
    });
    Object.keys(lostByPlace).forEach(function (k) {
      var g = lostByPlace[k];
      kill(g.units);
      events.push({ type: "planesLost", owner: g.owner, at: g.at, what: SF.describeUnits(g.units) });
    });

    // 4. Scout planes fly after the fighting, so they see where armies ended up.
    all.filter(function (e) { return e.order.kind === "scout"; }).forEach(function (e) {
      var plane = unitsOf(e.order)[0];
      if (!plane) return;
      var area = around(e.order.to, SF.SCOUT_RADIUS);
      var guns = living().filter(function (u) {
        return u.type === "antiAir" && u.owner !== e.owner && area.indexOf(u.at) !== -1;
      });
      var shot = guns.some(function () { return rand() < SF.SCOUT_AA_CHANCE; });
      if (shot) {
        kill([plane]);
      } else {
        area.forEach(function (id) {
          if (state.scouted[e.owner].indexOf(id) === -1) state.scouted[e.owner].push(id);
        });
      }
      events.push({ type: "scout", owner: e.owner, from: e.order.from, at: e.order.to, shotDown: shot });
    });

    state.units = state.units.filter(function (u) { return alive[u.id]; });
    state.report = { turn: state.turn, mode: state.mode, events: events };
    state.orders = [[], []];
    state.turn += 1;
    return state.report;
  };
})(window.SF);
