# Sovereign Fire: Design Document

## Overview

Sovereign Fire is a turn-based modern war between two nations. Both players secretly lock in orders, then the turn plays out at once. Victory comes from combining military strength, a strong economy, scientific progress, and morale on the home front. A typical game lasts 2–4 hours, or roughly 40–50 turns.

## Modes

- **Versus computer:** a simple AI that plays sensibly, improved over time.
- **Online versus a friend:** live play with no turn timer. Each player presses a button to lock in their turn. Players hear a message when the opponent has locked in. Games save automatically and can be resumed later.

## Pre-game setup

1. **Name your nation,** or pick from randomly generated fictional names.
2. **Choose a government.** Government type is revealed to both players at the start.
   - **Democracy:** better science and economy. Morale drops faster from heavy losses and bombing. One-time ability: rally morale when the capital is threatened.
   - **Authoritarian State:** steadier morale, and losses hurt less. Can draft extra manpower in emergencies. Science is slower.
   - **Military State:** units are cheaper and faster to build. Weaker economy and science. Morale falls if it isn't winning. One-time ability: mass conscription.
   - **Scientific Republic:** the strongest science. Smaller manpower, so smaller armies.
3. **Choose starting buildings** with a fixed budget. Starting buildings are secret from the opponent.

## Map

- One hand-made grid map, about 16 by 16 squares, with identical terrain for both nations.
- Both nations have cities in exactly the same spots within their territory, mirrored across the map.
- The two nations share a small land border, with a larger ocean between them elsewhere.
- Invasion is possible by land across the border, or by sea using transports.
- Each square has a terrain type and can be described by coordinate, such as "D7, plains, yours, 2 tanks."
- Armies take a few turns to meet by land, and fleets take a few turns to come in range.

## Terrain

- **Plains:** fast movement, and tanks attack easily here.
- **Forest:** slower movement and a defense bonus.
- **Mountains:** very slow, a huge defense bonus, and tank attacks almost never succeed.
- **Rivers:** infantry cross slowly, and tanks can't cross.
- **Bridges:** the only river crossing for tanks. They can be destroyed by bombers, missiles, or special forces, and rebuilt by engineers.
- **Cities:** where all production happens, with a defense bonus.
- **Coast and ocean:** ships move here, and ports allow building ships and loading transports.

## Turn structure

1. **Orders phase:** both players give orders in secret, including moves, attacks, building, research, and manpower assignments.
2. **Lock in:** each player presses the lock-in button.
3. **Resolution:** all orders play out together. If both sides move into the same square, they fight there. If two forces swap squares, they meet halfway and fight.
4. **Report:** each player hears a summary of battles, losses, and what they now see.

## Stacking

Many units can share a square, but each square holds only one nation's units. When enemy units end up on the same square, a battle happens.

## Resources

- **Manpower:** the core resource. It comes from cities and is assigned to producing the other resources or to building units. Infantry and other ground units cost manpower.
- **Industry:** used to build units and buildings.
- **Gasoline:** ships and planes use it every turn. With no gasoline, they can't sail or fly.
- **Science:** used for research.

## Upkeep

Ships and planes cost gasoline each turn. Ground units have no upkeep.

## Supply

No supply-line rules for now. Ground units do not weaken when cut off.

## Buildings

All buildings are in cities.

- **Factory:** produces industry.
- **Refinery:** produces gasoline.
- **Lab:** produces science.
- **Port:** builds ships. Coastal cities only.
- **Airfield:** builds and bases planes.
- **Air defense and missile defense batteries:** protect the city.
- **Fortifications:** a defense bonus, built by engineers.

Buildings can be damaged by bombers, missiles, and special forces. A captured city passes along whatever buildings survived. Starting defenses are strong enough to handle an early missile strike.

## Units

### Land

- **Infantry:** cheap, best at holding cities and rough ground, and can cross rivers slowly.
- **Special forces:** expensive, stealthy, and much stronger than infantry. Only spotted by adjacent units or late research. Good at raiding bridges and buildings.
- **Engineers:** build and repair bridges, fortifications, and bomb damage.
- **Tanks:** break through lines on open ground, weak in cities and mountains, and can't cross rivers.
- **Artillery:** wears down defenders from a distance. Its range does not reveal enemy units.
- **Anti-aircraft guns:** protect ground units from planes.

### Sea

