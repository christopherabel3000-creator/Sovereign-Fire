// Sovereign Fire: fixed game data (map, terrain, units, starting armies).
var SF = window.SF = window.SF || {};

SF.SIZE = 16;
SF.COLS = "ABCDEFGHIJKLMNOP";

// North half of the map, rows 1 to 8, columns A to P.
// The south half is a mirror image, so both nations have identical terrain.
// P plains, F forest, M mountains, R river, B bridge, C city, K capital, ~ ocean
SF.NORTH = [
  "MMFFPPPFFMMPFPFM",
  "FFPPPKPPPMFPPPPF",
  "PPCPPPPFPPPCPPCP",
  "PPPRRBRRRBRRRBRR",
  "CPPPPPPFPPPPFPPF",
  "~~PPCPPPCPPPPFPP",
  "~~~~~~~~~~PPMMPF",
  "~~~~~~~~~~~PPPPP"
];

SF.TERRAIN = {
  P: { key: "plains", name: "plains", mark: "" },
  F: { key: "forest", name: "forest", mark: "F" },
  M: { key: "mountains", name: "mountains", mark: "M" },
  R: { key: "river", name: "river", mark: "R" },
  B: { key: "bridge", name: "bridge", mark: "B" },
  C: { key: "city", name: "city", mark: "C" },
  K: { key: "city", name: "capital city", mark: "K" },
  "~": { key: "ocean", name: "ocean", mark: "" }
};

SF.NOTES = {
  plains: "Fast movement. Tanks attack easily here.",
  forest: "Slower movement and a defense bonus.",
  mountains: "Very slow movement and a huge defense bonus. Tank attacks almost never succeed.",
  river: "Infantry cross slowly. Tanks cannot cross.",
  bridge: "The only river crossing for tanks. Can be destroyed and rebuilt.",
  city: "Produces everything. Defense bonus.",
  ocean: "Ships only."
};

// Movement points each turn, and whether the unit can enter river squares.
SF.UNIT_TYPES = {
  infantry: { name: "infantry", plural: "infantry", move: 2, crossRiver: true },
  specialForces: { name: "special forces", plural: "special forces", move: 2, crossRiver: true },
  engineer: { name: "engineer", plural: "engineers", move: 2, crossRiver: true },
  tank: { name: "tank", plural: "tanks", move: 3, crossRiver: false },
  artillery: { name: "artillery", plural: "artillery", move: 2, crossRiver: true },
  antiAir: { name: "anti-aircraft gun", plural: "anti-aircraft guns", move: 2, crossRiver: true }
};
SF.UNIT_ORDER = ["infantry", "specialForces", "engineer", "tank", "artillery", "antiAir"];

// Cost to enter a square. A unit with any movement left can always enter one
// more square, even if it costs more than it has left.
SF.MOVE_COST = { plains: 1, city: 1, bridge: 1, forest: 2, mountains: 3, river: 2 };

// North's starting army. South gets the mirror image.
SF.STARTING_ARMY = [
  ["F2", { infantry: 3, antiAir: 1 }],
  ["C3", { infantry: 2 }],
  ["L3", { infantry: 2, tank: 2, artillery: 1 }],
  ["O3", { infantry: 2, tank: 1, engineer: 1, specialForces: 1 }],
  ["A5", { infantry: 1 }],
  ["E6", { infantry: 1 }],
  ["I6", { infantry: 1 }]
];
