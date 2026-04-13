# 🤖 IA Search — Práctica Primer Parcial

Visualizador interactivo de algoritmos de búsqueda en IA.
**No requiere npm ni build step.** Solo abrir con Live Server.

## Cómo abrir en VS Code

1. Descomprime `Practica PP IA.zip`
2. Abre VS Code → **File → Open Folder** → selecciona `Practica PP IA`
3. Instala la extensión **Live Server** (Ritwick Dey) si no la tienes
4. Clic derecho en `index.html` → **Open with Live Server**
5. Se abre automáticamente en `http://127.0.0.1:5500`

## Estructura de directorios

```
Practica PP IA/
├── index.html           ← Punto de entrada (HTML completo)
├── styles/
│   └── globals.css      ← Estilos globales + responsive
├── src/
│   ├── app.js           ← Lógica principal de la app
│   └── utils/
│       ├── mazeAlgorithms.js   ← BPA, BPP, A*, Voraz
│       └── tttAlgorithms.js    ← Minimax, Alpha-Beta
└── public/
    └── favicon.svg
```

## Tecnologías
- HTML5 + CSS3 (sin frameworks)
- JavaScript ES Modules (sin npm)
- HTML5 Canvas API
- Google Fonts: Sora + Space Mono

## Problemas
- **Grupo 1:** Ratón en Laberinto — BPA, BPP, A*, Voraz
- **Grupo 2:** Tres en Raya — Minimax, Alpha-Beta Pruning

**Docente:** Lic. Patricia Rodríguez Bilbao
