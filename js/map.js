// Sovereign Fire: the map grid and square helpers.
(function (SF) {
  "use strict";

  var SIZE = SF.SIZE;

  var grid = [];
  var byId = {};
  for (var r = 0; r < SIZE; r++) {
    var row = [];
    for (var c = 0; c < SIZE; c++) {
      var northRow = r < 8 ? r : SIZE - 1 - r;
      var code = SF.NORTH[northRow].charAt(c);
      var t = SF.TERRAIN[code];
      var sq = {
        row: r,
        col: c,
        id: SF.COLS.charAt(c) + (r + 1),
        code: code,
        terrain: t,
        // 0 is North, 1 is South, null is ocean.
        home: t.key === "ocean" ? null : (r < 8 ? 0 : 1)
      };
      row.push(sq);
      byId[sq.id] = sq;
    }
    grid.push(row);
  }

  SF.grid = grid;
  SF.sq = function (id) { return byId[id] || null; };

  SF.neighbors = function (sq) {
    var out = [];
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var i = 0; i < dirs.length; i++) {
      var nr = sq.row + dirs[i][0], nc = sq.col + dirs[i][1];
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(grid[nr][nc]);
    }
    return out;
  };

  SF.isCoastal = function (sq) {
    return SF.neighbors(sq).some(function (n) { return n.code === "~"; });
  };

  SF.terrainName = function (sq) {
    var name = sq.terrain.name;
    if (sq.terrain.key === "city" && SF.isCoastal(sq)) name = "coastal " + name;
    return name;
  };

  // The same square on the other side of the map.
  SF.mirrorId = function (id) {
    var sq = byId[id];
    return grid[SIZE - 1 - sq.row][sq.col].id;
  };

  SF.allSquares = function () {
    var out = [];
    grid.forEach(function (row) { row.forEach(function (sq) { out.push(sq); }); });
    return out;
  };
})(window.SF);
