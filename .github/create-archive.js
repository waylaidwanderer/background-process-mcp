
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import archiver from 'archiver';
import minimist from 'minimist';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const extensionJsonPath = path.join(projectRoot, 'gemini-extension.json');
const extensionJson = JSON.parse(fs.readFileSync(extensionJsonPath, 'utf-8'));
const extensionName = extensionJson.name; 

const rawArgs = process.argv.slice(2);
const args = minimist(rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs);
const platform = args.platform || process.platform;
const arch = args.arch || process.arch;

const releaseDir = path.join(projectRoot, 'release');
const packageDir = path.join(releaseDir, 'package');

function copyFiles(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(file => {
            copyFiles(path.join(src, file), path.join(dest, file));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

async function createPackage() {
    if (fs.existsSync(releaseDir)) {
        fs.rmSync(releaseDir, { recursive: true, force: true });
    }
    fs.mkdirSync(packageDir, { recursive: true });

    console.log('Copying necessary files...');
    const filesToCopy = [
        'dist',
        'bin',
        'node_modules',
        'gemini-extension.json',
        'GEMINI.md',
        'package.json',
        'pnpm-lock.yaml',
    ];
    filesToCopy.forEach(file => {
        const src = path.join(projectRoot, file);
        const dest = path.join(packageDir, file);
        if (fs.existsSync(src)) {
            copyFiles(src, dest);
        }
    });

    const archiveName = `${platform}.${arch}.${extensionName}`;
    const archivePath = path.join(releaseDir, archiveName);

    if (platform === 'win32') {
        await createZip(packageDir, `${archivePath}.zip`);
    } else {
        await createTarGz(packageDir, `${archivePath}.tar.gz`);
    }
}

function createZip(sourceDir, outPath) {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', err => reject(err));
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
        archive.on('error', err => reject(err));
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

(async () => {
    try {
        await createPackage();
        console.log('Package created successfully.');
    } catch (err) {
        console.error('Failed to create package:', err);
        process.exit(1);
    }
})();
