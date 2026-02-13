export class DirectoryManager{
  constructor(){
    this.dirHandle=null;
    this.isConnected=false;
  }
  async selectFolder(){
    try{
      if(!('showDirectoryPicker' in window)){
        alert('お使いのブラウザはフォルダアクセスに対応していません。Chrome/Edgeの最新版をご使用ください。');
        return false;
      }
      this.dirHandle=await window.showDirectoryPicker({
        mode:'readwrite'
      });
      const permission=await this.dirHandle.requestPermission({
        mode:'readwrite'
      });
      if(permission!=='granted'){
        alert('フォルダへの書き込み権限が必要です');
        return false;
      }
      this.isConnected=true;
      console.log('フォルダ接続成功:',this.dirHandle.name);
      return true;
    }catch(err){
      if(err.name!=='AbortError'){
        console.error('フォルダ選択エラー:',err);
        alert('フォルダの選択に失敗しました: '+err.message);
      }
      return false;
    }
  }
  async saveObject(name,data){
    if(!this.isConnected||!this.dirHandle){
      alert('フォルダが選択されていません');
      return false;
    }
    try{
      const fileName=name.endsWith('.json')?name:`${name}.json`;
      const fileHandle=await this.dirHandle.getFileHandle(fileName,{create:true});
      const writable=await fileHandle.createWritable();
      const objectData={
        name:name.replace('.json',''),
        timestamp:new Date().toISOString(),
        data:data
      };
      await writable.write(JSON.stringify(objectData,null,2));
      await writable.close();
      console.log('オブジェクト保存成功:',fileName);
      return true;
    }catch(err){
      console.error('保存エラー:',err);
      alert('保存に失敗しました: '+err.message);
      return false;
    }
  }
  async loadObject(fileName){
    if(!this.isConnected||!this.dirHandle){
      return null;
    }
    try{
      const fileHandle=await this.dirHandle.getFileHandle(fileName);
      const file=await fileHandle.getFile();
      const text=await file.text();
      return JSON.parse(text);
    }catch(err){
      console.error('読込エラー:',err);
      return null;
    }
  }
  async listObjects(){
    if(!this.isConnected||!this.dirHandle){
      return[];
    }
    try{
      const objects=[];
      for await(const entry of this.dirHandle.values()){
        if(entry.kind==='file'&&entry.name.endsWith('.json')){
          try{
            const fileHandle=await this.dirHandle.getFileHandle(entry.name);
            const file=await fileHandle.getFile();
            const text=await file.text();
            const data=JSON.parse(text);
            objects.push({
              fileName:entry.name,
              name:data.name||entry.name.replace('.json',''),
              timestamp:data.timestamp||'不明',
              particleCount:data.data?.particles?.length||0
            });
          }catch(err){
            console.error('ファイル読込エラー:',entry.name,err);
          }
        }
      }
      objects.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
      return objects;
    }catch(err){
      console.error('一覧取得エラー:',err);
      return[];
    }
  }
  getFolderName(){
    return this.dirHandle?this.dirHandle.name:'未設定';
  }
  async deleteObject(fileName){
    if(!this.isConnected||!this.dirHandle){
      return false;
    }
    try{
      await this.dirHandle.removeEntry(fileName);
      console.log('削除成功:',fileName);
      return true;
    }catch(err){
      console.error('削除エラー:',err);
      return false;
    }
  }
}