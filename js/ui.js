// Sovereign Fire: screens, map, and controls.
(function (SF) {
  "use strict";

  var SAVE_KEY = "sovereignFire.save";
  var state = null;
  var selected = null;     // id of the selected square
  var buttons = {};        // map square buttons by id

  function $(id) { return document.getElementById(id); }

  // ---------- Saving ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      var s = raw ? JSON.parse(raw) : null;
      return s && s.version === 1 ? s : null;
    } catch (e) { return null; }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  // ---------- Names ----------
  function sideName(owner) {
    if (state.mode === "hotseat") return owner === 0 ? "North" : "South";
    return owner === 0 ? "You" : "The enemy";
  }
  function possessive(owner) {
    if (state.mode === "hotseat") return owner === 0 ? "North's" : "South's";
    return owner === 0 ? "Your" : "Enemy";
  }
  function territory(sq) {
    if (sq.home === null) return "";
    return sq.home === state.current ? "yours" : "enemy";
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function announce(text) {
    var a = $("announcer");
    a.textContent = "";
    setTimeout(function () { a.textContent = text; }, 50);
  }

  function show(which) {
    ["setup", "handoff", "game"].forEach(function (id) { $(id).hidden = id !== which; });
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

  function myOrders() { return state.orders[state.current]; }

  // What your orders do to each square: "move", "attack", or "bombard".
  function targetsOf(owner) {
    var t = {};
    state.orders[owner].forEach(function (o) {
      if (o.kind === "bombard") t[o.to] = t[o.to] || "bombard";
      else t[o.to] = SF.occupant(state, o.to) === 1 - owner ? "attack" : "move";
    });
    return t;
  }

  var TARGET_TEXT = {
    move: "your units moving here",
    attack: "your attack target",
    bombard: "your artillery firing here"
  };

  function squareLabel(sq, targets) {
    var parts = [sq.id, SF.terrainName(sq)];
    var terr = territory(sq);
    var mine = SF.unitsAt(state, sq.id, state.current);
    var foe = SF.unitsAt(state, sq.id, 1 - state.current);
    // "your" or "enemy" in front of the units already says whose land it is.
    var sameSide = (terr === "yours" && mine.length) || (terr === "enemy" && foe.length);
    if (terr && !sameSide) parts.push(terr);
    if (mine.length) parts.push("your " + SF.describeUnits(mine));
    if (foe.length) parts.push("enemy " + SF.describeUnits(foe));
    if (targets[sq.id]) parts.push(TARGET_TEXT[targets[sq.id]]);
    return parts.join(", ");
  }

  function renderMap() {
    var targets = targetsOf(state.current);
    SF.allSquares().forEach(function (sq) {
      var b = buttons[sq.id];
      var cls = "sq t-" + sq.terrain.key;
      if (sq.home !== null) cls += " home" + sq.home;
      if (sq.id === selected) cls += " selected";
      if (targets[sq.id]) cls += " target";
      b.className = cls;
      b.setAttribute("aria-label", squareLabel(sq, targets));
      var units = SF.unitsAt(state, sq.id);
      b.textContent = "";
      if (units.length) {
        var badge = document.createElement("span");
        badge.className = "badge " + (units[0].owner === state.current ? "mine" : "foe");
        badge.textContent = String(units.length);
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
    return SF.unitsAt(state, id, state.current).filter(function (u) { return !SF.orderFor(state, u.id); });
  }

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
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

    var foe = SF.unitsAt(state, sq.id, 1 - state.current);
    if (foe.length) box.appendChild(el("p", "Enemy units: " + SF.describeUnits(foe) + "."));

    var mine = SF.unitsAt(state, sq.id, state.current);
    var leaving = myOrders().filter(function (o) { return o.from === sq.id; });
    var arriving = myOrders().filter(function (o) { return o.to === sq.id; });

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
      var p = el("p", "Moving here: " + arriving.map(function (o) { return orderText(o, true); }).join("; ") + ".");
      box.appendChild(p);
    }
    if (unorderedAt(sq.id).length) renderOrderForm(box, sq);
  }

  function orderUnits(o) {
    return state.units.filter(function (u) { return o.unitIds.indexOf(u.id) !== -1; });
  }

  function orderVerb(o) {
    if (o.kind === "bombard") return "firing at " + o.to;
    if (SF.occupant(state, o.to) === 1 - state.current) return "attacking " + o.to;
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
      SF.cancelOrder(state, state.current, order.id);
      save();
      renderAll();
      $(focusId).focus();
      announce("Order canceled.");
    });
    return b;
  }

  function renderOrderForm(box, sq) {
    box.appendChild(el("h3", "Give a move order"));
    var form = el("form", undefined, "order-form");
    var waiting = unorderedAt(sq.id);
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
      var ids = SF.reachable(state, state.current, sq.id, types);
      dest.innerHTML = "";
      if (!units.length) {
        dest.appendChild(el("option", "Choose some units first"));
        dest.disabled = true;
        submit.disabled = true;
        return;
      }
      if (!ids.length) {
        dest.appendChild(el("option", "No squares in reach"));
        dest.disabled = true;
        submit.disabled = true;
        return;
      }
      dest.disabled = false;
      submit.disabled = false;
      odds = {};
      ids.forEach(function (id) {
        var s2 = SF.sq(id);
        var terr = territory(s2);
        var text = id + ", " + SF.terrainName(s2) + (terr ? ", " + terr : "");
        if (SF.occupant(state, id) === 1 - state.current) {
          odds[id] = SF.attackOdds(state, state.current, units, id);
          text += ", attack " + SF.describeUnits(SF.unitsAt(state, id, 1 - state.current)) +
            ", about " + odds[id] + "% to win";
        }
        var opt = el("option", text);
        opt.value = id;
        dest.appendChild(opt);
      });
      if (ids.indexOf(keep) !== -1) dest.value = keep;
    }
    var odds = {};
    refreshDest();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var units = chosenUnits();
      if (!units.length || dest.disabled) return;
      var order = SF.addOrder(state, state.current, units.map(function (u) { return u.id; }), dest.value);
      var msg = "Ordered " + SF.describeUnits(units) + " from " + order.from +
        (odds[order.to] !== undefined ? " to attack " + order.to + ", about " + odds[order.to] + "% to win." : " to " + order.to + ".");
      save();
      renderAll();
      $("selected-heading").focus();
      announce(msg);
    });

    box.appendChild(form);
    renderBombardForm(box, sq, byType.artillery || []);
  }

  function renderBombardForm(box, sq, guns) {
    if (!guns.length) return;
    var targets = SF.bombardTargets(state, state.current, sq.id);
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
      var s2 = SF.sq(id);
      var pct = Math.round(SF.bombardChance(id) * 100);
      var opt = el("option", id + ", " + SF.terrainName(s2) + ", enemy " +
        SF.describeUnits(SF.unitsAt(state, id, 1 - state.current)) + ", " + pct + "% per gun to destroy a unit");
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
      SF.addBombard(state, state.current, use.map(function (u) { return u.id; }), target.value);
      save();
      renderAll();
      $("selected-heading").focus();
      announce("Ordered " + SF.describeUnits(use) + " to fire at " + target.value + ".");
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
        idx = 0;
      }
    }
    focusSquare(squares[idx].id);
  }

  // ---------- Cities ----------
  function renderCities() {
    fillCities("your-cities", state.current);
    fillCities("enemy-cities", 1 - state.current);
  }
  function fillCities(listId, home) {
    var ul = $(listId);
    ul.innerHTML = "";
    SF.allSquares().forEach(function (sq) {
      if (sq.terrain.key !== "city" || sq.home !== home) return;
      var li = el("li");
      var b = el("button", sq.id + ", " + SF.terrainName(sq), "act");
      b.type = "button";
      b.addEventListener("click", function () { focusSquare(sq.id); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  // ---------- Turn report ----------
  function lossText(owner, lost) {
    return lost ? sideName(owner) + " lost " + lost + "." : sideName(owner) + " lost nothing.";
  }

  function battleText(b) {
    if (b.cutOff) {
      return possessive(b.owner) + " " + b.what + " fell back to " + b.at +
        ", but the enemy had taken it. They were cut off and lost.";
    }
    var att = b.attacker, def = 1 - att;
    var s;
    if (b.meeting) {
      s = "Armies met at " + b.at + ": " + possessive(0) + " " + b.attWhat + " against " +
        (state.mode === "hotseat" ? possessive(1) : "enemy") + " " + b.defWhat + ". ";
      if (b.result === "attacker") s += sideName(0) + " won the fight. ";
      else if (b.result === "defender") s += sideName(1) + " won the fight. ";
      else if (b.result === "both destroyed") s += "Both sides were destroyed. ";
      else s += "Neither side broke through, and both fell back. ";
    } else {
      s = "Battle at " + b.at + ". " + sideName(att) + " attacked with " + b.attWhat +
        " against " + b.defWhat + ". ";
      if (b.result === "attacker") s += sideName(att) + " took " + b.at + ". ";
      else if (b.result === "both destroyed") s += "Both sides were destroyed, and " + b.at + " is empty. ";
      else s += sideName(def) + " held " + b.at + ", and the attackers fell back. ";
    }
    return s + lossText(att, b.attLost) + " " + lossText(def, b.defLost);
  }

  function reportList(report) {
    var ul = el("ul");
    var enemyActed = false, anything = false;
    (report.bombards || []).forEach(function (b) {
      anything = true;
      if (b.owner === 1) enemyActed = true;
      ul.appendChild(el("li", possessive(b.owner) + " " + b.what + " at " + b.from + " fired on " + b.at +
        (b.killed ? " and destroyed " + b.killed + "." : " and missed.")));
    });
    (report.battles || []).forEach(function (b) {
      anything = true;
      if (b.cutOff ? b.owner === 1 : (b.meeting || b.attacker === 1)) enemyActed = true;
      ul.appendChild(el("li", battleText(b)));
    });
    (report.moves || []).forEach(function (m) {
      anything = true;
      if (m.owner === 1) enemyActed = true;
      ul.appendChild(el("li", possessive(m.owner) + " " + m.what + " moved from " + m.from + " to " + m.to + "."));
    });
    if (report.mode === "computer" && !enemyActed && !(report.battles || []).length) {
      ul.appendChild(el("li", "The enemy held its positions."));
    }
    if (!anything) ul.appendChild(el("li", "Nothing happened."));
    return ul;
  }

  function renderReport() {
    var section = $("report-section");
    if (!state.report) { section.hidden = true; return; }
    section.hidden = false;
    $("report-heading").textContent = "Turn " + state.report.turn + " results";
    var box = $("report");
    box.innerHTML = "";
    box.appendChild(reportList(state.report));
  }

  // ---------- Screens ----------
  function renderStatus() {
    var who = state.mode === "hotseat" ? sideName(state.current) + "'s orders" : "Your orders";
    $("status").textContent = "Turn " + state.turn + ". " + who + ".";
  }

  function renderAll() {
    if (!state) { renderSetup(); return; }
    if (state.phase === "handoff") { renderHandoff(); return; }
    show("game");
    renderStatus();
    renderReport();
    renderMap();
    renderDetails();
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
    var to = sideName(state.current);
    var box = $("handoff-report");
    box.innerHTML = "";
    if (state.handoffReport && state.report) {
      $("handoff-heading").textContent = "Turn " + state.report.turn + " results";
      box.appendChild(reportList(state.report));
      box.appendChild(el("p", "Pass the phone to " + to + "."));
    } else {
      $("handoff-heading").textContent = "Pass the phone to " + to;
    }
    $("handoff-btn").textContent = "Start " + to + "'s turn";
  }

  function startGame(mode) {
    state = SF.newGame(mode);
    selected = null;
    save();
    renderAll();
    $("status").focus();
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
    if (state.current === 0) {
      state.current = 1;
      state.phase = "handoff";
      state.handoffReport = false;
    } else {
      SF.resolveTurn(state);
      state.current = 0;
      state.phase = "handoff";
      state.handoffReport = true;
    }
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
    renderAll();
    (state.phase === "handoff" ? $("handoff-heading") : $("status")).focus();
  });
  $("handoff-btn").addEventListener("click", function () {
    state.phase = "orders";
    state.handoffReport = false;
    save();
    renderAll();
    $("status").focus();
  });
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
