import {randomBytes} from 'node:crypto';
import {records} from './client.mjs';

export function tableName(name) {
  if (!/^[a-z][a-z0-9_]{0,119}$/.test(name || '')) throw new Error('Use a simple lowercase FREEBASE_TABLE name');
  return name;
}
export async function readTable(api, table) {
  return records(await api.dispatch('SELECT',{table:tableName(table),limit:1000}));
}
export async function schemaSnapshot(api) {
  const tables=records(await api.dispatch('SHOW_TABLES'));
  if (tables.length>100) throw new Error('Schema example supports at most 100 tables');
  const output={};
  for (const table of tables) {
    const name=tableName(table.table_name);
    output[name]=records(await api.dispatch('DESCRIBE',{table:name}));
  }
  return output;
}
export function schemaDiff(before, after) {
  const added=Object.keys(after).filter(k=>!(k in before)).sort();
  const removed=Object.keys(before).filter(k=>!(k in after)).sort();
  const changed=Object.keys(before).filter(k=>k in after && JSON.stringify(before[k])!==JSON.stringify(after[k])).sort();
  return {added,removed,changed};
}
export function quality(rows) {
  const seen=new Set(); const duplicateIds=[]; const missing=[];
  rows.forEach((row,index)=>{
    if (row.id==null || row.id==='') missing.push(index+1);
    else if (seen.has(row.id)) duplicateIds.push(row.id);
    else seen.add(row.id);
  });
  return {rows:rows.length,missingIdRows:missing,duplicateIds,valid:missing.length===0&&duplicateIds.length===0};
}
export function parseCSV(input) {
  if (Buffer.byteLength(input)>1_000_000) throw new Error('CSV exceeds 1 MB limit');
  input=input.replace(/^\uFEFF/,'');
  const rows=[]; let row=[],cell='',quoted=false,closed=false;
  for (let i=0;i<input.length;i++) {
    const ch=input[i];
    if (quoted) {
      if (ch==='"' && input[i+1]==='"') { cell+='"';i++; }
      else if (ch==='"') { quoted=false;closed=true; }
      else cell+=ch;
    } else if (ch==='"' && !cell && !closed) quoted=true;
    else if (ch===',' || ch==='\n' || ch==='\r') {
      row.push(cell);cell='';closed=false;
      if (ch!==',') {
        if (ch==='\r' && input[i+1]==='\n') i++;
        rows.push(row);row=[];
      }
    } else {
      if (closed || ch==='"') throw new Error('Malformed CSV quoting');
      cell+=ch;
    }
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (cell || row.length || closed) {row.push(cell);rows.push(row);}
  const headers=rows.shift();
  if (!headers?.length || headers.some(h=>!/^[a-z][a-z0-9_]{0,39}$/.test(h)) || new Set(headers).size!==headers.length) throw new Error('CSV headers must be unique lowercase identifiers');
  if (rows.length>1000) throw new Error('CSV exceeds 1000-row limit');
  return rows.map(values=>{
    if (values.length!==headers.length) throw new Error('CSV column count mismatch');
    return Object.fromEntries(headers.map((h,i)=>[h,values[i]]));
  });
}
export function importPlan(rows, suffix=randomBytes(12).toString('hex')) {
  if (!Array.isArray(rows) || !rows.length || !/^[a-f0-9]{24}$/.test(suffix)) throw new Error('Cannot import empty or unsafe data');
  return {table:`fbx_csv_${suffix}`,columns:Object.keys(rows[0]).map(name=>({name,type:'text'})),rows};
}
export async function importCSV(api, plan, apply=false) {
  if (!/^fbx_csv_[a-f0-9]{24}$/.test(plan.table)) throw new Error('Only a new generated CSV table is allowed');
  if (!apply) return {mode:'preview',...plan};
  // Refuse collisions. Never replace an existing table or pretend this is transactional.
  const existing=records(await api.dispatch('SHOW_TABLES'));
  if (existing.some(r=>r.table_name===plan.table)) throw new Error('CSV target already exists');
  await api.dispatch('CREATE_TABLE',{table:plan.table,columns:plan.columns});
  try { await api.dispatch('INSERT',{table:plan.table,rows:plan.rows}); }
  catch { throw new Error(`Import failed; inspect the possibly partial table ${plan.table}. It was not automatically deleted.`); }
  return {table:plan.table,inserted:plan.rows.length};
}
export function jsonExport(rows) {
  return {format:'freebase-example/v1',truncatedPossible:rows.length>=1000,rows};
}
export function compareInstances(summaries) {
  return {instances:summaries.map(({label,rows})=>({label,...quality(rows)})),totalSampledRows:summaries.reduce((sum,s)=>sum+s.rows.length,0)};
}
export function auditTools(tools) {
  const read=[],write=[],unknown=[];
  for (const tool of tools) {
    if (/_list_tables$|_get$/.test(tool.name)) read.push(tool.name);
    else if (/_store$|_set$|_annotate_table$/.test(tool.name)) write.push(tool.name);
    else unknown.push(tool.name); // _query can mutate: never label it read-only.
  }
  return {read,write,requiresReview:unknown};
}
