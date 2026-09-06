import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export default function QRCodeImage({ value, size = 180, style = {}, className = '', alt = 'QR Code' }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!value) {
      setDataUrl('');
      return;
    }
    let isMounted = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then(url => {
        if (isMounted) setDataUrl(url);
      })
      .catch(err => {
        console.error('Local QR Code generation error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: '#ffffff', 
          borderRadius: '8px', 
          ...style 
        }}
      >
        <span style={{ fontSize: '11px', color: '#666' }}>Rendering QR...</span>
      </div>
    );
  }

  return (
    <img 
      src={dataUrl} 
      alt={alt} 
      style={{ width: `${size}px`, height: `${size}px`, display: 'block', borderRadius: '8px', ...style }} 
      className={className} 
    />
  );
}
