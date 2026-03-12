const { execSync } = require('child_process');

exports.default = async function (context) {
  if (process.platform !== 'darwin') return;
  const appPath = context.appOutDir;
  console.log(`Cleaning resource forks in ${appPath}...`);
  execSync(`dot_clean -m "${appPath}"`, { stdio: 'inherit' });
  execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
  // com.apple.provenance is not removed by -c on some macOS versions
  try {
    execSync(`xattr -dr com.apple.provenance "${appPath}"`, { stdio: 'inherit' });
  } catch (e) {}
  try {
    execSync(`xattr -dr com.apple.quarantine "${appPath}"`, { stdio: 'inherit' });
  } catch (e) {}
  console.log('Done cleaning.');
};
