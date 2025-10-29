// 権限管理モジュール

// 権限レベルの定義
export const ROLES={
  OWNER:'owner',
  MODERATOR:'moderator',
  VERIFIED:'verified',
  USER:'user'
};

// 権限の階層（数値が大きいほど上位）
const ROLE_HIERARCHY={
  owner:4,
  moderator:3,
  verified:2,
  user:1
};

// サーバー内権限の定義
export const SERVER_ROLES={
  SERVER_OWNER:'server_owner',
  SERVER_MOD:'server_mod',
  MEMBER:'member'
};

// サーバー内権限の階層
const SERVER_ROLE_HIERARCHY={
  server_owner:3,
  server_mod:2,
  member:1
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
    manage_users:ROLES.OWNER,
    change_user_role:ROLES.OWNER,
    view_admin_panel:ROLES.OWNER,
    
    // モデレーター以上
    delete_any_message:ROLES.MODERATOR,
    ban_user:ROLES.MODERATOR,
    manage_servers:ROLES.MODERATOR,
    
    // 承認済みユーザー以上
    create_server:ROLES.VERIFIED,
    
    // 全ユーザー
    send_message:ROLES.USER,
    create_account:ROLES.USER
  };
  
  const requiredRole=permissions[permission];
  if(!requiredRole)return false;
  
  return hasPermission(userRole,requiredRole);
}

/**
 * サーバー内権限のレベルを取得
 * @param {string} serverRole - サーバー内のrole
 * @returns {number} 権限レベル
 */
export function getServerRoleLevel(serverRole){
  return SERVER_ROLE_HIERARCHY[serverRole]||0;
}

/**
 * サーバー内権限チェック
 * @param {string} userServerRole - ユーザーのサーバー内role
 * @param {string} requiredServerRole - 必要なサーバー内role
 * @returns {boolean} 権限があるか
 */
export function hasServerPermission(userServerRole,requiredServerRole){
  return getServerRoleLevel(userServerRole)>=getServerRoleLevel(requiredServerRole);
}

/**
 * サーバー内の特定の権限をチェック
 * @param {string} userServerRole - ユーザーのサーバー内role
 * @param {string} permission - 権限名
 * @returns {boolean} 権限があるか
 */
export function checkServerPermission(userServerRole,permission){
  const permissions={
    // サーバー主のみ
    delete_server:SERVER_ROLES.SERVER_OWNER,
    change_server_settings:SERVER_ROLES.SERVER_OWNER,
    assign_moderator:SERVER_ROLES.SERVER_OWNER,
    
    // モデレーター以上
    create_channel:SERVER_ROLES.SERVER_MOD,
    delete_channel:SERVER_ROLES.SERVER_MOD,
    kick_member:SERVER_ROLES.SERVER_MOD,
    delete_any_server_message:SERVER_ROLES.SERVER_MOD,
    
    // 全メンバー
    send_server_message:SERVER_ROLES.MEMBER,
    view_channels:SERVER_ROLES.MEMBER
  };
  
  const requiredRole=permissions[permission];
  if(!requiredRole)return false;
  
  return hasServerPermission(userServerRole,requiredRole);
}

/**
 * 権限の表示名を取得
 * @param {string} role - role
 * @returns {string} 表示名
 */
export function getRoleDisplayName(role){
  const names={
    owner:'管理者',
    moderator:'準管理者',
    verified:'承認済み',
    user:'一般ユーザー'
  };
  return names[role]||'不明';
}

/**
 * サーバー内権限の表示名を取得
 * @param {string} serverRole - サーバー内role
 * @returns {string} 表示名
 */
export function getServerRoleDisplayName(serverRole){
  const names={
    server_owner:'サーバー主',
    server_mod:'モデレーター',
    member:'メンバー'
  };
  return names[serverRole]||'不明';
}

/**
 * 権限バッジのHTMLを生成
 * @param {string} role - role
 * @returns {string} HTMLタグ
 */
export function getRoleBadge(role){
  const badges={
    owner:'<span class="role-badge role-owner">管理者</span>',
    moderator:'<span class="role-badge role-moderator">準管理者</span>',
    verified:'<span class="role-badge role-verified">承認済み</span>',
    user:''
  };
  return badges[role]||'';
}

/**
 * サーバー内権限バッジのHTMLを生成
 * @param {string} serverRole - サーバー内role
 * @returns {string} HTMLタグ
 */
export function getServerRoleBadge(serverRole){
  const badges={
    server_owner:'<span class="role-badge role-server-owner">サーバー主</span>',
    server_mod:'<span class="role-badge role-server-mod">モデレーター</span>',
    member:''
  };
  return badges[serverRole]||'';
}