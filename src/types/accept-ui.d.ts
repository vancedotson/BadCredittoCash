/**
 * Authorize.net AcceptUI (v3) hosted card lightbox. The card form runs in an
 * Authorize.net iframe; this page only ever receives an opaque payment nonce
 * and masked card metadata. Card numbers never enter our DOM, requests or logs.
 */
export type AcceptUiResponse = {
  opaqueData?: { dataDescriptor?: string; dataValue?: string };
  messages?: { resultCode?: string; message?: Array<{ code?: string; text?: string }> };
  customerInformation?: { firstName?: string; lastName?: string };
};

declare global {
  interface Window {
    /** Named by the AcceptUI button's data-responseHandler attribute. */
    acceptUiResponseHandler?: (response: AcceptUiResponse) => void;
  }
}
