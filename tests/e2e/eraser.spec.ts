import { test, expect } from '@playwright/test';
test('erase, reload, clear confirmation and undo',async({page})=>{
 await page.setViewportSize({width:1500,height:1100});await page.goto('/');
 await page.getByRole('button',{name:'筆刷',exact:true}).click();await page.getByRole('button',{name:'自由筆刷',exact:true}).click();
 const box=(await page.getByLabel('繪畫區').boundingBox())!;
 await page.mouse.move(box.x+80,box.y+100);await page.mouse.down();await page.mouse.move(box.x+180,box.y+100,{steps:10});await page.mouse.up();
 const draft=()=>page.evaluate(async()=>(await fetch('/api/designs/'+localStorage.getItem('wanshi:last-design'))).json());
 await expect.poll(async()=>(await draft()).design.layers.length).toBe(1);
 await page.getByRole('button',{name:'橡皮擦',exact:true}).click();await page.getByLabel('繪畫區').click({position:{x:130,y:100}});
 await expect.poll(async()=>(await draft()).design.layers[0].erasures?.length||0).toBeGreaterThan(0);
 const saved=(await draft()).design.layers;await page.reload();await expect(page.getByRole('button',{name:'清空畫布',exact:true})).toBeVisible();expect((await draft()).design.layers).toEqual(saved);
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'清空畫布',exact:true}).click();expect((await draft()).design.layers).toEqual(saved);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'清空畫布',exact:true}).click();await expect.poll(async()=>(await draft()).design.layers.length).toBe(0);
 await page.keyboard.press('Control+z');await expect.poll(async()=>(await draft()).design.layers).toEqual(saved);
});
