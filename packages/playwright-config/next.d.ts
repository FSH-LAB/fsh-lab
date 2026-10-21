import type { PlaywrightTestConfig } from "@playwright/test";

export interface NextPlaywrightOptions {
  appName: string;
  port: number;
  env?: Record<string, string>;
  overrides?: PlaywrightTestConfig;
}

export declare function defineNextPlaywrightConfig(
  options: NextPlaywrightOptions,
): PlaywrightTestConfig;
