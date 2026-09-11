/**
 * ShipConsole AI Chatbot - Step 2: Playwright UI Automation Spec
 * 
 * Reads evals/datasets/synthesized_safety_dataset.json, logs into ShipConsole portal,
 * submits pending prompts (actual_output: null) sequentially to the live UI chatbot,
 * and saves live responses to disk per question.
 * 
 * Pipeline Position:
 *   - Step 1: DeepEval Synthesizer (evals/synthesize_dataset.py)
 *   - Step 2: Playwright UI Automation (this spec)
 *   - Step 3: DeepEval Evaluation Suite (evals/test_agent_synthesized.py)
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { ChatbotWidget } from '../pages/ChatbotWidget.js';
import fs from 'fs';
import path from 'path';

const datasetPath = path.resolve(process.cwd(), 'evals/datasets/synthesized_safety_dataset.json');

test.describe('ShipConsole AI Chatbot JS Playwright Suite', () => {
  test('login to portal, send prompts to UI chatbot, and save actual outputs', async ({ page }) => {
    test.setTimeout(1200000);

    const loginPage = new LoginPage(page);
    const chatbot = new ChatbotWidget(page);

    // 1. Load dataset from JSON
    let dataset = [];
    if (fs.existsSync(datasetPath) && fs.statSync(datasetPath).size > 0) {
      try {
        const rawData = fs.readFileSync(datasetPath, 'utf-8');
        dataset = JSON.parse(rawData);
      } catch (err) {
        console.log('[Warning] Could not parse dataset JSON. Initializing clean array.');
        dataset = [];
      }
    }

    if (!Array.isArray(dataset) || dataset.length === 0) {
      dataset = [{ input: 'hi', expected_output: 'Hello! How can I help you?', actual_output: null }];
    }

    // Filter prompts missing actual_output
    const pendingItems = dataset.filter(item => !item.actual_output || String(item.actual_output).trim().length === 0);
    console.log(`[JS Playwright] Total dataset prompts: ${dataset.length}. Prompts needing actual_output: ${pendingItems.length}`);

    if (pendingItems.length === 0) {
      console.log('[JS Playwright] All dataset items already have actual_output populated! Skipping UI execution.');
      expect(dataset.length).toBeGreaterThan(0);
      return;
    }

    // 2. Login to ShipConsole Portal
    // await loginPage.navigate('https://qa.shipconsole.com/ShipConsole/login');
    // await loginPage.login('Demo_Supplier', 'Welcome1@');

    await loginPage.navigate('https://sandbox.shipconsole.com/ShipConsole/login');
    await loginPage.login('JDE_Shipper', 'Welcome1@');
    

    // 3. Open Chatbot Widget
    await chatbot.openChatbot();

    // 4. Process pending prompts sequentially
    for (let i = 0; i < dataset.length; i++) {
      const item = dataset[i];

      // Skip prompts already containing actual_output
      if (item.actual_output && String(item.actual_output).trim().length > 0) {
        console.log(`[JS Playwright] [Question ${i + 1}/${dataset.length}] Skipping "${item.input.substring(0, 40)}..." (actual_output already present).`);
        continue;
      }

      console.log(`\n[JS Playwright] [Question ${i + 1}/${dataset.length}] Processing prompt: "${item.input}"`);

      const prevCount = await chatbot.responseBubbles.count();

      // Send prompt to UI chatbot
      await chatbot.sendPrompt(item.input);

      // Wait until streamed response finishes completely
      const liveResponse = await chatbot.getLatestBotResponse(prevCount);
      item.actual_output = liveResponse;
      console.log(`[JS Playwright] [Question ${i + 1}/${dataset.length}] Captured complete response (${liveResponse.length} chars).`);

      // Write updated dataset to disk BEFORE proceeding to next prompt
      fs.writeFileSync(datasetPath, JSON.stringify(dataset, null, 4), 'utf-8');
      console.log(`[JS Playwright] [Question ${i + 1}/${dataset.length}] Saved actual_output to disk. Moving to next question...\n`);
    }

    expect(dataset.length).toBeGreaterThan(0);
  });
});
