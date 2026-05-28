-- Demo seed for offline development.
-- Assumes the schema has been applied via `pnpm db:migrate:local` and the
-- initial settings/tiers/home_page rows from 0001_initial.sql are present.
--
-- All IDs are hard-coded strings (instead of nanoid) so re-seeding is
-- deterministic and references between rows are stable.
--
-- Real content adapted from chuckanutscc.org (2026 season + About).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Wipe demo data (idempotent reseed). Order matters: children before parents.
-- ---------------------------------------------------------------------------
DELETE FROM photos;
DELETE FROM event_photographers;
DELETE FROM event_reminders;
DELETE FROM email_log;
DELETE FROM merch_requests;
DELETE FROM merch_items;
DELETE FROM member_payments;
DELETE FROM members;
DELETE FROM newsletter_subscribers;
DELETE FROM contact_submissions;
DELETE FROM photographers;
DELETE FROM events;
DELETE FROM pages;
DELETE FROM locations;
DELETE FROM seasons;

-- ---------------------------------------------------------------------------
-- Settings: keep an announcement banner enabled
-- ---------------------------------------------------------------------------
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('announcement_enabled',   '1'),
  ('announcement_text',      'Autocross Cup 3 is June 7 at Bellis Fair Mall — see the events page to register.'),
  ('announcement_link',      '/events'),
  ('scorekeeper_series',     'cscc2026'),
  ('season_rules_url',       '/autocross-rules'),
  ('register_url',           'https://scorekeeper.wwscc.org/register/cscc2026/events'),
  ('social_instagram_url',   'https://www.instagram.com/chuckanutscc'),
  ('social_facebook_url',    'https://www.facebook.com/ChuckanutSportsCarClub');

-- ---------------------------------------------------------------------------
-- Pages
-- ---------------------------------------------------------------------------
INSERT INTO pages (id, slug, title, body_md, show_in_nav, nav_order, created_at, updated_at, updated_by) VALUES
  ('page_about', 'about', 'About the Club',
   '# Our History' || char(10) || char(10) ||
   'Established in 1956, Chuckanut Sports Car Club in Bellingham, Washington was founded by motoring enthusiasts, with the intent to promote different forms of motoring pastimes such as Gymkhanas, Autocrosses, Rallies, and Tours. The early membership was made up primarily of professional and business people, since they were the ones who could afford the Jaguars, Austin Healeys, and Alfa Romeos of the day.' || char(10) || char(10) ||
   '![Vintage CSCC photo](/media/about/photo-1.jpg)' || char(10) || char(10) ||
   'Chuckanut Sports Car Club remains a multifaceted organization, holding true to the founders'' original intent. Its membership includes people from all walks of life, and prides itself on its family-oriented inclusiveness. **Ownership of a sports car is not a requirement for membership.**' || char(10) || char(10) ||
   'There have been hurdles along the way necessitating changes of focus for the club. One of the earliest, the opening of Sunday shopping, saw the loss of most, if not all, of the venues for our local autocrosses. The 1970s oil crises and the eruption of Mt. St. Helens further disrupted the rally program. By the early 1980s the club had reached its lowest point.' || char(10) || char(10) ||
   '![Club event](/media/about/photo-2.jpg)' || char(10) || char(10) ||
   'By 1986, community interest in motoring activities brought new life to the club. A few dedicated and creative members found new venues to revive the Autocross program — Thomas Glenn Way (now Bellwether Way), the Port of Bellingham lot, and the Bellingham Technical School grounds. In 1988 and 1989, the club ran downtown street autocrosses with assistance from SCCA Northwest Region.' || char(10) || char(10) ||
   'During this same time, other members were active in the organization and operation of the Olympus World Rally Championship event, as well as Time-Speed-Distance rallies including the legendary ALCAN 5000.' || char(10) || char(10) ||
   '![Cars on grid](/media/imports/gallery-1.jpg)' || char(10) || char(10) ||
   '## Today' || char(10) || char(10) ||
   'Sixty-plus years later, interest remains strong in nearly all types of activities. The club hosts several **Autocross events** yearly, participates in **Time-Speed-Distance rallies** and **stage rally events**, and continues to support the broader Pacific Northwest motorsports community.' || char(10) || char(10) ||
   'Social events continue to be a strong point of the club. From tours of the **Le May Museum** and **Griot''s Garage**, to potluck picnics and our **5th Wednesday socials**, there''s always a reason to get together — sports car required or not.' || char(10) || char(10) ||
   '## Join us' || char(10) || char(10) ||
   'Whether you''re a seasoned autocrosser or a first-timer with a daily driver, you''re welcome. [Become a member](/membership) — or just [come to an event](/events) and try a temporary entry.',
   1, 1, unixepoch(), unixepoch(), 'seed@localhost'),

  ('page_rules', 'autocross', 'About Autocross',
   '# What is autocross?' || char(10) || char(10) ||
   'Autocross uses cones to mark out a course in a parking lot. Drivers run the course one at a time and try to beat their previous time without hitting cones or going off-course. It rewards **driver confidence, knowledge of your vehicle, friendly competition, and precision** — not raw horsepower.' || char(10) || char(10) ||
   'Speeds stay around **20–40 MPH** with very little risk to the car or driver. You''ll typically get **10–15 timed runs** in a day.' || char(10) || char(10) ||
   '## Who can participate?' || char(10) || char(10) ||
   'Anyone with a valid driver''s license. You don''t need a sports car — daily drivers do great. First-timers are welcome; we''ll pair you with a club mentor to walk you through the course, tech, and grid procedure on your first runs.' || char(10) || char(10) ||
   '## What you need to bring' || char(10) || char(10) ||
   '- **A valid driver''s license**' || char(10) ||
   '- **CSCC membership** — or a $10 temporary membership at the event. [Sign up for a full season](/membership).' || char(10) ||
   '- **Entry fee** — cash, credit, or check on-site (see [the season schedule](/events) for current pricing)' || char(10) ||
   '- **A helmet** with a certification on our approved list (see Helmet rules below). Loaners are available if you don''t have one.' || char(10) ||
   '- **Closed-toed shoes** and weather-appropriate clothes' || char(10) ||
   '- **Your car in good mechanical condition** — see Vehicle requirements below' || char(10) || char(10) ||
   '## Helmet rules' || char(10) || char(10) ||
   '**Helmets with only a DOT rating are not allowed** — our insurance requires Snell-rated helmets (SA or M ratings). A limited number of loaner helmets are available at every event, but bring your own if you have one.' || char(10) || char(10) ||
   '## Vehicle requirements' || char(10) || char(10) ||
   'Tech inspection follows **SCCA rule book section 3.3.3 — Safety Inspections**. Your car must be in good mechanical condition and not a rollover risk. We check:' || char(10) || char(10) ||
   '- Brakes, tires, and wheel bearings' || char(10) ||
   '- Seatbelts (working and worn correctly)' || char(10) ||
   '- Battery hold-down' || char(10) ||
   '- Loose items removed from the cabin' || char(10) || char(10) ||
   'For class rules see the [SCCA Solo Cars and Rules](https://www.scca.com/pages/solo-cars-and-rules) page and the [SCCA Classifier tool](https://scca-classifier.com).' || char(10) || char(10) ||
   '## A typical event day' || char(10) || char(10) ||
   '- **7:30 AM** — gates open, registration & tech inspection begin' || char(10) ||
   '- **8:30 AM** — course walk' || char(10) ||
   '- **9:00 AM** — mandatory driver''s meeting' || char(10) ||
   '- **9:30 AM** — first heat begins' || char(10) ||
   '- **12:00 PM** — lunch break' || char(10) ||
   '- **1:00 PM** — second heat' || char(10) ||
   '- **~4:00 PM** — awards and pack-up' || char(10) || char(10) ||
   '## Weather' || char(10) || char(10) ||
   'Events run rain or shine. Cancellations only happen for *severe* weather — lightning, volcanic eruptions, tsunamis, or flooding. Check the [events page](/events) for any last-minute updates.' || char(10) || char(10) ||
   '## Ready to give it a try?' || char(10) || char(10) ||
   '1. Browse the [2026 season schedule](/events)' || char(10) ||
   '2. [Become a member](/membership) (or pay $10 at the event for a temporary one)' || char(10) ||
   '3. Register on [Scorekeeper](https://scorekeeper.wwscc.org/register/cscc2026/events) for the event you want to run' || char(10) ||
   '4. Show up at 7:30 AM and ask anyone in a CSCC shirt — we''ll get you sorted',
   1, 2, unixepoch(), unixepoch(), 'seed@localhost');

