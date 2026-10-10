'use client';

import React, { useState, useRef } from 'react';
import { createRnnoise } from '@jitsi/rnnoise-wasm';

export default function StudioMic() {
  const [isActive, setIsActive] = useState(false);
  const [statusText, setStatusText] = useState('Система ожидает запуска...');
  
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const audioOutputRef = useRef(null);

  const startEngine = async () => {
    try {
      setStatusText('Захват микрофона...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
      });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);

      setStatusText('Загрузка нейросети RNNoise...');
      const rnnoiseNode = await createRnnoise();

      // DSP: Формирование глубокого студийного баритона
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 65; // Убираем низкий гул комнаты

      const bassBoost = ctx.createBiquadFilter();
      bassBoost.type = 'lowshelf';
      bassBoost.frequency.value = 120;
      bassBoost.gain.value = 4.5; // Бархатный бас

      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3500;
      presence.gain.value = 2.0; // Четкость речи

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24; 
      compressor.ratio.value = 4.0;     
      compressor.attack.value = 0.003;  
      compressor.release.value = 0.1;

      const streamDestination = ctx.createMediaStreamDestination();
      
      // Цепь обработки: Микрофон -> ИИ-шумодав -> Эквалайзер -> Компрессор -> Выход
      source.connect(rnnoiseNode)
            .connect(highpass)
            .connect(bassBoost)
            .connect(presence)
            .connect(compressor)
            .connect(streamDestination);

      setStatusText('Поиск Виртуального кабеля...');
      const audio = new Audio();
      audioOutputRef.current = audio;
      audio.srcObject = streamDestination.stream;
      await audio.play();

      const devices = await navigator.mediaDevices.enumerateDevices();
      const virtualCable = devices.find(d => 
        d.kind === 'audiooutput' && d.label.toLowerCase().includes('cable')
      );

      if (virtualCable) {
        await audio.setSinkId(virtualCable.deviceId);
        setStatusText('Успешно: Звук направлен в Виртуальный кабель!');
      } else {
        setStatusText('Внимание: Кабель не найден, звук в динамиках.');
      }

      setIsActive(true);
    } catch (err) {
      console.error(err);
      setStatusText('Ошибка: ' + err.message);
    }
  };

  const stopEngine = () => {
    if (audioCtxRef.current) audioCtxRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioOutputRef.current) audioOutputRef.current.pause();
    setIsActive(false);
    setStatusText('Эфир остановлен');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-6">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-gray-800">
        <h1 className="text-2xl font-bold mb-1">Studio Mic <span className="text-emerald-500">AI</span></h1>
        <p className="text-xs text-gray-400 mb-6">Локальный нейро-процессинг звука</p>
        
        <button 
          onClick={isActive ? stopEngine : startEngine}
          className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all ${
            isActive 
              ? 'bg-red-600/20 text-red-500 border border-red-500/40 hover:bg-red-600/30' 
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40'
          }`}
        >
          {isActive ? 'ОСТАНОВИТЬ' : 'ВКЛЮЧИТЬ СТУДИЮ'}
        </button>

        <div className="mt-6 p-3 bg-gray-950 rounded-lg border border-gray-800">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Статус</p>
          <p className="text-xs text-gray-300">{statusText}</p>
        </div>
      </div>
    </div>
  );
}
