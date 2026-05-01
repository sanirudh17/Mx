export const TAKE_PANE_SCREENSHOT_EVENT = 'app:takePaneScreenshot';

export function requestPaneScreenshot(paneId: string): void {
  window.dispatchEvent(
    new CustomEvent(TAKE_PANE_SCREENSHOT_EVENT, {
      detail: { paneId }
    })
  );
}
