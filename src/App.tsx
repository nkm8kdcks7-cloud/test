import React, { useEffect, useMemo, useRef, useState } from 'react';
import storyData from './data/story.ru.json';
import loreData from './data/lore.ru.json';
import { applyEffects, checkCondition, makeInitialState, type GameState, type Story, DEFAULT_FACTIONS } from './engine';
import { clearLocal, loadCloud, loadLocal, saveCloud, saveLocal, clearCloud, canUseCloud } from './storage';
import { haptic, initTelegramUI } from './telegram';

const STORY = storyData as unknown as Story;

type LoreEntry = { id: string; title: string; text: string[] };
const LORE = loreData as unknown as { meta: any; entries: LoreEntry[] };

type View = 'game' | 'menu' | 'about' | 'lore';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatFaction(key: string) {
  if (key === 'village') return 'Деревня';
  if (key === 'hunters') return 'Охотники';
  if (key === 'order') return 'Орден';
  if (key === 'dragons') return 'Драконы';
  return key;
}

type LocationKey =
  | 'ashen_gate'
  | 'mist_hollow_village'
  | 'tavern'
  | 'forest_circle'
  | 'underground_tunnels'
  | 'order_ruins'
  | 'whisper_swamp'
  | 'silver_mine'
  | 'prison_cages'
  | 'heart_of_seal';

function locationForNode(nodeId: string): LocationKey {
  const id = nodeId.toLowerCase();

  // keyword mapping first
  if (id.includes('tavern')) return 'tavern';
  if (id.includes('village')) return 'mist_hollow_village';
  if (id.includes('swamp')) return 'whisper_swamp';
  if (id.includes('mine')) return 'silver_mine';
  if (id.includes('prison') || id.includes('cage')) return 'prison_cages';
  if (id.includes('tunnel')) return 'underground_tunnels';
  if (id.includes('forest') || id.includes('circle')) return 'forest_circle';
  if (id.includes('ruins') || id.includes('order')) return 'order_ruins';
  if (id.includes('heart') || id.includes('final')) return 'heart_of_seal';

  // chapter-based fallback
  if (id.startsWith('intro')) return 'ashen_gate';
  if (id.startsWith('ch1')) return 'mist_hollow_village';
  if (id.startsWith('ch2')) return 'forest_circle';
  if (id.startsWith('ch3')) return 'order_ruins';
  if (id.startsWith('ch4')) return 'whisper_swamp';
  if (id.startsWith('ch5')) return 'silver_mine';
  if (id.startsWith('ch6')) return 'heart_of_seal';

  return 'ashen_gate';
}

function imageForLocation(loc: LocationKey): string {
  return `/assets/locations/${loc}.jpg`;
}

