import React from 'react';

interface AudioVisualizerProps {
  isConnected: boolean;
  volume: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isConnected, volume }) => {
  // We simulate a waveform using 3 bars that react to volume
  // Volume is 0 to 1
  
  if (!isConnected) return null;

  return (
    <div className="flex items-end justify-center gap-2 h-16">
        {/* Bar 1 */}
        <div 
            className="w-4 bg-indigo-500 rounded-full transition-all duration-75"
            style={{ 
                height: `${20 + (volume * 80)}%`,
                opacity: 0.7 + (volume * 0.3)
            }} 
        />
        {/* Bar 2 (Main) */}
        <div 
            className="w-4 bg-indigo-600 rounded-full transition-all duration-75"
            style={{ 
                height: `${30 + (volume * 100)}%`, // Moves more
                opacity: 1
            }} 
        />
        {/* Bar 3 */}
        <div 
            className="w-4 bg-indigo-500 rounded-full transition-all duration-75"
            style={{ 
                height: `${20 + (volume * 70)}%`,
                opacity: 0.7 + (volume * 0.3)
            }} 
        />
    </div>
  );
};