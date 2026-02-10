// ========================================
// Cloudinary アップロードユーティリティ
// ========================================

const CLOUD_NAME='dhj4jiq4k';
const UPLOAD_PRESET='ayew1p2k';
const UPLOAD_URL=`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

/**
 * ファイルをCloudinaryにアップロードする
 * @param {File|Blob} file - アップロードするファイル
 * @param {string} folder - 保存先フォルダ名（例: 'chat', 'gate'）
 * @returns {Promise<string>} - 公開URL
 */
export async function uploadToCloudinary(file,folder='uploads'){
  const formData=new FormData();
  formData.append('file',file);
  formData.append('upload_preset',UPLOAD_PRESET);
  formData.append('folder',folder);

  const response=await fetch(UPLOAD_URL,{
    method:'POST',
    body:formData
  });

  if(!response.ok){
    const err=await response.json();
    throw new Error(err.error?.message||'Cloudinaryアップロード失敗');
  }

  const data=await response.json();
  return data.secure_url;
}

/**
 * Base64データURIをCloudinaryにアップロードする
 * @param {string} base64DataUri - Base64形式のデータURI
 * @param {string} folder - 保存先フォルダ名
 * @returns {Promise<string>} - 公開URL
 */
export async function uploadBase64ToCloudinary(base64DataUri,folder='uploads'){
  const formData=new FormData();
  formData.append('file',base64DataUri);
  formData.append('upload_preset',UPLOAD_PRESET);
  formData.append('folder',folder);

  const response=await fetch(UPLOAD_URL,{
    method:'POST',
    body:formData
  });

  if(!response.ok){
    const err=await response.json();
    throw new Error(err.error?.message||'Cloudinaryアップロード失敗');
  }

  const data=await response.json();
  return data.secure_url;
}