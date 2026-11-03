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

- Enemy cities are always visible, but not the units inside them.
- Your units see enemy units on the squares next to them.
- Scout planes and satellites see enemy units across a wider area. They are the only way to scout at long range.
- Artillery range and missile range do not reveal enemy units.
- Special forces and submarines are harder to spot.
- You only learn the result of an attack if you can see the target square. A missile fired at an unseen square tells you nothing.

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

## Starting armies, first version

Each side starts with the mirror image of this army. South's squares are the same column, mirrored row.

- **F2, capital:** 3 infantry and 1 anti-aircraft gun.
- **C3:** 2 infantry.
- **L3:** 2 infantry, 2 tanks, and 1 artillery.
- **O3:** 2 infantry, 1 tank, 1 engineer, and 1 special forces.
- **A5, E6, and I6:** 1 infantry each.

## Build plan

Each step ends with something playable to test on iPhone and computer.

1. **The map:** the 16 by 16 grid, terrain, cities, and ownership, with accessible square descriptions and quick navigation. (Built.)
2. **Units and movement:** starting armies, giving move orders, terrain movement rules, and the lock-in button, played pass-the-phone or against an AI that only defends. (Built.)
3. **Combat:** battles when enemies meet, odds announced before attacking, and turn reports. (Built.)
4. **Fog of war:** hidden enemy units, adjacent vision, and scout planes.
5. **Economy:** cities, buildings, manpower, industry, gasoline, and building new units.
6. **Sea and air:** ships, transports, invasions, fighters, bombers, and air control.
7. **Missiles and defenses.**
8. **Science and research.**
9. **Morale, government types, and victory conditions.**
10. **Nuclear weapons.**
11. **A smarter computer opponent.**
12. **Online play with Firebase,** in the game's own section of the database.
