// scene.js — 首頁 3D 櫻花瓣（Three.js，由 js/motion.js 在首頁動態載入）
// 花瓣用一個 InstancedMesh 一次畫完；滑鼠左右移動會吹起一陣風，鏡頭也跟著微微偏移。
// 畫面看不到（捲走、切到別的分頁）時自動暫停，不浪費電。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  // 櫻花瓣：前端有一個小缺口
  const s = new THREE.Shape();
  s.moveTo(0, -0.55);
  s.bezierCurveTo(0.42, -0.25, 0.46, 0.32, 0.14, 0.55);
  s.lineTo(0, 0.44);
  s.lineTo(-0.14, 0.55);
  s.bezierCurveTo(-0.46, 0.32, -0.42, -0.25, 0, -0.55);
  const geo = new THREE.ShapeGeometry(s, 10);
  // 微微彎曲，翻轉時才有立體感
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.pow(pos.getX(i), 2) * 0.5);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.92 });

  const N = window.innerWidth < 760 ? 34 : 70;
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const palette = ['#f6c9cd', '#f9dadc', '#fffaf5', '#f3b8be', '#fbe7b0'].map(c => new THREE.Color(c));
  const P = Array.from({ length: N }, (_, i) => ({
    x: (Math.random() - 0.5) * 22, y: (Math.random() - 0.5) * 12, z: -5 + Math.random() * 6.5,
    vy: 0.006 + Math.random() * 0.012, phase: Math.random() * Math.PI * 2, sway: 0.4 + Math.random() * 0.8,
    rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
    vr: [0.004 + Math.random() * 0.012, 0.003 + Math.random() * 0.01, 0.002 + Math.random() * 0.008],
    s: 0.35 + Math.random() * 0.4,
  }));
  P.forEach((_, i) => mesh.setColorAt(i, palette[i % palette.length]));
  scene.add(mesh);

  const m = new THREE.Object3D();
  let wind = 0, windTarget = 0, camX = 0, camY = 0, running = true, visible = true, raf = 0, t = 0;
  const onMove = e => { const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5; windTarget = x * 0.05; camX = x * 1.2; camY = -y * 0.6; };
  window.addEventListener('pointermove', onMove, { passive: true });

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && running && !raf) loop(); }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => { running = !document.hidden; if (running && visible && !raf) loop(); };
  document.addEventListener('visibilitychange', onVis);

  function loop() {
    raf = 0;
    if (!running || !visible) return;
    t += 1;
    wind += (windTarget - wind) * 0.03;
    camera.position.x += (camX - camera.position.x) * 0.04;
    camera.position.y += (camY - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    for (let i = 0; i < N; i++) {
      const p = P[i];
      p.y -= p.vy;
      p.x += Math.sin(t * 0.01 + p.phase) * 0.008 * p.sway + wind;
      p.rx += p.vr[0]; p.ry += p.vr[1]; p.rz += p.vr[2];
      if (p.y < -7) { p.y = 7; p.x = (Math.random() - 0.5) * 22; }
      if (p.x > 12) p.x = -12; else if (p.x < -12) p.x = 12;
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(p.rx, p.ry, p.rz);
      m.scale.setScalar(p.s);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  return {
    canvas,
    dispose() {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect(); io.disconnect();
      geo.dispose(); mat.dispose(); renderer.dispose();
    },
  };
}
