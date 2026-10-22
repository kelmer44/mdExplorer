// Built-in themes. Each one is a set of CSS variables applied to :root.
// `code` is the highlight.js theme used when the code theme is set to "auto".
window.BUILTIN_THEMES = [
  {
    id: 'github-light',
    name: 'GitHub Light',
    dark: false,
    code: 'github',
    vars: {
      bg: '#ffffff', fg: '#1f2328', muted: '#59636e', border: '#d1d9e0', link: '#0969da', accent: '#0969da',
      'code-bg': '#f6f8fa', 'inline-code-bg': 'rgba(129,139,152,0.15)', 'sidebar-bg': '#f6f8fa', 'sidebar-fg': '#1f2328',
      hover: 'rgba(129,139,152,0.15)', selected: 'rgba(9,105,218,0.14)', 'quote-bar': '#d1d9e0', 'table-stripe': '#f6f8fa',
      'toolbar-bg': '#ffffff', mark: '#fff8c5',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    dark: true,
    code: 'github-dark',
    vars: {
      bg: '#0d1117', fg: '#e6edf3', muted: '#9198a1', border: '#30363d', link: '#4493f8', accent: '#4493f8',
      'code-bg': '#151b23', 'inline-code-bg': 'rgba(101,108,118,0.25)', 'sidebar-bg': '#010409', 'sidebar-fg': '#e6edf3',
      hover: 'rgba(101,108,118,0.2)', selected: 'rgba(56,139,253,0.2)', 'quote-bar': '#3d444d', 'table-stripe': '#151b23',
      'toolbar-bg': '#010409', mark: '#bb800966',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    dark: true,
    code: 'base16/dracula',
    vars: {
      bg: '#282a36', fg: '#f8f8f2', muted: '#a0a6c4', border: '#44475a', link: '#8be9fd', accent: '#bd93f9',
      'code-bg': '#21222c', 'inline-code-bg': '#44475a', 'sidebar-bg': '#21222c', 'sidebar-fg': '#f8f8f2',
      hover: 'rgba(98,114,164,0.3)', selected: 'rgba(189,147,249,0.25)', 'quote-bar': '#bd93f9', 'table-stripe': '#2c2e3b',
      'toolbar-bg': '#191a21', mark: '#f1fa8c55',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    dark: true,
    code: 'nord',
    vars: {
      bg: '#2e3440', fg: '#eceff4', muted: '#a3abbd', border: '#434c5e', link: '#88c0d0', accent: '#88c0d0',
      'code-bg': '#3b4252', 'inline-code-bg': '#434c5e', 'sidebar-bg': '#272c36', 'sidebar-fg': '#d8dee9',
      hover: 'rgba(76,86,106,0.5)', selected: 'rgba(136,192,208,0.22)', 'quote-bar': '#81a1c1', 'table-stripe': '#323846',
      'toolbar-bg': '#242933', mark: '#ebcb8b55',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    dark: false,
    code: 'base16/solarized-light',
    vars: {
      bg: '#fdf6e3', fg: '#073642', muted: '#657b83', border: '#e4dcc4', link: '#268bd2', accent: '#268bd2',
      'code-bg': '#eee8d5', 'inline-code-bg': '#eee8d5', 'sidebar-bg': '#eee8d5', 'sidebar-fg': '#073642',
      hover: 'rgba(147,161,161,0.2)', selected: 'rgba(38,139,210,0.18)', 'quote-bar': '#b58900', 'table-stripe': '#f5efdc',
      'toolbar-bg': '#eee8d5', mark: '#b5890044',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    dark: true,
    code: 'base16/solarized-dark',
    vars: {
      bg: '#002b36', fg: '#eee8d5', muted: '#93a1a1', border: '#0a4655', link: '#2aa1e8', accent: '#2aa198',
      'code-bg': '#073642', 'inline-code-bg': '#073642', 'sidebar-bg': '#00232c', 'sidebar-fg': '#eee8d5',
      hover: 'rgba(88,110,117,0.35)', selected: 'rgba(42,161,152,0.25)', 'quote-bar': '#b58900', 'table-stripe': '#04313d',
      'toolbar-bg': '#00212a', mark: '#b5890055',
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    dark: false,
    code: 'kimbie-light',
    vars: {
      bg: '#f4ecd8', fg: '#433422', muted: '#7a6a55', border: '#dccfb3', link: '#9c4a1a', accent: '#9c4a1a',
      'code-bg': '#ebe1c8', 'inline-code-bg': '#e6dabd', 'sidebar-bg': '#ebe1c8', 'sidebar-fg': '#433422',
      hover: 'rgba(122,106,85,0.15)', selected: 'rgba(156,74,26,0.15)', 'quote-bar': '#c8a876', 'table-stripe': '#efe6cf',
      'toolbar-bg': '#ebe1c8', mark: '#e8c66a77',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    dark: true,
    code: 'atom-one-dark',
    vars: {
      bg: '#282c34', fg: '#d7dae0', muted: '#9da5b4', border: '#3e4451', link: '#61afef', accent: '#61afef',
      'code-bg': '#21252b', 'inline-code-bg': '#3a3f4b', 'sidebar-bg': '#21252b', 'sidebar-fg': '#d7dae0',
      hover: 'rgba(76,82,99,0.45)', selected: 'rgba(97,175,239,0.2)', 'quote-bar': '#c678dd', 'table-stripe': '#2c313a',
      'toolbar-bg': '#1d2026', mark: '#e5c07b55',
    },
  },
];

window.FONT_STACKS = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  serif: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace',
  humanist: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif',
};
