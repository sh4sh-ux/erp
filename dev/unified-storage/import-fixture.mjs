import {parseXLSX} from './erp/tabular-import.mjs';
const results=[];
async function workbook({formula=false,macro=false,external=false,entity=false,oversize=false}={}){
 const zip=new window.JSZip();
 zip.file('xl/workbook.xml','<workbook xmlns:r="urn:rels"><sheets><sheet name="companies" r:id="r1"/></sheets></workbook>');
 zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"'+(external?' TargetMode="External"':'')+'/></Relationships>');
 const cell=(r,v)=>`<c r="${r}" t="inlineStr"><is><t>${v}</t></is></c>`;
 zip.file('xl/worksheets/sheet1.xml',(entity?'<!DOCTYPE worksheet [<!ENTITY x "bad">]>':'')+'<worksheet><sheetData><row>'+cell('A1','id')+cell('B1','name')+cell('C1','type')+'</row><row>'+cell('A2','synthetic-c')+cell('B2',oversize?'x'.repeat(2100000):'합성 Excel 거래처')+cell('C2','매출')+(formula?'<c r="D2"><f>1+1</f><v>2</v></c>':'')+'</row></sheetData></worksheet>');
 if(macro)zip.file('xl/vbaProject.bin','not executable');
 return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}
for(const [name,options,reject] of [['valid XLSX',{},false],['formula blocked',{formula:true},true],['macro blocked',{macro:true},true],['external link blocked',{external:true},true],['DTD blocked',{entity:true},true],['zip expansion bounded',{oversize:true},true]]){
 try{const data=await parseXLSX(await workbook(options),window.JSZip);if(reject||data.companies[0].name!=='합성 Excel 거래처')throw Error('unexpected success');results.push(name+': PASS');}
 catch(error){results.push(name+': '+(reject&&error.message!=='unexpected success'?'PASS':'FAIL '+error.message));}
}
document.getElementById('results').textContent=results.join('\n');document.documentElement.dataset.result=results.every(r=>r.endsWith('PASS'))?'PASS':'FAIL';
