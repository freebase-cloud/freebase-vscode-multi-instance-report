import {readFile} from 'node:fs/promises';
import {configuration,Freebase} from './client.mjs';
import {MCP} from './mcp.mjs';
import {schemaDiff,schemaSnapshot,quality,readTable,parseCSV,importPlan,importCSV,jsonExport,compareInstances,auditTools} from './tools.mjs';
const text=f=>readFile(new URL('../data/'+f,import.meta.url),'utf8');
const load=async f=>JSON.parse(await text(f));
async function main() {
  const live=process.argv.includes('--live'),apply=process.argv.includes('--apply');
  if(apply&&!live) throw new Error('--apply requires --live and a locally configured instance');
  if(!live) { console.log(JSON.stringify(compareInstances(await load('sample.json')),null,2)); return; }
  const api=new Freebase(configuration());
  const other=configuration({...process.env,FREEBASE_INSTANCE_ID:process.env.FREEBASE_OTHER_INSTANCE_ID}); const summaries=[{label:'source',rows:await readTable(api,process.env.FREEBASE_TABLE)},{label:'target',rows:await readTable(new Freebase(other),process.env.FREEBASE_OTHER_TABLE)}]; console.log(JSON.stringify(compareInstances(summaries),null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
