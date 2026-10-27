# Trilha original (síntese em numpy): eletrônica 124 BPM em Lá menor, com seções que acompanham o vídeo.
# Gera musica.mp3 (lido por montar.cjs). Sem amostras de terceiros: sem questão de direitos autorais.
import numpy as np, subprocess, wave, os
D = os.path.dirname(os.path.abspath(__file__)); SR = 44100; BPM = 124
beat = 60/BPM; bar = 4*beat; NB = 69; N = int(NB*bar*SR) + SR*2
rng = np.random.default_rng(7)
mid = lambda m: 440*2**((m-69)/12)
def env(n, a, d):  # ataque curto + queda exponencial
    t = np.arange(n)/SR; return np.minimum(1, t/max(a,1e-4))*np.exp(-t/d)
def saw(f, n, h=8):
    t = np.arange(n)/SR; return sum(np.sin(2*np.pi*f*k*t)/k for k in range(1, h+1))*0.6
def put(buf, x, i):
    j = min(len(buf), i+len(x));  buf[i:j] += x[:j-i]
kick_n = int(.3*SR); tk = np.arange(kick_n)/SR
kick = np.sin(2*np.pi*(45*tk + 75*(1-np.exp(-tk*30))/30*1))*np.exp(-tk/.09)*1.0
kick += 0.25*np.sin(2*np.pi*45*tk)*np.exp(-tk/.2)
noise = lambda n: rng.standard_normal(n)
hat = np.diff(noise(int(.06*SR)+1))*env(int(.06*SR), .001, .018)*0.35
clap = np.diff(noise(int(.2*SR)+1))*env(int(.2*SR), .002, .05)*0.5
chords = [[57,60,64],[53,57,60],[55,60,64],[55,59,62]]; roots = [33,29,36,31]
kb = np.zeros(N); bass = np.zeros(N); drums = np.zeros(N); arp = np.zeros(N); pad = np.zeros(N); fx = np.zeros(N)
def on(b, a, c): return a <= b < c
for b in range(NB):
    t0 = int(b*bar*SR); ch = chords[b % 4]; r = roots[b % 4]
    full = on(b,8,32) or on(b,40,64); kick_on = full or on(b,4,8) or on(b,64,67)
    arp_vol = .55 if b < 8 else (.8 if full else .7 if on(b,32,40) else .5)
    # pad: acorde com ataque lento
    n = int(bar*SR); p = sum(saw(mid(m-12), n, 5) for m in ch)/3
    pad_env = np.minimum(1, np.arange(n)/(SR*.5))*np.minimum(1, (n-np.arange(n))/(SR*.3))
    put(pad, p*pad_env*(.5 if full else .8), t0)
    # arp em semicolcheias
    pat = [0,1,2,1,2,1,0,1,0,1,2,1,2,1,2,1]
    for s in range(16):
        m = ch[pat[s]] + 12 + (12 if s % 8 == 6 else 0); i = t0 + int(s*beat/4*SR); ln = int(.22*SR)
        put(arp, saw(mid(m), ln, 6)*env(ln, .002, .07)*arp_vol*.5, i)
    for q in range(4):
        i = t0 + int(q*beat*SR)
        if kick_on: put(kb, kick, i)
        if full and q in (1,3): put(drums, clap, i)
        if full or on(b,4,8) or on(b,32,40):
            put(drums, hat, i + int(beat/2*SR)); 
            if full: put(drums, hat*0.6, i)
    if full or on(b,64,67):
        for e in range(8):   # baixo em colcheias
            i = t0 + int(e*beat/2*SR); ln = int(beat/2*SR*.9)
            put(bass, saw(mid(r+(12 if e % 4 == 3 else 0)), ln, 4)*env(ln, .004, .2)*.7, i)
    if b in (7, 31, 39, 63):  # riser antes das viradas
        n2 = int(bar*SR); r2 = np.diff(noise(n2+1))*np.linspace(0, .5, n2)**2; put(fx, r2, t0)
# sidechain: pad, baixo e arp "respiram" com o bumbo
duck = np.ones(N)
for b in range(NB):
    if not (on(b,8,32) or on(b,40,64) or on(b,4,8) or on(b,64,67)): continue
    for q in range(4):
        i = int((b*bar+q*beat)*SR); n = int(.3*SR); duck[i:i+n] = np.minimum(duck[i:i+n], 1-.6*np.exp(-np.arange(min(n,N-i))/(SR*.1)))
L = kb + drums*.8 + (bass + pad*.9)*duck + arp*(.6+.4*duck) + fx*.6
echo = np.zeros(N); d = int(beat*.75*SR); echo[d:] = arp[:-d]*.4
R = L + echo; L = L + np.roll(echo, d//2)*.6
st = np.stack([L, R], 1); st /= np.abs(st).max()/0.89
# fade-out final
fo = int(3*SR); st[-fo:] *= np.linspace(1, 0, fo)[:, None]
wav = os.path.join(D, 'musica.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-y','-v','error','-i',wav,'-codec:a','libmp3lame','-b:a','192k',os.path.join(D,'musica.mp3')], check=True)
os.remove(wav); print('musica.mp3', round(len(st)/SR,1), 's')
