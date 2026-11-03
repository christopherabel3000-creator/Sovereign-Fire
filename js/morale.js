// Sovereign Fire: nations, governments, morale, and victory.
(function (SF) {
  "use strict";

  // income: multipliers on each resource. lossRate: how hard bad news hits morale.
  SF.GOVERNMENTS = {
    democracy: {
      name: "Democracy",
      desc: "Science up 25% and industry up 10%. Losses, bombing, and lost cities hurt morale 50% more. Once per game, when the capital is threatened or morale is below 40, you can rally the nation for 20 morale.",
      income: { science: 1.25, industry: 1.1 },
      lossRate: 1.5,
      nukeRate: 1,
      ability: "rally"
    },
    authoritarian: {
      name: "Authoritarian State",
      desc: "Losses, bombing, and lost cities hurt morale 40% less. Science down 25%. Every 8 turns, you can order an emergency draft for 8 recruits, at a cost of 3 morale.",
      income: { science: 0.75 },
      lossRate: 0.6,
      nukeRate: 0.5,
      ability: "draft"
    },
    military: {
      name: "Military State",
      desc: "Units cost 20% less industry and take 1 less turn to build, but never less than 1. Industry and science down 20%. Morale falls 2 a turn if you have not won a battle in the last 3 turns. Once per game, mass conscription gives 12 recruits and 4 infantry at your capital.",
      income: { industry: 0.8, science: 0.8 },
      lossRate: 1,
      nukeRate: 0.75,
      unitDiscount: 0.2,
      fasterBuild: 1,
      restless: true,
      ability: "conscription"
    },
    scientific: {
      name: "Scientific Republic",
      desc: "Science up 50%. Manpower down 20%. Once per game, a research breakthrough gives 40 science.",
      income: { science: 1.5 },
      manpower: 0.8,
      lossRate: 1,
      nukeRate: 1,
      ability: "breakthrough"
    }
  };
  SF.GOVERNMENT_ORDER = ["democracy", "authoritarian", "military", "scientific"];

  SF.ABILITIES = {
    rally: { name: "Rally the nation", once: true },
    draft: { name: "Emergency draft", every: 8 },
    conscription: { name: "Mass conscription", once: true },
    breakthrough: { name: "Research breakthrough", once: true }
  };

  SF.NATION_NAMES = [
    "Valdoria", "Kestria", "Norvane", "Aldermark", "Seravia", "Drovinia", "Calvane", "Morvessa",
    "Thalgria", "Ostmere", "Varnholt", "Celdora", "Brennick", "Lustravia", "Quellan", "Tarvessa"
  ];
  SF.NATION_FORMS = {
    democracy: ["Republic of ", "Commonwealth of ", "Federation of "],
    authoritarian: ["People's Republic of ", "Union of ", "Dominion of "],
    military: ["Military Republic of ", "Directorate of ", "State of "],
    scientific: ["Scientific Republic of ", "Technate of ", "Republic of "]
  };

  SF.randomNationName = function (gov, avoid) {
    var forms = SF.NATION_FORMS[gov] || ["Republic of "];
    for (var i = 0; i < 20; i++) {
      var n = forms[Math.floor(Math.random() * forms.length)] +
        SF.NATION_NAMES[Math.floor(Math.random() * SF.NATION_NAMES.length)];
      if (n !== avoid) return n;
    }
    return "Republic of Kestria";
  };

  // Morale numbers.
  SF.MORALE_START = 100;
  SF.MORALE = {
    unitLost: 0.5,        // per ground unit lost
    bigUnitLost: 1,       // per ship or plane lost
    buildingWrecked: 2,   // per building destroyed by bombs or missiles
    cityStruck: 1,        // per bombing raid or missile strike that lands on one of your cities
    cityLost: 8,
    capitalLost: 20,
    cityTaken: 4,
    capitalTaken: 10,
    cityRetaken: 6,
    battleWon: 1,         // up to 3 a turn
    battleWonMax: 3,
    blockade: 1,          // per blockaded port, each turn
    restless: 2,          // Military State, without a win in 3 turns
    rally: 20,
    draftCost: 3
  };

  SF.capitalOf = function (owner) { return owner === 0 ? "F2" : SF.mirrorId("F2"); };

  SF.initNations = function (state) {
    state.nations = [0, 1].map(function (owner) {
      return { name: owner === 0 ? "North" : "South", gov: "democracy", morale: SF.MORALE_START,
        used: {}, lastWin: 0 };
    });
  };

  SF.nation = function (state, owner) {
    if (!state.nations) SF.initNations(state);
    return state.nations[owner];
  };
  SF.gov = function (state, owner) {
    return SF.GOVERNMENTS[SF.nation(state, owner).gov] || SF.GOVERNMENTS.democracy;
  };

  SF.setNation = function (state, owner, name, gov) {
    if (!SF.GOVERNMENTS[gov]) throw new Error("Bad government");
    name = String(name || "").trim().slice(0, 40);
    if (!name) throw new Error("Choose a name");
    var n = SF.nation(state, owner);
    n.name = name;
    n.gov = gov;
    // A Scientific Republic has less manpower, so start it with a workforce that fits.
    if (state.econ && gov === "scientific") {
      state.econ[owner].workers = { factory: 6, refinery: 3, lab: 6, recruit: 1 };
    } else if (state.econ) {
      state.econ[owner].workers = JSON.parse(JSON.stringify(SF.DEFAULT_WORKERS));
    }
  };

  // ---------- Abilities ----------

  // Enemy ground units within 2 squares of your capital.
  SF.capitalThreatened = function (state, owner) {
    var cap = SF.capitalOf(owner);
    return state.units.some(function (u) {
      return u.owner !== owner && SF.isGround(u) && SF.distance(u.at, cap) <= 2;
    });
  };

  // Why the government's ability cannot be used now, or null.
  SF.abilityProblem = function (state, owner) {
    var g = SF.gov(state, owner), n = SF.nation(state, owner), a = SF.ABILITIES[g.ability];
    if (a.once && n.used[g.ability]) return "Already used.";
    if (a.every && n.used[g.ability] && state.turn - n.used[g.ability] < a.every) {
      return "Ready again on turn " + (n.used[g.ability] + a.every) + ".";
    }
    if (g.ability === "rally" && !SF.capitalThreatened(state, owner) && n.morale >= 40) {
      return "Only when enemy troops are within 2 squares of your capital, or morale is below 40.";
    }
    if (g.ability === "conscription" && !SF.citiesOf(state, owner).length) return "You hold no cities.";
    return null;
  };

  SF.useAbility = function (state, owner) {
    var problem = SF.abilityProblem(state, owner);
    if (problem) throw new Error(problem);
    var g = SF.gov(state, owner), n = SF.nation(state, owner), e = state.econ[owner];
    n.used[g.ability] = state.turn;
    if (g.ability === "rally") {
      n.morale = Math.min(100, n.morale + SF.MORALE.rally);
      return "The nation rallies. Morale up " + SF.MORALE.rally + ".";
    }
    if (g.ability === "draft") {
      e.recruits += 8;
      n.morale = Math.max(1, n.morale - SF.MORALE.draftCost);
      return "Emergency draft: 8 recruits. Morale down " + SF.MORALE.draftCost + ".";
    }
    if (g.ability === "conscription") {
      var cities = SF.citiesOf(state, owner);
      var at = cities.indexOf(SF.capitalOf(owner)) !== -1 ? SF.capitalOf(owner) : cities[0];
      e.recruits += 12;
      for (var i = 0; i < 4; i++) state.units.push({ id: state.nextUnitId++, type: "infantry", owner: owner, at: at });
      return "Mass conscription: 12 recruits, and 4 infantry at " + at + ".";
    }
    if (g.ability === "breakthrough") {
      e.science += 40;
      return "Research breakthrough: 40 science.";
    }
    return "";
  };

  // ---------- Morale each turn ----------

  // tally: { lost: [n, n], wrecked: [..], struck: [..], wins: [..] } gathered
  // during the turn. Writes a "morale" event for each side.
  SF.applyMorale = function (state, events, tally) {
    var M = SF.MORALE;
    // Work out each side's launch cost from who had used them before this turn.
    var firstCost = [0, 1].map(function (o) { return SF.nukeMoraleCost(state, o); });
    if (tally.launched) {
      var l0 = tally.launched[0] > 0, l1 = tally.launched[1] > 0;
      if (state.firstNuke === null || state.firstNuke === undefined) {
        if (l0 && l1) state.firstNuke = "both";
        else if (l0) state.firstNuke = 0;
        else if (l1) state.firstNuke = 1;
      }
    }
    [0, 1].forEach(function (owner) {
      var n = SF.nation(state, owner), g = SF.gov(state, owner);
      var reasons = [];
      var down = 0, up = 0;
      function bad(amount, why) { if (amount > 0) { down += amount * g.lossRate; reasons.push(why); } }
      function good(amount, why) { if (amount > 0) { up += amount; reasons.push(why); } }

      bad(tally.lost[owner], "losses in battle");
      bad(tally.wrecked[owner] * M.buildingWrecked, "buildings destroyed");
      bad(tally.struck[owner] * M.cityStruck, "cities bombed");
      events.forEach(function (e) {
        if (e.type !== "cityCaptured") return;
        var capital = e.at === SF.capitalOf(e.from);
        if (e.from === owner) bad(capital ? M.capitalLost : M.cityLost, capital ? "the capital fell" : "a city lost");
        if (e.owner === owner) {
          if (SF.sq(e.at).home === owner) good(M.cityRetaken, "a city retaken");
          else good(capital ? M.capitalTaken : M.cityTaken, capital ? "the enemy capital taken" : "a city captured");
        }
      });
      // Nuclear weapons. Morale lost to them is scaled by government:
      // half for an Authoritarian State, three quarters for a Military State.
      var nukeRate = g.nukeRate === undefined ? 1 : g.nukeRate;
      if (tally.nuked && tally.nuked[owner]) {
        down += tally.nuked[owner] * SF.NUKE.struck * nukeRate;
        reasons.push("nuclear attack");
      }
      // The first side to launch pays heavily, and a side striking back after
      // being hit first does not. Launching never takes your own morale below 15.
      var launchCost = 0, launchWhy = null;
      if (tally.launched && tally.launched[owner]) {
        for (var i = 0; i < tally.launched[owner]; i++) {
          launchCost += i === 0 ? firstCost[owner] : (firstCost[owner] ? SF.NUKE.laterUse : 0);
        }
        launchCost *= nukeRate;
        if (launchCost) launchWhy = firstCost[owner] === SF.NUKE.firstUse ? "using nuclear weapons first" : "using nuclear weapons";
      }
      var blockaded = SF.citiesOf(state, owner).filter(function (id) {
        return state.cities[id].buildings.port > 0 && SF.blockaded(state, id);
      }).length;
      if (blockaded) { down += blockaded * M.blockade; reasons.push("ports blockaded"); }
      var wins = Math.min(M.battleWonMax, tally.wins[owner]);
      if (tally.wins[owner]) n.lastWin = state.turn;
      good(wins * M.battleWon, "battles won");
      if (g.restless && state.turn - (n.lastWin || 0) >= 3) {
        down += M.restless;
        reasons.push("no recent victories");
      }

      var change = Math.round(up - down);
      var before = n.morale;
      n.morale = Math.max(0, Math.min(100, n.morale + change));
      if (launchCost) {
        var floor = SF.NUKE.launchFloor;
        var room = Math.max(0, n.morale - floor);
        var paid = Math.min(Math.round(launchCost), room);
        n.morale -= paid;
        reasons.push(paid ? launchWhy : launchWhy + ", which cannot take morale below " + floor);
      }
      if (n.morale !== before || launchCost) {
        events.push({ type: "morale", owner: owner, from: before, to: n.morale, reasons: reasons });
      }
    });
  };

  // ---------- Victory ----------

  // Returns { winner: 0, 1 or "draw", reason, loser } or null.
  SF.checkVictory = function (state) {
    var out = [0, 1].map(function (owner) {
      var cities = SF.citiesOf(state, owner).length;
      var units = state.units.filter(function (u) { return u.owner === owner; }).length;
      if (!cities) return "conquest";
      if (!units) {
        // With no units left, a side is beaten unless it can still build.
        var e = state.econ[owner];
        var canBuild = e.industry >= SF.unitCost(state, owner, "infantry").industry || SF.income(state, owner).industry > 0;
        if (!canBuild) return "annihilation";
      }
      if (SF.nation(state, owner).morale <= 0) return "surrender";
      return null;
    });
    if (out[0] && out[1]) return { winner: "draw", reasons: out };
    if (out[0]) return { winner: 1, loser: 0, reason: out[0] };
    if (out[1]) return { winner: 0, loser: 1, reason: out[1] };
    return null;
  };

  // A rough word for the enemy's morale, as the news would report it.
  SF.moraleWord = function (m) {
    if (m >= 80) return "high";
    if (m >= 60) return "steady";
    if (m >= 40) return "shaken";
    if (m >= 20) return "low";
    return "near breaking";
  };
})(window.SF);
