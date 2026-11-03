// Sovereign Fire: economy (cities, manpower, workforce, buildings, production).
(function (SF) {
  "use strict";

  // ---------- Data ----------

  // North's cities. South's are the mirror image.
  // pop: manpower each turn. slots: how many buildings fit.
  SF.CITY_INFO = {
    F2: { pop: 6, slots: 5 },
    C3: { pop: 3, slots: 3 },
    L3: { pop: 3, slots: 3 },
    O3: { pop: 3, slots: 3 },
    A5: { pop: 2, slots: 2 },
    E6: { pop: 2, slots: 2 },
    I6: { pop: 2, slots: 2 }
  };

  SF.BUILDINGS = {
    factory: { name: "factory", plural: "factories", job: "factory", cost: 12, turns: 3 },
    refinery: { name: "refinery", plural: "refineries", job: "refinery", cost: 12, turns: 3 },
    lab: { name: "lab", plural: "labs", job: "lab", cost: 12, turns: 3 },
    airfield: { name: "airfield", plural: "airfields", cost: 15, turns: 3 },
    port: { name: "port", plural: "ports", cost: 12, turns: 3, coastal: true }
  };
  SF.BUILDING_ORDER = ["factory", "refinery", "lab", "airfield", "port"];

  // "a factory", "an airfield"
  SF.withArticle = function (word) { return (/^[aeiou]/i.test(word) ? "an " : "a ") + word; };
  SF.WORKERS_PER_BUILDING = 3;

  // Workforce jobs. Each worker produces 1 of its resource each turn, up to
  // what your buildings can use. Recruits need no building.
  SF.JOBS = {
    factory: { name: "factory workers", resource: "industry", building: "factory" },
    refinery: { name: "refinery workers", resource: "gasoline", building: "refinery" },
    lab: { name: "lab workers", resource: "science", building: "lab" },
    recruit: { name: "recruits", resource: "recruits", building: null }
  };
  SF.JOB_ORDER = ["factory", "refinery", "lab", "recruit"];
  SF.RESOURCES = ["industry", "gasoline", "science", "recruits"];

  // What units cost to build. needs: building required in that city.
  SF.UNIT_COST = {
    infantry: { industry: 3, recruits: 2, turns: 1 },
    engineer: { industry: 4, recruits: 1, turns: 1 },
    antiAir: { industry: 5, recruits: 1, turns: 1 },
    artillery: { industry: 6, recruits: 1, turns: 2, needs: "factory" },
    tank: { industry: 10, recruits: 1, turns: 2, needs: "factory" },
    specialForces: { industry: 8, recruits: 2, turns: 2 },
    scoutPlane: { industry: 8, recruits: 1, gasoline: 2, turns: 2, needs: "airfield" },
    fighter: { industry: 10, recruits: 1, gasoline: 3, turns: 2, needs: "airfield" },
    bomber: { industry: 14, recruits: 1, gasoline: 4, turns: 2, needs: "airfield" },
    destroyer: { industry: 12, recruits: 2, gasoline: 4, turns: 2, needs: "port" },
    submarine: { industry: 12, recruits: 2, gasoline: 4, turns: 2, needs: "port" },
    transport: { industry: 8, recruits: 1, gasoline: 3, turns: 2, needs: "port" },
    carrier: { industry: 24, recruits: 3, gasoline: 8, turns: 4, needs: "port" }
  };

  SF.START_BUDGET = 10;   // starting buildings, chosen before the game
  SF.DEFAULT_PLAN = {
    F2: { factory: 1, lab: 1, airfield: 1 },
    C3: { refinery: 1, lab: 1 },
    L3: { factory: 1, refinery: 1 },
    O3: { factory: 1 },
    A5: { lab: 1 },
    E6: { port: 1 }
  };
  SF.START_STOCK = { industry: 20, gasoline: 10, science: 0, recruits: 6 };
  SF.DEFAULT_WORKERS = { factory: 9, refinery: 3, lab: 6, recruit: 3 };
  SF.CAPTURE_RATE = 0.25;       // captured enemy cities produce at 25%...
  SF.CAPTURE_TURNS = 3;         // ...for their first 3 turns

  // ---------- Setup ----------

  function homeInfo(id) {
    var sq = SF.sq(id);
    var northId = sq.home === 0 ? id : SF.mirrorId(id);
    return SF.CITY_INFO[northId];
  }
  SF.cityInfo = homeInfo;

  function emptyBuildings() {
    var b = {};
    SF.BUILDING_ORDER.forEach(function (k) { b[k] = 0; });
    return b;
  }

  SF.initEconomy = function (state) {
    state.cities = {};
    SF.allSquares().forEach(function (sq) {
      if (sq.terrain.key !== "city") return;
      state.cities[sq.id] = { owner: sq.home, captured: null, buildings: emptyBuildings() };
    });
    state.econ = [0, 1].map(function () {
      var e = { workers: {} };
      SF.RESOURCES.forEach(function (r) { e[r] = SF.START_STOCK[r]; });
      SF.JOB_ORDER.forEach(function (j) { e.workers[j] = SF.DEFAULT_WORKERS[j]; });
      return e;
    });
    state.projects = [];
    state.nextProjectId = 1;
    state.setupDone = [false, false];
  };

  // A plan is { cityId: { factory: n, ... } } using that side's city ids.
  SF.planCost = function (plan) {
    var n = 0;
    Object.keys(plan).forEach(function (id) {
      SF.BUILDING_ORDER.forEach(function (k) { n += plan[id][k] || 0; });
    });
    return n;
  };

  SF.planProblem = function (owner, plan) {
    var cost = SF.planCost(plan);
    if (cost > SF.START_BUDGET) return "That is " + cost + " buildings. The limit is " + SF.START_BUDGET + ".";
    var bad = null;
    Object.keys(plan).forEach(function (id) {
      var sq = SF.sq(id);
      if (!sq || sq.terrain.key !== "city" || sq.home !== owner) { bad = "Bad city " + id; return; }
      var used = 0;
      SF.BUILDING_ORDER.forEach(function (k) { used += plan[id][k] || 0; });
      if (used > homeInfo(id).slots) bad = id + " only has room for " + homeInfo(id).slots + " buildings.";
      if ((plan[id].port || 0) > 0 && !SF.isCoastal(sq)) bad = "Ports can only go in coastal cities. " + id + " is inland.";
    });
    return bad;
  };

  // The default plan for either side.
  SF.defaultPlan = function (owner) {
    var plan = {};
    Object.keys(SF.DEFAULT_PLAN).forEach(function (id) {
      var key = owner === 0 ? id : SF.mirrorId(id);
      plan[key] = JSON.parse(JSON.stringify(SF.DEFAULT_PLAN[id]));
    });
    return plan;
  };

  SF.applyPlan = function (state, owner, plan) {
    var problem = SF.planProblem(owner, plan);
    if (problem) throw new Error(problem);
    Object.keys(plan).forEach(function (id) {
      SF.BUILDING_ORDER.forEach(function (k) { state.cities[id].buildings[k] = plan[id][k] || 0; });
    });
    state.setupDone[owner] = true;
  };

  // ---------- Cities ----------

  SF.citiesOf = function (state, owner) {
    return Object.keys(state.cities).filter(function (id) { return state.cities[id].owner === owner; })
      .sort(function (a, b) {
        var sa = SF.sq(a), sb = SF.sq(b);
        return sa.row - sb.row || sa.col - sb.col;
      });
  };

  // 1, or 0.25 for an enemy city captured in the last 3 turns.
  SF.cityRate = function (state, id) {
    var c = state.cities[id];
    if (c.captured === null) return 1;
    return state.turn - c.captured < SF.CAPTURE_TURNS ? SF.CAPTURE_RATE : 1;
  };

  SF.buildingCount = function (state, id) {
    var b = state.cities[id].buildings, n = 0;
    SF.BUILDING_ORDER.forEach(function (k) { n += b[k]; });
    return n;
  };

  // Buildings plus buildings under construction.
  SF.slotsUsed = function (state, id) {
    var n = SF.buildingCount(state, id);
    state.projects.forEach(function (p) { if (p.city === id && p.kind === "building") n++; });
    return n;
  };

  SF.manpower = function (state, owner) {
    var total = 0;
    SF.citiesOf(state, owner).forEach(function (id) { total += homeInfo(id).pop * SF.cityRate(state, id); });
    return Math.floor(total);
  };

  // How many workers this side's buildings can use in a job.
  SF.capacity = function (state, owner, job) {
    var building = SF.JOBS[job].building;
    if (!building) return Infinity;
    var total = 0;
    SF.citiesOf(state, owner).forEach(function (id) {
      total += state.cities[id].buildings[building] * SF.WORKERS_PER_BUILDING * SF.cityRate(state, id);
    });
    return Math.floor(total);
  };

  // Workers actually on the job. If cities were lost and there are fewer
  // people than assigned, jobs are filled in order until people run out.
  SF.staffed = function (state, owner) {
    var left = SF.manpower(state, owner);
    var w = state.econ[owner].workers, out = {};
    SF.JOB_ORDER.forEach(function (j) {
      out[j] = Math.min(w[j], left);
      left -= out[j];
    });
    return out;
  };

  SF.income = function (state, owner) {
    var staffed = SF.staffed(state, owner), out = {};
    SF.JOB_ORDER.forEach(function (j) {
      out[SF.JOBS[j].resource] = Math.min(staffed[j], SF.capacity(state, owner, j));
    });
    return out;
  };

  SF.setWorkers = function (state, owner, workers) {
    var total = 0;
    SF.JOB_ORDER.forEach(function (j) {
      var n = workers[j];
      if (!(n >= 0) || Math.floor(n) !== n) throw new Error("Bad number");
      total += n;
    });
    if (total > SF.manpower(state, owner)) throw new Error("Not enough manpower");
    SF.JOB_ORDER.forEach(function (j) { state.econ[owner].workers[j] = workers[j]; });
  };

  // ---------- Production ----------

  // Why a unit cannot be built here right now, or null if it can.
  SF.unitProblem = function (state, owner, city, type) {
    var c = state.cities[city], cost = SF.UNIT_COST[type], e = state.econ[owner];
    if (!c || c.owner !== owner) return "You do not hold " + city + ".";
    if (cost.needs && !c.buildings[cost.needs]) return "Needs " + SF.withArticle(SF.BUILDINGS[cost.needs].name) + " in this city.";
    if (SF.UNIT_TYPES[type].naval && SF.blockaded(state, city)) return "The port is blockaded by enemy warships.";
    if (e.industry < cost.industry) return "Needs " + cost.industry + " industry. You have " + e.industry + ".";
    if (e.recruits < cost.recruits) return "Needs " + cost.recruits + " recruits. You have " + e.recruits + ".";
    if (e.gasoline < (cost.gasoline || 0)) return "Needs " + cost.gasoline + " gasoline. You have " + e.gasoline + ".";
    return null;
  };

  SF.buildingProblem = function (state, owner, city, type) {
    var c = state.cities[city], b = SF.BUILDINGS[type], e = state.econ[owner];
    if (!c || c.owner !== owner) return "You do not hold " + city + ".";
    if (SF.slotsUsed(state, city) >= homeInfo(city).slots) return "No room for more buildings here.";
    if (b.coastal && !SF.isCoastal(SF.sq(city))) return "Only coastal cities can have a port.";
    if (e.industry < b.cost) return "Needs " + b.cost + " industry. You have " + e.industry + ".";
    return null;
  };

  SF.startUnit = function (state, owner, city, type) {
    var problem = SF.unitProblem(state, owner, city, type);
    if (problem) throw new Error(problem);
    var cost = SF.UNIT_COST[type], e = state.econ[owner];
    e.industry -= cost.industry;
    e.recruits -= cost.recruits;
    e.gasoline -= cost.gasoline || 0;
    var p = {
      id: state.nextProjectId++, owner: owner, city: city, kind: "unit", type: type,
      turnsLeft: cost.turns, started: state.turn,
      paid: { industry: cost.industry, recruits: cost.recruits, gasoline: cost.gasoline || 0 }
    };
    state.projects.push(p);
    return p;
  };

  SF.startBuilding = function (state, owner, city, type) {
    var problem = SF.buildingProblem(state, owner, city, type);
    if (problem) throw new Error(problem);
    var b = SF.BUILDINGS[type];
    state.econ[owner].industry -= b.cost;
    var p = {
      id: state.nextProjectId++, owner: owner, city: city, kind: "building", type: type,
      turnsLeft: b.turns, started: state.turn, paid: { industry: b.cost, recruits: 0 }
    };
    state.projects.push(p);
    return p;
  };

  // Projects can be canceled for a full refund in the turn they were started.
  SF.canCancelProject = function (state, p) { return p.started === state.turn; };

  SF.cancelProject = function (state, owner, id) {
    var p = state.projects.filter(function (x) { return x.id === id && x.owner === owner; })[0];
    if (!p || !SF.canCancelProject(state, p)) throw new Error("Cannot cancel");
    state.econ[owner].industry += p.paid.industry;
    state.econ[owner].recruits += p.paid.recruits;
    state.econ[owner].gasoline += p.paid.gasoline || 0;
    state.projects = state.projects.filter(function (x) { return x !== p; });
  };

  SF.projectName = function (p) {
    return p.kind === "unit" ? SF.UNIT_TYPES[p.type].name : SF.BUILDINGS[p.type].name;
  };

  // ---------- Turn steps ----------

  // Cities change hands when the other side's ground units hold them.
  SF.updateCityOwners = function (state, events) {
    Object.keys(state.cities).forEach(function (id) {
      var c = state.cities[id];
      var occ = SF.occupant(state, id);
      if (occ === null || occ === c.owner) return;
      var prev = c.owner;
      c.owner = occ;
      // Retaking your own city brings it back to full strength at once.
      c.captured = SF.sq(id).home === occ ? null : state.turn;
      var lost = state.projects.filter(function (p) { return p.city === id && p.owner === prev; });
      state.projects = state.projects.filter(function (p) { return lost.indexOf(p) === -1; });
      events.push({ type: "cityCaptured", owner: occ, from: prev, at: id, lost: lost.map(SF.projectName) });
    });
  };

  SF.advanceProjects = function (state, events) {
    var still = [];
    state.projects.forEach(function (p) {
      p.turnsLeft -= 1;
      if (p.turnsLeft > 0) { still.push(p); return; }
      if (p.kind === "unit") {
        state.units.push({ id: state.nextUnitId++, type: p.type, owner: p.owner, at: p.city });
      } else {
        state.cities[p.city].buildings[p.type] += 1;
      }
      events.push({ type: "built", owner: p.owner, at: p.city, what: SF.projectName(p), kind: p.kind });
    });
    state.projects = still;
  };

  SF.collectIncome = function (state, events) {
    [0, 1].forEach(function (owner) {
      var inc = SF.income(state, owner), e = state.econ[owner];
      SF.RESOURCES.forEach(function (r) { e[r] += inc[r]; });
      events.push({ type: "income", owner: owner, income: inc });
    });
  };

  // A port city is blockaded when enemy warships sit on a square touching it.
  SF.blockaded = function (state, city) {
    var owner = state.cities[city] ? state.cities[city].owner : null;
    return SF.around(city, 1).some(function (id) {
      return state.units.some(function (u) {
        return u.at === id && u.owner !== owner && SF.isNaval(u) && u.type !== "transport" && !u.aboard;
      });
    });
  };

  // ---------- Computer opponent ----------

  // For now the computer only defends: it keeps the default workforce and
  // spends its industry on infantry in the cities nearest the front.
  SF.computerEconomy = function (state) {
    var cities = SF.citiesOf(state, 1).sort(function (a, b) { return SF.sq(a).row - SF.sq(b).row; });
    var built = 0;
    for (var i = 0; built < 3 && i < cities.length * 3; i++) {
      var city = cities[i % cities.length];
      if (SF.unitProblem(state, 1, city, "infantry")) break;
      SF.startUnit(state, 1, city, "infantry");
      built++;
    }
  };
})(window.SF);
