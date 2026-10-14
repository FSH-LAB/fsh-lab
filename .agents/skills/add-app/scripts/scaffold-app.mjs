#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const TEMPLATES_DIR = path.resolve(__dirname, "../templates");

function printHelp() {
  console.log(`
Usage:
  node .agents/skills/add-app/scripts/scaffold-app.mjs <app-name> [display-name] [options]

Arguments:
  <app-name>              App slug (3-22 lowercase chars/digits/hyphens, e.g. "portal", "api-gateway")
  [display-name]          Human-readable app name (default: title-cased slug, e.g. "Api Gateway")

Options:
  --template <type>       Template type: "nextjs" (default) or "minimal" (polyglot / custom runtime)
  --port <port>           Local dev port (default: auto-detected next available port from 3000+)
  --dry-run               Print actions that would be taken without writing files
  --force                 Overwrite existing files if app directory exists
  --help, -h              Show this help message
`);
}

function titleCase(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseArgs(args) {
  let appName = "";
  let displayName = "";
  let template = "nextjs";
  let port = null;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--template") {
      i++;
      template = args[i]?.toLowerCase() || "nextjs";
      if (template !== "nextjs" && template !== "minimal") {
        console.error(
          `Error: Unsupported template "${template}". Choose "nextjs" or "minimal".`,
        );
        process.exit(1);
      }
    } else if (arg === "--port") {
      i++;
      port = parseInt(args[i], 10);
      if (Number.isNaN(port) || port < 1024 || port > 65535) {
        console.error(
          "Error: --port must be a valid integer between 1024 and 65535.",
        );
        process.exit(1);
      }
    } else if (!appName && !arg.startsWith("-")) {
      appName = arg;
    } else if (!displayName && !arg.startsWith("-")) {
      displayName = arg;
    }
  }

  if (!appName) {
    console.error("Error: <app-name> is required.");
    printHelp();
    process.exit(1);
  }

  const APP_NAME_REGEX = /^[a-z][a-z0-9-]{1,20}[a-z0-9]$/;
  if (!APP_NAME_REGEX.test(appName)) {
    console.error(
      `Error: Invalid app name "${appName}".\nMust match ^[a-z][a-z0-9-]{1,20}[a-z0-9]$ (3-22 lowercase letters, numbers, or hyphens, start with letter, end with letter/digit).\nRationale: GCP Service Account character limits for "<app>-runtime".`,
    );
    process.exit(1);
  }

  if (!displayName) {
    displayName = titleCase(appName);
  }

  return { appName, displayName, template, port, dryRun, force };
}

function detectNextPorts(appsDir) {
  let maxDevPort = 2999;
  let maxE2ePort = 3004;

  if (fs.existsSync(appsDir)) {
    const entries = fs.readdirSync(appsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pkgPath = path.join(appsDir, entry.name, "package.json");
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            const devScript = pkg.scripts?.dev || "";
            const match = devScript.match(/--port\s+(\d+)/);
            if (match) {
              const p = parseInt(match[1], 10);
              if (p > maxDevPort) maxDevPort = p;
            } else if (devScript.includes("next dev")) {
              if (3000 > maxDevPort) maxDevPort = 3000;
            }
          } catch {
            // ignore
          }
        }

        const playwrightPath = path.join(
          appsDir,
          entry.name,
          "playwright.config.ts",
        );
        if (fs.existsSync(playwrightPath)) {
          const content = fs.readFileSync(playwrightPath, "utf-8");
          const match = content.match(/const\s+PORT\s*=\s*(\d+)/);
          if (match) {
            const p = parseInt(match[1], 10);
            if (p > maxE2ePort) maxE2ePort = p;
          }
        }
      }
    }
  }

  return {
    nextDevPort: maxDevPort + 1,
    nextE2ePort: maxE2ePort + 1,
  };
}

function renderTemplate(templatePath, vars) {
  let content = fs.readFileSync(templatePath, "utf-8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(key, value);
  }
  return content;
}

function writeFile(destPath, content, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] Create ${path.relative(REPO_ROOT, destPath)}`);
    return;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content, "utf-8");
  console.log(`Created ${path.relative(REPO_ROOT, destPath)}`);
}

function updateInfraMain(appName, displayName, dryRun) {
  const infraMainPath = path.join(REPO_ROOT, "infra/main.tf");
  if (!fs.existsSync(infraMainPath)) {
    console.warn(
      `Warning: ${infraMainPath} not found. Skipping infra/main.tf update.`,
    );
    return;
  }

  let content = fs.readFileSync(infraMainPath, "utf-8");
  if (content.includes(`module "${appName}"`)) {
    console.log(
      `infra/main.tf already contains module "${appName}". Skipping.`,
    );
    return;
  }

  const moduleBlock = `
