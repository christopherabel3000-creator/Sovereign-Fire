// Sovereign Fire: online play through Firebase.
//
// Each online game is one record at sovereignFire/<CODE> in the shared
// Firebase Realtime Database: { ver, state, t, by, act }. state is the whole
// game, saved as text. The database only accepts a write whose ver is exactly
// one more than the stored one, so two players can never overwrite each other:
// if a write is turned down, the game is read again and the change retried.
//
// During a turn, each player only changes their own side: their orders,
// workforce, research, nation, production, and units. When one player locks
// in, their side is merged into the latest saved game. Whoever locks in second
// plays out the turn and saves the result for both.
(function (SF) {
  "use strict";

  var DB = "https://call-sheet-football-default-rtdb.firebaseio.com/sovereignFire/";
  var CLIENT = "c" + Math.random().toString(36).slice(2, 10);

  var online = SF.online = {
    fetch: function (url, opts) { return window.fetch(url, opts); },
    EventSource: typeof window.EventSource === "function" ? window.EventSource : null,
    source: null
  };

  function url(code) { return DB + code + ".json"; }

  online.randomCode = function () {
    var s = "";
    for (var i = 0; i < 4; i++) s += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return s;
  };

  online.cleanCode = function (text) {
    var c = String(text || "").toUpperCase().replace(/[^A-Z]/g, "");
    return /^[A-Z]{4}$/.test(c) ? c : null;
  };

  // Read a game. Resolves to { ver, state } or null if there is no such game.
  online.read = function (code) {
    return online.fetch(url(code), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Could not reach the game server.");
      return r.json();
    }).then(function (rec) {
      if (!rec || !rec.state) return null;
      return { ver: rec.ver, state: JSON.parse(rec.state) };
    });
  };

  // Write a game as version ver. Resolves to true, or false if someone else
  // saved first.
  online.write = function (code, ver, state, act) {
    var body = JSON.stringify({ ver: ver, state: JSON.stringify(state), t: { ".sv": "timestamp" }, by: CLIENT, act: act });
    return online.fetch(url(code), { method: "PUT", body: body, headers: { "Content-Type": "application/json" } })
      .then(function (r) {
        if (r.ok) return true;
        if (r.status === 401 || r.status === 403) return false;
        throw new Error("Could not save to the game server.");
      });
  };

  // Read the game, change it, and save it, retrying if someone else saved
  // in between. change(state) returns an action name, or null to save nothing.
  online.update = function (code, change, tries) {
    tries = tries === undefined ? 6 : tries;
    return online.read(code).then(function (rec) {
      if (!rec) throw new Error("That game no longer exists.");
      var act = change(rec.state);
      if (!act) return rec.state;
      return online.write(code, rec.ver + 1, rec.state, act).then(function (ok) {
        if (ok) return rec.state;
        if (tries <= 0) throw new Error("The game is busy. Try again in a moment.");
        return online.update(code, change, tries - 1);
      });
    });
  };

  // Start a new game under a fresh code.
  online.create = function (state, tries) {
    tries = tries === undefined ? 5 : tries;
    var code = online.randomCode();
    return online.write(code, 1, state, "create").then(function (ok) {
      if (ok) return code;
      if (tries <= 0) throw new Error("Could not find a free game code. Try again.");
      return online.create(state, tries - 1);
    });
  };

  // Call back whenever the saved game changes. Uses Firebase's live stream
  // where the browser supports it, and checks every few seconds otherwise.
  online.listen = function (code, onChange) {
    online.stop();
    var lastVer = null;
    function check() {
      online.read(code).then(function (rec) {
        if (rec && rec.ver !== lastVer) {
          lastVer = rec.ver;
          onChange(rec.state, rec.ver);
        }
      }).catch(function () { /* try again next time */ });
    }
    if (online.EventSource) {
      try {
        var es = new online.EventSource(url(code));
        es.addEventListener("put", check);
        es.addEventListener("patch", check);
        online.source = es;
      } catch (e) { online.source = null; }
    }
    // A slow backup check, in case the stream drops.
    online.timer = setInterval(check, online.source ? 15000 : 4000);
    check();
  };

  online.stop = function () {
    if (online.source) { try { online.source.close(); } catch (e) { /* ignore */ } }
    online.source = null;
    if (online.timer) clearInterval(online.timer);
    online.timer = null;
  };

  // Copy one side's own changes from local into remote. Used during a turn,
  // when each player only changes their own side.
  SF.mergeSide = function (remote, local, side) {
    remote.econ[side] = local.econ[side];
    SF.researchOf(remote, side);
    remote.research[side] = SF.researchOf(local, side);
    remote.nations[side] = local.nations[side];
    remote.projects = remote.projects.filter(function (p) { return p.owner !== side; })
      .concat(local.projects.filter(function (p) { return p.owner === side; }));
    remote.nextProjectId = Math.max(remote.nextProjectId, local.nextProjectId);

    // Units: this side's units as the player left them. Any units created
    // during the turn get fresh ids, so the two sides can never clash.
    var known = {};
    remote.units.forEach(function (u) { known[u.id] = true; });
    var renamed = {};
    var mine = local.units.filter(function (u) { return u.owner === side; }).map(function (u) {
      var copy = JSON.parse(JSON.stringify(u));
      if (!known[u.id]) {
        renamed[u.id] = remote.nextUnitId;
        copy.id = remote.nextUnitId++;
      }
      return copy;
    });
    mine.forEach(function (u) { if (renamed[u.aboard]) u.aboard = renamed[u.aboard]; });
    remote.units = remote.units.filter(function (u) { return u.owner !== side; }).concat(mine);
    remote.nextUnitId = Math.max(remote.nextUnitId, local.nextUnitId);

    remote.orders[side] = (local.orders[side] || []).map(function (o) {
      var copy = JSON.parse(JSON.stringify(o));
      copy.unitIds = copy.unitIds.map(function (id) { return renamed[id] || id; });
      if (copy.cargoIds) copy.cargoIds = copy.cargoIds.map(function (id) { return renamed[id] || id; });
      return copy;
    });
    remote.nextOrderId = Math.max(remote.nextOrderId, local.nextOrderId);
    return remote;
  };

  // Lock in this side's orders. If the other side has already locked in,
  // play out the turn. Resolves to the saved game.
  online.lockIn = function (code, local, side) {
    return online.update(code, function (remote) {
      if (remote.over || remote.turn !== local.turn || remote.phase !== "orders") return null;
      SF.mergeSide(remote, local, side);
      remote.locked = remote.locked || [false, false];
      remote.locked[side] = true;
      if (remote.locked[1 - side]) {
        SF.resolveTurn(remote);
        remote.locked = [false, false];
        return "resolve";
      }
      return "lock";
    });
  };

  online.unlock = function (code, local, side) {
    return online.update(code, function (remote) {
      if (remote.over || remote.turn !== local.turn || !remote.locked || !remote.locked[side]) return null;
      remote.locked[side] = false;
      return "unlock";
    });
  };

  // Save this side's nation and starting buildings. When both sides are
  // done, the war begins.
  online.finishSetup = function (code, side, name, gov, plan) {
    return online.update(code, function (remote) {
      if (remote.setupDone[side]) return null;
      if (side === 1 && SF.nation(remote, 0).name === name) throw new Error("That name is taken by the other player.");
      SF.setNation(remote, side, name, gov);
      SF.applyPlan(remote, side, plan);
      if (remote.setupDone[0] && remote.setupDone[1]) remote.phase = "orders";
      return "setup";
    });
  };

  online.join = function (code) {
    return online.update(code, function (remote) {
      if (remote.joined) throw new Error("That game already has two players.");
      remote.joined = true;
      return "join";
    });
  };
})(window.SF);
