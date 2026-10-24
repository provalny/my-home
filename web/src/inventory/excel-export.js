import { createReadIndex, KINDS } from './model.js';
import { isSection } from './ikea-storage.js';
import { itemWear } from './wear.js';
import { itemRarity } from './rarity.js';
import { itemCollections } from './category-presets.js';

const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const encoder=new TextEncoder();
const col=index=>{let label='';for(let n=index+1;n;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;return label;};
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
// A standard ZIP/OOXML workbook, without macros, formulas or external links.
function zip(files){const local=[],central=[];let offset=0,centralSize=0;
  for(const [path,source] of files){const name=encoder.encode(path),data=encoder.encode(source),crc=crc32(data),header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0800,true);view.setUint16(12,0x21,true);view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,name.length,true);header.set(name,30);local.push(header,data);
    const entry=new Uint8Array(46+name.length),v=new DataView(entry.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x0800,true);v.setUint16(14,0x21,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);entry.set(name,46);central.push(entry);centralSize+=entry.length;offset+=header.length+data.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  const result=new Uint8Array(offset+centralSize+end.length);let position=0;for(const part of [...local,...central,end]){result.set(part,position);position+=part.length;}return result;
}
const cell=(value,style=0)=>({value,style});
const dateCell=value=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?cell(Math.round((Date.parse(value+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000),3):cell(value||'');
export function inventoryExportRows(doc){
  const index=createReadIndex(doc),nodes=doc.nodes.filter(n=>n.kind!=='room'&&!isSection(n)),fields=[...new Set(nodes.flatMap(n=>Object.keys(n.fields||{})))].sort((a,b)=>a.localeCompare(b,'ru'));
  const headers=['Название','Тип','Пространство','Комната','Адрес хранения','Категория','Подборки','Количество','Единица','Цена покупки, ₽','Текущая оценка, ₽','Износ, %','Состояние','Получение','Дата покупки','Годен до','Гарантия до','Добавлено','Есть фото','Заметки','Причина выбытия','Дата выбытия','Сумма продажи, ₽','Редкость',...fields];
  const row=n=>{let room=n;while(room&&room.kind!=='room')room=index.byId.get(room.parentId);return [n.name,KINDS[n.kind],index.space(n)?.name||'Без места',room?.name||'',index.address(n),index.categoryName(n.categoryId),itemCollections(doc,n).map(c=>c.name).join(', '),n.quantity,n.unit,cell(n.purchaseCents==null?null:n.purchaseCents/100,2),cell(n.currentCents==null?null:n.currentCents/100,2),itemWear(n),n.condition,n.acquisition==='purchase'?'Покупка':'Уже было',dateCell(n.purchasedAt),dateCell(n.expiry),dateCell(n.warranty),(n.createdAt||'').slice(0,10),n.photo?'Да':'Нет',n.notes,n.archived?.reason||'',dateCell(n.archived?.date),cell(n.archived?.saleCents==null?null:n.archived.saleCents/100,2),itemRarity(doc,n)?.name||'',...fields.map(f=>n.fields?.[f]||'')];};
  nodes.sort((a,b)=>index.address(a).localeCompare(index.address(b),'ru'));
  return {headers,active:nodes.filter(n=>!n.archived).map(row),archive:nodes.filter(n=>n.archived).map(row)};
}
function sheet(headers,rows){
  const render=(values,row,header=false)=>`<row r="${row}">${values.map((value,i)=>{const c=value&&typeof value==='object'?value:cell(value),ref=col(i)+row,style=header?1:c.style||0;if(c.value==null||c.value==='')return `<c r="${ref}" s="${style}"/>`;return typeof c.value==='number'&&Number.isFinite(c.value)?`<c r="${ref}" s="${style}"><v>${c.value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(c.value)}</t></is></c>`;}).join('')}</row>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(headers.length-1)}${rows.length+1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${headers.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===0?30:i===4||i===19?52:22}" customWidth="1"/>`).join('')}</cols><sheetData>${render(headers,1,true)}${rows.map((r,i)=>render(r,i+2)).join('')}</sheetData><autoFilter ref="A1:${col(headers.length-1)}${rows.length+1}"/></worksheet>`;
}
export function createInventoryWorkbook(doc){
  const data=inventoryExportRows(doc),sheets=[['Вещи',sheet(data.headers,data.active)],['Архив',sheet(data.headers,data.archive)]];
  const files=[['[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map(([name],i)=>`<sheet name="${name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml','<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00&quot; ₽&quot;"/><numFmt numFmtId="165" formatCode="dd.mm.yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF285C97"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"><alignment vertical="top" wrapText="1"/></xf><xf xfId="0" numFmtId="164" applyNumberFormat="1"/><xf xfId="0" numFmtId="165" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],...sheets.map(([,source],i)=>[`xl/worksheets/sheet${i+1}.xml`,source])];
  return zip(files);
}
export const EXCEL_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export function bytesBase64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
