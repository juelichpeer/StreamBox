/***** PROFILE + TOTP *****/
import { sb, $, toast } from './config.js';

export async function ensureProfile(){ const {data:{user}}=await sb.auth.getUser(); if(!user) return;
  const {data,error}=await sb.from('profiles').select('id').eq('id',user.id).maybeSingle();
  if(!data && !error){ await sb.from('profiles').insert([{id:user.id}]); }
}
export async function loadProfile(){ const {data:{user}}=await sb.auth.getUser(); if(!user) return;
  const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error && error.code!=='PGRST116') return toast('Load profile error','error',error.message);
  $('profile-email').textContent=user.email||''; $('profile-name').value=data?.full_name||''; $('profile-birthday').value=data?.birthday||'';
}
export async function saveProfile(){ const {data:{user}}=await sb.auth.getUser(); if(!user) return;
  const updates={id:user.id, full_name:$('profile-name').value.trim()||null, birthday:$('profile-birthday').value||null};
  const {error}=await sb.from('profiles').upsert(updates,{onConflict:'id'}); if(error) return toast('Save profile error','error',error.message);
  toast('Profile saved','success'); document.getElementById('app-box').style.display='block'; document.getElementById('profile-box').style.display='none';
}

/* TOTP */
export function initTOTPUI(){
  $('btn-2fa-enable')?.addEventListener('click', startTOTPEnroll);
  $('btn-2fa-verify')?.addEventListener('click', verifyTOTPEnroll);
  $('btn-2fa-disable')?.addEventListener('click', disableTOTP);
}
export async function refreshTOTPStatus(){
  try{
    const lf = await sb.auth.mfa.listFactors();
    const factors = lf.data?.totp?.factors || [];
    const active = factors.filter(f => f.status === 'verified').length>0;
    $('totp-status').textContent = active ? '2FA is ENABLED for this account.' : '2FA is OFF.';
    $('btn-2fa-enable').style.display = active ? 'none' : 'inline-block';
    $('btn-2fa-disable').style.display = active ? 'inline-block' : 'none';
    $('totp-enroll').style.display = 'none';
  }catch(e){ $('totp-status').textContent = 'Unable to check 2FA status.'; }
}
async function startTOTPEnroll(){
  try{
    const en = await sb.auth.mfa.enroll({ factorType:'totp' });
    if (en.error) return toast('Enroll error','error',en.error.message);
    const data = en.data;
    document.getElementById('totp-enroll').style.display='block';
    document.getElementById('totp-qr').src = data.totp?.qr_code || '';
    document.getElementById('totp-secret').value = data.totp?.secret || '';
    document.getElementById('totp-status').textContent='Scan the QR or enter the secret, then enter the 6-digit code.';
    window.__enrollingFactorId = data.id;
  }catch(e){ toast('Enroll crashed','error', e.message||'Unknown'); }
}
async function verifyTOTPEnroll(){
  const code = document.getElementById('totp-code').value.trim();
  if (!code) return toast('Enter the 6-digit code','error');
  const factorId = window.__enrollingFactorId;
  if (!factorId) return toast('Missing enrollment','error');
  const vr = await sb.auth.mfa.verify({ factorId, code });
  if (vr.error) return toast('Verify error','error',vr.error.message);
  toast('2FA enabled','success'); document.getElementById('totp-code').value=''; window.__enrollingFactorId=null; await refreshTOTPStatus();
}
async function disableTOTP(){
  if (!confirm('Turn OFF 2FA for this account?')) return;
  try{
    const lf = await sb.auth.mfa.listFactors();
    const factors = lf.data?.totp?.factors || [];
    for (const f of factors) if (f.status === 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
    toast('2FA disabled','success'); await refreshTOTPStatus();
  }catch(e){ toast('Disable crashed','error', e.message||'Unknown'); }
}
