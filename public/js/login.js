import * as api from './api.js';

const $ = (s) => document.querySelector(s);
const formLogin = $('#formLogin');
const formCadastro = $('#formCadastro');

// A configuração começa a carregar já, mas os botões NÃO esperam por ela:
// eles são ligados logo abaixo, então o primeiro clique sempre funciona,
// mesmo com internet lenta (antes, um clique rápido em "Criar conta" se perdia).
const pronto = api.init();

/* ---------- Alternar Entrar / Criar conta ---------- */
function modo(m) {
  document.querySelectorAll('[data-modo]').forEach((b) => b.classList.toggle('on', b.dataset.modo === m));
  formLogin.hidden = m !== 'entrar';
  formCadastro.hidden = m !== 'cadastro';
  $('#cadastroOk').hidden = true;
  document.querySelector('.auth-tabs').hidden = false;
}
document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => modo(b.dataset.modo)));
$('#btnVoltarLogin').addEventListener('click', () => modo('entrar'));
if (location.hash === '#cadastro') modo('cadastro');

function erro(el, msg) {
  el.textContent = msg;
  el.hidden = !msg;
}
function carregando(btn, ativo, texto) {
  btn.disabled = ativo;
  btn.innerHTML = ativo ? `<span class="spinner"></span> ${texto}` : texto;
}

// Se o painel mandou de volta para cá, mostra o motivo
try {
  const aviso = sessionStorage.getItem('mdv-aviso-login');
  if (aviso) {
    sessionStorage.removeItem('mdv-aviso-login');
    erro($('#erro'), aviso);
  }
} catch {}

/* ---------- Entrar ---------- */
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  erro($('#erro'), '');
  const email = formLogin.email.value.trim();
  const senha = formLogin.senha.value;
  if (!email || !senha) return erro($('#erro'), 'Preencha e-mail e senha.');
  const btn = $('#btnEntrar');
  carregando(btn, true, 'Entrando…');
  try {
    await pronto;
    await api.signIn(email, senha);
    location.replace('app.html'); // o painel decide: liberado, aguardando aprovação ou bloqueado
  } catch (err) {
    erro($('#erro'), /confirm/i.test(err.message) ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : err.message);
    carregando(btn, false, 'Entrar');
  }
});

/* ---------- Criar conta ---------- */
formCadastro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const el = $('#erroCadastro');
  erro(el, '');
  const nome = formCadastro.nome.value.trim();
  const email = formCadastro.email.value.trim().toLowerCase();
  const senha = formCadastro.senha.value;
  if (nome.length < 2) return erro(el, 'Informe seu nome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro(el, 'Informe um e-mail válido.');
  if (senha.length < 8) return erro(el, 'A senha precisa ter pelo menos 8 caracteres.');
  if (senha !== formCadastro.senha2.value) return erro(el, 'As senhas não conferem.');

  const btn = $('#btnCadastrar');
  carregando(btn, true, 'Criando conta…');
  try {
    const cfg = await pronto;
    const { precisaConfirmar } = await api.signUp(nome, email, senha);
    formCadastro.reset();
    formCadastro.hidden = true;
    document.querySelector('.auth-tabs').hidden = true;
    $('#cadastroOkTexto').textContent = precisaConfirmar
      ? `Enviamos um link de confirmação para ${email}. Depois de confirmar, um administrador precisa aprovar seu acesso; você recebe um aviso quando for liberado.`
      : cfg.demo
        ? 'Na demonstração o cadastro não é salvo. No sistema real, a conta fica aguardando a aprovação de um administrador.'
        : 'Agora um administrador precisa aprovar seu acesso. Você recebe um aviso por e-mail quando for liberado.';
    $('#cadastroOk').hidden = false;
  } catch (err) {
    erro(el, err.message);
  } finally {
    carregando(btn, false, 'Criar conta');
  }
});

/* ---------- Depois que a configuração carregar ---------- */
const cfg = await pronto;
if (cfg.demo) {
  $('#demoNote').hidden = false;
  // Só preenche se a pessoa ainda não digitou nada
  if (!formLogin.email.value) formLogin.email.value = 'treinador@meninosdavila.com';
  if (!formLogin.senha.value) formLogin.senha.value = 'demo1234';
} else if (await api.getSession()) {
  location.replace('app.html');
}