export default function App() {
  const [view, setView] = useState<View>('menu');
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.35);

  const [cloudStatus, setCloudStatus] = useState<'off'|'checking'|'ready'|'loaded'|'saved'|'error'>('checking');

  const [state, setState] = useState<GameState>(() => {
    const local = loadLocal();
    if (local) return {
      ...local,
      factions: { ...DEFAULT_FACTIONS, ...(local.factions ?? {}) },
      loreUnlocked: local.loreUnlocked ?? [],
    };
    return makeInitialState(STORY);
  });

  const node = STORY.nodes[state.nodeId];
  const locKey = locationForNode(state.nodeId);
  const locImg = imageForLocation(locKey);

  const availableChoices = useMemo(() => {
    if (!node) return [];
    return node.choices.filter(ch => checkCondition(state, ch.conditions));
  }, [node, state]);

  const loreUnlockedEntries = useMemo(() => {
    const set = new Set(state.loreUnlocked);
    return LORE.entries.filter(e => set.has(e.id));
  }, [state.loreUnlocked]);

  useEffect(() => {
    initTelegramUI();
    (async () => {
      if (!canUseCloud()) { setCloudStatus('off'); return; }
      setCloudStatus('ready');
      const cloud = await loadCloud();
      if (cloud && cloud.nodeId) {
        setState({
          ...cloud,
          factions: { ...DEFAULT_FACTIONS, ...(cloud.factions ?? {}) },
          loreUnlocked: cloud.loreUnlocked ?? [],
        });
        setCloudStatus('loaded');
      }
    })();
  }, []);

  const cloudTimer = useRef<number | null>(null);
  useEffect(() => {
    saveLocal(state);

    if (!canUseCloud()) return;
    if (cloudTimer.current) window.clearTimeout(cloudTimer.current);
    cloudTimer.current = window.setTimeout(async () => {
      const ok = await saveCloud(state);
      setCloudStatus(ok ? 'saved' : 'error');
    }, 1200);
  }, [state]);

  useEffect(() => {
    const el = document.getElementById('bgm') as HTMLAudioElement | null;
    if (!el) return;
    el.volume = muted ? 0 : clamp(volume, 0, 1);
  }, [muted, volume]);

  function newGame() {
    haptic('impact', 'light');
    setState(makeInitialState(STORY));
    setView('game');
  }

  async function resetSave() {
    haptic('impact', 'medium');
    clearLocal();
    if (canUseCloud()) await clearCloud();
    setState(makeInitialState(STORY));
    setView('menu');
    setCloudStatus(canUseCloud() ? 'ready' : 'off');
  }

  async function syncFromCloud() {
    if (!canUseCloud()) return;
    haptic('impact', 'light');
    setCloudStatus('checking');
    const cloud = await loadCloud();
    if (cloud && cloud.nodeId) {
      setState({
        ...cloud,
        factions: { ...DEFAULT_FACTIONS, ...(cloud.factions ?? {}) },
        loreUnlocked: cloud.loreUnlocked ?? [],
      });
      setCloudStatus('loaded');
    } else {
      setCloudStatus('error');
    }
  }

  async function pushToCloud() {
    if (!canUseCloud()) return;
    haptic('impact', 'light');
    const ok = await saveCloud(state);
    setCloudStatus(ok ? 'saved' : 'error');
  }

  function gameOver(fromNodeId: string) {
    haptic('notification', 'error');
    setState(prev => ({
      ...prev,
      nodeId: 'game_over',
      deathFrom: fromNodeId,
      history: [...prev.history, { nodeId: 'game_over', choiceText: 'Провал', at: Date.now() }],
    }));
  }

  function computeHapticForChoice(chEffects: any, nextId: string) {
    const hpDelta = (chEffects?.hp ?? 0) as number;
    const ends = nextId.startsWith('ending') || nextId === 'game_over' || nextId === 'heart_choice_final';
    if (ends) return { type: 'notification' as const, detail: 'success' as const };
    if (hpDelta < 0) return { type: 'impact' as const, detail: hpDelta <= -2 ? 'heavy' as const : 'medium' as const };
    const flagsAdd: string[] = chEffects?.flagsAdd ?? [];
    if (flagsAdd.includes('panic') || flagsAdd.includes('wounded')) return { type: 'impact' as const, detail: 'light' as const };
    return null;
  }

  function choose(i: number) {
    const ch = availableChoices[i];
    if (!ch) return;

    const h = computeHapticForChoice(ch.effects, ch.next);
    if (h) haptic(h.type, h.detail);

    if (ch.effects?.reset) {
      setState(makeInitialState(STORY));
      return;
    }

    const beforeNodeId = state.nodeId;
    const after = applyEffects(state, ch.effects);

    if (after.hp <= 0) {
      gameOver(beforeNodeId);
      return;
    }

    const nextId = ch.next;
    setState({
      ...after,
      nodeId: nextId,
      history: [...after.history, { nodeId: nextId, choiceText: ch.text, at: Date.now() }],
    });
  }

  if (!node) {
    return (
      <div className="app">
        <div className="panel">
          <div className="card">
            <h2>Ошибка</h2>
            <p>Не найден узел: <code>{state.nodeId}</code></p>
            <button className="btn" onClick={newGame}>Начать заново</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <audio id="bgm" src="/assets/audio/bg.mp3" autoPlay loop playsInline />
      <header className="topbar">
        <div className="brand">
          <div className="brand__title">Этернос</div>
          <div className="brand__sub">фэнтези-квест • mini app</div>
        </div>
        <div className="topbar__actions">
          <button className="iconbtn" title="Меню" onClick={() => setView('menu')}>☰</button>
        </div>
      </header>

      {view === 'menu' && (
        <div className="panel">
          <div className="card">
            <h2>Меню</h2>
            <div className="grid">
              <button className="btn" onClick={() => setView('game')}>Продолжить</button>
              <button className="btn" onClick={newGame}>Новая игра</button>
              <button className="btn secondary" onClick={() => setView('lore')}>Лор-книга</button>
              <button className="btn secondary" onClick={() => setView('about')}>Об игре</button>
              <button className="btn danger" onClick={resetSave}>Сбросить сохранения</button>
            </div>

            <div className="divider" />

            <div className="settings">
              <div className="row">
                <label style={{display:'flex', gap:10, alignItems:'center'}}>
                  <input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} />
                  <span>Без звука</span>
                </label>
              </div>
              <div className="row">
                <span>Громкость</span>
                <input type="range" min={0} max={1} step={0.01} value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))} />
              </div>
            </div>

            <div className="meta">
              <div>HP: <b>{state.hp}</b> • Общая репутация: <b>{state.reputation}</b></div>
              <div className="chips">
                {Object.entries(state.factions).map(([k,v]) => (
                  <span key={k} className="chip">{formatFaction(k)}: <b>{v}</b></span>
                ))}
              </div>
              <div className="chips">
                <span className="chip">Лор: <b>{state.loreUnlocked.length}</b></span>
                <span className="chip">Облако: <b>{cloudStatus}</b></span>
              </div>

              {canUseCloud() ? (
                <div className="grid" style={{marginTop: 10}}>
                  <button className="btn secondary" onClick={syncFromCloud}>Загрузить из облака</button>
                  <button className="btn secondary" onClick={pushToCloud}>Сохранить в облако</button>
                </div>
              ) : (
                <p style={{color:'rgba(255,255,255,.70)', marginTop: 10}}>
                  Облачные сохранения работают в Telegram через CloudStorage.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'about' && (
        <div className="panel">
          <div className="card">
            <h2>Об игре</h2>
            <p><b>Этернос</b> — сюжетный фэнтези-квест с выбором, провалами, фракциями и лор-книгой.</p>
            <ul>
              <li>Сюжет: <code>src/data/story.ru.json</code></li>
              <li>Лор: <code>src/data/lore.ru.json</code></li>
              <li>Локации/арт: <code>public/assets/locations/*.jpg</code></li>
              <li>Музыка: <code>public/assets/audio/bg.mp3</code></li>
              <li>Сохранение: локально + облако Telegram (если доступно)</li>
            </ul>
            <button className="btn" onClick={() => setView('menu')}>Назад</button>
          </div>
        </div>
      )}

      {view === 'lore' && (
        <div className="panel">
          <div className="card">
            <h2>Лор-книга</h2>
            {loreUnlockedEntries.length === 0 ? (
              <p style={{color:'rgba(255,255,255,.78)'}}>
                Пока пусто. Открывайте лор через сюжетные сцены и исследования.
              </p>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap: 10}}>
                {loreUnlockedEntries.map(e => (
                  <details key={e.id} className="inv">
                    <summary><b>{e.title}</b></summary>
                    <div style={{marginTop: 8}}>
                      {e.text.map((p, idx) => <p key={idx} style={{margin:'8px 0', lineHeight: 1.55, color:'rgba(255,255,255,.88)'}}>{p}</p>)}
                    </div>
                  </details>
                ))}
              </div>
            )}
            <div className="divider" />
            <button className="btn" onClick={() => setView('menu')}>Назад</button>
          </div>
        </div>
      )}

      {view === 'game' && (
        <main className="panel">
          <div className="card">
            <div className="scene">
              <img className="scene__img" src={locImg} alt={locKey} loading="eager" />
            </div>

            <div className="chapter">
              <h2>{node.title}</h2>

              {state.nodeId === 'game_over' && state.deathFrom && (
                <p style={{color:'rgba(255,255,255,.78)'}}>
                  Провал произошёл в сцене: <b>{STORY.nodes[state.deathFrom]?.title ?? state.deathFrom}</b>
                </p>
              )}

              {node.text.map((p, idx) => <p key={idx}>{p}</p>)}
            </div>

            <div className="divider" />

            <div className="choices">
              {availableChoices.map((ch, idx) => (
                <button key={idx} className="choice" onClick={() => choose(idx)}>
                  <span className="choice__idx">{idx + 1}</span>
                  <span className="choice__text">{ch.text}</span>
                </button>
              ))}
            </div>

            <div className="hud">
              <div className="hud__left">
                <span className="hud__item">HP: <b>{state.hp}</b></span>
                <span className="hud__item">Общая репутация: <b>{state.reputation}</b></span>
              </div>
              <div className="hud__right">
                <details className="inv">
                  <summary>Фракции</summary>
                  <ul>
                    {Object.entries(state.factions).map(([k,v]) => (
                      <li key={k}>{formatFaction(k)}: <b>{v}</b></li>
                    ))}
                  </ul>
                </details>

                {state.inventory.length > 0 && (
                  <details className="inv">
                    <summary>Инвентарь ({state.inventory.length})</summary>
                    <ul>{state.inventory.map(it => <li key={it}>{it}</li>)}</ul>
                  </details>
                )}

                <button className="btn secondary" style={{marginTop: 10}} onClick={() => setView('lore')}>
                  Лор-книга ({state.loreUnlocked.length})
                </button>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
