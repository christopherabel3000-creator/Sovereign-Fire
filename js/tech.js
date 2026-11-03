// Sovereign Fire: science, the technology tree, and satellites.
(function (SF) {
  "use strict";

  // mods: changes to unit numbers, by unit type.
  // effects: other changes, read with SF.effect.
  // hint: what the other side may notice in battle once you have it.
  SF.TECHS = [
    // Land
    { id: "armor", branch: "land", tier: 1, cost: 20, name: "Composite armor",
      desc: "Tanks gain 1 attack and 1 defense.",
      mods: { tank: { attack: 1, defense: 1 } },
      hint: "Enemy tanks seem better armored than before." },
    { id: "mechanized", branch: "land", tier: 2, cost: 45, name: "Mechanized infantry",
      desc: "Infantry move 3 squares a turn and gain 1 defense.",
      mods: { infantry: { move: 1, defense: 1 } },
      hint: "Enemy infantry seem tougher, and they move faster than before." },
    { id: "mbt", branch: "land", tier: 3, cost: 80, name: "Main battle tanks",
      desc: "Tanks gain 2 more attack and 1 more defense, and move 4 squares a turn.",
      mods: { tank: { attack: 2, defense: 1, move: 1 } },
      hint: "Enemy tanks hit far harder than before." },

    // Sea
    { id: "sonar", branch: "sea", tier: 1, cost: 20, name: "Improved sonar",
      desc: "Destroyers find submarines up to 3 squares away and gain 1 attack.",
      mods: { destroyer: { sonar: 1, attack: 1 } },
      hint: "Enemy destroyers seem to find and hit targets more easily." },
    { id: "subs", branch: "sea", tier: 2, cost: 45, name: "Attack submarines",
      desc: "Submarines gain 2 attack and move 4 squares a turn.",
      mods: { submarine: { attack: 2, move: 1 } },
      hint: "Enemy submarines strike harder than before." },
    { id: "aegis", branch: "sea", tier: 3, cost: 80, name: "Aegis combat system",
      desc: "Destroyers gain 1 defense, and get 2 shots a turn at missiles, each 75% to stop one.",
      mods: { destroyer: { defense: 1 } },
      effects: { destroyerMissileShots: 1, destroyerMissileChance: 0.15 },
      hint: "Enemy destroyers seem much better at stopping missiles." },

    // Air
    { id: "jets", branch: "air", tier: 1, cost: 20, name: "Jet fighters",
      desc: "Fighters gain 1 attack, 1 defense, and 2 squares of range.",
      mods: { fighter: { attack: 1, defense: 1, range: 2 } },
      hint: "Enemy fighters seem faster and deadlier than before." },
    { id: "heavyBombers", branch: "air", tier: 2, cost: 45, name: "Heavy bombers",
      desc: "Bombers gain 2 squares of range, and each one is 15% more likely to hit.",
      mods: { bomber: { range: 2 } },
      effects: { bombChance: 0.15 },
      hint: "Enemy bombers seem to carry heavier loads than before." },
    { id: "stealth", branch: "air", tier: 3, cost: 80, name: "Stealth aircraft",
      desc: "Bombers gain 4 defense against fighters, and anti-aircraft fire is half as likely to hit them.",
      mods: { bomber: { defense: 4 } },
      effects: { stealth: 1 },
      hint: "Enemy bombers are strangely hard to catch." },

    // Missiles and defense
    { id: "guided", branch: "missiles", tier: 1, cost: 20, name: "Guided missiles",
      desc: "Missiles are 15% more likely to destroy their targets.",
      effects: { missileHit: 0.15 },
      hint: "Enemy missiles seem more accurate than before." },
    { id: "layered", branch: "missiles", tier: 2, cost: 45, name: "Layered missile defense",
      desc: "Missile defense batteries get 3 shots a turn instead of 2, and each is 10% more likely to stop a missile.",
      effects: { missileDefenseShots: 1, missileDefenseChance: 0.1 },
      hint: "Enemy missile defenses stopped more missiles than expected." },
    { id: "asat", branch: "missiles", tier: 3, cost: 80, name: "Anti-satellite missiles",
      desc: "Missiles can be fired at enemy satellites. Each has a 50% chance to destroy one.",
      effects: { asat: 1 } },

    // Intelligence
    { id: "codebreaking", branch: "intel", tier: 1, cost: 20, name: "Code breaking",
      desc: "You can see which technologies the enemy has researched." ,
      effects: { codebreaking: 1 } },
    { id: "satellites", branch: "intel", tier: 2, cost: 45, name: "Satellites",
      desc: "Cities with a factory can build satellites. Each watches a 7 by 7 area of your choosing, and makes your missiles and missile defense 5% more accurate, up to 20%.",
      effects: { satellites: 1 } },
    { id: "deepCover", branch: "intel", tier: 3, cost: 80, name: "Deep cover agents",
      desc: "Scout planes and satellites can spot special forces and submarines.",
      effects: { deepCover: 1 } },

    // Economy
    { id: "automation", branch: "economy", tier: 1, cost: 20, name: "Factory automation",
      desc: "Each factory can use 4 workers instead of 3.",
      effects: { factoryCap: 1 } },
    { id: "refining", branch: "economy", tier: 2, cost: 45, name: "Advanced refining",
      desc: "Each refinery and lab can use 1 more worker.",
      effects: { refineryCap: 1, labCap: 1 } },
    { id: "massProduction", branch: "economy", tier: 3, cost: 80, name: "Mass production",
      desc: "All units cost 20% less industry, rounded down.",
      effects: { discount: 0.2 } },

    // Nuclear
    { id: "physics", branch: "nuclear", tier: 1, cost: 30, name: "Nuclear physics",
      desc: "The first step toward nuclear power and weapons. No effect on its own." },
    { id: "power", branch: "nuclear", tier: 2, cost: 60, name: "Nuclear power",
      desc: "Each factory and refinery can use 1 more worker.",
      effects: { factoryCap: 1, refineryCap: 1 } },
    { id: "bomb", branch: "nuclear", tier: 3, cost: 120, name: "Nuclear weapons",
      desc: "Cities with a factory can build nuclear warheads, delivered by missile, bomber, or submarine.",
      effects: { nukes: 1 } }
  ];

  SF.BRANCHES = [
    ["land", "Land"], ["sea", "Sea"], ["air", "Air"], ["missiles", "Missiles and defense"],
    ["intel", "Intelligence"], ["economy", "Economy"], ["nuclear", "Nuclear"]
  ];

  SF.SATELLITE_RADIUS = 3;          // a satellite watches a 7 by 7 area
  SF.SATELLITE_BONUS = 0.05;        // missile accuracy and missile defense per satellite...
  SF.SATELLITE_BONUS_MAX = 0.2;     // ...up to this much
  SF.ASAT_CHANCE = 0.5;

  var byId = {};
  SF.TECHS.forEach(function (t) { byId[t.id] = t; });
  SF.tech = function (id) { return byId[id]; };

  function research(state, owner) {
    state.research = state.research || [0, 1].map(function () { return { done: [], queue: [] }; });
    return state.research[owner];
  }
  SF.researchOf = research;

  SF.hasTech = function (state, owner, id) { return research(state, owner).done.indexOf(id) !== -1; };

  // A unit number after this side's technology, such as tank attack.
  SF.stat = function (state, owner, type, key) {
    var v = SF.UNIT_TYPES[type][key] || 0;
    if (!state) return v;
    research(state, owner).done.forEach(function (id) {
      var m = byId[id].mods;
      if (m && m[type] && m[type][key]) v += m[type][key];
    });
    return v;
  };

  // The total of one effect across this side's technology.
  SF.effect = function (state, owner, key) {
    var v = 0;
    if (!state) return 0;
    research(state, owner).done.forEach(function (id) {
      var e = byId[id].effects;
      if (e && e[key]) v += e[key];
    });
    return v;
  };

  // The technology before this one in its branch, which must come first.
  SF.prerequisite = function (t) {
    return SF.TECHS.filter(function (x) { return x.branch === t.branch && x.tier === t.tier - 1; })[0] || null;
  };

  // Technologies that can be added to the end of the queue now.
  SF.queueable = function (state, owner) {
    var r = research(state, owner);
    var planned = r.done.concat(r.queue);
    return SF.TECHS.filter(function (t) {
      if (planned.indexOf(t.id) !== -1) return false;
      var pre = SF.prerequisite(t);
      return !pre || planned.indexOf(pre.id) !== -1;
    });
  };

  SF.queueTech = function (state, owner, id) {
    if (!SF.queueable(state, owner).some(function (t) { return t.id === id; })) throw new Error("Cannot queue that");
    research(state, owner).queue.push(id);
  };

  // Removing a technology also removes anything queued after it in the same branch.
  SF.unqueueTech = function (state, owner, id) {
    var r = research(state, owner), t = byId[id];
    r.queue = r.queue.filter(function (q) {
      var x = byId[q];
      return q !== id && !(x.branch === t.branch && x.tier > t.tier);
    });
  };

  // Move a technology one place earlier, if its prerequisite is still ahead of it.
  SF.moveTechUp = function (state, owner, id) {
    var r = research(state, owner), i = r.queue.indexOf(id);
    if (i <= 0) return false;
    var before = byId[r.queue[i - 1]], t = byId[id];
    if (before.branch === t.branch && before.tier < t.tier) return false;
    r.queue[i - 1] = id;
    r.queue[i] = before.id;
    return true;
  };

  // After income: finish whatever the saved science pays for, in queue order.
  // Science is never lost; it waits for something to be queued.
  SF.advanceResearch = function (state, events) {
    [0, 1].forEach(function (owner) {
      var r = research(state, owner), e = state.econ[owner];
      while (r.queue.length && e.science >= byId[r.queue[0]].cost) {
        var t = byId[r.queue.shift()];
        e.science -= t.cost;
        r.done.push(t.id);
        events.push({ type: "researched", owner: owner, tech: t.id });
      }
    });
  };

  // ---------- Satellites ----------

  SF.satellites = function (state, owner) {
    var s = (state.econ[owner].satellites = state.econ[owner].satellites || []);
    return s;
  };

  // Bonus to missile accuracy and missile defense from satellites in orbit.
  SF.satelliteBonus = function (state, owner) {
    return Math.min(SF.SATELLITE_BONUS_MAX, SF.satellites(state, owner).length * SF.SATELLITE_BONUS);
  };

  // Each satellite watches a square of its owner's choosing. New ones
  // watch the enemy capital until told otherwise.
  SF.launchSatellite = function (state, owner) {
    var capital = owner === 0 ? SF.mirrorId("F2") : "F2";
    SF.satellites(state, owner).push({ id: state.nextUnitId++, watch: capital });
  };

  SF.setSatelliteWatch = function (state, owner, satId, square) {
    if (!SF.sq(square)) throw new Error("Not a square");
    SF.satellites(state, owner).forEach(function (s) { if (s.id === satId) s.watch = square; });
  };

  // Anti-satellite missiles: each has a chance to destroy one enemy satellite.
  SF.addAsat = function (state, owner, ids) {
    if (!SF.effect(state, owner, "asat")) throw new Error("Needs anti-satellite missiles");
    if (!SF.satellites(state, 1 - owner).length) throw new Error("The enemy has no satellites");
    var ms = state.units.filter(function (u) { return ids.indexOf(u.id) !== -1; });
    if (ms.length !== ids.length) throw new Error("No missiles");
    ms.forEach(function (u) {
      if (u.type !== "missile" || u.owner !== owner || u.at !== ms[0].at) throw new Error("Bad missile");
      if (SF.orderFor(state, u.id)) throw new Error("Already has orders");
    });
    var order = { id: state.nextOrderId++, kind: "asat", unitIds: ids.slice(), from: ms[0].at, to: ms[0].at };
    state.orders[owner].push(order);
    return order;
  };
})(window.SF);
