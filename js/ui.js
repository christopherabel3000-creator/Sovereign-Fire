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

  function targetsOf(owner) {
    var t = {};
    state.orders[owner].forEach(function (o) { t[o.to] = true; });
    return t;
  }

  function squareLabel(sq, targets) {
    var parts = [sq.id, SF.terrainName(sq)];
    var terr = territory(sq);
    if (terr) parts.push(terr);
    var mine = SF.unitsAt(state, sq.id, state.current);
    var foe = SF.unitsAt(state, sq.id, 1 - state.current);
    if (mine.length) parts.push("your " + SF.describeUnits(mine));
    if (foe.length) parts.push("enemy " + SF.describeUnits(foe));
    if (targets[sq.id]) parts.push("your units moving here");
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

  function orderText(o, fromView) {
    var units = state.units.filter(function (u) { return o.unitIds.indexOf(u.id) !== -1; });
    var what = SF.describeUnits(units);
    return fromView ? what + " from " + o.from : what + " ordered to " + o.to;
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
      ids.forEach(function (id) {
        var s2 = SF.sq(id);
        var terr = territory(s2);
        var opt = el("option", id + ", " + SF.terrainName(s2) + (terr ? ", " + terr : ""));
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
      var order = SF.addOrder(state, state.current, units.map(function (u) { return u.id; }), dest.value);
      save();
      renderAll();
      $("selected-heading").focus();
      announce("Ordered " + SF.describeUnits(units) + " from " + order.from + " to " + order.to + ".");
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
        var units = state.units.filter(function (u) { return o.unitIds.indexOf(u.id) !== -1; });
        li.appendChild(el("span", SF.describeUnits(units) + ", " + o.from + " to " + o.to + "."));
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
  function reportList(report) {
    var ul = el("ul");
    var anyEnemyMoves = false, anyMoves = false;
    report.entries.forEach(function (e) {
      anyMoves = true;
      if (e.owner === 1) anyEnemyMoves = true;
      var text = possessive(e.owner) + " " + e.what;
      if (e.blocked) {
        text += " could not move from " + e.from + " to " + e.to + ". Enemy forces were in the way. Combat is not in the game yet.";
      } else {
        text += " moved from " + e.from + " to " + e.to + ".";
      }
      ul.appendChild(el("li", text));
    });
    if (report.mode === "computer" && !anyEnemyMoves) ul.appendChild(el("li", "The enemy held its positions."));
    if (!anyMoves) ul.appendChild(el("li", "No units moved."));
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
