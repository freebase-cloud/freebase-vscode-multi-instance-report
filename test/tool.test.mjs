import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schemaDiff,quality,parseCSV,importPlan,importCSV,jsonExport,compareInstances,auditTools} from '../src/tools.mjs';
test("Compare two instance samples",async()=>{assert.equal(compareInstances([{label:'a',rows:[{id:1}]},{label:'b',rows:[]}]).totalSampledRows,1);});
