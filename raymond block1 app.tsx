import { useState, useEffect } from "react";

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
const STORAGE_KEY = "raymond_block1_log";
const READINESS_KEY = "raymond_readiness_log";
const WEEK_KEY = "raymond_current_week";

async function saveLog(log) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(log)); } catch {}
}
async function loadLog() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : {};
  } catch { return {}; }
}
async function saveReadiness(log) {
  try { await window.storage.set(READINESS_KEY, JSON.stringify(log)); } catch {}
}
async function loadReadiness() {
  try {
    const r = await window.storage.get(READINESS_KEY);
    return r ? JSON.parse(r.value) : {};
  } catch { return {}; }
}
async function saveWeek(w) {
  try { await window.storage.set(WEEK_KEY, String(w)); } catch {}
}
async function loadWeek() {
  try {
    const r = await window.storage.get(WEEK_KEY);
    return r ? parseInt(r.value) : 1;
  } catch { return 1; }
}

// ─── PHASE LOGIC ──────────────────────────────────────────────────────────────
function getPhase(week) {
  if (week <= 2) return { name: "CALIBRATION", rir: "3–4 RIR", color: "#7B9E87", weeks: "1–2", note: "Movement quality over load. No intensity techniques. Find baseline weights." };
  if (week <= 4) return { name: "LOADING", rir: "2–3 RIR", color: "#C8A96E", weeks: "3–4", note: "True working weights established. Still no intensity techniques." };
  if (week <= 7) return { name: "PROGRESSIVE OVERLOAD", rir: "1–2 RIR", color: "#7A8BAD", weeks: "5–7", note: "Double progression in full effect. Add weight when earned." };
  if (week <= 9) return { name: "INTENSIFICATION", rir: "0–1 RIR (isolation) / 1 RIR (compounds)", color: "#BF7F7F", weeks: "8–9", note: "Intensity techniques available on isolation and machine work ONLY." };
  return { name: "DELOAD", rir: "3–4 RIR", color: "#666", weeks: "10", note: "Volume cut 40–50%. Load at 60–70% of working weight. Recover fully." };
}

// ─── READINESS SCORING ────────────────────────────────────────────────────────
function scoreReadiness(inputs) {
  const { bodyBattery, sleepScore, hrv, restingHR, soreness, motivation } = inputs;
  let score = 0;
  if (bodyBattery >= 70) score += 4; else if (bodyBattery >= 50) score += 3; else if (bodyBattery >= 30) score += 2; else score += 1;
  if (sleepScore >= 76) score += 4; else if (sleepScore >= 60) score += 3; else if (sleepScore >= 45) score += 2; else score += 1;
  const hrvMap = { favorable: 4, balanced: 3, unbalanced: 2, poor: 1 };
  score += hrvMap[hrv] || 2;
  if (restingHR === "at") score += 4; else if (restingHR === "1-3") score += 3; else if (restingHR === "4-6") score += 2; else score += 1;
  const sorenessScore = soreness <= 2 ? 4 : soreness <= 4 ? 3 : soreness <= 6 ? 2 : 1;
  score += sorenessScore;
  const motivationScore = motivation >= 8 ? 4 : motivation >= 6 ? 3 : motivation >= 4 ? 2 : 1;
  score += motivationScore;
  return score;
}

function getReadinessTier(score) {
  if (score >= 20) return { tier: "GREEN", label: "PUSH", color: "#7B9E87", note: "Train exactly as programmed. Green days are productive — don't waste them." };
  if (score >= 15) return { tier: "YELLOW", label: "TRAIN NORMAL", color: "#C8A96E", note: "Add 1 RIR to all sets. No intensity techniques. Skip Friday conditioning finisher." };
  if (score >= 10) return { tier: "ORANGE", label: "REDUCE", color: "#E09B50", note: "Cut one set per exercise. Add 1–2 RIR. No top sets. Skip conditioning finisher. If Orange 3x in 7 days — deload immediately." };
  return { tier: "RED", label: "REST", color: "#C85050", note: "Do not train. Zone 2 only — 20–30 min easy walk or bike. No session is worth having at this score." };
}

