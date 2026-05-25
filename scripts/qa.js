const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m'; // No Color
const BOLD = '\x1b[1m';

let PASS = 0;
let FAIL = 0;
let WARN = 0;

function pass(msg) {
  console.log(`  ${GREEN}✅ ${msg}${NC}`);
  PASS++;
}

function fail(msg, detail) {
  console.log(`  ${RED}❌ ${msg}${NC}`);
  if (detail) {
    console.log(`     ${RED}${detail}${NC}`);
  }
  FAIL++;
}

function warn(msg) {
  console.log(`  ${YELLOW}⚠️  ${msg}${NC}`);
  WARN++;
}

console.log('\n' + BOLD + '══════════════════════════════════════════' + NC);
console.log(BOLD + '  HabitForge QA Suite (Cross-Platform)' + NC);
console.log(BOLD + '══════════════════════════════════════════' + NC + '\n');

const projectRoot = path.resolve(__dirname, '..');

// Helper to run commands safely
function runCmd(cmd, cwdOption) {
  try {
    return execSync(cmd, { cwd: cwdOption, stdio: 'pipe', encoding: 'utf-8' });
  } catch (error) {
    throw new Error(error.stderr ? error.stderr.trim() : error.message.trim());
  }
}

// ─── 1. SHARED TYPES ───────────────────────────────
console.log(BOLD + '📦 Shared Types' + NC);
try {
  runCmd('npx tsc --noEmit', path.join(projectRoot, 'shared'));
  pass('TypeScript compilation');
} catch (err) {
  fail('TypeScript compilation', 'Run: cd shared && npx tsc --noEmit\n     Detail: ' + err.message);
}

// ─── 2. BACKEND ────────────────────────────────────
console.log('\n' + BOLD + '🖥️  Backend (NestJS)' + NC);
const backendDir = path.join(projectRoot, 'backend');

// TypeScript
try {
  runCmd('npx tsc --noEmit', backendDir);
  pass('TypeScript compilation');
} catch (err) {
  fail('TypeScript compilation', 'Run: cd backend && npx tsc --noEmit\n     Detail: ' + err.message);
}

// Prisma
try {
  runCmd('npx prisma validate', backendDir);
  pass('Prisma schema valid');
} catch (err) {
  fail('Prisma schema invalid', 'Run: cd backend && npx prisma validate\n     Detail: ' + err.message);
}

// Check Prisma client sync
try {
  const status = runCmd('npx prisma migrate status', backendDir);
  if (status.includes('Database schema is up to date') || status.includes('Following migration')) {
    pass('Database in sync with schema');
  } else {
    warn('Database may be out of sync — run: npx prisma migrate dev');
  }
} catch (err) {
  warn('Database sync status unknown (unable to run prisma status). Ensure DB is running if needed.\n     Detail: ' + err.message);
}

// Unit tests
try {
  runCmd('npm test -- --passWithNoTests --silent', backendDir);
  pass('Unit tests pass');
} catch (err) {
  fail('Unit tests failing', 'Run: cd backend && npm test\n     Detail: ' + err.message);
}

// Check for missing env vars
const envExamplePath = path.join(backendDir, '.env.example');
const envPath = path.join(backendDir, '.env');
if (fs.existsSync(envExamplePath)) {
  if (fs.existsSync(envPath)) {
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    // Parse variable names
    const getVars = (content) => {
      return content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const match = line.match(/^([A-Z0-9_]+)=/);
          return match ? match[1] : null;
        })
        .filter(Boolean);
    };

    const exampleVars = getVars(envExampleContent);
    const envVars = new Set(getVars(envContent));
    
    const missing = exampleVars.filter(v => !envVars.has(v));
    if (missing.length === 0) {
      pass('All env vars from .env.example present in .env');
    } else {
      fail(`Missing env vars in .env: ${missing.join(', ')}`, 'Compare backend/.env with backend/.env.example');
    }
  } else {
    fail('backend/.env file is missing', 'Copy backend/.env.example to backend/.env and configure it.');
  }
}

// ─── 3. MOBILE ─────────────────────────────────────
console.log('\n' + BOLD + '📱 Mobile (Expo)' + NC);
const mobileDir = path.join(projectRoot, 'mobile');

// TypeScript
try {
  runCmd('npx tsc --noEmit', mobileDir);
  pass('TypeScript compilation');
} catch (err) {
  fail('TypeScript compilation', 'Run: cd mobile && npx tsc --noEmit\n     Detail: ' + err.message);
}

// React version check
try {
  let reactPkg, rnPkg;
  try {
    reactPkg = require(path.join(mobileDir, 'node_modules', 'react', 'package.json'));
  } catch (e) {
    try {
      reactPkg = require(path.join(projectRoot, 'node_modules', 'react', 'package.json'));
    } catch (e2) {}
  }

  try {
    rnPkg = require(path.join(mobileDir, 'node_modules', 'react-native', 'package.json'));
  } catch (e) {
    try {
      rnPkg = require(path.join(projectRoot, 'node_modules', 'react-native', 'package.json'));
    } catch (e2) {}
  }

  if (reactPkg && rnPkg) {
    let rootReactVer = 'none';
    try {
      rootReactVer = require(path.join(projectRoot, 'node_modules', 'react', 'package.json')).version;
    } catch (e) {}

    pass(`React version: ${reactPkg.version}, React Native: ${rnPkg.version}`);
    
    if (rootReactVer !== 'none' && rootReactVer !== reactPkg.version) {
      warn(`Duplicate React: root=${rootReactVer}, mobile=${reactPkg.version} — ensure metro.config.js pins resolution`);
    }
  } else {
    fail('Cannot determine React version', 'Check mobile/node_modules/react or root node_modules/react');
  }
} catch (err) {
  fail('Cannot determine React version', 'Check mobile/node_modules/react or run npm install');
}

