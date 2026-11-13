// Fixed lettering measured on the approved 1672 × 941 reference.
export function mountPosterTitle(element){
  const letters=[
    ['W',270,-42,411,445],['H',510,156,285,473],['A',654,183,347,489],['T',1000,163,386,510],
    ['R',97,488,333,371],['E',399,566,234,298],['M',533,619,363,321],['A',807,594,296,329],
    ['I',999,501,51,426],['N',1118,537,257,349],['S',1380,564,238,337]
  ];
  const text=letters.map(([letter,x,y,width,height])=>`<text x="${x}" y="${y+height}" font-size="${height/.716}" textLength="${width}" lengthAdjust="spacingAndGlyphs">${letter}</text>`).join('');
  element.innerHTML=`<svg class="reference-title" viewBox="0 0 1672 941" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="type-spread" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="16"/></filter>
      <filter id="type-ink" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".012 .045" numOctaves="2" seed="12" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/><feGaussianBlur stdDeviation="2.8"/></filter>
      <linearGradient id="ink-color" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0e2421"/><stop offset=".5" stop-color="#102e24"/><stop offset="1" stop-color="#22342e"/></linearGradient>
      <g id="reference-letters" font-family="Arial, sans-serif" font-weight="400">${text}</g>
    </defs>
    <use href="#reference-letters" fill="#167950" opacity=".65" filter="url(#type-spread)" transform="translate(-9 8)"/>
    <use href="#reference-letters" fill="#bc7d89" opacity=".22" filter="url(#type-spread)" transform="translate(10 1)"/>
    <use href="#reference-letters" fill="url(#ink-color)" filter="url(#type-ink)"/>
  </svg>`;
}
