/***** PWA (SW + Install buttons) *****/
import { $, toast } from './config.js';

export function setupPWA(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const b1 = $('btn-install'); const b2 = $('btn-install-auth');
    [b1,b2].forEach((btn)=>{
      if (!btn) return;
      btn.style.display = 'inline-block';
      btn.onclick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        toast(outcome === 'accepted' ? 'Installing…' : 'Install dismissed', 'info');
      };
    });
  });

  const hideIfStandalone=()=>{
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) { const b1=$('btn-install'); const b2=$('btn-install-auth'); if(b1) b1.style.display='none'; if(b2) b2.style.display='none'; }
  };
  hideIfStandalone();
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', hideIfStandalone);
}
