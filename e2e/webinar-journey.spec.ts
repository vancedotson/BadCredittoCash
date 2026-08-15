import { expect, test } from "@playwright/test";

test("idle player shows a clear start state without the booking offer", async ({ page }) => {
  await page.goto("/webinar/room");

  const player = page.getByRole("region", { name: /training player:/i });
  const stage = page.locator(".v4-player-stage");
  const seek = page.getByRole("slider", { name: "Seek" });

  await expect(player).toBeVisible();
  await expect(page.getByText("Press play to start")).toBeVisible();
  await expect(seek).toHaveAttribute("aria-valuenow", "0");
  await expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 35:00");
  await expect(page.getByText("0:00 / 35:00 · 0%")).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toHaveCount(0);

  await stage.focus();
  await expect(stage).toBeFocused();
  await expect
    .poll(() => stage.evaluate((element) => getComputedStyle(element).boxShadow))
    .not.toBe("none");
});

test("playing player review state advances and keeps the offer hidden", async ({ page }) => {
  await page.goto("/webinar/room?state=player-playing");

  const player = page.getByRole("region", { name: /training player:/i });
  const stage = page.locator(".v4-player-stage");
  const seek = page.getByRole("slider", { name: "Seek" });

  await expect(player).toHaveAttribute("data-player-state", "playing");
  await expect(stage).toHaveAttribute("aria-label", "Pause");
  await expect(stage).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await expect(seek).not.toHaveAttribute("aria-valuetext", "0:00 of 35:00");
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toHaveCount(0);
});

test("player quarter review state starts at 25 percent without the offer", async ({ page }) => {
  await page.goto("/webinar/room?state=player-25");

  const player = page.getByRole("region", { name: /training player:/i });
  const seek = page.getByRole("slider", { name: "Seek" });

  await expect(player).toHaveAttribute("data-player-state", "playing");
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await expect(seek).toHaveAttribute("aria-valuenow", "25");
  await expect(seek).toHaveAttribute("aria-valuetext", /8:4\d of 35:00/);
  await expect(page.getByText(/8:4\d \/ 35:00 · 25%/)).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toHaveCount(0);
});

test("player halfway review state starts at 50 percent without the offer", async ({ page }) => {
  await page.goto("/webinar/room?state=player-50");

  const player = page.getByRole("region", { name: /training player:/i });
  const seek = page.getByRole("slider", { name: "Seek" });

  await expect(player).toHaveAttribute("data-player-state", "playing");
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await expect(seek).toHaveAttribute("aria-valuenow", "50");
  await expect(seek).toHaveAttribute("aria-valuetext", /17:3\d of 35:00/);
  await expect(page.getByText(/17:3\d \/ 35:00 · 50%/)).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toHaveCount(0);
});

test("player at 75 percent reveals the correctly timed offer", async ({ page }) => {
  await page.goto("/webinar/room?state=player-75");

  const seek = page.getByRole("slider", { name: "Seek" });

  await expect(seek).toHaveAttribute("aria-valuenow", "75");
  await expect(seek).toHaveAttribute("aria-valuetext", /26:1\d of 35:00/);
  await expect(page.getByText(/26:1\d \/ 35:00 · 75%/)).toBeVisible();
  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toBeVisible();
});

test("player at 90 percent keeps the offer visible and controls usable", async ({ page }) => {
  await page.goto("/webinar/room?state=player-90");

  const player = page.getByRole("region", { name: /training player:/i });
  const stage = page.locator(".v4-player-stage");
  const seek = page.getByRole("slider", { name: "Seek" });

  await expect(player).toHaveAttribute("data-player-state", "playing");
  await expect(seek).toHaveAttribute("aria-valuenow", "90");
  await expect(seek).toHaveAttribute("aria-valuetext", /31:3\d of 35:00/);
  await expect(page.getByText(/31:3\d \/ 35:00 .* 90%/)).toBeVisible();
  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toBeVisible();

  await stage.click();
  await expect(player).toHaveAttribute("data-player-state", "paused");
  await expect(stage).toHaveAttribute("aria-pressed", "false");
  await expect(stage).toHaveAttribute("aria-label", "Play");
});

