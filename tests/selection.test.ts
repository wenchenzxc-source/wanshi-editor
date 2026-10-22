import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadSelect } from '../shared/selection';
import { newLayer } from '../shared/model';
test('CAD direction chooses window or crossing logic',()=>{
 const inside=newLayer('shape',{x:2,y:2,width:2,height:2});
 const crossing=newLayer('shape',{x:9,y:2,width:3,height:3});
 const locked={...newLayer('shape',{x:3,y:3,width:1,height:1}),locked:true};
 assert.deepEqual(cadSelect([inside,crossing,locked],{x:0,y:0},{x:10,y:10}),[inside.id]);
 assert.deepEqual(cadSelect([inside,crossing,locked],{x:10,y:10},{x:0,y:0}),[inside.id,crossing.id]);
});
