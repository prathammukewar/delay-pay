// Accessible autocomplete following the WAI-ARIA 1.2 combobox pattern (list autocomplete, manual selection).
// Arrow keys move through options, Enter or Tab picks, Escape closes, and screen readers hear the count.

let uid = 0;

/**
 * @param {object} opts
 * @param {HTMLInputElement} opts.input
 * @param {(q: string) => any[]} opts.search
 * @param {(item: any) => {code: string, name: string, sub: string}} opts.describe
 * @param {(item: any) => string} opts.display  text to show in the input once picked
 * @param {(item: any|null, text: string) => void} opts.onChange
 * @param {HTMLElement} opts.status  shared polite live region
 * @param {string} [opts.emptyText]
 */
export function createCombobox({ input, search, describe, display, onChange, status, emptyText }) {
  const id = input.id || `combo-${++uid}`;
  const wrap = input.closest('.combo');
  const list = document.createElement('ul');
  list.id = `${id}-list`;
  list.className = 'combo-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', input.labels?.[0]?.textContent?.trim() || 'Suggestions');
  list.hidden = true;
  wrap.appendChild(list);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');

  const clearBtn = wrap.querySelector('.combo-clear');

  let items = [];
  let active = -1;
  let selected = null;

  function open() {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function setActive(i) {
    const nodes = list.querySelectorAll('[role="option"]');
    nodes.forEach((n, j) => n.setAttribute('aria-selected', j === i ? 'true' : 'false'));
    active = i;
    if (i >= 0 && nodes[i]) {
      input.setAttribute('aria-activedescendant', nodes[i].id);
      nodes[i].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function renderList() {
    list.textContent = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'opt-empty';
      li.setAttribute('role', 'presentation');
      li.textContent = emptyText || 'No matches.';
      list.appendChild(li);
      return;
    }
    items.forEach((item, i) => {
      const d = describe(item);
      const li = document.createElement('li');
      li.id = `${id}-opt-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      const code = document.createElement('span');
      code.className = 'opt-code';
      code.textContent = d.code;
      const name = document.createElement('span');
      name.className = 'opt-name';
      name.textContent = d.name;
      const sub = document.createElement('span');
      sub.className = 'opt-sub';
      sub.textContent = d.sub;
      li.append(code, name, sub);
      li.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pick(i);
      });
      list.appendChild(li);
    });
  }

  function announce(text) {
    if (!status) return;
    status.textContent = '';
    // A tick later so screen readers notice the change.
    setTimeout(() => {
      status.textContent = text;
    }, 30);
  }

  function update() {
    const q = input.value.trim();
    if (selected && input.value === display(selected)) return;
    selected = null;
    onChange(null, q);
    if (!q) {
      items = [];
      close();
      return;
    }
    items = search(q);
    renderList();
    open();
    setActive(items.length ? 0 : -1);
    announce(
      items.length
        ? `${items.length} suggestion${items.length === 1 ? '' : 's'}. Use up and down arrows to choose.`
        : 'No matches.'
    );
  }

  function pick(i) {
    const item = items[i];
    if (!item) return;
    setValue(item);
    close();
    announce(`${describe(item).name} selected.`);
  }

  function setValue(item, silent = false) {
    selected = item;
    input.value = item ? display(item) : '';
    if (clearBtn) clearBtn.hidden = !input.value;
    if (!silent) onChange(item, input.value);
  }

  input.addEventListener('input', () => {
    if (clearBtn) clearBtn.hidden = !input.value;
    update();
  });

  input.addEventListener('keydown', (e) => {
    const isOpen = !list.hidden;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          if (input.value.trim()) update();
          return;
        }
        if (items.length) setActive((active + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen && items.length) setActive((active - 1 + items.length) % items.length);
        break;
      case 'Enter':
        if (isOpen && active >= 0) {
          e.preventDefault();
          pick(active);
        }
        break;
      case 'Tab':
        if (isOpen && active >= 0) pick(active);
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          close();
        } else if (input.value) {
          e.preventDefault();
          setValue(null);
        }
        break;
      default:
    }
  });

  input.addEventListener('focus', () => {
    if (!selected && input.value.trim()) update();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement === input) return;
      if (!selected && items.length && !list.hidden) {
        // A typed code that exactly matches the top result counts as a pick.
        const d = describe(items[0]);
        if (d.code.toLowerCase() === input.value.trim().toLowerCase()) pick(0);
      }
      close();
    }, 120);
  });

  if (clearBtn) {
    clearBtn.hidden = true;
    clearBtn.addEventListener('click', () => {
      setValue(null);
      input.focus();
    });
  }

  return {
    get value() {
      return selected;
    },
    get text() {
      return input.value.trim();
    },
    set(item) {
      setValue(item);
    },
    setSilently(item) {
      setValue(item, true);
    },
    clear() {
      setValue(null);
      close();
    },
    input,
  };
}
