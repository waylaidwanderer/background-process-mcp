/* eslint-disable import-x/no-extraneous-dependencies, no-underscore-dangle, no-console */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import archiver from 'archiver';
import { build } from 'esbuild';
import minimist from 'minimist';
import { getAbi } from 'node-abi';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const extensionJsonPath = path.join(projectRoot, 'gemini-extension.json');
const extensionJson = JSON.parse(
  await fsPromises.readFile(extensionJsonPath, 'utf-8'),
);
const extensionName = extensionJson.name;

const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(
  await fsPromises.readFile(packageJsonPath, 'utf-8'),
);

const rawArgs = process.argv.slice(2);
const args = minimist(rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs);
const platform = args.platform || process.platform;
const arch = args.arch || process.arch;

const releaseDir = path.join(projectRoot, 'release');
const packageDir = path.join(releaseDir, 'package');
const outputFile = path.join(packageDir, 'cli.js');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const defaultNodeTargets = process.env.BGPM_NODE_TARGETS
  ? process.env.BGPM_NODE_TARGETS.split(',')
  : ['20.18.0', '22.11.0', '24.3.0'];
const nodeTargets = Array.from(new Set(
  defaultNodeTargets
    .map((version) => version.trim())
    .filter(Boolean),
));

async function ensureCleanOutput() {
  try {
    await fsPromises.rm(releaseDir, { recursive: true, force: true });
  } catch (error) {
    if ((error)?.code !== 'ENOENT') {
      throw error;
    }
  }
  await fsPromises.mkdir(packageDir, { recursive: true });
}

function reactDevtoolsStubPlugin() {
  return {
    name: 'react-devtools-stub',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^react-devtools-core$/ }, () => ({
        path: 'react-devtools-core',
        namespace: 'react-devtools-stub',
      }));
      buildContext.onLoad({ filter: /.*/, namespace: 'react-devtools-stub' }, () => ({
        contents: 'export default { initialize() {}, connectToDevTools() {} };',
        loader: 'js',
      }));
    },
  };
}

async function copyDirectory(source, destination) {
  await fsPromises.mkdir(destination, { recursive: true });
  const entries = await fsPromises.readdir(source, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
        return;
      }
      if (entry.isSymbolicLink()) {
        const target = await fsPromises.readlink(srcPath);
        await fsPromises.symlink(target, destPath);
        return;
      }
      await fsPromises.copyFile(srcPath, destPath);
    }),
  );
}

function runCommand(command, cmdArgs, { env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, cmdArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: env ? { ...process.env, ...env } : process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${cmdArgs.join(' ')} exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

async function rebuildNodePty(targetVersion) {
  const env = targetVersion
    ? {
      npm_config_target: targetVersion,
      npm_config_disturl: 'https://nodejs.org/download/release',
      npm_config_runtime: 'node',
    }
    : undefined;
  await runCommand(pnpmCommand, ['rebuild', 'node-pty'], { env });
}

async function buildNodePtyPrebuilts(sourceRoot, destinationRoot) {
  if (nodeTargets.length === 0) {
    return;
  }
  const prebuiltRoot = path.join(destinationRoot, 'prebuilt');
  await fsPromises.mkdir(prebuiltRoot, { recursive: true });
  const originalNodeVersion = process.versions.node;
  /* eslint-disable no-await-in-loop */
  for (let index = 0; index < nodeTargets.length; index += 1) {
    const targetVersion = nodeTargets[index];
    let buildSucceeded = true;
    try {
      await rebuildNodePty(targetVersion);
    } catch (error) {
      console.warn(
        `Warning: failed to rebuild node-pty for Node ${targetVersion}:`,
        error,
      );
      buildSucceeded = false;
    }
    if (buildSucceeded) {
      const abi = getAbi(targetVersion, 'node');
      const destDir = path.join(prebuiltRoot, `node-v${abi}`);
      await fsPromises.rm(destDir, { recursive: true, force: true });
      await copyDirectory(path.join(sourceRoot, 'build'), destDir);
    }
  }
  /* eslint-enable no-await-in-loop */
  await rebuildNodePty(originalNodeVersion);
}

async function copyNodePtyModule() {
  const nodePtySource = path.dirname(require.resolve('node-pty/package.json', {
    paths: [projectRoot],
  }));
  const nodeModulesDir = path.join(packageDir, 'node_modules');
  const nodePtyDestination = path.join(nodeModulesDir, 'node-pty');
  await fsPromises.mkdir(nodeModulesDir, { recursive: true });
  try {
    await fsPromises.rm(nodePtyDestination, { recursive: true, force: true });
  } catch (error) {
    if ((error)?.code !== 'ENOENT') {
      throw error;
    }
  }
  await copyDirectory(nodePtySource, nodePtyDestination);
  await fsPromises.rm(path.join(nodePtyDestination, 'build'), { recursive: true, force: true });
  await buildNodePtyPrebuilts(nodePtySource, nodePtyDestination);
}

async function bundleCli() {
  const define = {
    BGPM_PACKAGE_INFO: JSON.stringify({
      name: packageJson.name,
      version: packageJson.version,
    }),
    'process.platform': JSON.stringify(platform),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  };
  await build({
    bundle: true,
    entryPoints: [path.join(projectRoot, 'src', 'cli.ts')],
    outfile: outputFile,
    platform: 'node',
    target: ['node20'],
    format: 'esm',
    banner: {
      js: [
        '#!/usr/bin/env node',
        'import { createRequire as __createStandaloneRequire } from "node:module";',
        'const require = __createStandaloneRequire(import.meta.url);',
      ].join('\n'),
    },
    define,
    external: [
      'node-pty',
      'effect',
      'sury',
      '@valibot/to-json-schema',
    ],
    plugins: [reactDevtoolsStubPlugin()],
    logLevel: 'info',
  });
  await fsPromises.chmod(outputFile, 0o755);
  // Keep extension metadata alongside the CLI so installers can discover it.
  await fsPromises.copyFile(
    extensionJsonPath,
    path.join(packageDir, 'gemini-extension.json'),
  );
  const standalonePackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    type: 'module',
    bin: {
      [packageJson.bin?.bgpm ? 'bgpm' : 'cli']: './cli.js',
    },
  };
  await fsPromises.writeFile(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify(standalonePackageJson, null, 2)}\n`,
  );
  await copyNodePtyModule();
}

function createZip(sourceDir, outPath) {
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function createTarGz(sourceDir, outPath) {
  const output = fs.createWriteStream(outPath);
  const archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function archivePackage() {
  const archiveName = `${platform}.${arch}.${extensionName}`;
  const archiveBasePath = path.join(releaseDir, archiveName);

  if (platform === 'win32') {
    return createZip(packageDir, `${archiveBasePath}.zip`);
  }
  return createTarGz(packageDir, `${archiveBasePath}.tar.gz`);
}

(async () => {
  try {
    await ensureCleanOutput();
    await bundleCli();
    await archivePackage();
    console.log('Standalone CLI package created successfully.');
  } catch (err) {
    console.error('Failed to create package:', err);
    throw err;
  }
})();
