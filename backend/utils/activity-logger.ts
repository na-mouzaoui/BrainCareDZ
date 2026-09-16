import { query } from '../config/db.js';

interface LogParams {
  req: any;
  action: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  changes?: any;
  status?: string;
  errorMessage?: string;
}

export async function logActivity({
  req,
  action,
  resource,
  resourceId,
  resourceName,
  changes,
  status = 'success',
  errorMessage,
}: LogParams) {
  try {
    await query(
      `INSERT INTO activity_logs (
         user_id, user_name, user_pseudo, user_email, user_role,
         action, resource, resource_id, resource_name,
         changes, status, error_message, ip_address, user_agent
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10::jsonb, $11, $12, $13, $14
       )`,
      [
        req.user?.id || null,
        req.user?.name || null,
        req.user?.pseudo || null,
        req.user?.email || null,
        req.user?.role || null,
        action,
        resource,
        resourceId || null,
        resourceName || null,
        changes ? JSON.stringify(changes) : null,
        status,
        errorMessage || null,
        req.ip || null,
        req.get?.('user-agent') || null,
      ]
    );
  } catch (error) {
    void error;
  }
}
