import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeNetAcceptUiCspOrigins,
  authorizeNetAcceptUiScriptUrl,
  authorizeNetApiOrigin,
  authorizeNetConfigured,
  authorizeNetEnvironment,
  authorizeNetPublicClientKey,
} from "./authorize-net-config";

function configure(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    PAYMENTS_ENABLED: "true", AUTHNET_ENV: "sandbox", AUTHNET_API_LOGIN_ID: "login",
    AUTHNET_TRANSACTION_KEY: "key", AUTHNET_SIGNATURE_KEY: "signature", AUTHNET_PUBLIC_CLIENT_KEY: "client", ...overrides,
  };
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

describe("Authorize.net configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads AUTHNET_ENV exactly", () => {
    configure();
    expect(authorizeNetEnvironment()).toBe("sandbox");
    configure({ AUTHNET_ENV: "production" });
    expect(authorizeNetEnvironment()).toBe("production");
    for (const value of ["Production", "prod", "", " sandbox"]) {
      configure({ AUTHNET_ENV: value });
      expect(authorizeNetEnvironment()).toBeNull();
    }
  });

  it("selects the AcceptUI script and API origin per environment", () => {
    configure();
    expect(authorizeNetAcceptUiScriptUrl()).toBe("https://jstest.authorize.net/v3/AcceptUI.js");
    expect(authorizeNetApiOrigin()).toBe("https://apitest.authorize.net");
    configure({ AUTHNET_ENV: "production" });
    expect(authorizeNetAcceptUiScriptUrl()).toBe("https://js.authorize.net/v3/AcceptUI.js");
    expect(authorizeNetApiOrigin()).toBe("https://api.authorize.net");
  });

  it("is configured only with the gate and all four credentials", () => {
    configure();
    expect(authorizeNetConfigured()).toBe(true);
    expect(authorizeNetPublicClientKey()).toBe("client");
    for (const [name, value] of [["PAYMENTS_ENABLED", "false"], ["AUTHNET_API_LOGIN_ID", " "], ["AUTHNET_TRANSACTION_KEY", ""],
      ["AUTHNET_SIGNATURE_KEY", ""], ["AUTHNET_PUBLIC_CLIENT_KEY", ""], ["AUTHNET_ENV", "staging"]]) {
      configure({ [name]: value });
      expect(authorizeNetConfigured()).toBe(false);
    }
  });

  it("offers CSP origins only when enabled with a valid environment", () => {
    configure();
    expect(authorizeNetAcceptUiCspOrigins()?.script).toEqual(["https://jstest.authorize.net"]);
    configure({ PAYMENTS_ENABLED: "false" });
    expect(authorizeNetAcceptUiCspOrigins()).toBeNull();
    configure({ AUTHNET_ENV: "nope" });
    expect(authorizeNetAcceptUiCspOrigins()).toBeNull();
  });
});
