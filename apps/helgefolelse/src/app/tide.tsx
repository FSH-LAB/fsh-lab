"use client";

import { useEffect, useRef } from "react";
import { type Reading } from "@/lib/helgefolelse";

// We inline the JS directly from the prototype inside a useEffect.
export default function Tide({ initial }: { initial: Reading }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Everything inside this script was taken directly from the provided prototype
    // and slightly adjusted to refer to the react component's container
    // rather than "document" directly where appropriate, but document is fine
    // since the elements are rendered below.

    /**
     * 1. CORE HELGEFØLELSE DOMAIN LOGIC (Ported & enhanced from apps/helgefolelse/src/lib)
     */
    const TIME_ZONE = "Europe/Oslo";
    const RISE_END = 4 * 24 + 16;   // Friday 16:00 (112 hours into the week)
    const PLATEAU_END = 6 * 24;     // Sunday 00:00 (144 hours into the week)
    const WEEK = 7 * 24;            // 168 hours
    const RISE_SHAPE = 3.0;
    const FALL_SHAPE = 4.5;

    const BAND_ORDER = ["ankle", "knee", "waist", "chest", "over"];
    const BANDS: Record<string, {label: string, range: string, desc: string}> = {
      ankle: { label: "Ankeldypt", range: "0–20%", desc: "Vannet skvulper så vidt rundt anklene" },
      knee:  { label: "Knedypt",   range: "20–40%", desc: "Du kjenner draget i strømmen" },
      waist: { label: "Midjedypt", range: "40–60%", desc: "Halvveis uti — arbeidsuken mister fotfestet" },
      chest: { label: "Brystdypt", range: "60–80%", desc: "Bølgene løfter deg opp fra bunnen" },
      over:  { label: "Over hodet", range: "80–100%", desc: "Helt oppslukt av helgefølelsen" }
    };

    const WEEKDAY_NAMES_NO = ["", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
    const WEEKDAY_SHORT_NO = ["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
    const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

    const FLOODING_STOPS = [
      { at: 0,   air: "#0d181c", surface: "#0a3a40", mid: "#082b30", deep: "#051b1f" },
      { at: 35,  air: "#132329", surface: "#0b5f63", mid: "#094448", deep: "#07282c" },
      { at: 70,  air: "#193037", surface: "#109089", mid: "#0c6865", deep: "#093e40" },
      { at: 100, air: "#214048", surface: "#17a39b", mid: "#0f7a74", deep: "#0a4f4d" }
    ];

    const EBBING_STOPS = [
      { at: 0,   air: "#070d14", surface: "#071a26", mid: "#05131c", deep: "#03080e" },
      { at: 30,  air: "#0c1722", surface: "#0a3145", mid: "#082433", deep: "#051721" },
      { at: 65,  air: "#142533", surface: "#0e5e6b", mid: "#0a444f", deep: "#072933" },
      { at: 100, air: "#214048", surface: "#17a39b", mid: "#0f7a74", deep: "#0a4f4d" }
    ];

    const HYGGE_STOPS = [
      { at: 0,   air: "#18100c", surface: "#3b2110", mid: "#2a160a", deep: "#140a04" },
      { at: 50,  air: "#24170f", surface: "#783f12", mid: "#542a0c", deep: "#291305" },
      { at: 100, air: "#2e1e12", surface: "#b45309", mid: "#853a09", deep: "#451a03" }
    ];

    const SONAR_STOPS = [
      { at: 0,   air: "#030914", surface: "#06283d", mid: "#041c2c", deep: "#020d17" },
      { at: 50,  air: "#051329", surface: "#084c61", mid: "#063445", deep: "#031824" },
      { at: 100, air: "#071f3d", surface: "#0284c7", mid: "#035388", deep: "#042440" }
    ];

    let activeVisualTheme = "nordic-sea";
    let activeMode = "classic"; // "classic" | "personal" | "company" | "vibe"

    // Personal Calibration State
    let personalFridayHour = 16.0;
    let personalBoost = 0;

    // Company & Department Fleet State
    const departments = [
      { id: "tech",    name: "Utvikling & Plattform", members: 16, offset: -6,  color: "#38bdf8", xNorm: 0.24, status: "Sprint-innspurt" },
      { id: "design",  name: "Design & Produkt",      members: 9,  offset: +8,  color: "#c084fc", xNorm: 0.44, status: "Prototype ferdig!" },
      { id: "sales",   name: "Salg & Marked",         members: 11, offset: +14, color: "#fbbf24", xNorm: 0.64, status: "Fredagsstemning" },
      { id: "ops",     name: "Kundeservice & Drift",  members: 6,  offset: -2,  color: "#34d399", xNorm: 0.78, status: "Stabil vakt" }
    ];
    let selectedDeptId: string | null = null;

    const osloFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    function ramp(p: number, shape: number) {
      return (Math.exp(shape * p) - 1) / (Math.exp(shape) - 1);
    }

    function bandFor(value: number) {
      if (value < 20) return "ankle";
      if (value < 40) return "knee";
      if (value < 60) return "waist";
      if (value < 80) return "chest";
      return "over";
    }

    // Evaluate helgefølelse at any given hours-into-week (0..168), with optional custom Friday hour & boost
    function evaluateAtHours(hoursIntoWeek: number, customRiseEnd = RISE_END, boostPct = 0) {
      const h = ((hoursIntoWeek % WEEK) + WEEK) % WEEK;
      let value = 0;
      let trend = "rising";

      if (h < customRiseEnd) {
        value = 100 * ramp(h / customRiseEnd, RISE_SHAPE);
        trend = "rising";
      } else if (h < PLATEAU_END) {
        value = 100;
        trend = "holding";
      } else {
        const p = (h - PLATEAU_END) / (WEEK - PLATEAU_END);
        value = 100 * (1 - ramp(p, FALL_SHAPE));
        trend = "falling";
      }

      value = Math.min(100, Math.max(0, value + boostPct));

      // Calculate instantaneous derivative (% per hour)
      const dt = 0.01;
      const hNext = Math.min(WEEK, h + dt);
      let vNext = 0;
      if (hNext < customRiseEnd) {
        vNext = 100 * ramp(hNext / customRiseEnd, RISE_SHAPE);
      } else if (hNext < PLATEAU_END) {
        vNext = 100;
      } else {
        const pNext = (hNext - PLATEAU_END) / (WEEK - PLATEAU_END);
        vNext = 100 * (1 - ramp(pNext, FALL_SHAPE));
      }
      vNext = Math.min(100, Math.max(0, vNext + boostPct));
      const velocityPerHour = (vNext - value) / dt;

      const weekday = Math.floor(h / 24) + 1;
      const dayHours = h % 24;
      const hour = Math.floor(dayHours);
      const minute = Math.floor((dayHours - hour) * 60);
      const second = Math.floor((((dayHours - hour) * 60) - minute) * 60);

      return {
        hours: h,
        value,
        trend,
        velocityPerHour,
        band: bandFor(value),
        weekday,
        hour,
        minute,
        second
      };
    }

    function getLiveOsloHours(at = new Date()) {
      const parts = osloFormatter.formatToParts(at);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
      const weekday = WEEKDAY_INDEX[get("weekday")] ?? 1;
      const hour = Number(get("hour")) % 24;
      const minute = Number(get("minute"));
      const second = Number(get("second"));
      return (
        (weekday - 1) * 24 +
        hour +
        minute / 60 +
        second / 3600 +
        at.getMilliseconds() / 3_600_000
      );
    }

    function hexToRgb(hex: string) {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function mixHex(a: string, b: string, t: number) {
      const [ar, ag, ab] = hexToRgb(a);
      const [br, bg, bb] = hexToRgb(b);
      const blend = (x: number, y: number) => Math.round(x + (y - x) * t);
      return `rgb(${blend(ar, br)} ${blend(ag, bg)} ${blend(ab, bb)})`;
    }

    function tidePaletteFor(value: number, trend: string) {
      let stops = trend === "falling" ? EBBING_STOPS : FLOODING_STOPS;
      if (activeVisualTheme === "hygge") stops = HYGGE_STOPS;
      if (activeVisualTheme === "sonar") stops = SONAR_STOPS;

      const v = Math.min(100, Math.max(0, value));
      let lower = stops[0];
      let upper = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (v >= stops[i].at && v <= stops[i + 1].at) {
          lower = stops[i];
          upper = stops[i + 1];
          break;
        }
      }
      const span = upper.at - lower.at;
      const t = span === 0 ? 0 : (v - lower.at) / span;
      return {
        air: mixHex(lower.air, upper.air, t),
        surface: mixHex(lower.surface, upper.surface, t),
        mid: mixHex(lower.mid, upper.mid, t),
        deep: mixHex(lower.deep, upper.deep, t)
      };
    }

    const SAMPLES = 72;
    const TAU = Math.PI * 2;

    const FRONT_WAVES = [
      { amplitude: 0.014, periods: 1.35, cyclesPerSecond: 0.055 },
      { amplitude: 0.008, periods: 2.40, cyclesPerSecond: -0.085 },
      { amplitude: 0.003, periods: 4.10, cyclesPerSecond: 0.140 }
    ];

    const BACK_WAVES = [
      { amplitude: 0.016, periods: 1.15, cyclesPerSecond: -0.045 },
      { amplitude: 0.009, periods: 2.10, cyclesPerSecond: 0.070 }
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ripples: any[] = [];
    function spawnRipple(xNorm: number, strength = 22) {
      ripples.push({
        xNorm,
        strength: Math.max(-45, Math.min(45, strength)),
        born: performance.now()
      });
      if (ripples.length > 18) ripples.shift();
    }

    // Bioluminescent underwater particles
    const PARTICLE_COUNT = 26;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.2 + Math.random() * 2.8,
      speedY: 0.012 + Math.random() * 0.028,
      driftX: (Math.random() - 0.5) * 0.02,
      phase: Math.random() * TAU
    }));

    // State
    let viewport = { w: window.innerWidth, h: window.innerHeight };
    let isScrubbing = false;
    let scrubbedHours: number | null = null;
    let displayedValue = 0; // Smoothly damped value for fluid visual transitions
    let displayedOfficialValue = 0;
    const bootTime = performance.now();
    let animationFrameId: number;

    const root = containerRef.current;

    // DOM References
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const appEl = root.querySelector("#app");
    const svgEl = root.querySelector("#ocean-svg");
    const clipFrontEl = root.querySelector("#clip-path-front");
    const clipBackEl = root.querySelector("#clip-path-back");
    const waveFrontBody = root.querySelector("#wave-front-body");
    const waveCausticBody = root.querySelector("#wave-caustic-body");
    const waveFrontLine = root.querySelector("#wave-front-line");
    const wavePersonalLine = root.querySelector("#wave-personal-line");
    const waveBackBody = root.querySelector("#wave-back-body");
    const waveBackLine = root.querySelector("#wave-back-line");
    const buoyGroup = root.querySelector("#buoy-group");
    const fleetBuoysGroup = root.querySelector("#fleet-buoys-group");
    const staffGroup = root.querySelector("#staff-group");
    const staffLabelsOverlay = root.querySelector("#staff-labels-overlay");
    const particlesGroup = root.querySelector("#underwater-particles");

    function initFleetBuoys() {
      if(fleetBuoysGroup) {
        fleetBuoysGroup.innerHTML = departments.map((d) => `
          <g id="fleet-buoy-${d.id}" class="transition-transform duration-100">
            <line x1="0" y1="0" x2="0" y2="-28" stroke="${d.color}" stroke-width="1.5" stroke-dasharray="2 2" />
            <circle cx="0" cy="0" r="12" fill="${d.color}" fill-opacity="0.18" />
            <circle cx="0" cy="0" r="5" fill="${d.color}" stroke="#041918" stroke-width="1.5" />
            <g transform="translate(0, -34)">
              <rect x="-54" y="-14" width="108" height="20" rx="6" fill="#041918" fill-opacity="0.82" stroke="${d.color}" stroke-opacity="0.5" stroke-width="1" />
              <text x="0" y="-1" text-anchor="middle" fill="#e9f6f2" font-size="10" font-family="JetBrains Mono, monospace" font-weight="600">
                ${d.name.split(" ")[0]} · <tspan id="fleet-pct-${d.id}">0%</tspan>
              </text>
            </g>
          </g>
        `).join("");
      }
    }

    function renderDepartmentList(baseValue: number) {
      const container = root.querySelector("#dept-list");
      if (!container) return;

      const values = departments.map((d) => Math.min(100, Math.max(0, baseValue + d.offset)));
      const spread = Math.round(Math.max(...values) - Math.min(...values));
      const spreadEl = root.querySelector("#company-spread-label");
      if (spreadEl) spreadEl.textContent = `Spredning: ${spread}%`;

      container.innerHTML = departments.map((d) => {
        const val = Math.min(100, Math.max(0, baseValue + d.offset));
        const isSelected = selectedDeptId === d.id;
        return `
          <div data-dept-id="${d.id}" class="dept-row p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            isSelected ? "bg-teal-500/20 border-teal-300/60" : "bg-white/5 border-white/10 hover:bg-white/10"
          }">
            <div class="flex items-center gap-2.5">
              <span class="w-3 h-3 rounded-full shrink-0" style="background:${d.color}"></span>
              <div>
                <div class="text-xs font-semibold text-[var(--foam)] flex items-center gap-1.5">
                  <span>${d.name}</span>
                  <span class="text-[10px] font-mono-tabular text-[var(--foam)]/50">(${d.members})</span>
                </div>
                <div class="text-[10px] text-[var(--foam)]/60">${d.status}</div>
              </div>
            </div>
            <div class="text-right font-mono-tabular">
              <div class="text-xs font-bold text-[var(--foam)]">${val.toFixed(1)}%</div>
              <div class="text-[10px] ${d.offset >= 0 ? "text-emerald-300" : "text-amber-300"}">
                ${d.offset >= 0 ? "+" : ""}${d.offset}% vs snitt
              </div>
            </div>
          </div>
        `;
      }).join("");

      container.querySelectorAll(".dept-row").forEach((row) => {
        row.addEventListener("click", () => {
          const id = row.getAttribute("data-dept-id");
          selectedDeptId = selectedDeptId === id ? null : id;
          spawnRipple(0.5, 28);
        });
      });
    }

    // Readout text elements
    const textLayers = ["air", "back", "sea"].map((key) => ({
      text: root.querySelector(`#text-${key}`),
      whole: root.querySelector(`#whole-${key}`),
      frac: root.querySelector(`#frac-${key}`),
      pct: root.querySelector(`#pct-${key}`)
    }));

    // HUD elements
    const osloClockEl = root.querySelector("#oslo-clock");
    const bandNameEl = root.querySelector("#band-name");
    const trendLabelEl = root.querySelector("#trend-label");
    const countdownLabelEl = root.querySelector("#countdown-label");
    const velocityReadoutEl = root.querySelector("#velocity-readout");
    const timeScrubberEl = root.querySelector("#time-scrubber") as HTMLInputElement;
    const scrubberDayLabelEl = root.querySelector("#scrubber-day-label");
    const btnResetLive = root.querySelector("#btn-reset-live");
    const liveBadge = root.querySelector("#live-badge");
    const liveBadgeText = root.querySelector("#live-badge-text");
    const liveDot = root.querySelector("#live-dot");
    const rippleHint = root.querySelector("#ripple-hint") as HTMLElement;

    // Create particle SVG circles once
    const particleNodes = particles.map((p) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("r", p.r.toFixed(1));
      c.setAttribute("fill", "var(--foam)");
      c.setAttribute("fill-opacity", "0.28");
      if(particlesGroup) particlesGroup.appendChild(c);
      return c;
    });

    function renderStaffGeometry() {
      const { w, h } = viewport;
      const narrow = w < 640;
      const staff = narrow
        ? { width: 54, rule: 16, minor: 25, major: 38 }
        : { width: 84, rule: 28, minor: 42, major: 60 };

      let svgContent = `
        <line x1="${staff.rule}" y1="0" x2="${staff.rule}" y2="${h}" stroke="var(--foam)" stroke-opacity="0.16" stroke-width="1" />
      `;

      // Minor graduations every 5%
      for (let i = 0; i <= 20; i++) {
        const v = i * 5;
        if (v % 20 === 10) continue;
        const y = h * (1 - v / 100);
        svgContent += `<line x1="${staff.rule}" y1="${y.toFixed(1)}" x2="${staff.minor}" y2="${y.toFixed(1)}" stroke="var(--foam)" stroke-opacity="0.22" stroke-width="1" />`;
      }

      // Major band markers at 10%, 30%, 50%, 70%, 90%
      BAND_ORDER.forEach((band, i) => {
        const pct = i * 20 + 10;
        const y = h * (1 - pct / 100);
        svgContent += `
          <g id="staff-mark-${band}" class="staff-mark">
            <line x1="${staff.rule}" y1="${y.toFixed(1)}" x2="${staff.major}" y2="${y.toFixed(1)}" stroke="var(--foam)" stroke-opacity="0.45" stroke-width="1.5" />
          </g>
        `;
      });

      if(staffGroup) staffGroup.innerHTML = svgContent;

      // Render HTML interactive labels next to the staff marks
      if(staffLabelsOverlay) {
        staffLabelsOverlay.innerHTML = BAND_ORDER.slice().reverse().map((band, revIdx) => {
          const i = BAND_ORDER.length - 1 - revIdx;
          const pct = i * 20 + 10;
          return `
            <div id="staff-label-${band}"
                 style="position: absolute; top: ${100 - pct}%; left: ${staff.major + 8}px; transform: translateY(-50%);"
                 class="staff-label flex items-center gap-2 pointer-events-auto cursor-pointer group"
                 data-target-band="${band}">
              <span class="text-[11px] sm:text-xs font-medium tracking-wide text-[var(--foam)]/40 group-hover:text-[var(--foam)] transition-colors whitespace-nowrap">
                ${BANDS[band].label}
              </span>
            </div>
          `;
        }).join("");

        // Allow clicking a depth band label to preview that depth
        staffLabelsOverlay.querySelectorAll("[data-target-band]").forEach((el) => {
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const band = el.getAttribute("data-target-band")!;
            const targetHoursMap: Record<string, number> = { ankle: 20, knee: 58, waist: 80, chest: 96, over: 116 };
            activateScrubber(targetHoursMap[band] ?? 112);
          });
        });
      }
    }

    // Build the static weekly curve path for the drawer
    function buildWeekCurveChart() {
      const width = 700;
      const height = 120;
      const padY = 12;
      const pts = [];
      for (let i = 0; i <= 168; i += 1) {
        const reading = evaluateAtHours(i);
        const x = (i / 168) * width;
        const y = height - padY - (reading.value / 100) * (height - padY * 2);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      const lineD = `M ${pts.join(" L ")}`;
      const areaD = `${lineD} L ${width},${height} L 0,${height} Z`;
      root.querySelector("#week-curve-path")?.setAttribute("d", lineD);
      root.querySelector("#week-curve-area")?.setAttribute("d", areaD);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function computeWaveGeometry(w: number, h: number, baseLevelY: number, clockSec: number, waveSpec: any[], includeRipples: boolean, nowMs: number) {
      const points = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const xNorm = i / SAMPLES;
        const x = xNorm * w;
        let y = baseLevelY;

        // Harmonic sine waves
        for (const { amplitude, periods, cyclesPerSecond } of waveSpec) {
          y += amplitude * h * Math.sin(xNorm * periods * TAU + clockSec * cyclesPerSecond * TAU);
        }

        // Interactive cursor/touch ripples
        if (includeRipples) {
          for (let r = ripples.length - 1; r >= 0; r--) {
            const rip = ripples[r];
            const age = (nowMs - rip.born) / 1000;
            if (age > 3.2) {
              ripples.splice(r, 1);
              continue;
            }
            const dist = Math.abs(xNorm - rip.xNorm);
            const waveFront = dist - age * 0.28;
            const envelope = Math.exp(-dist * 14) * Math.exp(-age * 1.4);
            y += rip.strength * envelope * Math.cos(waveFront * 38);
          }
        }

        points.push({ x, y });
      }

      const lineCmd = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      const bodyCmd = `${lineCmd} L ${w} ${h + 4} L 0 ${h + 4} Z`;
      return { lineCmd, bodyCmd, points };
    }

    function formatCountdown(hoursIntoWeek: number) {
      if (hoursIntoWeek < RISE_END) {
        const diff = RISE_END - hoursIntoWeek;
        const d = Math.floor(diff / 24);
        const h = Math.floor(diff % 24);
        const m = Math.floor((diff * 60) % 60);
        if (d > 0) return `${d}d ${h}t ${m}m til full helg (fre 16:00)`;
        return `${h}t ${m}m igjen til fredag kl. 16:00`;
      } else if (hoursIntoWeek < PLATEAU_END) {
        const diff = PLATEAU_END - hoursIntoWeek;
        const h = Math.floor(diff);
        const m = Math.floor((diff * 60) % 60);
        return `Helgeplatået varer i ${h}t ${m}m til`;
      } else {
        const diff = WEEK - hoursIntoWeek;
        const h = Math.floor(diff);
        const m = Math.floor((diff * 60) % 60);
        return `Søndagskollaps · ${h}t ${m}m til mandag 00:00`;
      }
    }

    function updateReadoutLayout(wholeStr: string, fracStr: string) {
      const { w, h } = viewport;
      const staffWidth = w < 640 ? 54 : 84;
      const regionW = w - staffWidth;
      const WIDEST = 3 * 0.62 + 0.26 * 0.55 * 5 + 0.15 * 0.9 + 0.07;
      const numeralSize = Math.min((regionW * 0.86) / WIDEST, h * 0.34);
      const numeralX = staffWidth + regionW / 2;
      const numeralY = h / 2 + numeralSize * 0.35;

      textLayers.forEach((layer, idx) => {
        if (!layer.text || !layer.whole || !layer.frac || !layer.pct) return;
        layer.text.setAttribute("x", numeralX.toFixed(1));
        layer.text.setAttribute("y", numeralY.toFixed(1));
        (layer.text as HTMLElement).style.fontSize = `${numeralSize.toFixed(1)}px`;

        if (idx === 0) {
          (layer.text as HTMLElement).style.strokeWidth = `${(numeralSize * 0.02).toFixed(2)}px`;
        }

        layer.whole.textContent = wholeStr;
        layer.frac.textContent = `.${fracStr}`;
        (layer.frac as HTMLElement).style.fontSize = `${(numeralSize * 0.26).toFixed(1)}px`;
        if (idx === 0) {
          (layer.frac as HTMLElement).style.strokeWidth = `${(numeralSize * 0.009).toFixed(2)}px`;
        }

        (layer.pct as HTMLElement).style.fontSize = `${(numeralSize * 0.15).toFixed(1)}px`;
        layer.pct.setAttribute("dx", (numeralSize * 0.06).toFixed(1));
        if (idx === 0) {
          (layer.pct as HTMLElement).style.strokeWidth = `${(numeralSize * 0.007).toFixed(2)}px`;
        }
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let audioCtx: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let audioGain: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let audioFilter: any = null;
    let isAudioPlaying = false;

    function toggleOceanAudio() {
      const iconOff = root.querySelector("#icon-audio-off");
      const iconOn = root.querySelector("#icon-audio-on");

      if (!audioCtx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();

        // Generate pink/brown noise buffer for soothing ocean surf
        const bufferSize = audioCtx.sampleRate * 4;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.2;
        }

        const whiteNoise = audioCtx.createBufferSource();
        whiteNoise.buffer = buffer;
        whiteNoise.loop = true;

        audioFilter = audioCtx.createBiquadFilter();
        audioFilter.type = "lowpass";
        audioFilter.frequency.value = 320;

        audioGain = audioCtx.createGain();
        audioGain.gain.value = 0.01;

        whiteNoise.connect(audioFilter);
        audioFilter.connect(audioGain);
        audioGain.connect(audioCtx.destination);
        whiteNoise.start(0);
      }

      if (isAudioPlaying) {
        audioGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.4);
        isAudioPlaying = false;
        iconOff?.classList.remove("hidden");
        iconOn?.classList.add("hidden");
      } else {
        if (audioCtx.state === "suspended") audioCtx.resume();
        audioGain.gain.setTargetAtTime(0.12, audioCtx.currentTime, 0.8);
        isAudioPlaying = true;
        iconOff?.classList.add("hidden");
        iconOn?.classList.remove("hidden");
      }
    }

    let lastLitBand: string | null = null;

    function animate(nowMs: number) {
      const elapsedBoot = (nowMs - bootTime) / 1000;
      const sweepFactor = Math.min(1, 1 - Math.pow(2, -8 * (elapsedBoot / 1.6)));

      const activeHours = isScrubbing && scrubbedHours !== null
        ? scrubbedHours
        : getLiveOsloHours(new Date());

      // Official Oslo reading
      const officialReading = evaluateAtHours(activeHours, RISE_END, 0);

      // Determine active reading based on selected concept mode
      let activeReading = officialReading;
      if (activeMode === "personal") {
        const customRiseEnd = 4 * 24 + personalFridayHour;
        activeReading = evaluateAtHours(activeHours, customRiseEnd, personalBoost);
      } else if (activeMode === "company") {
        if (selectedDeptId) {
          const dept = departments.find((d) => d.id === selectedDeptId);
          activeReading = evaluateAtHours(activeHours, RISE_END, dept ? dept.offset : 0);
        } else {
          const avgOffset = departments.reduce((acc, d) => acc + d.offset, 0) / departments.length;
          activeReading = evaluateAtHours(activeHours, RISE_END, avgOffset);
        }
      }

      const targetValue = activeReading.value * sweepFactor;
      const targetOfficialValue = officialReading.value * sweepFactor;

      // Smooth damping when scrubbing or transitioning
      displayedValue += (targetValue - displayedValue) * 0.14;
      displayedOfficialValue += (targetOfficialValue - displayedOfficialValue) * 0.14;

      const [wholeStr, fracStr] = displayedValue.toFixed(4).split(".");
      updateReadoutLayout(wholeStr, fracStr);

      // Update CSS palette variables
      const palette = tidePaletteFor(displayedValue, activeReading.trend);
      document.documentElement.style.setProperty("--air", palette.air);
      document.documentElement.style.setProperty("--surface", palette.surface);
      document.documentElement.style.setProperty("--mid-water", palette.mid);
      document.documentElement.style.setProperty("--deep", palette.deep);

      // Compute Front & Back Wave Surfaces
      const { w, h } = viewport;
      const levelY = h * (1 - displayedValue / 100);

      const frontWave = computeWaveGeometry(w, h, levelY, elapsedBoot, FRONT_WAVES, true, nowMs);
      const backWave = computeWaveGeometry(w, h, levelY - 8, elapsedBoot + 12, BACK_WAVES, false, nowMs);

      waveFrontBody?.setAttribute("d", frontWave.bodyCmd);
      waveCausticBody?.setAttribute("d", frontWave.bodyCmd);
      waveFrontLine?.setAttribute("d", frontWave.lineCmd);
      clipFrontEl?.setAttribute("d", frontWave.bodyCmd);

      waveBackBody?.setAttribute("d", backWave.bodyCmd);
      waveBackLine?.setAttribute("d", backWave.lineCmd);
      clipBackEl?.setAttribute("d", backWave.bodyCmd);

      // In Personal mode, render the Official Oslo tide as a dashed reference line
      if (activeMode === "personal") {
        const officialY = h * (1 - displayedOfficialValue / 100);
        const officialWave = computeWaveGeometry(w, h, officialY, elapsedBoot, BACK_WAVES, false, nowMs);
        wavePersonalLine?.setAttribute("d", officialWave.lineCmd);
        const delta = displayedValue - displayedOfficialValue;
        const deltaEl = root.querySelector("#personal-delta-badge");
        if (deltaEl) {
          deltaEl.textContent = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs Oslo`;
        }
      }

      // Position floating buoy on the right-side wave surface
      const buoyIdx = Math.floor(SAMPLES * 0.84);
      const buoyPt = frontWave.points[buoyIdx];
      if (buoyPt) {
        buoyGroup?.setAttribute("transform", `translate(${buoyPt.x.toFixed(1)}, ${buoyPt.y.toFixed(1)})`);
      }

      // Position Department Fleet Buoys in Company Mode
      if (activeMode === "company") {
        departments.forEach((d) => {
          const deptVal = Math.min(100, Math.max(0, displayedOfficialValue + d.offset));
          const deptY = h * (1 - deptVal / 100);
          const sampleIdx = Math.min(SAMPLES, Math.max(0, Math.floor(d.xNorm * SAMPLES)));
          const waveOffset = frontWave.points[sampleIdx] ? frontWave.points[sampleIdx].y - levelY : 0;
          const xPos = d.xNorm * w;
          const yPos = deptY + waveOffset;
          const node = root.querySelector(`#fleet-buoy-${d.id}`);
          const pctNode = root.querySelector(`#fleet-pct-${d.id}`);
          if (node) node.setAttribute("transform", `translate(${xPos.toFixed(1)}, ${yPos.toFixed(1)})`);
          if (pctNode) pctNode.textContent = `${Math.round(deptVal)}%`;
        });
      }

      // Update underwater particles
      particles.forEach((p, idx) => {
        p.y -= p.speedY * 0.004;
        p.x += Math.sin(elapsedBoot + p.phase) * 0.0004 + p.driftX * 0.001;
        if (p.y * h < levelY - 10) {
          p.y = 1.02;
          p.x = Math.random();
        }
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        const node = particleNodes[idx];
        node.setAttribute("cx", (p.x * w).toFixed(1));
        node.setAttribute("cy", (p.y * h).toFixed(1));
      });

      // Modulate ocean sound filter with wave motion if active
      if (isAudioPlaying && audioFilter && audioCtx) {
        const swellFreq = 220 + (displayedValue / 100) * 260 + Math.sin(elapsedBoot * 0.45) * 90;
        audioFilter.frequency.setTargetAtTime(swellFreq, audioCtx.currentTime, 0.1);
      }

      // Highlight active depth band on the staff
      const currentBand = bandFor(displayedValue);
      if (currentBand !== lastLitBand) {
        lastLitBand = currentBand;
        BAND_ORDER.forEach((b) => {
          const mark = root.querySelector(`#staff-mark-${b}`);
          const label = root.querySelector(`#staff-label-${b}`);
          if (mark && label) {
            const line = mark.querySelector("line");
            const textSpan = label.querySelector("span");
            if (b === currentBand) {
              line?.setAttribute("stroke-opacity", "1");
              line?.setAttribute("stroke-width", "2.5");
              if (textSpan) textSpan.className = "text-xs sm:text-sm font-bold tracking-wide text-[var(--foam)] drop-shadow transition-all whitespace-nowrap";
            } else {
              line?.setAttribute("stroke-opacity", "0.4");
              line?.setAttribute("stroke-width", "1.5");
              if (textSpan) textSpan.className = "text-[11px] sm:text-xs font-medium tracking-wide text-[var(--foam)]/40 group-hover:text-[var(--foam)] transition-all whitespace-nowrap";
            }
          }
        });
      }

      // Update HUD text & Scrubber
      const pad = (n: number) => String(n).padStart(2, "0");
      if(osloClockEl) osloClockEl.textContent = `${WEEKDAY_SHORT_NO[activeReading.weekday]} ${pad(activeReading.hour)}:${pad(activeReading.minute)}:${pad(activeReading.second)}`;
      if(bandNameEl) bandNameEl.textContent = BANDS[currentBand].label;

      const trendTextMap: Record<string, string> = {
        rising: "Flommer inn mot helg ↑",
        holding: "Høyvann — det er helg! ★",
        falling: "Ebber ut mot mandag ↓"
      };
      if(trendLabelEl) trendLabelEl.textContent = trendTextMap[activeReading.trend];
      if(countdownLabelEl) countdownLabelEl.textContent = formatCountdown(activeReading.hours);

      const velSign = activeReading.velocityPerHour >= 0 ? "+" : "";
      if(velocityReadoutEl) velocityReadoutEl.textContent = `${velSign}${activeReading.velocityPerHour.toFixed(2)} %/t`;

      if (!isScrubbing && timeScrubberEl) {
        timeScrubberEl.value = activeReading.hours.toFixed(2);
      }
      if(scrubberDayLabelEl) scrubberDayLabelEl.textContent = `${WEEKDAY_SHORT_NO[activeReading.weekday]} ${pad(activeReading.hour)}:${pad(activeReading.minute)}`;

      // Update Week Curve Drawer Marker
      const cursorX = (activeReading.hours / 168) * 700;
      const cursorY = 120 - 12 - (displayedValue / 100) * (120 - 24);
      root.querySelector("#week-curve-cursor")?.setAttribute("x1", cursorX.toFixed(1));
      root.querySelector("#week-curve-cursor")?.setAttribute("x2", cursorX.toFixed(1));
      root.querySelector("#week-curve-dot")?.setAttribute("cx", cursorX.toFixed(1));
      root.querySelector("#week-curve-dot")?.setAttribute("cy", cursorY.toFixed(1));

      animationFrameId = requestAnimationFrame(animate);
    }

    // Scrubber activation helper
    function activateScrubber(hoursValue: number) {
      isScrubbing = true;
      scrubbedHours = Math.max(0, Math.min(167.99, Number(hoursValue)));
      if(timeScrubberEl) timeScrubberEl.value = scrubbedHours.toString();
      btnResetLive?.classList.remove("hidden");
      btnResetLive?.classList.add("inline-flex");
      if(liveBadgeText) liveBadgeText.textContent = "Tidsmaskin";
      if(liveBadge) liveBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono-tabular uppercase tracking-wider bg-amber-500/20 text-amber-200 border border-amber-400/30";
      if(liveDot) liveDot.className = "w-1.5 h-1.5 rounded-full bg-amber-400";
    }

    function resetToLive() {
      isScrubbing = false;
      scrubbedHours = null;
      btnResetLive?.classList.add("hidden");
      btnResetLive?.classList.remove("inline-flex");
      if(liveBadgeText) liveBadgeText.textContent = "Direkte · Oslo";
      if(liveBadge) liveBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono-tabular uppercase tracking-wider bg-emerald-500/20 text-emerald-200 border border-emerald-400/30";
      if(liveDot) liveDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping";
    }

    // Event Listeners
    const handleResize = () => {
      viewport = { w: window.innerWidth, h: window.innerHeight };
      renderStaffGeometry();
      lastLitBand = null;
    };
    window.addEventListener("resize", handleResize);

    // Pointer / Touch wave ripple interaction
    let lastPointerY: number | null = null;
    const handlePointerMove = (e: PointerEvent) => {
      const xNorm = e.clientX / viewport.w;
      const dy = lastPointerY !== null ? e.clientY - lastPointerY : 4;
      lastPointerY = e.clientY;
      const waterSurfaceY = viewport.h * (1 - displayedValue / 100);
      if (Math.abs(e.clientY - waterSurfaceY) < viewport.h * 0.28) {
        spawnRipple(xNorm, dy * 1.35);
        if (rippleHint) rippleHint.style.opacity = "0";
      }
    };
    window.addEventListener("pointermove", handlePointerMove);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSvgPointerDown = (e: any) => {
      spawnRipple(e.clientX / viewport.w, 32);
      if (rippleHint) rippleHint.style.opacity = "0";
    };
    svgEl?.addEventListener("pointerdown", handleSvgPointerDown);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleScrubberInput = (e: any) => {
      activateScrubber(parseFloat(e.target.value));
    };
    timeScrubberEl?.addEventListener("input", handleScrubberInput);

    btnResetLive?.addEventListener("click", resetToLive);

    root.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activateScrubber(parseFloat(btn.getAttribute("data-preset")!));
      });
    });

    // Curve drawer toggle & scrubbing directly inside the mini-chart
    const curveDrawer = root.querySelector("#curve-drawer");
    root.querySelector("#btn-curve-modal")?.addEventListener("click", () => {
      curveDrawer?.classList.toggle("hidden");
    });
    root.querySelector("#btn-close-drawer")?.addEventListener("click", () => {
      curveDrawer?.classList.add("hidden");
    });

    const curveChartBox = root.querySelector("#curve-chart-box");
    let draggingChart = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrubFromChart = (e: any) => {
      if(!curveChartBox) return;
      const rect = curveChartBox.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      activateScrubber(pct * 168);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    curveChartBox?.addEventListener("pointerdown", (e: any) => {
      draggingChart = true;
      scrubFromChart(e);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleWinPointerMoveChart = (e: any) => {
      if (draggingChart) scrubFromChart(e);
    };
    window.addEventListener("pointermove", handleWinPointerMoveChart);
    const handleWinPointerUpChart = () => {
      draggingChart = false;
    };
    window.addEventListener("pointerup", handleWinPointerUpChart);

    root.querySelector("#btn-audio")?.addEventListener("click", toggleOceanAudio);

    // Concept Mode Switcher Logic
    const modeSubtitles: Record<string, string> = {
      classic: "Offisiell indeks · Hvor dypt står Norge i helgen akkurat nå?",
      personal: "Personlig modus · Kalibrer når du tar helg og hvordan uken føles.",
      company: "Bedriftsflåte · Se hvordan ulike avdelinger ligger an mot helgen.",
      vibe: "Visuelle konsepter · Test ulike atmosfærer og instrument-temaer."
    };

    root.querySelectorAll(".mode-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.querySelectorAll(".mode-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeMode = btn.getAttribute("data-mode")!;

        const mSubtitle = root.querySelector("#mode-subtitle");
        if(mSubtitle) mSubtitle.textContent = modeSubtitles[activeMode] || "";
        root.querySelector("#panel-personal")?.classList.toggle("hidden", activeMode !== "personal");
        root.querySelector("#panel-company")?.classList.toggle("hidden", activeMode !== "company");
        root.querySelector("#panel-vibe")?.classList.toggle("hidden", activeMode !== "vibe");

        if(wavePersonalLine) (wavePersonalLine as HTMLElement).style.opacity = activeMode === "personal" ? "1" : "0";
        if(fleetBuoysGroup) (fleetBuoysGroup as HTMLElement).style.opacity = activeMode === "company" ? "1" : "0";

        if (activeMode === "company") {
          renderDepartmentList(displayedOfficialValue);
        }
        spawnRipple(0.5, 25);
      });
    });

    // Personal Calibration Listeners
    const inputFriHour = root.querySelector("#input-fri-hour") as HTMLInputElement;
    const labelFriHour = root.querySelector("#label-fri-hour");
    const inputVibeBoost = root.querySelector("#input-vibe-boost") as HTMLInputElement;
    const labelVibeBoost = root.querySelector("#label-vibe-boost");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputFriHour?.addEventListener("input", (e: any) => {
      personalFridayHour = parseFloat(e.target.value);
      const hr = Math.floor(personalFridayHour);
      const min = (personalFridayHour - hr) * 60;
      if(labelFriHour) labelFriHour.textContent = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      spawnRipple(0.65, 16);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputVibeBoost?.addEventListener("input", (e: any) => {
      personalBoost = parseInt(e.target.value, 10);
      const sign = personalBoost > 0 ? "+" : "";
      if(labelVibeBoost) labelVibeBoost.textContent = personalBoost === 0 ? "Nøytral (0%)" : `${sign}${personalBoost}%`;
      spawnRipple(0.35, 18);
    });

    root.querySelectorAll(".boost-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const boost = parseInt(chip.getAttribute("data-boost")!, 10);
        personalBoost = Math.max(-25, Math.min(25, personalBoost + boost));
        if(inputVibeBoost) inputVibeBoost.value = personalBoost.toString();
        const sign = personalBoost > 0 ? "+" : "";
        if(labelVibeBoost) labelVibeBoost.textContent = personalBoost === 0 ? "Nøytral (0%)" : `${sign}${personalBoost}%`;
        spawnRipple(0.5, boost * 1.5);
      });
    });

    root.querySelector("#btn-reset-personal")?.addEventListener("click", () => {
      personalFridayHour = 16.0;
      personalBoost = 0;
      if(inputFriHour) inputFriHour.value = "16";
      if(inputVibeBoost) inputVibeBoost.value = "0";
      if(labelFriHour) labelFriHour.textContent = "16:00";
      if(labelVibeBoost) labelVibeBoost.textContent = "Nøytral (0%)";
      spawnRipple(0.5, -20);
    });

    // Company Check-in Pulse Button
    root.querySelector("#btn-checkin-pulse")?.addEventListener("click", () => {
      const targetId = selectedDeptId || departments[Math.floor(Math.random() * departments.length)].id;
      const dept = departments.find((d) => d.id === targetId);
      if (dept) {
        dept.members += 1;
        dept.offset = Math.min(25, dept.offset + 3);
        dept.status = "Ny innsjekk nettopp nå! 🎉";
        renderDepartmentList(displayedOfficialValue);
        spawnRipple(dept.xNorm, 35);
      }
    });

    // Visual Theme Switcher Listeners
    root.querySelectorAll(".theme-card").forEach((card) => {
      card.addEventListener("click", () => {
        activeVisualTheme = card.getAttribute("data-theme")!;
        document.body.classList.toggle("theme-hygge", activeVisualTheme === "hygge");
        document.body.classList.toggle("theme-sonar", activeVisualTheme === "sonar");
        const sonarOverlay = root.querySelector("#sonar-grid-overlay");
        if(sonarOverlay) (sonarOverlay as HTMLElement).style.opacity = activeVisualTheme === "sonar" ? "1" : "0";
        spawnRipple(0.5, 30);
      });
    });

    // Startup
    viewport = { w: window.innerWidth, h: window.innerHeight };
    renderStaffGeometry();
    buildWeekCurveChart();
    initFleetBuoys();
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      svgEl?.removeEventListener("pointerdown", handleSvgPointerDown);
      window.removeEventListener("pointermove", handleWinPointerMoveChart);
      window.removeEventListener("pointerup", handleWinPointerUpChart);
      if(audioCtx) audioCtx.close();
      document.body.classList.remove("theme-hygge");
      document.body.classList.remove("theme-sonar");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef}>
      <div id="app" className="relative w-screen h-screen overflow-hidden select-none">

        {/* Ambient atmospheric sky glow */}
        <div id="sky-glow" className="absolute inset-0 pointer-events-none transition-opacity duration-700"
             style={{background: "radial-gradient(circle at 60% 25%, rgba(23, 163, 155, 0.16), transparent 65%)"}}>
        </div>

        {/* Optional Sonar Grid Overlay for Instrument Mode */}
        <div id="sonar-grid-overlay" className="absolute inset-0 pointer-events-none sonar-grid opacity-0 transition-opacity duration-500"></div>

        {/* Main Interactive SVG Ocean & Readout */}
        <svg id="ocean-svg" className="absolute inset-0 w-full h-full block" aria-hidden="true">
          <defs>
            {/* Deep primary water gradient */}
            <linearGradient id="depth-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--surface)" />
              <stop offset="45%" stopColor="var(--mid-water)" />
              <stop offset="100%" stopColor="var(--deep)" />
            </linearGradient>

            {/* Secondary parallax wave gradient */}
            <linearGradient id="back-wave-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--foam)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.35" />
            </linearGradient>

            {/* Sunlight caustics shimmer gradient */}
            <linearGradient id="caustic-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--foam)" stopOpacity="0.18" />
              <stop offset="35%" stopColor="var(--foam)" stopOpacity="0.0" />
            </linearGradient>

            {/* Dynamic Clip Paths updated at 60fps */}
            <clipPath id="clip-front-sea">
              <path id="clip-path-front" d="" />
            </clipPath>
            <clipPath id="clip-back-sea">
              <path id="clip-path-back" d="" />
            </clipPath>
          </defs>

          {/* 1. Hollow Readout in the Air (Background Layer) */}
          <g id="readout-air-group">
            <text id="text-air" className="readout readout--air" textAnchor="middle">
              <tspan id="whole-air">0</tspan><tspan id="frac-air">.0000</tspan><tspan id="pct-air">%</tspan>
            </text>
          </g>

          {/* 2. Back Parallax Wave Layer */}
          <path id="wave-back-body" fill="url(#back-wave-grad)" d="" />
          <path id="wave-back-line" className="waterline-back" d="" />

          {/* Readout tinted by Back Wave */}
          <g clipPath="url(#clip-back-sea)">
            <text id="text-back" className="readout readout--back-wave" textAnchor="middle">
              <tspan id="whole-back">0</tspan><tspan id="frac-back">.0000</tspan><tspan id="pct-back">%</tspan>
            </text>
          </g>

          {/* 3. Front Primary Wave Body */}
          <path id="wave-front-body" fill="url(#depth-grad)" d="" />
          <path id="wave-caustic-body" fill="url(#caustic-grad)" d="" />

          {/* 4. Underwater Bioluminescent Particles & Bubbles (Clipped to Sea) */}
          <g id="underwater-particles" clipPath="url(#clip-front-sea)"></g>

          {/* 5. Solid Ink Readout Submerged in Front Wave */}
          <g clipPath="url(#clip-front-sea)">
            <text id="text-sea" className="readout readout--sea" textAnchor="middle">
              <tspan id="whole-sea">0</tspan><tspan id="frac-sea">.0000</tspan><tspan id="pct-sea">%</tspan>
            </text>
          </g>

          {/* 6. Lit Surface Waterline Crest */}
          <path id="wave-front-line" className="waterline-main" d="" />

          {/* 6b. Personal Calibration Ghost Waterline (Visible in Personal Mode) */}
          <path id="wave-personal-line" className="waterline-personal opacity-0 transition-opacity duration-500" d="" />

          {/* 7. Floating Surface Buoy Marker (Global / Active) */}
          <g id="buoy-group" className="transition-transform duration-75">
            <circle cx="0" cy="0" r="14" fill="var(--foam)" fillOpacity="0.12" className="animate-pulse-slow" />
            <circle cx="0" cy="0" r="4.5" fill="var(--foam)" />
          </g>

          {/* 7b. Company Department Fleet Buoys (Visible in Bedrift Mode) */}
          <g id="fleet-buoys-group" className="opacity-0 transition-opacity duration-500 pointer-events-none"></g>

          {/* 8. Left Depth Staff & Interactive Graduations */}
          <g id="staff-group"></g>
        </svg>

        {/* Interactive Depth Staff Labels Overlay (Left side) */}
        <div id="staff-labels-overlay" className="absolute left-0 top-0 bottom-0 pointer-events-none z-10 flex flex-col justify-between"></div>

        {/* HUD Chrome Frame */}
        <div className="relative z-20 w-full h-full flex flex-col justify-between p-4 sm:p-7 pl-[calc(var(--staff-width)+0.75rem)] sm:pl-[calc(var(--staff-width)+1.75rem)] pointer-events-none">

          {/* Top Header Bar */}
          <header className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl glass-pill">
                <svg className="w-5 h-5 text-[var(--foam)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c2.5-3 5.5-3 8 0s5.5 3 8 0 4-2 4-2M2 17c2.5-3 5.5-3 8 0s5.5 3 8 0 4-2 4-2" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--foam)] m-0 leading-none wordmark">
                    helgefølelse
                  </h1>
                  <span id="live-badge" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono-tabular uppercase tracking-wider bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                    <span id="live-dot" className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span id="live-badge-text">Direkte · Oslo</span>
                  </span>
                </div>
                <p id="mode-subtitle" className="text-xs text-[var(--foam)]/60 m-0 mt-1 hidden xl:block">
                  Offisiell indeks · Hvor dypt står Norge i helgen akkurat nå?
                </p>
              </div>
            </div>

            {/* Center Concept Mode Switcher */}
            <nav className="flex items-center gap-1 p-1 rounded-2xl glass-panel text-xs font-medium order-3 lg:order-2 w-full lg:w-auto justify-center overflow-x-auto" aria-label="Designkonsepter">
              <button type="button" data-mode="classic" className="mode-tab active px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer text-[var(--foam)]/80 whitespace-nowrap">
                <span>🌊</span>
                <span>1. Felles Tidevann</span>
              </button>
              <button type="button" data-mode="personal" className="mode-tab px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer text-[var(--foam)]/80 whitespace-nowrap">
                <span>🧭</span>
                <span>2. Min Egen (Personlig)</span>
              </button>
              <button type="button" data-mode="company" className="mode-tab px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer text-[var(--foam)]/80 whitespace-nowrap">
                <span>⛵</span>
                <span>3. Bedrift & Avdelinger</span>
              </button>
              <button type="button" data-mode="vibe" className="mode-tab px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer text-[var(--foam)]/80 whitespace-nowrap">
                <span>✨</span>
                <span>4. Visuelle Temaer</span>
              </button>
            </nav>

            {/* Right Status Pills & Interactive Toggles */}
            <div className="flex items-center gap-2 order-2 lg:order-3">
              <div className="glass-pill px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-mono-tabular">
                <span id="oslo-clock" className="font-semibold text-[var(--foam)]">Ons 17:18:00</span>
              </div>

              <button id="btn-curve-modal" type="button" className="glass-pill px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer text-[var(--foam)]" title="Utforsk ukekurven">
                <svg className="w-4 h-4 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 17c3 0 4-10 9-10s6 10 9 10" />
                </svg>
                <span className="hidden sm:inline">Ukekurve</span>
              </button>

              <button id="btn-audio" type="button" className="glass-pill p-2 rounded-xl text-xs font-medium flex items-center justify-center cursor-pointer text-[var(--foam)]" title="Slå på havlyd (Web Audio)">
                <svg id="icon-audio-off" className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                <svg id="icon-audio-on" className="w-4 h-4 text-teal-300 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </button>
            </div>
          </header>

          {/* Middle Contextual Workspace (Changes per selected concept mode) */}
          <div className="my-auto flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-none w-full max-w-6xl mx-auto">

            {/* PANEL A: PERSONAL HELGEFØLELSE CALIBRATOR (Mode: personal) */}
            <aside id="panel-personal" className="hidden pointer-events-auto glass-panel rounded-2xl p-4 sm:p-5 w-full max-w-sm ml-auto space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-amber-300 block">Personlig Kalibrering</span>
                  <h2 className="text-sm font-bold text-[var(--foam)]">Din subjektive helgefølelse</h2>
                </div>
                <div className="text-right font-mono-tabular">
                  <span className="text-[10px] text-[var(--foam)]/60 block">Avvik fra snitt</span>
                  <span id="personal-delta-badge" className="text-xs font-bold text-amber-300">+0.0%</span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {/* 1. When does your weekend start? */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[var(--foam)]/80">Når tar du helg på fredag?</span>
                    <span id="label-fri-hour" className="font-mono-tabular font-semibold text-amber-300">16:00</span>
                  </div>
                  <input id="input-fri-hour" type="range" min="11" max="20" step="0.5" defaultValue="16" className="calib-slider" />
                  <div className="flex justify-between text-[10px] text-[var(--foam)]/40 font-mono-tabular mt-0.5">
                    <span>11:00 (Tidlig)</span>
                    <span>16:00</span>
                    <span>20:00 (Sent)</span>
                  </div>
                </div>

                {/* 2. Energy / Workload modifier */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[var(--foam)]/80">Mentalt batteri & arbeidsro</span>
                    <span id="label-vibe-boost" className="font-mono-tabular font-semibold text-amber-300">Nøytral (0%)</span>
                  </div>
                  <input id="input-vibe-boost" type="range" min="-25" max="25" step="1" defaultValue="0" className="calib-slider" />
                  <div className="flex justify-between text-[10px] text-[var(--foam)]/40 font-mono-tabular mt-0.5">
                    <span>🔥 Kjørt (-25%)</span>
                    <span>Normal</span>
                    <span>🥂 Klar (+25%)</span>
                  </div>
                </div>

                {/* Quick situational toggles */}
                <div className="pt-1">
                  <span className="text-[11px] text-[var(--foam)]/60 block mb-1.5">Hurtigfaktorer:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" data-boost="12" className="boost-chip px-2.5 py-1 rounded-lg bg-white/5 hover:bg-amber-400/20 border border-white/10 text-[11px] text-[var(--foam)]/85 cursor-pointer transition-all">
                      🏠 Hjemmekontor (+12%)
                    </button>
                    <button type="button" data-boost="15" className="boost-chip px-2.5 py-1 rounded-lg bg-white/5 hover:bg-amber-400/20 border border-white/10 text-[11px] text-[var(--foam)]/85 cursor-pointer transition-all">
                      ☀️ Fredagslunsj (+15%)
                    </button>
                    <button type="button" data-boost="-15" className="boost-chip px-2.5 py-1 rounded-lg bg-white/5 hover:bg-rose-400/20 border border-white/10 text-[11px] text-[var(--foam)]/85 cursor-pointer transition-all">
                      🚨 Prod-brann (-15%)
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[var(--foam)]/70">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-400 inline-block"></span>
                  <span>Stiplet linje = Offisiell Oslo-indeks</span>
                </span>
                <button id="btn-reset-personal" type="button" className="text-amber-300 hover:underline cursor-pointer">Nullstill</button>
              </div>
            </aside>

            {/* PANEL B: COMPANY & DEPARTMENT FLEET (Mode: company) */}
            <aside id="panel-company" className="hidden pointer-events-auto glass-panel rounded-2xl p-4 sm:p-5 w-full max-w-md ml-auto space-y-3.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-teal-300">Bedriftsflåte · Puls</span>
                    <span className="text-[10px] font-mono-tabular px-1.5 py-[0.1rem] rounded bg-teal-500/20 text-teal-200 border border-teal-400/30">42 innsjekket</span>
                  </div>
                  <h2 className="text-sm font-bold text-[var(--foam)] mt-0.5">Avdelinger på bølgene</h2>
                </div>
                <button id="btn-checkin-pulse" type="button" className="px-2.5 py-1.5 rounded-xl bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 transition-all cursor-pointer shadow">
                  + Sjekk inn min puls
                </button>
              </div>

              <p className="text-[11px] text-[var(--foam)]/65 leading-relaxed m-0">
                Hver avdeling flyter som en egen bøye på havoverflaten. Klikk på en avdeling for å inspisere deres tidevann, eller sammenlign hvem som trenger fredagskake.
              </p>

              {/* Department List */}
              <div id="dept-list" className="space-y-2 max-h-52 overflow-y-auto pr-1"></div>

              {/* Slack / Teams status integration preview */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[var(--foam)]/60 font-mono-tabular">
                <span>Slack: #helgefølelse-puls</span>
                <span id="company-spread-label" className="text-teal-200">Spredning: 18%</span>
              </div>
            </aside>

            {/* PANEL C: AESTHETIC & MOTION THEMES (Mode: vibe) */}
            <aside id="panel-vibe" className="hidden pointer-events-auto glass-panel rounded-2xl p-4 sm:p-5 w-full max-w-sm ml-auto space-y-3.5">
              <div className="border-b border-white/10 pb-2.5">
                <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-teal-300 block">Designretninger</span>
                <h2 className="text-sm font-bold text-[var(--foam)]">Velg visuell atmosfære</h2>
              </div>

              <div className="space-y-2 text-xs">
                <button type="button" data-theme="nordic-sea" className="theme-card w-full text-left p-3 rounded-xl bg-white/10 border border-teal-400/50 hover:bg-white/15 transition-all cursor-pointer flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[var(--foam)]">1. Nordisk Hav (Original+)</div>
                    <div className="text-[11px] text-[var(--foam)]/65">Dyp sjøgrønn, skumhvit typografi og bioluminescens.</div>
                  </div>
                  <span className="w-4 h-4 rounded-full bg-[#17a39b] border border-white/40 shrink-0"></span>
                </button>

                <button type="button" data-theme="hygge" className="theme-card w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 transition-all cursor-pointer flex items-center justify-between">
                  <div>
                    <div className="font-bold text-amber-200">2. Fredagspils & Hyttelykt</div>
                    <div className="text-[11px] text-[var(--foam)]/65">Varm gyllen rav, peisglød og roligere dønninger.</div>
                  </div>
                  <span className="w-4 h-4 rounded-full bg-amber-500 border border-white/40 shrink-0"></span>
                </button>

                <button type="button" data-theme="sonar" className="theme-card w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 transition-all cursor-pointer flex items-center justify-between">
                  <div>
                    <div className="font-bold text-cyan-300">3. Bathysphere Instrument</div>
                    <div className="text-[11px] text-[var(--foam)]/65">Teknisk sonar-rutenett, presisjonsmåler og skarp cyan.</div>
                  </div>
                  <span className="w-4 h-4 rounded-full bg-cyan-400 border border-white/40 shrink-0"></span>
                </button>
              </div>
            </aside>

          </div>

          {/* Center Interactive Hint (Fades out after interaction) */}
          <div id="ripple-hint" className="self-center pointer-events-none transition-opacity duration-1000 opacity-60 text-center mt-auto mb-3">
            <span className="text-[11px] font-mono-tabular uppercase tracking-widest px-3 py-1 rounded-full bg-black/20 border border-white/10 text-[var(--foam)]/80">
              Dra i vannoverflaten for krusninger · Bytt konsept i toppmenyen
            </span>
          </div>

          {/* Bottom Telemetry & Time-Travel Scrubber Dock */}
          <footer className="pointer-events-auto flex flex-col gap-3 max-w-4xl w-full mx-auto">

            {/* Expandable Week Curve Mini-Graph Card */}
            <div id="curve-drawer" className="glass-panel rounded-2xl p-4 sm:p-5 transition-all duration-300 hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--foam)] flex items-center gap-2">
                    <span>Helgefølelse-kurven gjennom uken</span>
                    <span className="text-[11px] font-mono-tabular font-normal text-teal-300/90 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-400/20">
                      Eksponentiell stigning (k=3.0) · Søndagsfall (k=4.5)
                    </span>
                  </h2>
                  <p className="text-xs text-[var(--foam)]/65 mt-0.5">
                    Fra mandag 00:00 stiger vannet eksponentielt mot fredag kl. 16:00, holder seg 100 % gjennom lørdagen, og trekker seg brått tilbake søndag kveld.
                  </p>
                </div>
                <button id="btn-close-drawer" type="button" className="text-xs text-[var(--foam)]/60 hover:text-[var(--foam)] px-2 py-1 rounded-lg">
                  Lukk ✕
                </button>
              </div>
              {/* Interactive SVG Curve Map */}
              <div className="relative w-full h-28 sm:h-32 bg-black/25 rounded-xl border border-white/10 p-2 overflow-hidden cursor-crosshair" id="curve-chart-box">
                <svg id="week-curve-svg" viewBox="0 0 700 120" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#17a39b" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#17a39b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Day dividers */}
                  <g stroke="rgba(233,246,242,0.08)" strokeWidth="1" strokeDasharray="3 3">
                    <line x1="100" y1="0" x2="100" y2="120" />
                    <line x1="200" y1="0" x2="200" y2="120" />
                    <line x1="300" y1="0" x2="300" y2="120" />
                    <line x1="400" y1="0" x2="400" y2="120" />
                    <line x1="500" y1="0" x2="500" y2="120" />
                    <line x1="600" y1="0" x2="600" y2="120" />
                  </g>
                  <path id="week-curve-area" fill="url(#curve-fill)" d="" />
                  <path id="week-curve-path" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" d="" />
                  <line id="week-curve-cursor" x1="0" y1="0" x2="0" y2="120" stroke="#e9f6f2" strokeWidth="1.5" strokeDasharray="2 2" />
                  <circle id="week-curve-dot" cx="0" cy="0" r="5" fill="#e9f6f2" stroke="#17a39b" strokeWidth="2.5" />
                </svg>
                <div className="absolute bottom-1.5 left-0 right-0 grid grid-cols-7 text-center text-[10px] font-mono-tabular text-[var(--foam)]/55 pointer-events-none">
                  <span>Man</span><span>Tir</span><span>Ons</span><span>Tor</span><span>Fre 16:00</span><span>Lør</span><span>Søn</span>
                </div>
              </div>
            </div>

            {/* Main Telemetry & Scrubber Bar */}
            <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Current Depth Band & Trend */}
                <div className="flex items-center gap-3">
                  <div id="band-badge" className="px-3 py-1.5 rounded-xl bg-teal-500/20 border border-teal-300/30 text-teal-100 font-bold text-sm sm:text-base tracking-tight flex items-center gap-2">
                    <span id="band-dot" className="w-2 h-2 rounded-full bg-teal-300"></span>
                    <span id="band-name">Ankeldypt</span>
                  </div>
                  <div className="flex flex-col">
                    <span id="trend-label" className="text-xs sm:text-sm font-semibold text-[var(--foam)] flex items-center gap-1.5">
                      Flommer inn mot helg
                    </span>
                    <span id="countdown-label" className="text-[11px] font-mono-tabular text-[var(--foam)]/65">
                      Beregner tid til helg...
                    </span>
                  </div>
                </div>

                {/* Velocity & Reset to Live button */}
                <div className="flex items-center gap-2.5 ml-auto">
                  <div className="hidden md:flex flex-col items-end pr-2 border-r border-white/10">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--foam)]/50 font-mono-tabular">Tidevannsfart</span>
                    <span id="velocity-readout" className="text-xs font-mono-tabular text-teal-200 font-medium">+0.00 %/t</span>
                  </div>

                  <button id="btn-reset-live" type="button" className="hidden px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-950/50 items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
                    <span>Tilbake til nåtid</span>
                  </button>
                </div>
              </div>

              {/* Interactive Time Scrubber */}
              <div className="flex items-center gap-3 pt-1 border-t border-white/10">
                <span className="text-[11px] font-mono-tabular text-[var(--foam)]/60 shrink-0 w-16" id="scrubber-day-label">Man 00:00</span>
                <div className="relative flex-1 flex items-center">
                  <input id="time-scrubber" type="range" min="0" max="168" step="0.05" defaultValue="0" className="tide-slider" aria-label="Tidsmaskin gjennom uken" />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" data-preset="4.5" className="preset-btn text-[10px] font-mono-tabular px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[var(--foam)]/75 transition-colors cursor-pointer" title="Mandag morgen kl 08:30">Man</button>
                  <button type="button" data-preset="65" className="preset-btn text-[10px] font-mono-tabular px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[var(--foam)]/75 transition-colors cursor-pointer" title="Onsdag ettermiddag kl 17:00">Ons</button>
                  <button type="button" data-preset="112" className="preset-btn text-[10px] font-mono-tabular px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 text-teal-200 border border-teal-400/20 transition-colors cursor-pointer" title="Fredag kl 16:00 — Full helg!">Fre 16</button>
                  <button type="button" data-preset="162" className="preset-btn text-[10px] font-mono-tabular px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[var(--foam)]/75 transition-colors cursor-pointer" title="Søndag kveld kl 18:00">Søn</button>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
