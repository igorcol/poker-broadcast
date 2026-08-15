poker-broadcast/
├── package.json          # npm workspaces (nativo, sem Turborepo/pnpm)
├── packages/
│   └── core/             # tipos + regras do Hold'em + equity. Lógica pura, zero I/O
├── apps/
│   ├── engine/           # processo Node: state machine + WebSocket server
│   └── web/              # Next.js: rotas /overlay e /console
├── services/
│   └── vision/           # Python + OpenCV, venv próprio
├── docs/
└── data/
    ├── recordings/       # vídeos da Fase 0 (fora do git)
    └── labels/           # manifesto de rótulos (versionado)