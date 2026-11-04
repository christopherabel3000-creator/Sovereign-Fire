# Sovereign Fire: Design Document

## Overview

Sovereign Fire is a turn-based modern war between two nations. Both players secretly lock in orders, then the turn plays out at once. Victory comes from combining military strength, a strong economy, scientific progress, and morale on the home front. A typical game lasts 2–4 hours, or roughly 40–50 turns.

## Modes

- **Versus computer:** Easy, Normal, or Hard, chosen when starting a game.
- **Online versus a friend:** live play with no turn timer, through a 4-letter game code. Each player presses a button to lock in their turn, and hears a message when the opponent has locked in. Games save automatically and can be resumed later.

## Pre-game setup

1. **Name your nation,** or press Suggest a name for a random fictional one, such as the Republic of Valdoria. The two players cannot use the same name.
2. **Choose a government.** Government type is revealed to both players at the start.
   - **Democracy:** science up 25% and industry up 10%. Losses, bombing, and lost cities hurt morale 50% more. Once per game, when enemy troops are within 2 squares of the capital or morale is below 40, it can rally the nation for 20 morale.
   - **Authoritarian State:** losses, bombing, and lost cities hurt morale 40% less. Science down 25%. Every 8 turns it can order an emergency draft for 8 recruits, at a cost of 3 morale.
   - **Military State:** units cost 20% less industry and take 1 less turn to build, never less than 1. Industry and science down 20%. Morale falls 2 a turn without a battle won in the last 3 turns. Once per game, mass conscription gives 12 recruits and 4 infantry at the capital.
   - **Scientific Republic:** science up 50%. Manpower down 20%. Once per game, a research breakthrough gives 40 science.
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
- **Gasoline:** paid once when a ship or plane is built. There is no gasoline upkeep.
- **Science:** used for research.

## Upkeep

There is no upkeep. Ships and planes cost gasoline once, when they are built.

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

Morale runs from 0 to 100, and every nation starts at 100. When it reaches 0, that nation surrenders. Your own morale is shown exactly. The enemy's is described in words: high, steady, shaken, low, or near breaking.

Each turn, morale changes from:
- Units lost: 0.5 for each ground unit, 1 for each ship or plane.
- Buildings destroyed by bombs or missiles: 2 each.
- Each bombing raid or missile strike that lands on one of your cities: 1.
- A city lost: 8. The capital lost: 20.
- Each blockaded port: 1 a turn.
- Military State only: 2 a turn without a battle won in the last 3 turns.
- Using nuclear weapons first, and being hit by them: see Nuclear weapons.

Morale rises from:
- Battles won: 1 each, up to 3 a turn.
- An enemy city captured: 4. The enemy capital: 10.
- One of your own cities retaken: 6.

Government changes how hard the bad news hits: 50% more for a Democracy, 40% less for an Authoritarian State.

## Nuclear weapons

**Warheads.** After Nuclear weapons research, any city with a factory can build a nuclear warhead: 60 industry, 10 gasoline, and 4 turns. Warheads are kept in a national stockpile.

**Delivery.** A nuclear strike needs a warhead plus one of:
- A missile in a city, with normal missile range. The missile is used up.
- A bomber, with normal bomber range. It faces enemy fighters patrolling over the target, anti-aircraft guns, and air defense batteries, like any bomber.
- A submarine at sea, up to 8 squares away. The submarine is not used up.

Missiles from cities and submarines face the same missile defense as any missile. Launching takes a confirmation check box, and can be canceled before locking in, which returns the warhead.

**The blast.**
- Every unit on the target square is destroyed, on both sides. A city there loses every building.
- Each unit on the 8 squares around it has a 50% chance to be destroyed, and cities there lose half their buildings, rounded down.
- The target square is radioactive for 6 turns. No units can enter, and a city there produces nothing.
- Every launch is reported to both sides, even when shot down.

**Morale.**
- The first side to launch loses 30 morale, even if the weapon is shot down. Each later launch by that side costs 10 more.
- A side that strikes back after the enemy launched first loses no morale for its own launches.
- If both sides launch first in the same turn, both pay the first-use cost.
- The side hit loses 10 morale for each detonation, plus the usual morale for its losses.
- Government changes all nuclear morale, both for launching and for being hit: an Authoritarian State loses half as much, and a Military State three quarters as much. Democracies and Scientific Republics lose the full amount.
- Launching never takes your own morale below 15. A nation on the brink can still strike without surrendering for it, though losses from the enemy can still push it lower.

## Victory conditions

