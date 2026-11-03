// Sovereign Fire: game rules (setup, vision, movement, battles, turn resolution).
(function (SF) {
  "use strict";

  SF.newGame = function (mode, difficulty) {
    var state = {
      version: 1,
      mode: mode,          // "computer" or "hotseat"
      difficulty: difficulty || "normal",
      turn: 1,
      phase: "setup",      // "setup", "orders" or "handoff"
      afterHandoff: null,  // the phase that follows a handoff
      current: 0,          // whose setup or orders are being entered
      nextUnitId: 1,
      units: [],
      orders: [[], []],
      nextOrderId: 1,
      scouted: [[], []],   // squares each side's scout planes saw last turn
      brokenBridges: [],   // bridges destroyed by bombing, until engineers rebuild them
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
    SF.initNations(state);
    // The computer picks its nation and starting buildings straight away.
    if (mode === "computer") {
      var gov = SF.GOVERNMENT_ORDER[Math.floor(Math.random() * SF.GOVERNMENT_ORDER.length)];
      SF.setNation(state, 1, SF.randomNationName(gov), gov);
      SF.applyPlan(state, 1, SF.computerPlan(1, gov));
    }
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

  // Troops aboard a transport.
  SF.cargoOf = function (state, transport) {
    return state.units.filter(function (u) { return u.aboard === transport.id && !isAir(u); });
  };
  // Planes aboard a carrier.
  SF.planesOn = function (state, carrier) {
    return state.units.filter(function (u) { return u.aboard === carrier.id && isAir(u); });
  };
  SF.carrierRoom = function (state, carrier) {
    return SF.UNIT_TYPES.carrier.planes - SF.planesOn(state, carrier).length;
  };

  // Terrain as it is now: a bombed-out bridge is a river until rebuilt.
  SF.terrainAt = function (state, id) {
    var key = SF.sq(id).terrain.key;
    if (key === "bridge" && (state.brokenBridges || []).indexOf(id) !== -1) return "river";
    return key;
  };
  // A square hit by a nuclear weapon, for a while afterwards.
  SF.radioactive = function (state, id) {
    return !!(state.fallout && state.fallout[id] && state.fallout[id] >= state.turn);
  };

  SF.bridgeBroken = function (state, id) {
    return SF.sq(id).terrain.key === "bridge" && (state.brokenBridges || []).indexOf(id) !== -1;
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
      var s = SF.stat(state, owner, u.type, "sonar");
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
    // Scouted squares and satellite watch areas. With deep cover agents,
    // these also reveal special forces and submarines.
    var deep = {}, agents = SF.effect(state, owner, "deepCover") > 0;
    function far(id) { wide[id] = true; if (agents) deep[id] = true; }
    ((state.scouted || [[], []])[owner] || []).forEach(far);
    if (state.econ) {
      SF.satellites(state, owner).forEach(function (sat) { around(sat.watch, SF.SATELLITE_RADIUS).forEach(far); });
    }
    return { close: close, wide: wide, sonar: sonar, deep: deep };
  };

  SF.canSee = function (vision, u) {
    if (isCargo(u)) return false;
    var deep = vision.deep && vision.deep[u.at];
    if (u.type === "specialForces") return !!vision.close[u.at] || !!deep;
    if (u.type === "submarine") return !!vision.close[u.at] || !!vision.sonar[u.at] || !!deep;
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
        if (!isLand(n.id) || SF.radioactive(state, n.id)) return;
        if (SF.terrainAt(state, n.id) === "river" && !t.crossRiver) return;
        best[n.id] = 0;
      });
      return best;
    }

    var naval = !!t.naval;
    best[fromId] = SF.stat(state, owner, u.type, "move");
    var queue = [fromId];
    while (queue.length) {
      var id = queue.shift();
      var rem = best[id];
      if (rem <= 0) continue;
      SF.neighbors(SF.sq(id)).forEach(function (n) {
        var key = SF.terrainAt(state, n.id);
        if (SF.radioactive(state, n.id)) return;
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
      if (SF.sq(to).terrain.key !== "ocean" || SF.landingSquares(to).indexOf(landAt) === -1 ||
          SF.radioactive(state, landAt)) throw new Error("Cannot land there");
      if (SF.terrainAt(state, landAt) === "river" && aboard.some(function (u) { return !SF.UNIT_TYPES[u.type].crossRiver; })) {
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
    if (SF.bombardTargets(state, owner, units[0].at, type).indexOf(target) === -1) throw new Error("Out of range");
    var order = { id: state.nextOrderId++, kind: "bombard", unitIds: unitIds.slice(), from: units[0].at, to: target };
    state.orders[owner].push(order);
    return order;
  };

  SF.canScout = function (state, owner, fromId, target) {
    return !!SF.sq(target) && distance(fromId, target) <= SF.stat(state, owner, "scoutPlane", "range");
  };

  SF.addScout = function (state, owner, planeId, target) {
    var units = checkUnits(state, owner, [planeId]);
    if (units[0].type !== "scoutPlane") throw new Error("Only scout planes scout");
    var from = units[0].at;
    if (!SF.canScout(state, owner, from, target)) throw new Error("Out of range");
    var order = { id: state.nextOrderId++, kind: "scout", unitIds: [planeId], from: from, to: target };
    state.orders[owner].push(order);
    return order;
  };

  // ---------- Air missions ----------

  function planeGroup(state, owner, ids, type) {
    var planes = checkUnits(state, owner, ids);
    planes.forEach(function (u) {
      if (!isAir(u) || (type && u.type !== type)) throw new Error("Wrong kind of plane");
    });
    return planes;
  }
  function groupRange(state, planes) {
    return Math.min.apply(null, planes.map(function (u) { return SF.stat(state, u.owner, u.type, "range"); }));
  }

  // Fighters patrol the 3 by 3 area around a square, holding the sky there.
  SF.addPatrol = function (state, owner, ids, target) {
    var planes = planeGroup(state, owner, ids, "fighter");
    if (!SF.sq(target) || distance(planes[0].at, target) > groupRange(state, planes)) throw new Error("Out of range");
    var order = { id: state.nextOrderId++, kind: "patrol", unitIds: ids.slice(), from: planes[0].at, to: target };
    state.orders[owner].push(order);
    return order;
  };

  // What bombers from a square can hit: visible enemy troops, enemy cities'
  // buildings, and bridges. Each is { id, mode }.
  SF.bombTargets = function (state, owner, fromId) {
    var range = SF.stat(state, owner, "bomber", "range");
    var vision = SF.vision(state, owner);
    var out = [];
    SF.allSquares().forEach(function (sq) {
      if (distance(fromId, sq.id) > range || !isLand(sq.id)) return;
      if (knownOccupant(state, owner, sq.id, vision, "ground") === 1 - owner) out.push({ id: sq.id, mode: "troops" });
      var c = state.cities[sq.id];
      if (c && c.owner === 1 - owner && SF.buildingCount(state, sq.id) > 0) out.push({ id: sq.id, mode: "buildings" });
      if (sq.terrain.key === "bridge" && !SF.bridgeBroken(state, sq.id)) out.push({ id: sq.id, mode: "bridge" });
    });
    return out.sort(function (a, b) { return distance(fromId, a.id) - distance(fromId, b.id); });
  };

  SF.addBombRun = function (state, owner, ids, target, mode) {
    var planes = planeGroup(state, owner, ids, "bomber");
    var ok = SF.bombTargets(state, owner, planes[0].at).some(function (t) { return t.id === target && t.mode === mode; });
    if (!ok) throw new Error("Not a target");
    var order = { id: state.nextOrderId++, kind: "bomb", unitIds: ids.slice(), from: planes[0].at, to: target, mode: mode };
    state.orders[owner].push(order);
    return order;
  };

  // Where planes can move to: airfield cities you hold, and your carriers
  // with room, in range. Each is { id, carrier } where carrier is a unit id or null.
  SF.rebaseTargets = function (state, owner, planes) {
    var from = planes[0].at, range = groupRange(state, planes), out = [];
    Object.keys(state.cities).forEach(function (id) {
      var c = state.cities[id];
      if (c.owner === owner && c.buildings.airfield > 0 && id !== from && distance(from, id) <= range &&
          SF.occupant(state, id) !== 1 - owner) out.push({ id: id, carrier: null });
    });
    state.units.forEach(function (u) {
      if (u.owner !== owner || u.type !== "carrier" || isCargo(u)) return;
      if (planes.some(function (p) { return p.aboard === u.id; })) return;
      if (distance(from, u.at) <= range && SF.carrierRoom(state, u) >= planes.length) out.push({ id: u.at, carrier: u.id });
    });
    return out.sort(function (a, b) { return distance(from, a.id) - distance(from, b.id); });
  };

  SF.addRebase = function (state, owner, ids, to, carrierId) {
    var planes = planeGroup(state, owner, ids);
    var ok = SF.rebaseTargets(state, owner, planes).some(function (t) {
      return t.id === to && (t.carrier || null) === (carrierId || null);
    });
    if (!ok) throw new Error("Cannot move there");
    var order = { id: state.nextOrderId++, kind: "rebase", unitIds: ids.slice(), from: planes[0].at, to: to,
      carrier: carrierId || null };
    state.orders[owner].push(order);
    return order;
  };

  // An engineer standing on a bombed-out bridge can rebuild it in one turn.
  SF.addRepair = function (state, owner, engineerId) {
    var units = checkUnits(state, owner, [engineerId]);
    if (units[0].type !== "engineer" || isCargo(units[0])) throw new Error("Only engineers rebuild bridges");
    if (!SF.bridgeBroken(state, units[0].at)) throw new Error("No broken bridge here");
    var order = { id: state.nextOrderId++, kind: "repair", unitIds: [engineerId], from: units[0].at, to: units[0].at };
    state.orders[owner].push(order);
    return order;
  };

  // Fire missiles stored in a city at any square in range, seen or not.
  // mode: "units" hits whatever enemy units are there; "buildings" hits an enemy city.
  SF.addMissile = function (state, owner, ids, target, mode) {
    var ms = checkUnits(state, owner, ids);
    ms.forEach(function (u) { if (u.type !== "missile") throw new Error("Not a missile"); });
    if (!SF.sq(target)) throw new Error("Not a square");
    if (distance(ms[0].at, target) > SF.stat(state, owner, "missile", "range")) throw new Error("Out of range");
    if (mode === "buildings") {
      var c = state.cities[target];
      if (!c || c.owner !== 1 - owner) throw new Error("Not an enemy city");
    } else if (mode !== "units") throw new Error("Bad mode");
    var order = { id: state.nextOrderId++, kind: "missile", unitIds: ids.slice(), from: ms[0].at, to: target, mode: mode };
    state.orders[owner].push(order);
    return order;
  };

  // ---------- Nuclear weapons ----------

  // Ways this side could deliver a nuclear weapon from a square, with range.
  SF.nukeMethods = function (state, owner, fromId) {
    if (!(state.econ[owner].warheads > 0)) return [];
    var here = SF.unitsAt(state, fromId, owner).filter(function (u) { return !SF.orderFor(state, u.id); });
    var out = [];
    var m = here.filter(function (u) { return u.type === "missile"; })[0];
    if (m) out.push({ method: "missile", unit: m, range: SF.stat(state, owner, "missile", "range") });
    var b = here.filter(function (u) { return u.type === "bomber"; })[0];
    if (b) out.push({ method: "bomber", unit: b, range: SF.stat(state, owner, "bomber", "range") });
    var sub = here.filter(function (u) { return u.type === "submarine" && !isCargo(u); })[0];
    if (sub && !isLand(fromId)) out.push({ method: "submarine", unit: sub, range: SF.NUKE.subRange });
    return out;
  };

  SF.addNuke = function (state, owner, method, unitId, target) {
    var u = checkUnits(state, owner, [unitId])[0];
    var way = SF.nukeMethods(state, owner, u.at).filter(function (w) { return w.method === method && w.unit.id === unitId; })[0];
    if (!way) throw new Error("Cannot launch from here");
    if (!SF.sq(target) || distance(u.at, target) > way.range) throw new Error("Out of range");
    state.econ[owner].warheads -= 1;
    var order = { id: state.nextOrderId++, kind: "nuke", method: method, unitIds: [unitId], from: u.at, to: target, warhead: true };
    state.orders[owner].push(order);
    return order;
  };

  // The morale a launch would cost this side right now.
  SF.nukeMoraleCost = function (state, owner) {
    var first = state.firstNuke;
    if (first === null || first === undefined) return SF.NUKE.firstUse;
    if (first === owner || first === "both") return SF.NUKE.laterUse;
    return 0;
  };

  SF.cancelOrder = function (state, owner, orderId) {
    state.orders[owner].forEach(function (o) {
      if (o.id === orderId && o.gas) state.econ[owner].gasoline += o.gas;
      if (o.id === orderId && o.warhead) state.econ[owner].warheads += 1;
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

  // The game being played, so battles can use each side's technology.
  var statState = null;

  function attackValue(u, terrain, foes, landing) {
    var v = SF.stat(statState, u.owner, u.type, "attack") + huntBonus(u, foes);
    if (u.type === "tank" && terrain) v += SF.TANK_ATTACK[terrain] || 0;
    if (landing && landing[u.id]) v -= SF.LANDING_PENALTY;
    return v;
  }

  function defenseValue(u, terrain, foes) {
    var t = SF.UNIT_TYPES[u.type];
    var v = SF.stat(statState, u.owner, u.type, "defense") + (SF.DEFENSE_BONUS[terrain] || 0) + huntBonus(u, foes);
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
  // bonus: { att: n, def: n } added to each side's hit numbers, for air support.
  SF.fight = function (attackers, defenders, terrain, meeting, rand, landing, bonus) {
    rand = rand || Math.random;
    var ab = (bonus && bonus.att) || 0, db = (bonus && bonus.def) || 0;
    var rounds = (bonus && bonus.rounds) || SF.BATTLE_ROUNDS;
    var att = attackers.slice(), def = defenders.slice();
    var attLost = [], defLost = [];
    for (var round = 0; round < rounds && att.length && def.length; round++) {
      var attHits = 0, defHits = 0;
      att.forEach(function (u) { if (rand() < hitChance(attackValue(u, terrain, def, landing) + ab)) attHits++; });
      def.forEach(function (u) {
        var v = meeting ? attackValue(u, terrain, att) : defenseValue(u, terrain, att);
        if (rand() < hitChance(v + db)) defHits++;
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
    var terrain = SF.terrainAt(state, target);
    var marks = null;
    if (landing) {
      marks = {};
      units.forEach(function (u) { marks[u.id] = true; });
    }
    var wins = 0, runs = 400;
    statState = state;
    for (var i = 0; i < runs; i++) {
      if (SF.fight(units, defenders, terrain, false, rand, marks).result === "attacker") wins++;
    }
    statState = null;
    // Nothing is ever certain, so never show 0% or 100%.
    return Math.min(99, Math.max(1, Math.round((wins / runs) * 100)));
  };

  SF.bombardChance = function (target, type) {
    var terrain = SF.sq(target).terrain.key;
    var base = type === "destroyer" ? SF.SHORE_BOMBARD_CHANCE : type === "bomber" ? SF.BOMB_TROOPS : SF.BOMBARD_CHANCE;
    return Math.max(0.05, base - (SF.BOMBARD_TERRAIN[terrain] || 0));
  };

  // The computer opponent's orders. See ai.js.
  SF.computerOrders = function (state) {
    SF.aiTurn(state, 1, state.difficulty);
  };

  // ---------- Turn resolution ----------

  // Produces a list of events. Each side's screen shows only the events,
  // and the parts of them, that side would know about.
  SF.resolveTurn = function (state, rand) {
    rand = rand || Math.random;
    statState = state;
    var events = [];
    state.hinted = state.hinted || [[], []];
    // What happened to each side this turn, for morale.
    var tally = { lost: [0, 0], wrecked: [0, 0], struck: [0, 0], wins: [0, 0], launched: [0, 0], nuked: [0, 0] };
    function struck(id, side) {
      var c = state.cities[id];
      if (c && c.owner === side) tally.struck[side]++;
    }

    // The first time a side runs into an enemy technology, it may notice.
    function hint(owner, techId, viewer) {
      var t = SF.tech(techId);
      if (!t.hint || !SF.hasTech(state, owner, techId)) return;
      if (state.hinted[viewer].indexOf(techId) !== -1) return;
      state.hinted[viewer].push(techId);
      events.push({ type: "hint", owner: viewer, text: t.hint });
    }
    // Hints from a battle: each side may notice upgrades on the other's units.
    function battleHints(sideA, sideB) {
      [[sideA, sideB], [sideB, sideA]].forEach(function (pair) {
        var units = pair[0], other = pair[1];
        if (!units.length || !other.length) return;
        var owner = units[0].owner, viewer = other[0].owner;
        SF.researchOf(state, owner).done.forEach(function (id) {
          var mods = SF.tech(id).mods;
          if (!mods) return;
          if (units.some(function (u) { return mods[u.type] && (mods[u.type].attack || mods[u.type].defense); })) {
            hint(owner, id, viewer);
          }
        });
      });
    }
    var alive = {};
    state.units.forEach(function (u) { alive[u.id] = u; });
    state.scouted = [[], []];

    function unitsOf(order) {
      return order.unitIds.map(function (id) { return alive[id]; }).filter(Boolean);
    }
    function living() { return Object.keys(alive).map(function (id) { return alive[id]; }); }
    // Losing a transport or carrier loses everything aboard.
    function kill(units) {
      units.forEach(function (u) {
        if (!alive[u.id]) return;
        delete alive[u.id];
        tally.lost[u.owner] += isGround(u) || isCargo(u) && !isAir(u) ? SF.MORALE.unitLost : SF.MORALE.bigUnitLost;
        if (u.type === "transport" || u.type === "carrier") {
          var aboard = living().filter(function (c) { return c.aboard === u.id; });
          if (aboard.length) {
            kill(aboard);
            events.push({ type: "cargoLost", owner: u.owner, at: u.at, ship: u.type, what: SF.describeUnits(aboard) });
          }
        }
      });
    }

    var all = [];
    [0, 1].forEach(function (owner) {
      state.orders[owner].forEach(function (o) { all.push({ owner: owner, order: o }); });
    });

    // Air defense batteries in this side's cities on these squares, as
    // extra anti-aircraft shots.
    function batteryShots(side, squares) {
      var shots = [];
      squares.forEach(function (id) {
        var c = state.cities[id];
        if (!c || c.owner !== side) return;
        for (var i = 0; i < c.buildings.airDefense * SF.AIR_DEFENSE_SHOTS; i++) shots.push(id);
      });
      return shots;
    }

    // 1. The air war: fighter patrols meet, bombers try to get through.
    var patrols = all.filter(function (e) { return e.order.kind === "patrol"; }).map(function (e) {
      return { owner: e.owner, at: e.order.to, area: around(e.order.to, SF.PATROL_RADIUS), units: unitsOf(e.order) };
    });
    function overlaps(a, b) { return a.area.some(function (id) { return b.area.indexOf(id) !== -1; }); }
    patrols.forEach(function (a) {
      if (a.owner !== 0) return;
      patrols.forEach(function (b) {
        if (b.owner !== 1 || !overlaps(a, b)) return;
        var fa = a.units.filter(function (u) { return alive[u.id]; });
        var fb = b.units.filter(function (u) { return alive[u.id]; });
        if (!fa.length || !fb.length) return;
        var out = SF.fight(fa, fb, null, true, rand);
        battleHints(fa, fb);
        kill(out.attLost); kill(out.defLost);
        events.push({
          type: "airBattle", at: a.at === b.at ? a.at : a.at + " and " + b.at,
          whats: [SF.describeUnits(fa), SF.describeUnits(fb)],
          lost: [SF.describeUnits(out.attLost), SF.describeUnits(out.defLost)]
        });
      });
    });
    // Who holds the sky over each square: 0, 1, "contested", or nothing.
    var sky = {};
    function fightersOver(owner, id) {
      var out = [];
      patrols.forEach(function (p) {
        if (p.owner !== owner || p.area.indexOf(id) === -1) return;
        p.units.forEach(function (u) { if (alive[u.id] && out.indexOf(u) === -1) out.push(u); });
      });
      return out;
    }
    patrols.forEach(function (p) {
      p.area.forEach(function (id) {
        var a = fightersOver(0, id).length, b = fightersOver(1, id).length;
        sky[id] = a && b ? "contested" : a ? 0 : b ? 1 : undefined;
      });
    });
    patrols.forEach(function (p) {
      var alivePlanes = p.units.filter(function (u) { return alive[u.id]; });
      if (!alivePlanes.length) return;
      events.push({ type: "patrol", owner: p.owner, at: p.at, what: SF.describeUnits(alivePlanes),
        held: sky[p.at] === p.owner });
    });

    all.filter(function (e) { return e.order.kind === "bomb"; }).forEach(function (e) {
      var bombers = unitsOf(e.order);
      if (!bombers.length) return;
      var target = e.order.to;
      var ev = { type: "bombing", owner: e.owner, at: target, mode: e.order.mode, from: e.order.from,
        what: SF.describeUnits(bombers) };
      // Enemy fighters over the target attack the bombers and their escorts.
      var interceptors = fightersOver(1 - e.owner, target);
      if (interceptors.length) {
        var escorts = fightersOver(e.owner, target);
        // An interception is a single pass, not a full battle.
        var out = SF.fight(interceptors, bombers.concat(escorts), null, false, rand, null, { rounds: SF.INTERCEPT_ROUNDS });
        battleHints(interceptors, bombers.concat(escorts));
        kill(out.attLost); kill(out.defLost);
        ev.intercepted = {
          by: SF.describeUnits(interceptors), escorts: SF.describeUnits(escorts),
          lostAtt: SF.describeUnits(out.attLost), lostDef: SF.describeUnits(out.defLost)
        };
      }
      // Anti-aircraft guns and air defense batteries on the target fire at what is left.
      var guns = living().filter(function (u) {
        return u.type === "antiAir" && u.at === target && u.owner !== e.owner && isGround(u);
      }).concat(batteryShots(1 - e.owner, [target]));
      var shotDown = [];
      guns.forEach(function () {
        var left = bombers.filter(function (u) { return alive[u.id]; });
        var aa = SF.AA_CHANCE * (SF.effect(state, e.owner, "stealth") ? 0.5 : 1);
        if (left.length && rand() < aa) { shotDown.push(left[0]); kill([left[0]]); }
      });
      ev.shotDown = SF.describeUnits(shotDown);
      if (interceptors.length || guns.length) hint(e.owner, "stealth", 1 - e.owner);
      var flying = bombers.filter(function (u) { return alive[u.id]; });
      ev.dropped = flying.length;
      var killed = [], wrecked = [];
      flying.forEach(function () {
        if (e.order.mode === "troops") {
          var targets = living().filter(function (u) { return u.at === target && u.owner !== e.owner && isGround(u); });
          if (targets.length && rand() < SF.bombardChance(target, "bomber") + SF.effect(state, e.owner, "bombChance")) {
            var hit = targets[Math.floor(rand() * targets.length)];
            killed.push(hit);
            kill([hit]);
          }
        } else if (e.order.mode === "buildings") {
          var c = state.cities[target];
          if (!c || c.owner === e.owner) return;
          var kinds = SF.BUILDING_ORDER.filter(function (k) { return c.buildings[k] > 0; });
          if (kinds.length && rand() < SF.BOMB_BUILDING + SF.effect(state, e.owner, "bombChance")) {
            var k = kinds[Math.floor(rand() * kinds.length)];
            c.buildings[k] -= 1;
            wrecked.push(SF.BUILDINGS[k].name);
            tally.wrecked[c.owner]++;
          }
        } else if (e.order.mode === "bridge") {
          if (!SF.bridgeBroken(state, target) && rand() < SF.BOMB_BRIDGE + SF.effect(state, e.owner, "bombChance")) {
            state.brokenBridges.push(target);
            ev.bridge = true;
          }
        }
      });
      ev.killed = SF.describeUnits(killed);
      ev.wrecked = wrecked;
      if (flying.length) struck(target, 1 - e.owner);
      if (killed.length || wrecked.length || ev.bridge) hint(e.owner, "heavyBombers", 1 - e.owner);
      events.push(ev);
    });

    // 2. Missiles strike. Each one is engaged in turn by missile defense
    // batteries in cities within 1 square of the target, then by destroyers
    // within 1 square, until it is shot down or nothing has shots left.
    var shotsUsed = {};
    all.filter(function (e) { return e.order.kind === "missile"; }).forEach(function (e) {
      var missiles = unitsOf(e.order);
      if (!missiles.length) return;
      missiles.forEach(function (m) { delete alive[m.id]; });
      var target = e.order.to, foeSide = 1 - e.owner;
      var near = around(target, 1);
      var layers = [];
      // Satellites in orbit sharpen both the attack and the defense.
      var defBonus = SF.satelliteBonus(state, foeSide);
      var hitBonus = SF.effect(state, e.owner, "missileHit") + SF.satelliteBonus(state, e.owner);
      near.forEach(function (id) {
        var c = state.cities[id];
        if (c && c.owner === foeSide && c.buildings.missileDefense > 0) {
          layers.push({ key: "city:" + id,
            shots: c.buildings.missileDefense * (SF.MISSILE_DEFENSE_SHOTS + SF.effect(state, foeSide, "missileDefenseShots")),
            chance: SF.MISSILE_DEFENSE_CHANCE + SF.effect(state, foeSide, "missileDefenseChance") + defBonus,
            tech: SF.hasTech(state, foeSide, "layered") ? "layered" : null });
        }
      });
      living().forEach(function (u) {
        if (u.owner === foeSide && u.type === "destroyer" && !isCargo(u) && near.indexOf(u.at) !== -1) {
          layers.push({ key: "ship:" + u.id,
            shots: SF.DESTROYER_MISSILE_SHOTS + SF.effect(state, foeSide, "destroyerMissileShots"),
            chance: SF.DESTROYER_MISSILE_CHANCE + SF.effect(state, foeSide, "destroyerMissileChance") + defBonus,
            tech: SF.hasTech(state, foeSide, "aegis") ? "aegis" : null });
        }
      });
      var stopped = 0;
      missiles.forEach(function () {
        for (var i = 0; i < layers.length; i++) {
          var l = layers[i];
          if ((shotsUsed[l.key] || 0) >= l.shots) continue;
          shotsUsed[l.key] = (shotsUsed[l.key] || 0) + 1;
          if (rand() < l.chance) { stopped++; if (l.tech) hint(foeSide, l.tech, e.owner); return; }
        }
      });
      var landed = missiles.length - stopped;
      var killed = [], wrecked = [];
      var terrain = SF.terrainAt(state, target);
      var sea = !isLand(target);
      for (var m = 0; m < landed; m++) {
        if (e.order.mode === "buildings") {
          var c = state.cities[target];
          if (!c || c.owner !== foeSide) continue;
          var kinds = SF.BUILDING_ORDER.filter(function (k) { return c.buildings[k] > 0; });
          if (kinds.length && rand() < SF.MISSILE_BUILDING + hitBonus) {
            var k = kinds[Math.floor(rand() * kinds.length)];
            c.buildings[k] -= 1;
            wrecked.push(SF.BUILDINGS[k].name);
            tally.wrecked[foeSide]++;
          }
        } else {
          for (var h = 0; h < SF.MISSILE_HITS; h++) {
            var targets = living().filter(function (u) {
              return u.at === target && u.owner === foeSide && (sea ? isShip(u) : isGround(u));
            });
            if (!targets.length) break;
            if (rand() < Math.max(0.05, SF.MISSILE_HIT_CHANCE + hitBonus - (SF.BOMBARD_TERRAIN[terrain] || 0))) {
              var hit = targets[Math.floor(rand() * targets.length)];
              killed.push(hit);
              kill([hit]);
            }
          }
        }
      }
      if (killed.length || wrecked.length) hint(e.owner, "guided", foeSide);
      if (landed) struck(target, foeSide);
      events.push({
        type: "missile", owner: e.owner, from: e.order.from, at: target, mode: e.order.mode,
        fired: missiles.length, stopped: stopped, killed: SF.describeUnits(killed), wrecked: wrecked
      });
    });

    // Nuclear strikes. Bombers face the same fighters and guns as any bomber;
    // missiles face the same missile defenses as any missile.
    function detonate(e) {
      var target = e.order.to, foeSide = 1 - e.owner;
      var killed = [[], []], wrecked = [[], []];
      living().forEach(function (u) {
        if (u.at === target) { killed[u.owner].push(u); kill([u]); }
      });
      around(target, 1).forEach(function (id) {
        if (id === target) return;
        living().forEach(function (u) {
          if (u.at === id && !isCargo(u) && rand() < SF.NUKE.ringKill) { killed[u.owner].push(u); kill([u]); }
        });
      });
      around(target, 1).forEach(function (id) {
        var c = state.cities[id];
        if (!c) return;
        SF.BUILDING_ORDER.forEach(function (k) {
          var lose = id === target ? c.buildings[k] : Math.floor(c.buildings[k] * SF.NUKE.ringBuildings);
          for (var i = 0; i < lose; i++) wrecked[c.owner].push(SF.BUILDINGS[k].name);
          c.buildings[k] -= lose;
        });
      });
      state.fallout = state.fallout || {};
      state.fallout[target] = state.turn + SF.NUKE.fallout;
      tally.nuked[foeSide]++;
      tally.wrecked[0] += wrecked[0].length;
      tally.wrecked[1] += wrecked[1].length;
      return {
        killed: [SF.describeUnits(killed[0]), SF.describeUnits(killed[1])],
        wrecked: [wrecked[0], wrecked[1]]
      };
    }
    all.filter(function (e) { return e.order.kind === "nuke"; }).forEach(function (e) {
      var carrier = unitsOf(e.order)[0];
      var target = e.order.to, foeSide = 1 - e.owner;
      tally.launched[e.owner]++;
      var ev = { type: "nuke", owner: e.owner, method: e.order.method, from: e.order.from, at: target };
      events.push(ev);
      if (!carrier) { ev.result = "lost"; return; }
      var through = true;
      if (e.order.method === "bomber") {
        var interceptors = fightersOver(foeSide, target);
        if (interceptors.length) {
          var out = SF.fight(interceptors, [carrier].concat(fightersOver(e.owner, target)), null, false, rand, null,
            { rounds: SF.INTERCEPT_ROUNDS });
          kill(out.attLost); kill(out.defLost);
        }
        if (alive[carrier.id]) {
          var guns = living().filter(function (u) {
            return u.type === "antiAir" && u.at === target && u.owner === foeSide && isGround(u);
          }).concat(batteryShots(foeSide, [target]));
          var aa = SF.AA_CHANCE * (SF.effect(state, e.owner, "stealth") ? 0.5 : 1);
          guns.forEach(function () { if (alive[carrier.id] && rand() < aa) kill([carrier]); });
        }
        through = !!alive[carrier.id];
        if (!through) { ev.result = "shotDown"; return; }
      } else {
        // A missile, from a city or a submarine, is used up.
        if (e.order.method === "missile") delete alive[carrier.id];
        var defBonus = SF.satelliteBonus(state, foeSide);
        var near = around(target, 1);
        var layers = [];
        near.forEach(function (id) {
          var c = state.cities[id];
          if (c && c.owner === foeSide && c.buildings.missileDefense > 0) {
            layers.push({ key: "city:" + id,
              shots: c.buildings.missileDefense * (SF.MISSILE_DEFENSE_SHOTS + SF.effect(state, foeSide, "missileDefenseShots")),
              chance: SF.MISSILE_DEFENSE_CHANCE + SF.effect(state, foeSide, "missileDefenseChance") + defBonus });
          }
        });
        living().forEach(function (u) {
          if (u.owner === foeSide && u.type === "destroyer" && !isCargo(u) && near.indexOf(u.at) !== -1) {
            layers.push({ key: "ship:" + u.id,
              shots: SF.DESTROYER_MISSILE_SHOTS + SF.effect(state, foeSide, "destroyerMissileShots"),
              chance: SF.DESTROYER_MISSILE_CHANCE + SF.effect(state, foeSide, "destroyerMissileChance") + defBonus });
          }
        });
        for (var i = 0; i < layers.length && through; i++) {
          var l = layers[i];
          if ((shotsUsed[l.key] || 0) >= l.shots) continue;
          shotsUsed[l.key] = (shotsUsed[l.key] || 0) + 1;
          if (rand() < l.chance) through = false;
        }
        if (!through) { ev.result = "intercepted"; return; }
      }
      ev.result = "detonated";
      var blast = detonate(e);
      ev.killed = blast.killed;
      ev.wrecked = blast.wrecked;
    });

    // Anti-satellite missiles.
    all.filter(function (e) { return e.order.kind === "asat"; }).forEach(function (e) {
      var missiles = unitsOf(e.order);
      if (!missiles.length) return;
      missiles.forEach(function (m) { delete alive[m.id]; });
      var sats = SF.satellites(state, 1 - e.owner), destroyed = 0;
      missiles.forEach(function () {
        if (sats.length && rand() < SF.ASAT_CHANCE) {
          sats.splice(Math.floor(rand() * sats.length), 1);
          destroyed++;
        }
      });
      events.push({ type: "asat", owner: e.owner, fired: missiles.length, destroyed: destroyed });
    });

    // 3. Artillery and destroyers fire.
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
      var hold = sky[at];
      var winner = outcome.result === "attacker" ? attOwner :
        outcome.result === "defender" || (outcome.result === "held" && !meeting) ? 1 - attOwner : null;
      if (winner !== null) tally.wins[winner]++;
      events.push({
        air: hold === 0 || hold === 1 ? hold : null,
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
            battleHints(a.units, b.units);
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
        var terrain = SF.terrainAt(state, target);
        // The side holding the sky over a battle gets air support.
        var hold = sky[target];
        function support(owner) { return hold === owner ? SF.AIR_SUPPORT : 0; }
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
          var out = SF.fight(attackers, defenders, terrain, false, rand, landingMarks(side[attOwner]),
            { att: support(attOwner), def: support(defOwner) });
          battleHints(attackers, defenders);
          kill(out.attLost); kill(out.defLost);
          battleEvent(target, attOwner, attackers, defenders, out, false, landingAll);
          if (out.result === "attacker") place(side[attOwner], true);
          else retreat(side[attOwner]);
        } else if (side[0].length && side[1].length) {
          var a = unitsIn(side[0]), b = unitsIn(side[1]);
          var meet = SF.fight(a, b, terrain, true, rand, null, { att: support(0), def: support(1) });
          battleHints(a, b);
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

    // 4. Transports load troops in the port they leave.
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

    // 5. Ships sail and fight. Cargo goes wherever its transport goes.
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
      if (isCargo(c) && !isAir(c) && isLand(c.at)) c.aboard = null;
    });

    // 6. Ground moves, landings, and boarding.
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

    // Engineers who stayed on a broken bridge rebuild it.
    all.filter(function (e) { return e.order.kind === "repair"; }).forEach(function (e) {
      var eng = unitsOf(e.order)[0];
      if (!eng || eng.at !== e.order.to || !SF.bridgeBroken(state, eng.at)) return;
      state.brokenBridges = state.brokenBridges.filter(function (id) { return id !== eng.at; });
      events.push({ type: "bridgeRebuilt", owner: e.owner, at: eng.at });
    });

    // Planes move to new bases.
    all.filter(function (e) { return e.order.kind === "rebase"; }).forEach(function (e) {
      var planes = unitsOf(e.order);
      if (!planes.length) return;
      var ok = false, where = e.order.to;
      if (e.order.carrier) {
        var carrier = alive[e.order.carrier];
        if (carrier && SF.UNIT_TYPES.carrier.planes - living().filter(function (u) {
          return u.aboard === carrier.id && isAir(u);
        }).length >= planes.length) {
          planes.forEach(function (u) { u.at = carrier.at; u.aboard = carrier.id; });
          ok = true;
          where = carrier.at;
        }
      } else {
        var c = state.cities[e.order.to];
        var enemyThere = living().some(function (g) { return g.at === e.order.to && g.owner !== e.owner && isGround(g); });
        if (c && c.owner === e.owner && c.buildings.airfield > 0 && !enemyThere) {
          planes.forEach(function (u) { u.at = e.order.to; u.aboard = null; });
          ok = true;
        }
      }
      events.push({ type: "rebase", owner: e.owner, what: SF.describeUnits(planes), from: e.order.from,
        to: where, carrier: !!e.order.carrier, ok: ok });
    });

    // 7. Planes and docked ships in a city the enemy now holds are destroyed.
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

    // 8. Scout planes fly after the fighting, so they see where armies ended up.
    all.filter(function (e) { return e.order.kind === "scout"; }).forEach(function (e) {
      var plane = unitsOf(e.order)[0];
      if (!plane) return;
      var area = around(e.order.to, SF.SCOUT_RADIUS);
      var guns = living().filter(function (u) {
        return u.type === "antiAir" && u.owner !== e.owner && area.indexOf(u.at) !== -1 && !isCargo(u);
      }).concat(batteryShots(1 - e.owner, area));
      // Enemy fighters patrolling over the area can catch it too.
      var catchers = fightersOver(1 - e.owner, e.order.to);
      var shot = guns.some(function () { return rand() < SF.SCOUT_AA_CHANCE; }) ||
        catchers.some(function () { return rand() < SF.SCOUT_FIGHTER_CHANCE; });
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

    // 9. Economy: cities change hands, production finishes, income comes in.
    SF.updateCityOwners(state, events);
    SF.advanceProjects(state, events);
    SF.collectIncome(state, events);
    SF.advanceResearch(state, events);
    SF.applyMorale(state, events, tally);
    var result = SF.checkVictory(state);
    if (result) {
      state.over = result;
      events.push({ type: "gameOver", result: result });
    }
    statState = null;

    state.report = { turn: state.turn, mode: state.mode, events: events };
    state.orders = [[], []];
    state.turn += 1;
    return state.report;
  };
})(window.SF);
