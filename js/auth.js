/***** AUTH *****/
import { sb, $, toast } from './config.js';

export async function signUp(){
  const email=$('email')?.value?.trim(), pw=$('password')?.value||'';
  if(!email||!pw) return toast('Enter email and password','error');
  const {error}=await sb.auth.signUp({email,password:pw});
  if(error) return toast('Sign up failed','error',error.message);
  toast('Sign up success','success','Confirm by email, then sign in');
}

export async function signIn(){
  const email=$('email')?.value?.trim(), pw=$('password')?.value||'';
  if(!email||!pw) return toast('Enter email and password','error');

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (data?.session) { toast('Login success','success'); return; }

  if (error && /MFA|multi[- ]?factor|factor/i.test(error.message||'')) {
    try {
      const lf = await sb.auth.mfa.listFactors();
      const totp = (lf.data?.totp?.factors || []).find(f => f.status === 'verified') || (lf.data?.totp?.factors || [])[0];
      if (!totp) return toast('MFA required but no TOTP factor found','error');
      const ch = await sb.auth.mfa.challenge({ factorId: totp.id });
      if (ch.error) return toast('MFA challenge error','error', ch.error.message);
      const code = prompt('Enter 6-digit code from your authenticator app:');
      if (!code?.trim()) return toast('MFA canceled','info');
      const ver = await sb.auth.mfa.verify({ factorId: totp.id, code: code.trim(), challengeId: ch.data.id });
      if (ver.error) return toast('MFA verify error','error', ver.error.message);
      toast('MFA success','success'); return;
    } catch (e) { return toast('MFA flow crashed','error', e.message||'Unknown'); }
  }
  if (error) return toast('Login failed','error',error.message);
}

export async function signOut(){
  await sb.auth.signOut();
  toast('Signed out','info');
}

export async function oauth(provider){
  const redirectTo = window.location.origin + (window.location.pathname || '');
  const { error } = await sb.auth.signInWithOAuth({ provider, options:{ redirectTo } });
  if (error) toast('OAuth error','error',error.message); else toast('Redirecting…','info');
}