Checked at the end of every turn.
- **Surrender:** a nation's morale reaches 0.
- **Conquest:** a nation holds no cities.
- **Annihilation:** a nation has no units left and no way to build more.

If both nations fall in the same turn, the war ends in a draw. The game over screen names the winner, how the war ended, and each side's morale, cities, and units, followed by the last turn's report.

## Accessibility

- Fully playable with VoiceOver on iPhone and with screen readers on a computer.
- Clear spoken descriptions of each square.
- Quick ways to jump to things, such as the next unit that hasn't moved.
- Turn reports read as clear summaries.
- No repeated spoken instructions.

## Open questions

1. **Exact numbers:** unit costs, strength, movement, research costs, and the starting budget. To be settled during building and playtesting.
2. **The map itself:** placement of cities, rivers, mountains, and bridges.
3. **Satellites:** settled. They can be destroyed by anti-satellite missiles.

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
- Carrier: moves 3, attack 1, defense 4. Carries up to 4 planes. If it sinks, they are lost.

**Naval battles** use the same rules as land battles, with no terrain bonus at sea. A unit fighting a type it hunts gets 3 extra attack and defense. Ships cannot attack land units directly, except by shore bombardment.

**Transports and invasions.**
- Troops in a port can be loaded onto transports as they sail out, in the same order.
- Troops can also board a transport waiting on an ocean square next to them.
- A transport's order can land everything aboard on a land square next to where it stops. Troops already at sea can also land on a later turn.
- Landing troops lose 2 attack.
- If a landing fails, the survivors stay aboard. If a transport sinks, everything aboard is lost.
- A transport driven back by a sea battle returns to where it started. Troops on a transport in port go ashore there.

**Shore bombardment.** Destroyers can fire at visible enemy troops on a land square next to them, like artillery. Each destroyer has a 40% chance to destroy one unit, lowered by the same terrain amounts. Bombers on a carrier can bomb the shore too, from wherever the carrier is.

**Blockades.** Enemy warships on a square next to a port stop it from building ships. Blockades will hurt morale once morale arrives.

**Ports and capture.** Ships docked in a city the enemy captures are destroyed, along with planes there.

## Air, first version

These numbers are starting points for playtesting.

**Planes.** Planes are based in cities with airfields, or on carriers. They do not hold squares. Each turn, each plane can fly one mission from its base, and returns home afterwards.
- Fighter: attack 6, defense 6, range 6.
- Bomber: attack 1, defense 2, range 8.
- Scout plane: range 10, as before.

**Missions.**
- **Patrol:** fighters patrol the 3 by 3 area around a square.
- **Bombing run:** bombers attack one of three targets:
  - Visible enemy troops: each bomber has a 50% chance to destroy one unit, lowered by terrain like artillery.
  - An enemy city's buildings: each bomber has a 35% chance to destroy one building.
  - A bridge, on either side: each bomber has a 50% chance to bring it down.
- **Move to a new base:** to another airfield city you hold, or onto one of your carriers with room, within range.
- **Scout:** as before.

**The air war, each turn, before anything else.**
1. Fighter patrols whose areas overlap fight an air battle, like a meeting battle on land.
2. A square is held by a side if only that side's surviving fighters patrol over it, and contested if both do.
3. Bombers are intercepted by enemy fighters patrolling over their target. An interception is a single round of fire, not a full battle. Your fighters patrolling over the same square fly as escorts. Bombers are lost before escorts.
4. Each anti-aircraft gun on the target has a 20% chance to shoot down a bomber.
5. Surviving bombers drop their bombs.
6. Scout planes can also be caught: each enemy fighter patrolling over their target has a 30% chance.

**Air support.** In any battle on land or sea, the side holding the sky over that square adds 1 to every unit's hit number.

**Bridges.** A bombed bridge works like a river square, so tanks cannot cross it. An engineer who stays on it for a turn rebuilds it.

**Carriers.** Planes on a carrier move with it and fly missions from wherever it is. A carrier holds up to 4 planes.

## Missiles, first version

These numbers are starting points for playtesting.

**Missiles.** Missiles are built in a city with a factory and stored there. They can be fired at any square up to 14 squares away, seen or unseen, and are used up when fired. That reaches capital to capital.
- **At units:** each missile that gets through can destroy up to 2 units on the square, each with a 60% chance, lowered by terrain like artillery. At sea, it hits ships.
- **At an enemy city's buildings:** each missile that gets through has a 60% chance to destroy one building.
- You only learn what a missile hit if you can see the target square, or if you aimed at an enemy city's buildings.

