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
  // attack and defense: chance in 10 to hit each battle round.
  // loss: lower numbers are lost first when a side takes hits.
  infantry: { name: "infantry", plural: "infantry", move: 2, crossRiver: true, attack: 3, defense: 4, rough: true, loss: 1 },
  specialForces: { name: "special forces", plural: "special forces", move: 2, crossRiver: true, attack: 7, defense: 5, rough: true, loss: 6 },
  engineer: { name: "engineer", plural: "engineers", move: 2, crossRiver: true, attack: 1, defense: 2, loss: 2 },
  tank: { name: "tank", plural: "tanks", move: 3, crossRiver: false, attack: 6, defense: 3, loss: 5 },
  artillery: { name: "artillery", plural: "artillery", move: 2, crossRiver: true, attack: 2, defense: 2, loss: 4, bombardRange: 2 },
  antiAir: { name: "anti-aircraft gun", plural: "anti-aircraft guns", move: 2, crossRiver: true, attack: 1, defense: 2, loss: 3 },
  // Air units are based in cities. They do not hold or block squares, and do
  // not fight in ground battles.
  // range: how far from its base a plane can fly a mission.
  scoutPlane: { name: "scout plane", plural: "scout planes", air: true, attack: 0, defense: 1, loss: 0, range: 10 },
  fighter: { name: "fighter", plural: "fighters", air: true, attack: 6, defense: 6, loss: 2, range: 6 },
  bomber: { name: "bomber", plural: "bombers", air: true, attack: 1, defense: 2, loss: 1, range: 8 },
  // Missiles are stored in the city that built them and used up when fired.
  missile: { name: "missile", plural: "missiles", air: true, missile: true, attack: 0, defense: 0, loss: 0, range: 14 },
  // Satellites are not on the map. They are listed here for their names only.
  satellite: { name: "satellite", plural: "satellites", space: true, loss: 0 },
  // Ships move on ocean squares and dock in port cities you hold. Like
  // planes, they do not hold land squares.
  destroyer: { name: "destroyer", plural: "destroyers", naval: true, move: 4, attack: 5, defense: 5, loss: 3,
    bombardRange: 1, sonar: 2, hunts: ["submarine"] },
  submarine: { name: "submarine", plural: "submarines", naval: true, move: 3, attack: 6, defense: 3, loss: 4,
    hunts: ["transport", "carrier"] },
  transport: { name: "transport", plural: "transports", naval: true, move: 4, attack: 0, defense: 1, loss: 1, capacity: 4 },
  carrier: { name: "carrier", plural: "carriers", naval: true, move: 3, attack: 1, defense: 4, loss: 5, planes: 4 }
};
SF.UNIT_ORDER = ["infantry", "specialForces", "engineer", "tank", "artillery", "antiAir",
  "destroyer", "submarine", "transport", "carrier", "fighter", "bomber", "scoutPlane", "missile"];

// A unit gets this much extra attack and defense in a battle with a type it hunts.
SF.HUNT_BONUS = 3;
// Room each ground unit takes on a transport. Anything not listed takes 1.
SF.CARGO_SPACE = { tank: 2, artillery: 2 };
// Units landing from the sea lose this much attack.
SF.LANDING_PENALTY = 2;
// Destroyer shore bombardment: chance to destroy one unit, before terrain.
SF.SHORE_BOMBARD_CHANCE = 0.4;

// Fog of war
// Ground units, and cities you hold, see every square touching them,
// diagonals included. You also see all of your own land.
// Special forces and submarines are only spotted by units next to them.
// Destroyers also find submarines up to 2 squares away.
SF.SCOUT_RANGE = 10;         // squares from its base a scout plane can reach
SF.SCOUT_RADIUS = 2;         // it sees a 5 by 5 area around its target
SF.SCOUT_AA_CHANCE = 0.2;    // chance each enemy anti-aircraft gun in that area shoots it down
SF.SCOUT_FIGHTER_CHANCE = 0.3; // chance each enemy fighter patrolling over its target catches it

// Air power
SF.PATROL_RADIUS = 1;        // a fighter patrol covers a 3 by 3 area
SF.INTERCEPT_ROUNDS = 1;     // fighters get one pass at bombers they intercept
SF.AA_CHANCE = 0.2;          // chance each anti-aircraft gun shoots down a bomber over its square
SF.AIR_SUPPORT = 1;          // battle bonus for the side that holds the sky over a square
SF.BOMB_TROOPS = 0.5;        // chance per bomber to destroy one unit, before terrain
SF.BOMB_BUILDING = 0.35;     // chance per bomber to destroy one building in a city
SF.BOMB_BRIDGE = 0.5;        // chance per bomber to destroy a bridge
SF.AIR_DEFENSE_SHOTS = 2;    // each air defense battery fires like 2 anti-aircraft guns over its city

// Missiles
SF.MISSILE_HITS = 2;         // each missile can destroy up to 2 units...
SF.MISSILE_HIT_CHANCE = 0.6; // ...each with this chance, lowered by terrain
SF.MISSILE_BUILDING = 0.6;   // chance a missile destroys one building in a city
SF.MISSILE_DEFENSE_SHOTS = 2;    // missiles each battery can try to stop per turn
SF.MISSILE_DEFENSE_CHANCE = 0.75;
SF.DESTROYER_MISSILE_SHOTS = 1;  // destroyers guard squares within 1 of them
SF.DESTROYER_MISSILE_CHANCE = 0.6;

// Battles
SF.BATTLE_ROUNDS = 3;
// Added to every defender's defense on that terrain.
SF.DEFENSE_BONUS = { plains: 0, bridge: 0, river: 1, forest: 1, city: 3, mountains: 4, ocean: 0 };
// Extra defense for infantry and special forces in rough ground.
SF.ROUGH_BONUS = { forest: 1, city: 1, mountains: 1 };
// Added to a tank's attack, by the terrain it attacks into.
SF.TANK_ATTACK = { plains: 1, bridge: 0, river: 0, forest: -2, city: -3, mountains: -5 };
// Artillery bombardment: chance to destroy one unit, before terrain.
SF.BOMBARD_CHANCE = 0.5;
SF.BOMBARD_TERRAIN = { plains: 0, bridge: 0, river: 0.05, forest: 0.1, city: 0.15, mountains: 0.25 };

// Cost to enter a square. A unit with any movement left can always enter one
// more square, even if it costs more than it has left.
SF.MOVE_COST = { plains: 1, city: 1, bridge: 1, forest: 2, mountains: 3, river: 2 };

// North's starting army. South gets the mirror image.
SF.STARTING_ARMY = [
  ["F2", { infantry: 3, antiAir: 1, scoutPlane: 1, fighter: 2, bomber: 1 }],
  ["C3", { infantry: 2 }],
  ["L3", { infantry: 2, tank: 2, artillery: 1, scoutPlane: 1 }],
  ["O3", { infantry: 2, tank: 1, engineer: 1, specialForces: 1 }],
  ["A5", { infantry: 1 }],
  ["E6", { infantry: 1, destroyer: 1, transport: 1 }],
  ["I6", { infantry: 1 }]
];
