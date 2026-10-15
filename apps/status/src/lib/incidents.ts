import type { Incident, ScheduledMaintenance } from "./types";

/**
 * Authoritative record of active incidents.
 * Only populated when a genuine incident is occurring.
 */
export const ACTIVE_INCIDENTS: Incident[] = [];

/**
 * Authoritative record of planned maintenance windows.
 * Only populated when genuine scheduled maintenance is announced.
 */
export const SCHEDULED_MAINTENANCES: ScheduledMaintenance[] = [];

/**
 * Historical incident log covering past 90 days.
 * Only populated with real, verified incident post-mortems and resolutions.
 */
export const PAST_INCIDENTS: Incident[] = [];