-- Populate the new hero/TOC/print columns added in migration 0008. Done as
-- separate UPDATEs so the INSERT above stays focused on the markdown body.
UPDATE pages SET
  eyebrow         = 'About the Club',
  subtitle        = 'Founded in 1956, CSCC is a Bellingham, Washington sports car club. Autocross, rallies, tours, and social events — open to anyone with an interest in driving.',
  show_toc        = 1
WHERE id = 'page_about';

UPDATE pages SET
  title           = 'Autocross for Everyone',
  eyebrow         = 'About Autocross',
  subtitle        = 'Cones in a parking lot, one car at a time. It rewards driver confidence and precision — not horsepower. Daily drivers welcome, first-timers get a mentor for their first runs, and speeds stay around 20–40 MPH with very little risk to car or driver.',
  hero_image_key  = 'imports/gallery-1.jpg',
  hero_stat_value = '70+',
  hero_stat_label = 'Years racing in the Pacific Northwest — CSCC''s been at it since 1956.',
  hero_items_json = '["Any car welcome — yes, even your daily driver","Loaner helmets for newcomers","Experienced drivers ride along to help","Affordable entry fees (typically $25–40)","10–15 timed runs per event","Friendly competition with classing for fairness"]',
  hero_ctas_json  = '[{"label":"Come to your first event","href":"/events","primary":true},{"label":"Become a member","href":"/membership","primary":false},{"label":"Read the rules","href":"/autocross-rules","primary":false}]'
WHERE id = 'page_rules';

