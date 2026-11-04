import * as api from './api.js';

const form = document.getElementById('formLogin');
const erro = document.getElementById('erro');
const btn = document.getElementById('btnEntrar');

const cfg = await api.init();

if (cfg.demo) {
  document.getElementById('demoNote').hidden = false;
  form.email.value = 'treinador@meninosdavila.com';
  form.senha.value = 'demo1234';
} else if (await api.getSession()) {
  location.replace('app.html');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erro.hidden = true;
  const email = form.email.value.trim();
  const senha = form.senha.value;
  if (!email || !senha) return mostrarErro('Preencha e-mail e senha.');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando…';
  try {
    await api.signIn(email, senha);
    location.replace('app.html');
  } catch (err) {
    mostrarErro(err.message);
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

function mostrarErro(msg) {
  erro.textContent = msg;
  erro.hidden = false;
}
