const PREFIX = 'chitfund_';
const SESSION = 'cf_';

export const storage = {
  walletAddress: {
    get: () => localStorage.getItem(`${SESSION}wallet_address`),
    set: (v: string) => localStorage.setItem(`${SESSION}wallet_address`, v),
    clear: () => localStorage.removeItem(`${SESSION}wallet_address`),
  },
  walletId: {
    get: () => localStorage.getItem(`${SESSION}wallet_id`),
    set: (v: string) => localStorage.setItem(`${SESSION}wallet_id`, v),
    clear: () => localStorage.removeItem(`${SESSION}wallet_id`),
  },
  currentFundId: {
    get: (addr: string) => localStorage.getItem(`${SESSION}current_fund_id_${addr}`),
    set: (addr: string, id: number) => localStorage.setItem(`${SESSION}current_fund_id_${addr}`, String(id)),
    clear: (addr: string) => localStorage.removeItem(`${SESSION}current_fund_id_${addr}`),
  },
  secret: {
    get: (addr: string) => localStorage.getItem(`${PREFIX}secret_${addr}`),
    set: (addr: string, hex: string) => localStorage.setItem(`${PREFIX}secret_${addr}`, hex),
  },
  clearAll: () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(PREFIX) || key.startsWith(SESSION))) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.clear();
  },
};
