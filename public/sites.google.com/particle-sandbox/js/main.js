import{GameEngine}from'./core/GameEngine.js';
import{Editor}from'./ui/Editor.js';
document.addEventListener('DOMContentLoaded',()=>{
  const canvas=document.getElementById('gameCanvas');
  const engine=new GameEngine(canvas);
  const editor=new Editor(engine);
  engine.render();
  editor.startUpdateLoop();
  console.log('Particle Sandbox initialized');
  console.log('Grid size:',engine.grid.size,'x',engine.grid.size);
});