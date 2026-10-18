export const ES_MAC = /Mac|iPhone|iPad/i.test(navigator.userAgent);

export function el(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}
export function icono(nombre, extra = '') {
  const i = document.createElement('i');
  i.className = `ph ${nombre} ${extra}`.trim();
  i.setAttribute('aria-hidden', 'true');
  return i;
}
let contenedorAvisos = null;
export function mostrarAviso(texto, tipo = 'info') {
  if (!contenedorAvisos) {
    contenedorAvisos = el('div', 'contenedor-avisos');
    contenedorAvisos.setAttribute('role', 'status');
    contenedorAvisos.setAttribute('aria-live', 'polite');
    document.body.appendChild(contenedorAvisos);
  }
  while (contenedorAvisos.children.length >= 4) contenedorAvisos.firstElementChild.remove();

  const aviso = el('div', `aviso aviso-${tipo}`, texto);
  contenedorAvisos.appendChild(aviso);
  requestAnimationFrame(() => aviso.classList.add('aviso-visible'));
  setTimeout(() => {
    aviso.classList.remove('aviso-visible');
    setTimeout(() => aviso.remove(), 200);
  }, tipo === 'error' ? 6000 : 3500);
}








export function confirmar({
  titulo,
  mensaje,
  textoAceptar = 'Aceptar',
  textoCancelar = 'Cancelar',
  peligro = false,
}) {
  return new Promise((resolver) => {
    const previo = document.activeElement;
    const fondo = el('div', 'modal-fondo');
    const caja = el('div', 'modal-caja');
    caja.setAttribute('role', 'alertdialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('aria-labelledby', 'modal-titulo');
    caja.setAttribute('aria-describedby', 'modal-texto');

    const h = el('h4', 'modal-titulo', titulo);
    h.id = 'modal-titulo';
    const p = el('p', 'modal-texto', mensaje);
    p.id = 'modal-texto';
    const acciones = el('div', 'modal-acciones');
    const bCancelar = el('button', 'btn-secundario', textoCancelar);
    const bAceptar = el('button', peligro ? 'btn-peligro' : 'btn-primario', textoAceptar);
    bCancelar.type = bAceptar.type = 'button';
    acciones.append(bCancelar, bAceptar);
    caja.append(h, p, acciones);
    fondo.appendChild(caja);
    const cerrar = (valor) => {
      document.removeEventListener('keydown', teclas, true);
      fondo.remove();
      if (previo && previo.isConnected) previo.focus();
      resolver(valor);
    };
    const teclas = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cerrar(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        (document.activeElement === bAceptar ? bCancelar : bAceptar).focus();
      }
    };
    bCancelar.addEventListener('click', () => cerrar(false));
    bAceptar.addEventListener('click', () => cerrar(true));
    fondo.addEventListener('pointerdown', (e) => {
      if (e.target === fondo) cerrar(false);
    });
    document.addEventListener('keydown', teclas, true);
    document.body.appendChild(fondo);
    (peligro ? bCancelar : bAceptar).focus();
  });
}
let menuAbierto = null;
export function cerrarMenuContextual() {
  if (!menuAbierto) return;
  menuAbierto.limpiar();
  menuAbierto.menu.remove();
  menuAbierto = null;
}
export function menuContextual(x, y, opciones) {
  cerrarMenuContextual();
  const menu = el('div', 'menu-flotante');
  menu.setAttribute('role', 'menu');

  for (const op of opciones) {
    if (op === 'separador') {
      menu.appendChild(el('div', 'menu-separador'));
      continue;
    }
    const boton = el('button', `menu-item${op.peligro ? ' menu-item-peligro' : ''}`);
    boton.type = 'button';
    boton.setAttribute('role', 'menuitem');
    boton.appendChild(el('span', 'menu-item-texto', op.texto));
    if (op.atajo) boton.appendChild(el('span', 'menu-item-atajo', op.atajo));
    boton.addEventListener('click', () => {
      cerrarMenuContextual();
      op.accion();
    });
    menu.appendChild(boton);
  }
  document.body.appendChild(menu);
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
  const fuera = (e) => {
    if (!menu.contains(e.target)) cerrarMenuContextual();
  };
  const teclas = (e) => {
    const items = [...menu.querySelectorAll('button')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrarMenuContextual();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    }
  };
  document.addEventListener('pointerdown', fuera, true);
  document.addEventListener('keydown', teclas, true);
  window.addEventListener('blur', cerrarMenuContextual);
  window.addEventListener('resize', cerrarMenuContextual);
  menuAbierto = {
    menu,
    limpiar() {
      document.removeEventListener('pointerdown', fuera, true);
      document.removeEventListener('keydown', teclas, true);
      window.removeEventListener('blur', cerrarMenuContextual);
      window.removeEventListener('resize', cerrarMenuContextual);
    },
  };
  menu.querySelector('button')?.focus();
}
