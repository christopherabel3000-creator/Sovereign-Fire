// Sovereign Fire: game rules (setup, vision, movement, battles, turn resolution).
(function (SF) {
  "use strict";

  SF.newGame = function (mode) {
    var state = {
      version: 1,
      mode: mode,          // "computer" or "hotseat"
      turn: 1,
      phase: "setup",      // "setup", "orders" or "handoff"
      afterHandoff: null,  // the phase that follows a handoff
      current: 0,          // whose setup or orders are being entered
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
    SF.initEconomy(state);
    // The computer picks its starting buildings straight away.
    if (mode === "computer") SF.applyPlan(state, 1, SF.defaultPlan(1));
    return state;
  };

  // ---------- Kinds of units ----------

  function isAir(u) { return !!SF.UNIT_TYPES[u.type].air; }
  function isNaval(u) { return !!SF.UNIT_TYPES[u.type].naval; }
  function isCargo(u) { return u.aboard !== undefined && u.aboard !== null; }
  // Ground units that hold the square they are on.
  function isGround(u) { return !isAir(u) && !isNaval(u) && !isCargo(u); }
  // Ships on the water, not docked cargo.
  function isShip(u) { return isNaval(u); }
  SF.isAir = isAir;
  SF.isNaval = isNaval;
  SF.isCargo = isCargo;
  SF.isGround = isGround;

  SF.unitsAt = function (state, id, owner) {
    return state.units.filter(function (u) {
      return u.at === id && (owner === undefined || u.owner === owner);
    });
  };
  SF.groundAt = function (state, id, owner) { return SF.unitsAt(state, id, owner).filter(isGround); };
  SF.shipsAt = function (state, id, owner) { return SF.unitsAt(state, id, owner).filter(isShip); };

  function firstOwner(state, id, test) {
    for (var i = 0; i < state.units.length; i++) {
      var u = state.units[i];
      if (u.at === id && test(u)) return u.owner;
    }
    return null;
  }
  // Who holds a square with ground units, or null.
  SF.occupant = function (state, id) { return firstOwner(state, id, isGround); };
  // Who has ships on a square, or null.
  SF.seaOccupant = function (state, id) { return firstOwner(state, id, isShip); };

  SF.cargoOf = function (state, transport) {
    return state.units.filter(function (u) { return u.aboard === transport.id; });
  };
  SF.cargoSpace = function (u) { return SF.CARGO_SPACE[u.type] || 1; };
  SF.spaceOf = function (units) {
    return units.reduce(function (n, u) { return n + SF.cargoSpace(u); }, 0);
  };
  SF.roomOn = function (state, transport) {
    return SF.UNIT_TYPES.transport.capacity - SF.spaceOf(SF.cargoOf(state, transport));
  };

  SF.orderFor = function (state, unitId) {
    for (var p = 0; p < 2; p++) {
      for (var i = 0; i < state.orders[p].length; i++) {
        var o = state.orders[p][i];
        if (o.unitIds.indexOf(unitId) !== -1) return o;
        if (o.cargoIds && o.cargoIds.indexOf(unitId) !== -1) return o;
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

  function isLand(id) { return SF.sq(id).terrain.key !== "ocean"; }

  // A port city this side holds.
  function ownPort(state, owner, id) {
    var c = state.cities && state.cities[id];
    return !!c && c.owner === owner && c.buildings.port > 0;
  }
  SF.ownPort = ownPort;

  // ---------- Vision ----------

  // close: squares next to your ground units and ships. Only these reveal
  // special forces and submarines.
  // sonar: squares within 2 of your destroyers. These reveal submarines too.
  // wide: close, plus your own land, squares next to cities you hold, and
  // scouted squares.
  SF.vision = function (state, owner) {
    var close = {}, wide = {}, sonar = {};
    state.units.forEach(function (u) {
      if (u.owner !== owner || isAir(u) || isCargo(u)) return;
      around(u.at, 1).forEach(function (id) { close[id] = true; wide[id] = true; });
      var s = SF.UNIT_TYPES[u.type].sonar;
      if (s) around(u.at, s).forEach(function (id) { sonar[id] = true; });
    });
    // Your own land is watched by your people, and cities you hold see the
    // squares around them. Neither reveals special forces.
    SF.allSquares().forEach(function (sq) {
      if (sq.home === owner) wide[sq.id] = true;
      var held = state.cities ? state.cities[sq.id] && state.cities[sq.id].owner === owner :
        sq.terrain.key === "city" && sq.home === owner;
      if (held && SF.occupant(state, sq.id) !== 1 - owner) {
        around(sq.id, 1).forEach(function (id) { wide[id] = true; });
      }
    });
    ((state.scouted || [[], []])[owner] || []).forEach(function (id) { wide[id] = true; });
    return { close: close, wide: wide, sonar: sonar };
  };

  SF.canSee = function (vision, u) {
    if (isCargo(u)) return false;
    if (u.type === "specialForces") return !!vision.close[u.at];
    if (u.type === "submarine") return !!vision.close[u.at] || !!vision.sonar[u.at];
    return !!vision.wide[u.at];
  };

  // Enemy units on a square that this side can see.
  SF.visibleEnemies = function (state, owner, id, vision) {
    vision = vision || SF.vision(state, owner);
    return SF.unitsAt(state, id, 1 - owner).filter(function (u) { return SF.canSee(vision, u); });
  };

  // Who this side believes holds a square, on land ("ground") or at sea ("sea").
  function knownOccupant(state, owner, id, vision, layer) {
    var test = layer === "sea" ? isShip : isGround;
    if (SF.unitsAt(state, id, owner).some(test)) return owner;
    return SF.visibleEnemies(state, owner, id, vision).some(test) ? 1 - owner : null;
  }
  SF.knownOccupant = function (state, owner, id, vision, layer) {
    return knownOccupant(state, owner, id, vision || SF.vision(state, owner), layer || "ground");
  };

  // ---------- Movement ----------

  // Own transports on a square with at least this much room.
  function transportsWithRoom(state, owner, id, space) {
    return SF.shipsAt(state, id, owner).filter(function (t) {
      return t.type === "transport" && SF.roomOn(state, t) >= space;
    });
  }

  // Squares one unit can reach this turn, as far as its side knows. Enemy
  // squares it can see can be attacked but not moved through. Hidden enemies
  // are not known, so a move onto their square becomes a surprise battle.
  function reachUnit(state, owner, u, vision, groupSpace) {
    var t = SF.UNIT_TYPES[u.type];
    var best = {};
    var fromId = u.at;

    // Units aboard a transport can only land on a square next to it.
    if (isCargo(u)) {
      SF.neighbors(SF.sq(fromId)).forEach(function (n) {
        if (!isLand(n.id)) return;
        if (n.terrain.key === "river" && !t.crossRiver) return;
        best[n.id] = 0;
      });
      return best;
    }

    var naval = !!t.naval;
    best[fromId] = t.move;
    var queue = [fromId];
    while (queue.length) {
      var id = queue.shift();
      var rem = best[id];
      if (rem <= 0) continue;
      SF.neighbors(SF.sq(id)).forEach(function (n) {
        var key = n.terrain.key;
        if (naval) {
          if (key !== "ocean") {
            // Ships can dock in a port city you hold, which ends their move.
            if (ownPort(state, owner, n.id) && best[n.id] === undefined) best[n.id] = 0;
            return;
          }
          var seaOcc = knownOccupant(state, owner, n.id, vision, "sea");
          if (seaOcc !== null && seaOcc !== owner) {
            if (best[n.id] === undefined) best[n.id] = 0;
            return;
          }
          var leftSea = rem - 1;
          if (best[n.id] === undefined || leftSea > best[n.id]) {
            best[n.id] = leftSea;
            queue.push(n.id);
          }
          return;
        }
        if (key === "ocean") {
          // Ground units can board your transport on a square next to them.
          if (id === fromId && transportsWithRoom(state, owner, n.id, groupSpace).length &&
              best[n.id] === undefined) best[n.id] = 0;
          return;
        }
        if (key === "river" && !t.crossRiver) return;
        var occ = knownOccupant(state, owner, n.id, vision, "ground");
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

  // Squares a group of units can all reach, nearest first.
  SF.reachable = function (state, owner, units) {
    units = units.filter(function (u) { return !isAir(u); });
    if (!units.length) return [];
    var fromId = units[0].at;
    var vision = SF.vision(state, owner);
    var space = SF.spaceOf(units.filter(function (u) { return !isNaval(u); }));
    var seen = {};
    var maps = [];
    units.forEach(function (u) {
      var key = u.type + (isCargo(u) ? "*" : "");
      if (seen[key]) return;
      seen[key] = true;
      maps.push(reachUnit(state, owner, u, vision, space));
    });
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
    if (!units.length || units.length !== unitIds.length) throw new Error("No units");
    var from = units[0].at;
    units.forEach(function (u) {
      if (u.owner !== owner || u.at !== from) throw new Error("Bad order");
      if (SF.orderFor(state, u.id)) throw new Error("Unit already has orders");
    });
    return units;
  }

  // A ground move: march, attack, board a transport, or land from one.
  SF.addOrder = function (state, owner, unitIds, to) {
    var units = checkUnits(state, owner, unitIds);
    units.forEach(function (u) { if (isAir(u) || isNaval(u)) throw new Error("Not a ground unit"); });
    var from = units[0].at;
    if (SF.reachable(state, owner, units).indexOf(to) === -1) throw new Error("Out of reach");
    var order = { id: state.nextOrderId++, kind: "move", unitIds: unitIds.slice(), from: from, to: to };
    state.orders[owner].push(order);
    return order;
  };

  // Land squares next to an ocean square that troops could land on.
  SF.landingSquares = function (oceanId) {
    return SF.neighbors(SF.sq(oceanId)).filter(function (n) { return isLand(n.id); })
      .map(function (n) { return n.id; });
  };

  // A sea move. Transports can load ground units in the port they leave
  // (cargoIds), and land everything aboard next to where they stop (landAt).
  SF.addSail = function (state, owner, shipIds, to, cargoIds, landAt) {
    var ships = checkUnits(state, owner, shipIds);
    ships.forEach(function (u) { if (!isNaval(u)) throw new Error("Not a ship"); });
    if (state.econ[owner].noFuel) throw new Error("Out of gasoline");
    var from = ships[0].at;
    if (SF.reachable(state, owner, ships).indexOf(to) === -1) throw new Error("Out of reach");
    cargoIds = cargoIds || [];
    var transports = ships.filter(function (u) { return u.type === "transport"; });
    var cargo = [];
    if (cargoIds.length) {
      if (!transports.length) throw new Error("Only transports carry troops");
      cargo = checkUnits(state, owner, cargoIds);
      cargo.forEach(function (u) { if (!isGround(u) || u.at !== from) throw new Error("Cannot load that unit"); });
      var room = transports.reduce(function (n, t) { return n + SF.roomOn(state, t); }, 0);
      if (SF.spaceOf(cargo) > room) throw new Error("Not enough room on the transports");
    }
    if (landAt) {
      var aboard = transports.reduce(function (acc, t) { return acc.concat(SF.cargoOf(state, t)); }, []).concat(cargo);
      if (!aboard.length) throw new Error("No troops aboard to land");
      if (SF.sq(to).terrain.key !== "ocean" || SF.landingSquares(to).indexOf(landAt) === -1) throw new Error("Cannot land there");
      if (SF.sq(landAt).terrain.key === "river" && aboard.some(function (u) { return !SF.UNIT_TYPES[u.type].crossRiver; })) {
        throw new Error("Tanks cannot land on a river square");
      }
    }
    var order = {
      id: state.nextOrderId++, kind: "sail", unitIds: shipIds.slice(), from: from, to: to,
      cargoIds: cargoIds.slice(), landAt: landAt || null
    };
    state.orders[owner].push(order);
    return order;
  };

  // Enemy squares that artillery or destroyers can see and fire at.
  SF.bombardTargets = function (state, owner, fromId, type) {
    var range = SF.UNIT_TYPES[type].bombardRange;
    var vision = SF.vision(state, owner);
    return SF.allSquares().filter(function (sq) {
      return isLand(sq.id) && distance(fromId, sq.id) <= range &&
        knownOccupant(state, owner, sq.id, vision, "ground") === 1 - owner;
    }).map(function (sq) { return sq.id; }).sort(function (a, b) {
      return distance(fromId, a) - distance(fromId, b);
    });
  };

  SF.addBombard = function (state, owner, unitIds, target) {
    var units = checkUnits(state, owner, unitIds);
    var type = units[0].type;
    units.forEach(function (u) {
      if (u.type !== type || !SF.UNIT_TYPES[type].bombardRange) throw new Error("Those units cannot bombard");
    });
    if (isNaval(units[0]) && state.econ[owner].noFuel) throw new Error("Out of gasoline");
    if (SF.bombardTargets(state, owner, units[0].at, type).indexOf(target) === -1) throw new Error("Out of range");
    var order = { id: state.nextOrderId++, kind: "bombard", unitIds: unitIds.slice(), from: units[0].at, to: target };
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
    if (state.econ[owner].gasoline < SF.SCOUT_GAS) throw new Error("Not enough gasoline");
    state.econ[owner].gasoline -= SF.SCOUT_GAS;
    var order = { id: state.nextOrderId++, kind: "scout", unitIds: [planeId], from: from, to: target, gas: SF.SCOUT_GAS };
    state.orders[owner].push(order);
    return order;
  };

  SF.cancelOrder = function (state, owner, orderId) {
    state.orders[owner].forEach(function (o) {
      if (o.id === orderId && o.gas) state.econ[owner].gasoline += o.gas;
    });
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

  function huntBonus(u, foes) {
    var hunts = SF.UNIT_TYPES[u.type].hunts;
    if (!hunts) return 0;
    return foes.some(function (f) { return hunts.indexOf(f.type) !== -1; }) ? SF.HUNT_BONUS : 0;
  }

  function attackValue(u, terrain, foes, landing) {
    var v = SF.UNIT_TYPES[u.type].attack + huntBonus(u, foes);
    if (u.type === "tank" && terrain) v += SF.TANK_ATTACK[terrain] || 0;
    if (landing && landing[u.id]) v -= SF.LANDING_PENALTY;
    return v;
  }

  function defenseValue(u, terrain, foes) {
    var t = SF.UNIT_TYPES[u.type];
    var v = t.defense + (SF.DEFENSE_BONUS[terrain] || 0) + huntBonus(u, foes);
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
  // attackers. landing marks attacking unit ids that came ashore from the sea.
  SF.fight = function (attackers, defenders, terrain, meeting, rand, landing) {
    rand = rand || Math.random;
    var att = attackers.slice(), def = defenders.slice();
    var attLost = [], defLost = [];
    for (var round = 0; round < SF.BATTLE_ROUNDS && att.length && def.length; round++) {
      var attHits = 0, defHits = 0;
      att.forEach(function (u) { if (rand() < hitChance(attackValue(u, terrain, def, landing))) attHits++; });
      def.forEach(function (u) {
        var v = meeting ? attackValue(u, terrain, att) : defenseValue(u, terrain, att);
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

  // Chance, as a whole percent, that these units take the target square from
  // the enemy units this side can see there. landing: they come from the sea.
  SF.attackOdds = function (state, owner, units, target, landing, rand) {
    var sea = !isLand(target);
    var defenders = SF.visibleEnemies(state, owner, target).filter(sea ? isShip : isGround);
    var terrain = SF.sq(target).terrain.key;
    var marks = null;
    if (landing) {
      marks = {};
      units.forEach(function (u) { marks[u.id] = true; });
    }
    var wins = 0, runs = 400;
    for (var i = 0; i < runs; i++) {
      if (SF.fight(units, defenders, terrain, false, rand, marks).result === "attacker") wins++;
    }
    // Nothing is ever certain, so never show 0% or 100%.
    return Math.min(99, Math.max(1, Math.round((wins / runs) * 100)));
  };

  SF.bombardChance = function (target, type) {
    var terrain = SF.sq(target).terrain.key;
    var base = type === "destroyer" ? SF.SHORE_BOMBARD_CHANCE : SF.BOMBARD_CHANCE;
    return Math.max(0.05, base - (SF.BOMBARD_TERRAIN[terrain] || 0));
  };

  // The computer opponent. For now it only defends, so it gives no orders.
  SF.computerOrders = function (state) {
    state.orders[1] = [];
    SF.computerEconomy(state);
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
    function living() { return Object.keys(alive).map(function (id) { return alive[id]; }); }
    // Losing a transport loses everything aboard.
    function kill(units) {
      units.forEach(function (u) {
        if (!alive[u.id]) return;
        delete alive[u.id];
        if (u.type === "transport") {
          var aboard = living().filter(function (c) { return c.aboard === u.id; });
          if (aboard.length) {
            kill(aboard);
            events.push({ type: "cargoLost", owner: u.owner, at: u.at, what: SF.describeUnits(aboard) });
          }
        }
      });
    }

    var all = [];
    [0, 1].forEach(function (owner) {
      state.orders[owner].forEach(function (o) { all.push({ owner: owner, order: o }); });
    });

    // 1. Artillery and destroyers fire first.
    all.filter(function (e) { return e.order.kind === "bombard"; }).forEach(function (e) {
      var guns = unitsOf(e.order);
      if (!guns.length) return;
      var killed = [];
      guns.forEach(function (g) {
        var targets = living().filter(function (u) {
          return u.at === e.order.to && u.owner !== e.owner && isGround(u);
        });
        if (!targets.length) return;
        if (rand() < SF.bombardChance(e.order.to, g.type)) {
          var hit = targets[Math.floor(rand() * targets.length)];
          killed.push(hit);
          kill([hit]);
        }
      });
      events.push({
        type: "bombard", owner: e.owner, what: SF.describeUnits(guns), from: e.order.from,
        at: e.order.to, killed: SF.describeUnits(killed), naval: isNaval(guns[0])
      });
    });

    function battleEvent(at, attOwner, att, def, outcome, meeting, landing) {
      events.push({
        type: "battle",
        at: at,
        meeting: meeting,
        landing: !!landing,
        sea: !isLand(at.split(" ")[0]),
        attacker: attOwner,
        attWhat: SF.describeUnits(att),
        defWhat: SF.describeUnits(def),
        attLost: SF.describeUnits(outcome.attLost),
        defLost: SF.describeUnits(outcome.defLost),
        result: outcome.result
      });
    }

    // Moves on one layer, land or sea, all at once. Each entry is
    // { owner, units, from, to, landing }. Returns retreats to resolve later.
    function resolveLayer(entries, holds, onArrive) {
      var inTransit = {};
      entries.forEach(function (e) {
        e.units = e.units.filter(function (u) { return alive[u.id]; });
        e.units.forEach(function (u) { inTransit[u.id] = true; });
      });
      entries = entries.filter(function (e) { return e.units.length; });
      var retreats = [];

      // Forces trying to swap squares meet halfway. Survivors go back.
      entries.forEach(function (a) {
        if (a.done || a.owner !== 0 || a.landing) return;
        entries.forEach(function (b) {
          if (b.done || a.done || b.owner !== 1 || b.landing) return;
          if (a.from === b.to && a.to === b.from) {
            var out = SF.fight(a.units, b.units, null, true, rand);
            kill(out.attLost); kill(out.defLost);
            battleEvent(a.from + " and " + b.from, 0, a.units, b.units, out, true);
            a.done = b.done = true;
            a.units.concat(b.units).forEach(function (u) { delete inTransit[u.id]; });
          }
        });
      });

      var byTarget = {};
      entries.forEach(function (e) {
        if (e.done) return;
        (byTarget[e.to] = byTarget[e.to] || []).push(e);
      });

      Object.keys(byTarget).sort().forEach(function (target) {
        var terrain = SF.sq(target).terrain.key;
        var stay = living().filter(function (u) { return u.at === target && !inTransit[u.id] && holds(u); });
        var side = [[], []];
        byTarget[target].forEach(function (e) {
          e.units = e.units.filter(function (u) { return alive[u.id]; });
          if (e.units.length) side[e.owner].push(e);
        });
        function unitsIn(list) { return list.reduce(function (acc, x) { return acc.concat(x.units); }, []); }
        function landingMarks(list) {
          var m = {};
          list.forEach(function (x) { if (x.landing) x.units.forEach(function (u) { m[u.id] = true; }); });
          return m;
        }
        function place(list, quiet) {
          list.forEach(function (x) {
            var arrived = x.units.filter(function (u) { return alive[u.id]; });
            arrived.forEach(function (u) { onArrive(u, target, x); });
            if (!quiet && arrived.length) {
              events.push({
                type: "move", owner: x.owner, what: SF.describeUnits(arrived), from: x.from, to: target,
                landing: !!x.landing, unitIds: arrived.map(function (u) { return u.id; })
              });
            }
          });
        }
        function retreat(list) {
          list.forEach(function (x) {
            // Troops that fail to land stay aboard their transport.
            if (x.landing) return;
            var back = x.units.filter(function (u) { return alive[u.id]; });
            if (back.length) retreats.push({ owner: x.owner, units: back, to: x.from });
          });
        }

        if (stay.length) {
          var defOwner = stay[0].owner, attOwner = 1 - defOwner;
          var attackers = unitsIn(side[attOwner]);
          // Friendly units arriving join the defense.
          place(side[defOwner]);
          if (!attackers.length) return;
          var defenders = stay.concat(unitsIn(side[defOwner]));
          var landingAll = side[attOwner].every(function (x) { return x.landing; });
          var out = SF.fight(attackers, defenders, terrain, false, rand, landingMarks(side[attOwner]));
          kill(out.attLost); kill(out.defLost);
          battleEvent(target, attOwner, attackers, defenders, out, false, landingAll);
          if (out.result === "attacker") place(side[attOwner], true);
          else retreat(side[attOwner]);
        } else if (side[0].length && side[1].length) {
          var a = unitsIn(side[0]), b = unitsIn(side[1]);
          var meet = SF.fight(a, b, terrain, true, rand);
          kill(meet.attLost); kill(meet.defLost);
          battleEvent(target, 0, a, b, meet, true);
          if (meet.result === "attacker") { place(side[0], true); retreat(side[1]); }
          else if (meet.result === "defender") { place(side[1], true); retreat(side[0]); }
          else { retreat(side[0]); retreat(side[1]); }
        } else {
          place(side[0].length ? side[0] : side[1]);
        }
      });
      return retreats;
    }

    function settleRetreats(retreats, holds) {
      function retreating(u) { return retreats.some(function (r) { return r.units.indexOf(u) !== -1; }); }
      retreats.forEach(function (r) {
        var held = living().some(function (u) {
          return u.at === r.to && u.owner !== r.owner && holds(u) && !retreating(u);
        });
        if (held) {
          kill(r.units);
          events.push({ type: "cutOff", owner: r.owner, what: SF.describeUnits(r.units), at: r.to });
        } else {
          r.units.forEach(function (u) { u.at = r.to; });
        }
      });
    }

    // 2. Transports load troops in the port they leave.
    var sails = all.filter(function (e) { return e.order.kind === "sail"; });
    sails.forEach(function (e) {
      var transports = unitsOf(e.order).filter(function (u) { return u.type === "transport"; });
      (e.order.cargoIds || []).forEach(function (id) {
        var u = alive[id];
        if (!u || u.at !== e.order.from || !isGround(u)) return;
        var t = transports.filter(function (x) { return SF.roomOn(state, x) >= SF.cargoSpace(u); })[0];
        if (t) u.aboard = t.id;
      });
    });

    // 3. Ships sail and fight. Cargo goes wherever its transport goes.
    function moveShip(u, target) {
      u.at = target;
      living().forEach(function (c) { if (c.aboard === u.id) c.at = target; });
    }
    var seaRetreats = resolveLayer(sails.map(function (e) {
      return { owner: e.owner, units: unitsOf(e.order), from: e.order.from, to: e.order.to, order: e.order };
    }), isShip, moveShip);
    seaRetreats.forEach(function (r) { r.units.forEach(function (u) { moveShip(u, r.to); }); });
    // A fleet driven back can never be cut off at sea, so it simply returns.
    // Troops on a transport that is in port go ashore there.
    living().forEach(function (c) {
      if (isCargo(c) && isLand(c.at)) c.aboard = null;
    });

    // 4. Ground moves, landings, and boarding.
    var groundEntries = [];
    sails.forEach(function (e) {
      if (!e.order.landAt) return;
      var transports = unitsOf(e.order).filter(function (u) { return u.type === "transport" && u.at === e.order.to; });
      var aboard = living().filter(function (c) {
        return transports.some(function (t) { return c.aboard === t.id; });
      });
      if (aboard.length) {
        groundEntries.push({ owner: e.owner, units: aboard, from: e.order.to, to: e.order.landAt, landing: true });
      }
    });
    all.filter(function (e) { return e.order.kind === "move"; }).forEach(function (e) {
      var units = unitsOf(e.order);
      if (!units.length) return;
      var landing = units.some(isCargo);
      if (!isLand(e.order.to)) {
        // Boarding a transport at sea.
        var space = SF.spaceOf(units);
        var t = transportsWithRoom(state, e.owner, e.order.to, space)[0];
        if (t && !SF.orderFor(state, t.id)) {
          units.forEach(function (u) { u.at = e.order.to; u.aboard = t.id; });
          events.push({ type: "boarded", owner: e.owner, what: SF.describeUnits(units), at: e.order.to });
        } else {
          events.push({ type: "boardFailed", owner: e.owner, what: SF.describeUnits(units), at: e.order.to });
        }
        return;
      }
      groundEntries.push({ owner: e.owner, units: units, from: e.order.from, to: e.order.to, landing: landing });
    });
    var landRetreats = resolveLayer(groundEntries, isGround, function (u, target) {
      u.at = target;
      u.aboard = null;
    });
    settleRetreats(landRetreats, isGround);

    // 5. Planes and docked ships in a city the enemy now holds are destroyed.
    var lostByPlace = {};
    living().forEach(function (u) {
      if (!(isAir(u) || isNaval(u)) || !isLand(u.at)) return;
      var enemyThere = living().some(function (g) { return g.at === u.at && g.owner !== u.owner && isGround(g); });
      if (!enemyThere) return;
      var key = u.owner + "@" + u.at;
      (lostByPlace[key] = lostByPlace[key] || { owner: u.owner, at: u.at, units: [] }).units.push(u);
    });
    Object.keys(lostByPlace).forEach(function (k) {
      var g = lostByPlace[k];
      kill(g.units);
      events.push({ type: "planesLost", owner: g.owner, at: g.at, what: SF.describeUnits(g.units) });
    });

    // 6. Scout planes fly after the fighting, so they see where armies ended up.
    all.filter(function (e) { return e.order.kind === "scout"; }).forEach(function (e) {
      var plane = unitsOf(e.order)[0];
      if (!plane) return;
      var area = around(e.order.to, SF.SCOUT_RADIUS);
      var guns = living().filter(function (u) {
        return u.type === "antiAir" && u.owner !== e.owner && area.indexOf(u.at) !== -1 && !isCargo(u);
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

    // 7. Economy: cities change hands, production finishes, income comes in.
    SF.updateCityOwners(state, events);
    SF.advanceProjects(state, events);
    SF.collectIncome(state, events);

    state.report = { turn: state.turn, mode: state.mode, events: events };
    state.orders = [[], []];
    state.turn += 1;
    return state.report;
  };
})(window.SF);
