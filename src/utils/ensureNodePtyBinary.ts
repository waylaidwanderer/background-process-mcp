/* eslint-disable n/no-sync */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function copyDirectorySync(source: string, destination: string): void {
    fs.mkdirSync(destination, { recursive: true });
    const entries = fs.readdirSync(source, { withFileTypes: true });
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
            copyDirectorySync(srcPath, destPath);
        } else if (entry.isSymbolicLink()) {
            const target = fs.readlinkSync(srcPath);
            fs.symlinkSync(target, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function copyPrebuilt(prebuiltDir: string, buildDir: string): void {
    fs.rmSync(buildDir, { recursive: true, force: true });
    copyDirectorySync(prebuiltDir, buildDir);
}

function resolveNodePtyRoot(): string | null {
    const rootsToCheck = new Set<string>();
    if (process.argv[1]) {
        rootsToCheck.add(path.dirname(process.argv[1]));
    }
    try {
        const currentFilename = fileURLToPath(import.meta.url);
        rootsToCheck.add(path.dirname(currentFilename));
    } catch {
        // ignore
    }
    rootsToCheck.add(process.cwd());

    const baseCandidates = Array.from(rootsToCheck);
    /* eslint-disable no-restricted-syntax */
    for (const base of baseCandidates) {
        let current = path.resolve(base);

        for (let i = 0; i < 6; i += 1) {
            const candidate = path.join(current, 'node_modules', 'node-pty');
            if (fs.existsSync(candidate)) {
                return candidate;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                break;
            }
            current = parent;
        }
    }
    /* eslint-enable no-restricted-syntax */
    return null;
}

export default function ensureNodePtyBinary(): void {
    const nodePtyRoot = resolveNodePtyRoot();
    if (!nodePtyRoot) {
        return;
    }
    const buildDir = path.join(nodePtyRoot, 'build');
    const abi = process.versions.modules;
    const prebuiltDir = path.join(nodePtyRoot, 'prebuilt', `node-v${abi}`);
    if (!fs.existsSync(prebuiltDir)) {
        return;
    }
    copyPrebuilt(prebuiltDir, buildDir);
}
