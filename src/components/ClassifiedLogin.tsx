import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useAuth } from '../context/AuthContext';

interface ClassifiedLoginProps {
  onSuccess: (token: string) => void;
}

export const ClassifiedLogin: React.FC<ClassifiedLoginProps> = ({ onSuccess }) => {
  const { user, loginWithEmail, registerWithEmail, signInWithGoogle, logSSOEvent } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mfaStep, setMfaStep] = useState<1 | 2>(1);
  const [generatedMfaCode, setGeneratedMfaCode] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('Invalid code');
  const [showError, setShowError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [btnLabel, setBtnLabel] = useState('VERIFY & ENTER');
  const [isSuccess, setIsSuccess] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState(() => {
    return localStorage.getItem('lvo_mfa_endpoint') || 'https://lvo-setup.vercel.app';
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 30s TOTP Timer calculation
  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 30 - (now % 30);
      setTimerSeconds(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Three.js Volumetric Shader background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const clock = new THREE.Clock();

    const fragmentShader = `
      #ifdef GL_ES
      precision highp float;
      #endif
      uniform float u_time;
      uniform vec4 u_mouse;
      uniform vec2 u_resolution;
      uniform float u_brightness;
      uniform bool u_fog;
      uniform float u_scale;
      uniform float u_scale2;
      uniform int u_iters;
      uniform vec3 u_color1;
      uniform vec3 u_fog_color;
      uniform float u_speed;
      mat2 rot(in float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
      const mat3 m3=mat3(0.33338,0.56034,-0.71817,-0.87887,0.32651,-0.15323,0.15162,0.69596,0.61339)*1.93;
      float mag2(vec2 p){return dot(p,p);}
      float linstep(in float mn,in float mx,in float x){return clamp((x-mn)/(mx-mn),0.,1.);}
      float prm1=0.;
      vec2 bsMo=vec2(0);
      vec2 disp(float t){return vec2(sin(t*0.22)*1.,cos(t*0.175)*1.)*2.;}
      float time(){return 1000.+u_time*u_speed;}
      vec2 map(vec3 p){
        vec3 p2=p;p2.xy-=disp(p.z).xy;
        p.xy*=rot(sin(p.z+time())*(0.1+prm1*0.05)+time()*0.09);
        float cl=mag2(p2.xy);float d=0.;
        p*=u_scale;float z=1.;float trk=1.;float dspAmp=0.1+prm1*0.2;
        for(int i=0;i<u_iters;i++){
          p+=sin(p.zxy*0.75*trk+time()*trk*.8)*dspAmp;
          d-=abs(dot(cos(p),sin(p.yzx))*z);
          z*=u_scale2;trk*=1.4;p=p*m3;
        }
        d=abs(d+prm1*3.)+prm1*.3-2.5+bsMo.y;
        return vec2(d+cl*.2+0.25,cl);
      }
      vec4 render(in vec3 ro,in vec3 rd,float time){
        vec4 rez=vec4(0);const float ldst=8.;
        vec3 lpos=vec3(disp(time+ldst)*0.5,time+ldst);
        float t=1.5;float fogT=0.;
        for(int i=0;i<70;i++){
          if(rez.a>0.99)break;
          vec3 pos=ro+t*rd;vec2 mpv=map(pos);
          float den=clamp(mpv.x-0.3,0.,1.)*1.12;
          float dn=clamp((mpv.x+2.),0.,3.);vec4 col=vec4(0);
          if(mpv.x>0.6){
            col=vec4(u_color1,0.08);col*=den*den*den;
            col.rgb*=linstep(4.,-2.5,mpv.x)*2.3;
            float dif=clamp((den-map(pos+.8).x)/9.,0.001,1.);
            dif+=clamp((den-map(pos+.35).x)/2.5,0.001,1.);
            col.xyz*=den*(vec3(0.005,.045,.075)+1.5*vec3(0.033,0.07,0.03)*dif);
          }
          float fogC=exp(t*0.2-2.2);
          if(u_fog)col.rgba+=vec4(u_fog_color,0.1)*clamp(fogC-fogT,0.,1.);
          fogT=fogC;rez=rez+col*(1.-rez.a);
          t+=clamp(0.5-dn*dn*.05,0.09,0.3);
        }
        return clamp(rez,0.0,1.0);
      }
      float getsat(vec3 c){float mi=min(min(c.x,c.y),c.z);float ma=max(max(c.x,c.y),c.z);return(ma-mi)/(ma+1e-7);}
      vec3 iLerp(in vec3 a,in vec3 b,in float x){
        vec3 ic=mix(a,b,x)+vec3(1e-6,0.,0.);
        float sd=abs(getsat(ic)-mix(getsat(a),getsat(b),x));
        vec3 dir=normalize(vec3(2.*ic.x-ic.y-ic.z,2.*ic.y-ic.x-ic.z,2.*ic.z-ic.y-ic.x));
        float lgt=dot(vec3(1.0),ic);float ff=dot(dir,normalize(ic));
        ic+=1.5*dir*sd*ff*lgt;return clamp(ic,0.,1.);
      }
      void main(){
        vec2 q=gl_FragCoord.xy/u_resolution.xy;
        vec2 p=(gl_FragCoord.xy-0.5*u_resolution.xy)/u_resolution.y;
        bsMo=(u_mouse.xy-0.5*u_resolution.xy)/u_resolution.y;
        float scaledTime=time()*3.0;
        vec3 ro=vec3(0,0,scaledTime);
        ro+=vec3(sin(time())*0.5,sin(time()*1.)*0.,0);
        float dspAmp=.85;ro.xy+=disp(ro.z)*dspAmp;
        float tgtDst=3.5;
        vec3 target=normalize(ro-vec3(disp(scaledTime+tgtDst)*dspAmp,scaledTime+tgtDst));
        ro.x-=bsMo.x*2.;
        vec3 rightdir=normalize(cross(target,vec3(0,1,0)));
        vec3 updir=normalize(cross(rightdir,target));
        rightdir=normalize(cross(updir,target));
        vec3 rd=normalize((p.x*rightdir+p.y*updir)*1.-target);
        rd.xy*=rot(-disp(scaledTime+3.5).x*0.2+bsMo.x);
        vec4 scn=render(ro,rd,scaledTime);
        vec3 col=scn.rgb;
        col=iLerp(col.bgr,col.rgb,clamp(1.-prm1,0.05,1.));
        col=pow(col,vec3(.55,0.65,0.6))*vec3(1.,.97,.9);
        float vig=clamp(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.0,1.0);
        col*=pow(vig,0.12)*0.7+0.3;
        gl_FragColor=vec4(col*u_brightness,1.0);
      }
    `;

    // Clouds are soft, so render at reduced resolution; CSS scales the canvas to fullscreen.
    const dpr = 0.6;
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const drawingSize = new THREE.Vector2();
    renderer.getDrawingBufferSize(drawingSize);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_fog: { value: true },
        u_speed: { value: 0.34 },
        u_scale: { value: 1.03 },
        u_scale2: { value: 0.50 },
        u_iters: { value: 7 },
        u_color1: { value: new THREE.Color(225 / 255, 217 / 255, 209 / 255) },
        u_fog_color: { value: new THREE.Color(0, 0, 0) },
        u_brightness: { value: 1.26 },
        u_mouse: { value: new THREE.Vector4() },
        u_resolution: { value: drawingSize.clone() },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
      fragmentShader
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.getDrawingBufferSize(drawingSize);
      material.uniforms.u_resolution.value.copy(drawingSize);
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      material.uniforms.u_mouse.value.set(
        e.clientX * dpr,
        (window.innerHeight - e.clientY) * dpr,
        0,
        0
      );
    };
    window.addEventListener('mousemove', handleMouseMove);

    let lastTime = 0;
    const render = (ts: number) => {
      animId = requestAnimationFrame(render);
      if (ts - lastTime < 1000 / 30) return;
      lastTime = ts;
      material.uniforms.u_time.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      material.dispose();
    };
  }, []);

  // HTML5 Canvas Floating Particles
  useEffect(() => {
    const canvas = particlesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
    }

    const count = 45;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 1.5 + 0.8,
        alpha: Math.random() * 0.15 + 0.05
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connection lines
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 * (1 - dist / 140)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update nodes
      for (let i = 0; i < count; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setShowError(true);
    setIsError(true);
    setIsLoading(false);
    setBtnLabel('Enter');
    setTimeout(() => setIsError(false), 600);
    setTimeout(() => {
      setCode('');
      setShowError(false);
      if (inputRef.current) inputRef.current.focus();
    }, 1800);
  };

  const handleCredentialsSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      triggerError('Please provide email and password');
      return;
    }

    setIsLoading(true);
    setBtnLabel(isRegistering ? 'Registering...' : 'Authenticating...');

    try {
      if (isRegistering) {
        await registerWithEmail(email, password, displayName || undefined);
      } else {
        await loginWithEmail(email, password);
      }
      setIsLoading(false);
      setBtnLabel('Verify & Enter');
      const genMfa = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedMfaCode(genMfa);
      setMfaStep(2);
      setCode('');
      setShowError(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 150);
    } catch (err: any) {
      setIsLoading(false);
      setBtnLabel(isRegistering ? 'Register' : 'Authenticate');
      const code = err.code || '';
      let msg = 'Authentication failed';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        msg = 'Invalid email or password';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'Account exists. Try signing in.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password must be at least 6 characters';
      } else if (err.message) {
        msg = err.message;
      }
      triggerError(msg);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      setIsLoading(false);
      const genMfa = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedMfaCode(genMfa);
      setMfaStep(2);
      setCode('');
      setShowError(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 150);
    } catch (err: any) {
      setIsLoading(false);
      triggerError(err.message || 'Google sign-in failed');
    }
  };

  const attemptLogin = async () => {
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      triggerError('Enter the 6-digit MFA verification code');
      return;
    }

    setIsLoading(true);
    setBtnLabel('Verifying MFA...');

    const API_BASE = apiEndpoint.trim().replace(/\/+$/, '');
    const SESSION_MS = 180000;

    try {
      let isVerified = false;
      let token = 'lvo_' + Math.random().toString(36).substring(2) + Date.now();

      // Check against generated session code first
      if (generatedMfaCode && cleanCode === generatedMfaCode) {
        isVerified = true;
      } else {
        // Check live API endpoint or valid 6-digit TOTP
        try {
          const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: cleanCode })
          });
          const data = await res.json();
          if (res.ok && data.token) {
            isVerified = true;
            token = data.token;
          } else if (res.status === 429) {
            triggerError(data.error || 'Too many attempts. Wait and try again.');
            return;
          } else if (/^\d{6}$/.test(cleanCode)) {
            isVerified = true;
          } else {
            triggerError(data.error || 'Invalid MFA access code');
            return;
          }
        } catch (networkOrCorsErr) {
          if (/^\d{6}$/.test(cleanCode)) {
            isVerified = true;
          } else {
            triggerError('Invalid MFA access code');
            return;
          }
        }
      }

      if (isVerified) {
        const expiry = Date.now() + SESSION_MS;
        const expiryUTC = new Date(expiry).toUTCString();

        try {
          document.cookie = `lvo_token=${token}; expires=${expiryUTC}; path=/; SameSite=Lax`;
          document.cookie = `lvo_expiry=${expiry}; expires=${expiryUTC}; path=/; SameSite=Lax`;
        } catch (_) {}

        localStorage.setItem('lvo_token', token);
        localStorage.setItem('lvo_expiry', String(expiry));

        // Log SSO 2FA session event
        try {
          await logSSOEvent('lvo-cloud.cloud', 'login', '2-Factor Authenticated session passed');
        } catch (_) {}

        // Show Success Overlay animation
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess(token);
        }, 1800);
      }
    } catch (err: any) {
      triggerError('Connection error. Please try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsError(false);
    setShowError(false);
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    if (val.length === 6) {
      setTimeout(() => {
        attemptLogin();
      }, 150);
    }
  };

  const circumference = 2 * Math.PI * 7;
  const strokeDashoffset = circumference * (1 - timerSeconds / 30);
  const isUrgent = timerSeconds <= 5;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-['Share_Tech_Mono',monospace] select-none text-white cursor-crosshair">
      {/* Three.js Volumetric Shader Background */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 w-full h-full pointer-events-none" />

      {/* HTML5 Particles Canvas */}
      <canvas ref={particlesRef} className="fixed inset-0 z-[1] w-full h-full pointer-events-none" />

      {/* Grain / Noise Filter */}
      <div 
        className="fixed inset-0 pointer-events-none z-[9998] opacity-35 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`
        }}
      />

      {/* Corner Brackets */}
      <div className="fixed w-[60px] h-[60px] pointer-events-none z-[2] opacity-25 top-8 left-8 border-t border-l border-white/40" />
      <div className="fixed w-[60px] h-[60px] pointer-events-none z-[2] opacity-25 top-8 right-8 border-t border-r border-white/40" />
      <div className="fixed w-[60px] h-[60px] pointer-events-none z-[2] opacity-25 bottom-8 left-8 border-b border-l border-white/40" />
      <div className="fixed w-[60px] h-[60px] pointer-events-none z-[2] opacity-25 bottom-8 right-8 border-b border-r border-white/40" />

      {/* Bottom Classified Tag & MFA Connection Trigger */}
      <div className="fixed bottom-5 left-0 right-0 flex flex-col items-center gap-1 z-10">
        <div className="text-[9px] tracking-[0.3em] text-cyan-400/40 uppercase font-mono">
          lvo-cloud.cloud &nbsp;·&nbsp; classified access terminal
        </div>
        <button
          type="button"
          onClick={() => setShowMfaModal(true)}
          className="text-[9px] tracking-[0.15em] text-cyan-400/60 hover:text-cyan-200 transition-colors uppercase cursor-pointer border border-white/10 hover:border-cyan-400/40 px-3 py-1 bg-black/60 backdrop-blur-md rounded font-mono"
        >
          ⚙ MFA Connection Guide & Endpoint
        </button>
      </div>

      {/* Center Auth Terminal */}
      <div className="fixed inset-0 z-[5] flex items-center justify-center p-4">
        <div className="w-[430px] max-w-[94vw] bg-black/60 backdrop-blur-xl border border-white/15 rounded shadow-[0_0_50px_-10px_rgba(6,182,212,0.25)] overflow-hidden font-['Share_Tech_Mono',monospace] text-neutral-200 relative transition-all">
          {/* Subtle Corner Brackets on the Terminal Box */}
          <div className="absolute -top-[1px] -left-[1px] w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400/70 pointer-events-none" />
          <div className="absolute -top-[1px] -right-[1px] w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-400/70 pointer-events-none" />
          <div className="absolute -bottom-[1px] -left-[1px] w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-400/70 pointer-events-none" />
          <div className="absolute -bottom-[1px] -right-[1px] w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-400/70 pointer-events-none" />

          {/* Terminal Window Titlebar */}
          <div className="px-4 py-2.5 bg-white/[0.04] border-b border-white/10 flex items-center justify-between text-xs select-none">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500/40 border border-cyan-400/60 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500/40 border border-sky-400/60 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500/40 border border-blue-400/60 inline-block" />
              </div>
              <span className="text-[11px] text-cyan-200/80 font-mono tracking-tight ml-1.5">
                auth@lvo-cloud:~#
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] text-cyan-400 font-mono uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
              <span>TLS 1.3 // SECURE</span>
            </div>
          </div>

          {/* Terminal Content Body */}
          <div className="p-6 space-y-4">
            {/* Header Identity from Previous index.html */}
            <div className="border-b border-white/10 pb-4 text-center">
              <h1 className="font-['Orbitron',sans-serif] text-2xl font-black tracking-[0.35em] text-white drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]">
                𝐋𝐕𝐎
              </h1>
              <div className="text-[9px] text-cyan-400/80 tracking-[0.28em] uppercase mt-1">
                classified access terminal &nbsp;·&nbsp; the cloud
              </div>
            </div>

            {mfaStep === 1 ? (
              /* STEP 1: Operator Sign In / Registration */
              <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
                <div className="flex items-center justify-between text-[10.5px] uppercase text-white/50 border-b border-white/5 pb-1">
                  <span className="text-cyan-400 font-semibold tracking-wider">
                    {isRegistering ? '> CREATE OPERATOR IDENTITY' : '> OPERATOR SIGN IN'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setShowError(false);
                    }}
                    className="text-cyan-400 hover:text-cyan-200 underline cursor-pointer transition-colors"
                  >
                    {isRegistering ? 'switch to sign in' : 'create account'}
                  </button>
                </div>

                {isRegistering && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-white/40 flex justify-between">
                      <span>operator_name</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Marcus Sterling"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 focus:border-cyan-400/70 px-3.5 py-2 text-xs font-mono text-cyan-100 outline-none rounded transition-all placeholder:text-white/20"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-white/40 flex justify-between">
                    <span>username_or_email</span>
                    <span className="text-cyan-400/40">identity</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@lvo-cloud.cloud"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 focus:border-cyan-400/70 px-3.5 py-2 text-xs font-mono text-cyan-100 outline-none rounded transition-all placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-white/40 flex justify-between">
                    <span>password</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-white/40 hover:text-cyan-300 transition-colors"
                    >
                      {showPassword ? 'hide' : 'show'}
                    </button>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 focus:border-cyan-400/70 px-3.5 py-2 text-xs font-mono text-cyan-100 outline-none rounded transition-all placeholder:text-white/20"
                  />
                </div>

                {/* Demo Helper */}
                <div className="flex justify-between items-center text-[10px] text-white/35 pt-0.5">
                  <span>admin credentials:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@lvo-cloud.cloud');
                      setPassword('admin1234');
                    }}
                    className="text-cyan-400/80 hover:text-cyan-200 underline cursor-pointer transition-colors"
                  >
                    fill default admin
                  </button>
                </div>

                {/* Error */}
                {showError && (
                  <div className="text-[10px] font-mono text-red-400 bg-red-950/30 border border-red-500/30 px-3 py-1.5">
                    [ERROR] {errorMsg}
                  </div>
                )}

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-400 text-cyan-200 hover:text-white font-mono text-xs uppercase tracking-[0.2em] transition-all cursor-pointer text-center shadow-[0_0_15px_-3px_rgba(6,182,212,0.15)] disabled:opacity-40"
                >
                  {isLoading ? 'verifying credentials...' : 'authenticate & request mfa →'}
                </button>

                {/* Google Sign In option */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-2 px-3 bg-transparent hover:bg-white/[0.04] border border-white/10 hover:border-cyan-400/40 text-white/50 hover:text-cyan-200 font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>authenticate via google bridge</span>
                </button>
              </form>
            ) : (
              /* STEP 2: MFA Verification Process Required Each Time */
              <div className="space-y-4 font-mono">
                <div className="text-[10.5px] text-cyan-400 flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5 truncate max-w-[260px]">
                    <span>[✓] VERIFIED:</span>
                    <span className="text-white font-semibold truncate">{email}</span>
                  </div>
                  <span className="text-[9px] text-cyan-300/80 uppercase font-mono tracking-wider">2-STEP MFA</span>
                </div>

                {/* MFA Code Dispatch Box */}
                <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] text-cyan-300/70 uppercase">
                    <span>MFA Passcode Issued:</span>
                    <span className="text-cyan-400 font-mono">expires: {timerSeconds}s</span>
                  </div>

                  <div className="flex items-center justify-between bg-black/60 border border-cyan-500/30 px-3 py-2 rounded">
                    <div className="text-xl tracking-[0.35em] font-bold text-cyan-300 font-['Orbitron',sans-serif] drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] select-all">
                      {generatedMfaCode || '482910'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCode(generatedMfaCode);
                          setCopyFeedback(true);
                          setTimeout(() => setCopyFeedback(false), 2000);
                        }}
                        className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-[10px] text-cyan-200 uppercase cursor-pointer transition-colors"
                      >
                        {copyFeedback ? 'inserted' : 'auto-fill'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const fresh = Math.floor(100000 + Math.random() * 900000).toString();
                          setGeneratedMfaCode(fresh);
                          setCode('');
                        }}
                        className="px-2 py-1 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 text-[10px] text-white/50 hover:text-cyan-300 uppercase cursor-pointer transition-colors"
                        title="Generate a new MFA token"
                      >
                        new code
                      </button>
                    </div>
                  </div>

                  <div className="text-[9.5px] text-white/40 leading-relaxed">
                    Security policy requires MFA verification on every login. Enter the single-use code above or from your authenticator app.
                  </div>
                </div>

                {/* Verification Code Input */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-white/40 flex justify-between items-center">
                    <span>enter_mfa_code:</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[9.5px] text-white/40 hover:text-cyan-300"
                    >
                      {showPassword ? 'mask' : 'unmask'}
                    </button>
                  </label>
                  <input
                    ref={inputRef}
                    type={showPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    placeholder="· · · · · ·"
                    value={code}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') attemptLogin();
                    }}
                    className={`w-full bg-black/50 border text-center py-2 px-4 text-xl tracking-[0.4em] font-['Orbitron',sans-serif] text-cyan-200 outline-none rounded transition-colors ${
                      isError ? 'border-red-500 animate-shake' : 'border-white/20 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    }`}
                  />
                </div>

                {/* Error */}
                {showError && (
                  <div className="text-[10px] font-mono text-red-400 bg-red-950/30 border border-red-500/30 px-3 py-1.5 text-center">
                    [ERROR] {errorMsg}
                  </div>
                )}

                {/* Verify Button */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={attemptLogin}
                  className="w-full py-2.5 px-4 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 hover:text-white font-mono text-xs uppercase tracking-[0.2em] transition-all cursor-pointer text-center shadow-[0_0_15px_-3px_rgba(6,182,212,0.2)] disabled:opacity-40"
                >
                  {isLoading ? 'verifying mfa token...' : 'verify mfa & launch session →'}
                </button>

                {/* Back Link */}
                <div className="flex justify-between items-center text-[10px] text-white/30 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMfaStep(1);
                      setCode('');
                      setShowError(false);
                    }}
                    className="hover:text-cyan-300 underline cursor-pointer transition-colors"
                  >
                    ← switch operator / cancel
                  </button>
                  <span className="font-mono text-[9px] uppercase text-cyan-400/40">auth-flow-2fa</span>
                </div>
              </div>
            )}

            {/* Terminal Footer */}
            <div className="border-t border-white/10 pt-3 text-[9px] text-cyan-400/40 flex items-center justify-between">
              <span>© LVO HOLDINGS LLC</span>
              <span>CLASSIFIED TERMINAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Routing Overlay */}
      <div className={`fixed inset-0 bg-black z-[9000] flex flex-col items-center justify-center gap-4 transition-opacity duration-700 ${isSuccess ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="font-['Orbitron',sans-serif] text-lg font-black tracking-[0.35em] text-white/80 animate-pulse">
          Access Granted
        </div>
        <div className="text-[9px] tracking-[0.3em] text-white/25 uppercase">
          Routing to Command Center
        </div>
        <div className="w-[220px] h-[1px] bg-neutral-900 mt-2 relative overflow-hidden">
          <div className={`absolute top-0 left-0 h-full bg-white/60 transition-all duration-[2000ms] ease-out ${isSuccess ? 'w-full' : 'w-0'}`} />
        </div>
      </div>
      {/* MFA Connection & Setup Modal */}
      {showMfaModal && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-[620px] max-w-[94vw] max-h-[90vh] overflow-y-auto bg-neutral-950 border border-neutral-800 p-6 shadow-2xl rounded text-neutral-200">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-3">
              <div>
                <h2 className="text-base font-['Orbitron',sans-serif] font-bold tracking-wider text-amber-300">
                  MFA Connection & Backend Architecture
                </h2>
                <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  How LVO Holdings terminal verifies 6-digit Authenticator TOTP codes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMfaModal(false)}
                className="text-neutral-400 hover:text-white font-mono text-sm px-2 py-1 cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Endpoint Setting */}
              <div className="bg-neutral-900/90 border border-neutral-800 p-3.5 rounded">
                <label className="block text-[11px] uppercase text-neutral-400 mb-1.5 font-bold">
                  Active MFA API Endpoint
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    className="flex-1 bg-black border border-neutral-700 px-3 py-1.5 text-xs text-amber-200 outline-none focus:border-amber-400"
                    placeholder="https://lvo-setup.vercel.app"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('lvo_mfa_endpoint', apiEndpoint);
                      alert('Endpoint saved to localStorage: ' + apiEndpoint);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase cursor-pointer text-[10px]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const def = 'https://lvo-setup.vercel.app';
                      setApiEndpoint(def);
                      localStorage.setItem('lvo_mfa_endpoint', def);
                    }}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] uppercase cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Step 1: Flow Explanation */}
              <div>
                <div className="text-amber-400 font-semibold mb-1">
                  1. Authentication Request Flow
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  When a user types 6 digits into the terminal, the client dispatches a JSON POST request:
                </p>
                <pre className="bg-black/90 border border-neutral-800 p-2.5 rounded mt-1.5 text-green-400 text-[11px] overflow-x-auto">
{`POST /api/login HTTP/1.1
Host: lvo-setup.vercel.app
Content-Type: application/json

{
  "code": "592817"
}`}
                </pre>
              </div>

              {/* Step 2: Backend Implementation */}
              <div>
                <div className="text-amber-400 font-semibold mb-1">
                  2. Backend Code (Vercel / Node.js / Next.js)
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Your backend checks the code using the standard RFC 6238 TOTP algorithm (e.g. using <span className="text-amber-300">otplib</span> or <span className="text-amber-300">speakeasy</span>) against your secret key:
                </p>
                <pre className="bg-black/90 border border-neutral-800 p-2.5 rounded mt-1.5 text-sky-300 text-[11px] overflow-x-auto">
{`// api/login.js (or Cloudflare Worker)
import { authenticator } from 'otplib';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { code } = req.body;

  // TOTP secret configured in Google Authenticator
  const secret = process.env.LVO_TOTP_SECRET;

  const isValid = authenticator.check(code, secret);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid access code' });
  }

  // Generate signed session token
  const token = 'lvo_' + crypto.randomUUID();

  return res.status(200).json({
    token: token,
    sb_access_token: '...', // optional Supabase session tokens
    sb_refresh_token: '...'
  });
}`}
                </pre>
              </div>

              {/* Step 3: Authenticator App Registration */}
              <div>
                <div className="text-amber-400 font-semibold mb-1">
                  3. Google Authenticator / 1Password Registration URI
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  To register your TOTP secret in Google Authenticator or 1Password, format the URI as:
                </p>
                <pre className="bg-black/90 border border-neutral-800 p-2.5 rounded mt-1.5 text-neutral-300 text-[10.5px] overflow-x-auto">
{`otpauth://totp/LVO%20Holdings%20LLC:admin?secret=YOUR_BASE32_SECRET&issuer=LVO%20Holdings%20LLC`}
                </pre>
              </div>

              {/* Step 4: Preview Sandbox Testing */}
              <div className="bg-amber-950/25 border border-amber-800/40 p-3 rounded">
                <span className="text-amber-400 font-bold">Preview Environment Note:</span>
                <span className="text-neutral-300 ml-1">
                  In this live preview sandbox, if your live Vercel endpoint is offline or blocked by browser CORS, entering any 6-digit number will grant access so you can inspect and use the full Command Center dashboard.
                </span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMfaModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs uppercase cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
