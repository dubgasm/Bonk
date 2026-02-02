// Dynamically load the correct native module for the current platform
const os = require('os');
const path = require('path');

const platform = os.platform();
const arch = os.arch();

let modulePath;
if (platform === 'darwin') {
  modulePath = arch === 'arm64' 
    ? './native-audio.darwin-arm64.node'
    : './native-audio.darwin-x64.node';
} else if (platform === 'linux') {
  modulePath = './native-audio.linux-x64.node';
} else if (platform === 'win32') {
  modulePath = './native-audio.win32-x64.node';
} else {
  throw new Error(`Unsupported platform: ${platform}`);
}

try {
  const native = require(modulePath);
  // Expose all exported symbols (AudioPlayer, get_waveform, etc.)
  module.exports = native;
} catch (e) {
  console.error(`Failed to load native audio module: ${e.message}`);
  console.error(`Tried to load: ${modulePath}`);
  throw e;
}