// ─── SESSION DATA ─────────────────────────────────────────────────────────────
const SESSIONS = {
  MON: {
    day: "MON", fullDay: "MONDAY", focus: "CHEST + TRICEPS", subtitle: "Push 1", color: "#BF7F7F",
    recoveryDemand: "MODERATE", sauna: true,
    warmup: [
      "Athletic Primer: Broad Jump — 3 x 3 reps (load hips, jump for max distance, land soft)",
      "Stationary bike — 2 min easy",
      "Band pull-aparts — 2 x 20 reps",
      "Pec deck or cable crossover primer — 2 x 15 reps, very light",
      "Arm circles and shoulder rolls",
    ],
    exercises: [
      { id: "mon_01", number: "01", tier: "PRIMARY COMPOUND", name: "Barbell Incline Press", preferred: true, alt: "Smith Machine Incline Press (30–45°)", feeders: "3 Sets: 45% x 6–10 | 65% x 4–6 | 85% x 3–4", sets: 4, repRange: "8–12", rir: "per phase", rest: "2–3 min", notes: "2–3 second eccentric. Touch bar to upper chest. Stop short of lockout to maintain tension. Focus on upper chest driving the press. Back pinned to pad — do not arch aggressively. The free barbell allows a more natural pressing arc and deeper stretch than Smith machine.", spineFlag: null },
      { id: "mon_02", number: "02", tier: "SECONDARY COMPOUND", name: "Incline DB Press", preferred: true, alt: "Hammer Strength Plate-Loaded Flat Press (alternate weekly with Smith Machine Flat Bench)", feeders: "2 Sets: 50% x 6–10 | 70% x 4–6", sets: 3, repRange: "10–15", rir: "per phase", rest: "90 sec", notes: "Work into the 80–100 lb range progressively as strength builds — no ceiling here. Elbows at 45–60 degrees. Full stretch at the bottom, press through the center of the chest. No longer capped at 75 lbs. This is the CBum primary chest compound.", spineFlag: null },
      { id: "mon_03", number: "03", tier: "ISOLATION", name: "Cable Crossover (low-to-high or mid)", preferred: false, alt: null, feeders: "1 Set: 60% x 6–10", sets: 3, repRange: "12–15", rir: "per phase", rest: "60–75 sec", notes: "Squeeze hard at contraction. Control the return. The stretch at the bottom is where the growth signal lives — do not rush through it.", spineFlag: null },
      { id: "mon_04", number: "04", tier: "ISOLATION", name: "Pec Deck / Machine Fly", preferred: false, alt: null, feeders: null, sets: 3, repRange: "15–20", rir: "per phase", rest: "60 sec", notes: "Constant tension. Stop just before full adduction — do not crash the handles together at end range. Your thoracic involvement makes the end range position a real concern.", spineFlag: "T9-T11: Stop before full adduction on every rep." },
      { id: "mon_05", number: "05", tier: "SUPERSET — TRICEPS", name: "Rope Pushdown / Overhead Cable Extension", preferred: false, alt: "If cervical discomfort on 5b: Lying Cable Extension or DB Skull Crusher", feeders: null, sets: 3, repRange: "15–20 / 12–15", rir: "per phase", rest: "60 sec between rounds", notes: "Rotate immediately from 5a to 5b. On the overhead cable extension, the long head is fully stretched — strongest hypertrophy stimulus for the tricep. Monitor C6-C7 on the overhead position specifically.", spineFlag: "C6-C7: Monitor overhead position. Switch to alternative if any cervical discomfort." },
      { id: "mon_06", number: "06", tier: "SUPERSET — CORE", name: "Dead Bug / Pallof Press", preferred: false, alt: null, feeders: null, sets: 3, repRange: "8–10 per side / 10–12 per side", rir: "controlled", rest: "45 sec between rounds", notes: "Dead bug: lower back must stay flat against the floor throughout. If it lifts, shorten the range. Pallof press: 2-second hold at full extension. These are spinal stability drills for L3-S1 — quality over reps.", spineFlag: null },
    ],
    finisher: { name: "Cable Fly Pump Finisher", duration: "8 MIN", protocol: "4 x 15–20 cable crossovers or pec deck, 30 sec rest. Final set to failure.", notes: "Hany Rambod FST-7 approach — high rep, pump-focused, fascia stretch on every rep. The goal is maximum pump to end the chest session, creating the mechanical tension on the fascia that contributes to the full, round chest CBum is known for. Use a weight you can control for the full range.", influence: "Hany Rambod — FST-7 Pump Finisher" },
    sauna: { timing: "POST-SESSION", protocol: "15–20 min. Hydrate before entering.", rationale: "Monday post-session sauna kicks the week off with cardiovascular adaptation stimulus on top of the training effect. Attia's plasma volume expansion and Huberman's post-training growth hormone window both apply here. You're not going into another training session until Tuesday — the recovery window supports it.", influence: "Attia + Huberman" },
    cooldown: "Light chest and shoulder stretch 60 sec per side. Band pull-aparts x 20. Then sauna.",
  },

  TUE: {
    day: "TUE", fullDay: "TUESDAY", focus: "BACK + BICEPS", subtitle: "Pull 1 — Thickness", color: "#C8A96E",
    recoveryDemand: "MODERATE", sauna: true,
    warmup: [
      "Band pull-aparts — 2 x 20 reps",
      "Scapular wall slides — 2 x 10 reps",
      "Face pull primer — 2 x 15 reps, very light",
      "Light seated cable row — 1 x 15 reps, minimal weight",
    ],
    exercises: [
      { id: "tue_01", number: "01", tier: "PRIMARY COMPOUND", name: "Chest-Supported T-Bar Row", preferred: true, alt: "Hammer Strength MDX Row (odd weeks) / Chest-Supported High Row (even weeks)", feeders: "3 Sets: 45% x 6–10 | 65% x 4–6 | 85% x 3–4", sets: 4, repRange: "10–15", rir: "per phase", rest: "2–3 min", notes: "Pull to the lower chest. Full shoulder blade protraction at the bottom before every rep — this is where the lat stretch lives. The T-bar with a chest pad removes the lumbar entirely and allows heavier loading than any Hammer Strength equivalent. Do not substitute a bent-over barbell row.", spineFlag: null },
      { id: "tue_02", number: "02", tier: "SECONDARY COMPOUND", name: "Weighted Pull-Ups", preferred: true, alt: "Lat Pulldown — dual handles, neutral grip", feeders: "Bodyweight only Weeks 1–2. Add load from Week 3 if cervical spine is asymptomatic.", sets: 3, repRange: "6–10", rir: "per phase", rest: "2 min", notes: "Dead hang at the bottom — full overhead stretch, no half reps. Pull until chin clears the bar. If lat pulldown is used: dual handles, neutral grip, full overhead stretch, pull to upper chest, control the return.", spineFlag: "Monitor C6-C7 every session. Any radiating symptoms — revert to lat pulldown immediately. Log every session." },
      { id: "tue_03", number: "03", tier: "SECONDARY COMPOUND", name: "Single-Arm Dumbbell Row", preferred: false, alt: null, feeders: "2 Sets: 50% x 6–10 | 70% x 4–6", sets: 3, repRange: "10–15", rir: "per phase", rest: "60 sec between arms", notes: "Support hand and knee on bench. Pull elbow toward the hip. Full stretch at the bottom every rep. Work into the 80–100+ lb range progressively. No ceiling.", spineFlag: null },
      { id: "tue_04", number: "04", tier: "MANDATORY", name: "Cable Face Pull", preferred: false, alt: null, feeders: null, sets: 3, repRange: "15–20", rir: "1 RIR always", rest: "60 sec", notes: "Rope at forehead height or above. Pull hands to beside the ears, rotate wrists outward at end range. Non-negotiable every session. T9-T11 and C6-C7 structural maintenance.", spineFlag: null },
      { id: "tue_05", number: "05", tier: "ISOLATION", name: "Reverse Incline DB Reverse Fly", preferred: false, alt: null, feeders: null, sets: 3, repRange: "15–20", rir: "per phase", rest: "60 sec", notes: "Bench at 30–45 degrees, lie face-down, chest against pad. Fly out to sides until upper arms parallel to floor. Spine fully supported. Light weight — the rear delt does not need heavy loading.", spineFlag: null },
      { id: "tue_06", number: "06", tier: "SUPERSET — BICEPS", name: "Incline DB Curl / Hammer Curl", preferred: false, alt: null, feeders: null, sets: 3, repRange: "10–12 / 12–15", rir: "per phase", rest: "60 sec between rounds", notes: "Incline DB curl: bench at 45–60 degrees. Full stretch at the bottom of every rep. Rotate immediately to hammer curls with no rest.", spineFlag: null },
    ],
    finisher: { name: "Straight-Arm Pulldown Pump Finisher", duration: "8–10 MIN", protocol: "4 x 15–20, 30 sec rest. Final set to failure. Cable, bar or rope.", notes: "Isolates the lats completely, removes bicep involvement. Push your hands toward the floor, not pull them. Straight Hany Rambod FST-7 philosophy — the pump and fascial stretch finishing a back session builds lat width and sweep over time. Alternative if cable is occupied: DB pullover on a flat bench, same scheme.", influence: "Hany Rambod — FST-7 Lat Pump" },
    sauna: { timing: "POST-SESSION", protocol: "15–20 min. Two 8–10 min rounds with a 3–5 min cool break if preferred.", rationale: "Tuesday is moderate recovery demand going into Wednesday legs. Attia's cardiovascular adaptation and Huberman's GH release window both apply. For your spinal pathology specifically, heat reduces systemic inflammation and relaxes paraspinal musculature. This is a net positive on recovery.", influence: "Attia (cardiovascular adaptation) + Huberman (GH release, inflammation)" },
    cooldown: "Light band pull-aparts x 20. Thoracic foam roller extension — 2 min, gentle. Then sauna.",
  },

  WED: {
    day: "WED", fullDay: "WEDNESDAY", focus: "LEGS + CORE", subtitle: "Posterior Chain Priority", color: "#7B9E87",
    recoveryDemand: "HIGH", sauna: false,
    saunaNote: "NO SAUNA. Highest recovery demand session of the week. Heat exposure post-legs adds thermal and cardiovascular stress to an already taxed system. Huberman's data shows blunted recovery when sauna follows high-volume leg training. Wednesday recovery is sleep, food, and hydration — nothing else.",
    warmup: [
      "Athletic Primer: Lateral Bound — 3 x 5 per side (before warm-up sets)",
      "Stationary bike — 3 min easy",
      "Banded clamshells — 2 x 15 per side",
      "Leg swings front-to-back and lateral — 2 x 10 each direction",
      "Hip circles — 2 x 10 per side",
      "Bodyweight squat pattern — 2 x 10 (assess hip and lumbar comfort)",
    ],
    exercises: [
      { id: "wed_01", number: "01", tier: "PRIMARY COMPOUND", name: "Belt Squat", preferred: true, alt: "Leg Press — shoulder-width, toes out 10–15°, stop before lower back peels off pad", feeders: "3 Sets: 45% x 6–10 | 65% x 4–6 | 85% x 3–4", sets: 4, repRange: "10–15", rir: "per phase", rest: "2–3 min", notes: "Zero axial spinal compression — load hangs from the hips entirely. Full squat depth to wherever the hips and knees allow without lumbar rounding. Drive through the floor. The single best piece of equipment for your lower body given L3-S1.", spineFlag: null },
      { id: "wed_02", number: "02", tier: "SECONDARY COMPOUND", name: "Hack Squat", preferred: false, alt: "DB Reverse Lunges — step backward, rear knee toward floor, torso upright", feeders: "2 Sets: 50% x 6–10 | 70% x 4–6", sets: 3, repRange: "10–15", rir: "per phase", rest: "90 sec", notes: "Two machines confirmed. Machine provides back support — use it. Do not allow lower back to round at the bottom. Stop depth where lumbar stays flat against the pad.", spineFlag: null },
      { id: "wed_03", number: "03", tier: "ISOLATION", name: "Seated Leg Curl", preferred: false, alt: "Lying Leg Curl — same RPE targets, 2-second eccentric", feeders: "1 Set: 60% x 6–10", sets: 3, repRange: "12–15", rir: "per phase", rest: "90 sec", notes: "Seated version preferred — hamstring in a lengthened position at the start of every rep. Superior hypertrophy stimulus. 2-second eccentric on the return.", spineFlag: null },
      { id: "wed_04", number: "04", tier: "ISOLATION", name: "Leg Extension", preferred: false, alt: null, feeders: null, sets: 3, repRange: "15–20", rir: "per phase", rest: "60–75 sec", notes: "Terminal extension at the top — full knee extension and hard squeeze. Do not drop the weight on the eccentric.", spineFlag: null },
      { id: "wed_05", number: "05", tier: "POSTERIOR CHAIN", name: "Cable Pull-Through", preferred: false, alt: "45-Degree Back Extension — bodyweight or light plate, hip hinge, spine neutral", feeders: "1 Set: 60% x 6–10", sets: 3, repRange: "12–15", rir: "per phase", rest: "60–75 sec", notes: "Stand facing away from cable, cable between legs. Hinge at the hip — not a squat. Push hips forward to lockout. Spine neutral throughout. One of the most spine-safe posterior chain patterns available.", spineFlag: null },
      { id: "wed_06", number: "06", tier: "CONDITIONAL — MONITOR CLOSELY", name: "Light RDL", preferred: false, alt: "Additional set of Seated Leg Curl if any discomfort", feeders: "2 Sets: 50% x 6–10 | 70% x 4–6", sets: 3, repRange: "10–12", rir: "RPE 5–6 MAX", rest: "90 sec", notes: "Permanently capped at RPE 5–6. Four to five reps in the tank at all times. Posterior chain stretch movement, not a strength movement. Any sharp, radiating, or unusual pain — remove immediately. Log pain responses every session.", spineFlag: "HARD CAP: RPE 5–6 always. L3-S1 makes this non-negotiable regardless of how good you feel." },
      { id: "wed_07", number: "07", tier: "ISOLATION", name: "Standing Calf Raise", preferred: false, alt: "Seated Calf Raise", feeders: null, sets: 4, repRange: "15–20", rir: "per phase", rest: "45 sec", notes: "Full stretch at the bottom, hard squeeze at the top. Do not bounce.", spineFlag: null },
      { id: "wed_08", number: "08", tier: "SUPERSET — CORE", name: "Plank / Bird Dog", preferred: false, alt: null, feeders: null, sets: 3, repRange: "30–45 sec / 8 per side", rir: "controlled", rest: "During calf raise rest periods", notes: "Plank: no hip sagging or pike. Bird dog: slow, lumbar neutral throughout. L3-S1 spinal stability drills. Executed correctly these matter. Executed sloppy they are worthless.", spineFlag: null },
    ],
    finisher: { name: "Sled Superset — Quad Flush", duration: "10–12 MIN", protocol: "4 rounds: Sled Push x 20m + Sled Drag (facing sled) x 20m. 90 sec rest between rounds. Moderate load.", notes: "The sled finisher post-legs serves a specific purpose — it flushes lactate from the quads and hamstrings with zero eccentric loading, which means it accelerates recovery rather than adding damage. No eccentric means almost zero additional DOMS. SOFlete programs sled work exactly this way post-leg session. If your lower back is talking after the main session, skip the finisher and log it. No ego.", influence: "SOFlete / Dana Linn Bailey — Metabolic Flush + Work Capacity" },
    cooldown: "Hip flexor stretch 90 sec per side. Quad stretch 60 sec per side. Light walk 2 min. If running long — cut one set of RDL and one set of calves before cutting the finisher.",
  },

  THU: {
    day: "THU", fullDay: "THURSDAY", focus: "SHOULDERS + TRICEPS", subtitle: "Push 2", color: "#7A8BAD",
    recoveryDemand: "MODERATE", sauna: true,
    warmup: [
      "Band pull-aparts — 2 x 20 reps",
      "Wall slides — 2 x 10 reps",
      "Face pull primer — 2 x 15 reps, light",
      "Light lateral raise — 2 x 15 reps, very light",
    ],
    exercises: [
      { id: "thu_01", number: "01", tier: "PRIMARY COMPOUND", name: "Seated Barbell OHP (Power Rack)", preferred: true, alt: "Seated Smith Machine OHP — back against pad, same targets", feeders: "3 Sets: 45% x 6–10 | 65% x 4–6 | 85% x 3–4", sets: 4, repRange: "10–15", rir: "per phase", rest: "2–3 min", notes: "Seated, back supported. Free barbell allows a more natural pressing path than Smith. Stop 90% to lockout — do not lock out. Never press standing given C6-C7.", spineFlag: "Monitor C6-C7. Seated and supported always — no standing press ever. Switch to alternative if cervical symptoms appear." },
      { id: "thu_02", number: "02", tier: "ISOLATION", name: "Dumbbell Lateral Raise", preferred: false, alt: null, feeders: "1 Set: 60% x 6–10", sets: 4, repRange: "15–20", rir: "per phase", rest: "60–75 sec", notes: "Slight forward lean. Lead with elbows. Pinky rises slightly higher than thumb at the top. No shrugging. 2-second eccentric. The lateral delt does not respond to ego weight.", spineFlag: null },
      { id: "thu_03", number: "03", tier: "ISOLATION", name: "Cable Lateral Raise (single arm, hip level)", preferred: false, alt: "Machine Lateral Raise", feeders: null, sets: 3, repRange: "15–20 per arm", rir: "per phase", rest: "45 sec between arms", notes: "Superior constant tension — resistance stays loaded at the bottom where DBs go slack. Execute immediately after DB raises to fully fatigue the lateral delt.", spineFlag: null },
      { id: "thu_04", number: "04", tier: "MANDATORY", name: "Cable Face Pull", preferred: false, alt: null, feeders: null, sets: 3, repRange: "15–20", rir: "1 RIR always", rest: "60 sec", notes: "Identical to Tuesday. Non-negotiable. Every session.", spineFlag: null },
      { id: "thu_05", number: "05", tier: "ISOLATION", name: "Reverse Incline DB Reverse Fly", preferred: false, alt: null, feeders: null, sets: 3, repRange: "15–20", rir: "per phase", rest: "60 sec", notes: "Identical to Tuesday. Two rear delt sessions per week is the structural requirement given push volume and thoracic involvement.", spineFlag: null },
      { id: "thu_06", number: "06", tier: "SUPERSET — TRICEPS", name: "Rope Pushdown / Single-Arm Overhead DB Extension", preferred: false, alt: "Lying Cable Extension or EZ-Bar Skull Crusher if cervical discomfort", feeders: null, sets: 3, repRange: "15–20 / 10–15", rir: "per phase", rest: "60 sec between rounds", notes: "Rotate immediately. Overhead extension fully stretches the long head — most effective tricep hypertrophy movement. Monitor C6-C7 on 6b.", spineFlag: "C6-C7: Switch to alternative immediately if symptomatic." },
      { id: "thu_07", number: "07", tier: "OPTIONAL — TIME PERMITTING", name: "Cable Curl", preferred: false, alt: null, feeders: null, sets: 2, repRange: "15–20", rir: "per phase", rest: "45 sec", notes: "Only if time allows. Constant tension makes this a strong bicep finisher even at low volume.", spineFlag: null },
    ],
    finisher: { name: "Giant Set — Lateral Delt Annihilation", duration: "8–10 MIN", protocol: "3 rounds, no rest between movements, 90 sec between rounds: A) DB Lateral Raise x 15 / B) Cable Lateral Raise x 15 per arm / C) Machine Lateral Raise x 20 to failure", notes: "CBum-style shoulder finisher — three angles, no rest, high rep. The lateral head is the primary muscle responsible for the wide-shoulder taper that defines classic physique. Use weights lighter than working sets. By round 3 the burn should be significant and the pump visible. Hany Rambod fascia stretch training — the pump creates mechanical tension that contributes to the full, rounded shoulder look over time.", influence: "CBum (lateral delt width) + Hany Rambod FST-7" },
    sauna: { timing: "POST-SESSION", protocol: "15–20 min. Best sauna day of the three — heading into Friday with no training until Sunday.", rationale: "Thursday post-session sauna hits differently because you're going into the longest recovery window of the week. Two sauna sessions per week — Tuesday and Thursday — hits Attia's minimum for measurable cardiovascular adaptation. The psychological decompression Huberman documents is worth naming: last hard session of the training week. The sauna is the transition between training mode and recovery mode.", influence: "Attia (weekly frequency target) + Huberman (psychological recovery)" },
    cooldown: "Band pull-aparts x 20. Gentle neck rolls — no cervical loading. Light shoulder stretch 60 sec per side. Then sauna.",
  },

  FRI: {
    day: "FRI", fullDay: "FRIDAY", focus: "BACK + BICEPS + CONDITIONING", subtitle: "Pull 2 — Width", color: "#9B7FBF",
    recoveryDemand: "MODERATE-HIGH", sauna: false,
    saunaNote: "NO SAUNA after Friday. The conditioning finisher elevates core temperature and heart rate — adding sauna on top creates excessive cardiovascular and thermal load going into Saturday rest. Let Saturday do its job.",
    warmup: [
      "Athletic Primer: Reactive Step — 3 x 5 per side (step forward explosively, stabilize on one leg)",
      "Band pull-aparts — 2 x 20 reps",
      "Scapular retractions — 2 x 10, standing, no weight",
      "Face pull primer — 2 x 15 reps, light",
      "Gentle cat-cow on hands and knees — 2 x 10, slow",
    ],
    exercises: [
      { id: "fri_01", number: "01", tier: "PRIMARY COMPOUND", name: "Weighted Pull-Ups", preferred: true, alt: "Lat Pulldown — dual handles, neutral grip", feeders: "3 Sets: 45% x 6–10 | 65% x 4–6 | 85% x 3–4", sets: 4, repRange: "6–10", rir: "per phase", rest: "2 min", notes: "Different emphasis than Tuesday — Friday pull-ups target lat width and sweep through a slightly fresher CNS state. Dead hang at bottom. Add load from Week 3 if cervical spine is asymptomatic. This is the foundational vertical pull for V-taper development.", spineFlag: "Monitor C6-C7. Revert to lat pulldown if any radiating symptoms. Log every session." },
      { id: "fri_02", number: "02", tier: "ISOLATION", name: "Straight-Arm Pulldown (cable, bar or rope)", preferred: false, alt: "DB Pullover on flat bench, same rep scheme", feeders: "1 Set: 60% x 6–10", sets: 3, repRange: "12–15", rir: "per phase", rest: "75 sec", notes: "Slight bend in elbows throughout. Push hands toward the floor — do not think about pulling. Isolates the lats, removes bicep entirely. This builds the lat width and sweep that creates the V-taper. The lat should contract fully at the bottom.", spineFlag: null },
      { id: "fri_03", number: "03", tier: "SECONDARY COMPOUND", name: "Single-Arm Dumbbell Row", preferred: false, alt: null, feeders: "2 Sets: 50% x 6–10 | 70% x 4–6", sets: 3, repRange: "10–15 per arm", rir: "per phase", rest: "60 sec between arms", notes: "Support hand and knee on bench. Pull elbow toward the hip. Full stretch at the bottom. Heavy dumbbell range available — use it progressively.", spineFlag: null },
      { id: "fri_04", number: "04", tier: "SECONDARY COMPOUND", name: "Seated Cable Row (wide grip or V-bar)", preferred: false, alt: null, feeders: "2 Sets: 50% x 6–10 | 70% x 4–6", sets: 3, repRange: "12–15", rir: "per phase", rest: "75 sec", notes: "Different grip than Tuesday — complementary stimulus. Neutral spine throughout. Do not hyperextend the lumbar at the contracted position.", spineFlag: null },
      { id: "fri_05", number: "05", tier: "MANDATORY", name: "Cable Face Pull", preferred: false, alt: null, feeders: null, sets: 3, repRange: "15–20", rir: "1 RIR always", rest: "60 sec", notes: "Non-negotiable. Every session. Every block.", spineFlag: null },
      { id: "fri_06", number: "06", tier: "SUPERSET — BICEPS", name: "Incline DB Curl / Reverse Curl", preferred: false, alt: null, feeders: null, sets: 3, repRange: "10–12 / 12–15", rir: "per phase", rest: "60 sec between rounds", notes: "Incline DB curl: bench at 45–60 degrees, full stretch at the bottom. Reverse curl targets the brachialis and brachioradialis — complementary to Tuesday's hammer curl. Rotate immediately.", spineFlag: null },
    ],
    finisher: { name: "Sled Conditioning — Zone 3 Work Capacity", duration: "15–20 MIN", protocol: "4–6 rounds: Sled Push x 30m at moderate-hard effort, walk back to start (90 sec recovery). HR target 130–145 bpm. Adjust sled load to maintain that zone.", notes: "The sled is the preferred conditioning tool on Friday because it produces significant metabolic demand with zero eccentric loading — meaning it doesn't add meaningful muscle damage on top of the back session you just completed. Zone 3 target keeps the cardiovascular engine running without redlining it on a lifting day. This is Block 1 maintenance conditioning, not Block 3 intensity — the goal is to keep the engine from backsliding, not max it out. If readiness is Yellow or below, substitute stationary bike 15 min at 130–145 bpm. If Orange, skip entirely.", influence: "SOFlete / Nick Bare — Hybrid Conditioning Maintenance" },
    cooldown: "3 min easy walk. Light back and bicep stretching. No sauna today.",
  },

  SUN: {
    day: "SUN", fullDay: "SUNDAY", focus: "ZONE 2 CARDIO", subtitle: "Aerobic Foundation", color: "#888",
    recoveryDemand: "LOW", sauna: false,
    saunaNote: "OPTIONAL SAUNA on Sunday — if you feel good after Zone 2 and you haven't hit two sauna sessions this week, this is a low-stakes opportunity. Keep it to one round, 15 min. Sunday is recovery, not performance.",
    warmup: ["Light 5 min walk to ease into Zone 2 pace"],
    exercises: [
      { id: "sun_01", number: "01", tier: "ZONE 2 SESSION", name: "Lap Pool Swim", preferred: true, alt: "Stationary Bike — 60–70% max HR (112–130 bpm)", feeders: null, sets: 1, repRange: "45–60 min", rir: "conversational pace", rest: "continuous", notes: "Swimming is the most spine-friendly Zone 2 modality available. Gravitational compression is eliminated entirely in water. Attia's longevity framework prioritizes this for your injury history. Pace should allow full conversation without gasping — if you can't talk, slow down. Block 1 target: 45–60 min. Build toward 90 min by Block 3.", spineFlag: null },
    ],
    finisher: null,
    cooldown: "5 min easy walk. Garmin post-session check: Training Effect should read 'Basic Aerobic' or 'Improving Aerobic.' If it reads 'Anaerobic' — you went too hard.",
  },
};