test("completed player shows a clear finish state and can replay", async ({ page }) => {
  const trackingEvents: string[] = [];
  page.on("request", (request) => {
    if (!request.url().includes("/api/track")) return;
    const body = request.postDataJSON() as { event?: unknown };
    if (typeof body.event === "string") trackingEvents.push(body.event);
  });

  await page.goto("/webinar/room?state=player-complete");

  const player = page.getByRole("region", { name: /training player:/i });
  const seek = page.getByRole("slider", { name: "Seek" });
  const replay = page.getByRole("button", { name: "Replay", exact: true }).first();

  await expect(player).toHaveAttribute("data-player-state", "completed");
  await expect(seek).toHaveAttribute("aria-valuenow", "100");
  await expect(seek).toHaveAttribute("aria-valuetext", "35:00 of 35:00");
  await expect(page.getByText(/35:00 \/ 35:00 .* 100%/)).toBeVisible();
  await expect(page.getByText("Training complete")).toBeVisible();
  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toBeVisible();

  await replay.click();
  await expect(player).toHaveAttribute("data-player-state", "playing");
  await expect(seek).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();
  expect(trackingEvents.filter((event) => event.startsWith("webinar_"))).toEqual([]);
});

test("booking offer review state opens at the pitch point and links to booking", async ({ page }) => {
  const trackingEvents: string[] = [];
  page.on("request", (request) => {
    if (!request.url().includes("/api/track")) return;
    const body = request.postDataJSON() as { event?: unknown };
    if (typeof body.event === "string") trackingEvents.push(body.event);
  });

  await page.goto("/webinar/room?state=offer-visible");

  const player = page.getByRole("region", { name: /training player:/i });
  const seek = page.getByRole("slider", { name: "Seek" });
  const bookingLink = page.getByRole("link", { name: /book my free strategy call/i });

  await expect(player).toHaveAttribute("data-player-state", "paused");
  await expect(seek).toHaveAttribute("aria-valuenow", "70");
  await expect(seek).toHaveAttribute("aria-valuetext", "24:30 of 35:00");
  await expect(page.getByText(/24:30 \/ 35:00 .* 70%/)).toBeVisible();
  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();
  await expect(bookingLink).toBeVisible();

  await bookingLink.click();
  await expect(page).toHaveURL(/\/webinar\/call$/);
  expect(trackingEvents).not.toContain("offer_cta_clicked");
});

