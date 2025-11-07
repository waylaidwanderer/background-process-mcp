import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PackageInfo {
    name: string;
    version: string;
}

declare const BGPM_PACKAGE_INFO: PackageInfo | undefined;

let cachedInfo: PackageInfo | null = null;

function resolvePackageJsonPath(): string {
    const currentFilename = fileURLToPath(import.meta.url);
    const currentDirname = path.dirname(currentFilename);
    return path.join(currentDirname, '..', '..', 'package.json');
}

function normalizePackageInfo(raw: Partial<PackageInfo>): PackageInfo {
    return {
        name: raw.name ?? 'background-process-mcp',
        version: raw.version ?? '0.0.0',
    };
}

export async function getPackageInfo(): Promise<PackageInfo> {
    if (typeof BGPM_PACKAGE_INFO !== 'undefined') {
        return BGPM_PACKAGE_INFO;
    }
    if (cachedInfo) {
        return cachedInfo;
    }
    try {
        const packageJsonPath = resolvePackageJsonPath();
        const packageJsonContent = await fsPromises.readFile(
            packageJsonPath,
            'utf-8',
        );
        const packageJson = JSON.parse(packageJsonContent) as Partial<PackageInfo>;
        cachedInfo = normalizePackageInfo(packageJson);
    } catch {
        cachedInfo = normalizePackageInfo({});
    }
    return cachedInfo;
}