const DAY_ORDER = ["MON","TUE","WED","THU","FRI","SUN"];

// ─── DOUBLE PROGRESSION LOGIC ─────────────────────────────────────────────────
function parseRepRange(range) {
  const m = range.match(/(\d+)[–\-](\d+)/);
  if (!m) return { min: 0, max: 0 };
  return { min: parseInt(m[1]), max: parseInt(m[2]) };
}

function checkDoubleProgression(sets, repRange) {
  const { max } = parseRepRange(repRange);
  if (!sets || sets.length === 0) return null;
  const completed = sets.filter(s => s.reps && s.weight);
  if (completed.length === 0) return null;
  const allAtMax = completed.every(s => parseInt(s.reps) >= max);
  const lastRIR = completed[completed.length - 1].rir;
  if (allAtMax && lastRIR && parseInt(lastRIR) >= 1) {
    return "ADD WEIGHT";
  }
  return null;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("session"); // session | readiness | tracker
  const [activeDay, setActiveDay] = useState("MON");
  const [expandedEx, setExpandedEx] = useState(null);
  const [showFinisher, setShowFinisher] = useState(false);
  const [showSauna, setShowSauna] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [sessionLog, setSessionLog] = useState({});
  const [readinessLog, setReadinessLog] = useState({});
  const [readinessInputs, setReadinessInputs] = useState({ bodyBattery: 70, sleepScore: 75, hrv: "favorable", restingHR: "at", soreness: 2, motivation: 8 });
  const [todayReadiness, setTodayReadiness] = useState(null);
  const [activeLogExId, setActiveLogExId] = useState(null);
  const [logInputs, setLogInputs] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [log, rLog, week] = await Promise.all([loadLog(), loadReadiness(), loadWeek()]);
      setSessionLog(log);
      setReadinessLog(rLog);
      setCurrentWeek(week);
      setLoaded(true);
    })();
  }, []);

  const session = SESSIONS[activeDay];
  const phase = getPhase(currentWeek);

  const today = new Date().toDateString();
  const todayKey = `${activeDay}_w${currentWeek}_${today}`;

  function getExerciseLog(exId) {
    return sessionLog[`${exId}_w${currentWeek}`] || [];
  }

  async function logSet(exId, setIndex, field, value) {
    const key = `${exId}_w${currentWeek}`;
    const current = sessionLog[key] || [];
    const updated = [...current];
    if (!updated[setIndex]) updated[setIndex] = {};
    updated[setIndex][field] = value;
    const newLog = { ...sessionLog, [key]: updated };
    setSessionLog(newLog);
    await saveLog(newLog);
  }

  async function handleWeekChange(w) {
    setCurrentWeek(w);
    await saveWeek(w);
  }

  async function handleReadinessSubmit() {
    const score = scoreReadiness(readinessInputs);
    const tier = getReadinessTier(score);
    const entry = { score, tier: tier.tier, label: tier.label, date: today, inputs: readinessInputs };
    const newLog = { ...readinessLog, [today]: entry };
    setReadinessLog(newLog);
    setTodayReadiness({ score, tier });
    await saveReadiness(newLog);
  }

  const tierColors2 = {
    "PRIMARY COMPOUND": "#C8A96E",
    "SECONDARY COMPOUND": "#9B7FBF",
    "MANDATORY": "#E06B6B",
    "ISOLATION": "#6B9BE0",
    "POSTERIOR CHAIN": "#7B9E87",
    "CONDITIONAL — MONITOR CLOSELY": "#E09B6B",
    "SUPERSET — BICEPS": "#6BBFE0",
    "SUPERSET — CORE": "#6BBFE0",
    "SUPERSET — TRICEPS": "#6BBFE0",
    "ZONE 2 SESSION": "#888",
    "OPTIONAL — TIME PERMITTING": "#555",
  };

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "Georgia, serif", letterSpacing: "3px", fontSize: "11px", textTransform: "uppercase" }}>
      Loading...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#E8E4DC", fontFamily: "Georgia, 'Times New Roman', serif", paddingBottom: "80px" }}>

      {/* ── TOP NAV ── */}
      <div style={{ background: "#080808", borderBottom: "1px solid #1A1A1A", padding: "20px 20px 0", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "14px" }}>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "4px", color: "#333", textTransform: "uppercase", marginBottom: "3px" }}>AmFam Swift Creek</div>
            <div style={{ fontSize: "15px", fontWeight: "bold", letterSpacing: "2px", color: "#E8E4DC", textTransform: "uppercase" }}>Block 1 — Hypertrophy</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9px", color: "#333", letterSpacing: "2px", textTransform: "uppercase" }}>Week</div>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              {[...Array(10)].map((_, i) => (
                <div key={i} onClick={() => handleWeekChange(i + 1)} style={{
                  width: "18px", height: "18px", borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center",
                  background: currentWeek === i + 1 ? phase.color : "#111",
                  border: `1px solid ${currentWeek === i + 1 ? phase.color : "#222"}`,
                  color: currentWeek === i + 1 ? "#0A0A0A" : "#333",
                  fontSize: "9px", fontWeight: "bold", cursor: "pointer",
                }}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Phase badge */}
        <div style={{ background: "#0D0D0D", border: `1px solid ${phase.color}33`, borderLeft: `3px solid ${phase.color}`, borderRadius: "3px", padding: "7px 12px", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "8px", letterSpacing: "2px", color: phase.color, textTransform: "uppercase" }}>{phase.name} — WKS {phase.weeks}</div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{phase.rir}</div>
            </div>
            <div style={{ fontSize: "10px", color: "#444", maxWidth: "160px", textAlign: "right", lineHeight: 1.4 }}>{phase.note}</div>
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #1A1A1A" }}>
          {[["session","SESSION"],["readiness","READINESS"],["tracker","TRACKER"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: "10px 4px",
              background: "transparent",
              border: "none",
              borderBottom: view === v ? `2px solid ${phase.color}` : "2px solid transparent",
              color: view === v ? phase.color : "#444",
              fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase",
              cursor: "pointer", fontFamily: "Georgia, serif",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          VIEW: SESSION
      ══════════════════════════════════════════════════ */}
      {view === "session" && (
        <div>
          {/* Day selector */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #141414", display: "flex", gap: "6px" }}>
            {DAY_ORDER.map(d => (
              <button key={d} onClick={() => { setActiveDay(d); setExpandedEx(null); setShowFinisher(false); setShowSauna(false); setActiveLogExId(null); }} style={{
                flex: 1, padding: "8px 2px",
                background: activeDay === d ? SESSIONS[d].color : "transparent",
                border: `1px solid ${activeDay === d ? SESSIONS[d].color : "#222"}`,
                borderRadius: "3px",
                color: activeDay === d ? "#0A0A0A" : "#444",
                fontSize: "9px", fontWeight: activeDay === d ? "bold" : "normal",
                letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer",
                fontFamily: "Georgia, serif",
              }}>{d}</button>
            ))}
          </div>

          {/* Session header */}
          <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid #141414" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: session.color, letterSpacing: "1px", lineHeight: 1.1 }}>{session.focus}</div>
                <div style={{ fontSize: "11px", color: "#555", letterSpacing: "1px", marginTop: "3px", fontStyle: "italic" }}>{session.subtitle}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "9px", color: "#333", letterSpacing: "2px", textTransform: "uppercase" }}>{session.recoveryDemand}</div>
                {session.sauna && <div style={{ fontSize: "9px", color: "#E09B50", letterSpacing: "1px", marginTop: "3px", textTransform: "uppercase" }}>SAUNA ✓</div>}
              </div>
            </div>
          </div>

          {/* Warmup */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #111" }}>
            <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#333", textTransform: "uppercase", marginBottom: "10px" }}>Warm-Up</div>
            {session.warmup.map((item, i) => (
              <div key={i} style={{ fontSize: "12px", color: "#666", padding: "4px 0", borderBottom: i < session.warmup.length - 1 ? "1px solid #0F0F0F" : "none", lineHeight: 1.4 }}>{item}</div>
            ))}
          </div>

          {/* Exercises */}
          <div style={{ padding: "0 20px" }}>
            {session.exercises.map((ex, i) => {
              const isExpanded = expandedEx === i;
              const exLog = getExerciseLog(ex.id);
              const progression = checkDoubleProgression(exLog, ex.repRange);
              const tierColor = tierColors2[ex.tier] || "#555";
              const isLogging = activeLogExId === ex.id;
              const numSets = typeof ex.sets === "number" ? ex.sets : 3;

              return (
                <div key={i} style={{ borderBottom: "1px solid #111" }}>
                  <div onClick={() => { setExpandedEx(isExpanded ? null : i); setActiveLogExId(null); }} style={{ padding: "15px 0", cursor: "pointer", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "10px", color: "#252525", fontWeight: "bold", minWidth: "20px", paddingTop: "2px" }}>{ex.number}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "8px", letterSpacing: "2px", color: tierColor, textTransform: "uppercase", marginBottom: "4px" }}>{ex.tier}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "5px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "bold", color: "#E8E4DC", lineHeight: 1.2 }}>{ex.name}</div>
                        {ex.preferred && <div style={{ fontSize: "7px", letterSpacing: "2px", color: "#0A0A0A", background: session.color, padding: "2px 5px", borderRadius: "2px", fontWeight: "bold", textTransform: "uppercase" }}>PREFERRED</div>}
                        {progression && <div style={{ fontSize: "7px", letterSpacing: "2px", color: "#0A0A0A", background: "#7B9E87", padding: "2px 5px", borderRadius: "2px", fontWeight: "bold", textTransform: "uppercase" }}>↑ ADD WEIGHT</div>}
                      </div>
                      <div style={{ fontSize: "11px", color: "#555" }}>{ex.sets} sets · {ex.repRange} · Rest: {ex.rest}</div>
                      {ex.alt && <div style={{ fontSize: "10px", color: "#333", marginTop: "4px", fontStyle: "italic" }}>Alt: {ex.alt}</div>}
                      {exLog.filter(s => s && s.weight).length > 0 && (
                        <div style={{ marginTop: "5px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {exLog.filter(s => s && s.weight).map((s, si) => (
                            <div key={si} style={{ fontSize: "9px", color: "#7B9E87", background: "#0D150F", border: "1px solid #1A2E1F", borderRadius: "2px", padding: "2px 5px" }}>
                              {s.weight}lb × {s.reps}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: "14px", color: "#252525", transition: "transform 0.15s", transform: isExpanded ? "rotate(45deg)" : "none" }}>+</div>
                  </div>

                  {isExpanded && (
                    <div style={{ paddingBottom: "16px", paddingLeft: "32px" }}>
                      {ex.feeders && (
                        <div style={{ background: "#0C0C0C", border: "1px solid #181818", borderRadius: "3px", padding: "10px 12px", marginBottom: "10px" }}>
                          <div style={{ fontSize: "8px", letterSpacing: "2px", color: "#333", textTransform: "uppercase", marginBottom: "4px" }}>Nippard Feeder Sets</div>
                          <div style={{ fontSize: "11px", color: "#666", lineHeight: 1.5 }}>{ex.feeders}</div>
                        </div>
                      )}
                      <div style={{ fontSize: "12px", color: "#777", lineHeight: 1.7, marginBottom: "10px" }}>{ex.notes}</div>
                      {ex.spineFlag && (
                        <div style={{ background: "#120808", border: "1px solid #321212", borderLeft: "3px solid #A04040", borderRadius: "3px", padding: "8px 12px", marginBottom: "10px" }}>
                          <div style={{ fontSize: "8px", letterSpacing: "2px", color: "#A04040", textTransform: "uppercase", marginBottom: "4px" }}>Spine Flag</div>
                          <div style={{ fontSize: "11px", color: "#805050", lineHeight: 1.5 }}>{ex.spineFlag}</div>
                        </div>
                      )}

                      {/* Log sets button */}
                      {ex.tier !== "SUPERSET — CORE" && ex.repRange !== "30–45 sec / 8 per side" && (
                        <button onClick={(e) => { e.stopPropagation(); setActiveLogExId(isLogging ? null : ex.id); }} style={{
                          background: isLogging ? session.color : "transparent",
                          border: `1px solid ${isLogging ? session.color : "#2A2A2A"}`,
                          borderRadius: "3px", padding: "7px 14px",
                          color: isLogging ? "#0A0A0A" : "#555",
                          fontSize: "9px", letterSpacing: "2px", textTransform: "uppercase",
                          cursor: "pointer", fontFamily: "Georgia, serif", marginBottom: isLogging ? "12px" : "0",
                        }}>
                          {isLogging ? "CLOSE LOG" : "LOG SETS"}
                        </button>
                      )}

                      {/* Set logger */}
                      {isLogging && (
                        <div onClick={e => e.stopPropagation()}>
                          {[...Array(numSets)].map((_, si) => {
                            const setData = exLog[si] || {};
                            return (
                              <div key={si} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                                <div style={{ fontSize: "10px", color: "#333", minWidth: "40px" }}>Set {si + 1}</div>
                                <input
                                  type="number"
                                  placeholder="lbs"
                                  value={setData.weight || ""}
                                  onChange={e => logSet(ex.id, si, "weight", e.target.value)}
                                  style={{ width: "60px", background: "#0E0E0E", border: "1px solid #222", borderRadius: "3px", padding: "6px 8px", color: "#E8E4DC", fontSize: "12px", fontFamily: "Georgia, serif", textAlign: "center" }}
                                />
                                <input
                                  type="number"
                                  placeholder="reps"
                                  value={setData.reps || ""}
                                  onChange={e => logSet(ex.id, si, "reps", e.target.value)}
                                  style={{ width: "55px", background: "#0E0E0E", border: "1px solid #222", borderRadius: "3px", padding: "6px 8px", color: "#E8E4DC", fontSize: "12px", fontFamily: "Georgia, serif", textAlign: "center" }}
                                />
                                <input
                                  type="number"
                                  placeholder="RIR"
                                  value={setData.rir || ""}
                                  onChange={e => logSet(ex.id, si, "rir", e.target.value)}
                                  style={{ width: "50px", background: "#0E0E0E", border: "1px solid #222", borderRadius: "3px", padding: "6px 8px", color: setData.rir !== undefined && parseInt(setData.rir) <= 1 ? "#C8A96E" : "#E8E4DC", fontSize: "12px", fontFamily: "Georgia, serif", textAlign: "center" }}
                                />
                                {setData.weight && setData.reps && (
                                  <div style={{ fontSize: "9px", color: "#3A3A3A" }}>✓</div>
                                )}
                              </div>
                            );
                          })}
                          {progression && (
                            <div style={{ background: "#0D150F", border: "1px solid #1E3A25", borderLeft: "3px solid #7B9E87", borderRadius: "3px", padding: "8px 12px", marginTop: "8px" }}>
                              <div style={{ fontSize: "8px", letterSpacing: "2px", color: "#7B9E87", textTransform: "uppercase", marginBottom: "3px" }}>Double Progression</div>
                              <div style={{ fontSize: "11px", color: "#5A8A6A", lineHeight: 1.4 }}>All sets completed at top of range with RIR ≥ 1. Add weight next session per the progression rules.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cooldown */}
          <div style={{ margin: "16px 20px 0", background: "#0C0C0C", border: "1px solid #181818", borderRadius: "3px", padding: "12px 14px" }}>
            <div style={{ fontSize: "8px", letterSpacing: "3px", color: "#333", textTransform: "uppercase", marginBottom: "6px" }}>Cooldown</div>
            <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.6 }}>{session.cooldown}</div>
          </div>

          {/* Finisher */}
          {session.finisher && (
            <div style={{ margin: "10px 20px 0" }}>
              <div onClick={() => setShowFinisher(!showFinisher)} style={{
                background: showFinisher ? "#0D0D0D" : "transparent",
                border: `1px solid ${showFinisher ? session.color : "#1E1E1E"}`,
                borderRadius: "3px", padding: "13px 14px", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: "8px", letterSpacing: "3px", color: showFinisher ? session.color : "#333", textTransform: "uppercase", marginBottom: "3px" }}>Optional Finisher — {session.finisher.duration}</div>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: showFinisher ? "#E8E4DC" : "#444" }}>{session.finisher.name}</div>
                  <div style={{ fontSize: "9px", color: "#333", marginTop: "2px", fontStyle: "italic" }}>{session.finisher.influence}</div>
                </div>
                <div style={{ fontSize: "14px", color: showFinisher ? session.color : "#2A2A2A", transition: "transform 0.15s", transform: showFinisher ? "rotate(45deg)" : "none" }}>+</div>
              </div>
              {showFinisher && (
                <div style={{ background: "#0C0C0C", border: "1px solid #181818", borderTop: "none", borderRadius: "0 0 3px 3px", padding: "14px" }}>
                  <div style={{ background: "#0F0F0F", border: `1px solid ${session.color}22`, borderLeft: `3px solid ${session.color}`, borderRadius: "3px", padding: "9px 12px", marginBottom: "11px" }}>
                    <div style={{ fontSize: "8px", letterSpacing: "2px", color: session.color, textTransform: "uppercase", marginBottom: "4px" }}>Protocol</div>
                    <div style={{ fontSize: "11px", color: "#777", lineHeight: 1.5 }}>{session.finisher.protocol}</div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#666", lineHeight: 1.7 }}>{session.finisher.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* Sauna */}
          <div style={{ margin: "10px 20px 0" }}>
            {session.sauna ? (
              <>
                <div onClick={() => setShowSauna(!showSauna)} style={{
                  background: showSauna ? "#0D0D0D" : "transparent",
                  border: `1px solid ${showSauna ? "#E09B50" : "#1E1E1E"}`,
                  borderRadius: "3px", padding: "13px 14px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: "8px", letterSpacing: "3px", color: showSauna ? "#E09B50" : "#333", textTransform: "uppercase", marginBottom: "3px" }}>Dry Sauna — Post-Session</div>
                    <div style={{ fontSize: "13px", fontWeight: "bold", color: showSauna ? "#E8E4DC" : "#444" }}>15–20 Min</div>
                    <div style={{ fontSize: "9px", color: "#333", marginTop: "2px", fontStyle: "italic" }}>{session.sauna.influence}</div>
                  </div>
                  <div style={{ fontSize: "14px", color: showSauna ? "#E09B50" : "#2A2A2A", transition: "transform 0.15s", transform: showSauna ? "rotate(45deg)" : "none" }}>+</div>
                </div>
                {showSauna && (
                  <div style={{ background: "#0C0C0C", border: "1px solid #181818", borderTop: "none", borderRadius: "0 0 3px 3px", padding: "14px" }}>
                    <div style={{ background: "#0F0F0F", border: "1px solid #2A1E0A", borderLeft: "3px solid #E09B50", borderRadius: "3px", padding: "9px 12px", marginBottom: "11px" }}>
                      <div style={{ fontSize: "8px", letterSpacing: "2px", color: "#E09B50", textTransform: "uppercase", marginBottom: "4px" }}>Protocol</div>
                      <div style={{ fontSize: "11px", color: "#777", lineHeight: 1.5 }}>{session.sauna.protocol}</div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#666", lineHeight: 1.7 }}>{session.sauna.rationale}</div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: "#080808", border: "1px solid #151515", borderLeft: "3px solid #1E1E1E", borderRadius: "3px", padding: "12px 14px" }}>
                <div style={{ fontSize: "8px", letterSpacing: "3px", color: "#282828", textTransform: "uppercase", marginBottom: "5px" }}>Sauna — Not Today</div>
                <div style={{ fontSize: "11px", color: "#383838", lineHeight: 1.6 }}>{session.saunaNote}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          VIEW: READINESS
      ══════════════════════════════════════════════════ */}
      {view === "readiness" && (
        <div style={{ padding: "20px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#444", textTransform: "uppercase", marginBottom: "18px" }}>Daily Readiness Check</div>

          {todayReadiness && (
            <div style={{
              background: `${getReadinessTier(todayReadiness.score).color}15`,
              border: `1px solid ${getReadinessTier(todayReadiness.score).color}44`,
              borderLeft: `4px solid ${getReadinessTier(todayReadiness.score).color}`,
              borderRadius: "4px", padding: "16px", marginBottom: "20px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: "bold", color: getReadinessTier(todayReadiness.score).color }}>{getReadinessTier(todayReadiness.score).tier}</div>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>{getReadinessTier(todayReadiness.score).label}</div>
                </div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: getReadinessTier(todayReadiness.score).color }}>{todayReadiness.score}<span style={{ fontSize: "12px", color: "#555" }}>/24</span></div>
              </div>
              <div style={{ fontSize: "12px", color: "#777", marginTop: "10px", lineHeight: 1.6 }}>{getReadinessTier(todayReadiness.score).note}</div>
            </div>
          )}

          {[
            { key: "bodyBattery", label: "Body Battery", type: "slider", min: 0, max: 100, suffix: "" },
            { key: "sleepScore", label: "Sleep Score", type: "slider", min: 0, max: 100, suffix: "" },
            { key: "hrv", label: "HRV Status", type: "select", options: [["favorable","Favorable"],["balanced","Balanced"],["unbalanced","Unbalanced"],["poor","Poor"]] },
            { key: "restingHR", label: "Resting HR vs 30-Day Avg", type: "select", options: [["at","At or below"],["1-3","1–3 bpm above"],["4-6","4–6 bpm above"],["7+","7+ bpm above"]] },
            { key: "soreness", label: "Soreness / Pain (0–10)", type: "slider", min: 0, max: 10, suffix: "" },
            { key: "motivation", label: "Motivation (0–10)", type: "slider", min: 0, max: 10, suffix: "" },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ fontSize: "11px", letterSpacing: "1px", color: "#666", textTransform: "uppercase" }}>{field.label}</div>
                {field.type === "slider" && <div style={{ fontSize: "13px", color: phase.color, fontWeight: "bold" }}>{readinessInputs[field.key]}</div>}
              </div>
              {field.type === "slider" ? (
                <input type="range" min={field.min} max={field.max} value={readinessInputs[field.key]}
                  onChange={e => setReadinessInputs(p => ({ ...p, [field.key]: parseInt(e.target.value) }))}
                  style={{ width: "100%", accentColor: phase.color }}
                />
              ) : (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {field.options.map(([val, lbl]) => (
                    <button key={val} onClick={() => setReadinessInputs(p => ({ ...p, [field.key]: val }))} style={{
                      flex: 1, padding: "9px 6px",
                      background: readinessInputs[field.key] === val ? phase.color : "transparent",
                      border: `1px solid ${readinessInputs[field.key] === val ? phase.color : "#222"}`,
                      borderRadius: "3px",
                      color: readinessInputs[field.key] === val ? "#0A0A0A" : "#444",
                      fontSize: "10px", cursor: "pointer", fontFamily: "Georgia, serif",
                    }}>{lbl}</button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button onClick={handleReadinessSubmit} style={{
            width: "100%", padding: "14px",
            background: phase.color, border: "none", borderRadius: "3px",
            color: "#0A0A0A", fontSize: "11px", fontWeight: "bold",
            letterSpacing: "2px", textTransform: "uppercase",
            cursor: "pointer", fontFamily: "Georgia, serif", marginBottom: "24px",
          }}>
            CALCULATE READINESS
          </button>

          {/* Recent readiness history */}
          {Object.keys(readinessLog).length > 0 && (
            <div>
              <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#333", textTransform: "uppercase", marginBottom: "12px" }}>Recent History</div>
              {Object.entries(readinessLog).slice(-5).reverse().map(([date, entry]) => {
                const t = getReadinessTier(entry.score);
                return (
                  <div key={date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #111" }}>
                    <div style={{ fontSize: "11px", color: "#444" }}>{date}</div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <div style={{ fontSize: "10px", color: t.color, letterSpacing: "1px" }}>{entry.tier}</div>
                      <div style={{ fontSize: "13px", color: t.color, fontWeight: "bold" }}>{entry.score}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          VIEW: TRACKER
      ══════════════════════════════════════════════════ */}
      {view === "tracker" && (
        <div style={{ padding: "20px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#444", textTransform: "uppercase", marginBottom: "18px" }}>Progressive Overload Tracker — Week {currentWeek}</div>

          {DAY_ORDER.filter(d => d !== "SUN").map(d => {
            const s = SESSIONS[d];
            return (
              <div key={d} style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", paddingBottom: "8px", borderBottom: `1px solid ${s.color}33` }}>
                  <div style={{ fontSize: "8px", letterSpacing: "3px", color: s.color, textTransform: "uppercase", fontWeight: "bold" }}>{s.fullDay}</div>
                  <div style={{ fontSize: "10px", color: "#333" }}>{s.focus}</div>
                </div>
                {s.exercises.filter(ex => typeof ex.sets === "number").map(ex => {
                  const log = getExerciseLog(ex.id);
                  const completed = log.filter(s => s && s.weight && s.reps);
                  const progression = checkDoubleProgression(log, ex.repRange);
                  const { max } = parseRepRange(ex.repRange);

                  return (
                    <div key={ex.id} style={{ marginBottom: "12px", background: "#0C0C0C", border: "1px solid #181818", borderRadius: "3px", padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#C8C4BC", maxWidth: "200px", lineHeight: 1.3 }}>{ex.name}</div>
                        {progression && (
                          <div style={{ fontSize: "7px", letterSpacing: "1px", background: "#7B9E87", color: "#0A0A0A", padding: "2px 6px", borderRadius: "2px", fontWeight: "bold", whiteSpace: "nowrap" }}>
                            ↑ ADD WEIGHT
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "10px", color: "#444", marginBottom: "8px" }}>{ex.sets} × {ex.repRange}</div>
                      {completed.length > 0 ? (
                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                          {completed.map((set, si) => (
                            <div key={si} style={{
                              background: parseInt(set.reps) >= max ? "#0D150F" : "#0F0F0F",
                              border: `1px solid ${parseInt(set.reps) >= max ? "#1E3A25" : "#1A1A1A"}`,
                              borderRadius: "2px", padding: "4px 7px",
                              fontSize: "10px", color: parseInt(set.reps) >= max ? "#7B9E87" : "#555",
                            }}>
                              {set.weight}lb × {set.reps} <span style={{ color: "#333" }}>@{set.rir}RIR</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: "10px", color: "#252525", fontStyle: "italic" }}>Not yet logged this week</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
