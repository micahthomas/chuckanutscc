-- One-off production deploy script. Run AFTER `pnpm db:migrate:remote` has
-- applied migration 0008 (which adds the eyebrow/subtitle/hero_*/show_toc/
-- show_print columns to the pages table).
--
-- Idempotent:
-- - INSERT OR IGNORE for the new autocross-rules page (won't clobber if an
--   admin has already edited it through /admin/pages).
-- - UPDATEs on existing rows are safe to re-apply.
-- - The settings UPDATE just rewrites the value each time.
--
-- Apply with:
--   pnpm wrangler d1 execute cscc --remote --file=seeds/deploy/0008_pages_standardization.sql
--
-- After this file is applied, this folder can keep accumulating one-off
-- production data migrations (numbered to match the schema migration that
-- introduced the columns they fill in).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Existing pages: populate the new hero/TOC fields with sensible defaults.
-- These rows already exist in prod; the migration just added empty columns.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- New autocross rules page (slug /autocross-rules).
-- Full 2024 REV1 rulebook body, with TOC + print toggles on.
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO pages (
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
  unixepoch(), unixepoch(), 'deploy@cscc'
);

-- ---------------------------------------------------------------------------
-- Repoint the season rules link from the old Wix PDF to the new internal page.
-- ---------------------------------------------------------------------------

UPDATE settings SET value = '/autocross-rules' WHERE key = 'season_rules_url';
INSERT OR IGNORE INTO settings (key, value) VALUES ('season_rules_url', '/autocross-rules');