-- Full 2024 REV1 autocross rulebook — editable through /admin/pages. The
-- TOC + print toggles are on so visitors get a sticky sidebar of sections
-- and a clean print/PDF export.
INSERT INTO pages (
  id, slug, title, body_md, show_in_nav, nav_order,
  seo_title, seo_description,
  eyebrow, subtitle, hero_image_key, hero_stat_value, hero_stat_label,
  hero_items_json, hero_ctas_json, show_toc, show_print,
  created_at, updated_at, updated_by
) VALUES (
  'page_autocross_rules', 'autocross-rules', 'CSCC Autocross Rules & Regulations',
  '## General Event Rules

We conduct our events as guests of the site owners. Those entrants who cannot abide by our regulations may be asked to leave the property and may be disallowed from future events. CSCC has an infraction policy which sets out penalties for rule infractions. If you have any questions, ask the event chair.

- **Every person must sign the event waiver to enter the site.** Minors must be accompanied by a legal guardian, who has filled out and signed a Minor Waiver for each minor.
- **Forbidden at the event site:** alcohol, mind-altering or stimulating drugs; unrestrained animals; unrestrained children.
- **Limit your speeding to on-track and against the clock.** No burn-outs, heating tires, or heating brakes anywhere near the event. The speed limit in the parking, pits, and staging areas is **5 MPH**.
- **Leave only footprints and take only pictures.** Pick up after yourselves and others. Leave the site cleaner than you found it.
- **Realize that an autocross is a full day''s commitment.** Every competitor is expected to work any position they are assigned to.

## Vehicle Classification

It is the duty of the competitor to classify their vehicle. Some CSCC classes are based on SCCA classes; PAX and C3 Street classes are PAX-indexed. For specifics, refer to the official SCCA Solo Rules sections 13–20, and SCCA Solo Rules Appendix A for specific vehicle classing within a preparation level. If there are any questions about classing, contact the Autocross Rules Steward.

- **NOV — Novice.** May run any vehicle, no tires below 200 treadwear.
- **TO — Time Only.** No index, no trophies, just fun.
- **PAX — Professional Autocross.** Open to all SCCA classes.
- **C3 — Street.** SCCA Street classes, CAM & SSC.
- **C2 — Street Tires.** SCCA Street Touring, Street Prepared & Street Modified.
- **C1 — Race.** Run what ya brung. SCCA Prepared, Modified & X classes.

FSAE, kit cars, karts, and home-made vehicles are required to run their appropriate SCCA classing in PAX or TO.

### Class Requirements & Allowances

**NOV — Novice.** Any competitor who is new to the sport may compete as a novice with the following restrictions:

- Must start the season having driven four (4) or fewer total autocross events.
- Anyone starting the year as a novice may run as a novice for the rest of the year.
- Any driver running tires with a treadwear grade of less than 200 may not compete for points in Novice.
- For simplicity, this class does not use SCCA classing or any indexes when calculating times.

**TO — Time Only.** Any vehicle determined to be suitable for autocross, even if it doesn''t meet classification requirements. This class does not have trophies or championship points.

**C3 — Street.** Vehicles must conform to SCCA Street, Solo Spec Coupe, or Classic American Muscle class guidelines. See SCCA Solo Rules section 13, SSC Official Specifications, or CAM Supplemental Class rules. Uses the current PAX/RTP Index when calculating times.

**C2 — Street Tires.** SCCA Street Touring, Street Prepared, or Street Modified. See SCCA Solo Rules section 14, 15, or 16. Vehicles must use tires with a minimum UTQG Treadwear Grade of **200**. Does not use indexes when calculating times.

**C1 — Race.** Allows for nearly unlimited modification. Production road-legal vehicles with complete body panels. Anything but nitrous is permitted. Does not use indexes when calculating times.

**PAX — Professional Autocross.** Any vehicle that meets SCCA class rules. Uses the current PAX/RTP Index when calculating times.

## Registration & Entry Fees

A CSCC Club Membership is required to participate. Club membership is **$30 per calendar year**, with a **$20** membership available in the month of January. **Single weekend memberships are $10**; one weekend membership is transferable toward an annual membership — speak with the Membership Chair or Chief of Registration at the event.

Online registration via Scorekeeper (paying with PayPal through the Scorekeeper PayPal button) is highly encouraged. Day-of registration is handled on a case-by-case basis if slots remain open. The entry fee is set per-event by the autocross chair and listed on Scorekeeper. Entry fees will be refunded for events canceled due to circumstances beyond our control.

- Visit [scorekeeper.wwscc.org/register](https://scorekeeper.wwscc.org/register).
- For your first event, create an account with the "Register" button.
- Select the current CSCC series.
- Add your vehicle to the series — required for your first event of the series, or any time you''re driving a vehicle you haven''t used in this series.
- In the Events tab, confirm that you have read the rules.
- Events with open registration have a green dot in the event title bar; others list the dates registration opens and closes.
- Select your event, choose your vehicle, then select the appropriate price based on your membership status.
- Use the shopping cart button to pay for the event.

## Protests

Any entrant who believes that another competitor in their class is either running in the wrong class — by classing error or because their vehicle is prepared beyond what the class allows — may protest the classification.

- The entrant filing the protest bears any costs which may accrue.
- Protests must be filed with the Rules Steward or Event Chair **before the announcement of the results** at the event site.
- Upon filing, the stewards shall immediately impound the protested vehicle and determine what action is needed to decide if the protest is valid.
- If the protested party declines verification, the stewards may deem the protest valid.
- The stewards may validate the protest (reclassify the vehicle and apply the times to the proper class), deny it, or require further documentation. Any decision not made on the day of the event shall be sent to each interested party within five days. **The decision of the event steward(s) is final.**

## Timing & Scoring

### Timing

Your time starts when your vehicle breaks the light beam at the photocell on the starting line. The timer is stopped in the same manner at the finish line. Although you''ll be directed when to start — by a human starter or a green light — your time doesn''t actually start until you trip the photocell.

### Scoring & Points

Your best run of each event is the only one used to determine the points you score. You score points only within the class you''re running in. Occasionally an event runs the course in one direction in the morning and the opposite direction in the evening; in that case, your best time in each direction is combined to determine your best time of the day.

- If you are the winner of your class, you get **100 points**.
- Otherwise: take the winner''s best time of the day (including penalties), divide by your best time of the day (including penalties), and multiply by 100. The result, 100 or less, is your point total for the event.
- *Example:* if your best time was 60.137s (58.137s plus a 2-second cone penalty) and the class winner''s best was 59.996s with no penalties, your score is 59.996 / 60.137 × 100 = **99.766 points**.

### Penalties

Penalties are assessed for not driving the course correctly. They are only applied to the run in which they occurred.

- A **cone penalty** adds **two seconds** per cone on that run. The standard "down and out" rule applies.
- A **gate penalty** adds **ten seconds** per gate missed on that run.
- Penalties are applied *after* the PAX index has been applied to the raw time. *Example:* a competitor with an index of 0.809 gets a raw time of 58.639 with one cone penalty. The indexed time is 47.439, plus 2 seconds, for a final time of **49.439**.

### Reruns

Reruns may be granted for a red flag caused by another driver, a timer malfunction, a downed cone that was not set back up, or interference from a spectator or course worker.

- It is the responsibility of the driver to **stop on course** for a cone out of position or for a person on course, and to demand a rerun from the first worker who approaches.
- All reruns due to a timer malfunction are at the discretion of the timing personnel.

### DNF (Did Not Finish)

A DNF occurs when a driver misses consecutive gates/cones (or a significant portion of them), or is obviously lost.

- The time for the run will not be recorded.
- If a driver registers all DNFs for an event, their scoring time is the **slowest vehicle in the class plus two seconds**.

## Participant Requirements

Seat belts must be worn by all drivers and passengers. A lap belt meets the minimum requirement; shoulder harnesses are recommended. All drivers and passengers must wear an approved helmet. Drivers and passengers in a vehicle without a windshield must use full-coverage helmets. Helmets must comply with **Snell 2010 M or SA (or newer)**, or be listed in the Chuckanut Helmet Bulletin, and must be properly secured.

> **Note:** Snell 2010 helmets will no longer be eligible for autocross competition after 2025.

### Driver Requirements

- Drivers must be a member of Chuckanut Sports Car Club.
- Drivers must have a valid driver''s license.
- Drivers under 18 must have a parent present at all times to authorize their participation and sign the waiver forms.
- Drivers must be paid entrants and be driving a vehicle that has passed tech inspection. In a driving school event, instructors may drive with a student passenger as part of instruction.
- Novice drivers may be required to have an instructor in the vehicle at the discretion of the Novice or Event Chair.
- Drivers are expected to be on site as long as needed to complete both driving and work assignments. Failure to work will result in no points or official times being posted for that event.

### Passenger Requirements

- Only the driver and a single passenger may be in the vehicle while on course.
- Passengers must be at least **12 years of age and 57 inches** in height.
- Passengers must complete all necessary waivers and wear a wristband.
- Passengers must be in an adequate passenger seat and using all required safety equipment.
- Any driver may ride with any competitor at any time, so long as it does not cause a delay in the grid. Novices may only have experienced drivers or instructors in their vehicle.

## Vehicle Requirements

All vehicles participating must pass tech inspection, fall within acceptable sound levels, and meet the rollover requirements described in the SCCA Solo Rules Book section 3.1.A. The event Safety Steward and the Chief of Tech have the final say on whether a vehicle passes inspection.

### Tech Inspection

Tech inspection is conducted in the pits before the driver''s meeting. If you''ll be using your own helmet, it must be in the front seat for inspection. Park with the hood and trunk open and doors unlocked.

- Race-ready, with excellent brake and steering systems and negligible fluid leaks.
- Battery must be secured, with no allowable movement.
- Throttle must return to a closed position when released.
- Vehicle, including the trunk, must be emptied of any and all loose objects.
- 2" minimum safety belts, with a metal-to-metal buckle for both driver and passenger (if applicable).
- Hub caps, wheel rings, and any other non-bolted wheel trim must be removed.
- Wire wheels must not have more than three total loose spokes.
- Wheel bearings must be properly adjusted with no excessive wheel play.
- All wheel bolts/lugs and studs must be present and tight. The minimum amount of threads engaged must equal the diameter of the threaded portion.

### Vehicle Identification

At the discretion of the Event Chair, vehicles may be required to display both their class and number in a visible location. Numbers must be large enough and high-contrast enough to be clearly seen by timing workers. Painter''s tape is an easy and inexpensive option.

### Maximum Sound Level

**The maximum sound level is subject to change as required on-site.**

- The maximum sound level of any vehicle shall be less than **95 dBA**, measured with any device provided by CSCC.
- This level may be measured at any point on the course in any direction from the vehicle.
- Initial sound checks will be made at the starting line for every competitor.
- Any competitor exceeding the maximum sound level will not be permitted to continue to run unless they can modify their exhaust and pass a sound check administered by the Safety Steward or Chief of Tech.
- Violations will be recorded in the Tech Book for future reference.

## Your First Event

If you''re unsure what to do at your first autocross with CSCC — or your first autocross ever — this section provides tips to make your day go more smoothly. Feel free to contact the Autocross Chair beforehand, or the Event Chair at the event.

### Entering the Site

Park your vehicle in the pit area, prepare for tech inspection, and proceed to the Registration table. At our normal event location, the pit is the gravel lot and the registration table is inside the site fence near the timing van.

### Registration

The registration table should be your first stop, even if you''ve already registered online. You must sign the waiver to enter the site and participate; you''ll be given a wristband to wear as proof. If you don''t have a CSCC barcode, or need a replacement, you''ll be told how to get one. A course map will be at the table.

### Course Walks

There will be a guided Novice Course Walk before the driver''s meeting — listen for the announcement. Walking the course as many times as you can is advised.

### Driver''s Meeting

**The driver''s meeting is mandatory for all competitors.** It covers safety rules, the course layout and penalties, and the rules for the day. Run orders and work assignments are announced here.

### Working the Course

All drivers complete a work assignment. If you have limitations on what you can do, speak with the Chief of Workers during registration.

## Tips for Successful Autocrossing

### A Week Before the Race

Check your vehicle for fluid leaks, make sure your tires are in good shape, check that your battery hold-down is tight, and that coolant, oil, and brake fluid levels are good. Fix anything else that needs it.

### A Day Before the Race

Set your tire pressures, clean out the cabin, plan food/drink and a lawn chair, and get some rest.

### Race Day

Show up at the opening of registration, get paperwork and tech inspection out of the way, then immediately start walking the course. Aim for at least three complete walks (both directions if it''s a two-lap course) before your first run.

When you''re working the course or waiting in line, watch the other vehicles. Working the course: primary attention on the cones in your area. Waiting to run: primary attention on keeping your vehicle moved up in line and being strapped in with your helmet on.

Learn from other drivers — they''re eager to share knowledge. **Get them in your vehicle.** The best way to learn is to have someone ride along and instruct.

### Dress for the Weather

You''ll be outside all day in whatever weather presents itself. We race rain or shine, and participants are expected to complete their entire work assignment even if they''re soaked. Dressing in layers is recommended. Bring: rain coat, warm sweater, hat, sunscreen, and enough water for the day.

### Walking the Course

The most important thing you do before your first run is walking and learning the course. Take your course map. Go with an experienced driver if you''re new, and ask them how they''ll drive it. Follow someone fast and watch their lines.

When you walk, walk in the exact place you want your vehicle to go. Stop and examine each portion to find the best way through. Measure the distance between slalom cones, look for irregularities, and pick out your braking points. After you''ve walked the course, do it again — and again. Getting lost is guaranteed to be slow.

### Work Assignments

- **Waivers:** Confirm waivers are signed and hand out wristbands.
- **Course Worker — Radio:** Radio to Course Control with vehicle/penalty info. Holds a red flag and stops on-course vehicles in an unsafe situation.
- **Course Worker — Runner:** Signal your radio worker on penalties, and when safe, reset downed cones.
- **Announcer:** From the timing van, announce finish times, drivers leaving the line, and commentate the race.

### Chalking Your Tires

Engine mods don''t help if you can''t control the vehicle. Tires are the only part touching the course. Pressure is the lever you can move between runs — a few PSI can be the difference of whole seconds.

Before every run, draw three radial chalk stripes at equal intervals on all four tires, from mid-sidewall about two inches into the tread. After the run, inspect the wear: stripes worn only on the tread = pressure too high; worn down into the sidewall = pressure too low. Adjust in 2 PSI increments. Tires heat up through the day, so keep re-chalking.

### Have Fun

Autocross is challenging, but the only way to *really* do it wrong is to not have fun. We''ve never had an F1 talent scout at one of our events — you''re not missing out on a contract if you don''t put down the best time of the day.',
  0, 0,
  'CSCC Autocross Rules & Regulations',
  'Chuckanut Sports Car Club autocross rules and regulations — vehicle classification, registration, timing, scoring, participant and vehicle requirements, and tips for new drivers.',
  'Rulebook',
  'Effective February 1, 2024 · 2024 REV1. Print-ready and editable through the admin pages section.',
  NULL, '', '',
  '[]',
  '[]',
  1, 1,
  unixepoch(), unixepoch(), 'seed@localhost'
);

-- ---------------------------------------------------------------------------
-- Locations (venues)
-- ---------------------------------------------------------------------------
INSERT INTO locations (id, slug, name, address, latitude, longitude,
                       map_image_key, description_md, directions_md,
                       sort_order, active, created_at, updated_at) VALUES
  ('loc_bellis_fair', 'bellis-fair-mall', 'Bellis Fair Mall',
   '1 Bellis Fair Pkwy, Bellingham, WA 98226',
   48.785572, -122.487524,
   NULL,
   'The 2026 season home. We run on the upper section of the Bellis Fair Mall parking lot — large, flat, smooth asphalt with great spectator access from the food court side.',
   '- **From I-5:** Take exit 256 (Bellis Fair Pkwy), the mall is 0.3 mi west.' || char(10) ||
   '- **Where to park:** Drive into the mall, head toward the **Macy''s** end. Spectators park near the food court entrance.' || char(10) ||
   '- **Where the course is:** Look for the cones near Macy''s — that''s grid and tech inspection.' || char(10) ||
   '- **Bathrooms:** Inside the mall (food court entrance is closest).' || char(10) ||
   '- **Food:** Mall food court, or Red Robin in the adjacent lot (yum).',
   1, 1, unixepoch(), unixepoch());

-- ---------------------------------------------------------------------------
-- Photographers
-- ---------------------------------------------------------------------------
-- Tokens are hard-coded so the demo /p/<token> URLs stay stable across reseeds.
-- Production tokens are generated by generateUploadToken() — never use these.
INSERT INTO photographers (id, slug, name, bio_md, portfolio_url, instagram_url, contact_email, active, upload_token, created_at, updated_at) VALUES
  ('photog_alice', 'alice-chen', 'Alice Chen',
   'Bellingham-based photographer specializing in motorsport and Pacific Northwest landscape work. Trackside regular at CSCC autocross.',
   'https://example.com/alice', 'https://instagram.com/alicechenphoto',
   'alice@example.com', 1, 'demo-alice-token-aaaaaaaaaaaaaaaa', unixepoch(), unixepoch()),

  ('photog_bob', 'bob-martinez', 'Bob Martinez',
   'Course-side specialist with a soft spot for shooting against the Cascades skyline. Also runs the club Instagram.',
   NULL, 'https://instagram.com/bobmphoto',
   'bob@example.com', 1, 'demo-bob-token-bbbbbbbbbbbbbbbbbb', unixepoch(), unixepoch()),

  ('photog_peter', 'peter-zuidmeer', 'Peter Zuidmeer',
   'Local Bellingham photographer. Shot the full 2026 Cup #2 album — 1,700+ photos edited and posted from the Bellis Fair grid.',
   NULL, NULL, NULL, 1, 'demo-peter-token-cccccccccccccccc', unixepoch(), unixepoch());

-- ---------------------------------------------------------------------------
-- Events — 2026 Autocross season (from chuckanutscc.org)
--   Practice              May 2  2026   (past)
--   Autocross Cup 1       May 17 2026   (past)
--   Autocross Cup 2       May 23 2026   (past)
--   Autocross Cup 3       Jun 7  2026   (upcoming, ~2 weeks)
--   Autocross Cup 4       Jun 20 2026   (rescheduled from Jun 27)
--   Autocross Cup 5       Aug 29 2026
--   Autocross Cup 6       Aug 30 2026
--
-- Venue:        Bellis Fair Mall, Bellis Fair Pkwy, Bellingham, WA 98226
-- Registration: https://scorekeeper.wwscc.org/register/cscc2023/events
-- Hours:        8:00 AM – 4:00 PM Pacific
-- ---------------------------------------------------------------------------

INSERT INTO events (id, slug, title, event_type, status, start_at, end_at,
                    location_name, location_address, location_map_url,
                    description_md, registration_url, results_url,
                    run_groups_json, fee_member_cents, fee_nonmember_cents,
                    created_at, updated_at, updated_by) VALUES
  ('evt_practice', '2026-practice-day',
   'Practice Day', 'autocross', 'completed',
   unixepoch('2026-05-02 08:00:00-07:00'), unixepoch('2026-05-02 16:00:00-07:00'),
   'Bellis Fair Mall', 'Bellis Fair Pkwy, Bellingham, WA 98226',
   'https://maps.google.com/?q=Bellis+Fair+Mall+Bellingham+WA',
   'Season opener practice day — no timing, pure seat time to get reacquainted with the car and the venue. Gates open 7:30am, mandatory driver''s meeting at 9:00am.',
   'https://scorekeeper.wwscc.org/register/cscc2026/events',
   'https://scorekeeper.wwscc.org/results/cscc2026/df795800',
   NULL, 3500, 5000,
   unixepoch(), unixepoch(), 'seed@localhost'),

  ('evt_cup1', '2026-autocross-cup-1',
   'Autocross Cup #1', 'autocross', 'completed',
   unixepoch('2026-05-17 08:00:00-07:00'), unixepoch('2026-05-17 16:00:00-07:00'),
   'Bellis Fair Mall', 'Bellis Fair Pkwy, Bellingham, WA 98226',
   'https://maps.google.com/?q=Bellis+Fair+Mall+Bellingham+WA',
   'Round 1 of the 2026 Cup season. Gates open 7:30am, mandatory driver''s meeting at 9:00am.',
   'https://scorekeeper.wwscc.org/register/cscc2026/events',
   'https://scorekeeper.wwscc.org/results/cscc2026/04605d80',
   '["Race","Street Touring/Prep/Mod","Street","Novice","PAX","Time Only"]', 3500, 5000,
   unixepoch(), unixepoch(), 'seed@localhost'),  -- location set below

  ('evt_cup2', '2026-autocross-cup-2',
   'Autocross Cup #2', 'autocross', 'completed',
   unixepoch('2026-05-23 08:00:00-07:00'), unixepoch('2026-05-23 16:00:00-07:00'),
   'Bellis Fair Mall', 'Bellis Fair Pkwy, Bellingham, WA 98226',
   'https://maps.google.com/?q=Bellis+Fair+Mall+Bellingham+WA',
   'Round 2 of the 2026 Cup season.',
   'https://scorekeeper.wwscc.org/register/cscc2026/events',
   'https://scorekeeper.wwscc.org/results/cscc2026/36352bb0',
   '["Race","Street Touring/Prep/Mod","Street","Novice","PAX","Time Only"]', 3500, 5000,
   unixepoch(), unixepoch(), 'seed@localhost'),  -- location set below

  ('evt_cup3', '2026-autocross-cup-3',
   'Autocross Cup #3', 'autocross', 'scheduled',
   unixepoch('2026-06-07 08:00:00-07:00'), unixepoch('2026-06-07 16:00:00-07:00'),
   'Bellis Fair Mall', 'Bellis Fair Pkwy, Bellingham, WA 98226',
   'https://maps.google.com/?q=Bellis+Fair+Mall+Bellingham+WA',
   'Round 3 of the 2026 Cup season. Gates open 7:30am, mandatory driver''s meeting at 9:00am. Tiered pricing: **$35** super-early-bird (15+ days out), **$40** within two weeks, **$50** day-of.',
   'https://scorekeeper.wwscc.org/register/cscc2026/events',
   'https://scorekeeper.wwscc.org/results/cscc2026/363552c0',
   '["Race","Street Touring/Prep/Mod","Street","Novice","PAX","Time Only"]', 3500, 5000,
   unixepoch(), unixepoch(), 'seed@localhost'),  -- location set below

  ('evt_cup4', '2026-autocross-cup-4',
   'Autocross Cup #4', 'autocross', 'scheduled',
   unixepoch('2026-06-20 08:00:00-07:00'), unixepoch('2026-06-20 16:00:00-07:00'),
   'Bellis Fair Mall', 'Bellis Fair Pkwy, Bellingham, WA 98226',
   'https://maps.google.com/?q=Bellis+Fair+Mall+Bellingham+WA',
   '**Rescheduled from June 27.** Round 4 of the 2026 Cup season.',
   'https://scorekeeper.wwscc.org/register/cscc2026/events',
   'https://scorekeeper.wwscc.org/results/cscc2026/363552c1',
   '["Race","Street Touring/Prep/Mod","Street","Novice","PAX","Time Only"]', 3500, 5000,
   unixepoch(), unixepoch(), 'seed@localhost'),  -- location set below

  ('evt_cup5', '2026-autocross-cup-5',
   'Autocross Cup #5', 'autocross', 'scheduled',
   unixepoch('2026-08-29 08:00:00-07:00'), unixepoch('2026-08-29 16:00:00-07:00'),
   'Bellis Fair Mall', 'Bellis Fair Pkwy, Bellingham, WA 98226',
   'https://maps.google.com/?q=Bellis+Fair+Mall+Bellingham+WA',
   'Round 5 of the 2026 Cup season. Back-to-back with Cup #6 the next day — make a weekend of it.',
   'https://scorekeeper.wwscc.org/register/cscc2026/events',
   'https://scorekeeper.wwscc.org/results/cscc2026/b3d263f0',
   '["Race","Street Touring/Prep/Mod","Street","Novice","PAX","Time Only"]', 3500, 5000,
   unixepoch(), unixepoch(), 'seed@localhost'),  -- location set below

  ('evt_cup6', '2026-autocross-cup-6',
   'Autocross Cup #6', 'autocross', 'scheduled',
   unixepoch('2026-08-30 08:00:00-07:00'), unixepoch('2026-08-30 16:00:00-07:00'),
   'Bellis Fair Mall', 'Bellis Fair Pkwy, Bellingham, WA 98226',
   'https://maps.google.com/?q=Bellis+Fair+Mall+Bellingham+WA',
   'Season finale. Year-end Cup standings announced after the last run — Championship results at [scorekeeper.wwscc.org/results/cscc2026](https://scorekeeper.wwscc.org/results/cscc2026).',
   'https://scorekeeper.wwscc.org/register/cscc2026/events',
   'https://scorekeeper.wwscc.org/results/cscc2026/b3d263f1',
   '["Race","Street Touring/Prep/Mod","Street","Novice","PAX","Time Only"]', 3500, 5000,
   unixepoch(), unixepoch(), 'seed@localhost');

-- Link every event to Bellis Fair (current sole venue).
UPDATE events SET location_id = 'loc_bellis_fair';

-- ---------------------------------------------------------------------------
-- Seasons (one per year; the latest is the current default on /events)
-- ---------------------------------------------------------------------------
INSERT INTO seasons (id, slug, year, name, description_md, is_current, scorekeeper_series, created_at, updated_at) VALUES
  ('season_2024', '2024', 2024, '2024 Season',
   'Seven-event Cup season run at the Port of Bellingham lot.',
   0, 'cscc2024', unixepoch(), unixepoch()),
  ('season_2025', '2025', 2025, '2025 Season',
   'Last year at the Port lot before the move to Bellis Fair Mall.',
   0, 'cscc2025', unixepoch(), unixepoch()),
  ('season_2026', '2026', 2026, '2026 Season',
   'First season at our new home — Bellis Fair Mall. Six Cup events plus a season-opening practice day.',
   1, 'cscc2026', unixepoch(), unixepoch());

-- Link every seeded event to the 2026 season (they''re all 2026-dated).
UPDATE events SET season_id = 'season_2026';

-- ---------------------------------------------------------------------------
-- Event ↔ photographer assignments
-- ---------------------------------------------------------------------------
INSERT INTO event_photographers (id, event_id, photographer_id, notes, created_at) VALUES
  ('ep_cup1_a',     'evt_cup1', 'photog_alice', 'Action shots from grid',   unixepoch()),
  ('ep_cup1_b',     'evt_cup1', 'photog_bob',   'Course corners',           unixepoch()),
  ('ep_cup2_a',     'evt_cup2', 'photog_alice', NULL,                       unixepoch()),
  ('ep_cup2_photog_peter', 'evt_cup2', 'photog_peter', 'Full grid album',   unixepoch()),
  ('ep_cup3_b',     'evt_cup3', 'photog_bob',   'Assigned, awaiting event', unixepoch()),
  ('ep_cup5_a',     'evt_cup5', 'photog_alice', NULL,                       unixepoch());

-- ---------------------------------------------------------------------------
-- Members (sample roster)
-- ---------------------------------------------------------------------------
-- Single $30 tier covers the member + an optional same-address family
-- member. Schema migration 0001 seeds `individual` + `family`; we collapse
-- to a single tier here.
UPDATE membership_tiers SET
  name = 'CSCC Membership',
  annual_price_cents = 3000,
  description_md = 'One membership covers you for the full calendar year, **plus a single family member at the same address** at no additional cost.',
  benefits_json = '["Reduced autocross entry fees","Vote in club elections","Eligible for season championship","Optional family member at same address"]',
  visible = 1
WHERE id = 'individual';

-- The Family tier is no longer needed. Re-point any FK-referencing rows first
-- so the DELETE doesn't violate the member_payments / members FKs.
UPDATE members         SET tier_id = 'individual' WHERE tier_id = 'family';
UPDATE member_payments SET tier_id = 'individual' WHERE tier_id = 'family';
DELETE FROM membership_tiers WHERE id = 'family';

INSERT INTO members (id, name, email, phone,
                     address_line1, address_line2, city, state, postal_code,
                     car_info, family_member_name,
                     tier_id, joined_at, expires_at,
                     newsletter_opt_in, created_at, updated_at) VALUES
  ('mbr_jane',  'Jane Doe',    'jane@example.com',  '360-555-0101',
   '142 Lakeway Dr', NULL, 'Bellingham', 'WA', '98229',
   '1999 Mazda Miata', NULL,
   'individual', unixepoch('2022-03-15'), unixepoch('2026-12-31 23:59:59'),
   1, unixepoch(), unixepoch()),

  ('mbr_bob',   'Bob Smith',   'bob@example.com',   '360-555-0102',
   '2710 Smith Rd', 'Apt 3', 'Ferndale', 'WA', '98248',
   '2018 Subaru WRX', 'Marie Smith',
   'individual', unixepoch('2019-01-12'), unixepoch('2026-12-31 23:59:59'),
   1, unixepoch(), unixepoch()),

  ('mbr_carol', 'Carol Lee',   'carol@example.com', '360-555-0103',
   '88 Riverside Pl', NULL, 'Mount Vernon', 'WA', '98273',
   '2003 BMW M3', NULL,
   'individual', unixepoch('2024-06-01'), unixepoch('2025-12-31 23:59:59'),
   1, unixepoch(), unixepoch());

-- ---------------------------------------------------------------------------
-- Member payments (audit history)
-- ---------------------------------------------------------------------------
INSERT INTO member_payments (id, member_id, tier_id, amount_cents, membership_year,
                             stripe_checkout_session_id, paid_at) VALUES
  ('pay_jane_26',  'mbr_jane',  'individual', 3000, 2026, 'cs_test_jane_26',  unixepoch('2026-01-08')),
  ('pay_bob_26',   'mbr_bob',   'individual', 3000, 2026, 'cs_test_bob_26',   unixepoch('2026-01-14')),
  ('pay_carol_25', 'mbr_carol', 'individual', 3000, 2025, 'cs_test_carol_25', unixepoch('2025-02-20'));

-- ---------------------------------------------------------------------------
-- Merch items
-- ---------------------------------------------------------------------------
-- Items mirror chuckanutscc.org/shop. Price isn't a schema column (v1 is
-- request-only, no payment), so it's noted inline in the description.
INSERT INTO merch_items (id, slug, title, description_md, images_json, options_json,
                         available, notes, sort_order, created_at, updated_at) VALUES
  ('mch_hoodie_pullover', 'heavyweight-hoodie', 'Heavyweight Pull-Over Hoodie',
   '**$35**' || char(10) || char(10) || 'Large logo on back, small on front.',
   '[{"r2_key":"shop/hoodie-pullover.jpg","alt":"Heavyweight pull-over hoodie","caption":""}]',
   '[{"name":"Size","choices":["XS","S","M","L","XL","2XL","3XL","4XL"]},' ||
   '{"name":"Color","choices":["Red","Maroon","Heather Gray","Charcoal","Royal Blue","Navy Blue","Goldenrod","White","Black","Dark Green","Brown"]}]',
   1, NULL, 1, unixepoch(), unixepoch()),

  ('mch_hoodie_zip', 'zip-hoodie', 'Full Fleece Zip-Up Hoodie',
   '**$30**' || char(10) || char(10) || 'Large logo on back, small on front.',
   '[{"r2_key":"shop/hoodie-zip.jpg","alt":"Full fleece zip-up hoodie","caption":""}]',
   '[{"name":"Size","choices":["XS","S","M","L","XL","2XL","3XL","4XL"]},' ||
   '{"name":"Color","choices":["Red","Plum","Maroon","Heather Gray","Charcoal","Heather Charcoal","Deep Royal","Navy Blue","Heather Navy","New Navy","Ice Blue","White","Black","Forest Green","Heather Olive","Royal Frost","Heather Oatmeal"]}]',
   1, NULL, 2, unixepoch(), unixepoch()),

  ('mch_crew', 'crew-sweatshirt', 'Crew Sweatshirt',
   '**$28**' || char(10) || char(10) || 'Large logo on back.',
   '[{"r2_key":"shop/crew.jpg","alt":"CSCC crew sweatshirt","caption":""}]',
   '[{"name":"Size","choices":["XS","S","M","L","XL","2XL","3XL","4XL","5XL"]},' ||
   '{"name":"Color","choices":["Red","Maroon","Heather Gray","Heather Charcoal","Heather Gunmetal","Classic Navy","Heather Navy","Royal Blue","Heather Royal","Mint","White","Black","Army","Heather Army","Dark Green","Lavender","Light Pink","Sandstone"]}]',
   1, NULL, 3, unixepoch(), unixepoch()),

  ('mch_tee', 'unisex-tee', 'Unisex T-Shirt',
   '**$16**' || char(10) || char(10) || 'Large logo on back, small on front.',
   '[{"r2_key":"shop/tee.jpg","alt":"Unisex CSCC t-shirt","caption":""}]',
   '[{"name":"Size","choices":["XS","S","M","L","XL","2XL","3XL","4XL","5XL","6XL"]},' ||
   '{"name":"Color","choices":["Red","Maroon","Heather Gray","Charcoal","Royal Blue","Navy Blue","White","Black","Dark Green","Olive"]}]',
   1, NULL, 4, unixepoch(), unixepoch()),

  ('mch_ladies_tee', 'ladies-tee', 'Ladies Tee',
   '**$16**' || char(10) || char(10) || 'Large logo on back, small on front.',
   '[]',
   '[{"name":"Size","choices":["XS","S","M","L","XL","2XL","3XL","4XL"]},' ||
   '{"name":"Color","choices":["Red","Maroon","Heather Gray","Charcoal","Royal Blue","Navy Blue","White","Black","Pink","Lavender"]}]',
   1, NULL, 5, unixepoch(), unixepoch()),

  ('mch_beanie', 'beanie', 'Beanie',
   '**$15**' || char(10) || char(10) || 'One size fits most.',
   '[]',
   '[{"name":"Color","choices":["Grey","Blue"]}]',
   1, NULL, 6, unixepoch(), unixepoch()),

  ('mch_cap', 'baseball-cap', 'Baseball Cap',
   '**$10**' || char(10) || char(10) || 'One size fits most, adjustable strap.',
   '[]',
   '[{"name":"Color","choices":["Red","Black","Green"]}]',
   1, NULL, 7, unixepoch(), unixepoch());

