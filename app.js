(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const recordBtn=$("recordBtn"), stopBtn=$("stopBtn"), timer=$("timer");
  const originalAudio=$("originalAudio"), previewAudio=$("previewAudio");
  const previewBtn=$("previewBtn"), renderBtn=$("renderBtn"), pitch=$("pitch"), speed=$("speed");
  const pitchValue=$("pitchValue"), speedValue=$("speedValue"), robotToggle=$("robotToggle");
  let stream=null, recorder=null, chunks=[], sourceBlob=null, sourceBuffer=null, timerHandle=null, startedAt=0, previewUrl=null, renderedUrl=null, deferredInstall=null;
  let audioContext=null, previewSource=null, previewNodes=[];
  const presets={
    normal:{pitch:0,speed:1,robot:false},
    baby:{pitch:8,speed:1.18,robot:false},
    female:{pitch:4,speed:1.08,robot:false},
    male:{pitch:-5,speed:.92,robot:false},
    robot:{pitch:0,speed:1,robot:true},
    alien:{pitch:7,speed:.82,robot:true}
  };
  function updateLabels(){pitchValue.textContent=`${Number(pitch.value)>0?"+":""}${pitch.value} semitones`;speedValue.textContent=`${Number(speed.value).toFixed(2)}×`;}
  function fmt(sec){return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(Math.floor(sec%60)).padStart(2,"0")}`;}
  function setStatus(msg){$("recordStatus").textContent=msg;}
  function stopPreview(){try{if(previewSource)previewSource.stop();}catch{} previewSource=null;previewNodes.forEach(n=>{try{n.disconnect()}catch{}});previewNodes=[];}
  async function decodeSource(){if(!sourceBlob)throw new Error("Record your voice first.");const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error("Web Audio is not supported in this browser.");if(!audioContext)audioContext=new C();if(!sourceBuffer){sourceBuffer=await audioContext.decodeAudioData(await sourceBlob.arrayBuffer());}return sourceBuffer;}
  async function startRecording(){
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setStatus("Recording is not supported in this browser. Try a current Chrome browser over HTTPS.");return;}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      chunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      recorder.onstop=()=>{sourceBlob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});sourceBuffer=null;const url=URL.createObjectURL(sourceBlob);originalAudio.src=url;originalAudio.hidden=false;previewBtn.disabled=false;renderBtn.disabled=false;setStatus("Recording saved in this page. Choose an effect to preview or render.");stream?.getTracks().forEach(t=>t.stop());stream=null;stopBtn.disabled=true;recordBtn.disabled=false;clearInterval(timerHandle);};
      recorder.start();startedAt=Date.now();timer.textContent="00:00";timerHandle=setInterval(()=>timer.textContent=fmt((Date.now()-startedAt)/1000),250);
      recordBtn.disabled=true;stopBtn.disabled=false;setStatus("Recording… speak normally. Press Stop when finished.");
    }catch(e){setStatus(e.name==="NotAllowedError"?"Microphone permission was denied. Allow microphone access in your browser settings.":`Could not start recording: ${e.message}`);}
  }
  function stopRecording(){if(recorder&&recorder.state!=="inactive")recorder.stop();}
  function applyPreset(name){const p=presets[name];pitch.value=p.pitch;speed.value=p.speed;robotToggle.checked=p.robot;document.querySelectorAll(".preset").forEach(b=>b.classList.toggle("selected",b.dataset.preset===name));updateLabels();$("renderStatus").textContent="";$("downloadLink").hidden=true;}
  document.querySelectorAll(".preset").forEach(b=>b.addEventListener("click",()=>applyPreset(b.dataset.preset)));
  pitch.addEventListener("input",()=>{updateLabels();document.querySelectorAll(".preset").forEach(b=>b.classList.remove("selected"));});
  speed.addEventListener("input",()=>{updateLabels();document.querySelectorAll(".preset").forEach(b=>b.classList.remove("selected"));});
  robotToggle.addEventListener("change",()=>{document.querySelectorAll(".preset").forEach(b=>b.classList.remove("selected"));});
  recordBtn.addEventListener("click",startRecording);stopBtn.addEventListener("click",stopRecording);
  async function makeProcessedBuffer(){
    const input=await decodeSource();const rate=Number(speed.value)*Math.pow(2,Number(pitch.value)/12);
    const outLength=Math.max(1,Math.ceil(input.length/rate));const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    if(!Offline)throw new Error("Offline audio processing is not supported in this browser.");
    const offline=new Offline(input.numberOfChannels,outLength,input.sampleRate);
    const src=offline.createBufferSource();src.buffer=input;src.playbackRate.value=rate;
    if(robotToggle.checked){
      const gain=offline.createGain(), osc=offline.createOscillator(), depth=offline.createGain();
      osc.type="sine";osc.frequency.value=34;depth.gain.value=.22;
      // Ring-style modulation: audible mechanical tremolo without external libraries.
      const mod=offline.createGain();mod.gain.value=0.78;
      osc.connect(depth);depth.connect(mod.gain);src.connect(mod);mod.connect(gain);gain.connect(offline.destination);osc.start();src.start();
    }else{src.connect(offline.destination);src.start();}
    return await offline.startRendering();
  }
  function bufferToWav(buffer){
    const channels=buffer.numberOfChannels, frames=buffer.length, sampleRate=buffer.sampleRate;
    const bytesPerSample=2, blockAlign=channels*bytesPerSample, dataSize=frames*blockAlign;
    const ab=new ArrayBuffer(44+dataSize), view=new DataView(ab);
    const write=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
    write(0,"RIFF");view.setUint32(4,36+dataSize,true);write(8,"WAVE");write(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*blockAlign,true);view.setUint16(32,blockAlign,true);view.setUint16(34,16,true);write(36,"data");view.setUint32(40,dataSize,true);
    let offset=44;
    for(let i=0;i<frames;i++)for(let ch=0;ch<channels;ch++){let s=Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]));view.setInt16(offset,s<0?s*32768:s*32767,true);offset+=2;}
    return new Blob([ab],{type:"audio/wav"});
  }
  previewBtn.addEventListener("click",async()=>{
    try{previewBtn.disabled=true;previewBtn.textContent="Preparing…";stopPreview();const buf=await makeProcessedBuffer();const url=URL.createObjectURL(bufferToWav(buf));if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=url;previewAudio.src=url;previewAudio.hidden=false;await previewAudio.play();$("renderStatus").textContent="Effect ready. You can listen or render a downloadable WAV."; }
    catch(e){$("renderStatus").textContent=e.message||"Could not process audio.";}
    finally{previewBtn.disabled=false;previewBtn.textContent="▶ Preview effect";}
  });
  renderBtn.addEventListener("click",async()=>{
    try{renderBtn.disabled=true;renderBtn.textContent="Rendering…";$("renderStatus").textContent="Processing audio locally…";const buf=await makeProcessedBuffer();const blob=bufferToWav(buf);if(renderedUrl)URL.revokeObjectURL(renderedUrl);renderedUrl=URL.createObjectURL(blob);$("downloadLink").href=renderedUrl;$("downloadLink").hidden=false;$("downloadLink").download=`voice-shift-${Date.now()}.wav`;$("renderStatus").textContent=`Done — ${(blob.size/1024/1024).toFixed(2)} MB WAV created on this device.`;}
    catch(e){$("renderStatus").textContent=e.message||"Could not render audio.";}
    finally{renderBtn.disabled=false;renderBtn.textContent="✨ Render WAV";}
  });
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").hidden=false;$("installHelp").textContent="Your browser supports direct installation. Tap Install app.";});
  $("installBtn").addEventListener("click",async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installBtn").hidden=true;});
  window.addEventListener("appinstalled",()=>{$("installBtn").hidden=true;$("installHelp").textContent="Voice Shift is installed on your device.";});
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
  if(!navigator.onLine)$("networkStatus").textContent="Offline";
  window.addEventListener("online",()=>$("networkStatus").textContent="Offline-ready");
  window.addEventListener("offline",()=>$("networkStatus").textContent="Offline");
  updateLabels();
})();