module "${appName}" {
  source = "./modules/cloud-run-app"

  app            = "${appName}"
  display_name   = "${displayName}"
  project_id     = google_project.environment.project_id
  region         = local.region
  deployer_email = google_service_account.deployer.email

  depends_on = [google_project_service.required]
}
`;

  const movedIndex = content.indexOf("moved {");
  if (movedIndex !== -1) {
    content =
      content.slice(0, movedIndex) +
      moduleBlock +
      "\n" +
      content.slice(movedIndex);
  } else {
    content += moduleBlock;
  }

  if (dryRun) {
    console.log(
      `[dry-run] Update infra/main.tf to declare module "${appName}"`,
    );
  } else {
    fs.writeFileSync(infraMainPath, content, "utf-8");
    console.log(`Updated infra/main.tf (added module "${appName}")`);
  }
}

function updateInfraOutputs(appName, dryRun) {
  const outputsPath = path.join(REPO_ROOT, "infra/outputs.tf");
  if (!fs.existsSync(outputsPath)) {
    console.warn(
      `Warning: ${outputsPath} not found. Skipping infra/outputs.tf update.`,
    );
    return;
  }

  let content = fs.readFileSync(outputsPath, "utf-8");
  if (
    content.includes(`    ${appName} = `) ||
    content.includes(`    ${appName} =`)
  ) {
    console.log(
      `infra/outputs.tf already contains output for "${appName}". Skipping.`,
    );
    return;
  }

  const match = content.match(
    /output\s+"service_urls"\s*\{[\s\S]*?value\s*=\s*\{([\s\S]*?)\}/,
  );
  if (match) {
    const existingEntries = match[1];
    const newEntry = `    ${appName} = module.${appName}.service_url\n`;
    const updatedEntries = existingEntries.trimEnd() + "\n" + newEntry;
    content = content.replace(existingEntries, updatedEntries + "  ");

    if (dryRun) {
      console.log(
        `[dry-run] Update infra/outputs.tf to include "${appName}" in service_urls`,
      );
    } else {
      fs.writeFileSync(outputsPath, content, "utf-8");
      console.log(
        `Updated infra/outputs.tf (added "${appName}" to service_urls)`,
      );
    }
  } else {
    console.warn(
      'Warning: Could not find output "service_urls" map in infra/outputs.tf.',
    );
  }
}

function updateCdWorkflow(appName, dryRun) {
  const cdPath = path.join(REPO_ROOT, ".github/workflows/cd.yml");
  if (!fs.existsSync(cdPath)) {
    console.warn(
      `Warning: ${cdPath} not found. Skipping .github/workflows/cd.yml update.`,
    );
    return;
  }

  let content = fs.readFileSync(cdPath, "utf-8");
  const dispatchAppMatch = content.match(
    /(workflow_dispatch:[\s\S]*?app:\s*[\s\S]*?options:\s*\[)(.*?)(\])/,
  );
  if (dispatchAppMatch) {
    const rawOptions = dispatchAppMatch[2];
    const options = rawOptions
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (!options.includes(appName)) {
      options.push(appName);
      const updatedSection = `${dispatchAppMatch[1]}${options.join(", ")}${dispatchAppMatch[3]}`;
      content = content.replace(dispatchAppMatch[0], updatedSection);

      if (dryRun) {
        console.log(
          `[dry-run] Update .github/workflows/cd.yml app options: [${options.join(", ")}]`,
        );
      } else {
        fs.writeFileSync(cdPath, content, "utf-8");
        console.log(
          `Updated .github/workflows/cd.yml (added "${appName}" to workflow_dispatch choices)`,
        );
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const { appName, displayName, template, port, dryRun, force } =
    parseArgs(args);

  const appsDir = path.join(REPO_ROOT, "apps");
  const targetAppDir = path.join(appsDir, appName);

  if (fs.existsSync(targetAppDir) && !force) {
    console.error(
      `Error: Directory already exists at ${path.relative(REPO_ROOT, targetAppDir)}.`,
    );
    console.error("Use --force to overwrite.");
    process.exit(1);
  }

  const portInfo = detectNextPorts(appsDir);
  const devPort = port || portInfo.nextDevPort;
  const e2ePort = portInfo.nextE2ePort;

  console.log(`\nScaffolding new app:`);
  console.log(`  App Name:     ${appName}`);
  console.log(`  Display Name: ${displayName}`);
  console.log(`  Template:     ${template}`);
  console.log(`  Dev Port:     ${devPort}`);
  if (template === "nextjs") {
    console.log(`  E2E Port:     ${e2ePort}`);
  }
  console.log(`  Target Dir:   apps/${appName}\n`);

  const vars = {
    __APP_NAME__: appName,
    __DISPLAY_NAME__: displayName,
    __PORT__: devPort.toString(),
    __E2E_PORT__: e2ePort.toString(),
  };

  // 1. Universal platform boundary templates (all apps)
  const universalMappings = [
    {
      tpl: path.join(TEMPLATES_DIR, "universal/deploy-workflow.yml.template"),
      dest: `.github/workflows/deploy-${appName}.yml`,
    },
    {
      tpl: path.join(TEMPLATES_DIR, "universal/smoke.mjs.template"),
      dest: `apps/${appName}/tests/smoke.mjs`,
    },
  ];

  // 2. Language/Runtime specific templates
  let stackMappings = [];
  if (template === "nextjs") {
    stackMappings = [
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/package.json.template"),
        dest: `apps/${appName}/package.json`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/tsconfig.json.template"),
        dest: `apps/${appName}/tsconfig.json`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/eslint.config.mjs.template"),
        dest: `apps/${appName}/eslint.config.mjs`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/next.config.ts.template"),
        dest: `apps/${appName}/next.config.ts`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/postcss.config.mjs.template"),
        dest: `apps/${appName}/postcss.config.mjs`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/vitest.config.mts.template"),
        dest: `apps/${appName}/vitest.config.mts`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/playwright.config.ts.template"),
        dest: `apps/${appName}/playwright.config.ts`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/Dockerfile.template"),
        dest: `apps/${appName}/Dockerfile`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/README.md.template"),
        dest: `apps/${appName}/README.md`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/health.route.ts.template"),
        dest: `apps/${appName}/src/app/api/health/route.ts`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/health.route.test.ts.template"),
        dest: `apps/${appName}/src/app/api/health/route.test.ts`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/layout.tsx.template"),
        dest: `apps/${appName}/src/app/layout.tsx`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/page.tsx.template"),
        dest: `apps/${appName}/src/app/page.tsx`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "nextjs/globals.css.template"),
        dest: `apps/${appName}/src/app/globals.css`,
      },
    ];
  } else if (template === "minimal") {
    stackMappings = [
      {
        tpl: path.join(TEMPLATES_DIR, "minimal/package.json.template"),
        dest: `apps/${appName}/package.json`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "minimal/server.mjs.template"),
        dest: `apps/${appName}/server.mjs`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "minimal/Dockerfile.template"),
        dest: `apps/${appName}/Dockerfile`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "minimal/tests/health.test.mjs.template"),
        dest: `apps/${appName}/tests/health.test.mjs`,
      },
      {
        tpl: path.join(TEMPLATES_DIR, "minimal/README.md.template"),
        dest: `apps/${appName}/README.md`,
      },
    ];
  }

  const allFiles = [...universalMappings, ...stackMappings];

  for (const { tpl, dest } of allFiles) {
    const destPath = path.join(REPO_ROOT, dest);
    const rendered = renderTemplate(tpl, vars);
    writeFile(destPath, rendered, dryRun);
  }

  // Update Infrastructure & CI/CD (Universal for all apps)
  updateInfraMain(appName, displayName, dryRun);
  updateInfraOutputs(appName, dryRun);
  updateCdWorkflow(appName, dryRun);

  console.log(`\n[Success] Scaffolding completed.`);
  console.log(`\nNext Steps:`);
  console.log(`  1. Run "pnpm install" to register the app in the workspace.`);
  console.log(
    `  2. Ensure your container exposes port 8080 and implements GET /api/health.`,
  );
  console.log(`  3. Verify verification gates:`);
  console.log(
    `     pnpm turbo run lint typecheck test build --filter=${appName}...`,
  );
  console.log(`     terraform -chdir=infra init -backend=false`);
  console.log(`     terraform -chdir=infra validate`);
  console.log(`     terraform -chdir=infra test`);
  console.log(`     pnpm lint:workflows`);
  console.log(
    `  4. (Optional) Register the app in "apps/status/src/lib/services.ts" for uptime monitoring.\n`,
  );
}

main().catch((err) => {
  console.error("Scaffolding failed:", err);
  process.exit(1);
});
