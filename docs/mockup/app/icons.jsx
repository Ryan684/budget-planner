/* ── icons.jsx — stroke icons (currentColor) ─────────────────────── */
function Icon({ name, size = 22, sw = 1.75, style, fill = false }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    dashboard: <><rect x="3" y="3" width="8" height="9" rx="1.6" {...p} /><rect x="13" y="3" width="8" height="5.5" rx="1.6" {...p} /><rect x="13" y="11" width="8" height="10" rx="1.6" {...p} /><rect x="3" y="14.5" width="8" height="6.5" rx="1.6" {...p} /></>,
    bills: <><path d="M6 3h12v18l-2.2-1.4L13.6 21 12 19.6 10.4 21 8.2 19.6 6 21V3Z" {...p} /><path d="M9.2 8h5.6M9.2 11.5h5.6M9.2 15h3.2" {...p} /></>,
    pots: <><path d="M4 9.5h16M5 9.5l1.4 9.2a2 2 0 0 0 2 1.7h7.2a2 2 0 0 0 2-1.7L19 9.5" {...p} /><path d="M8.5 9.5C8.5 6.4 9.9 4 12 4s3.5 2.4 3.5 5.5" {...p} /></>,
    claude: <><path d="M12 3.2 13.7 9l5.1 1.6L13.7 12 12 17.8 10.3 12 5.2 10.6 10.3 9 12 3.2Z" {...p} /><path d="M18.5 4.2 19.2 6.3 21.3 7 19.2 7.7 18.5 9.8 17.8 7.7 15.7 7 17.8 6.3 18.5 4.2Z" {...p} /></>,
    chevL: <path d="M15 5l-7 7 7 7" {...p} />,
    chevR: <path d="M9 5l7 7-7 7" {...p} />,
    chevD: <path d="M5 9l7 7 7-7" {...p} />,
    plus: <path d="M12 5v14M5 12h14" {...p} />,
    lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" {...p} /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...p} /></>,
    recurring: <><path d="M4 11a8 8 0 0 1 14-5l2 2M20 13a8 8 0 0 1-14 5l-2-2" {...p} /><path d="M20 3v5h-5M4 21v-5h5" {...p} /></>,
    check: <path d="M5 12.5l4.5 4.5L19 7" {...p} />,
    question: <><circle cx="12" cy="12" r="9" {...p} /><path d="M9.4 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2.1-2.4 3.9M12 17.2h.01" {...p} /></>,
    undo: <><path d="M9 7H5V3" {...p} /><path d="M5 7a9 9 0 1 1-2 5.7" {...p} transform="translate(0.2,0)" /><path d="M4.6 7.2A9 9 0 1 1 3 12.4" {...p} /></>,
    trash: <><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13" {...p} /></>,
    dots: <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2.4" {...p} /><path d="M4 9.5h16M8.5 3v4M15.5 3v4" {...p} /></>,
    edit: <><path d="M5 19h3l9-9-3-3-9 9v3Z" {...p} /><path d="M14 7l3 3" {...p} /></>,
    x: <path d="M6 6l12 12M18 6L6 18" {...p} />,
    arrowR: <path d="M5 12h14M13 6l6 6-6 6" {...p} />,
    send: <path d="M5 12 19 5l-4 14-3.5-5.5L5 12Z" {...p} />,
    list: <><path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" {...p} /></>,
    wallet: <><rect x="3.5" y="6" width="17" height="13" rx="2.5" {...p} /><path d="M16 12.5h.01M3.5 9.5h17" {...p} /></>,
    spark: <path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6L12 4Z" {...p} />,
    info: <><circle cx="12" cy="12" r="9" {...p} /><path d="M12 11v5M12 8h.01" {...p} /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

window.Icon = Icon;
