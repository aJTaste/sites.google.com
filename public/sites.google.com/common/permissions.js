// 権限管理モジュール（3段階に簡素化）

// 権限レベルの定義
export const ROLES={
  ADMIN:'admin',
  MODERATOR:'moderator',
  USER:'user'
};

// 権限の階層（数値が大きいほど上位）
const ROLE_HIERARCHY={
  admin:3,
  moderator:2,
  user:1
};

/**
 * ユーザーの権限レベルを取得
 * @param {string} role - ユーザーのrole
 * @returns {number} 権限レベル
 */
export function getRoleLevel(role){
  return ROLE_HIERARCHY[role]||0;
}

/**
 * 権限チェック
 * @param {string} userRole - ユーザーのrole
 * @param {string} requiredRole - 必要なrole
 * @returns {boolean} 権限があるか
 */
export function hasPermission(userRole,requiredRole){
  return getRoleLevel(userRole)>=getRoleLevel(requiredRole);
}

/**
 * 特定の権限を持っているかチェック
 * @param {string} userRole - ユーザーのrole
 * @param {string} permission - 権限名
 * @returns {boolean} 権限があるか
 */
export function checkPermission(userRole,permission){
  const permissions={
    // 管理者のみ
    change_user_role:ROLES.ADMIN,
    
    // モデレーター以上
    view_admin_panel:ROLES.MODERATOR,
    edit_admin_panel:ROLES.MODERATOR,
    delete_any_message:ROLES.MODERATOR,
    
    // 全ユーザー
    send_message:ROLES.USER,
    edit_own_message:ROLES.USER,
    delete_own_message:ROLES.USER
  };
  
  const requiredRole=permissions[permission];
  if(!requiredRole)return false;
  
  return hasPermission(userRole,requiredRole);
}

/**
 * 権限の表示名を取得
 * @param {string} role - role
 * @returns {string} 表示名
 */
export function getRoleDisplayName(role){
  const names={
    admin:'管理者',
    moderator:'モデレーター',
    user:'ユーザー'
  };
  return names[role]||'不明';
}

/**
 * 権限バッジのHTMLを生成
 * @param {string} role - role
 * @returns {string} HTMLタグ
 */
export function getRoleBadge(role){
  const badges={
    admin:'<span class="role-badge role-admin">管理者</span>',
    moderator:'<span class="role-badge role-moderator">モデレーター</span>',
    user:''
  };
  return badges[role]||'';
}