- **Destroyers:** hunt submarines and shoot down missiles.
- **Submarines:** raid enemy ships and are hard to spot. They can later carry nuclear missiles.
- **Carriers:** an air base at sea.
- **Transports:** carry ground units for sea invasions.

### Air

- **Fighters:** win control of the sky and protect bombers.
- **Bombers:** destroy buildings, bridges, and ground units.
- **Scout planes:** reveal enemy units in a wide area.

### Missiles

- **Missiles:** fast, long-range, expensive strikes. They can target any square in range, seen or unseen. Their best use is striking cities, which are always visible but well defended. Firing at an unseen square is a gamble with no guarantee of hitting anything, but units in the field are usually much less protected.
- **Missile defense:** shoots down a limited number of missiles each turn. Firing many missiles at once can overwhelm it.

### Space

- **Satellites:** researched, then built and launched. They reveal enemy units in a wide area.

## Air control

Each square's airspace is yours, the enemy's, or contested. Bombing and ground attacks work much better under air you control.

## Combat

Combat mixes tactics and luck. Larger numbers matter, and units that target a weakness get a big bonus, such as fighters against bombers or destroyers against submarines. Terrain, fortifications, and research also matter. No result is ever guaranteed. The odds are announced before you commit to an attack.

## Fog of war

- Enemy cities are always shown on the map, but not the units inside them.
- You see all of your own land.
- Your ground units see every square touching them, diagonals included. Cities you hold see the squares around them too.
- Scout planes and satellites see enemy units across a wider area. They are the only way to scout at long range.
- Artillery range and missile range do not reveal enemy units.
- Special forces are only spotted by ground units right next to them. Your own land, your cities, and scout planes do not reveal them. Submarines will be hard to spot too.
- Squares you cannot see are marked hidden. A move onto a hidden square holding enemy units becomes a surprise battle.
- You only learn the result of an attack if you can see the target square. A missile fired at an unseen square tells you nothing.
- Each side's turn report only includes what that side would know. For example, you hear about an enemy scout plane only if it flew over squares you can see, or your guns shot it down.

### Scout planes, first version

- Scout planes are based in cities. They do not hold squares or fight in ground battles.
- Each turn, a scout plane can fly over any square up to 10 squares from its base.
- It flies after the turn's battles and reveals a 5 by 5 area around that square until the end of your next orders.
- Each enemy anti-aircraft gun in that area has a 20% chance to shoot it down. If it is shot down, it reveals nothing.
- Planes in a city the enemy captures are destroyed on the ground.
- Each side starts with 2 scout planes, at the capital and at L3.

## Science

Science points from labs fund research in branches such as:

- Land
- Sea
- Air
- Missiles and missile defense
- Intelligence, including satellites
- Economy
- Nuclear

Neglecting science can give an early edge through cheap units and an early offensive. A player who invests in science and survives should pull ahead by around the halfway point. Strong defensive bonuses and fortifications let a science-focused player survive an early rush.

## Morale

Morale drops from:

- Lost cities
- Heavy losses
- Bombed cities
- Blockaded ports
- Using nuclear weapons first

Morale rises from victories and recapturing cities. When morale hits zero, that nation surrenders.

## Nuclear weapons

- Researched late and extremely expensive.
- Delivered by missile, bomber, or submarine, so missile defense and fighters can stop them.
- Struck squares become wasteland for several turns.
- Using a nuke first causes a huge morale hit. A nation striking back after being nuked first does not take that penalty.

## Victory conditions

- **Annihilation:** the enemy has no units left and no way to build more.
- **Surrender:** the enemy's morale reaches zero.
- **Conquest:** you capture all enemy cities.

## Accessibility

- Fully playable with VoiceOver on iPhone and with screen readers on a computer.
- Clear spoken descriptions of each square.
- Quick ways to jump to things, such as the next unit that hasn't moved.
- Turn reports read as clear summaries.
- No repeated spoken instructions.

## Open questions

1. **Exact numbers:** unit costs, strength, movement, research costs, and the starting budget. To be settled during building and playtesting.
2. **The map itself:** placement of cities, rivers, mountains, and bridges.
3. **Satellites:** can they be shot down, and by what?

## Movement, first version

These numbers are starting points for playtesting.

