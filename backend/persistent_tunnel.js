import { spawn } from 'child_process';
import fs from 'fs';

function runTunnel() {
  console.log('Starting serveo tunnel...');
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-R', '80:localhost:5001',
    'serveo.net'
  ]);

  ssh.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    const match = output.match(/https:\/\/[a-zA-Z0-9.-]+\.serveousercontent\.com/);
    if (match) {
      fs.writeFileSync('tunnel_link.txt', match[0]);
      console.log('Tunnel URL updated:', match[0]);
    }
  });

  ssh.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  ssh.on('close', (code) => {
    console.log(`Tunnel process exited with code ${code}. Reconnecting in 5 seconds...`);
    setTimeout(runTunnel, 5000);
  });
}

runTunnel();
