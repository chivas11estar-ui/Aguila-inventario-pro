import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const executable = (name) => (process.platform === 'win32' ? `${name}.cmd` : name);
const failures = [];

function commandVersion(command, args) {
  try {
    const runner = process.platform === 'win32' ? 'cmd.exe' : executable(command);
    const commandLine = `${command} ${args.join(' ')}${command === 'java' ? ' 2>&1' : ''}`;
    const runnerArgs = process.platform === 'win32' ? ['/d', '/s', '/c', commandLine] : args;
    const output = execFileSync(runner, runnerArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return { output, status: 'AVAILABLE' };
  } catch (error) {
    return { output: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim(), status: 'MISSING' };
  }
}

function majorVersion(value) {
  const match = value.match(/(?:v|version\s+)?(\d+)/i);
  return match ? Number(match[1]) : null;
}

function report(name, status, value, detail = '') {
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${name}: ${value}${suffix} [${status}]`);
  if (status !== 'AVAILABLE') failures.push(`${name}=${status}`);
}

function fileStatus(candidates) {
  const found = candidates.find((candidate) => existsSync(join(root, candidate)));
  return found ? { status: 'AVAILABLE', value: relative(root, join(root, found)) } : { status: 'MISSING', value: 'not found' };
}

const nodeVersion = process.version;
report('NODE_VERSION', majorVersion(nodeVersion) >= 20 ? 'AVAILABLE' : 'INCOMPATIBLE', nodeVersion, 'requires Node 20 or newer');
const npm = commandVersion('npm', ['--version']);
report('NPM_VERSION', npm.status, npm.output || 'unavailable');
const firebase = commandVersion('firebase', ['--version']);
report('FIREBASE_CLI_VERSION', firebase.status, firebase.output || 'unavailable');
const java = commandVersion('java', ['-version']);
const javaMajor = majorVersion(java.output || '');
const javaStatus = java.status === 'AVAILABLE' && javaMajor !== null && javaMajor >= 11 ? 'AVAILABLE' : java.status === 'AVAILABLE' ? 'INCOMPATIBLE' : 'MISSING';
report('JAVA_VERSION', javaStatus, (java.output || 'unavailable').split('\n')[0], 'requires Java 11 or newer');

let firebaseConfig = null;
const firebaseJson = join(root, 'firebase.json');
if (existsSync(firebaseJson)) {
  try {
    firebaseConfig = JSON.parse(readFileSync(firebaseJson, 'utf8'));
    report('FIREBASE_JSON_EXISTS', 'AVAILABLE', 'true');
  } catch (error) {
    report('FIREBASE_JSON_EXISTS', 'INCOMPATIBLE', 'true', `invalid JSON: ${error.message}`);
  }
} else {
  report('FIREBASE_JSON_EXISTS', 'MISSING', 'false');
}

const rulesPath = join(root, 'database.rules.json');
report('DATABASE_RULES_EXISTS', existsSync(rulesPath) ? 'AVAILABLE' : 'MISSING', existsSync(rulesPath) ? 'true' : 'false');
const emulators = firebaseConfig?.emulators ?? {};
const validPort = (value) => Number.isInteger(value) && value > 0 && value < 65536;
report('AUTH_EMULATOR_CONFIG', emulators.auth && validPort(emulators.auth.port) ? 'AVAILABLE' : 'MISSING', emulators.auth?.port ? `port ${emulators.auth.port}` : 'not configured');
report('DATABASE_EMULATOR_CONFIG', emulators.database && validPort(emulators.database.port) ? 'AVAILABLE' : 'MISSING', emulators.database?.port ? `port ${emulators.database.port}` : 'not configured');

const fixture = fileStatus(['tests/fixtures/qa-99922-baseline.json', 'qa-fixture-99922.json', 'qa-99922-fixture.json', 'qa-fixture.json', 'tests/fixtures/qa-99922.json', 'tests/fixtures/qa-fixture-99922.json', 'tests/fixtures/qa-fixture.json']);
report('QA_FIXTURE_EXISTS', fixture.status, fixture.value);
const restore = fileStatus(['tests/qa-restore.mjs', 'qa-restore.mjs']);
report('QA_RESTORE_EXISTS', restore.status, restore.value);
const harness = fileStatus(['tests/qa-write-harness.mjs', 'qa-write-harness.mjs']);
report('QA_HARNESS_EXISTS', harness.status, harness.value);
const baseline = fileStatus(['tests/fixtures/qa-99922-baseline.json', 'qa-99922-baseline.json']);
report('QA_BASELINE_EXISTS', baseline.status, baseline.value);

if (failures.length > 0) {
  console.log(`PREFLIGHT_STATUS: ${failures.some((failure) => failure.includes('INCOMPATIBLE')) ? 'INCOMPATIBLE' : 'MISSING'}`);
  console.log(`PREFLIGHT_FAILURES: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('PREFLIGHT_STATUS: AVAILABLE');
}
