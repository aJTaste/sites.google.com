// サイドバーの折りたたみ機能

export function initUI(){
  setupSectionToggles();
}

function setupSectionToggles(){
  // 各セクションの折りたたみボタンを設定
  const sections=[
    {header:'public-rooms-header',content:'public-rooms-content'},
    {header:'servers-header',content:'servers-content'},
    {header:'server-rooms-header',content:'server-rooms-content'}
  ];
  
  sections.forEach(section=>{
    const header=document.getElementById(section.header);
    const content=document.getElementById(section.content);
    const toggle=header?.querySelector('.section-toggle');
    
    if(!header||!content||!toggle)return;
    
    header.addEventListener('click',(e)=>{
      // 追加ボタンのクリックは無視
      if(e.target.closest('.add-btn'))return;
      
      const isCollapsed=content.classList.toggle('collapsed');
      toggle.classList.toggle('collapsed',isCollapsed);
      
      // ローカルストレージに状態を保存
      localStorage.setItem(`section-${section.header}`,isCollapsed?'collapsed':'expanded');
    });
    
    // 保存された状態を復元
    const savedState=localStorage.getItem(`section-${section.header}`);
    if(savedState==='collapsed'){
      content.classList.add('collapsed');
      toggle.classList.add('collapsed');
    }
  });
}