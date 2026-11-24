import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,importCSV,importPlan,readTable,schemaSnapshot,tableName} from '../src/tools.mjs';
test('CSV supports BOM, embedded newline and escaped quotes',()=>{
  assert.deepEqual(parseCSV('\uFEFFid,note\n1,"line 1\nline ""2"""\n'),[{id:'1',note:'line 1\nline "2"'}]);
  for (const input of ['id,note\n1,"x"y','id,note\n1,a"b','id,id\n1,2','bad header\nx']) assert.throws(()=>parseCSV(input));
  assert.throws(()=>parseCSV('id\n'+'a'.repeat(1_000_001)));
  assert.throws(()=>parseCSV('id\n'+Array(1001).fill('1').join('\n')));
});
test('import preview has no API dependency and cannot use existing names',async()=>{
  assert.equal((await importCSV(null,importPlan([{id:'1'}]),false)).mode,'preview');
  await assert.rejects(importCSV(null,{table:'people'},true),/generated/);
});
test('CSV import refuses collisions before writing',async()=>{
  const plan=importPlan([{id:'1'}]); const calls=[];
  const api={dispatch:async(op)=>{calls.push(op);return {columns:['table_name'],rows:[[plan.table]]};}};
  await assert.rejects(importCSV(api,plan,true),/already exists/);
  assert.deepEqual(calls,['SHOW_TABLES']);
});
test('CSV failure identifies partial new table and never deletes it',async()=>{
  const plan=importPlan([{id:'1'}]); const calls=[];
  const api={dispatch:async(op)=>{calls.push(op);if(op==='INSERT')throw new Error('failed');return {columns:['table_name'],rows:[]};}};
  await assert.rejects(importCSV(api,plan,true),error=>error.message.includes(plan.table));
  assert.deepEqual(calls,['SHOW_TABLES','CREATE_TABLE','INSERT']);
});
test('CSV success creates only its randomized table',async()=>{
  const plan=importPlan([{id:'1'}]); const calls=[];
  const api={dispatch:async(op,args)=>{calls.push({op,args});return {columns:['table_name'],rows:[]};}};
  assert.deepEqual(await importCSV(api,plan,true),{table:plan.table,inserted:1});
  assert.equal(calls[2].args.table,plan.table);
});
test('bounded reads reject unsafe names and include an explicit limit',async()=>{
  for(const name of ['users; DROP TABLE users','../users','a.b','_system','']) assert.throws(()=>tableName(name));
  await readTable({dispatch:async(op,args)=>{assert.equal(op,'SELECT');assert.equal(args.limit,1000);return {columns:[],rows:[]};}},'people');
});
test('schema discovery uses advertised table names and DESCRIBE',async()=>{
  const api={dispatch:async(op,args)=>op==='SHOW_TABLES' ? {columns:['table_name'],rows:[['people']]} : {columns:['column_name','data_type'],rows:[['id','integer']]}};
  assert.deepEqual(await schemaSnapshot(api),{people:[{column_name:'id',data_type:'integer'}]});
});
