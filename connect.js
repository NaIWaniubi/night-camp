/**
 * web/connect.js — 自带模型连接页（无构建、无依赖）
 *
 * 与 web/api-config.ts 共用同一个 storage key 与同一套校验规则；
 * 这里不 import，是因为静态托管版只会拿到剥过类型的单页，不保证模块图。
 */
(function () {
  'use strict';

  var KEY = 'starlight:api:v1';
  var msg = document.getElementById('msg');
  var base = document.getElementById('base');
  var model = document.getElementById('model');
  var key = document.getElementById('key');
  var btnTest = document.getElementById('test');
  var btnSave = document.getElementById('save');

  function say(text, ok) {
    msg.textContent = text || '';
    msg.className = ok ? 'msg ok' : 'msg';
  }

  function normalizeBase(raw) {
    var value = String(raw || '').trim().replace(/\/+$/, '');
    if (!value) return '';
    try {
      var url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      // Key 会随请求发出去：公网必须 https，只有本机回环可以用 http。
      if (url.protocol === 'http:') {
        var host = url.hostname.toLowerCase();
        if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== '[::1]') return '';
      }
      return value;
    } catch (e) {
      return '';
    }
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var cfg = JSON.parse(raw);
      var url = normalizeBase(cfg.baseUrl);
      if (!url || !cfg.model || !cfg.key) return null;
      return { baseUrl: url, model: String(cfg.model), key: String(cfg.key) };
    } catch (e) {
      return null;
    }
  }

  function fill() {
    var cfg = read();
    if (!cfg) return;
    base.value = cfg.baseUrl;
    model.value = cfg.model;
    key.value = cfg.key;
  }

  function collect() {
    var url = normalizeBase(base.value);
    // 与 web/api-config.ts 的 normalizeApiConfig 同一套截断：model 80 / key 400
    var m = String(model.value || '').trim().slice(0, 80);
    var k = String(key.value || '').trim().slice(0, 400);
    if (!url) return { error: '公网地址必须用 https；只有本机 127.0.0.1 / localhost 可以用 http。' };
    if (!m) return { error: '模型名不能为空。' };
    if (!k) return { error: 'API Key 不能为空。' };
    return { cfg: { baseUrl: url, model: m, key: k } };
  }

  function busy(on) {
    btnTest.disabled = on;
    btnSave.disabled = on;
  }

  btnTest.addEventListener('click', function () {
    var out = collect();
    if (out.error) return say(out.error, false);
    busy(true);
    say('正在试……');
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    fetch(out.cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + out.cfg.key
      },
      body: JSON.stringify({
        model: out.cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8,
        stream: false
      }),
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      return res.text().then(function (text) {
        busy(false);
        if (res.ok) {
          say('通了。保存后就能用。', true);
          return;
        }
        var detail = text.slice(0, 180);
        say('端点回了 ' + res.status + '：' + detail, false);
      });
    }).catch(function (err) {
      clearTimeout(timer);
      busy(false);
      var name = err && err.name;
      say(
        name === 'AbortError'
          ? '15 秒没回，端点可能不通。'
          : '请求失败：' + (err && err.message ? err.message : err) +
              '\n如果是跨域错误，这个端点不允许浏览器直连。',
        false
      );
    });
  });

  btnSave.addEventListener('click', function () {
    var out = collect();
    if (out.error) return say(out.error, false);
    try {
      localStorage.setItem(KEY, JSON.stringify(out.cfg));
      say('存好了。', true);
      location.href = './';
    } catch (e) {
      say('存不进去（可能是隐私模式）。', false);
    }
  });

  // 清除已保存的 Key：明文存本机，必须给用户一个明确的撤销入口
  var btnClear = document.getElementById('clear');
  if (btnClear) {
    btnClear.addEventListener('click', function () {
      try {
        localStorage.removeItem(KEY);
        base.value = '';
        model.value = '';
        key.value = '';
        say('已清除这台设备上保存的 Key。', true);
      } catch (e) {
        say('清不掉（可能是隐私模式）。', false);
      }
    });
  }

  fill();
})();
