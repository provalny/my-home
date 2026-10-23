import fs from 'node:fs';
const releases=JSON.parse(fs.readFileSync('web/src/inventory/releases.json','utf8'));
const config=JSON.parse(fs.readFileSync('distribution.json','utf8'));
const r=releases[0];
if(!/^\d+\.\d+\.\d+$/.test(r.version)||!Number.isSafeInteger(r.build))throw Error('Invalid release metadata');
if(process.env.GITHUB_REF_TYPE==='tag'&&process.env.GITHUB_REF_NAME!==`v${r.version}`)throw Error('Tag does not match app version');
if(process.env.GITHUB_REPOSITORY&&process.env.GITHUB_REPOSITORY!==config.repository)throw Error('Repository does not match distribution.json');
if(!config.repository||Buffer.from(config.publicKey,'base64').length!==32)throw Error('Configure update repository and public key');
console.log(`My Home ${r.version} (${r.build})`);
