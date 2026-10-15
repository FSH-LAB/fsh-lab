import type { PlaywrightTestConfig } from "@playwright/test";

export interface NextPlaywrightOptions {
  appName: string;
  port: number;
  overrides?: PlaywrightTestConfig;
}

export declare function defineNextPlaywrightConfig(
  options: NextPlaywrightOptions,
): PlaywrightTestConfig;