- **Movement points each turn:** tanks 3. Infantry, special forces, engineers, artillery, and anti-aircraft guns 2.
- **Cost to enter a square:** plains, cities, and bridges 1. Forest and river 2. Mountains 3.
- A unit with any movement left can always enter one more square, even if it costs more than it has left.
- Tanks cannot enter river squares, only bridges.
- Units cannot enter ocean squares or squares holding enemy units.
- Units moving together use the slowest unit's reach.
- Units can move onto a square holding enemy units. That is an attack, and the move ends there.

## Battles, first version

These numbers are starting points for playtesting.

**Unit strength.** Each unit has an attack and a defense number. Each battle round, every unit has that many chances in 10 of scoring a hit, capped at 9 in 10 and never below 1 in 20.

- Infantry: attack 3, defense 4.
- Special forces: attack 7, defense 5.
- Engineers: attack 1, defense 2.
- Tanks: attack 6, defense 3.
- Artillery: attack 2, defense 2, plus bombardment.
- Anti-aircraft guns: attack 1, defense 2.

**Terrain.**
- Defenders add 1 in forest and on river squares, 3 in cities, and 4 in mountains.
- Infantry and special forces add 1 more in forest, cities, and mountains.
- Tanks add 1 to attack on plains, and lose 2 attacking into forest, 3 into cities, and 5 into mountains.

**How a battle works.**
- A battle lasts up to 3 rounds. Both sides fire at once each round.
- Each hit destroys one unit. Cheaper units are lost first: infantry, then engineers, anti-aircraft guns, artillery, tanks, and special forces.
- The attacker takes the square only by destroying every defender. If any defenders survive, the attackers fall back to where they started.
- Friendly units moving into a square under attack join the defense.
- If both sides move into the same empty square, they fight a meeting battle with no terrain defense bonus. The winner takes the square. If both survive, both fall back.
- If two armies try to swap squares, they meet halfway and fight, and the survivors return home.
- Units falling back to a square the enemy took that turn are cut off and lost.
- Before you commit, the game shows the estimated chance to win, from 1% to 99%. Nothing is ever certain.

**Artillery bombardment.**
- Artillery can stay put and fire at an enemy square up to 2 squares away.
- Bombardment happens before any movement or battles.
- Each gun has a 50% chance to destroy one unit, lowered by terrain: 5 points on river squares, 10 in forest, 15 in cities, and 25 in mountains.

## Sea, first version

These numbers are starting points for playtesting.

**Ships.** Ships move on ocean squares, 1 movement point per square, and can dock in a port city you hold, which ends their move. They do not hold land squares.
- Destroyer: moves 4, attack 5, defense 5. Hunts submarines. Its sonar finds submarines up to 2 squares away. Can bombard the shore.
- Submarine: moves 3, attack 6, defense 3. Hunts transports and carriers. Only spotted by units right next to it, or by a destroyer's sonar.
- Transport: moves 4, attack 0, defense 1. Carries 4 spaces of troops. Tanks and artillery take 2 spaces, everything else 1.
- Carrier: moves 3, attack 1, defense 4. Will carry planes once air arrives.

**Naval battles** use the same rules as land battles, with no terrain bonus at sea. A unit fighting a type it hunts gets 3 extra attack and defense. Ships cannot attack land units directly, except by shore bombardment.

**Transports and invasions.**
- Troops in a port can be loaded onto transports as they sail out, in the same order.
- Troops can also board a transport waiting on an ocean square next to them.
- A transport's order can land everything aboard on a land square next to where it stops. Troops already at sea can also land on a later turn.
- Landing troops lose 2 attack.
- If a landing fails, the survivors stay aboard. If a transport sinks, everything aboard is lost.
- A transport driven back by a sea battle returns to where it started. Troops on a transport in port go ashore there.

**Shore bombardment.** Destroyers can fire at visible enemy troops on a land square next to them, like artillery. Each destroyer has a 40% chance to destroy one unit, lowered by the same terrain amounts. Carriers' planes will join in once air arrives.

**Blockades.** Enemy warships on a square next to a port stop it from building ships. Blockades will hurt morale once morale arrives.

**Ports and capture.** Ships docked in a city the enemy captures are destroyed, along with planes there.

## Economy, first version

These numbers are starting points for playtesting.

**Starting buildings.** Before the game, each player secretly picks 10 starting buildings and places them in their cities. A balanced plan is filled in to start: 3 factories, 2 refineries, 3 labs, 1 airfield at the capital, and 1 port at E6.

