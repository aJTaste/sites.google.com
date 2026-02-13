export class FileSystem{
  static async save(data,filename='simulation.json'){
    try{
      if('showSaveFilePicker' in window){
        const handle=await window.showSaveFilePicker({
          suggestedName:filename,
          types:[{
            description:'JSON Files',
            accept:{'application/json':['.json']}
          }]
        });
        const writable=await handle.createWritable();
        await writable.write(JSON.stringify(data,null,2));
        await writable.close();
        return true;
      }else{
        this.fallbackDownload(data,filename);
        return true;
      }
    }catch(err){
      if(err.name!=='AbortError'){
        console.error('Save failed:',err);
        return false;
      }
      return false;
    }
  }
  static fallbackDownload(data,filename){
    const json=JSON.stringify(data,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  static async load(){
    try{
      if('showOpenFilePicker' in window){
        const[handle]=await window.showOpenFilePicker({
          types:[{
            description:'JSON Files',
            accept:{'application/json':['.json']}
          }],
          multiple:false
        });
        const file=await handle.getFile();
        const text=await file.text();
        return JSON.parse(text);
      }else{
        return await this.fallbackLoad();
      }
    }catch(err){
      if(err.name!=='AbortError'){
        console.error('Load failed:',err);
      }
      return null;
    }
  }
  static fallbackLoad(){
    return new Promise((resolve,reject)=>{
      const input=document.createElement('input');
      input.type='file';
      input.accept='.json';
      input.onchange=async e=>{
        const file=e.target.files[0];
        if(!file){
          resolve(null);
          return;
        }
        const text=await file.text();
        try{
          resolve(JSON.parse(text));
        }catch(err){
          reject(err);
        }
      };
      input.click();
    });
  }
}