import fs from 'node:fs';
import path from 'node:path';
const r=JSON.parse(fs.readFileSync('web/src/inventory/releases.json','utf8'))[0];
const notes=`## ${r.title}\n\n${r.changes.map(s=>'- '+s).join('\n')}\n\n## Install / Установка\n\nDownload the DMG, open it and drag Мой дом to Applications. Requires macOS 13 or later, Apple silicon or Intel. / Скачайте DMG и перенесите «Мой дом» в «Программы».\n\nThis early build is ad-hoc signed and not notarized by Apple. Follow the first-launch instructions in the README if macOS asks for approval. Update archives are signed with Ed25519. / Ранняя сборка без нотарификации Apple; порядок первого запуска описан в README. Архивы обновлений подписаны Ed25519.\n\nYour local inventory and backups stay on your Mac. / Данные квартиры и копии остаются на вашем Mac.\n`;
const dir=process.argv[2];fs.mkdirSync(dir||'build',{recursive:true});
fs.writeFileSync(dir?path.join(dir,`MyHome-${r.version}.md`):'build/release-notes.md',notes);
