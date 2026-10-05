// Docker build helper: removes optionalDependencies (the GitHub plus-erp-ai-client entry)
// from the build stage's package.json so npm does not try to fetch it from GitHub.
const fs = require('fs');

const file = process.argv[2] || 'package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
delete pkg.optionalDependencies;
fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
