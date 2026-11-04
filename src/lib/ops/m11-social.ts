import {Pool} from "pg";
import {inspectSocialDatabase,type DbAudit} from "./m8-db-audit";

/** Actual database inspection, READ ONLY; never queries profile/post/message rows. */
export type SocialOperations={
  status:"verified"|"blocked";
  schema:DbAudit|null;
  leastPrivilege:boolean;
  databaseRoleIsSuperuser:boolean;
  publicBetaOpen:false;
  backupRestoreReviewed:false;
  moderationAccepted:false;
  note:string;
};
export async function inspectSocialOperations():Promise<SocialOperations>{
  const blocked=(note:string):SocialOperations=>({
    status:"blocked",schema:null,leastPrivilege:false,
    databaseRoleIsSuperuser:false,publicBetaOpen:false,
    backupRestoreReviewed:false,moderationAccepted:false,note,
  });
  if(!process.env.DATABASE_URL)return blocked("No real TLS-backed Looke staging PostgreSQL connection configured.");
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:7000,
    statement_timeout:8000});
  try{
    const client=await pool.connect();
    try{
      const schema=await inspectSocialDatabase(client,false);
      await client.query("BEGIN TRANSACTION READ ONLY");
      let superuser=true,privilege=false;
      try{
        const r=await client.query<{superuser:boolean;canSelect:boolean}>(`
          SELECT r.rolsuper AS "superuser",
            has_table_privilege(current_user,'public.social_profiles','SELECT')
            AND has_table_privilege(current_user,'public.social_reports','SELECT')
            AS "canSelect"
          FROM pg_roles r WHERE r.rolname=current_user
        `);
        superuser=r.rows[0]?.superuser!==false;
        privilege=r.rows[0]?.canSelect===true;
      }finally{await client.query("ROLLBACK");}
      const leastPrivilege=!superuser&&privilege;
      return {
        status:schema.status==="verified"&&leastPrivilege?"verified":"blocked",
        schema,leastPrivilege,databaseRoleIsSuperuser:superuser,
        publicBetaOpen:false,backupRestoreReviewed:false,moderationAccepted:false,
        note:schema.status==="verified"&&leastPrivilege?
          "TLS, table/index existence and read-only restricted role verified. Restore and moderation review are separate external gates.":
          "TLS/schema or restricted role not verified. Disposable CI superuser does not establish staging readiness.",
      };
    }finally{client.release();}
  }catch{return blocked("PostgreSQL connection, TLS, schema or role verification unavailable.");}
  finally{await pool.end();}
}
