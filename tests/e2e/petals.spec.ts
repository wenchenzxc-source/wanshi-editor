import { test, expect } from '@playwright/test';
test('falling petals vary and persist exactly across reload and undo', async ({page}) => {
 await page.setViewportSize({width:1500,height:1100}); await page.goto('/');
 await page.getByRole('button',{name:'筆刷',exact:true}).click(); await page.getByRole('button',{name:'飄落櫻花',exact:true}).click();
 await page.getByRole('button',{name:'灑落整個版面',exact:true}).click();
 const draft=()=>page.evaluate(async()=> (await fetch('/api/designs/'+localStorage.getItem('wanshi:last-design'))).json());
 await expect.poll(async()=> (await draft()).design.layers.length).toBe(6);
 const first=(await draft()).design.layers; expect(new Set(first.map((l:any)=>l.rotation)).size).toBe(6);
 await page.getByRole('button',{name:'飄落玫瑰',exact:true}).click();
 await page.getByLabel('繪畫區').click({position:{x:180,y:180}});
 await expect.poll(async()=> (await draft()).design.layers.length).toBe(12);
 expect((await draft()).design.layers.slice(6).every((l:any)=>l.flowerType==='rose')).toBe(true);
 await page.keyboard.press('Control+z'); await expect.poll(async()=> (await draft()).design.layers.length).toBe(6);
 await page.keyboard.press('Control+Shift+z'); await expect.poll(async()=> (await draft()).design.layers.length).toBe(12);
 const saved=(await draft()).design.layers;
 await page.screenshot({path:'test-results/falling-petals.png',fullPage:true});
 await page.reload(); await expect(page.getByRole('button',{name:'筆刷',exact:true})).toBeVisible(); expect((await draft()).design.layers).toEqual(saved);
});