test("confirmation page reaches the training and reveals its booking CTA", async ({ page }) => {
  await page.goto("/webinar/confirmed");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/training is ready/i);
  await expect(page.getByText("QUESTION 1 OF 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "V1" })).toHaveCount(0);

  await page.getByRole("link", { name: /prefer to skip/i }).click();
  await expect(page).toHaveURL(/\/webinar\/room$/);
  await expect(page.getByText("FREE TRAINING", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toHaveCount(0);

  const player = page.getByRole("button", { name: "Play", exact: true }).first();
  await player.click();
  await expect(page.getByRole("button", { name: "Pause", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).first().click();

  const seek = page.getByRole("slider", { name: "Seek" });
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");

  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toBeVisible();
});

test("quiz shows the choice before continuing", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-1");

  const continueButton = page.getByRole("button", { name: "Continue" });
  const choices = page.getByRole("radio");
  const firstChoice = page.getByRole("radio", { name: /collector calls won't stop/i });

  await expect(choices).toHaveCount(4);
  await expect(firstChoice).not.toBeChecked();
  await expect(page.getByText("Choose one answer to continue.")).toBeVisible();
  await expect(continueButton).toBeDisabled();

  await firstChoice.focus();
  await expect
    .poll(() =>
      firstChoice.evaluate((element) =>
        getComputedStyle(element.closest("label") as HTMLLabelElement).outlineStyle,
      ),
    )
    .toBe("solid");

  await page.getByText("The collector calls won't stop", { exact: true }).click();
  await expect(firstChoice).toBeChecked();
  await expect(page.getByText("Answer selected. Continue when ready.")).toBeVisible();
  await expect(page.getByText("QUESTION 1 OF 3")).toBeVisible();
  await expect(continueButton).toBeEnabled();

  await continueButton.click();
  await expect(page.getByText("QUESTION 2 OF 3")).toBeVisible();
});

test("quiz question two review state keeps the first answer and starts empty", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-2");

  const continueButton = page.getByRole("button", { name: "Continue" });
  const secondQuestionChoices = page.getByRole("radio");

  await expect(page.getByText("QUESTION 2 OF 3")).toBeVisible();
  await expect(page.getByRole("group", { name: "Have you tried to fix it before?" })).toBeVisible();
  await expect(secondQuestionChoices).toHaveCount(4);
  await expect
    .poll(() =>
      secondQuestionChoices.evaluateAll((choices) =>
        choices.every((choice) => !(choice as HTMLInputElement).checked),
      ),
    )
    .toBe(true);
  await expect(continueButton).toBeDisabled();

  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByText("QUESTION 1 OF 3")).toBeVisible();
  await expect(page.getByRole("radio", { name: /collector calls won't stop/i })).toBeChecked();
});

test("quiz question three review state keeps earlier answers and starts empty", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-3");

  const openTraining = page.getByRole("button", { name: /take me to the training/i });
  const finalChoices = page.getByRole("radio");

  await expect(page.getByText("QUESTION 3 OF 3")).toBeVisible();
  await expect(page.getByRole("group", { name: "How soon do you want this handled?" })).toBeVisible();
  await expect(page.getByText("Choose one answer to open the training.")).toBeVisible();
  await expect(finalChoices).toHaveCount(3);
  await expect
    .poll(() =>
      finalChoices.evaluateAll((choices) =>
        choices.every((choice) => !(choice as HTMLInputElement).checked),
      ),
    )
    .toBe(true);
  await expect(openTraining).toBeDisabled();

  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByText("QUESTION 2 OF 3")).toBeVisible();
  await expect(page.getByRole("radio", { name: "I disputed it myself" })).toBeChecked();
});

test("quiz ready review state shows the final answer and enabled action", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-ready");

  const finalAnswer = page.getByRole("radio", { name: /as soon as possible/i });
  const openTraining = page.getByRole("button", { name: /take me to the training/i });

  await expect(page.getByText("QUESTION 3 OF 3")).toBeVisible();
  await expect(finalAnswer).toBeChecked();
  await expect(page.getByText("Answer selected. Open the training when ready.")).toBeVisible();
  await expect(openTraining).toBeEnabled();
  await expect(openTraining).toBeInViewport();

  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByRole("radio", { name: "I disputed it myself" })).toBeChecked();
});

test("quiz loading review state locks the quiz while training opens", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-loading");

  const quizCard = page.locator(".v3-panel").filter({ hasText: "QUESTION 3 OF 3" });
  const finalAnswer = page.getByRole("radio", { name: /as soon as possible/i });
  const openingButton = page.getByRole("button", { name: /opening the training/i });

  await expect(quizCard).toHaveAttribute("aria-busy", "true");
  await expect(finalAnswer).toBeChecked();
  await expect(finalAnswer).toBeDisabled();
  await expect(page.getByRole("button", { name: /back/i })).toBeDisabled();
  await expect(openingButton).toBeDisabled();
  await expect(openingButton).toBeInViewport();
  await expect(page.getByRole("link", { name: /prefer to skip/i })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByRole("status")).toHaveText("Opening your training. Please wait.");
});
