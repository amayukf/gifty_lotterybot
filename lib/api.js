export let api = null;

export function setApi(apiInstance) {
  api = apiInstance;
}

export class TelegramApi {
  constructor(token) {
    this.token = token;
  }

  async _request(method, params = {}, fileField = null) {
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
    let body;
    let headers = {};

    if (fileField && params[fileField]) {
      const formData = new FormData();
      for (const [key, val] of Object.entries(params)) {
        if (key === fileField) {
          formData.append(key, val);
        } else if (typeof val === 'object') {
          formData.append(key, JSON.stringify(val));
        } else {
          formData.append(key, val);
        }
      }
      body = formData;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(params);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Bot API Error: ${data.description}`);
    }
    return data.result;
  }

  getMe() { return this._request('getMe'); }
  sendMessage(params) { return this._request('sendMessage', params); }
  sendPhoto(params) { return this._request('sendPhoto', params, 'photo'); }
  sendDocument(params) { return this._request('sendDocument', params, 'document'); }
  answerCallbackQuery(params) { return this._request('answerCallbackQuery', params); }
  editMessageText(params) { return this._request('editMessageText', params); }
  editMessageCaption(params) { return this._request('editMessageCaption', params); }
  getFile(params) { return this._request('getFile', params); }
  getFileUrl(filePath) { return `https://api.telegram.org/file/bot${this.token}/${filePath}`; }
}
