import{GameEngine}from'./core/GameEngine.js';
import{UI}from'./ui/UI.js';
document.addEventListener('DOMContentLoaded',()=>{
  const canvas=document.getElementById('canvas');
  const engine=new GameEngine(canvas);
  const ui=new UI(engine);
  engine.render();
  console.log('粒子シミュレータ起動');
  console.log('グリッド:',engine.gridSize,'×',engine.gridSize);
  console.log('キャンバス:',engine.width,'×',engine.height);
});