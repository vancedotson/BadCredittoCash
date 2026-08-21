import { expect, test } from "@playwright/test";

test("normal sign in is clear and keyboard ready", async ({ page }) => {
  await page.goto("/login");

  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const password = page.getByLabel("Password", { exact: true });

  await expect(page.getByRole("heading", { name: "CRM sign in" })).toBeVisible();
  await expect(page.getByText("Authorized team members only.")).toBeVisible();
  await expect(email).toBeFocused();
  await expect(email).toHaveValue("");
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("type", "password");
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  const setupStatus = page.getByRole("status").filter({
    hasText: /local sign-in is unavailable until Supabase is configured/i,
  });
  if (await setupStatus.count()) {
    await expect(signIn).toBeDisabled();
    await expect(signIn).toHaveAttribute("aria-describedby", "login-setup-status");
  } else {
    await expect(signIn).toBeEnabled();
  }
  await expect(page.getByRole("link", { name: "Forgot your password?", exact: true })).toHaveAttribute("href", "/forgot-password");
});

test("missing password state preserves email and focuses the password", async ({ page }) => {
  await page.goto("/login?state=missing-password");

  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const password = page.getByLabel("Password", { exact: true });

  await expect(email).toHaveValue("team@funnelsgenius.com");
  await expect(password).toHaveValue("");
  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-describedby", "login-error");
  await expect(page.locator("#login-error")).toHaveText("Enter your password.");

  await password.fill("preview-password");
  await expect(page.locator("#login-error")).toHaveCount(0);
});

test("invalid login state keeps the email and offers password recovery", async ({ page }) => {
  await page.goto("/login?state=invalid-login");

  const password = page.getByLabel("Password", { exact: true });
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("team@funnelsgenius.com");
  await expect(password).toBeFocused();
  await expect(page.locator("#login-error")).toContainText(/email or password is incorrect/i);
  await expect(page.getByRole("link", { name: "Forgot your password?", exact: true })).toBeVisible();
  await password.fill("preview-password");
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("expired session explains why sign in is needed", async ({ page }) => {
  await page.goto("/login?reason=session-expired&next=/crm/tasks");
  const sessionAlert = page.getByRole("alert").filter({ hasText: "Your session expired." });
  await expect(sessionAlert).toContainText("Your session expired.");
  await expect(sessionAlert).toContainText("Sign in again to continue where you left off.");
  await expect(page.locator('input[name="next"]')).toHaveValue("/crm/tasks");
});

test("sign in loading state locks the form and announces progress", async ({ page }) => {
  await page.goto("/login?state=login-loading");

  const form = page.locator('form[aria-busy="true"]');
  const button = page.getByRole("button", { name: /signing in/i });

  await expect(form).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(/signing in securely/i);
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-describedby", "login-loading-status");
});

test("normal password reset reflects the environment's Supabase configuration", async ({ page }) => {
  await page.goto("/forgot-password");

  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const button = page.getByRole("button", { name: "Send reset link", exact: true });

  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(email).toHaveValue("");
  await expect(email).toBeFocused();
  const setupStatus = page.getByRole("status").filter({
    hasText: /local password reset is unavailable/i,
  });
  if (process.env.E2E_EXPECT_SUPABASE === "true") {
    await expect(setupStatus).toHaveCount(0);
    await expect(button).toBeEnabled();
  } else if (await setupStatus.count()) {
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-describedby", "reset-setup-status");
  } else {
    await expect(button).toBeEnabled();
  }
});

test("password reset sent state confirms the address and next steps", async ({ page }) => {
  await page.goto("/forgot-password?state=reset-sent");

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("team@funnelsgenius.com");
  await expect(page.getByText(/link expires/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sign in", exact: true })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("button", { name: "Send reset link", exact: true })).toHaveCount(0);
});

test("password reset error preserves and focuses the email", async ({ page }) => {
  await page.goto("/forgot-password?state=reset-error");

  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await expect(email).toHaveValue("team@funnelsgenius.com");
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "reset-error");
  await expect(page.locator("#reset-error")).toContainText(/could not send the reset email/i);

  await email.fill("other@example.com");
  await expect(page.locator("#reset-error")).toHaveCount(0);
});

test("password reset loading state locks the form and announces progress", async ({ page }) => {
  await page.goto("/forgot-password?state=reset-loading");

  const form = page.locator('form[aria-busy="true"]');
  const button = page.getByRole("button", { name: /sending/i });

  await expect(form).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(/sending a secure reset link/i);
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-describedby", "reset-loading-status");
});

test("short password state explains the rule and focuses the new password", async ({ page }) => {
  await page.goto("/auth/update-password?state=missing-password");

  const password = page.getByLabel("New password", { exact: true });
  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-describedby", "password-error");
  await expect(page.locator("#password-error")).toHaveText("Use at least 12 characters.");

  await password.fill("a-strong-new-password");
  await expect(page.locator("#password-error")).toHaveCount(0);
});

test("password mismatch state points to the confirmation field", async ({ page }) => {
  await page.goto("/auth/update-password?state=password-mismatch");

  const confirm = page.getByLabel("Confirm password", { exact: true });
  await expect(confirm).toBeFocused();
  await expect(confirm).toHaveAttribute("aria-invalid", "true");
  await expect(confirm).toHaveAttribute("aria-describedby", "password-error");
  await expect(page.locator("#password-error")).toHaveText("The passwords do not match.");
});

test("password saving state locks the form and announces progress", async ({ page }) => {
  await page.goto("/auth/update-password?state=password-loading");

  await expect(page.locator('form[aria-busy="true"]')).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Confirm password", { exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(/saving your new password securely/i);
  await expect(page.getByRole("button", { name: /saving/i })).toBeDisabled();
});

test("invalid password link explains expiry and offers a new link", async ({ page }) => {
  await page.goto("/auth/update-password?state=invalid-link");

  await expect(page.getByRole("heading", { name: /password link is invalid or expired/i })).toBeVisible();
  await expect(page.getByText(/can only be used once and expire/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a new reset link", exact: true })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  await expect(page.getByRole("button", { name: "Set password", exact: true })).toHaveCount(0);
});
