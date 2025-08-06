-- 删除失败的迁移记录
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20250804152245_add_media_visibility_remove_private_status';