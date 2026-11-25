import React from 'react';

export default function Avatar({ src, name, size = 32 }) {
  return (
    <img
      className="avatar"
      src={src || '/avatars/carrot.png'}
      alt={name || ''}
      title={name}
      style={{ width: size, height: size }}
    />
  );
}