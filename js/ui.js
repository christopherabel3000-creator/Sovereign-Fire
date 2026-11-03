// Sovereign Fire: screens, map, and controls.
// Everything shown is from the point of view of the side giving orders, and
// only includes what that side can see.
(function (SF) {
  "use strict";

  var SAVE_KEY = "sovereignFire.save";
  var SAVE_VERSION = 3;
  var state = null;
  var selected = null;     // id of the selected square
  var buttons = {};        // map square buttons by id
  var vis = null;          // what the current side can see

  function $(id) { return document.getElementById(id); }

  // ---------- Saving ----------
  function save() {
    state.version = SAVE_VERSION;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
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
  function sideName(owner) { return owner === 0 ? "North" : "South"; }
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
  function seenEnemyGround(id) { return seenEnemies(id).filter(function (u) { return !SF.isAir(u); }); }
  function knownEnemy(id) { return SF.knownOccupant(state, me(), id, vis) === foe(); }
  function isHidden(id) { return !vis.wide[id]; }

  function announce(text) {
    var a = $("announcer");
    a.textContent = "";
    setTimeout(function () { a.textContent = text; }, 50);
  }

  function show(which) {
    ["setup", "plan", "handoff", "game"].forEach(function (id) { $(id).hidden = id !== which; });
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
      else t[o.to] = knownEnemy(o.to) ? "attack" : "move";
    });
    return t;
  }

  var TARGET_TEXT = {
    move: "your units moving here",
    attack: "your attack target",
    bombard: "your artillery firing here",
    scout: "your scout plane flying here"
  };

  function squareLabel(sq, targets) {
    var parts = [sq.id, SF.terrainName(sq)];
    var terr = territory(sq);
    var mine = SF.unitsAt(state, sq.id, me());
    var theirs = seenEnemies(sq.id);
    // "your" or "enemy" in front of the units already says whose land it is.
    var sameSide = (terr === "yours" && mine.length) || (terr === "enemy" && theirs.length);
    if (terr && !sameSide) parts.push(terr);
    if (mine.length) parts.push("your " + SF.describeUnits(mine));
    if (theirs.length) parts.push("enemy " + SF.describeUnits(theirs));
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
    if (knownEnemy(o.to)) return "attacking " + o.to;
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
    box.appendChild(el("p", sq.id + ", " + SF.terrainName(sq) + (terr ? ", " + terr : "") + "."));
    box.appendChild(el("p", SF.NOTES[sq.terrain.key]));
    if (sq.terrain.key === "city" && SF.isCoastal(sq)) box.appendChild(el("p", "Can build a port."));

    if (isHidden(sq.id)) {
      box.appendChild(el("p", "Hidden. You cannot see what enemy units are here."));
    } else {
      var theirs = seenEnemies(sq.id);
      if (theirs.length) box.appendChild(el("p", "Enemy units: " + SF.describeUnits(theirs) + "."));
    }

    var mine = SF.unitsAt(state, sq.id, me());
    var leaving = myOrders().filter(function (o) { return o.from === sq.id; });
    var arriving = myOrders().filter(function (o) { return o.to === sq.id && o.kind === "move"; });

    if (mine.length) {
      box.appendChild(el("h3", "Your units here"));
      var ul = el("ul", undefined, "plain");
      var waiting = unorderedAt(sq.id);
      if (waiting.length) ul.appendChild(el("li", "Awaiting orders: " + SF.describeUnits(waiting) + "."));
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

    var waitingNow = unorderedAt(sq.id);
    var byType = {};
    waitingNow.forEach(function (u) { (byType[u.type] = byType[u.type] || []).push(u); });
    var city = state.cities[sq.id];
    if (city && city.owner === me()) renderCityPanel(box, sq);
    var ground = waitingNow.filter(function (u) { return !SF.isAir(u); });
    if (ground.length) renderOrderForm(box, sq, ground);
    renderBombardForm(box, sq, byType.artillery || []);
    renderScoutForm(box, sq, byType.scoutPlane || []);
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
      var cost = SF.UNIT_COST[type];
      var problem = SF.unitProblem(state, me(), id, type);
      var text = capitalize(SF.UNIT_TYPES[type].name) + ", " + cost.industry + " industry, " +
        cost.recruits + (cost.recruits === 1 ? " recruit" : " recruits") + ", " +
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
      var ids = SF.reachable(state, me(), sq.id, types);
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
        var text = id + ", " + SF.terrainName(s2) + (terr ? ", " + terr : "");
        if (knownEnemy(id)) {
          odds[id] = SF.attackOdds(state, me(), units, id);
          text += ", attack " + SF.describeUnits(seenEnemyGround(id)) + ", about " + odds[id] + "% to win";
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
    var targets = SF.bombardTargets(state, me(), sq.id);
    if (!targets.length) return;
    box.appendChild(el("h3", "Artillery bombardment"));
    var form = el("form", undefined, "order-form");
    var countLabel = el("label", "Artillery to fire, " + guns.length + " available");
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
      var pct = Math.round(SF.bombardChance(id) * 100);
      var opt = el("option", id + ", " + SF.terrainName(SF.sq(id)) + ", enemy " +
        SF.describeUnits(seenEnemyGround(id)) + ", " + pct + "% per gun to destroy a unit");
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

  function renderScoutForm(box, sq, planes) {
    if (!planes.length) return;
    box.appendChild(el("h3", "Scout mission"));
    var form = el("form", undefined, "order-form");
    var label = el("label", "Target square, within " + SF.SCOUT_RANGE + " squares of " + sq.id);
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
      if (!SF.canScout(sq.id, v)) {
        error.textContent = v + " is " + SF.distance(sq.id, v) + " squares away. The limit is " + SF.SCOUT_RANGE + ".";
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
    $("lock-btn").textContent = "Lock in turn " + state.turn + " orders";
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
      var b = el("button", sq.id + ", " + SF.terrainName(sq) + (sq.home !== owner ? ", captured" : ""), "act");
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
      s = "You attacked " + b.at + " with " + myWhat + " against " + theirWhat + ". ";
      if (b.result === "attacker") s += "You took " + b.at + ". ";
      else if (b.result === "both destroyed") s += "Both sides were destroyed, and " + b.at + " is empty. ";
      else s += "The enemy held, and your attackers fell back. ";
    } else {
      s = "The enemy attacked " + b.at + " with " + theirWhat + " against your " + myWhat + ". ";
      if (b.result === "attacker") s += "The enemy took " + b.at + ". ";
      else if (b.result === "both destroyed") s += "Both sides were destroyed, and " + b.at + " is empty. ";
      else s += "You held, and the attackers fell back. ";
    }
    s += myLost ? "You lost " + myLost + ". " : "You lost nothing. ";
    s += theirLost ? "The enemy lost " + theirLost + "." : "The enemy lost nothing.";
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
        return "Enemy artillery fired on " + e.at + (vis.wide[e.from] ? " from " + e.from : "") +
          (e.killed ? " and destroyed your " + e.killed + "." : " and missed.");
      case "battle":
        return battleText(e, v);
      case "cutOff":
        if (mine) return "Your " + e.what + " fell back to " + e.at + ", but the enemy had taken it. They were cut off and lost.";
        return "Enemy " + e.what + " were cut off at " + e.at + " and destroyed.";
      case "move":
        if (mine) return "Your " + e.what + " moved from " + e.from + " to " + e.to + ".";
        var seen = state.units.filter(function (u) {
          return e.unitIds.indexOf(u.id) !== -1 && SF.canSee(vis, u);
        });
        if (!seen.length) return null;
        return "Enemy " + SF.describeUnits(seen) + " moved to " + e.to + (vis.wide[e.from] ? " from " + e.from : "") + ".";
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
        return "Income: " + resourceList(e.income) + ".";
      case "planesLost":
        if (mine) return "Your " + e.what + " at " + e.at + (startsOne(e.what) ? " was" : " were") + " destroyed on the ground.";
        return "You destroyed enemy " + e.what + " on the ground at " + e.at + ".";
    }
    return null;
  }

  function reportList(report, v) {
    var ul = el("ul");
    (report.events || []).forEach(function (e) {
      var t = eventText(e, v);
      if (t) ul.appendChild(el("li", t));
    });
    if (!ul.children.length) ul.appendChild(el("li", "Nothing to report."));
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
    var who = state.mode === "hotseat" ? sideName(me()) + "'s orders" : "Your orders";
    $("status").textContent = "Turn " + state.turn + ". " + who + ".";
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

  function renderPlan() {
    show("plan");
    if (!plan) plan = SF.defaultPlan(me());
    $("plan-heading").textContent = state.mode === "hotseat" ?
      sideName(me()) + ", choose your starting buildings" : "Choose your starting buildings";
    $("plan-error").textContent = "";
    var box = $("plan-cities");
    box.innerHTML = "";
    SF.citiesOf(state, me()).forEach(function (id) {
      var info = SF.cityInfo(id);
      box.appendChild(el("h3", id + ", " + SF.terrainName(SF.sq(id)) + ", room for " + info.slots +
        ", manpower " + info.pop + " a turn"));
      var wrap = el("div", undefined, "order-form");
      SF.BUILDING_ORDER.forEach(function (k) {
        var label = el("label", capitalize(SF.BUILDINGS[k].plural) + " at " + id);
        var sel = document.createElement("select");
        for (var i = 0; i <= info.slots; i++) {
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
          $("plan-error").textContent = used > info.slots ? id + " only has room for " + info.slots + " buildings." : "";
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
    SF.applyPlan(state, me(), plan);
    plan = null;
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

  function renderNation() {
    var box = $("nation");
    box.innerHTML = "";
    var e = state.econ[me()];
    var inc = SF.income(state, me());
    var mp = SF.manpower(state, me());
    box.appendChild(el("p", "Stockpile: " + resourceList(e) + "."));
    box.appendChild(el("p", "Each turn: " + resourceList(inc) + ", from " + mp + " manpower."));

    box.appendChild(el("h3", "Workforce"));
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
    if (state.phase === "handoff") { renderHandoff(); return; }
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
  }

  function renderSetup() {
    show("setup");
    var saved = loadSave();
    $("continue-item").hidden = !saved;
    if (saved) {
      var kind = saved.mode === "hotseat" ? "pass and play" : "against the computer";
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

  function startGame(mode) {
    state = SF.newGame(mode);
    selected = null;
    plan = null;
    save();
    renderAll();
    $("plan-heading").focus();
  }

  function lockIn() {
    if (state.mode === "computer") {
      SF.computerOrders(state);
      SF.resolveTurn(state);
      selected = null;
      save();
      renderAll();
      $("report-heading").focus();
      return;
    }
    if (me() === 0) {
      state.current = 1;
    } else {
      SF.resolveTurn(state);
      state.current = 0;
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
    var focus = { handoff: "handoff-heading", setup: "plan-heading" }[state.phase] || "status";
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
  $("lock-btn").addEventListener("click", lockIn);
  $("next-btn").addEventListener("click", nextWaiting);
  $("quit-btn").addEventListener("click", function () {
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
