import { readFileSync } from 'node:fs';

// Until the Murkio packages are on the npm registry, the ones this package
// builds on come from their repositories (see package.json and .npmrc). A
// package published with such a dependency could not be installed from the
// registry, so `npm publish` stops here until they are plain versions.
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const fromGit = Object.entries(manifest.dependencies ?? {}).filter(([, spec]) => /^(github:|git\+|git:|https?:)/.test(spec));
if (fromGit.length > 0) {
  for (const [name, spec] of fromGit) console.error(`${name} is taken from ${spec}`);
  console.error('Publish the packages above first, then depend on their versions.');
  process.exit(1);
}
