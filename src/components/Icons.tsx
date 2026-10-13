type P = { className?: string };

export const Play = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
  </svg>
);

export const Pause = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" fill="currentColor" />
  </svg>
);

export const Plus = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" fill="currentColor" />
  </svg>
);

export const Close = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5.6 4.2 12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z" fill="currentColor" />
  </svg>
);

// חץ "קדימה" ב-RTL מצביע שמאלה
export const Arrow = ({ className = "icon arrow" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10.4 5.4 4.8 11H21v2H4.8l5.6 5.6L9 20l-8-8 8-8z" fill="currentColor" />
  </svg>
);

export const Bag = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M8 7V6a4 4 0 0 1 8 0v1h3.5l1 14h-17l1-14zm2 0h4V6a2 2 0 0 0-4 0zM6.4 9l-.7 10h12.6l-.7-10z"
      fill="currentColor"
    />
  </svg>
);

export const Check = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4z" fill="currentColor" />
  </svg>
);

export const WhatsApp = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"
    />
  </svg>
);

export const Instagram = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM21.9 7.4a5.8 5.8 0 0 0-1.6-4.1 5.8 5.8 0 0 0-4.1-1.6C14.6 1.6 9.4 1.6 7.8 1.7a5.8 5.8 0 0 0-4.1 1.6 5.8 5.8 0 0 0-1.6 4.1c-.1 1.6-.1 6.8 0 8.4a5.8 5.8 0 0 0 1.6 4.1 5.8 5.8 0 0 0 4.1 1.6c1.6.1 6.8.1 8.4 0a5.8 5.8 0 0 0 4.1-1.6 5.8 5.8 0 0 0 1.6-4.1c.1-1.6.1-6.8 0-8.4zm-2.1 10.2a3.3 3.3 0 0 1-1.9 1.9c-1.3.5-4.4.4-5.9.4s-4.6.1-5.9-.4a3.3 3.3 0 0 1-1.9-1.9c-.5-1.3-.4-4.4-.4-5.9s-.1-4.6.4-5.9a3.3 3.3 0 0 1 1.9-1.9c1.3-.5 4.4-.4 5.9-.4s4.6-.1 5.9.4a3.3 3.3 0 0 1 1.9 1.9c.5 1.3.4 4.4.4 5.9s.1 4.6-.4 5.9z"
    />
  </svg>
);

export const YouTube = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15V9l5.8 3z"
    />
  </svg>
);

export const Mail = ({ className = "icon" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M2 5h20v14H2zm2 2v.6l8 5.2 8-5.2V7zm16 3-8 5.2L4 10v7h16z" />
  </svg>
);
