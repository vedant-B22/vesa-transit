import localtunnel from 'localtunnel';
import fs from 'fs';

async function startTunnel() {
  try {
    console.log('Starting localtunnel to port 5001...');
    const tunnel = await localtunnel({ port: 5001 });
    console.log('Localtunnel established at URL:', tunnel.url);
    fs.writeFileSync('tunnel_link.txt', tunnel.url);
    
    tunnel.on('close', () => {
      console.log('Localtunnel closed.');
    });
  } catch (err) {
    console.error('Localtunnel error:', err);
    fs.writeFileSync('tunnel_link.txt', 'ERROR: ' + err.message);
  }
}

startTunnel();