**Missile defense.** Each missile is engaged in turn by every defense near its target until it is shot down or nothing has shots left.
- A missile defense battery protects its city and the squares around it. It gets 2 shots a turn, each 75% to stop a missile.
- A destroyer protects the squares within 1 of it. It gets 1 shot a turn, 60% to stop a missile.
- Firing several missiles at once can overwhelm the defenses. In testing, a capital with its free battery stopped about 1.5 missiles a turn on average, so a salvo of 5 destroyed about 2 buildings.

**Air defense batteries.** A city building that fires like 2 anti-aircraft guns at bombers attacking that city, and at scout planes flying over it.

## Research, first version

These numbers are starting points for playtesting.

**The queue.** Each side keeps a research queue. Science from labs is saved, and whenever enough is saved for the first technology in the queue, it is finished at the end of the turn. Science is never lost. If the queue is empty, it keeps saving, and the turn report reminds you to queue something.
- Technologies in a branch must be researched in order, tier 1 before tier 2 before tier 3.
- You can move a technology up the queue, or remove it. Removing one also removes anything after it in its branch.
- Tier 1 costs 20 science, tier 2 costs 45, and tier 3 costs 80. The nuclear branch costs 30, 60, and 120.

**Pacing from testing.** With the starting 6 lab workers, a side finishes its first tier 2 technology around turn 25. A side that starts with 5 labs and 12 lab workers finishes its first tier 2 by turn 13, and its first tier 3 by turn 28.

**Secrecy.** Research is secret. The first time your units fight enemy units that have been upgraded, the report may give a hint, such as "Enemy tanks seem better armored than before." Code breaking shows the enemy's finished research outright.

**The technologies.**
- Land: Composite armor, tanks +1 attack and +1 defense. Mechanized infantry, infantry move 3 and +1 defense. Main battle tanks, tanks +2 attack, +1 defense, and move 4.
- Sea: Improved sonar, destroyer sonar reaches 3 squares and +1 attack. Attack submarines, +2 attack and move 4. Aegis combat system, destroyers +1 defense and 2 shots a turn at missiles, each 75%.
- Air: Jet fighters, +1 attack, +1 defense, and +2 range. Heavy bombers, +2 range and 15% more likely to hit. Stealth aircraft, bombers +4 defense against fighters, and anti-aircraft fire is half as likely to hit them.
- Missiles and defense: Guided missiles, 15% more accurate. Layered missile defense, batteries get 3 shots a turn and are 10% more likely to stop a missile. Anti-satellite missiles, missiles can be fired at enemy satellites, 50% each to destroy one.
- Intelligence: Code breaking, see the enemy's finished research. Satellites, cities with a factory can build them. Deep cover agents, scout planes and satellites can spot special forces and submarines.
- Economy: Factory automation, factories use 4 workers. Advanced refining, refineries and labs use 1 more worker. Mass production, units cost 20% less industry.
- Nuclear: Nuclear physics, no effect on its own. Nuclear power, factories and refineries use 1 more worker. Nuclear weapons, cities with a factory can build nuclear warheads.

**Satellites.** 30 industry, 6 gasoline, and 3 turns, in a city with a factory, after Satellites research. They go into orbit, not onto the map.
- Each satellite watches the 7 by 7 area around a square of your choosing, and keeps watching it until you change it. New satellites watch the enemy capital.
- Each satellite makes your missiles 5% more accurate and your missile defense 5% more likely to stop missiles, up to 20%.
- Only anti-satellite missiles can destroy them.

## Computer opponent, first version

**Fair play.** The computer gives its orders through the same rules as a person, gets no bonuses at any difficulty, and only knows what its side can see. Difficulty changes how well it plays, not what it has.

**Each turn, it:**
1. Sets its workforce and keeps its research queue filled, in an order that suits its government.
2. Uses its government's ability when it makes sense.
3. Keeps garrisons in its cities, more in the capital and in any city with enemy troops nearby, and pulls in reinforcements when threatened.
4. Fires artillery and destroyers at visible enemies, and missiles at big visible armies.
5. Attacks any enemy square it can reach when the odds are good enough, combining nearby stacks into one attack.
6. Moves the rest of its army toward the nearest enemy cities along real routes, waiting to gather a big enough force before advancing, and avoiding much stronger enemy armies.
7. Sends scout planes over enemy cities near the front, fighters over its main attack or most threatened city, and bombers at its attack target or the biggest enemy army it can see.
8. Attacks enemy ships when the odds are good.
9. Builds infantry where cities are threatened, then about one tank for every two infantry, plus artillery, planes, missiles, and new buildings.
10. Uses nuclear weapons only to strike back after being hit first, or when its own morale is below 25.

