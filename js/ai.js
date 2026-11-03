// Sovereign Fire: the computer opponent.
//
// The computer plays by exactly the same rules as a person. It gives orders
// through the same functions the screen uses, gets no bonuses, and only knows
// what its own side can see. Difficulty changes how well it plays, not what
// it has.
(function (SF) {
  "use strict";

  SF.DIFFICULTIES = {
    easy: { name: "Easy", attackOdds: 80, hesitate: 0.35, gather: 0, combine: false, air: false, invade: false, salvo: false },
    normal: { name: "Normal", attackOdds: 60, hesitate: 0.1, gather: 3, combine: true, air: true, invade: false, salvo: false },
    hard: { name: "Hard", attackOdds: 50, hesitate: 0, gather: 4, combine: true, air: true, invade: true, salvo: true }
  };
  SF.DIFFICULTY_ORDER = ["easy", "normal", "hard"];

  // Starting buildings by government, written with North's city names.
  var PLANS = {
    military: { F2: { factory: 2, airfield: 1 }, C3: { factory: 1, refinery: 1 }, L3: { factory: 2 },
      O3: { factory: 1, refinery: 1 }, E6: { port: 1 } },
    scientific: { F2: { lab: 2, factory: 1, airfield: 1 }, C3: { lab: 2, refinery: 1 }, L3: { factory: 1, lab: 1 },
      O3: { factory: 1 } }
  };
  SF.computerPlan = function (owner, gov) {
    var north = PLANS[gov];
    if (!north) return SF.defaultPlan(owner);
    var plan = {};
    Object.keys(north).forEach(function (id) {
      plan[owner === 0 ? id : SF.mirrorId(id)] = JSON.parse(JSON.stringify(north[id]));
    });
    return plan;
  };

  // Research order by government.
  var RESEARCH = {
    democracy: ["automation", "armor", "jets", "guided", "codebreaking", "refining", "mechanized", "heavyBombers",
      "layered", "satellites", "mbt", "massProduction", "stealth", "sonar", "subs", "aegis", "asat", "deepCover",
      "physics", "power", "bomb"],
    authoritarian: ["armor", "automation", "jets", "mechanized", "guided", "physics", "power", "heavyBombers",
      "layered", "mbt", "refining", "codebreaking", "bomb", "massProduction", "satellites", "stealth", "sonar",
      "subs", "aegis", "asat", "deepCover"],
    military: ["armor", "jets", "automation", "mechanized", "heavyBombers", "mbt", "guided", "massProduction",
      "stealth", "sonar", "subs", "refining", "layered", "physics", "power", "bomb", "codebreaking", "satellites",
      "aegis", "asat", "deepCover"],
    scientific: ["automation", "refining", "codebreaking", "armor", "jets", "guided", "satellites", "layered",
      "mechanized", "physics", "power", "massProduction", "mbt", "heavyBombers", "stealth", "deepCover", "asat",
      "bomb", "sonar", "subs", "aegis"]
  };
  var LAB_SHARE = { democracy: 0.3, authoritarian: 0.22, military: 0.12, scientific: 0.45 };

  function tryDo(fn) {
    try { fn(); return true; } catch (e) { return false; }
  }

  // ---------- Pathing ----------

  // Movement cost from every square to the nearest goal, for one unit type,
  // ignoring other units. Ground units cross land, ships cross ocean.
  function distField(state, owner, type, goals) {
    var t = SF.UNIT_TYPES[type];
    var dist = {};
    var queue = [];
    goals.forEach(function (g) { dist[g] = 0; queue.push(g); });
    while (queue.length) {
      queue.sort(function (a, b) { return dist[a] - dist[b]; });
      var id = queue.shift();
      SF.neighbors(SF.sq(id)).forEach(function (n) {
        if (SF.radioactive(state, n.id)) return;
        var key = SF.terrainAt(state, n.id);
        var cost;
        if (t.naval) {
          if (key !== "ocean" && !SF.ownPort(state, owner, n.id)) return;
          cost = 1;
        } else {
          if (key === "ocean") return;
          if (key === "river" && !t.crossRiver) return;
          cost = SF.MOVE_COST[key];
        }
        var d = dist[id] + cost;
        if (dist[n.id] === undefined || d < dist[n.id]) {
          dist[n.id] = d;
          queue.push(n.id);
        }
      });
    }
    return dist;
  }

  // ---------- One turn ----------

  SF.aiTurn = function (state, p, level) {
    var D = SF.DIFFICULTIES[level || state.difficulty || "normal"];
    var foe = 1 - p;
    state.orders[p] = [];
    var vis = SF.vision(state, p);
    var nation = SF.nation(state, p);
    var gov = nation.gov;
    var capital = SF.capitalOf(p);

    function ordered(u) { return !!SF.orderFor(state, u.id); }
    function mine(filter) {
      return state.units.filter(function (u) { return u.owner === p && !ordered(u) && filter(u); });
    }
    function seen(id) { return SF.visibleEnemies(state, p, id, vis); }
    function seenGround(id) { return seen(id).filter(SF.isGround); }
    var enemySquares = SF.allSquares().filter(function (sq) { return seenGround(sq.id).length; }).map(function (sq) { return sq.id; });
    var enemyCities = SF.citiesOf(state, foe);
    var myCities = SF.citiesOf(state, p);

    // ---------- Economy: workforce, research, abilities ----------
    (function workforce() {
      var mp = SF.manpower(state, p);
      if (level === "easy") return;
      var rec = Math.max(2, Math.round(mp * 0.18));
      var left = mp - rec;
      var lab = Math.min(SF.capacity(state, p, "lab"), Math.round(left * (LAB_SHARE[gov] || 0.25)));
      left -= lab;
      var ref = Math.min(SF.capacity(state, p, "refinery"), Math.min(left, 3));
      left -= ref;
      var fac = Math.min(SF.capacity(state, p, "factory"), left);
      left -= fac;
      rec += left;
      tryDo(function () { SF.setWorkers(state, p, { factory: fac, refinery: ref, lab: lab, recruit: rec }); });
    })();

    (function research() {
      var r = SF.researchOf(state, p);
      if (r.queue.length) return;
      var order = (RESEARCH[gov] || RESEARCH.democracy).slice();
      if (level === "easy") order.sort(function () { return Math.random() - 0.5; });
      for (var i = 0; i < order.length; i++) {
        if (SF.queueable(state, p).some(function (t) { return t.id === order[i]; })) {
          SF.queueTech(state, p, order[i]);
          if (r.queue.length >= 2) break;
        }
      }
    })();

    (function ability() {
      if (SF.abilityProblem(state, p)) return;
      var g = SF.gov(state, p).ability;
      var use = g === "rally" ||
        (g === "draft" && state.econ[p].recruits < 6) ||
        (g === "conscription" && (SF.capitalThreatened(state, p) || state.turn >= 8)) ||
        (g === "breakthrough" && SF.researchOf(state, p).queue.length);
      if (use) SF.useAbility(state, p);
    })();

    // ---------- Threats and garrisons ----------
    function threatAt(city) {
      var n = 0;
      enemySquares.forEach(function (id) { if (SF.distance(id, city) <= 3) n += seenGround(id).length; });
      return n;
    }
    var garrison = {};   // unit id -> true for units held back to defend
    myCities.forEach(function (city) {
      var need = (city === capital ? 3 : 1) + Math.ceil(threatAt(city) / 2);
      var here = mine(function (u) { return u.at === city && SF.isGround(u); })
        .sort(function (a, b) { return (a.type === "infantry" ? 0 : 1) - (b.type === "infantry" ? 0 : 1); });
      here.slice(0, need).forEach(function (u) { garrison[u.id] = true; });
      var short = need - Math.min(need, here.length);
      if (short > 0 && threatAt(city)) {
        // Pull in nearby free infantry.
        mine(function (u) { return u.type === "infantry" && SF.isGround(u) && !garrison[u.id] && u.at !== city; })
          .filter(function (u) { return SF.reachable(state, p, [u]).indexOf(city) !== -1; })
          .slice(0, short)
          .forEach(function (u) {
            if (tryDo(function () { SF.addOrder(state, p, [u.id], city); })) garrison[u.id] = true;
          });
      }
    });

    // ---------- Nuclear weapons ----------
    (function nukes() {
      if (!(state.econ[p].warheads > 0)) return;
      var struckFirst = state.firstNuke === foe;
      var desperate = nation.morale < 25 && level !== "easy";
      if (!struckFirst && !desperate) return;
      // Biggest visible enemy army, or else the enemy capital.
      var target = SF.capitalOf(foe), best = 0;
      enemySquares.forEach(function (id) {
        var n = seenGround(id).length;
        if (n > best) { best = n; target = id; }
      });
      if (best < 4 && enemyCities.indexOf(SF.capitalOf(foe)) !== -1) target = SF.capitalOf(foe);
      var squares = {};
      state.units.forEach(function (u) { if (u.owner === p) squares[u.at] = true; });
      Object.keys(squares).some(function (sqId) {
        var ways = SF.nukeMethods(state, p, sqId).filter(function (w) { return SF.distance(sqId, target) <= w.range; });
        if (!ways.length) return false;
        return tryDo(function () { SF.addNuke(state, p, ways[0].method, ways[0].unit.id, target); });
      });
    })();

    // ---------- Missiles ----------
    (function missiles() {
      if (level === "easy" && Math.random() < 0.5) return;
      var byCity = {};
      mine(function (u) { return u.type === "missile"; }).forEach(function (m) { (byCity[m.at] = byCity[m.at] || []).push(m); });
      Object.keys(byCity).forEach(function (city) {
        var ms = byCity[city];
        var range = SF.stat(state, p, "missile", "range");
        // Big visible armies first.
        var targets = enemySquares.filter(function (id) {
          return SF.distance(city, id) <= range && seenGround(id).length >= 3;
        }).sort(function (a, b) { return seenGround(b).length - seenGround(a).length; });
        if (targets.length) {
          tryDo(function () { SF.addMissile(state, p, [ms[0].id], targets[0], "units"); });
          ms = ms.slice(1);
        }
        // A salvo at an enemy city's buildings, big enough to get through.
        if (D.salvo && ms.length >= 3) {
          var cities = enemyCities.filter(function (id) { return SF.distance(city, id) <= range; })
            .sort(function (a, b) { return (b === SF.capitalOf(foe) ? 0 : 1) - (a === SF.capitalOf(foe) ? 0 : 1); });
          if (cities.length) {
            var salvo = ms.map(function (m) { return m.id; });
            tryDo(function () { SF.addMissile(state, p, salvo, cities[cities.length - 1], "buildings"); });
          }
        }
      });
    })();

    // ---------- Artillery and shore bombardment ----------
    ["artillery", "destroyer"].forEach(function (type) {
      var byAt = {};
      mine(function (u) { return u.type === type && !SF.isCargo(u); }).forEach(function (u) { (byAt[u.at] = byAt[u.at] || []).push(u); });
      Object.keys(byAt).forEach(function (at) {
        var targets = SF.bombardTargets(state, p, at, type)
          .sort(function (a, b) { return seenGround(b).length - seenGround(a).length; });
        if (!targets.length) return;
        tryDo(function () { SF.addBombard(state, p, byAt[at].map(function (u) { return u.id; }), targets[0]); });
      });
    });

    // ---------- Ground attacks ----------
    var attackTargets = [];
    var fighters = ["infantry", "tank", "specialForces"];
    function freeStacks() {
      var stacks = {};
      mine(function (u) {
        return SF.isGround(u) && !garrison[u.id] && fighters.indexOf(u.type) !== -1;
      }).forEach(function (u) { (stacks[u.at] = stacks[u.at] || []).push(u); });
      return stacks;
    }

    (function attacks() {
      var stacks = freeStacks();
      // Every enemy square some stack can reach.
      var options = {};
      Object.keys(stacks).forEach(function (at) {
        SF.reachable(state, p, stacks[at]).forEach(function (id) {
          if (enemySquares.indexOf(id) !== -1) (options[id] = options[id] || []).push(at);
        });
      });
      Object.keys(options).forEach(function (target) {
        var from = options[target].filter(function (at) { return stacks[at] && stacks[at].every(function (u) { return !ordered(u); }); });
        if (!from.length) return;
        var units, use;
        if (D.combine) {
          use = from;
        } else {
          use = [from[0]];
        }
        units = use.reduce(function (acc, at) { return acc.concat(stacks[at]); }, []);
        var odds = SF.attackOdds(state, p, units, target);
        // A city is worth a little more risk.
        var want = D.attackOdds - (state.cities[target] ? 5 : 0);
        if (odds < want) return;
        if (Math.random() < D.hesitate) return;
        use.forEach(function (at) {
          tryDo(function () { SF.addOrder(state, p, stacks[at].map(function (u) { return u.id; }), target); });
        });
        attackTargets.push(target);
      });
    })();

    // ---------- Advance toward enemy cities ----------
    (function advance() {
      if (!enemyCities.length) return;
      var fields = {};
      function field(type) {
        if (!fields[type]) fields[type] = distField(state, p, type, enemyCities);
        return fields[type];
      }
      var stacks = freeStacks();
      // Units that cannot fight well on their own tag along with nearby stacks.
      mine(function (u) {
        return SF.isGround(u) && !garrison[u.id] && (u.type === "artillery" || u.type === "antiAir" || u.type === "engineer");
      }).forEach(function (u) { if (stacks[u.at]) stacks[u.at].push(u); });

      Object.keys(stacks).forEach(function (at) {
        var units = stacks[at].filter(function (u) { return !ordered(u); });
        if (!units.length) return;
        // Wait to gather before leaving home ground.
        var inHome = SF.sq(at).home === p;
        if (D.gather && inHome && units.length < D.gather && SF.citiesOf(state, p).indexOf(at) === -1) return;
        var here = Math.max.apply(null, units.map(function (u) { return field(u.type)[at] === undefined ? 999 : field(u.type)[at]; }));
        var best = null, bestScore = here;
        SF.reachable(state, p, units).forEach(function (id) {
          if (SF.sq(id).terrain.key === "ocean" || enemySquares.indexOf(id) !== -1) return;
          var d = Math.max.apply(null, units.map(function (u) { return field(u.type)[id] === undefined ? 999 : field(u.type)[id]; }));
          // Avoid walking into a much stronger enemy next door.
          var danger = 0;
          SF.around(id, 1).forEach(function (n) { danger += seenGround(n).length; });
          if (level !== "easy" && danger > units.length + 1) return;
          var score = d - (SF.DEFENSE_BONUS[SF.terrainAt(state, id)] || 0) * 0.1;
          if (score < bestScore) { bestScore = score; best = id; }
        });
        if (best) tryDo(function () { SF.addOrder(state, p, units.map(function (u) { return u.id; }), best); });
      });
    })();

    // Engineers on broken bridges fix them.
    mine(function (u) { return u.type === "engineer" && !SF.isCargo(u) && SF.bridgeBroken(state, u.at); })
      .forEach(function (u) { tryDo(function () { SF.addRepair(state, p, u.id); }); });

    // ---------- Air ----------
    (function air() {
      // Scouts look at enemy cities near the front.
      var scouts = mine(function (u) { return u.type === "scoutPlane"; });
      var looked = {};
      scouts.forEach(function (s) {
        var range = SF.stat(state, p, "scoutPlane", "range");
        var choices = enemyCities.filter(function (id) { return SF.distance(s.at, id) <= range && !looked[id]; });
        if (!choices.length) choices = enemyCities.filter(function (id) { return SF.distance(s.at, id) <= range; });
        if (!choices.length) return;
        choices.sort(function (a, b) { return SF.distance(s.at, a) - SF.distance(s.at, b); });
        var pick = level === "easy" ? choices[Math.floor(Math.random() * choices.length)] : choices[0];
        looked[pick] = true;
        tryDo(function () { SF.addScout(state, p, s.id, pick); });
      });
      if (!D.air) return;

      // Fighters cover the main attack, or else the most threatened city.
      var fighterUnits = mine(function (u) { return u.type === "fighter"; });
      var cover = attackTargets[0] || null;
      if (!cover) {
        var worst = null, w = 0;
        myCities.forEach(function (c) { var t = threatAt(c); if (t > w) { w = t; worst = c; } });
        cover = worst || capital;
      }
      var byBase = {};
      fighterUnits.forEach(function (f) { (byBase[f.at] = byBase[f.at] || []).push(f); });
      Object.keys(byBase).forEach(function (base) {
        var range = SF.stat(state, p, "fighter", "range");
        var target = SF.distance(base, cover) <= range ? cover : base;
        tryDo(function () { SF.addPatrol(state, p, byBase[base].map(function (u) { return u.id; }), target); });
      });

      // Bombers hit the attack target, the biggest visible army, or a city.
      var bombers = mine(function (u) { return u.type === "bomber"; });
      var byB = {};
      bombers.forEach(function (b) { (byB[b.at] = byB[b.at] || []).push(b); });
      Object.keys(byB).forEach(function (base) {
        var options = SF.bombTargets(state, p, base);
        var troops = options.filter(function (t) { return t.mode === "troops"; })
          .sort(function (a, b) {
            var aa = attackTargets.indexOf(a.id) !== -1 ? 100 : 0, bb = attackTargets.indexOf(b.id) !== -1 ? 100 : 0;
            return (bb + seenGround(b.id).length) - (aa + seenGround(a.id).length);
          });
        var pick = troops[0] || (level === "hard" ? options.filter(function (t) { return t.mode === "buildings"; })[0] : null);
        if (!pick) return;
        tryDo(function () { SF.addBombRun(state, p, byB[base].map(function (u) { return u.id; }), pick.id, pick.mode); });
      });
    })();

    // ---------- Sea ----------
    (function sea() {
      var byAt = {};
      mine(function (u) { return SF.isNaval(u) && u.type !== "transport"; }).forEach(function (u) { (byAt[u.at] = byAt[u.at] || []).push(u); });
      Object.keys(byAt).forEach(function (at) {
        var ships = byAt[at];
        var targets = SF.reachable(state, p, ships).filter(function (id) {
          return SF.sq(id).terrain.key === "ocean" && seen(id).some(SF.isNaval);
        });
        for (var i = 0; i < targets.length; i++) {
          if (SF.attackOdds(state, p, ships, targets[i]) >= D.attackOdds) {
            var t = targets[i];
            tryDo(function () { SF.addSail(state, p, ships.map(function (u) { return u.id; }), t, [], null); });
            return;
          }
        }
      });

      // Hard: invade a weakly held enemy coastal city by sea.
      if (!D.invade) return;
      mine(function (u) { return u.type === "transport" && SF.sq(u.at).terrain.key !== "ocean"; }).forEach(function (tr) {
        var troops = mine(function (u) {
          return u.at === tr.at && SF.isGround(u) && !garrison[u.id] && fighters.indexOf(u.type) !== -1;
        });
        if (troops.length < 3) return;
        var load = [], space = 0;
        troops.forEach(function (u) {
          if (space + SF.cargoSpace(u) <= SF.UNIT_TYPES.transport.capacity) { load.push(u); space += SF.cargoSpace(u); }
        });
        var plan = null;
        SF.reachable(state, p, [tr]).forEach(function (water) {
          if (plan || SF.sq(water).terrain.key !== "ocean") return;
          SF.landingSquares(water).forEach(function (land) {
            if (plan || enemyCities.indexOf(land) === -1 || !vis.wide[land]) return;
            if (SF.attackOdds(state, p, load, land, true) >= D.attackOdds) plan = { water: water, land: land };
          });
        });
        if (plan) {
          tryDo(function () {
            SF.addSail(state, p, [tr.id], plan.water, load.map(function (u) { return u.id; }), plan.land);
          });
        }
      });
    })();

    // ---------- Building ----------
    (function build() {
      var e = state.econ[p];
      function can(city, type) { return !SF.unitProblem(state, p, city, type); }
      function make(city, type) { return tryDo(function () { SF.startUnit(state, p, city, type); }); }
      var front = myCities.slice().sort(function (a, b) {
        return SF.distance(a, SF.capitalOf(foe)) - SF.distance(b, SF.capitalOf(foe));
      });
      var count = {};
      state.units.forEach(function (u) { if (u.owner === p) count[u.type] = (count[u.type] || 0) + 1; });
      state.projects.forEach(function (pr) { if (pr.owner === p && pr.kind === "unit") count[pr.type] = (count[pr.type] || 0) + 1; });

      // Threatened cities get infantry first.
      myCities.forEach(function (c) {
        var t = threatAt(c);
        var held = SF.groundAt(state, c, p).length;
        for (var i = 0; i < 2 && t > held + i && can(c, "infantry"); i++) make(c, "infantry");
      });

      if (level !== "easy") {
        if ((count.fighter || 0) < 3) myCities.some(function (c) { return can(c, "fighter") && make(c, "fighter"); });
        if (level === "hard" && (count.bomber || 0) < 2) myCities.some(function (c) { return can(c, "bomber") && make(c, "bomber"); });
        if (level === "hard" && (count.transport || 0) < 1) myCities.some(function (c) { return can(c, "transport") && make(c, "transport"); });
        if (SF.hasTech(state, p, "bomb") && e.industry >= 70) myCities.some(function (c) { return can(c, "warhead") && make(c, "warhead"); });
        if (level === "hard" && state.turn >= 10 && (count.missile || 0) < 4 && e.industry >= 40) {
          front.some(function (c) { return can(c, "missile") && make(c, "missile"); });
        }
        if (SF.hasTech(state, p, "satellites") && SF.satellites(state, p).length < 2 && e.industry >= 50) {
          myCities.some(function (c) { return can(c, "satellite") && make(c, "satellite"); });
        }
      }

      // The main army: about one tank for every two infantry, and some artillery.
      for (var n = 0; n < 6; n++) {
        var tanks = count.tank || 0, inf = count.infantry || 0, art = count.artillery || 0;
        var type = tanks * 2 < inf ? "tank" : art * 4 < tanks + inf ? "artillery" : "infantry";
        if (level === "easy" && type === "artillery") type = "infantry";
        var city = front.filter(function (c) { return can(c, type); })[0];
        if (!city && type !== "infantry") { type = "infantry"; city = front.filter(function (c) { return can(c, type); })[0]; }
        if (!city) break;
        if (!make(city, type)) break;
        count[type] = (count[type] || 0) + 1;
      }

      // Buildings with spare industry.
      if (level !== "easy" && e.industry >= 30) {
        var want = gov === "scientific" ? "lab" : "factory";
        myCities.some(function (c) {
          return !SF.buildingProblem(state, p, c, want) && tryDo(function () { SF.startBuilding(state, p, c, want); });
        });
      }
    })();
  };
})(window.SF);
