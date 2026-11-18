'use client';
import { useEffect } from 'react';

export default function BodyClass({ name }) {
  useEffect(() => {
    const names = name.split(' ');
    document.body.classList.add(...names);
    return () => document.body.classList.remove(...names);
  }, [name]);
  return null;
}
