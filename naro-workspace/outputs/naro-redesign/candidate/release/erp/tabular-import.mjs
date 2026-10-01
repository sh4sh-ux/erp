// File parsing is local only. Persistence remains the existing merge/CAS path.
export const DATASETS=['companies','items','quotes','payments','stock_moves','material_moves'];
const MAX_ROWS=5000,MAX_CELLS=50000,MAX_TEXT=10000;
const fail=message=>{throw Error(message);};
const unsafe=new Set(['__proto__','prototype','constructor']);
export function safeJSON(text){
 return JSON.parse(text,(key,value)=>{if(unsafe.has(key))fail('허용되지 않는 필드입니다.');return value;});
}
export function parseCSV(text){
 if(typeof text!=='string'||text.length>7*1048576)fail('파일은 7MB 이하여야 합니다.');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false,cells=0;
 const pushCell=()=>{if(cell.length>MAX_TEXT||++cells>MAX_CELLS||row.length>=128)fail('가져오기 크기 제한을 초과했습니다.');row.push(cell);cell='';closed=false;};
 const pushRow=()=>{pushCell();if(row.some(v=>v!==''))rows.push(row);row=[];if(rows.length>MAX_ROWS+1)fail('한 번에 최대 5,000행을 가져올 수 있습니다.');};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
  else if(c==='"'){if(cell||closed)fail('CSV 따옴표 형식을 확인해 주세요.');quoted=true;}
  else if(c===',')pushCell();
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();}
  else {if(closed)fail('CSV 따옴표 뒤에는 구분자만 허용됩니다.');cell+=c;}
  if(cell.length>MAX_TEXT)fail('셀 내용이 너무 깁니다.');
 }
 if(quoted)fail('CSV 따옴표가 닫히지 않았습니다.');
 if(cell||row.length||closed)pushRow();return rows;
}
const numeric=new Set(['qty','price','amount','work_qty','per_unit','cost','unit_price','supply_price','tax_rate','buy_price','sell_price']);
const arrays=new Set(['prices','components','variants','lines','deliveries','audit']);
const aliases={'데이터':'dataset','ID':'id','상호':'name','품목명':'name','구분':'type','담당자':'contact','연락처':'phone','이메일':'email','메모':'memo'};
export function tableToBackup(rows,dataset){
 if(!Array.isArray(rows)||rows.length<2||rows.length>MAX_ROWS+1)fail('제목 행과 데이터 행이 필요합니다. 최대 5,000행입니다.');
 const headers=rows[0].map(h=>aliases[String(h).trim()]||String(h).trim());
 if(new Set(headers).size!==headers.length||headers.some(h=>!h||unsafe.has(h)||!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(h)))fail('열 이름이 비어 있거나 중복되었거나 올바르지 않습니다.');
 if(!headers.includes('id'))fail('중복 저장 방지를 위해 id 열이 필요합니다.');
 if(!dataset&&!headers.includes('dataset'))fail('CSV에는 dataset 열이 필요합니다.');
 if(dataset&&!DATASETS.includes(dataset))fail('Excel 시트 이름은 데이터 이름(companies 등)이어야 합니다.');
 const backup={app:'erp',format:1};let cells=0;
 for(const values of rows.slice(1)){
  if(values.length>headers.length||values.some(v=>String(v).length>MAX_TEXT)||(cells+=values.length)>MAX_CELLS)fail('행의 열 수 또는 크기를 확인해 주세요.');
  if(values.every(v=>v===''||v==null))continue;
  const record={};let key=dataset;
  for(let i=0;i<headers.length;i++){
   const field=headers[i],value=values[i]??'';
   if(field==='dataset'){if(dataset&&value&&value!==dataset)fail('시트 이름과 dataset 값이 다릅니다.');key=value||dataset;continue;}
   if(value==='')continue;
   if(arrays.has(field)){const parsed=safeJSON(String(value));if(!Array.isArray(parsed))fail(field+' 열은 JSON 배열이어야 합니다.');record[field]=parsed;}
   else if(numeric.has(field)){if(!/^-?\d+(\.\d+)?$/.test(String(value))||!Number.isFinite(Number(value)))fail(field+' 열은 숫자여야 합니다.');record[field]=Number(value);}
   else {if(field==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))fail('날짜는 YYYY-MM-DD 텍스트로 입력해 주세요.');record[field]=String(value);}
  }
  if(!DATASETS.includes(key))fail('지원하지 않는 dataset입니다.');
  if(!record.id?.trim())fail('모든 데이터 행에 고유한 id를 입력해 주세요.');
  if(key==='companies')record.prices??=[];
  if(key==='items'){record.components??=[];record.variants??=[];}
  if(key==='quotes')record.deliveries??=[];
  (backup[key]??=[]).push(record);
 }
 return backup;
}
function xml(text){
 if(/<!DOCTYPE|<!ENTITY/i.test(text))fail('XML 외부 참조는 허용되지 않습니다.');
 const document=new DOMParser().parseFromString(text,'application/xml');
 if(document.getElementsByTagName('parsererror').length)fail('Excel XML이 올바르지 않습니다.');return document;
}
const nodes=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
async function boundedText(file,budget){
 return new Promise((resolve,reject)=>{
  const chunks=[];let length=0,stopped=false;const stream=file.internalStream('uint8array');
  stream.on('data',chunk=>{
   length+=chunk.length;budget.used+=chunk.length;
   if(length>2*1048576||budget.used>16*1048576){stopped=true;stream.pause();reject(Error('압축 해제 크기 제한을 초과했습니다.'));return;}
   chunks.push(chunk);
  }).on('error',reject).on('end',()=>{if(stopped)return;try{const out=new Uint8Array(length);let at=0;for(const part of chunks){out.set(part,at);at+=part.length;}resolve(new TextDecoder('utf-8',{fatal:true}).decode(out));}catch{reject(Error('Excel UTF-8 내용을 읽을 수 없습니다.'));}}).resume();
 });
}
export async function parseXLSX(buffer,Zip){
 if(buffer.byteLength>7*1048576)fail('파일은 7MB 이하여야 합니다.');
 if(!Zip)fail('Excel 읽기 모듈을 불러오지 못했습니다.');
 const zip=await Zip.loadAsync(buffer,{createFolders:false});const entries=Object.values(zip.files);
 if(entries.length>200||entries.some(f=>/\.bin$|externalLinks|vbaProject/i.test(f.name)||f.unsafeOriginalName&&f.unsafeOriginalName!==f.name))fail('매크로·외부 연결 또는 비정상 Excel 파일은 허용되지 않습니다.');
 const budget={used:0},cache=new Map();
 const read=async name=>{if(cache.has(name))return cache.get(name);const file=zip.file(name);if(!file)fail('Excel 필수 항목이 없습니다.');const doc=xml(await boundedText(file,budget));cache.set(name,doc);return doc;};
 for(const file of entries.filter(f=>/\.rels$/.test(f.name))){const doc=await read(file.name);if(nodes(doc,'Relationship').some(r=>r.getAttribute('TargetMode')==='External'))fail('외부 연결을 포함한 Excel은 허용되지 않습니다.');}
 const workbook=await read('xl/workbook.xml'),rels=await read('xl/_rels/workbook.xml.rels');
 const shared=zip.file('xl/sharedStrings.xml')?nodes(await read('xl/sharedStrings.xml'),'si').map(si=>nodes(si,'t').map(t=>t.textContent).join('')):[];
 if(shared.length>MAX_CELLS||shared.some(s=>s.length>MAX_TEXT))fail('Excel 문자열 제한을 초과했습니다.');
 const result={app:'erp',format:1},sheets=nodes(workbook,'sheet');
 if(!sheets.length||sheets.length>6)fail('지원하는 데이터 시트는 최대 6개입니다.');
 let totalRows=0;
 for(const sheet of sheets){
  const name=sheet.getAttribute('name');if(!DATASETS.includes(name)||result[name])fail('시트 이름은 중복 없는 데이터 이름(companies 등)이어야 합니다.');
  const rid=sheet.getAttribute('r:id'),rel=nodes(rels,'Relationship').find(r=>r.getAttribute('Id')===rid);
  const target=rel?.getAttribute('Target')?.replace(/^\/?xl\//,'');
  if(!target||!/^worksheets\/sheet\d+\.xml$/.test(target))fail('지원하지 않는 Excel 시트 참조입니다.');
  const doc=await read('xl/'+target);if(nodes(doc,'f').length)fail('수식 대신 값으로 붙여넣은 Excel을 사용해 주세요.');
  const rows=[];let cells=0;
  for(const row of nodes(doc,'row')){
   const values=[];
   for(const cell of nodes(row,'c')){
    const ref=/^([A-Z]{1,3})([1-9]\d*)$/.exec(cell.getAttribute('r')||'');if(!ref)fail('Excel 셀 주소가 올바르지 않습니다.');
    const col=[...ref[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
    if(col>=128||values[col]!==undefined||++cells>MAX_CELLS)fail('Excel 열/셀 제한을 초과했습니다.');
    const type=cell.getAttribute('t'),v=nodes(cell,'v')[0]?.textContent??'';let value;
    if(type==='s'){if(!/^\d+$/.test(v)||Number(v)>=shared.length)fail('Excel 문자열 참조가 올바르지 않습니다.');value=shared[Number(v)];}
    else if(type==='inlineStr')value=nodes(cell,'t').map(t=>t.textContent).join('');
    else if(!type||type==='n'||type==='str')value=v;
    else fail('오류·논리값 셀 대신 텍스트 또는 숫자를 사용해 주세요.');
    values[col]=value;
   }
   rows.push(Array.from({length:values.length},(_,i)=>values[i]??''));
   if(rows.length>MAX_ROWS+1)fail('한 번에 최대 5,000행을 가져올 수 있습니다.');
  }
  totalRows+=rows.length-1;if(totalRows>MAX_ROWS)fail('한 번에 최대 5,000행을 가져올 수 있습니다.');
  Object.assign(result,tableToBackup(rows,name));
 }
 return result;
}
// Backups from the v1.186 GitHub Pages app carry two shapes the stricter contract rejects:
// companies made before 약정단가 existed have no `prices` (the old app read that as []), and
// stock moves keep the quote_id of a quote that was later deleted (the old app kept the
// history). Upgrade only those, in a copy: no record is dropped and no quantity changes.
export function upgradeLegacyBackup(backup){
 if(!backup||typeof backup!=='object'||backup.app!=='erp')return {backup,notes:[]};
 const out=structuredClone(backup),notes=[];
 if(Array.isArray(out.companies)){let n=0;for(const c of out.companies)if(c&&typeof c==='object'&&!Array.isArray(c.prices)&&c.prices===undefined){c.prices=[];n++;}if(n)notes.push(`약정단가가 없던 거래처 ${n}곳`);}
 if(Array.isArray(out.stock_moves)){
  const quotes=new Set((Array.isArray(out.quotes)?out.quotes:[]).map(q=>q?.id));let n=0;
  for(const m of out.stock_moves)if(m&&typeof m==='object'&&typeof m.quote_id==='string'&&m.quote_id&&!quotes.has(m.quote_id)){m.deleted_quote_id=m.quote_id;delete m.quote_id;n++;}
  if(n)notes.push(`삭제된 견적에 연결돼 있던 재고 기록 ${n}건(기록은 그대로 둡니다)`);
 }
 return {backup:out,notes};
}
export async function readImport(file,Zip){
 if(file.size>7*1048576)fail('파일은 7MB 이하여야 합니다.');
 const ext=file.name.split('.').at(-1).toLowerCase();
 if(ext==='json')return upgradeLegacyBackup(safeJSON(await file.text())).backup;
 if(ext==='csv')return tableToBackup(parseCSV(await file.text()));
 if(ext==='xlsx')return parseXLSX(await file.arrayBuffer(),Zip);
 fail('JSON, UTF-8 CSV 또는 .xlsx 파일을 선택해 주세요.');
}
