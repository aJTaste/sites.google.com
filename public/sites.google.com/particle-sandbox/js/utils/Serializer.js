export class Serializer{
  static exportModule(name,grid){
    const moduleData={
      name:name||'Untitled',
      version:'1.0',
      timestamp:new Date().toISOString(),
      grid:grid.serialize()
    };
    return moduleData;
  }
  static downloadModule(name,grid){
    const moduleData=this.exportModule(name,grid);
    const json=JSON.stringify(moduleData,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${name||'module'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  static importModule(jsonData){
    try{
      const data=typeof jsonData==='string'?JSON.parse(jsonData):jsonData;
      if(!data.grid||!Array.isArray(data.grid)){
        throw new Error('Invalid module format: missing grid data');
      }
      return data;
    }catch(e){
      console.error('Failed to import module:',e);
      throw e;
    }
  }
  static validateModule(moduleData){
    if(!moduleData.name){
      return{valid:false,error:'Module name is required'};
    }
    if(!moduleData.grid||!Array.isArray(moduleData.grid)){
      return{valid:false,error:'Invalid grid data'};
    }
    if(moduleData.grid.length!==64){
      return{valid:false,error:'Grid must contain exactly 64 cells'};
    }
    return{valid:true};
  }
}