-- ---------------------------------------------------------------------------
-- Merch requests (sample queue, references real items above)
-- ---------------------------------------------------------------------------
INSERT INTO merch_requests (id, item_id, requester_name, requester_email,
                            selections_json, quantity, notes, status,
                            created_at, updated_at) VALUES
  ('req_jane_hoodie', 'mch_hoodie_pullover', 'Jane Doe', 'jane@example.com',
   '{"Size":"L","Color":"Heather Gray"}', 1, 'Saw a friend wearing one — love it.',
   'open', unixepoch(), unixepoch()),

  ('req_bob_cap', 'mch_cap', 'Bob Smith', 'bob@example.com',
   '{"Color":"Black"}', 2, NULL, 'in_next_order', unixepoch(), unixepoch()),

  ('req_carol_tee', 'mch_ladies_tee', 'Carol Lee', 'carol@example.com',
   '{"Size":"M","Color":"Black"}', 1, NULL, 'fulfilled', unixepoch(), unixepoch());

-- ---------------------------------------------------------------------------
-- Newsletter subscribers
-- ---------------------------------------------------------------------------
INSERT INTO newsletter_subscribers (id, email, name, source, subscribed_at, unsubscribe_token) VALUES
  ('sub_jane',  'jane@example.com',  'Jane Doe',     'membership',   unixepoch(), 'tok_jane_unsub'),
  ('sub_bob',   'bob@example.com',   'Bob Smith',    'membership',   unixepoch(), 'tok_bob_unsub'),
  ('sub_carol', 'carol@example.com', 'Carol Lee',    'membership',   unixepoch(), 'tok_carol_unsub'),
  ('sub_dave',  'dave@example.com',  'Dave Patterson','footer-form', unixepoch(), 'tok_dave_unsub'),
  ('sub_erin',  'erin@example.com',  'Erin Walsh',   'footer-form',  unixepoch(), 'tok_erin_unsub');

