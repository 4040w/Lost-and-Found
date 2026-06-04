const version = typeof __wxConfig !== 'undefined' ? __wxConfig.envVersion : 'develop';

// LAN IP for when phone and PC share the same network.
// Update CPOLAR_URL to your active cpolar tunnel URL 
// when the phone can only reach WAN.
const LAN_URL    = 'http://10.74.165.202:2349';
const CPOLAR_URL = 'https://59f07d80.r12.cpolar.top';

// Derive WS URL from HTTP URL: http:// → ws://, https:// → wss://
function toWsUrl(httpUrl) {
  return httpUrl.replace(/^http/i, 'ws');
}

const ENV = {
  develop: { baseUrl: CPOLAR_URL, wsUrl: toWsUrl(CPOLAR_URL) },
  trial:   { baseUrl: CPOLAR_URL, wsUrl: toWsUrl(CPOLAR_URL) },
  release: { baseUrl: CPOLAR_URL, wsUrl: toWsUrl(CPOLAR_URL) }
};

export default ENV[version] || ENV.develop;
