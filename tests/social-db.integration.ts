import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { bytesToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createChallenge, verifyChallenge } from "../src/lib/social/auth";
import { query, rateLimit, socialDb, RateLimitError } from "../src/lib/social/db";

const wallet=privateKeyToAccount(bytesToHex(randomBytes(32)));
const actor=wallet.address.toLowerCase();
const handle="u"+actor.slice(2,17);
const other="0x"+"b".repeat(40);
const otherHandle="u"+other.slice(2,17);
after(async()=>{
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[[actor,other]]);
  await query("DELETE FROM social_auth_challenges WHERE address=$1",[actor]);
  await socialDb().end();
});

test("schema creates profiles, relationships and public sharing with real FK constraints",async()=>{
  await query(`INSERT INTO social_profiles(address,handle,display_name) VALUES($1,$2,'Tester')
    ON CONFLICT(address) DO NOTHING`,[actor,handle]);
  await query(`INSERT INTO social_profiles(address,handle,display_name) VALUES($1,$2,'Other')
    ON CONFLICT(address) DO NOTHING`,[other,otherHandle]);
  await query(`INSERT INTO social_follows(follower,followed) VALUES($1,$2)`,[actor,other]);
  const follows=await query("SELECT followed FROM social_follows WHERE follower=$1",[actor]);
  assert.equal(follows.rows[0].followed,other);
  await assert.rejects(()=>query("INSERT INTO social_follows(follower,followed) VALUES($1,$1)",[actor]),/different|violates/i);
  const r=await query<{id:string}>(`INSERT INTO social_posts(author,body,asset_chain,asset_type,asset_id)
    VALUES($1,'Token reference','ultra-evm','token',$2) RETURNING id`,[actor,wallet.address]);
  const id=r.rows[0].id;
  const reply=await query<{id:string}>(`INSERT INTO social_comments(post_id,author,body)
    VALUES($1,$2,'Real reply') RETURNING id`,[id,other]);
  assert.ok(reply.rows[0].id);
  const report=await query<{id:string}>(`INSERT INTO social_reports(reporter,post_id,reason) VALUES($1,$2,'spam') RETURNING id`,[other,id]);
  assert.ok(report.rows[0].id);
  await assert.rejects(()=>query(`INSERT INTO social_posts(author,body,asset_chain,asset_type,asset_id)
    VALUES($1,'X','ultra-native','token',$2)`,[actor,wallet.address]),/violates/i);
  await query("INSERT INTO social_blocks(blocker,blocked) VALUES($1,$2)",[actor,other]);
  const blocked=await query("SELECT blocker FROM social_blocks WHERE blocker=$1 AND blocked=$2",[actor,other]);
  assert.equal(blocked.rowCount,1);
});
test("single-use sign-in challenges, signed cookie identity and replay protection",async()=>{
  const issued=await createChallenge(wallet.address);
  assert.match(issued.message,/Ultra EVM Testnet \(18881\)/);
  const sig=await wallet.signMessage({message:issued.message});
  const valid=await verifyChallenge(issued.challengeId,sig);
  assert.equal(valid.user.address,actor);
  assert.match(valid.token,/^[0-9a-f]{64}$/);
  await assert.rejects(()=>verifyChallenge(issued.challengeId,sig),/expired|used/i);
});
test("database-backed window limits reject abusive bursts",async()=>{
  const key="test:"+actor;
  await rateLimit(key,"unit",2,600);
  await rateLimit(key,"unit",2,600);
  await assert.rejects(()=>rateLimit(key,"unit",2,600),(error:unknown)=>error instanceof RateLimitError);
});
