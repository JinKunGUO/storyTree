#!/usr/bin/env node

/**
 * StoryTree 版本管理工具
 * 统一管理整个项目的版本信息
 *
 * 用法:
 *   node scripts/version-manager.js [command] [args]
 *
 * 命令:
 *   show                    - 显示当前版本 (默认)
 *   patch                   - 增加修订号: 1.0.0 → 1.0.1
 *   minor                   - 增加次版本号: 1.0.0 → 1.1.0
 *   major                   - 增加主版本号: 1.0.0 → 2.0.0
 *   stage <name>            - 设置开发阶段
 *   update                  - 更新Git信息
 *   set <key> <value>       - 设置版本字段
 *   changelog "message"     - 添加变更日志
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'VERSION.json');

function loadVersion() {
  if (!fs.existsSync(VERSION_FILE)) {
    return createDefaultVersion();
  }
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  } catch (e) {
    console.error('❌ Failed to parse VERSION.json');
    return createDefaultVersion();
  }
}

function createDefaultVersion() {
  return {
    name: 'storytree',
    version: '0.0.1',
    codename: 'dev',
    stage: 'dev',
    buildDate: new Date().toISOString(),
    commitHash: 'unknown',
    branch: 'main',
    repository: 'storytree',
    description: '分支式AI协作小说创作平台',
    features: [],
    changelog: {}
  };
}

function saveVersion(version) {
  version.buildDate = new Date().toISOString();
  fs.writeFileSync(VERSION_FILE, JSON.stringify(version, null, 2) + '\n');
  console.log(`✅ Version updated: ${version.version} (${version.codename})`);
}

function bumpVersion(type) {
  const version = loadVersion();
  const current = version.version;
  const [major, minor, patch] = current.split('.').map(Number);

  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  version.version = newVersion;

  // Add to changelog
  if (!version.changelog) version.changelog = {};
  version.changelog[newVersion] = {
    date: new Date().toISOString().split('T')[0],
    changes: ['版本更新']
  };

  saveVersion(version);
  return newVersion;
}

function setStage(stage) {
  const version = loadVersion();
  version.stage = stage;
  version.codename = `${stage}-Build`;
  saveVersion(version);
}

function updateGitInfo() {
  const version = loadVersion();

  try {
    version.commitHash = execSync('git rev-parse --short HEAD', { cwd: ROOT_DIR }).toString().trim();
  } catch (e) {
    version.commitHash = 'unknown';
  }

  try {
    version.branch = execSync('git branch --show-current', { cwd: ROOT_DIR }).toString().trim();
  } catch (e) {
    version.branch = 'main';
  }

  saveVersion(version);
}

function setField(key, value) {
  const version = loadVersion();
  version[key] = value;
  saveVersion(version);
}

function addChangelog(message) {
  const version = loadVersion();
  const current = version.version;

  if (!version.changelog) version.changelog = {};
  if (!version.changelog[current]) {
    version.changelog[current] = {
      date: new Date().toISOString().split('T')[0],
      changes: []
    };
  }

  version.changelog[current].changes.push(message);
  saveVersion(version);
}

function showVersion() {
  const version = loadVersion();

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║        📦 StoryTree Version Info       ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Name:       ${pad(version.name, 24)}║`);
  console.log(`║  Version:    ${pad(version.version, 24)}║`);
  console.log(`║  Codename:   ${pad(version.codename, 24)}║`);
  console.log(`║  Stage:      ${pad(version.stage, 24)}║`);
  console.log(`║  Branch:     ${pad(version.branch, 24)}║`);
  console.log(`║  Commit:     ${pad(version.commitHash, 24)}║`);
  console.log(`║  Features:   ${pad(version.features.length + ' items', 24)}║`);
  console.log(`║  Build Date: ${pad(version.buildDate, 24)}║`);
  console.log('╚════════════════════════════════════════╝\n');

  if (version.changelog && version.changelog[version.version]) {
    console.log('📝 Latest Changes:');
    version.changelog[version.version].changes.forEach(c => {
      console.log(`   • ${c}`);
    });
    console.log('');
  }
}

function pad(str, len) {
  const s = String(str);
  return s.length > len ? s.substring(0, len - 3) + '...' : s.padEnd(len, ' ');
}

function showHelp() {
  console.log(`
StoryTree Version Manager
========================

用法: node scripts/version-manager.js [command] [args]

命令:
  show                    显示当前版本信息
  patch                   增加修订版本号 (1.0.0 → 1.0.1)
  minor                   增加次要版本号 (1.0.0 → 1.1.0)
  major                   增加主要版本号 (1.0.0 → 2.0.0)
  stage <name>            设置开发阶段 (M1, M2, Alpha, Beta...)
  update                  更新Git信息 (commit hash, branch)
  set <key> <value>       设置版本字段
  changelog "message"     添加变更日志

示例:
  node scripts/version-manager.js
  node scripts/version-manager.js patch
  node scripts/version-manager.js stage M2
  node scripts/version-manager.js changelog "添加用户认证功能"
`);
}

// CLI
const [,, command, ...args] = process.argv;

switch (command) {
  case 'major':
  case 'minor':
  case 'patch':
    bumpVersion(command);
    break;
  case 'stage':
    if (args[0]) setStage(args[0]);
    else console.log('Usage: node scripts/version-manager.js stage <stage-name>');
    break;
  case 'update':
    updateGitInfo();
    break;
  case 'set':
    if (args[0] && args[1]) setField(args[0], args[1]);
    else console.log('Usage: node scripts/version-manager.js set <key> <value>');
    break;
  case 'changelog':
    if (args[0]) addChangelog(args.join(' '));
    else console.log('Usage: node scripts/version-manager.js changelog "message"');
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  case 'show':
  default:
    showVersion();
    break;
}
