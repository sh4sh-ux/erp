import {emptyData} from './core.mjs';
import {validateCompany} from './company-contract.mjs';
import {openWorkspace} from './workspace.mjs';
const data=emptyData();let calls=0;
openWorkspace(data,()=>{}, {async checkCompanyWrite(){if(new URL(location.href).searchParams.has('blocked'))throw Error('synthetic unavailable validator');return {ready:true};},async createCompany(record){
 const company=validateCompany(record);
 if(data.companies.some(row=>row.id===company.id))throw Error('duplicate');
 calls++;document.documentElement.dataset.syntheticSaves=String(calls);
 return [...data.companies,company];
}});
