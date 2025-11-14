import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let envLoaded = false;

const ENV_FILES = ['.env.local', '.env'];

export function ensureServerEnvLoaded(): void {
  if (envLoaded) {
    return;
  }

  envLoaded = true;

  for (const fileName of ENV_FILES) {
    const filePath = resolve(process.cwd(), fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    try {
      process.loadEnvFile(filePath);
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        process.emitWarning(
          `Failed to load environment file ${filePath}: ${(error as Error).message}`
        );
      }
    }
  }
}

ensureServerEnvLoaded();

