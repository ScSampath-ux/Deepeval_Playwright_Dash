/**
 * ShipConsole Portal - Chatbot Widget Page Object Model (POM)
 * 
 * Interacts with the floating AI Assistant chatbot drawer widget on the portal UI:
 * opens the drawer, submits input prompts, and polls until streaming bot responses complete.
 */
export class ChatbotWidget {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.chatInput = page.getByRole('textbox', { name: 'Type your question...' });
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.responseBubbles = page.locator('.text-sm.leading-relaxed.ng-star-inserted')
      .or(page.locator('.rounded-xl.border.border-primary\\/15.bg-surface-0\\/90.p-3.shadow-xs.transition-all.hover\\:border-primary\\/30.dark\\:bg-surface-900\\/90.ng-star-inserted'))
      .or(page.locator('div[class*="rounded-xl"][class*="border-primary"]'));
  }

  /**
   * Opens the floating AI Chatbot drawer by clicking the bot avatar button in the UI.
   */
  async openChatbot() {
    console.log("[Playwright] Clicking Chatbot trigger button via DOM evaluate script...");

    await this.page.evaluate(() => {
      const botButton = document.querySelector('button img[src*="bot"], button img[src*="avatar"]')?.closest('button')
        || document.querySelector('div.fixed.bottom-4 button, div.fixed.bottom-5 button');

      if (botButton) {
        botButton.click();
      } else {
        const allButtons = Array.from(document.querySelectorAll('button'));
        const chatBtn = allButtons.find(btn => {
          const rect = btn.getBoundingClientRect();
          return rect.bottom > window.innerHeight - 100 && rect.right > window.innerWidth - 100;
        });
        chatBtn?.click();
      }
    });

    await this.page.waitForTimeout(1500);
  }

  /**
   * Submits an input prompt message to the AI Chatbot widget.
   * @param {string} message Input text prompt
   */
  async sendPrompt(message) {
    console.log(`[Playwright] Sending prompt: "${message.substring(0, 50)}..."`);

    await this.chatInput.waitFor({ state: 'visible', timeout: 15000 });
    await this.chatInput.click({ force: true });
    await this.chatInput.fill(message);
    await this.sendButton.click({ force: true });
  }

  /**
   * Gracefully polls until the Chatbot finishes streaming its complete response text.
   * @param {number} prevBubbleCount Count of response bubbles before sending prompt
   * @return {Promise<string>} Streamed chatbot response text
   */
  async getLatestBotResponse(prevBubbleCount = 0) {
    console.log('[Playwright] Waiting for bot response bubble...');

    let attempts = 0;
    while (attempts < 180) {
      const currentCount = await this.responseBubbles.count().catch(() => 0);
      if (currentCount > prevBubbleCount) {
        break;
      }
      await this.page.waitForTimeout(1000);
      attempts++;
    }

    const lastBubble = this.responseBubbles.last();

    let previousText = '';
    let stableCount = 0;
    for (let i = 0; i < 120; i++) {
      const currentText = await lastBubble.innerText().catch(() => '');
      if (currentText && currentText === previousText && currentText.trim().length > 0) {
        stableCount++;
        if (stableCount >= 2) {
          return currentText.trim();
        }
      } else {
        previousText = currentText;
        stableCount = 0;
      }
      await this.page.waitForTimeout(1000);
    }

    return (await lastBubble.innerText().catch(() => '')).trim();
  }
}
