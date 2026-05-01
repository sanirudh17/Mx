/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      partition?: string;
      nodeintegration?: string;
      plugins?: string;
      preload?: string;
      httpreferrer?: string;
      useragent?: string;
      disablewebsecurity?: string;
      allowpopups?: string;
      webpreferences?: string;
      blinkfeatures?: string;
      disableblinkfeatures?: string;
      guestinstance?: string;
    };
  }
}

export {};