-- ---------------------------------------------------------------------------
-- Contact form submissions
-- ---------------------------------------------------------------------------
INSERT INTO contact_submissions (id, name, email, subject, message, topic, status, created_at) VALUES
  ('contact_1', 'Frank Liu',  'frank@example.com', 'New driver question',
   'Hi, I just moved to Bellingham and I''m interested in trying autocross. Are there events this summer where I could come watch first before signing up?',
   'membership', 'new', unixepoch() - 86400),
  ('contact_2', 'Sara Kim',   'sara@example.com',  'Photographer interest',
   'I''d love to be added to the photographer rotation for autocross events. Portfolio: sarakim.photo',
   'general', 'responded', unixepoch() - 86400 * 5);

-- ---------------------------------------------------------------------------
-- Homepage: set a hero, auto-pick next upcoming event
-- ---------------------------------------------------------------------------
UPDATE home_page SET
  hero_title = 'Chuckanut Sports Car Club',
  hero_subtitle = 'Promoting the love of motorsports in the beautiful Pacific Northwest since 1956',
  hero_image_key = 'hero/season-2026.jpg',
  hero_cta_text = 'See the 2026 season',
  hero_cta_url = '/events',
  featured_event_mode = 'auto-next',
  updated_at = unixepoch(),
  updated_by = 'seed@localhost'
WHERE id = 1;

-- ---------------------------------------------------------------------------
-- Event hero images (R2 keys, populated by scripts/import-wix-images.sh)
-- ---------------------------------------------------------------------------
UPDATE events SET hero_image_key = 'imports/gallery-1.jpg' WHERE id = 'evt_cup1';
UPDATE events SET hero_image_key = 'imports/gallery-2.jpg' WHERE id = 'evt_cup2';
UPDATE events SET hero_image_key = 'imports/gallery-3.jpg' WHERE id = 'evt_practice';
UPDATE events SET hero_image_key = 'imports/gallery-4.jpg' WHERE id = 'evt_cup3';

-- ---------------------------------------------------------------------------
-- Site settings: branding logo
-- ---------------------------------------------------------------------------
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('logo_key', 'branding/logo.png');
