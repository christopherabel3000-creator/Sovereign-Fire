// Sovereign Fire: screens, map, and controls.
// Everything shown is from the point of view of the side giving orders, and
// only includes what that side can see.
(function (SF) {
  "use strict";

  var SAVE_KEY = "sovereignFire.save";
  var SAVE_VERSION = 7;
  var state = null;
  var selected = null;     // id of the selected square
  var buttons = {};        // map square buttons by id
  var vis = null;          // what the current side can see

  function $(id) { return document.getElementById(id); }

  // ---------- Saving ----------
  // Online games are saved separately, with the game code and which side you play.
  var ONLINE_KEY = "sovereignFire.online";
  var SIDES_KEY = "sovereignFire.onlineSides";
  var net = null;   // { code, side } while playing online

  function save() {
    state.version = SAVE_VERSION;
    try {
      if (state.mode === "online" && net) {
        localStorage.setItem(ONLINE_KEY, JSON.stringify({ code: net.code, side: net.side, state: state }));
      } else {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      }
    } catch (e) { /* storage unavailable */ }
  }
  function loadOnline() {
    try {
      var raw = localStorage.getItem(ONLINE_KEY);
      var s = raw ? JSON.parse(raw) : null;
      return s && s.code && s.state && s.state.version === SAVE_VERSION ? s : null;
    } catch (e) { return null; }
  }
  function clearOnline() {
    try { localStorage.removeItem(ONLINE_KEY); } catch (e) { /* ignore */ }
  }
  // Remember which side you played in each game code, so you can rejoin.
  function rememberSide(code, side) {
    try {
      var m = JSON.parse(localStorage.getItem(SIDES_KEY) || "{}");
      m[code] = side;
      localStorage.setItem(SIDES_KEY, JSON.stringify(m));
    } catch (e) { /* ignore */ }
  }
  function knownSide(code) {
    try {
      var m = JSON.parse(localStorage.getItem(SIDES_KEY) || "{}");
      return m[code] === 0 || m[code] === 1 ? m[code] : null;
    } catch (e) { return null; }
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      var s = raw ? JSON.parse(raw) : null;
      return s && s.version === SAVE_VERSION ? s : null;
    } catch (e) { return null; }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  // ---------- Helpers ----------
  function me() { return state.current; }
  function foe() { return 1 - state.current; }
  function sideName(owner) {
    var n = state && state.nations && state.nations[owner];
    return n ? n.name : (owner === 0 ? "North" : "South");
  }
  function territory(sq) {
    if (sq.home === null) return "";
    return sq.home === me() ? "yours" : "enemy";
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function seenEnemies(id) { return SF.visibleEnemies(state, me(), id, vis); }
  function tName(sq) { return state && SF.bridgeBroken(state, sq.id) ? "destroyed bridge" : SF.terrainName(sq); }
  function layerOf(id) { return SF.sq(id).terrain.key === "ocean" ? "sea" : "ground"; }
  // Enemy units you can see that would fight for a square: ships at sea, troops on land.
  function seenDefenders(id) {
    return seenEnemies(id).filter(layerOf(id) === "sea" ? SF.isNaval : SF.isGround);
  }
  function knownEnemy(id) { return SF.knownOccupant(state, me(), id, vis, layerOf(id)) === foe(); }
  // "your 1 destroyer and 1 transport, carrying 2 infantry"
  function stackText(units) {
    var top = units.filter(function (u) { return !SF.isCargo(u); });
    var cargo = units.filter(SF.isCargo);
    var text = SF.describeUnits(top);
    if (cargo.length) text += (top.length ? ", carrying " : "") + SF.describeUnits(cargo);
    return text;
  }
  function isHidden(id) { return !vis.wide[id]; }

  function focusable(node, id) {
    node.id = id;
    node.tabIndex = -1;
    return node;
  }

  function announce(text) {
    var a = $("announcer");
    a.textContent = "";
    setTimeout(function () { a.textContent = text; }, 50);
  }

  function show(which) {
    ["setup", "plan", "handoff", "waiting", "over", "game"].forEach(function (id) { $(id).hidden = id !== which; });
  }

  // ---------- Map ----------
  function buildMap() {
    var table = $("map");
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    hr.appendChild(document.createElement("td"));
    for (var c = 0; c < SF.SIZE; c++) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = SF.COLS.charAt(c);
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    SF.grid.forEach(function (row, r) {
      var tr = document.createElement("tr");
      var rh = document.createElement("th");
      rh.scope = "row";
      rh.textContent = String(r + 1);
      tr.appendChild(rh);
      row.forEach(function (sq) {
        var td = document.createElement("td");
        var b = document.createElement("button");
        b.type = "button";
        b.addEventListener("click", function () { select(sq.id); });
        b.addEventListener("keydown", function (e) { arrowMove(e, sq); });
        buttons[sq.id] = b;
        td.appendChild(b);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function myOrders() { return state.orders[me()]; }

  // What your orders do to each square.
  function targetsOf() {
    var t = {};
    myOrders().forEach(function (o) {
      if (o.kind === "bombard") t[o.to] = t[o.to] || "bombard";
      else if (o.kind === "scout") t[o.to] = t[o.to] || "scout";
      else if (o.kind === "patrol") t[o.to] = t[o.to] || "patrol";
      else if (o.kind === "bomb") t[o.to] = "bomb";
      else if (o.kind === "rebase") t[o.to] = t[o.to] || "rebase";
      else if (o.kind === "repair") return;
      else if (o.kind === "missile") t[o.to] = "missile";
      else if (o.kind === "asat") return;
      else if (o.kind === "nuke") t[o.to] = "nuke";
      else t[o.to] = knownEnemy(o.to) ? "attack" : "move";
      if (o.landAt) t[o.landAt] = knownEnemy(o.landAt) ? "attack" : "landing";
    });
    return t;
  }

  var TARGET_TEXT = {
    move: "your units moving here",
    attack: "your attack target",
    bombard: "your artillery firing here",
    scout: "your scout plane flying here",
    landing: "your troops landing here",
    patrol: "your fighters patrolling here",
    bomb: "your bombing target",
    rebase: "your planes moving here",
    missile: "your missile target",
    nuke: "your nuclear target"
  };

  function squareLabel(sq, targets) {
    var parts = [sq.id, tName(sq)];
    var terr = territory(sq);
    var mine = SF.unitsAt(state, sq.id, me());
    var theirs = seenEnemies(sq.id);
    // "your" or "enemy" in front of the units already says whose land it is.
    var sameSide = (terr === "yours" && mine.length) || (terr === "enemy" && theirs.length);
    if (terr && !sameSide) parts.push(terr);
    if (mine.length) parts.push("your " + stackText(mine));
    if (theirs.length) parts.push("enemy " + SF.describeUnits(theirs));
    if (SF.radioactive(state, sq.id)) parts.push("radioactive");
    if (isHidden(sq.id)) parts.push("hidden");
    if (targets[sq.id]) parts.push(TARGET_TEXT[targets[sq.id]]);
    return parts.join(", ");
  }

  function renderMap() {
    var targets = targetsOf();
    SF.allSquares().forEach(function (sq) {
      var b = buttons[sq.id];
      var cls = "sq t-" + sq.terrain.key;
      if (sq.home !== null) cls += " home" + sq.home;
      if (isHidden(sq.id)) cls += " fog";
      if (sq.id === selected) cls += " selected";
      if (targets[sq.id]) cls += " target";
      b.className = cls;
      b.setAttribute("aria-label", squareLabel(sq, targets));
      var mine = SF.unitsAt(state, sq.id, me());
      var theirs = seenEnemies(sq.id);
      b.textContent = "";
      if (mine.length || theirs.length) {
        var badge = document.createElement("span");
        badge.className = "badge " + (mine.length ? "mine" : "foe");
        badge.textContent = String(mine.length || theirs.length);
        badge.setAttribute("aria-hidden", "true");
        b.appendChild(badge);
      } else {
        b.textContent = sq.terrain.mark;
      }
    });
  }

  function arrowMove(e, sq) {
    var dr = 0, dc = 0;
    if (e.key === "ArrowUp") dr = -1;
    else if (e.key === "ArrowDown") dr = 1;
    else if (e.key === "ArrowLeft") dc = -1;
    else if (e.key === "ArrowRight") dc = 1;
    else return;
    var nr = sq.row + dr, nc = sq.col + dc;
    if (nr < 0 || nr >= SF.SIZE || nc < 0 || nc >= SF.SIZE) return;
    e.preventDefault();
    focusSquare(SF.grid[nr][nc].id);
  }

  function select(id) {
    selected = id;
    renderMap();
    renderDetails();
  }

  function focusSquare(id) {
    select(id);
    buttons[id].focus();
  }

  // ---------- Selected square ----------
  function unorderedAt(id) {
    return SF.unitsAt(state, id, me()).filter(function (u) { return !SF.orderFor(state, u.id); });
  }

  function orderUnits(o) {
    return state.units.filter(function (u) { return o.unitIds.indexOf(u.id) !== -1; });
  }

  function orderVerb(o) {
    if (o.kind === "bombard") return "firing at " + o.to;
    if (o.kind === "scout") return "scouting " + o.to;
    if (o.kind === "patrol") return "patrolling over " + o.to;
    if (o.kind === "bomb") return "bombing " + ({ troops: "troops", buildings: "buildings", bridge: "the bridge" })[o.mode] + " at " + o.to;
    if (o.kind === "rebase") return (o.carrier ? "landing on the carrier at " : "moving to the base at ") + o.to;
    if (o.kind === "repair") return "rebuilding the bridge";
    if (o.kind === "missile") return "firing at " + (o.mode === "buildings" ? "buildings in " : "") + o.to;
    if (o.kind === "asat") return "firing at enemy satellites";
    if (o.kind === "nuke") return "launching a nuclear strike on " + o.to;
    if (o.kind === "sail") {
      var text = (knownEnemy(o.to) ? "attacking " : "sailing to ") + o.to;
      var loading = state.units.filter(function (u) { return (o.cargoIds || []).indexOf(u.id) !== -1; });
      if (loading.length) text += ", loading " + SF.describeUnits(loading);
      if (o.landAt) text += ", landing troops at " + o.landAt;
      return text;
    }
    if (knownEnemy(o.to)) return "attacking " + o.to;
    if (layerOf(o.to) === "sea") return "boarding the transport at " + o.to;
    return "moving to " + o.to;
  }

  function orderText(o, fromView) {
    var what = SF.describeUnits(orderUnits(o));
    return fromView ? what + " from " + o.from : what + " " + orderVerb(o);
  }

  function cancelButton(order, focusId) {
    var b = el("button", "Cancel", "act");
    b.type = "button";
    b.setAttribute("aria-label", "Cancel order: " + orderText(order, false) + " from " + order.from);
    b.addEventListener("click", function () {
      SF.cancelOrder(state, me(), order.id);
      save();
      renderAll();
      $(focusId).focus();
      announce("Order canceled.");
    });
    return b;
  }

  function renderDetails() {
    var box = $("details");
    box.innerHTML = "";
    if (!selected) { box.appendChild(el("p", "No square selected yet.")); return; }
    var sq = SF.sq(selected);
    var terr = territory(sq);
    box.appendChild(el("p", sq.id + ", " + tName(sq) + (terr ? ", " + terr : "") + "."));
    if (SF.radioactive(state, sq.id)) {
      box.appendChild(el("p", "Radioactive after a nuclear strike, until the end of turn " + state.fallout[sq.id] +
        ". No units can enter, and a city here produces nothing."));
    }
    box.appendChild(el("p", SF.bridgeBroken(state, sq.id) ?
      "Destroyed. Units cross here like a river until an engineer rebuilds it." : SF.NOTES[sq.terrain.key]));
    if (sq.terrain.key === "city" && SF.isCoastal(sq)) box.appendChild(el("p", "Can build a port."));

    if (isHidden(sq.id)) {
      box.appendChild(el("p", "Hidden. You cannot see what enemy units are here."));
    } else {
      var theirs = seenEnemies(sq.id);
      if (theirs.length) box.appendChild(el("p", "Enemy units: " + stackText(theirs) + "."));
    }

    var mine = SF.unitsAt(state, sq.id, me());
    var leaving = myOrders().filter(function (o) { return o.from === sq.id; });
    var arriving = myOrders().filter(function (o) { return o.to === sq.id && o.kind === "move"; });

    if (mine.length) {
      box.appendChild(el("h3", "Your units here"));
      var ul = el("ul", undefined, "plain");
      var waiting = unorderedAt(sq.id);
      if (waiting.length) ul.appendChild(el("li", "Awaiting orders: " + SF.describeUnits(waiting) + "."));
      mine.filter(function (u) { return u.type === "transport"; }).forEach(function (t) {
        var aboard = SF.cargoOf(state, t);
        ul.appendChild(el("li", "Transport: " + (aboard.length ? "carrying " + SF.describeUnits(aboard) : "empty") +
          ", room for " + SF.roomOn(state, t) + " more."));
      });
      leaving.forEach(function (o) {
        var li = el("li");
        li.appendChild(el("span", orderText(o, false) + "."));
        li.appendChild(cancelButton(o, "selected-heading"));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    if (arriving.length) {
      box.appendChild(el("p", "Moving here: " + arriving.map(function (o) { return orderText(o, true); }).join("; ") + "."));
    }

    if (lockedOnline()) {
      box.appendChild(el("p", "Your orders are locked in. Unlock them to make changes."));
      return;
    }
    var waitingNow = unorderedAt(sq.id);
    var byType = {};
    waitingNow.forEach(function (u) { (byType[u.type] = byType[u.type] || []).push(u); });
    var city = state.cities[sq.id];
    if (city && city.owner === me()) renderCityPanel(box, sq);
    var ground = waitingNow.filter(function (u) { return !SF.isAir(u) && !SF.isNaval(u); });
    var ships = waitingNow.filter(SF.isNaval);
    if (ground.length) renderOrderForm(box, sq, ground);
    if (ships.length) renderSeaForm(box, sq, ships, waitingNow.filter(SF.isGround));
    renderBombardForm(box, sq, byType.artillery || []);
    renderBombardForm(box, sq, byType.destroyer || []);
    renderScoutForm(box, sq, byType.scoutPlane || []);
    renderPatrolForm(box, sq, byType.fighter || []);
    renderBombForm(box, sq, byType.bomber || []);
    renderRebaseForm(box, sq, waitingNow.filter(function (u) { return SF.isAir(u) && u.type !== "missile"; }));
    renderMissileForm(box, sq, byType.missile || []);
    renderNukeForm(box, sq);
    renderRepairForm(box, sq, (byType.engineer || []).filter(function (u) { return !SF.isCargo(u); }));
  }

  function countPicker(form, text, n, all) {
    var label = el("label", text);
    var sel = document.createElement("select");
    for (var i = all ? 0 : 1; i <= n; i++) {
      var o = el("option", String(i));
      o.value = String(i);
      sel.appendChild(o);
    }
    sel.value = String(n);
    label.appendChild(sel);
    form.appendChild(label);
    return sel;
  }

  function squareInput(form, text) {
    var label = el("label", text);
    var input = document.createElement("input");
    input.autocomplete = "off";
    input.setAttribute("autocapitalize", "characters");
    input.spellcheck = false;
    label.appendChild(input);
    form.appendChild(label);
    return input;
  }

  function formError(form) {
    var p = el("p");
    p.setAttribute("role", "alert");
    form.appendChild(p);
    return p;
  }

  function submitButton(form, text) {
    var b = el("button", text, "act primary");
    b.type = "submit";
    form.appendChild(b);
    return b;
  }

  function renderPatrolForm(box, sq, fighters) {
    if (!fighters.length) return;
    var range = SF.stat(state, me(), "fighter", "range");
    box.appendChild(el("h3", "Fighter patrol"));
    var form = el("form", undefined, "order-form");
    var count = countPicker(form, "Fighters to send, " + fighters.length + " available", fighters.length);
    var input = squareInput(form, "Square to patrol over, within " + range + " squares of " + sq.id);
    var error = formError(form);
    submitButton(form, "Order patrol");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim().toUpperCase().replace(/\s+/g, "");
      if (!SF.sq(v)) { error.textContent = "Not a square. Use a letter A to P and a number 1 to 16."; return; }
      if (SF.distance(sq.id, v) > range) {
        error.textContent = v + " is " + SF.distance(sq.id, v) + " squares away. The limit is " + range + ".";
        return;
      }
      var use = fighters.slice(0, parseInt(count.value, 10));
      SF.addPatrol(state, me(), use.map(function (u) { return u.id; }), v);
      afterOrder("Ordered " + SF.describeUnits(use) + " to patrol over " + v + ".");
    });
    box.appendChild(form);
  }

  function renderBombForm(box, sq, bombers) {
    if (!bombers.length) return;
    var targets = SF.bombTargets(state, me(), sq.id);
    if (!targets.length) return;
    box.appendChild(el("h3", "Bombing run"));
    var form = el("form", undefined, "order-form");
    var count = countPicker(form, "Bombers to send, " + bombers.length + " available", bombers.length);
    var label = el("label", "Target");
    var sel = document.createElement("select");
    targets.forEach(function (t) {
      var text = t.id + ", ";
      if (t.mode === "troops") {
        text += "troops: enemy " + SF.describeUnits(seenDefenders(t.id)) + ", " +
          Math.round(SF.bombardChance(t.id, "bomber") * 100) + "% per bomber to destroy a unit";
      } else if (t.mode === "buildings") {
        text += "city buildings, " + Math.round(SF.BOMB_BUILDING * 100) + "% per bomber to destroy one";
      } else {
        text += "bridge" + (territory(SF.sq(t.id)) === "yours" ? ", yours" : "") + ", " +
          Math.round(SF.BOMB_BRIDGE * 100) + "% per bomber to bring it down";
      }
      var o = el("option", text);
      o.value = t.id + "|" + t.mode;
      sel.appendChild(o);
    });
    label.appendChild(sel);
    form.appendChild(label);
    form.appendChild(el("p", "Enemy fighters patrolling over the target, and anti-aircraft guns on it, can shoot bombers down. Fighters you send to patrol over the same square act as escorts."));
    submitButton(form, "Order bombing run");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var parts = sel.value.split("|");
      var use = bombers.slice(0, parseInt(count.value, 10));
      SF.addBombRun(state, me(), use.map(function (u) { return u.id; }), parts[0], parts[1]);
      afterOrder("Ordered " + SF.describeUnits(use) + " to bomb " +
        ({ troops: "troops", buildings: "buildings", bridge: "the bridge" })[parts[1]] + " at " + parts[0] + ".");
    });
    box.appendChild(form);
  }

  function renderRebaseForm(box, sq, planes) {
    if (!planes.length) return;
    box.appendChild(el("h3", "Move planes to a new base"));
    var form = el("form", undefined, "order-form");
    var groups = {};
    planes.forEach(function (u) { (groups[u.type] = groups[u.type] || []).push(u); });
    var pickers = [];
    SF.UNIT_ORDER.forEach(function (type) {
      if (!groups[type]) return;
      var sel = countPicker(form, capitalize(SF.UNIT_TYPES[type].plural) + " to move, " + groups[type].length + " here",
        groups[type].length, true);
      sel.value = "0";
      sel.addEventListener("change", refresh);
      pickers.push({ units: groups[type], select: sel });
    });
    var label = el("label", "New base");
    var dest = document.createElement("select");
    label.appendChild(dest);
    form.appendChild(label);
    var submit = submitButton(form, "Move planes");
    var choices = [];
    function chosen() {
      var out = [];
      pickers.forEach(function (p) { out = out.concat(p.units.slice(0, parseInt(p.select.value, 10))); });
      return out;
    }
    function refresh() {
      var group = chosen();
      dest.innerHTML = "";
      choices = group.length ? SF.rebaseTargets(state, me(), group) : [];
      if (!choices.length) {
        dest.appendChild(el("option", group.length ? "No bases in range" : "Choose some planes first"));
        dest.disabled = true;
        submit.disabled = true;
        return;
      }
      dest.disabled = false;
      submit.disabled = false;
      choices.forEach(function (c, i) {
        var text = c.id + ", " + (c.carrier ? "your carrier, room for " +
          SF.carrierRoom(state, state.units.filter(function (u) { return u.id === c.carrier; })[0]) :
          tName(SF.sq(c.id)) + " with an airfield");
        var o = el("option", text);
        o.value = String(i);
        dest.appendChild(o);
      });
    }
    refresh();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var group = chosen();
      var c = choices[parseInt(dest.value, 10)];
      if (!group.length || !c) return;
      SF.addRebase(state, me(), group.map(function (u) { return u.id; }), c.id, c.carrier);
      afterOrder("Ordered " + SF.describeUnits(group) + " to move to " + (c.carrier ? "the carrier at " : "") + c.id + ".");
    });
    box.appendChild(form);
  }

  function renderMissileForm(box, sq, missiles) {
    if (!missiles.length) return;
    var range = SF.stat(state, me(), "missile", "range");
    box.appendChild(el("h3", "Missile strike"));
    var form = el("form", undefined, "order-form");
    form.appendChild(el("p", "Missiles can hit any square within " + range + " squares. If you cannot see the target, you will not learn what they hit. Missile defenses and destroyers near the target can shoot them down, so firing several at once can overwhelm them."));
    var count = countPicker(form, "Missiles to fire, " + missiles.length + " here", missiles.length);
    var input = squareInput(form, "Target square");
    var mLabel = el("label", "Aim at");
    var mode = document.createElement("select");
    var modes = [["units", "Units on the square"], ["buildings", "Buildings in an enemy city"]];
    if (SF.effect(state, me(), "asat") && SF.satellites(state, foe()).length) {
      modes.push(["satellite", "An enemy satellite, no target square needed"]);
    }
    modes.forEach(function (m) {
      var o = el("option", m[1]);
      o.value = m[0];
      mode.appendChild(o);
    });
    mLabel.appendChild(mode);
    form.appendChild(mLabel);
    var error = formError(form);
    submitButton(form, "Launch missiles");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (mode.value === "satellite") {
        var shots = missiles.slice(0, parseInt(count.value, 10));
        SF.addAsat(state, me(), shots.map(function (u) { return u.id; }));
        afterOrder("Ordered " + SF.describeUnits(shots) + " fired at enemy satellites.");
        return;
      }
      var v = input.value.trim().toUpperCase().replace(/\s+/g, "");
      if (!SF.sq(v)) { error.textContent = "Not a square. Use a letter A to P and a number 1 to 16."; return; }
      if (SF.distance(sq.id, v) > range) {
        error.textContent = v + " is " + SF.distance(sq.id, v) + " squares away. The limit is " + range + ".";
        return;
      }
      var c = state.cities[v];
      if (mode.value === "buildings" && !(c && c.owner === foe())) {
        error.textContent = v + " is not an enemy city.";
        return;
      }
      var use = missiles.slice(0, parseInt(count.value, 10));
      SF.addMissile(state, me(), use.map(function (u) { return u.id; }), v, mode.value);
      afterOrder("Ordered " + SF.describeUnits(use) + " fired at " + (mode.value === "buildings" ? "buildings in " : "") + v + ".");
    });
    box.appendChild(form);
  }

  var NUKE_METHOD = { missile: "Nuclear missile", bomber: "Bomber carrying a nuclear bomb", submarine: "Submarine-launched nuclear missile" };

  function renderNukeForm(box, sq) {
    var ways = SF.nukeMethods(state, me(), sq.id);
    if (!ways.length) return;
    box.appendChild(el("h3", "Nuclear strike"));
    var form = el("form", undefined, "order-form");
    var nukeRate = SF.gov(state, me()).nukeRate;
    var cost = Math.round(SF.nukeMoraleCost(state, me()) * (nukeRate === undefined ? 1 : nukeRate));
    var floorNote = " Launching never takes your morale below " + SF.NUKE.launchFloor + ".";
    var first = state.firstNuke;
    var warning = first === null || first === undefined ?
      "No one has used nuclear weapons yet. Launching first costs your nation " + cost + " morale, even if it is shot down." :
      cost ? "You used nuclear weapons first. Each launch costs " + cost + " more morale." :
      "The enemy used nuclear weapons first. Striking back costs your nation no morale.";
    form.appendChild(el("p", "You have " + state.econ[me()].warheads + " nuclear " +
      (state.econ[me()].warheads === 1 ? "warhead" : "warheads") + ". " + warning +
      floorNote + " Everything on the target square is destroyed, and the 8 squares around it are badly damaged. The target stays radioactive for " +
      SF.NUKE.fallout + " turns."));
    var mLabel = el("label", "Deliver by");
    var method = document.createElement("select");
    ways.forEach(function (w, i) {
      var o = el("option", NUKE_METHOD[w.method] + ", range " + w.range);
      o.value = String(i);
      method.appendChild(o);
    });
    mLabel.appendChild(method);
    form.appendChild(mLabel);
    var input = squareInput(form, "Target square");
    var cLabel = el("label");
    var check = document.createElement("input");
    check.type = "checkbox";
    check.style.width = "auto";
    cLabel.appendChild(check);
    cLabel.appendChild(document.createTextNode(" I want to launch a nuclear weapon"));
    form.appendChild(cLabel);
    var error = formError(form);
    submitButton(form, "Launch nuclear strike");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var w = ways[parseInt(method.value, 10)];
      var v = input.value.trim().toUpperCase().replace(/\s+/g, "");
      if (!SF.sq(v)) { error.textContent = "Not a square. Use a letter A to P and a number 1 to 16."; return; }
      if (SF.distance(sq.id, v) > w.range) {
        error.textContent = v + " is " + SF.distance(sq.id, v) + " squares away. The limit is " + w.range + ".";
        return;
      }
      if (!check.checked) { error.textContent = "Check the box to confirm the launch."; return; }
      SF.addNuke(state, me(), w.method, w.unit.id, v);
      afterOrder("Nuclear strike on " + v + " ordered. You can still cancel it before locking in.");
    });
    box.appendChild(form);
  }

  function renderRepairForm(box, sq, engineers) {
    if (!engineers.length || !SF.bridgeBroken(state, sq.id)) return;
    box.appendChild(el("h3", "Rebuild the bridge"));
    var form = el("form", undefined, "order-form");
    form.appendChild(el("p", "An engineer who stays here this turn rebuilds the bridge."));
    submitButton(form, "Rebuild bridge");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      SF.addRepair(state, me(), engineers[0].id);
      afterOrder("Ordered an engineer to rebuild the bridge at " + sq.id + ".");
    });
    box.appendChild(form);
  }

  function buildingsText(b) {
    var parts = [];
    SF.BUILDING_ORDER.forEach(function (k) {
      if (b[k]) parts.push(b[k] + " " + (b[k] === 1 ? SF.BUILDINGS[k].name : SF.BUILDINGS[k].plural));
    });
    return parts.length ? parts.join(", ") : "none";
  }

  function renderCityPanel(box, sq) {
    var id = sq.id, c = state.cities[id], info = SF.cityInfo(id);
    var rate = SF.cityRate(state, id);
    box.appendChild(el("h3", "Your city"));
    var room = info.slots - SF.slotsUsed(state, id);
    box.appendChild(el("p", "Manpower " + Math.floor(info.pop * rate) + " a turn. Buildings: " +
      buildingsText(c.buildings) + ". Room for " + room + " more."));
    if (c.buildings.port && SF.blockaded(state, id)) {
      box.appendChild(el("p", "Blockaded. Enemy warships next to the port stop it building ships."));
    }
    if (rate < 1) {
      box.appendChild(el("p", "Recently captured. Producing at " + Math.round(rate * 100) +
        "% until turn " + (c.captured + SF.CAPTURE_TURNS) + "."));
    }
    var here = state.projects.filter(function (p) { return p.city === id && p.owner === me(); });
    if (here.length) {
      var ul = el("ul", undefined, "plain");
      here.forEach(function (p) {
        var li = el("li");
        li.appendChild(el("span", projectText(p) + "."));
        if (SF.canCancelProject(state, p)) li.appendChild(cancelProjectButton(p, "selected-heading"));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }

    // Build a unit.
    box.appendChild(el("h3", "Build a unit"));
    var uf = el("form", undefined, "order-form");
    var ul2 = el("label", "Unit");
    var usel = document.createElement("select");
    Object.keys(SF.UNIT_COST).forEach(function (type) {
      var cost = SF.unitCost(state, me(), type);
      var problem = SF.unitProblem(state, me(), id, type);
      var text = capitalize(SF.UNIT_TYPES[type].name) + ", " + cost.industry + " industry, " +
        cost.recruits + (cost.recruits === 1 ? " recruit" : " recruits") + ", " +
        (cost.gasoline ? cost.gasoline + " gasoline, " : "") +
        cost.turns + (cost.turns === 1 ? " turn" : " turns");
      if (problem) text += ". " + problem;
      var o = el("option", text);
      o.value = type;
      usel.appendChild(o);
    });
    ul2.appendChild(usel);
    uf.appendChild(ul2);
    var uerr = el("p");
    uerr.setAttribute("role", "alert");
    uf.appendChild(uerr);
    var ub = el("button", "Build unit", "act primary");
    ub.type = "submit";
    uf.appendChild(ub);
    uf.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var problem = SF.unitProblem(state, me(), id, usel.value);
      if (problem) { uerr.textContent = problem; return; }
      var p = SF.startUnit(state, me(), id, usel.value);
      afterOrder("Building " + SF.UNIT_TYPES[p.type].name + " at " + id + ", ready in " + p.turnsLeft +
        (p.turnsLeft === 1 ? " turn." : " turns."));
    });
    box.appendChild(uf);

    // Construct a building.
    if (room <= 0) return;
    box.appendChild(el("h3", "Construct a building"));
    var bf = el("form", undefined, "order-form");
    var bl = el("label", "Building");
    var bsel = document.createElement("select");
    SF.BUILDING_ORDER.forEach(function (k) {
      var b = SF.BUILDINGS[k];
      var problem = SF.buildingProblem(state, me(), id, k);
      var text = capitalize(b.name) + ", " + b.cost + " industry, " + b.turns + " turns";
      if (problem) text += ". " + problem;
      var o = el("option", text);
      o.value = k;
      bsel.appendChild(o);
    });
    bl.appendChild(bsel);
    bf.appendChild(bl);
    var berr = el("p");
    berr.setAttribute("role", "alert");
    bf.appendChild(berr);
    var bb = el("button", "Start construction", "act primary");
    bb.type = "submit";
    bf.appendChild(bb);
    bf.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var problem = SF.buildingProblem(state, me(), id, bsel.value);
      if (problem) { berr.textContent = problem; return; }
      var p = SF.startBuilding(state, me(), id, bsel.value);
      afterOrder("Building " + SF.withArticle(SF.BUILDINGS[p.type].name) + " at " + id + ", ready in " + p.turnsLeft + " turns.");
    });
    box.appendChild(bf);
  }

  function afterOrder(msg) {
    save();
    renderAll();
    $("selected-heading").focus();
    announce(msg);
  }

  function renderOrderForm(box, sq, waiting) {
    box.appendChild(el("h3", "Give a move order"));
    var form = el("form", undefined, "order-form");
    var byType = {};
    waiting.forEach(function (u) { (byType[u.type] = byType[u.type] || []).push(u); });

    var pickers = [];
    SF.UNIT_ORDER.forEach(function (type) {
      var list = byType[type];
      if (!list) return;
      var t = SF.UNIT_TYPES[type];
      var label = el("label", capitalize(t.plural) + ", " + list.length + " available");
      var s = document.createElement("select");
      for (var i = 0; i <= list.length; i++) {
        var opt = el("option", String(i));
        opt.value = String(i);
        s.appendChild(opt);
      }
      s.value = String(list.length);
      s.addEventListener("change", refreshDest);
      label.appendChild(s);
      form.appendChild(label);
      pickers.push({ type: type, units: list, select: s });
    });

    var destLabel = el("label", "Destination");
    var dest = document.createElement("select");
    destLabel.appendChild(dest);
    form.appendChild(destLabel);

    var submit = el("button", "Give move order", "act primary");
    submit.type = "submit";
    form.appendChild(submit);

    var odds = {};

    function chosenUnits() {
      var out = [];
      pickers.forEach(function (p) {
        out = out.concat(p.units.slice(0, parseInt(p.select.value, 10)));
      });
      return out;
    }

    function refreshDest() {
      var keep = dest.value;
      var units = chosenUnits();
      var types = [];
      units.forEach(function (u) { if (types.indexOf(u.type) === -1) types.push(u.type); });
      var ids = SF.reachable(state, me(), units);
      dest.innerHTML = "";
      odds = {};
      if (!units.length || !ids.length) {
        dest.appendChild(el("option", units.length ? "No squares in reach" : "Choose some units first"));
        dest.disabled = true;
        submit.disabled = true;
        return;
      }
      dest.disabled = false;
      submit.disabled = false;
      ids.forEach(function (id) {
        var s2 = SF.sq(id);
        var terr = territory(s2);
        var text = id + ", " + tName(s2) + (terr ? ", " + terr : "");
        var landing = units.some(SF.isCargo);
        if (layerOf(id) === "sea") {
          text = id + ", board your transport";
        } else if (knownEnemy(id)) {
          odds[id] = SF.attackOdds(state, me(), units, id, landing);
          text += ", " + (landing ? "land and attack " : "attack ") + SF.describeUnits(seenDefenders(id)) +
            ", about " + odds[id] + "% to win";
        } else if (landing) {
          text += ", land here" + (isHidden(id) ? ", hidden" : "");
        } else if (isHidden(id)) {
          text += ", hidden";
        }
        var opt = el("option", text);
        opt.value = id;
        dest.appendChild(opt);
      });
      if (ids.indexOf(keep) !== -1) dest.value = keep;
    }
    refreshDest();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var units = chosenUnits();
      if (!units.length || dest.disabled) return;
      var order = SF.addOrder(state, me(), units.map(function (u) { return u.id; }), dest.value);
      afterOrder("Ordered " + SF.describeUnits(units) + " from " + order.from +
        (odds[order.to] !== undefined ? " to attack " + order.to + ", about " + odds[order.to] + "% to win." : " to " + order.to + "."));
    });

    box.appendChild(form);
  }

  function renderBombardForm(box, sq, guns) {
    if (!guns.length) return;
    var type = guns[0].type;
    var naval = SF.UNIT_TYPES[type].naval;
    var targets = SF.bombardTargets(state, me(), sq.id, type);
    if (!targets.length) return;
    var plural = SF.UNIT_TYPES[type].plural;
    box.appendChild(el("h3", naval ? "Shore bombardment" : "Artillery bombardment"));
    var form = el("form", undefined, "order-form");
    var countLabel = el("label", capitalize(plural) + " to fire, " + guns.length + " available");
    var count = document.createElement("select");
    for (var i = 1; i <= guns.length; i++) {
      var o = el("option", String(i));
      o.value = String(i);
      count.appendChild(o);
    }
    count.value = String(guns.length);
    countLabel.appendChild(count);
    form.appendChild(countLabel);

    var tLabel = el("label", "Target");
    var target = document.createElement("select");
    targets.forEach(function (id) {
      var pct = Math.round(SF.bombardChance(id, type) * 100);
      var opt = el("option", id + ", " + tName(SF.sq(id)) + ", enemy " +
        SF.describeUnits(seenDefenders(id)) + ", " + pct + "% per gun to destroy a unit");
      opt.value = id;
      target.appendChild(opt);
    });
    tLabel.appendChild(target);
    form.appendChild(tLabel);

    var fire = el("button", "Order bombardment", "act primary");
    fire.type = "submit";
    form.appendChild(fire);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var use = guns.slice(0, parseInt(count.value, 10));
      SF.addBombard(state, me(), use.map(function (u) { return u.id; }), target.value);
      afterOrder("Ordered " + SF.describeUnits(use) + " to fire at " + target.value + ".");
    });
    box.appendChild(form);
  }

  // Sail ships, and with transports, load troops in port and land them.
  function renderSeaForm(box, sq, ships, troopsHere) {
    box.appendChild(el("h3", "Give a sea order"));
    var form = el("form", undefined, "order-form");
    var byType = {};
    ships.forEach(function (u) { (byType[u.type] = byType[u.type] || []).push(u); });

    function pickerSet(list, labelFor, startAll, onChange) {
      var out = [];
      var groups = {};
      list.forEach(function (u) { (groups[u.type] = groups[u.type] || []).push(u); });
      SF.UNIT_ORDER.forEach(function (type) {
        var g = groups[type];
        if (!g) return;
        var label = el("label", labelFor(type, g.length));
        var sel = document.createElement("select");
        for (var i = 0; i <= g.length; i++) {
          var o = el("option", String(i));
          o.value = String(i);
          sel.appendChild(o);
        }
        sel.value = String(startAll ? g.length : 0);
        sel.addEventListener("change", onChange);
        label.appendChild(sel);
        form.appendChild(label);
        out.push({ units: g, select: sel });
      });
      return out;
    }
    function chosen(set) {
      var out = [];
      set.forEach(function (p) { out = out.concat(p.units.slice(0, parseInt(p.select.value, 10))); });
      return out;
    }

    var shipPickers = pickerSet(ships, function (type, n) {
      return capitalize(SF.UNIT_TYPES[type].plural) + ", " + n + " available";
    }, true, refresh);

    // Troops in this port can be loaded onto transports as they leave.
    var loadPickers = [];
    if (troopsHere.length && SF.sq(sq.id).terrain.key !== "ocean") {
      loadPickers = pickerSet(troopsHere, function (type, n) {
        return "Load " + SF.UNIT_TYPES[type].plural + ", " + n + " here";
      }, false, refresh);
    }

    var destLabel = el("label", "Destination");
    var dest = document.createElement("select");
    dest.addEventListener("change", refreshLanding);
    destLabel.appendChild(dest);
    form.appendChild(destLabel);

    var landLabel = el("label", "Land troops at");
    var land = document.createElement("select");
    landLabel.appendChild(land);
    form.appendChild(landLabel);

    var info = el("p");
    form.appendChild(info);
    var err = el("p");
    err.setAttribute("role", "alert");
    form.appendChild(err);
    var submit = el("button", "Give sea order", "act primary");
    submit.type = "submit";
    form.appendChild(submit);

    var odds = {};

    function aboardNow(group) {
      var cargo = [];
      group.filter(function (u) { return u.type === "transport"; }).forEach(function (t) {
        cargo = cargo.concat(SF.cargoOf(state, t));
      });
      return cargo.concat(chosen(loadPickers));
    }

    function refresh() {
      var keep = dest.value;
      var group = chosen(shipPickers);
      var ids = SF.reachable(state, me(), group);
      dest.innerHTML = "";
      odds = {};
      var transports = group.filter(function (u) { return u.type === "transport"; });
      var room = transports.reduce(function (n, t) { return n + SF.roomOn(state, t); }, 0);
      var loading = chosen(loadPickers);
      info.textContent = transports.length ? "Room on the transports: " + room + ". Loading takes " +
        SF.spaceOf(loading) + ". Tanks and artillery take 2 spaces." : "";
      if (!group.length || !ids.length) {
        dest.appendChild(el("option", group.length ? "No squares in reach" : "Choose some ships first"));
        dest.disabled = true;
        submit.disabled = true;
        refreshLanding();
        return;
      }
      dest.disabled = false;
      submit.disabled = false;
      ids.forEach(function (id) {
        var text = id + ", " + tName(SF.sq(id));
        if (knownEnemy(id)) {
          odds[id] = SF.attackOdds(state, me(), group, id);
          text += ", attack " + SF.describeUnits(seenDefenders(id)) + ", about " + odds[id] + "% to win";
        } else if (isHidden(id)) {
          text += ", hidden";
        }
        var opt = el("option", text);
        opt.value = id;
        dest.appendChild(opt);
      });
      if (ids.indexOf(keep) !== -1) dest.value = keep;
      refreshLanding();
    }

    function refreshLanding() {
      var keep = land.value;
      land.innerHTML = "";
      var none = el("option", "Do not land");
      none.value = "";
      land.appendChild(none);
      var group = chosen(shipPickers);
      var troops = aboardNow(group);
      if (dest.disabled || !troops.length || layerOf(dest.value) !== "sea") {
        landLabel.hidden = true;
        return;
      }
      landLabel.hidden = false;
      SF.landingSquares(dest.value).forEach(function (id) {
        var s2 = SF.sq(id);
        if (s2.terrain.key === "river" && troops.some(function (u) { return !SF.UNIT_TYPES[u.type].crossRiver; })) return;
        var terr = territory(s2);
        var text = id + ", " + tName(s2) + (terr ? ", " + terr : "");
        if (knownEnemy(id)) {
          var pct = SF.attackOdds(state, me(), troops, id, true);
          text += ", land and attack " + SF.describeUnits(seenDefenders(id)) + ", about " + pct + "% to win";
        } else if (isHidden(id)) {
          text += ", hidden";
        }
        var opt = el("option", text);
        opt.value = id;
        land.appendChild(opt);
      });
      if ([].some.call(land.options, function (o) { return o.value === keep; })) land.value = keep;
    }
    refresh();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var group = chosen(shipPickers);
      if (!group.length || dest.disabled) return;
      var loading = chosen(loadPickers);
      var landAt = landLabel.hidden ? null : (land.value || null);
      try {
        SF.addSail(state, me(), group.map(function (u) { return u.id; }), dest.value,
          loading.map(function (u) { return u.id; }), landAt);
      } catch (x) {
        err.textContent = x.message + ".";
        return;
      }
      var msg = "Ordered " + SF.describeUnits(group) + " to " + (odds[dest.value] !== undefined ?
        "attack " + dest.value + ", about " + odds[dest.value] + "% to win" : "sail to " + dest.value);
      if (loading.length) msg += ", loading " + SF.describeUnits(loading);
      if (landAt) msg += ", landing troops at " + landAt;
      afterOrder(msg + ".");
    });

    box.appendChild(form);
  }

  function renderScoutForm(box, sq, planes) {
    if (!planes.length) return;
    box.appendChild(el("h3", "Scout mission"));
    var form = el("form", undefined, "order-form");
    var scoutRange = SF.stat(state, me(), "scoutPlane", "range");
    var label = el("label", "Target square, within " + scoutRange + " squares of " + sq.id);
    var input = document.createElement("input");
    input.autocomplete = "off";
    input.setAttribute("autocapitalize", "characters");
    input.spellcheck = false;
    label.appendChild(input);
    form.appendChild(label);
    var error = el("p");
    error.setAttribute("role", "alert");
    form.appendChild(error);
    var send = el("button", "Send scout plane", "act primary");
    send.type = "submit";
    form.appendChild(send);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim().toUpperCase().replace(/\s+/g, "");
      if (!SF.sq(v)) { error.textContent = "Not a square. Use a letter A to P and a number 1 to 16."; return; }
      if (!SF.canScout(state, me(), sq.id, v)) {
        error.textContent = v + " is " + SF.distance(sq.id, v) + " squares away. The limit is " + scoutRange + ".";
        return;
      }
      SF.addScout(state, me(), planes[0].id, v);
      afterOrder("Scout plane ordered to fly over " + v + ".");
    });
    box.appendChild(form);
  }

  // ---------- Orders list ----------
  function renderOrders() {
    var box = $("orders");
    box.innerHTML = "";
    var list = myOrders();
    if (!list.length) {
      box.appendChild(el("p", "No orders yet. Units without orders hold their position."));
    } else {
      var ul = el("ul", undefined, "plain");
      list.forEach(function (o) {
        var li = el("li");
        li.appendChild(el("span", SF.describeUnits(orderUnits(o)) + " at " + o.from + ", " + orderVerb(o) + "."));
        li.appendChild(cancelButton(o, "orders-heading"));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    $("lock-btn").textContent = state.mode === "online" && (state.locked || [])[me()] ? "Unlock my orders" :
      "Lock in turn " + state.turn + " orders";
  }

  function nextWaiting() {
    var squares = SF.allSquares().filter(function (sq) { return unorderedAt(sq.id).length > 0; });
    if (!squares.length) { announce("All your units have orders."); return; }
    var idx = 0;
    if (selected) {
      var cur = SF.sq(selected);
      for (var i = 0; i < squares.length; i++) {
        var s = squares[i];
        if (s.row > cur.row || (s.row === cur.row && s.col > cur.col)) { idx = i; break; }
      }
    }
    focusSquare(squares[idx].id);
  }

  // ---------- This turn menu ----------
  // A short list of everything you can do this turn, each one a button that
  // takes you straight to the place to do it.
  function squaresWaiting() {
    return SF.allSquares().filter(function (sq) { return unorderedAt(sq.id).length > 0; });
  }

  // Select the next square with units waiting and go to its orders.
  function commandNext() {
    var squares = squaresWaiting();
    if (!squares.length) { announce("All your units have orders."); return; }
    var idx = 0;
    if (selected) {
      var cur = SF.sq(selected);
      for (var i = 0; i < squares.length; i++) {
        var s = squares[i];
        if (s.row > cur.row || (s.row === cur.row && s.col > cur.col)) { idx = i; break; }
      }
    }
    openSquare(squares[idx].id);
  }

  // Select a square and move to its details, below the map.
  function openSquare(id) {
    select(id);
    $("selected-heading").focus();
  }

  function menuItem(ul, text, onClick, primary) {
    var li = el("li");
    var b = el("button", text, "act" + (primary ? " primary" : ""));
    b.type = "button";
    b.addEventListener("click", onClick);
    li.appendChild(b);
    ul.appendChild(li);
    return b;
  }

  function goTo(id) { return function () { $(id).focus(); }; }

  function researchSummary() {
    var r = SF.researchOf(state, me());
    if (!r.queue.length) return "Research: nothing queued, science is being saved";
    return "Research: " + SF.tech(r.queue[0]).name + (r.queue.length > 1 ? ", " + (r.queue.length - 1) + " more queued" : "");
  }

  function workforceSummary() {
    var e = state.econ[me()], mp = SF.manpower(state, me()), used = 0;
    SF.JOB_ORDER.forEach(function (j) { used += e.workers[j]; });
    return "Workforce: " + (used < mp ? (mp - used) + " manpower unassigned" : "all " + mp + " manpower assigned");
  }

  function renderTurnMenu() {
    var ul = $("turn-actions");
    ul.innerHTML = "";
    var orders = myOrders().length;
    var ordersText = "Review orders: " + (orders ? orders + (orders === 1 ? " order" : " orders") + " given" : "none yet");
    if (lockedOnline()) {
      menuItem(ul, ordersText, goTo("orders-heading"));
      menuItem(ul, "Unlock my orders", lockIn, true);
      $("turn-cities").parentNode.querySelector("h3").hidden = true;
      $("turn-cities").innerHTML = "";
      return;
    }
    var waiting = squaresWaiting();
    var units = 0;
    waiting.forEach(function (sq) { units += unorderedAt(sq.id).length; });
    menuItem(ul, waiting.length ?
      "Command units: " + units + (units === 1 ? " unit" : " units") + " waiting, on " +
        waiting.length + (waiting.length === 1 ? " square" : " squares") :
      "Command units: all units have orders", commandNext);
    menuItem(ul, workforceSummary(), goTo("workforce-heading"));
    menuItem(ul, researchSummary(), goTo("research-heading"));
    var ability = SF.ABILITIES[SF.gov(state, me()).ability];
    var problem = SF.abilityProblem(state, me());
    menuItem(ul, "Special ability: " + ability.name + (problem ? ", not ready" : ", ready"), goTo("ability-btn"));
    menuItem(ul, "Your nation: morale, stockpile, and production", goTo("nation-heading"));
    menuItem(ul, ordersText, goTo("orders-heading"));
    menuItem(ul, "Map", goTo("map-heading"));
    menuItem(ul, "Lock in turn " + state.turn + " orders", lockIn, true);

    var cities = $("turn-cities");
    cities.parentNode.querySelector("h3").hidden = false;
    cities.innerHTML = "";
    SF.citiesOf(state, me()).forEach(function (id) {
      var sq = SF.sq(id);
      var here = state.projects.filter(function (p) { return p.city === id && p.owner === me(); });
      var text = id + ", " + tName(sq) + ": " + (here.length ? here.map(function (p) {
        return SF.projectName(p) + " in " + p.turnsLeft + (p.turnsLeft === 1 ? " turn" : " turns");
      }).join(", ") : "nothing in production");
      menuItem(cities, text, function () { openSquare(id); });
    });
  }

  // ---------- Cities ----------
  function renderCities() {
    fillCities("your-cities", me());
    fillCities("enemy-cities", foe());
  }
  function fillCities(listId, owner) {
    var ul = $(listId);
    ul.innerHTML = "";
    SF.citiesOf(state, owner).forEach(function (id) {
      var sq = SF.sq(id);
      var li = el("li");
      var b = el("button", sq.id + ", " + tName(sq) + (sq.home !== owner ? ", captured" : ""), "act");
      b.type = "button";
      b.addEventListener("click", function () { focusSquare(sq.id); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  // ---------- Turn report ----------
  function startsOne(what) { return /^1 /.test(what); }

  function battleText(b, v) {
    var mineFirst = b.meeting ? b.attacker === v : b.attacker === v;
    var myWhat = mineFirst ? b.attWhat : b.defWhat;
    var theirWhat = mineFirst ? b.defWhat : b.attWhat;
    var myLost = mineFirst ? b.attLost : b.defLost;
    var theirLost = mineFirst ? b.defLost : b.attLost;
    var iWon = b.result === "attacker" ? mineFirst : b.result === "defender" ? !mineFirst : null;
    var s;
    if (b.meeting) {
      s = "Your " + myWhat + " ran into enemy " + theirWhat + " at " + b.at + ". ";
      if (b.result === "both destroyed") s += "Both sides were destroyed. ";
      else if (iWon === true) s += "You won the fight. ";
      else if (iWon === false) s += "The enemy won the fight. ";
      else s += "Neither side broke through, and both fell back. ";
    } else if (mineFirst) {
      s = (b.landing ? "You landed troops at " + b.at + ": " + myWhat + " against " + theirWhat + ". " :
        "You attacked " + b.at + " with " + myWhat + " against " + theirWhat + ". ");
      if (b.result === "attacker") s += "You took " + b.at + ". ";
      else if (b.result === "both destroyed") s += "Both sides were destroyed, and " + b.at + " is empty. ";
      else s += "The enemy held, and your attackers fell back. ";
    } else {
      s = (b.landing ? "Enemy troops landed at " + b.at + ": " + theirWhat + " against your " + myWhat + ". " :
        "The enemy attacked " + b.at + " with " + theirWhat + " against your " + myWhat + ". ");
      if (b.result === "attacker") s += "The enemy took " + b.at + ". ";
      else if (b.result === "both destroyed") s += "Both sides were destroyed, and " + b.at + " is empty. ";
      else s += "You held, and the attackers fell back. ";
    }
    s += myLost ? "You lost " + myLost + ". " : "You lost nothing. ";
    s += theirLost ? "The enemy lost " + theirLost + "." : "The enemy lost nothing.";
    if (b.air === v) s += " Your fighters held the sky and gave air support.";
    else if (b.air === 1 - v) s += " Enemy fighters held the sky and gave them air support.";
    return s;
  }

  // Sentences for one event as side v sees it, or null if v would not know.
  function eventText(e, v) {
    var mine = e.owner === v;
    switch (e.type) {
      case "bombard":
        if (mine) {
          return "Your " + e.what + " at " + e.from + " fired on " + e.at +
            (e.killed ? " and destroyed " + e.killed + "." : " and missed.");
        }
        return (e.naval ? "Enemy warships" : "Enemy artillery") + " fired on " + e.at + (vis.wide[e.from] ? " from " + e.from : "") +
          (e.killed ? " and destroyed your " + e.killed + "." : " and missed.");
      case "battle":
        return battleText(e, v);
      case "cutOff":
        if (mine) return "Your " + e.what + " fell back to " + e.at + ", but the enemy had taken it. They were cut off and lost.";
        return "Enemy " + e.what + " were cut off at " + e.at + " and destroyed.";
      case "move":
        if (mine) {
          if (e.landing) return "Your " + e.what + " landed at " + e.to + ".";
          return "Your " + e.what + (layerOf(e.to) === "sea" || layerOf(e.from) === "sea" ? " sailed" : " moved") +
            " from " + e.from + " to " + e.to + ".";
        }
        var seen = state.units.filter(function (u) {
          return e.unitIds.indexOf(u.id) !== -1 && SF.canSee(vis, u);
        });
        if (!seen.length) return null;
        if (e.landing) return "Enemy " + SF.describeUnits(seen) + " landed at " + e.to + ".";
        return "Enemy " + SF.describeUnits(seen) + " moved to " + e.to + (vis.wide[e.from] ? " from " + e.from : "") + ".";
      case "cargoLost":
        if (mine) return "Your " + SF.UNIT_TYPES[e.ship || "transport"].name + " sank at " + e.at + " with " + e.what + " aboard.";
        return null;
      case "airBattle":
        return "Your " + e.whats[v] + " fought enemy " + e.whats[1 - v] + " over " + e.at + ". " +
          (e.lost[v] ? "You lost " + e.lost[v] + ". " : "You lost nothing. ") +
          (e.lost[1 - v] ? "The enemy lost " + e.lost[1 - v] + "." : "The enemy lost nothing.");
      case "patrol":
        if (!mine) return null;
        return "Your " + e.what + (e.held ? " held the sky over " + e.at + "." :
          " patrolled over " + e.at + ", but the sky there was contested.");
      case "bombing":
        return bombingText(e, v);
      case "missile":
        return missileText(e, v);
      case "nuke":
        return nukeText(e, v);
      case "asat":
        if (mine) {
          return "You fired " + e.fired + " anti-satellite " + (e.fired === 1 ? "missile" : "missiles") + ". " +
            (e.destroyed ? "Destroyed " + e.destroyed + " enemy " + (e.destroyed === 1 ? "satellite." : "satellites.") : "They missed.");
        }
        return e.destroyed ? "Enemy anti-satellite missiles destroyed " + e.destroyed + " of your " +
          (e.destroyed === 1 ? "satellites." : "satellites.") : "Enemy anti-satellite missiles were fired at your satellites, but missed.";
      case "researched":
        return mine ? "Research complete: " + SF.tech(e.tech).name + ". " + SF.tech(e.tech).desc : null;
      case "hint":
        return mine ? e.text : null;
      case "morale":
        if (!mine) return null;
        if (e.to === e.from) return "Morale held at " + e.to + (e.reasons.length ? ": " + e.reasons.join(", ") : "") + ".";
        return "Morale " + (e.to > e.from ? "rose" : "fell") + " from " + e.from + " to " + e.to +
          (e.reasons.length ? ": " + e.reasons.join(", ") : "") + ".";
      case "gameOver":
        return null;
      case "rebase":
        if (!mine) return null;
        return e.ok ? "Your " + e.what + " moved to " + (e.carrier ? "the carrier at " : "") + e.to + "." :
          "Your " + e.what + " could not move to " + e.to + " and stayed at " + e.from + ".";
      case "bridgeRebuilt":
        if (mine) return "Your engineer rebuilt the bridge at " + e.at + ".";
        return vis.wide[e.at] ? "The enemy rebuilt the bridge at " + e.at + "." : null;
      case "boarded":
        return mine ? "Your " + e.what + " boarded the transport at " + e.at + "." : null;
      case "boardFailed":
        return mine ? "Your " + e.what + " could not board at " + e.at + ". The transport had moved or was full." : null;
      case "scout":
        if (mine) {
          return e.shotDown ?
            "Your scout plane from " + e.from + " was shot down by anti-aircraft fire over " + e.at + "." :
            "Your scout plane from " + e.from + " flew over " + e.at + ". You can see the area around it this turn.";
        }
        if (e.shotDown) return "Your anti-aircraft guns shot down an enemy scout plane over " + e.at + ".";
        return vis.wide[e.at] ? "An enemy scout plane flew over " + e.at + "." : null;
      case "built":
        if (!mine) return null;
        return capitalize(SF.withArticle("new " + e.what)) + (e.kind === "unit" ? " is ready at " : " is finished at ") + e.at + ".";
      case "cityCaptured":
        if (mine) {
          var retook = SF.sq(e.at).home === v;
          return retook ? "You retook your city " + e.at + "." :
            "You captured " + e.at + ". It produces at " + Math.round(SF.CAPTURE_RATE * 100) + "% for " + SF.CAPTURE_TURNS + " turns.";
        }
        if (e.from !== v) return null;
        return "The enemy captured your city " + e.at + "." +
          (e.lost.length ? " Production there was lost: " + e.lost.join(", ") + "." : "");
      case "income":
        if (!mine) return null;
        var t = "Income: " + resourceList(e.income) + ".";
        return t;
      case "planesLost":
        if (mine) return "Your " + e.what + " at " + e.at + (startsOne(e.what) ? " was" : " were") + " destroyed when the city fell.";
        return "You destroyed enemy " + e.what + " at " + e.at + " when you took the city.";
    }
    return null;
  }

  // Every nuclear launch is known to both sides.
  function nukeText(e, v) {
    var how = { missile: "missile", bomber: "bomber", submarine: "submarine-launched missile" }[e.method];
    var mine = e.owner === v;
    if (e.result !== "detonated") {
      var why = e.result === "shotDown" ? "was shot down" : e.result === "intercepted" ? "was intercepted" : "never launched";
      return mine ? "Your nuclear " + how + " aimed at " + e.at + " " + why + "." :
        "The enemy launched a nuclear " + how + " at " + e.at + ". It " + why + ".";
    }
    var s = (mine ? "Your nuclear " + how + " struck " : "An enemy nuclear " + how + " struck ") + e.at + ". ";
    var mineLost = e.killed[v], theirsLost = e.killed[1 - v];
    var mineBuilt = e.wrecked[v], theirsBuilt = e.wrecked[1 - v];
    if (mineLost) s += "You lost " + mineLost + ". ";
    if (theirsLost) s += "The enemy lost " + theirsLost + ". ";
    if (mineBuilt.length) s += "Your buildings destroyed: " + mineBuilt.length + ". ";
    if (theirsBuilt.length) s += "Enemy buildings destroyed: " + theirsBuilt.length + ". ";
    return s + e.at + " is radioactive for " + SF.NUKE.fallout + " turns.";
  }

  function missileText(e, v) {
    var n = e.fired, many = n === 1 ? "missile" : "missiles";
    var where = (e.mode === "buildings" ? "buildings in " : "") + e.at;
    var stopped = e.stopped ? (e.stopped === n ? (n === 1 ? "It was shot down." : "All of them were shot down.") :
      e.stopped + " of them " + (e.stopped === 1 ? "was" : "were") + " shot down.") : "";
    if (e.owner === v) {
      // Results are only known for squares you can see, and enemy cities.
      if (!vis.wide[e.at] && e.mode !== "buildings") {
        return "You fired " + n + " " + many + " from " + e.from + " at " + e.at + ". You cannot see what they hit.";
      }
      var s = "You fired " + n + " " + many + " from " + e.from + " at " + where + ". " + (stopped ? stopped + " " : "");
      if (e.stopped === n) return s.trim();
      if (e.mode === "buildings") return s + (e.wrecked.length ? "They destroyed " + e.wrecked.map(SF.withArticle).join(" and ") + "." : "No buildings were hit.");
      return s + (e.killed ? "They destroyed " + e.killed + "." : "They hit nothing.");
    }
    if (!e.stopped && !e.killed && !e.wrecked.length && !vis.wide[e.at]) return null;
    var t = n + " enemy " + many + " struck " + where + ". " + (e.stopped ? "Your defenses shot down " + e.stopped + ". " : "");
    if (e.mode === "buildings") return t + (e.wrecked.length ? "They destroyed " + e.wrecked.map(SF.withArticle).join(" and ") + " in your city." : "No buildings were hit.");
    return t + (e.killed ? "They destroyed your " + e.killed + "." : "They hit nothing.");
  }

  function bombingText(e, v) {
    var mode = { troops: "troops", buildings: "buildings", bridge: "the bridge" }[e.mode];
    var s, i = e.intercepted;
    if (e.owner === v) {
      s = "Your " + e.what + " from " + e.from + " bombed " + mode + " at " + e.at + ". ";
      if (i) {
        s += "Enemy " + i.by + " intercepted them. You lost " + (i.lostDef || "nothing") +
          ". The enemy lost " + (i.lostAtt || "nothing") + ". ";
      }
      if (e.shotDown) s += "Anti-aircraft fire shot down " + e.shotDown + ". ";
    } else {
      if (!i && !e.killed && !e.wrecked.length && !e.bridge && !vis.wide[e.at]) return null;
      s = "Enemy bombers attacked " + mode + " at " + e.at + ". ";
      if (i) {
        s += "Your " + i.by + " intercepted them. You lost " + (i.lostAtt || "nothing") +
          ". The enemy lost " + (i.lostDef || "nothing") + ". ";
      }
      if (e.shotDown) s += "Your anti-aircraft guns shot down " + e.shotDown + ". ";
    }
    if (!e.dropped) return s + "No bombs were dropped.";
    var yours = e.owner === v ? "" : "your ";
    if (e.mode === "troops") s += e.killed ? "The bombs destroyed " + yours + e.killed + "." : "The bombs missed.";
    else if (e.mode === "buildings") s += e.wrecked.length ? "The bombs destroyed " + e.wrecked.map(SF.withArticle).join(" and ") + (e.owner === v ? "" : " in your city") + "." : "No buildings were hit.";
    else s += e.bridge ? "The bridge is down." : "The bridge still stands.";
    return s;
  }

  function reportList(report, v) {
    var ul = el("ul");
    (report.events || []).forEach(function (e) {
      var t = eventText(e, v);
      if (t) ul.appendChild(el("li", t));
    });
    if (!ul.children.length) ul.appendChild(el("li", "Nothing to report."));
    if (!SF.researchOf(state, v).queue.length) {
      ul.appendChild(el("li", "Your research queue is empty. Your science is saved until you add something to the queue, in the Research part of Your nation."));
    }
    return ul;
  }

  function renderReport() {
    var section = $("report-section");
    if (!state.report) { section.hidden = true; return; }
    section.hidden = false;
    $("report-heading").textContent = "Turn " + state.report.turn + " results";
    var box = $("report");
    box.innerHTML = "";
    box.appendChild(reportList(state.report, me()));
  }

  // ---------- Screens ----------
  function renderStatus() {
    var who = state.mode === "hotseat" ? sideName(me()) + " gives orders" : sideName(me()) + ", your orders";
    var text = "Turn " + state.turn + ". " + who + ".";
    if (state.mode === "online") {
      var locked = state.locked || [false, false];
      if (locked[me()]) text = "Turn " + state.turn + ". Your orders are locked in. Waiting for " + sideName(foe()) + ".";
      else if (locked[foe()]) text += " " + sideName(foe()) + " has locked in.";
    }
    $("status").textContent = text;
    if (state.mode === "online") {
      $("lock-btn").textContent = (state.locked || [])[me()] ? "Unlock my orders" : "Lock in turn " + state.turn + " orders";
    }
  }

  // ---------- Starting buildings ----------
  var plan = null;   // the plan being edited on the setup screen

  function planUsed(id) {
    var n = 0;
    SF.BUILDING_ORDER.forEach(function (k) { n += (plan[id] && plan[id][k]) || 0; });
    return n;
  }

  function renderPlanLeft() {
    var used = SF.planCost(plan);
    $("plan-left").textContent = "Buildings chosen: " + used + " of " + SF.START_BUDGET + ".";
  }

  var planNation = null;   // { name, gov } being chosen on the setup screen

  function renderPlanGov() {
    $("plan-gov-desc").textContent = SF.GOVERNMENTS[planNation.gov].desc;
  }

  function renderPlan() {
    show("plan");
    if (!plan) plan = SF.defaultPlan(me());
    if (!planNation) {
      var avoid = me() === 1 ? SF.nation(state, 0).name : null;
      planNation = { gov: "democracy" };
      planNation.name = SF.randomNationName(planNation.gov, avoid);
    }
    $("plan-heading").textContent = state.mode === "hotseat" ?
      (me() === 0 ? "First player" : "Second player") + ", set up your nation" :
      state.mode === "online" ? "Set up your nation. Game code " + spell(net.code) : "Set up your nation";
    var govSel = $("plan-gov");
    govSel.innerHTML = "";
    SF.GOVERNMENT_ORDER.forEach(function (g) {
      var o = el("option", SF.GOVERNMENTS[g].name);
      o.value = g;
      govSel.appendChild(o);
    });
    govSel.value = planNation.gov;
    $("plan-name").value = planNation.name;
    renderPlanGov();
    $("plan-error").textContent = "";
    var box = $("plan-cities");
    box.innerHTML = "";
    SF.citiesOf(state, me()).forEach(function (id) {
      var info = SF.cityInfo(id);
      var free = SF.freeCount(id);
      var room = info.slots - free;
      box.appendChild(el("h3", id + ", " + tName(SF.sq(id)) + ", room for " + room +
        (free ? ", comes with " + buildingsText(SF.freeBuildings(id)) : "") +
        ", manpower " + info.pop + " a turn"));
      var wrap = el("div", undefined, "order-form");
      SF.BUILDING_ORDER.forEach(function (k) {
        var label = el("label", capitalize(SF.BUILDINGS[k].plural) + " at " + id);
        var sel = document.createElement("select");
        for (var i = 0; i <= room; i++) {
          var o = el("option", String(i));
          o.value = String(i);
          sel.appendChild(o);
        }
        sel.value = String((plan[id] && plan[id][k]) || 0);
        sel.addEventListener("change", function () {
          plan[id] = plan[id] || {};
          plan[id][k] = parseInt(sel.value, 10);
          renderPlanLeft();
          var used = planUsed(id);
          $("plan-error").textContent = used > room ? id + " only has room for " + room + " buildings." : "";
        });
        label.appendChild(sel);
        wrap.appendChild(label);
      });
      box.appendChild(wrap);
    });
    renderPlanLeft();
  }

  function confirmPlan() {
    var problem = SF.planProblem(me(), plan);
    if (problem) { $("plan-error").textContent = problem; return; }
    var name = $("plan-name").value.trim();
    if (!name) { $("plan-error").textContent = "Give your nation a name, or press Suggest a name."; return; }
    if (state.mode === "hotseat" && me() === 1 && name === SF.nation(state, 0).name) {
      $("plan-error").textContent = "That name is taken by the other player.";
      return;
    }
    if (state.mode === "online") {
      var gov = $("plan-gov").value, myPlan = plan;
      $("plan-done").disabled = true;
      SF.online.finishSetup(net.code, net.side, name, gov, myPlan).then(function (remote) {
        $("plan-done").disabled = false;
        plan = null;
        planNation = null;
        adopt(remote);
        renderAll();
        $(state.phase === "orders" ? "status" : "waiting-heading").focus();
      }).catch(function (x) {
        $("plan-done").disabled = false;
        $("plan-error").textContent = x.message;
      });
      return;
    }
    SF.setNation(state, me(), name, $("plan-gov").value);
    SF.applyPlan(state, me(), plan);
    plan = null;
    planNation = null;
    if (state.mode === "computer") {
      state.phase = "orders";
    } else if (me() === 0) {
      state.current = 1;
      state.phase = "handoff";
      state.afterHandoff = "setup";
    } else {
      state.current = 0;
      state.phase = "handoff";
      state.afterHandoff = "orders";
    }
    save();
    renderAll();
    (state.phase === "handoff" ? $("handoff-heading") : $("status")).focus();
  }

  // ---------- Nation ----------
  function resourceList(r) {
    return r.industry + " industry, " + r.gasoline + " gasoline, " + r.science + " science, and " +
      r.recruits + " recruits";
  }

  var BRANCH_NAME = {};
  SF.BRANCHES.forEach(function (b) { BRANCH_NAME[b[0]] = b[1]; });

  function techLine(t) {
    return t.name + ", " + BRANCH_NAME[t.branch].toLowerCase() + " tier " + t.tier + ", " + t.cost + " science. " + t.desc;
  }

  function renderResearch(box) {
    var r = SF.researchOf(state, me());
    var saved = state.econ[me()].science;
    var perTurn = SF.income(state, me()).science;
    box.appendChild(focusable(el("h3", "Research"), "research-heading"));
    if (!r.queue.length) {
      box.appendChild(el("p", "Science saved: " + saved + ". Your research queue is empty, so your science is being saved until you add something."));
    } else {
      var t = SF.tech(r.queue[0]);
      var need = t.cost - saved;
      var turns = need <= 0 ? 1 : perTurn > 0 ? Math.ceil(need / perTurn) : null;
      box.appendChild(el("p", "Science saved: " + saved + ". Researching " + t.name + ", " + Math.min(saved, t.cost) +
        " of " + t.cost + " science" + (turns ? ", about " + turns + (turns === 1 ? " turn" : " turns") + " to go." : ". You have no lab workers.")));
    }

    box.appendChild(el("h3", "Research queue"));
    if (!r.queue.length) {
      box.appendChild(el("p", "Nothing queued."));
    } else {
      var ol = el("ol", undefined, "plain");
      r.queue.forEach(function (id, i) {
        var t2 = SF.tech(id);
        var li = el("li");
        li.appendChild(el("span", (i + 1) + ". " + techLine(t2)));
        if (i > 0) {
          var up = el("button", "Move up", "act");
          up.type = "button";
          up.setAttribute("aria-label", "Move " + t2.name + " up");
          up.addEventListener("click", function () {
            var moved = SF.moveTechUp(state, me(), id);
            save();
            renderAll();
            $("nation-heading").focus();
            announce(moved ? t2.name + " moved up." : t2.name + " has to come after the research before it in its branch.");
          });
          li.appendChild(up);
        }
        var rm = el("button", "Remove", "act");
        rm.type = "button";
        rm.setAttribute("aria-label", "Remove " + t2.name + " from the queue");
        rm.addEventListener("click", function () {
          SF.unqueueTech(state, me(), id);
          save();
          renderAll();
          $("nation-heading").focus();
          announce(t2.name + " removed, along with anything after it in its branch.");
        });
        li.appendChild(rm);
        ol.appendChild(li);
      });
      box.appendChild(ol);
    }

    var options = SF.queueable(state, me());
    if (options.length) {
      box.appendChild(el("h3", "Add research"));
      var form = el("form", undefined, "order-form");
      var label = el("label", "Technology");
      var sel = document.createElement("select");
      options.forEach(function (t3) {
        var o = el("option", techLine(t3));
        o.value = t3.id;
        sel.appendChild(o);
      });
      label.appendChild(sel);
      form.appendChild(label);
      submitButton(form, "Add to queue");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        SF.queueTech(state, me(), sel.value);
        save();
        renderAll();
        $("nation-heading").focus();
        announce(SF.tech(sel.value).name + " added to the research queue.");
      });
      box.appendChild(form);
    }

    box.appendChild(el("h3", "Completed research"));
    box.appendChild(el("p", r.done.length ? r.done.map(function (id) { return SF.tech(id).name; }).join(", ") + "." : "None yet."));

    if (SF.effect(state, me(), "codebreaking")) {
      var theirs = SF.researchOf(state, foe()).done;
      box.appendChild(el("h3", "Enemy research, from code breaking"));
      box.appendChild(el("p", theirs.length ? theirs.map(function (id) { return SF.tech(id).name; }).join(", ") + "." : "The enemy has not finished any research yet."));
    }
  }

  function renderSatellites(box) {
    var sats = SF.satellites(state, me());
    if (!sats.length) return;
    box.appendChild(el("h3", "Satellites"));
    box.appendChild(el("p", sats.length + " in orbit. Your missiles and missile defense are " +
      Math.round(SF.satelliteBonus(state, me()) * 100) + "% more accurate. Each satellite watches the 7 by 7 area around its square."));
    sats.forEach(function (sat, i) {
      var form = el("form", undefined, "row");
      var input = squareInput(form, "Satellite " + (i + 1) + " is watching " + sat.watch + ". New square to watch");
      submitButton(form, "Change");
      var error = formError(form);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value.trim().toUpperCase().replace(/\s+/g, "");
        if (!SF.sq(v)) { error.textContent = "Not a square. Use a letter A to P and a number 1 to 16."; return; }
        SF.setSatelliteWatch(state, me(), sat.id, v);
        save();
        renderAll();
        $("nation-heading").focus();
        announce("Satellite " + (i + 1) + " now watching " + v + ".");
      });
      box.appendChild(form);
    });
  }

  function renderNation() {
    var box = $("nation");
    box.innerHTML = "";
    var e = state.econ[me()];
    var inc = SF.income(state, me());
    var mp = SF.manpower(state, me());
    var nat = SF.nation(state, me()), g = SF.gov(state, me());
    var enemy = SF.nation(state, foe());
    box.appendChild(el("p", nat.name + ", " + g.name + ". Morale " + nat.morale + " of 100. At 0, your nation surrenders."));
    box.appendChild(el("p", "Your enemy: " + enemy.name + ", " + SF.GOVERNMENTS[enemy.gov].name +
      ". Their morale looks " + SF.moraleWord(enemy.morale) + "."));
    var ability = SF.ABILITIES[g.ability];
    var problem = SF.abilityProblem(state, me());
    var ab = el("button", ability.name, "act");
    ab.type = "button";
    ab.id = "ability-btn";
    if (problem) {
      ab.setAttribute("aria-disabled", "true");
      ab.setAttribute("aria-label", ability.name + ", not available. " + problem);
    }
    ab.addEventListener("click", function () {
      var why = SF.abilityProblem(state, me());
      if (why) { announce(why); return; }
      var msg = SF.useAbility(state, me());
      save();
      renderAll();
      $("nation-heading").focus();
      announce(msg);
    });
    var abp = el("p");
    abp.appendChild(ab);
    box.appendChild(abp);
    box.appendChild(el("p", "Stockpile: " + resourceList(e) + "."));
    if (e.warheads) box.appendChild(el("p", "Nuclear warheads ready: " + e.warheads + "."));
    box.appendChild(el("p", "Each turn: " + resourceList(inc) + ", from " + mp + " manpower."));

    if (lockedOnline()) {
      box.appendChild(el("p", "Your orders are locked in. Unlock them to change your workforce, research, or production."));
      return;
    }
    box.appendChild(focusable(el("h3", "Workforce"), "workforce-heading"));
    var form = el("form", undefined, "order-form");
    var pickers = {};
    SF.JOB_ORDER.forEach(function (j) {
      var cap = SF.capacity(state, me(), j);
      var text = capitalize(SF.JOBS[j].name) + (cap === Infinity ? "" : ", buildings can use " + cap);
      var label = el("label", text);
      var sel = document.createElement("select");
      var max = Math.max(mp, e.workers[j]);
      for (var i = 0; i <= max; i++) {
        var o = el("option", String(i));
        o.value = String(i);
        sel.appendChild(o);
      }
      sel.value = String(e.workers[j]);
      sel.addEventListener("change", showFree);
      label.appendChild(sel);
      form.appendChild(label);
      pickers[j] = sel;
    });
    var free = el("p");
    form.appendChild(free);
    var err = el("p");
    err.setAttribute("role", "alert");
    form.appendChild(err);
    var saveBtn = el("button", "Save workforce", "act primary");
    saveBtn.type = "submit";
    form.appendChild(saveBtn);

    function chosen() {
      var w = {};
      SF.JOB_ORDER.forEach(function (j) { w[j] = parseInt(pickers[j].value, 10); });
      return w;
    }
    function showFree() {
      var w = chosen(), total = 0;
      SF.JOB_ORDER.forEach(function (j) { total += w[j]; });
      free.textContent = total <= mp ? "Unassigned: " + (mp - total) + "." : "Over by " + (total - mp) + ".";
    }
    showFree();

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      try {
        SF.setWorkers(state, me(), chosen());
      } catch (x) {
        err.textContent = "You only have " + mp + " manpower. Lower some jobs first.";
        return;
      }
      save();
      renderAll();
      $("nation-heading").focus();
      var after = SF.income(state, me());
      announce("Workforce saved. Each turn: " + resourceList(after) + ".");
    });
    box.appendChild(form);

    renderResearch(box);
    renderSatellites(box);

    box.appendChild(el("h3", "In production"));
    var mine = state.projects.filter(function (p) { return p.owner === me(); });
    if (!mine.length) {
      box.appendChild(el("p", "Nothing in production."));
    } else {
      var ul = el("ul", undefined, "plain");
      mine.forEach(function (p) {
        var li = el("li");
        li.appendChild(el("span", projectText(p) + "."));
        if (SF.canCancelProject(state, p)) li.appendChild(cancelProjectButton(p, "nation-heading"));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
  }

  function projectText(p) {
    var what = p.kind === "unit" ? capitalize(SF.projectName(p)) : capitalize(SF.projectName(p)) + " construction";
    return what + " at " + p.city + ", ready in " + p.turnsLeft + (p.turnsLeft === 1 ? " turn" : " turns");
  }

  function cancelProjectButton(p, focusId) {
    var b = el("button", "Cancel", "act");
    b.type = "button";
    b.setAttribute("aria-label", "Cancel " + projectText(p) + ", full refund");
    b.addEventListener("click", function () {
      SF.cancelProject(state, me(), p.id);
      save();
      renderAll();
      $(focusId).focus();
      announce("Canceled and refunded.");
    });
    return b;
  }

  function renderAll() {
    if (!state) { renderSetup(); return; }
    if (state.over) { renderGameOver(); return; }
    if (state.phase === "handoff") { renderHandoff(); return; }
    if (state.mode === "online" && renderOnlineWait()) return;
    if (state.phase === "setup") { renderPlan(); return; }
    show("game");
    vis = SF.vision(state, me());
    renderStatus();
    renderReport();
    renderMap();
    renderDetails();
    renderNation();
    renderOrders();
    renderCities();
    renderTurnMenu();
  }

  function renderSetup() {
    show("setup");
    var saved = loadSave();
    var onl = loadOnline();
    $("continue-online-item").hidden = !onl;
    if (onl) {
      $("continue-online-btn").textContent = "Continue online game " + spell(onl.code) + ", turn " + onl.state.turn;
    }
    $("continue-item").hidden = !saved;
    if (saved) {
      var kind = saved.mode === "hotseat" ? "pass and play" :
        "against the computer, " + (SF.DIFFICULTIES[saved.difficulty || "normal"].name).toLowerCase();
      $("continue-btn").textContent = "Continue saved game, turn " + saved.turn + ", " + kind;
    }
  }

  function renderHandoff() {
    show("handoff");
    var to = sideName(me());
    $("handoff-report").innerHTML = "";
    $("handoff-heading").textContent = "Pass the phone to " + to;
    $("handoff-btn").textContent = "Start " + to + "'s turn";
  }

  var REASONS = {
    surrender: "surrendered when its morale collapsed",
    conquest: "lost every one of its cities",
    annihilation: "was left with no army and no way to build one"
  };

  function renderGameOver() {
    show("over");
    var r = state.over, box = $("over-text");
    box.innerHTML = "";
    if (r.winner === "draw") {
      $("over-heading").textContent = "The war ends in a draw";
      box.appendChild(el("p", "Both nations fell in the same turn."));
    } else {
      var winner = sideName(r.winner), loser = sideName(r.loser);
      var mine = state.mode === "computer" ? (r.winner === 0 ? "Victory. " : "Defeat. ") : "";
      $("over-heading").textContent = mine + winner + " wins";
      box.appendChild(el("p", loser + " " + REASONS[r.reason] + ", on turn " + (state.turn - 1) + "."));
    }
    [0, 1].forEach(function (o) {
      var n = SF.nation(state, o);
      box.appendChild(el("p", n.name + ", " + SF.GOVERNMENTS[n.gov].name + ": morale " + n.morale +
        ", " + SF.citiesOf(state, o).length + " cities, " +
        state.units.filter(function (u) { return u.owner === o; }).length + " units."));
    });
    var rep = $("over-report");
    rep.innerHTML = "";
    vis = SF.vision(state, state.mode === "computer" ? 0 : state.current);
    if (state.report) rep.appendChild(reportList(state.report, state.mode === "computer" ? 0 : state.current));
  }

  function startGame(mode) {
    state = SF.newGame(mode, $("new-difficulty").value);
    selected = null;
    plan = null;
    planNation = null;
    save();
    renderAll();
    $("plan-heading").focus();
  }

  // ---------- Online ----------

  function lockedOnline() { return state.mode === "online" && !!(state.locked || [])[me()]; }

  // "K Q X Z", so screen readers say the letters one by one.
  function spell(code) { return code.split("").join(" "); }

  // While waiting on the other player before the war starts, show a waiting
  // screen. Returns true if it did.
  function renderOnlineWait() {
    var other = sideName(foe());
    var heading = null, lines = [];
    if (!state.joined && me() === 0 && state.setupDone[0]) {
      heading = "Waiting for your friend to join";
      lines.push("Your game code is " + spell(net.code) + ". Your friend opens Sovereign Fire, chooses Join game, and types the code.");
    } else if (state.phase === "setup" && state.setupDone[me()]) {
      heading = "Waiting for " + (state.setupDone[foe()] ? other : "your opponent") + " to finish setting up";
      lines.push("Game code " + spell(net.code) + ".");
    }
    if (!heading) return false;
    show("waiting");
    $("waiting-heading").textContent = heading;
    var box = $("waiting-text");
    box.innerHTML = "";
    lines.forEach(function (t) { box.appendChild(el("p", t)); });
    box.appendChild(el("p", "This screen updates by itself."));
    return true;
  }

  // Take the saved game from the server as ours. During a turn, keep any
  // orders and changes we have not locked in yet.
  function adopt(remote) {
    if (state && state.mode === "online" && !remote.over && remote.phase === "orders" && state.phase === "orders" &&
        remote.turn === state.turn && !(remote.locked || [])[net.side]) {
      SF.mergeSide(remote, state, net.side);
    }
    remote.current = net.side;
    state = remote;
    save();
  }

  // Something changed on the server.
  function onRemote(remote) {
    if (!state || state.mode !== "online") return;
    var before = { turn: state.turn, phase: state.phase, joined: state.joined, over: !!state.over,
      foeLocked: !!(state.locked || [])[foe()], setup: state.setupDone.slice() };
    adopt(remote);
    if (state.over && !before.over) {
      renderAll();
      $("over-heading").focus();
    } else if (state.turn !== before.turn) {
      selected = null;
      renderAll();
      $("report-heading").focus();
      announce("Turn " + before.turn + " results are in.");
    } else if (state.phase === "setup" && !state.setupDone[me()] && state.phase === before.phase) {
      // Still choosing our own setup: do not redraw the form being filled in.
      if (state.joined && !before.joined && me() === 0) announce("Your friend has joined.");
    } else if (state.phase !== before.phase || state.joined !== before.joined ||
               state.setupDone[foe()] !== before.setup[foe()]) {
      renderAll();
      if (state.joined && !before.joined && me() === 0) announce("Your friend has joined.");
      if (state.phase === "orders" && before.phase !== "orders") {
        $("status").focus();
        announce("The war has begun.");
      }
    } else if (!!(state.locked || [])[foe()] !== before.foeLocked) {
      // Only their lock changed. Update quietly so nothing you are doing is lost.
      if (!$("game").hidden) renderStatus();
      announce((state.locked || [])[foe()] ? sideName(foe()) + " has locked in their orders." :
        sideName(foe()) + " unlocked their orders.");
    }
  }

  function startOnline(code, side, remote) {
    net = { code: code, side: side };
    rememberSide(code, side);
    state = null;
    adopt(remote);
    SF.online.listen(code, onRemote);
    selected = null;
    plan = null;
    planNation = null;
    renderAll();
  }

  function onlineError(x) {
    $("online-error").textContent = x.message || "Something went wrong reaching the game server.";
  }

  function createOnline() {
    $("online-error").textContent = "";
    var fresh = SF.newGame("online");
    fresh.joined = false;
    fresh.locked = [false, false];
    SF.online.create(fresh).then(function (code) {
      startOnline(code, 0, fresh);
      $("plan-heading").focus();
      announce("Online game created. Your game code is " + spell(code) + ".");
    }).catch(onlineError);
  }

  function joinOnline(text) {
    $("online-error").textContent = "";
    var code = SF.online.cleanCode(text);
    if (!code) { $("online-error").textContent = "A game code is 4 letters."; return; }
    var side = knownSide(code);
    var go = side === null ? SF.online.join(code).then(function (remote) { return { side: 1, remote: remote }; }) :
      SF.online.read(code).then(function (rec) {
        if (!rec) throw new Error("There is no game with that code.");
        return { side: side, remote: rec.state };
      });
    go.then(function (r) {
      startOnline(code, r.side, r.remote);
      var focus = state.over ? "over-heading" : !$("waiting").hidden ? "waiting-heading" :
        state.phase === "setup" ? "plan-heading" : "status";
      $(focus).focus();
    }).catch(function (x) {
      onlineError(/no longer exists/.test(x.message) ? new Error("There is no game with that code.") : x);
    });
  }

  function lockInOnline() {
    var btn = $("lock-btn");
    btn.disabled = true;
    var locked = (state.locked || [])[me()];
    var step = locked ? SF.online.unlock(net.code, state, net.side) : SF.online.lockIn(net.code, state, net.side);
    step.then(function (remote) {
      btn.disabled = false;
      var turn = state.turn;
      adopt(remote);
      selected = null;
      renderAll();
      if (state.over) { $("over-heading").focus(); return; }
      if (state.turn !== turn) {
        $("report-heading").focus();
        announce("Turn " + turn + " results are in.");
      } else {
        $("status").focus();
      }
    }).catch(function (x) {
      btn.disabled = false;
      announce(x.message);
    });
  }

  function lockIn() {
    if (state.mode === "online") { lockInOnline(); return; }
    if (state.mode === "computer") {
      SF.computerOrders(state);
      SF.resolveTurn(state);
      selected = null;
      save();
      renderAll();
      $(state.over ? "over-heading" : "report-heading").focus();
      return;
    }
    if (me() === 0) {
      state.current = 1;
    } else {
      SF.resolveTurn(state);
      state.current = 0;
      if (state.over) {
        selected = null;
        save();
        renderAll();
        $("over-heading").focus();
        return;
      }
    }
    state.phase = "handoff";
    state.afterHandoff = "orders";
    selected = null;
    save();
    renderAll();
    $("handoff-heading").focus();
  }

  // ---------- Wiring ----------
  buildMap();

  $("new-computer").addEventListener("click", function () { startGame("computer"); });
  $("new-hotseat").addEventListener("click", function () { startGame("hotseat"); });
  $("continue-btn").addEventListener("click", function () {
    state = loadSave();
    selected = null;
    plan = null;
    renderAll();
    var focus = state.over ? "over-heading" : { handoff: "handoff-heading", setup: "plan-heading" }[state.phase] || "status";
    $(focus).focus();
  });
  $("handoff-btn").addEventListener("click", function () {
    state.phase = state.afterHandoff || "orders";
    save();
    renderAll();
    if (state.phase === "setup") $("plan-heading").focus();
    else (state.report ? $("report-heading") : $("status")).focus();
  });
  $("plan-default").addEventListener("click", function () {
    plan = SF.defaultPlan(me());
    renderPlan();
    $("plan-heading").focus();
    announce("Balanced plan restored.");
  });
  $("plan-done").addEventListener("click", confirmPlan);
  $("plan-gov").addEventListener("change", function () {
    planNation.gov = $("plan-gov").value;
    renderPlanGov();
  });
  $("plan-name").addEventListener("input", function () { planNation.name = $("plan-name").value; });
  $("plan-random").addEventListener("click", function () {
    var avoid = me() === 1 ? SF.nation(state, 0).name : null;
    planNation.name = SF.randomNationName($("plan-gov").value, avoid);
    $("plan-name").value = planNation.name;
    announce("Suggested name: " + planNation.name + ".");
  });
  $("online-create").addEventListener("click", createOnline);
  $("online-join-form").addEventListener("submit", function (e) {
    e.preventDefault();
    joinOnline($("online-join-code").value);
  });
  $("continue-online-btn").addEventListener("click", function () {
    var onl = loadOnline();
    if (!onl) return;
    $("online-error").textContent = "";
    net = { code: onl.code, side: onl.side };
    state = onl.state;
    SF.online.read(onl.code).then(function (rec) {
      if (!rec) throw new Error("That online game has ended or expired.");
      startOnline(onl.code, onl.side, rec.state);
      var focus = state.over ? "over-heading" : !$("waiting").hidden ? "waiting-heading" :
        state.phase === "setup" ? "plan-heading" : "status";
      $(focus).focus();
    }).catch(function (x) { state = null; net = null; onlineError(x); renderAll(); });
  });
  $("over-new").addEventListener("click", function () {
    if (state && state.mode === "online") { SF.online.stop(); clearOnline(); net = null; }
    clearSave();
    state = null;
    renderAll();
    $("setup-heading").focus();
  });
  $("lock-btn").addEventListener("click", lockIn);
  $("next-btn").addEventListener("click", nextWaiting);
  [].forEach.call(document.querySelectorAll(".back-to-menu"), function (b) {
    b.addEventListener("click", function () { $("turn-menu-heading").focus(); });
  });
  $("quit-btn").addEventListener("click", function () {
    if (state && state.mode === "online") {
      if (!window.confirm("Leave this online game? You can rejoin on this device by typing its code under Join game.")) return;
      SF.online.stop();
      clearOnline();
      net = null;
      state = null;
      renderAll();
      $("setup-heading").focus();
      return;
    }
    if (!window.confirm("Start a new game? The current game will be lost.")) return;
    clearSave();
    state = null;
    renderAll();
    $("setup-heading").focus();
  });

  $("goto-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("goto-input").value.trim().toUpperCase().replace(/\s+/g, "");
    if (!SF.sq(v)) {
      $("goto-error").textContent = "Not a square. Use a letter A to P and a number 1 to 16.";
      return;
    }
    $("goto-error").textContent = "";
    focusSquare(v);
  });

  renderAll();
})(window.SF);
