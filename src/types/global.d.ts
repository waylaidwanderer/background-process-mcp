export {};

declare global {
    // Injected during packaging for runtime metadata.
    const BGPM_PACKAGE_INFO: {
        name: string;
        version: string;
    } | undefined;
}