**Difficulty.**
- Easy: attacks only at 80% odds or better, sometimes hesitates, does not gather or combine forces, and does not use fighters or bombers.
- Normal: attacks at 60% odds or better, combines stacks, gathers 3 units before advancing, and uses air power.
- Hard: attacks at 50% odds or better, gathers 4 units, invades by sea, and fires missile salvos at enemy cities.

**Starting buildings by government.** A Military State starts with 6 factories and 2 refineries. A Scientific Republic starts with 5 labs. The others use the balanced plan.

**From simulated games** between computer players, wars ended between turns 23 and 46, by surrender or conquest. A Military State's early rush beat a Scientific Republic by turn 32, which is worth watching in playtesting.

## Online play, first version

**Where games live.** Each online game is one record in the shared Firebase Realtime Database, under sovereignFire, kept apart from the other games' data. The database only accepts a save whose version number is exactly one more than the stored one, so two players can never overwrite each other. A refused save is read again and retried. Old games can be cleared after a week.

**Starting.** One player chooses Create an online game and gets a 4-letter code. They play the North. The other chooses Join game and types the code, and plays the South. Both set up their nations at the same time, and the war starts when both are done.

**Each turn.**
- Both players give orders on their own devices. Nothing is sent until they lock in.
- Locking in sends only that player's own side: orders, workforce, research, production, and nation.
- A player can unlock and change their orders until the other player also locks in.
- Whoever locks in second plays out the turn and saves the result for both.
- Each player hears when the other locks in, and when the results arrive. The screen updates by itself.

**Coming back.** The game is saved on each device. Continue online game picks it up again, and typing the code under Join game on the same device rejoins as the same side.

**Fairness.** Each screen only shows its own side's view. The full game is stored in the database, so it is meant for friends who trust each other, like the other games.

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
- Scout plane: 8 industry, 1 recruit, 2 gasoline, 2 turns. Needs an airfield in that city.
- Fighter: 10 industry, 1 recruit, 3 gasoline, 2 turns. Needs an airfield.
- Bomber: 14 industry, 1 recruit, 4 gasoline, 2 turns. Needs an airfield.
- Destroyer: 12 industry, 2 recruits, 4 gasoline, 2 turns. Needs a port.
- Submarine: 12 industry, 2 recruits, 4 gasoline, 2 turns. Needs a port.
- Transport: 8 industry, 1 recruit, 3 gasoline, 2 turns. Needs a port.
- Carrier: 24 industry, 3 recruits, 8 gasoline, 4 turns. Needs a port.
- Missile: 15 industry, 3 gasoline, 2 turns. Needs a factory.
- Satellite: 30 industry, 6 gasoline, 3 turns. Needs a factory and Satellites research.
- Nuclear warhead: 60 industry, 10 gasoline, 4 turns. Needs a factory and Nuclear weapons research.

**Buildings.** Factories, refineries, labs, and ports cost 12 industry. Airfields cost 15. Each takes 3 turns. Ports can only go in coastal cities. Air defense batteries cost 10 industry and take 2 turns. Missile defense batteries cost 14 industry and take 3 turns.

**Free capital defense.** Each capital starts with 1 missile defense battery, on top of the starting plan. It uses one of the capital's 5 building spaces.

**Canceling.** Units and buildings can be canceled for a full refund in the turn they were ordered.

**Gasoline.** Ships and planes cost gasoline once, when they are built. Missions and sailing are free after that.

**Capturing cities.**
- A city changes hands when the other side's ground units hold it. It keeps whatever buildings it has.
- A captured enemy city produces for you right away, but at 25% for its first 3 turns.
- Retaking your own city brings it back to full strength at once.
- Anything the old owner was building there is lost.

## Starting armies, first version

Each side starts with the mirror image of this army. South's squares are the same column, mirrored row.

- **F2, capital:** 3 infantry, 1 anti-aircraft gun, 2 fighters, 1 bomber, and 1 scout plane.
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
   - **6b, air:** fighters, bombers, carriers' planes, and air control. (Built.)
7. **Missiles and defenses.** (Built.)
8. **Science and research.** (Built.)
9. **Morale, government types, and victory conditions.** (Built.)
10. **Nuclear weapons.** (Built.)
11. **A smarter computer opponent.** (Built.)
12. **Online play with Firebase,** in the game's own section of the database. (Built.)
