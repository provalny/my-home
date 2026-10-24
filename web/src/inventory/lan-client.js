// The LAN server marks its HTML explicitly. Ordinary browser previews keep their
// own local storage; a paired phone never falls back to a separate/demo document.
export const isLAN = Boolean(globalThis.window?.__HOUSE_LAN__);

export function createLANClient({fetcher = globalThis.fetch, timeout = 60000} = {}) {
  async function request(path, body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetcher(path, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: body === undefined ? {} : {'Content-Type':'application/json','X-Life-Assistant':'1'},
        ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw Object.assign(Error(result.error || 'Не удалось получить данные с Mac'), {status:response.status});
      return result;
    } catch (error) {
      if (error.status) throw error;
      throw Error('Нет связи с Mac. Проверьте Wi-Fi и убедитесь, что Life Assistant запущен и доступ с телефона включён.');
    } finally { clearTimeout(timer); }
  }
  return {
    async connect(location = globalThis.location, history = globalThis.history) {
      const key = new URLSearchParams(location.hash.slice(1)).get('pair');
      if (key) {
        await request('/api/pair', {key});
        history.replaceState(null, '', location.pathname + location.search);
      }
      const result = await request('/api/state');
      if (!result.document) throw Error('Сначала откройте квартиру на Mac');
      return result.document;
    },
    state: revision => request('/api/state' + (revision == null ? '' : '?revision=' + encodeURIComponent(revision))),
    save: (document, expectedRevision, restore = false) => request('/api/save', {document,expectedRevision,restore}),
  };
}