// Check expo-router entry point
try {
  const mobilePkg = require(path.join(mobileDir, 'package.json'));
  if (mobilePkg.main === 'expo-router/entry') {
    pass('Expo Router entry point configured');
  } else {
    fail(`package.json main should be 'expo-router/entry'`, `Got: ${mobilePkg.main}`);
  }
} catch (err) {
  fail('Cannot read mobile package.json', err.message);
}

// Check all router.replace/push targets have matching files
console.log('  Checking route references...');
const appDir = path.join(mobileDir, 'app');
let routeErrors = [];

const allRoutes = new Set();
function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

walkDir(appDir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const relativePath = path.relative(appDir, filePath);
    const baseName = path.basename(filePath);
    if (baseName.startsWith('_') || baseName.startsWith('+')) {
      return;
    }
    
    let route = relativePath
      .replace(/\\/g, '/') // windows normalize
      .replace(/\.[jt]sx?$/, ''); // strip extension
    
    // 1. Route with group folders (e.g., /(enforcement)/quizzing)
    let segmentsWithGroups = route.split('/');
    if (segmentsWithGroups[segmentsWithGroups.length - 1] === 'index') {
      segmentsWithGroups.pop();
    }
    allRoutes.add('/' + segmentsWithGroups.join('/'));
    
    // 2. Route without group folders (e.g., /quizzing)
    let segmentsWithoutGroups = route.split('/').filter(s => !(s.startsWith('(') && s.endsWith(')')));
    if (segmentsWithoutGroups[segmentsWithoutGroups.length - 1] === 'index') {
      segmentsWithoutGroups.pop();
    }
    allRoutes.add('/' + segmentsWithoutGroups.join('/'));
  }
});

walkDir(appDir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Find patterns like router.replace('/login') or router.push("/home")
    const regex = /router\.(replace|push)\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const routeRef = match[2];
      // Normalize route: strip query parameters if present
      let routeNormalized = routeRef.split('?')[0];

      if (!allRoutes.has(routeNormalized)) {
        routeErrors.push(routeRef);
      }
    }
  }
});

if (routeErrors.length === 0) {
  pass('All route references resolve to files');
} else {
  warn(`Some routes may not resolve:\n${routeErrors.map(r => `     - ${r}`).join('\n')}`);
}

// Component tests
try {
  runCmd('npm test -- --passWithNoTests --silent', mobileDir);
  pass('Component tests pass');
} catch (err) {
  fail('Component tests failing', 'Run: cd mobile && npm test\n     Detail: ' + err.message);
}

// ─── 4. CROSS-WORKSPACE ───────────────────────────
console.log('\n' + BOLD + '🔗 Cross-Workspace Checks' + NC);

// .gitignore check
const gitignorePath = path.join(projectRoot, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (gitignoreContent.includes('.env')) {
    pass('.env is in .gitignore');
  } else {
    fail('.env is NOT in .gitignore', 'Your secrets may be committed!');
  }
} else {
  fail('.gitignore file is missing');
}

// Check no secrets in committed files
try {
  const isGit = runCmd('git rev-parse --git-dir', projectRoot);
  if (isGit) {
    const files = runCmd('git ls-files', projectRoot).split('\n').filter(Boolean);
    const secretPattern = /sk-or-v1|OPENROUTER_API_KEY=.*[a-f0-9]{20}/;
    const compromisedFiles = [];
    
    files.forEach(f => {
      const fullPath = path.join(projectRoot, f);
      if (fs.existsSync(fullPath) && !f.includes('node_modules') && !f.includes('.env.example') && fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (secretPattern.test(content)) {
          compromisedFiles.push(f);
        }
      }
    });

    if (compromisedFiles.length === 0) {
      pass('No API keys found in tracked files');
    } else {
      fail('API keys found in tracked files', compromisedFiles.join('\n'));
    }
  }
} catch (e) {
  // Not a git repo or git not available, skip
}

// ─── SUMMARY ───────────────────────────────────────
console.log('\n' + BOLD + '══════════════════════════════════════════' + NC);
console.log(`  ${GREEN}✅ Passed: ${PASS}${NC}  ${RED}❌ Failed: ${FAIL}${NC}  ${YELLOW}⚠️  Warnings: ${WARN}${NC}`);
console.log(BOLD + '══════════════════════════════════════════' + NC + '\n');

if (FAIL > 0) {
  console.log(`${RED}${BOLD}QA FAILED — fix the errors above before continuing.${NC}\n`);
  process.exit(1);
} else {
  console.log(`${GREEN}${BOLD}QA PASSED — you're clear to proceed.${NC}\n`);
  process.exit(0);
}
