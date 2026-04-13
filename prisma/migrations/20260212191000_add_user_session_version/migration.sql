-- 为用户表增加会话版本号，用于登录挤下线与令牌失效控制
ALTER TABLE "User"
ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