**Cities.**
- F2, the capital: 6 manpower a turn, room for 5 buildings.
- C3, L3, and O3: 3 manpower a turn, room for 3 buildings each.
- A5, E6, and I6: 2 manpower a turn, room for 2 buildings each.
- That is 21 manpower a turn to start.

**Workforce.** Manpower is assigned for the whole nation, and the assignment carries over from turn to turn until you change it.
- Factory workers make industry, refinery workers make gasoline, and lab workers make science. Recruits are saved up to build units.
- Each worker makes 1 a turn, but each factory, refinery, or lab can only use 3 workers.
- If you lose cities and have fewer people than jobs, jobs are filled in order: factories, refineries, labs, then recruits.
- Science is saved up until research arrives.
- The starting workforce is 9 in factories, 3 in refineries, 6 in labs, and 3 recruits.

**Starting stockpile.** 20 industry, 10 gasoline, no science, and 6 recruits.

**Units.** Paid up front, built in a city you hold, and ready after the listed turns.
- Infantry: 3 industry, 2 recruits, 1 turn.
- Engineer: 4 industry, 1 recruit, 1 turn.
- Anti-aircraft gun: 5 industry, 1 recruit, 1 turn.
- Artillery: 6 industry, 1 recruit, 2 turns. Needs a factory in that city.
- Tank: 10 industry, 1 recruit, 2 turns. Needs a factory in that city.
- Special forces: 8 industry, 2 recruits, 2 turns.
- Scout plane: 8 industry, 1 recruit, 2 turns. Needs an airfield in that city.
- Destroyer: 12 industry, 2 recruits, 2 turns. Needs a port.
- Submarine: 12 industry, 2 recruits, 2 turns. Needs a port.
- Transport: 8 industry, 1 recruit, 2 turns. Needs a port.
- Carrier: 24 industry, 3 recruits, 4 turns. Needs a port.

**Buildings.** Factories, refineries, labs, and ports cost 12 industry. Airfields cost 15. Each takes 3 turns. Ports can only go in coastal cities.

**Canceling.** Units and buildings can be canceled for a full refund in the turn they were ordered.

**Gasoline.** Each scout plane mission uses 2 gasoline. Every ship uses gasoline each turn: 1 for destroyers, submarines, and transports, and 2 for carriers. Upkeep is paid after income. If there is not enough, gasoline drops to zero and ships cannot sail or bombard until upkeep can be covered again.

**Capturing cities.**
- A city changes hands when the other side's ground units hold it. It keeps whatever buildings it has.
- A captured enemy city produces for you right away, but at 25% for its first 3 turns.
- Retaking your own city brings it back to full strength at once.
- Anything the old owner was building there is lost.

## Starting armies, first version

Each side starts with the mirror image of this army. South's squares are the same column, mirrored row.

- **F2, capital:** 3 infantry, 1 anti-aircraft gun, and 1 scout plane.
- **C3:** 2 infantry.
- **L3:** 2 infantry, 2 tanks, 1 artillery, and 1 scout plane.
- **O3:** 2 infantry, 1 tank, 1 engineer, and 1 special forces.
- **A5, E6, and I6:** 1 infantry each.
- **E6** also has 1 destroyer and 1 transport in port.

## Build plan

Each step ends with something playable to test on iPhone and computer.

1. **The map:** the 16 by 16 grid, terrain, cities, and ownership, with accessible square descriptions and quick navigation. (Built.)
2. **Units and movement:** starting armies, giving move orders, terrain movement rules, and the lock-in button, played pass-the-phone or against an AI that only defends. (Built.)
3. **Combat:** battles when enemies meet, odds announced before attacking, and turn reports. (Built.)
4. **Fog of war:** hidden enemy units, adjacent vision, and scout planes. (Built.)
5. **Economy:** cities, buildings, manpower, industry, gasoline, and building new units. (Built.)
6. **Sea and air:** built in two parts.
   - **6a, sea:** ports, ships, naval battles, transports, invasions, and shore bombardment. (Built.)
   - **6b, air:** fighters, bombers, carriers' planes, and air control.
7. **Missiles and defenses.**
8. **Science and research.**
9. **Morale, government types, and victory conditions.**
10. **Nuclear weapons.**
11. **A smarter computer opponent.**
12. **Online play with Firebase,** in the game's own section of the database.
